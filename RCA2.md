# Root Cause Analysis — "Could not load document from Google Drive"

## Error Trace
> `"Generation failed: Could not load document 'Eco: Building Blocks in Economics: The Problem of Choice' from Google Drive. Please ensure it is synced."`

### Error origin points:
- `src/components/AcuExam.tsx:310` — multi-chapter exam generation path
- `src/components/AcuExam.tsx:238` — manual chapter override path
- `src/components/AcuSlide.tsx:921` — study desk chapter selection

### Logic that triggers the error:
When `doc.pages` is empty or missing, the code calls `loadSingleDocumentFromDrive(docId)`. If that returns null, the error is thrown. The document's **metadata** (name, id, chapterMap) is present, but the **actual page text payload (`pages[]`)** is gone.

---

## Root Cause 1 — The Sync Overwrite Bug (PRIMARY)

This is the most likely trigger on subsequent visits.

1. User uploads a textbook → `saveDocumentSource()` writes the full `DocumentSource` (including `pages[]`) to **Firestore** and **IndexedDB cache**
2. On **every subsequent page load or auth state change**, `subscribeAuthState()` (`page.tsx:39`) triggers `syncFromFirestore()` (`db.ts:352`)
3. `syncFromFirestore()` (`sync.ts:151-177`) reads from Firestore and **overwrites** the IndexedDB cache with whatever Firestore has
4. `getDocumentSources()` (`db.ts:493-526`) reads **Firestore first**, then merges IndexedDB docs **not already in Firestore**

**The bug:** If Firestore has a stale or truncated version of the document (e.g. pages dropped during a partial migration, an earlier failed upload, or the 1MB limit), the complete IndexedDB cache gets overwritten by the broken Firestore version. Since the doc ID exists in Firestore, the cached version is **skipped** in the merge. Result: the document loads without `pages`.

```typescript
// sync.ts:155-163 — reads Firestore, overwrites IndexedDB
const snap = await getDocs(collection(firestore, "profiles", profileId, "documents"));
for (const d of snap.docs) {
  await idbPut("documents", d.data());  // overwrites complete cache
}

// db.ts:510-516 — IndexedDB merge ONLY adds docs NOT in Firestore
const cachedDocs = await getCachedDocuments();
for (const cd of cachedDocs) {
  if (!list.find(m => m.id === cd.id)) {  // skipped if already in Firestore list
    list.push(cd);
  }
}
```

---

## Root Cause 2 — Firestore 1MB Document Limit

`saveDocumentSource()` (`db.ts:481-491`) writes the **entire** `DocumentSource` including the full `pages[]` array to Firestore:

```typescript
await setDoc(doc(firestore, "profiles", profileId, "documents", docSource.id), docSource);
```

Firestore has a **1MB per-document limit**. A textbook with 100+ pages of extracted text easily exceeds this. The `setDoc` either:
- Throws an error (caught, user sees "File ingestion failed")
- Or **silently fails** to persist the `pages` field

There is **no try-catch** around this `setDoc` and **no size check** before writing.

---

## Root Cause 3 — Non-awaited, Non-blocking Drive Sync

In `AcuLibrary.tsx:183-185`, the Drive sync is **not awaited**:

```typescript
await dbService.saveDocumentSource(user?.id || "anonymous", newDoc);
if (isDriveSignedIn()) {
  syncDocToDrive(newDoc);   // fire-and-forget — no await, no retry
}
```

If `saveDocumentSource` succeeds but `syncDocToDrive` fails silently in the background, the user sees **"Success!"** but the Drive backup never completed. Subsequent attempts to load from Drive will fail. On a different device or after a browser cache clear, only the (potentially truncated) Firestore data is available.

---

## Root Cause 4 — No Local Fallback in Generation Code

When `doc.pages` is empty, AcuExam and AcuSlide **only** try Google Drive:

```typescript
// AcuExam.tsx:304-312
if (!doc.pages || doc.pages.length === 0) {
  const fullDoc = await loadSingleDocumentFromDrive(docId);  // only Drive
  if (fullDoc) { doc = { ...doc, pages: fullDoc.pages }; }
  else { throw new Error(`Could not load document...`); }    // no local fallback
}
```

They never check **IndexedDB cache** or **localStorage** for the pages. The local browser storage (most complete, written at upload time) is ignored as a fallback.

---

## Root Cause 5 — Architectural Disconnect

The SESSION_LOG.md (July 11) states:
> "Firestore Metadata: Now serves exclusively as a lightning-fast index storing metadata"

But the actual code **never strips pages before saving to Firestore**. The `DocumentSource` with full `pages[]` is saved to both Firestore and IndexedDB. The "Hybrid Cloud Sync Architecture" described in the docs is **not reflected in the code**. The architecture says "Drive for payloads, Firestore for metadata" — the code says "everything everywhere, with Drive as the only fallback."

---

## Summary Table

| # | Root Cause | Where | Impact |
|---|-----------|-------|--------|
| 1 | `syncFromFirestore` overwrites complete IndexedDB cache with potentially truncated Firestore data | `sync.ts:155-163` + `db.ts:510-516` | Docs load without `pages` on subsequent visits |
| 2 | Firestore 1MB limit silently drops `pages` during upload | `db.ts:483` | Pages never persisted for large textbooks |
| 3 | `syncDocToDrive` is fire-and-forget with no await/retry | `AcuLibrary.tsx:184` | Drive backup incomplete but UI says success |
| 4 | No IndexedDB/localStorage fallback in generation code | `AcuExam.tsx:304-312`, `AcuSlide.tsx:917-921` | Single point of failure on Drive |
| 5 | Architecture design not reflected in actual code | `db.ts:481-491` (saves full pages to Firestore) | All layers try to store everything, cancelling out |

---

## Immediate Trigger for This Specific Error

The document "Eco: Building Blocks in Economics: The Problem of Choice" exists in Firestore with metadata but without `pages[]`. The generation code then tries Google Drive, which also doesn't have it (sync never completed or token expired). The error is technically correct — the data isn't where the code expects it.

**The AI integration works. The parsing works. The UI works.** The problem is a data persistence architecture bug where three storage layers (Firestore, IndexedDB, Google Drive) conflict through stale overwrites and missing fallbacks.
