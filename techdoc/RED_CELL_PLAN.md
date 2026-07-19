# Red Cell Implementation Plan — Acu

Based on the 10-point CIA Red Cell analysis. Organized by priority and impact. **Do not build — plan only.**

---

## Phase 0: Critical Safety (Week 1)

### 0.1 Firestore Security Rules
**Red Cell finding #4:** No security rules in repo; DB is wide-open to anyone who inspects the client.

**Action:**
- Write and commit Firestore security rules to `firestore.rules`
- Lock down `profiles` collection (read: own doc only or admin; write: own doc only)
- Lock down `reviews` collection (read: public; write: authenticated only, rate-limited)
- Lock down `coupons` collection (read: deny all; write: admin only via cloud function)
- Add `deny if false` as default catch-all
- Deploy with `firebase deploy --only firestore:rules`

**Dependencies:** Firebase CLI, access to Firebase Console
**Owner:** Developer

### 0.2 localStorage → Firestore Data Migration
**Red Cell finding #8:** Dual-storage path orphans users on one system or the other.

**Action:**
- Build a one-time migration script that reads all keys from `acu_mock_*` in localStorage
- Writes them to corresponding Firestore collections
- Sets a flag `acu_migration_completed` in localStorage
- Runs automatically on app mount if Firebase is configured and migration flag is absent
- Logs migration status per key (success/fail/skipped)

**Dependencies:** Firestore schema already exists
**Owner:** Developer

### 0.3 Cost Monitoring
**Red Cell finding #10:** No cost model or alerts; first sign of traction = surprise bill.

**Action:**
- Set up Firebase Budget alerts in Google Cloud Console (email + webhook) at $20, $50, $100/month
- Add a client-side read/write counter that logs daily usage to console
- Document max user capacity per Firebase tier (Spark: 50K reads/day, Blaze: pay-as-you-go)
- Add a `NEXT_PUBLIC_FIREBASE_USAGE_WARNING` env var to show an admin banner when approaching limits

**Dependencies:** GCP project owner access
**Owner:** Developer

---

## Phase 1: User Experience Fixes (Week 2-3)

### 1.1 Eliminate API Key Onboarding Friction
**Red Cell finding #2:** 5-step API key flow kills conversion — 70%+ churn before first use.

**Action:**
- **Option A (recommended):** Add a serverless proxy (Vercel Edge Function or Cloud Function) that accepts a pre-configured API key from an env var so the app works immediately on first launch
- **Option B (lower effort):** Bundle a temporary free-tier Gemini API key with strict server-side rate limiting (5 requests total before forcing user to add their own)
- **Option C (minimum):** Auto-detect if the user has a Gemini API key in their clipboard (via `navigator.clipboard.readText()`) after clicking "Get your key" to reduce copy-paste friction

**Dependencies:** Phase 0.1 (security rules must be in place before adding any serverless function)
**Owner:** Developer + Product

### 1.2 Cross-Device Sync Engine (Replace Dual-Storage)
**Red Cell finding #3:** "Data loss by default" is unacceptable. Full text lives only in localStorage — Device B sees metadata but cannot generate anything. Drive backup is manual and write-only.

**Goal:** A user uploads a textbook on Device A, signs in on Device B, and every document, exam attempt, and study artifact is immediately available — no Drive setup, no manual backup, no data loss.

---

**Architecture:**

