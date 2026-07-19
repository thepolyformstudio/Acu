# Implementation Plan — Acu

## Phase 0: Foundation (Completed)

| Task | Files | Status |
|---|---|---|
| Next.js + TypeScript + Tailwind v4 project setup | `next.config.ts`, `tsconfig.json`, `postcss.config.mjs` | Done |
| Firebase project configuration (Auth + Firestore) | `src/lib/db.ts`, `.env`, `firebase.json` | Done |
| Dark theme globals.css with glassmorphism | `src/app/globals.css` | Done |
| Root layout with fonts & metadata | `src/app/layout.tsx` | Done |
| Path alias `@/*` → `./src/*` | `tsconfig.json` | Done |
| ESLint config | `eslint.config.mjs` | Done |

---

## Phase 1: Authentication & Onboarding (Completed)

| Task | Files | Complexity |
|---|---|---|
| Firebase Auth integration (email/password + Google) | `src/lib/db.ts:signUp, signIn, signInWithGoogle` | Medium |
| Mock localStorage auth (fallback) | `src/lib/db.ts` (mock methods) | Medium |
| AuthCard with sign in/up forms + role toggle | `src/components/AuthCard.tsx` | Medium |
| Google Sign-In with Drive scope | `src/lib/googleDrive.ts:signInToDrive` | Medium |
| API Key onboarding flow | `src/components/AuthCard.tsx` (onboarding state) | Low |
| Drive connection onboarding flow | `src/components/AuthCard.tsx` (drive step) | Low |
| Settings panel (API key & Drive management) | `src/components/SettingsPanel.tsx` | Low |
| Input validation utilities | `src/lib/validation.ts` | Low |

---

## Phase 2: Document Management (Completed)

| Task | Files | Complexity |
|---|---|---|
| PDF text extraction (pdfjs-dist) | `src/lib/pdfParser.ts` | Medium |
| DOCX text extraction (mammoth) | `src/lib/docxParser.ts` | Low |
| TXT text extraction | `src/lib/AcuLibrary.tsx:handleFileSelect` | Low |
| Document upload UI with file staging modal | `src/components/AcuLibrary.tsx` | Medium |
| Manual chapter mapping UI | `src/components/AcuLibrary.tsx` (manual mapping modal) | Medium |
| Subject organization & collapsible groups | `src/components/AcuLibrary.tsx` | Medium |
| Free tier upload limit enforcement | `src/components/AcuLibrary.tsx` | Low |
| Firestore + localStorage save/get/delete | `src/lib/db.ts` (document methods) | Medium |

---

## Phase 3: AI Content Generation (Completed)

| Task | Files | Complexity |
|---|---|---|
| Gemini SDK integration | `src/lib/gemini.ts` | Medium |
| Chapter taxonomy mapping (Table of Contents AI) | `src/lib/gemini.ts:generateChapterMap` | High |
| Chapter title extraction (AI + heuristic fallback) | `src/lib/gemini.ts:extractChapterTitle` | Medium |
| Presentation slide outline generation | `src/lib/gemini.ts:generateSlideOutline` | High |
| Briefing notes generation | `src/lib/gemini.ts:generateBriefingNotes` | Medium |
| FAQ sheet generation | `src/lib/gemini.ts:generateFAQSheet` | Medium |
| Timeline generation | `src/lib/gemini.ts:generateTimeline` | Medium |
| Podcast script generation | `src/lib/gemini.ts:generatePodcastScript` | Medium |
| MCQ generation | `src/lib/gemini.ts:generateMCQs` | Medium |
| Flashcard generation | `src/lib/gemini.ts:generateFlashcards` | Medium |
| Mock API key mode (for tutorials) | `src/lib/gemini.ts:safeGenerateContent` | Medium |
| Client-side rate limiting (configurable) | `src/lib/gemini.ts:checkAndRecordRateLimit` | Medium |

---

## Phase 4: Study Materials Workspace (Completed)

