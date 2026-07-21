# Acudex — Root Cause Analysis

I have read every line of your core codebase. Here is the honest, unflinching assessment.

---

## Verdict: The AI integration works. The data pipeline is broken.

The Gemini/Groq AI layer is actually solid — the prompts are well-crafted, the server-side proxy route is correctly implemented with fallback logic, and the `repairAndParse` function handles common AI output issues gracefully.

**The real problem is that the app can never reliably get the document text to the AI in the first place.** Every failure you've seen — the `Unexpected token '<'`, the `502`, the `Failed to fetch`, and now `Could not load document from Google Drive` — is a symptom of the same underlying architectural issue: **the document storage and retrieval pipeline is fundamentally fragmented and unreliable.**

---

## Issue #1: The Phantom Google Drive Dependency (Your Current Error)

> [!CAUTION]
> This is the immediate cause of the error you just hit.

**The error message:** `Could not load document "Eco: Building Blocks in Economics: The Problem of Choice" from Google Drive. Please ensure it is synced.`

**Where it comes from:** [AcuExam.tsx, line 310](file:///e:/Antigravity/SmartGuide/src/components/AcuExam.tsx#L304-L311)

```typescript
// Line 304-311 in AcuExam.tsx
if (!doc.pages || doc.pages.length === 0) {
  setLoadingMessage(`Fetching "${doc.name}" from Google Drive...`);
  const fullDoc = await loadSingleDocumentFromDrive(docId);
  if (fullDoc) {
    doc = { ...doc, pages: fullDoc.pages };
  } else {
    throw new Error(`Could not load document "${doc.name}" from Google Drive...`);
  }
}
```

**What's happening:** When AcuExam needs to generate a paper, it retrieves the document from `db.getDocumentSources()`. But the document object it receives **has no `pages` array** (it's empty: `[]`). So the code falls through to Google Drive as a "backup source" to fetch the actual page content. If the user isn't signed into Drive, or the document was never synced there, it crashes with this error.