```
┌─────────────────────────────────────────┐
│              Sync Engine                 │
│  ┌──────────┐   ┌────────────────────┐  │
│  │ Queue     │──▶│ Firestore          │  │
│  │ (IDB)     │   │ (source of truth)  │  │
│  └──────────┘   └────────┬───────────┘  │
│                          │              │
│  ┌──────────┐   ┌───────▼───────────┐  │
│  │ IndexedDB│◀──│ Sync on app mount  │  │
│  │ (cache)  │   │ + real-time        │  │
│  └──────────┘   └────────────────────┘  │
│  ┌────────────────────────────────────┐  │
│  │ Google Drive (automatic background │  │
│  │ backup — no user action required) │  │
│  └────────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

---

**Action:**

#### A. Firestore Schema Changes — Store Full Content

| Collection | Current | Changed To |
|---|---|---|
| `profiles/{uid}/documents/{docId}` | Metadata only (`pages: []`) | **Full DocumentSource including `pages` array with page text** |
| `profiles/{uid}/attempts/{attemptId}` | Metadata only (`answers: []`) | **Full ExamAttempt including `answers` array with student answers, model answers, feedback** |
| `profiles/{uid}/artifacts/{artifactId}` | Does not exist | **New collection — generated study materials (slides, notes, flashcards, etc.)** |

Add a `updatedAt: timestamp` and `syncedAt: timestamp` field to every document.

**Firestore cost impact:**
- A 500-page textbook (~200KB of text) stored in Firestore = 1 document read when user opens the library, 1 document read per generation
- At the free Spark tier: 50K reads/day → ~50 full-textbook loads per day before throttling
- At Blaze tier: $0.06 per 100K reads → ~$0.00006 per textbook load — negligible
- **Recommendation:** Move to Blaze tier with a budget alert (already in Phase 0.3) to absorb the extra reads

#### B. Replace localStorage with IndexedDB

- localStorage is synchronous, blocking, and capped at ~5-10MB — insufficient for full textbook text
- IndexedDB is async, non-blocking, and supports 50MB+ without prompting (unlimited with user permission)
- Use `idb` (tiny wrapper, already compatible) or the native IndexedDB API
- Key stores in IndexedDB:
  - `documents` — full document cache (mirrors Firestore)
  - `attempts` — full exam cache
  - `artifacts` — generated study materials
  - `syncQueue` — pending mutations not yet pushed to Firestore
- On app mount: IndexedDB is the local source of truth. Firestore is the remote source of truth.

#### C. Sync Engine Core (New `src/lib/sync.ts`)

**On app mount (automatic):**

1. Load user profile from Firebase Auth
2. Read all documents/attempts/artifacts from Firestore (with `updatedAt > lastSyncedAt`)
3. Write them to IndexedDB
4. Update `lastSyncedAt` timestamp
5. For any IndexedDB entries with `updatedAt > lastSyncedAt` (offline mutations) — push them to Firestore

**On every write (document upload, exam attempt, artifact generation):**

1. Write to IndexedDB immediately (instant, works offline)
2. Add mutation to `syncQueue` in IndexedDB
3. If online: flush the queue to Firestore immediately
4. If offline: queue stays in IndexedDB. Flush on next `online` event.

**Real-time sync (optional, Phase 2):**

- Subscribe to Firestore `onSnapshot` for the user's collections
- On remote change: upsert into IndexedDB with the remote `updatedAt`
- If local `updatedAt > remote updatedAt`: local wins (last-write-wins)
- Show a subtle badge: "Updated from another device" on affected items

**Conflict resolution:**
- **Last-write-wins by `updatedAt` timestamp.** Simple, transparent, predictable.
- Both Firestore and IndexedDB entries carry `updatedAt` on every mutation
- On collision: the entry with the later `updatedAt` wins
- No merge logic — if two devices edit different fields of the same document, the later full-write replaces the earlier one. Acceptable for this use case (documents are immutable after upload; exam attempts are write-once).

#### D. Drive Relegated to Silent Background Backup

- On every successful Firestore write, silently kick off a Drive backup (same as today's `backupToDrive` but automatic — no button press)
- Remove the Drive setup modal from onboarding
- Replace with a small toggle in Settings: "Backup to Google Drive" (ON by default)
- If Drive is not connected: no interruption, no warning, no blocking. Sync works via Firestore alone.

#### E. Migration from Existing localStorage Data

- On first app mount after this update, read all existing `acu_mock_documents`, `acu_mock_attempts`, etc. from localStorage
- Write them to IndexedDB
- Push them to Firestore
- Set `acu_migration_completed: true` in localStorage
- Remove old localStorage keys

**Dependencies:**
- Phase 0.1 (Firestore security rules must be in place before schema change)
- Phase 0.3 (cost monitoring — Firestore reads will increase)
- Firestore pricing analysis and budget set before deploying

**Owner:** Developer
**Estimated effort:** 2 weeks (schema changes + sync engine + IndexedDB migration + testing)

### 1.3 OCR Fallback + Better PDF Error Messages
**Red Cell finding #7:** Silent failure on scanned PDFs — the most common textbook format.

**Action:**
- Detect when `pdfjs-dist` returns zero pages or empty text
- Show a specific, user-friendly error: "This PDF appears to be scanned images — Acu can't read the text directly. Try uploading a PDF with selectable text (not a photo/scan)."
- Add a link to a guide on converting scanned PDFs to text
- Future: integrate a free OCR tier (Tesseract.js via WebAssembly) for basic scanned PDFs

**Dependencies:** None for error message; Tesseract.js integration is separate
**Owner:** Developer

---

## Phase 2: Architecture Hardening (Week 3-5)

### 2.1 Serverless API Key Proxy
**Red Cell finding #1:** The "privacy-first" claim is hollow — the API key is exposed to every browser extension.

**Action:**
- Create a Vercel Edge Function or Firebase Cloud Function at `/api/ai/generate`
- The function accepts the prompt content, adds the API key from its own env var, calls Gemini, and returns the result
- The user's browser never sees the API key
- Add per-user rate limiting (based on Firebase Auth UID) at the function level
- Fall back to direct client-side call if the function is unreachable (offline mode)

**Architecture:**
```
Browser ──→ Edge Function (adds API key) ──→ Gemini API
             ↑
        Env var (server-side, invisible to client)