| Task | Files | Complexity |
|---|---|---|
| AcuSlide main workspace with tab navigation | `src/components/AcuSlide.tsx` | High |
| Slide viewer with 4 themes & 4 layouts | `src/components/AcuSlide.tsx` | High |
| Inline slide editor | `src/components/AcuSlide.tsx` | Medium |
| PDF export for slides | `src/components/AcuSlide.tsx` | Medium |
| PPTX export via pptxgenjs | `src/components/AcuSlide.tsx` | Medium |
| Study guide (briefing notes) viewer | `src/components/AcuSlide.tsx` | Medium |
| FAQ viewer with reveal | `src/components/AcuSlide.tsx` | Low |
| Timeline viewer | `src/components/AcuSlide.tsx` | Low |
| Podcast viewer with TTS playback | `src/components/AcuSlide.tsx` | Medium |
| MCQ viewer with reveal/explanations | `src/components/AcuSlide.tsx` | Medium |
| 3D flashcard viewer (AcuCard) | `src/components/AcuCard.tsx` | Medium |

---

## Phase 5: Exam System (Completed)

| Task | Files | Complexity |
|---|---|---|
| Board blueprint data (30 boards) | `src/lib/boardBlueprints.ts` | High |
| Blueprint selector UI (categorized) | `src/components/AcuExam.tsx` | Medium |
| AI exam paper generation (blueprint mode) | `src/lib/gemini.ts:generateExamPaper` | High |
| AI exam paper generation (legacy mode) | `src/lib/gemini.ts:generateExamPaper` | Medium |
| Timed exam taking UI | `src/components/AcuExam.tsx` | High |
| MCQ grading (deterministic) | `src/components/AcuExam.tsx` | Low |
| Written answer AI grading | `src/lib/gemini.ts:gradeWrittenAnswer` | High |
| Handwritten answer image grading | `src/lib/gemini.ts:gradeWrittenAnswer` | Medium |
| Pause/resume exam (localStorage) | `src/components/AcuExam.tsx` | Medium |
| Scorecard with Bloom's radar chart | `src/components/AcuExam.tsx` | Medium |
| Confetti on pass | `src/components/AcuExam.tsx` | Low |
| Exam PDF export | `src/components/AcuExam.tsx` | Medium |

---

## Phase 6: Google Drive Backup (Completed)

| Task | Files | Complexity |
|---|---|---|
| OAuth token management | `src/lib/googleDrive.ts` | Medium |
| Drive folder creation & file CRUD | `src/lib/googleDrive.ts` | High |
| Document backup/restore | `src/lib/googleDrive.ts:saveDocumentToDrive, loadDocumentsFromDrive` | Medium |
| Exam attempt backup/restore | `src/lib/googleDrive.ts:saveExamAttemptsToDrive, loadExamAttemptsFromDrive` | Medium |
| Notes backup/restore | `src/lib/googleDrive.ts:saveNotesToDrive, loadNotesFromDrive` | Medium |
| Sync status observable | `src/lib/googleDrive.ts:onDriveSyncStatusChange` | Low |

---

## Phase 7: Admin & Feedback (Completed)

| Task | Files | Complexity |
|---|---|---|
| Admin dashboard with KPIs | `src/components/AcuAdmin.tsx` | Low |
| User management table | `src/components/AcuAdmin.tsx` | Low |
| Review moderation | `src/components/AcuAdmin.tsx` | Low |
| Star rating + feedback form | `src/components/AcuFeedback.tsx` | Low |
| Landing page reviews display | `src/app/page.tsx` (reviews section) | Low |

---

## Phase 8: Polish & Security (Completed)

| Task | Files | Complexity |
|---|---|---|
| Safe error handling utility | `src/lib/errors.ts` | Low |
| Replace silent catch blocks with logging | Multiple files | Medium |
| Input validation on all forms | `src/lib/validation.ts` + all components | Medium |
| File MIME/size validation | `src/components/AcuLibrary.tsx` | Low |
| Mock API key centralized constant | `src/lib/gemini.ts` | Low |
| Configurable rate limiting via env | `src/lib/gemini.ts` | Low |
| postcss vulnerability fix (overrides) | `package.json` | Low |

---

## Phase 9: Future Work (Planned)

