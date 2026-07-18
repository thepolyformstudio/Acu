# Technical Requirements Document — Acu

## 1. Architecture Overview

**Pattern:** Single-Page Application (SPA) with client-side routing and tab-based navigation
**Rendering:** Static Site Generation (Next.js `output: export` ready)
**Deployment:** Firebase Hosting (site: `acudex`, project: `acu1-9f3e8`)
**Data Flow:** All data flows directly between the browser and external services (Firebase Auth, Firestore, Google Drive API, Google Gemini API). No application server.

```
┌─────────────────────────────────────────────────────┐
│                   Browser (Client)                   │
│                                                      │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────┐  │
│  │ Firebase     │  │ Google Drive │  │ Gemini AI   │  │
│  │ Auth SDK     │  │ API v3       │  │ SDK         │  │
│  │ (firebase)   │  │ (fetch)      │  │ (@google/   │  │
│  │              │  │              │  │ generative- │  │
│  │              │  │              │  │ ai)         │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬──────┘  │
│         │                 │                 │          │
│         ▼                 ▼                 ▼          │
│  ┌─────────────────────────────────────────────────┐  │
│  │              Next.js SPA (React 19)              │  │
│  │  ┌──────────┐ ┌────────┐ ┌────────┐ ┌────────┐  │  │
│  │  │ Auth/Onb │ │ Library│ │ Slides │ │ Exams   │  │  │
│  │  └──────────┘ └────────┘ └────────┘ └────────┘  │  │
│  │  ┌──────────┐ ┌────────┐ ┌────────┐ ┌────────┐  │  │
│  │  │ Dashboard│ │Flashcard│ │Feedback│ │ Admin   │  │  │
│  │  └──────────┘ └────────┘ └────────┘ └────────┘  │  │
│  └─────────────────────────────────────────────────┘  │
│                                                      │
│  ┌─────────────────────────────────────────────────┐  │
│  │           localStorage (Mock/Fallback)           │  │
│  │  profiles │ documents │ attempts │ reviews       │  │
│  │  gemini_key │ drive_token │ rate_limiting       │  │
│  └─────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

---

## 2. Technology Stack

| Layer | Technology | Version | Rationale |
|---|---|---|---|
| Framework | Next.js | 16.2.10 | Static export, file-based routing, React 19 support |
| UI Library | React | 19.2.4 | Latest stable |
| Language | TypeScript | ^5 | Type safety |
| Styling | Tailwind CSS v4 | ^4 | Utility-first, fast iteration |
| Icons | Lucide React | ^1.24 | Lightweight, tree-shakeable |
| Animation | Framer Motion | ^12.42 | Flashcard 3D flip, page transitions |
| Charts | Recharts | ^3.9 | Bloom's taxonomy radar chart |
| PDF Parsing | pdfjs-dist | (runtime) | Client-side PDF text extraction |
| DOCX Parsing | mammoth | ^1.12 | Client-side DOCX text extraction |
| PPTX Export | pptxgenjs | ^4.0 | Slide-to-PowerPoint export |
| Confetti | canvas-confetti | ^1.9 | Exam pass celebration |
| AI SDK | @google/generative-ai | ^0.24 | Gemini API access |
| Auth/DB | Firebase JS SDK | ^12.16 | Firebase Auth + Firestore |
| Linter | ESLint | ^9 | Code quality |

---

## 3. Key Technical Decisions

### 3.1 No Backend Server
All API keys (Gemini, Firebase) are used directly from the client. Gemini keys are user-provided (`NEXT_PUBLIC_` is only for Firebase config, which is public by design). This eliminates backend infrastructure costs and simplifies deployment to static hosting.

**Trade-off**: Gemini API keys are stored in browser localStorage (plaintext). Users are informed this is client-only storage.

### 3.2 Dual Storage Layer
| Storage | Use Case | Persistence |
|---|---|---|
| Firebase Firestore | Cross-device user profiles, document metadata, exam metadata | Cloud |
| localStorage | Full document text, full exam answers, rate limiting state, Gemini key, Drive token | Browser only |
| Google Drive | User-controlled backup of documents, exams, notes | User's Drive |

The architecture tries Firestore first, falls back to localStorage if Firebase is not configured.

### 3.3 Client-Side Rate Limiting
Since there's no backend, rate limiting is enforced in the browser via localStorage timestamps. Configurable via `NEXT_PUBLIC_GEMINI_RATE_PER_MINUTE` and `NEXT_PUBLIC_GEMINI_RATE_PER_DAY` env vars. This is trivially bypassable but sufficient for honest users.

### 3.4 Board Blueprint System
30 exam board blueprints are embedded as static TypeScript data (~2200 lines). Each blueprint defines exact section structure, question type distribution, marks, duration, and competency requirements. The AI uses these as structured prompts to generate syllabus-aligned question papers.

---

## 4. Data Flow Diagrams

### 4.1 Authentication Flow
```
User → AuthCard → validateInputs()
  → Firebase Auth SDK (signInWithEmailAndPassword / createUserWithEmailAndPassword / signInWithPopup)
  → Firestore: profiles/{uid} (read existing or create new)
  → Check localStorage for existing Gemini API key
    → [No key] Show API Key Onboarding
    → [No Drive] Show Drive Connection
  → onSuccess(profile) → App Shell