**The same pattern exists in AcuSlide** ([line 914-921](file:///e:/Antigravity/SmartGuide/src/components/AcuSlide.tsx#L914-L921)) — selecting a chapter also falls back to `loadSingleDocumentFromDrive()`.

### Why are the pages empty?

This leads directly to Issue #2.

---

## Issue #2: Firestore Stores Metadata-Only Document Shells

**The core data flow for document upload is:**

1. User uploads a PDF/DOCX/TXT → text is extracted client-side → a `DocumentSource` object is created with `{ id, name, subject, pages: [...], chapterMap: [...] }`.
2. `dbService.saveDocumentSource()` saves this to **Firestore** (`profiles/{uid}/documents/{docId}`).
3. `cacheDocument()` also saves it to **IndexedDB** locally.
4. Optionally, `saveDocumentToDrive()` uploads the full JSON to Google Drive.

**The problem:** A typical textbook PDF produces a `DocumentSource` with dozens of pages of extracted text. This can easily be **5-20 MB of JSON**. Firestore documents have a **1 MB size limit**. When `saveDocumentSource()` writes a large document to Firestore, it silently truncates, errors out, or stores a partial/corrupted version. The result is a Firestore document that has `name`, `subject`, `chapterMap`… but `pages: []` or missing page content.

Then when the user returns in a new browser session (or clears their cache, or logs in from another device):

1. `getDocumentSources()` fetches the document from Firestore → gets the metadata shell with empty pages.
2. It merges with IndexedDB cache (which may have the full document if it's the same browser).
3. If IndexedDB doesn't have it (new device, cleared cache), the document appears in the library **but has no actual text content**.
4. AcuExam/AcuSlide detects `pages.length === 0` → falls back to Google Drive → Drive either has it (if the user happened to be connected and it synced successfully) or doesn't → **crash**.

### This is why the error is intermittent

- On the **same browser** where the document was uploaded, IndexedDB still has the full document → everything works.
- On a **different browser/device**, or after clearing site data → Firestore returns the empty shell → crash.
- If Drive happened to be connected during upload → Drive may have the backup → it works by luck.

---

## Issue #3: Four Competing Storage Layers With No Source of Truth

The document retrieval code in [db.ts, lines 493-525](file:///e:/Antigravity/SmartGuide/src/lib/db.ts#L493-L525) reveals the full horror:

```typescript
async getDocumentSources(profileId: string): Promise<DocumentSource[]> {
  let list: DocumentSource[] = [];

  // Layer 1: Firestore (may have empty pages due to 1MB limit)
  if (isFirebaseConfigured && firestore) {
    const snap = await getDocs(...);
    snap.forEach(d => { if (data && data.id) list.push(data); });
  }

  // Layer 2: IndexedDB (sync.ts cache — may or may not exist)
  const cachedDocs = await getCachedDocuments();
  for (const cd of cachedDocs) {
    if (!list.find(m => m.id === cd.id)) list.push(cd);
  }

  // Layer 3: localStorage mock (legacy, may have stale data)
  const localDocs = getMockData(LOCAL_MOCK_DOCUMENTS, []);
  for (const ld of localDocs) {
    if (!list.find(m => m.id === ld.id)) list.push(ld);
  }

  return list;
}
```

And then the components add a **4th layer**: Google Drive as a runtime fallback.

The merge logic is **"first writer wins"**: if Firestore returns the document first (with empty pages), the IndexedDB version with full pages is **skipped** because `list.find(m => m.id === cd.id)` returns true. The broken version from Firestore takes precedence.

| Layer | Has Full Pages? | Survives Browser Clear? | Survives Device Switch? |
|---|---|---|---|
| Firestore | ❌ (1MB limit) | ✅ | ✅ |
| IndexedDB | ✅ | ❌ | ❌ |
| localStorage | ✅ (if legacy) | ❌ | ❌ |
| Google Drive | Maybe | ✅ | ✅ |

**There is no reliable storage layer that both survives across devices AND contains the full document content.**

---

## Issue #4: The AI Integration Is Sound — But Starved of Data

The AI pipeline is actually well-built:

- ✅ Server-side proxy route with Gemini → Groq fallback
- ✅ Rate limiting (both client-side and server-side)
- ✅ `repairAndParse()` handles truncated JSON and markdown fences
- ✅ Structured prompts with clear JSON schemas
- ✅ Subject-specific instructions via `getSubjectSpecificInstructions()`
- ✅ Board blueprint integration with 30+ exam boards

**But none of this matters if `textSlices` is empty.** Every generation function follows this pattern:

```typescript
const textSlices = selectedDoc.pages
  .filter(p => p.pageNumber >= chap.startPage && p.pageNumber <= chap.endPage)
  .map(p => p.text)
  .join("\n\n");

if (textSlices.trim().length === 0) {
  throw new Error("No readable text content in the selected page range.");
}
```

When `selectedDoc.pages` is `[]` (because Firestore returned the shell), this throws immediately, or the Drive fallback fails and the user never even reaches the AI call.

---

## Issue #5: The Deployment Architecture Is a Split-Brain System

The app currently requires **two separate build and deploy pipelines** that are easy to get out of sync:

| Component | Build Command | Deploy Target | What It Serves |
|---|---|---|---|
| Static Frontend | `STATIC_EXPORT=true npm run build` → `out/` | Firebase Hosting (`firebase deploy --only hosting`) | HTML/JS/CSS pages |
| Server Backend | `gcloud run deploy --source .` | Cloud Run (`ssracudex`) | `/api/*` routes |

- `next.config.ts` now uses a conditional `output` setting based on `STATIC_EXPORT` env var.
- The frontend hardcodes the Cloud Run URL (`https://ssracudex-963945863708.us-central1.run.app`) for direct API calls.
- The Cloud Run service needs `GOOGLE_NODE_RUN_SCRIPTS=build` to compile Next.js in-cloud.
- The `firebase.json` rewrites still point `/api/**` to Cloud Run (now redundant since the frontend bypasses it).

This is fragile. Any deploy that misses one half leaves the app in an inconsistent state — which is exactly what happened earlier today (stale `out/` directory, missing `.next/` in the container, etc.).

---

## Summary: What Is Actually Wrong

| # | Problem | Impact | Severity |
|---|---|---|---|
| 1 | Documents stored in Firestore exceed 1MB limit → pages silently lost | Documents appear in library but have no content for AI | 🔴 Critical |
| 2 | 4 storage layers with "first writer wins" merge → broken version takes precedence | Full IndexedDB copy gets shadowed by empty Firestore copy | 🔴 Critical |
| 3 | Google Drive used as runtime data source, not just backup | App crashes when Drive isn't connected or doc wasn't synced | 🔴 Critical |
| 4 | No Firestore size validation before write | Large docs fail silently, user thinks upload succeeded | 🟠 High |
| 5 | Split-brain deployment (static export + Cloud Run) easy to misconfigure | Stale code, missing builds, CORS issues on every deploy | 🟠 High |

> [!IMPORTANT]
> **The app is NOT ornamental.** The AI integration, the exam generation, the grading pipeline, the board blueprints — all of this works correctly when given text. The fundamental failure is that **the document text cannot reliably survive a round-trip through storage and retrieval.** Fix the storage pipeline, and the rest of the app will work as designed.