| Task | Priority | Effort | Dependencies |
|---|---|---|---|
| **Server-side API key proxy** | P1 | Medium | Backend setup (Vercel Edge or Cloud Function) |
| Hide Gemini API keys from client by proxying through a serverless function | | | |
| **Multi-language support** | P2 | High | i18n library (next-intl), translations for 8+ Indian languages |
| Hindi, Tamil, Telugu, Bengali, Marathi, Gujarati, Kannada, Malayalam | | | |
| **Spaced-repetition flashcards** | P2 | Medium | Local storage of review history, SM-2 algorithm |
| Schedule flashcard reviews with increasing intervals | | | |
| **Offline-first PWA** | P2 | Medium | Service worker, IndexedDB for full data, manifest |
| Full offline access to uploaded documents and generated materials | | | |
| **AI doubt-solving chat** | P1 | High | Chat UI, streaming Gemini response, context from current chapter |
| Conversational AI that answers questions based on uploaded textbook content | | | |
| **PDF chapter splitting** | P1 | Medium | Serverless function for PDF page extraction |
| Extract individual chapter PDFs from a full textbook upload | | | |
| **Pricing page + Early bird promotion** | P1 | Medium | Firestore schema update |
| 100 free users get 3 months premium, then subscription pricing kicks in | | | |
| **Subscription engine (UPI-only via Razorpay)** | P1 | Low | Razorpay account, serverless functions |
| ₹99/mo or ₹499/yr via UPI (0% fee). No cards, no netbanking. Settlements to personal bank account if sole proprietor, or current account if registered business. | | | |
| **Pricing page + Early bird promotion** (detail) | | | |
| --- | --- | --- | --- |
| - Add `premium_expires_at` field to UserProfile in Firestore | | | |
| - On signup: first 100 users get `is_premium: true` + `premium_expires_at: created_at + 3 months` | | | |
| - On app mount: check if `premium_expires_at` has passed; if yes, set `is_premium: false` | | | |
| - Update PricingPage.tsx: show "First 100 users — 3 months free" instead of "forever free" | | | |
| - After 3 months / 100 slots fill: show actual pricing cards (₹99/mo, ₹499/yr) | | | |
| - Remove coupon fallback (FREE/ACUBETA) after launch window | | | |
| **Razorpay UPI integration** (detail) | | | |
| --- | --- | --- | --- |
| - Create Razorpay account (PAN + bank account + address proof; test mode works immediately) | | | |
| - No current account needed for sole proprietors — personal bank account is sufficient. Registered businesses (PVT Ltd, LLP) need a current account. | | | |
| - Backend: `/api/payments/create-order` serverless function | | | |
| - Backend: `/api/payments/verify` serverless function (signature verification — critical) | | | |
| - Frontend: Razorpay Checkout.js modal, restricted to UPI only (`method: { upi: true }`) | | | |
| - Webhook: `payment.captured` → set `is_premium: true` + `premium_expires_at` in Firestore | | | |
| - Webhook: `payment.failed` → log + notify user | | | |
| - Razorpay Subscriptions API for recurring monthly/annual billing | | | |
| - No cards, no netbanking, no wallets — UPI only. Simpler integration, zero transaction fees. | | | |

| **Mobile app** | P3 | Very High | React Native or Flutter rewrite |
| Native mobile experience with offline support | | | |
| **Collaborative study groups** | P2 | High | Firestore real-time listeners, shared documents |
| Students can share notes and practice together | | | |
| **OCR for scanned PDFs** | P2 | Medium | Google Cloud Vision API or Tesseract |
| Extract text from image-only PDF documents | | | |

---

## Current Codebase Statistics

| Metric | Value |
|---|---|
| Total TypeScript/TSX files | 18 |
| Total lines of code | ~11,500 |
| Components | 10 |
| Library modules | 8 |
| Pages/Routes | 2 |
| Third-party dependencies | 16 |
| Board blueprints defined | 30 |
| localStorage keys used | 12 |
| Firestore collections | 5 |

---

## Development Workflow

```
1. npm run dev      → Local development with Turbopack on port 3000
2. npm run build    → TypeScript check + production build
3. npm run lint     → ESLint check
4. firebase deploy --only hosting → Deploy to acudex.web.app
```

**Environment:** Only `.env` file (no `.env.local`, `.env.production`). Firebase config + rate limit settings.