```

### 4.2 Document Upload & Chapter Mapping
```
User selects files
  → validateFile() (MIME, size, extension check)
  → Show staging modal (edit titles, choose mode)
  → For each file:
    → extract pages via pdfjs-dist / mammoth / file.text()
    → If full_textbook mode:
        → Show manual chapter mapping modal
        → User enters chapters + page ranges
    → If single_chapter mode:
        → AI extractChapterTitle() or user-entered title
    → saveDocumentSource() to Firestore + localStorage
    → Optionally backup to Google Drive
```

### 4.3 Study Material Generation
```
User selects subject + chapter
  → Choose artifact type (slides/notes/FAQ/timeline/podcast/MCQs/flashcards)
  → checkAndRecordRateLimit() (enforce per-minute & per-day limits)
  → If MOCK_API_KEY → return canned mock response
  → Else → call safeGenerateContent() via Gemini SDK
  → Parse JSON response → render UI
  → Cache to Google Drive Notes/
```

### 4.4 Exam Flow
```
User selects: subject, chapter, board blueprint, grade
  → Blueprint auto-fills config (marks, sections, duration)
  → AI generates question paper via generateExamPaper()
  
Exam in progress:
  → Countdown timer (duration from blueprint)
  → MCQ answers stored in component state
  → Written answers (text or image upload)
  → Pause/Resume via localStorage session

Grading:
  → MCQs: deterministic exact-match
  → Written: Gemini gradeWrittenAnswer() with text or image
  → Calculate Bloom's taxonomy percentages
  → Show scorecard with radar chart
  → Save to Firestore + localStorage + Drive
```

---

## 5. Performance Requirements

| Metric | Target |
|---|---|
| Initial load | < 3s (Firebase hosting CDN) |
| AI generation response | < 10s (Gemini API) |
| PDF extraction (100 pages) | < 5s (client-side) |
| Exam grading (written) | < 15s (Gemini API) |
| Bundle size (JS) | < 500KB gzipped |

---

## 6. Security Considerations

| Risk | Mitigation |
|---|---|
| Gemini API key in localStorage | User-provided & user-managed. UI warns it stays in their browser. |
| Firebase API key exposed | Firebase API keys are designed to be public (security enforced via Firestore rules, not key secrecy). |
| XSS via uploaded file content | PDF/DOCX text extracted client-side using sandboxed libraries (pdfjs-dist, mammoth). No HTML rendering of extracted text. |
| Drive token in localStorage | OAuth scope limited to `drive.file` (app-created files only). Token expires after 1 hour. |
| Rate limit bypass | Accepted limitation. Client-side enforcement is a UX guard, not a security measure. |

---

## 6. File Structure

```
src/
├── app/                          # Next.js App Router pages
│   ├── globals.css               # Tailwind + custom styles
│   ├── layout.tsx                # Root layout (fonts, metadata)
│   ├── page.tsx                  # Main SPA (landing + app shell)
│   └── tutorials/
│       └── page.tsx              # Tutorial video cards
├── components/
│   ├── AcuAdmin.tsx              # Admin dashboard
│   ├── AcuCard.tsx               # 3D flashcard viewer
│   ├── AcuDash.tsx               # Student dashboard
│   ├── AcuExam.tsx               # Exam generator + grader
│   ├── AcuFeedback.tsx           # Review submission
│   ├── AcuLibrary.tsx            # Document upload & library
│   ├── AcuSlide.tsx              # Study materials workspace
│   ├── AuthCard.tsx              # Auth + onboarding
│   ├── PricingPage.tsx           # Pricing & coupon redemption
│   └── SettingsPanel.tsx         # API key & Drive settings
└── lib/
    ├── boardBlueprints.ts        # 30 exam board definitions
    ├── db.ts                     # Firebase + mock database service
    ├── docxParser.ts             # DOCX text extraction
    ├── errors.ts                 # Safe error handling utilities
    ├── gemini.ts                 # Gemini AI integration
    ├── googleDrive.ts            # Google Drive backup
    ├── pdfParser.ts              # PDF text extraction
    └── validation.ts             # Input validation utilities
```