```

**Dependencies:** Vercel/Cloud Functions setup, Phase 0.1 (security rules)
**Owner:** Developer

### 2.2 Server-Side Rate Limiting
**Red Cell finding #6:** Client-side rate limiting is theater — trivially bypassed via DevTools.

**Action:**
- Move rate limiting to the serverless proxy (from 2.1)
- Track per-UID request counts in Firestore or Redis (Upstash)
- Enforce the same limits (5/min, 20/day) at the proxy level
- Keep client-side enforcement as an optimistic UI guard only
- Make thresholds configurable via env vars on the server

**Dependencies:** Phase 2.1 (serverless proxy must exist first)
**Owner:** Developer

### 2.3 Board Blueprint Verification Pipeline
**Red Cell finding #5:** Static blueprints with no freshness guarantee.

**Action:**
- Add a `blueprint_updated_at` field to each blueprint
- Create a simple dashboard page at `/admin/blueprints` that shows:
  - Each blueprint's `lastVerified` date
  - Days since last verification
  - A "Mark verified" button for admin
- Set up a quarterly reminder (calendar invite) to verify and update blueprints against official board notifications
- Add a banner on exam generation: "This blueprint was last verified [X months ago]. Verify against official board website."

**Dependencies:** Admin panel already exists
**Owner:** Product/Content

---

## Phase 3: Business Model (Week 6)

### 3.1 Early Bird Promotion (3-Month Limited)
**Red Cell finding #9:** "₹499 one-time" exists in UI but no way to actually pay. First 100 users get premium free forever — no revenue path.

**Action:**
- Change the early bird logic: first 100 users get **3 months of free premium**, not free forever
- Add `premium_expires_at: string` field to `UserProfile` in Firestore and localStorage
- On signup, if premium count < 100:
  ```
  is_premium: true
  premium_expires_at: created_at + 3 months (ISO string)
  coupon_applied: "EARLY_BIRD_100"
  ```
- On app mount + on sign-in: run an expiry check:
  ```
  if (user.premium_expires_at && new Date() > new Date(user.premium_expires_at)) {
    user.is_premium = false;
    user.premium_expires_at = null;
    // Save to Firestore + localStorage
    // Show a banner: "Your 3-month free trial has ended. Upgrade to continue."
  }
  ```
- Update `PricingPage.tsx`:
  - Replace "Early Bird: First 100 users get it FREE" with **"First 100 users — 3 months free"** and show a countdown
  - Show the actual price cards once the promotion period ends (or all 100 slots fill)
  - Remove the "All payments are one-time. No subscriptions." footer

**Pricing model (after promotion):**
| Plan | Price | Best for |
|---|---|---|
| Free | ₹0 | 2 documents, MCQ-only grading |
| Monthly | ₹99/mo | Students who want flexibility |
| Annual | **₹499/yr** (₹42/mo) | **Serious students — recommended** |
| Lifetime | ₹1,499 one-time | Users who hate subscriptions |

**Files to change:**
- `src/lib/db.ts` — `UserProfile` interface (+`premium_expires_at`), `signUp` logic, expiry check function, `getPremiumUserCount` logic
- `src/components/PricingPage.tsx` — updated pricing cards, early bird messaging
- `src/components/AcuLibrary.tsx` — respect expiry for premium feature gating

**Dependencies:** Phase 0.1 (security rules)
**Owner:** Developer + Business

### 3.2 Payment Gateway (UPI Only)
**Action:**
- Integrate Razorpay — **UPI only** (no cards, no netbanking, no wallets)
- UPI is free (0% fee by RBI mandate) vs 2% + GST on cards. For a ₹499 transaction, that's ₹0 vs ~₹12 saved per transaction.
- Create a `/api/payments/create-order` serverless function
- Create a `/api/payments/verify` serverless function (server-side signature verification — never trust the browser)
- On the frontend, restrict Checkout.js to UPI only: `method: { upi: true }`
- On successful payment webhook (`payment.captured`), set `is_premium: true` + `premium_expires_at` on the user's Firestore profile
- Use Razorpay Subscriptions API for recurring billing (monthly ₹99 / annual ₹499)
- Remove the mock "any code with FREE or ACUBETA works" fallback

**Current Account requirement:**
- **Sole proprietors / individuals:** No current account needed — personal bank account is sufficient
- **Registered businesses (PVT Ltd, LLP, Partnership):** Current account required
- Razorpay settles funds to the provided bank account on T+2 basis

**Dependencies:** Phase 0.1 (security rules), Phase 2.1 (serverless infra)
**Owner:** Developer + Business

---

## Summary Timeline

```
Week 1     │  Phase 0: Security rules + Migration + Cost alerts
Week 2-3   │  Phase 1: Auto-onboarding + Data persistence + PDF errors
Week 3-5   │  Phase 2: API key proxy + Server rate limiting + Blueprint pipeline
Week 6     │  Phase 3: Early bird promotion + Payment gateway + Subscription engine
           │
           │  ↓ Mobile app port only after Phase 1 and Phase 2 are complete
```

**Gate:** Do not begin mobile port (previously estimated at 18-22 weeks) until Phases 0-2 are complete. Otherwise the mobile app inherits all 10 vulnerabilities and multiplies the rework cost.
