# App Flow — Acu Study Companion

## 1. Entry Points

```
┌──────────────────────────────────────────────────────────────────┐
│                     https://acudex.web.app                        │
│                        / (Single Page)                            │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  [Loading State] ←──────────────────── Firebase Auth              │
│       │                                    init                   │
│       ▼                                                           │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                    App Shell (page.tsx)                      │ │
│  │                                                             │ │
│  │  ┌───────────────┐  ┌───────────────┐  ┌────────────────┐  │ │
│  │  │ Unauthenticated│─▶│ API Key       │─▶│ Drive          │  │ │
│  │  │ Landing Page   │  │ Onboarding    │  │ Connection     │  │ │
│  │  │ + AuthCard     │  │ (if no key)   │  │ (optional)     │  │ │
│  │  └───────┬───────┘  └───────┬───────┘  └───────┬────────┘  │ │
│  │          │                  │                  │            │ │
│  │          └──────────────────┴──────────────────┘            │ │
│  │                             │                               │ │
│  │                             ▼                               │ │
│  │  ┌────────────────────────────────────────────────────────┐ │ │
│  │  │              Authenticated App Shell                    │ │ │
│  │  │  ┌──────┐ ┌───────┐ ┌───────┐ ┌──────┐ ┌────────┐    │ │ │
│  │  │  │Home  │ │Library│ │Slides │ │Exams │ │Settings│ ... │ │ │
│  │  │  └──────┘ └───────┘ └───────┘ └──────┘ └────────┘    │ │ │
│  │  └────────────────────────────────────────────────────────┘ │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  https://acudex.web.app/tutorials (Standalone page)          │ │
│  │  Tutorial cards → Click play → Full-screen video modal      │ │
│  └─────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

---

## 2. Unauthenticated Flow

```
Landing Page
│
├── Top Bar
│   ├── Logo "Acu" → scrolls to top
│   ├── "Tutorials" → navigates to /tutorials
│   └── "Pricing" → switches to PricingPage view
│
├── Hero Section
│   ├── Headline + description
│   └── CTA → scrolls to AuthCard
│
├── Feature Highlights
│   └── 4 feature cards (privacy, AI, boards, export)
│
├── AuthCard (core auth widget)
│   ├── Sign In mode
│   │   ├── Email input
│   │   ├── Password input
│   │   ├── "Sign In" button
│   │   ├── "Sign In with Google" button
│   │   └── "Register Free" toggle link
│   │
│   └── Sign Up mode
│       ├── Email input
│       ├── Password input
│       ├── Role toggle (Student / Parent)
│       ├── Early bird premium banner (slots remaining)
│       ├── "Create Account" button
│       ├── "Continue with Google" button
│       └── "Sign In Here" toggle link
│
└── Reviews Section
    └── Star ratings + feedback cards from AppReview data
```

---

## 3. Post-Authentication Onboarding

```
Sign Up / Sign In Success
│
├── [First Login] Workflow Onboarding Modal (OnboardingModal.tsx)
│   ├── Triggered once per user (localStorage key: acu_onboarding_seen_{userId})
│   ├── Not shown to admin accounts
│   ├── 4-step workflow guide cards (Library → Slides → Exam → Dash)
│   │   └── Each card is clickable with colour-coded glow on active
│   ├── Mobile: dot-based step indicator
│   ├── "Don't show again" → sets localStorage flag + closes
│   ├── "Got it, let's start →" → closes modal (shows again next session)
│   └── ✕ button → closes modal (shows again next session)
│
├── Step 1: API Key Onboarding
│   ├── Explanation: "One last step to enable AI"
│   ├── 3-step guide with numbered circles
│   ├── "Get your free API key" → aistudio.google.com (external)
│   ├── Password input for API key
│   │   └── validateApiKey() → must start with "AIzaSy"
│   ├── "Save & Continue" button
│   └── "Skip for now" button
│
└── Step 2: Google Drive Connection (optional)
    ├── Explanation: "Back up your data"
    ├── Drive connection card with icon
    ├── "Connect Google Drive" button
    │   └── Firebase OAuth popup with drive.file scope
    └── "Skip for now" button
```

---

## 4. Authenticated App Shell

```
┌─────────────────────────────────────────────────────────────┐
│  [Sticky Header]                                             │
│  Logo "Acu" | "Acu Tutorials" link | Premium badge | User   │
│  email | Sign Out button                                     │
├──────────────────────┬──────────────────────────────────────┤
│  [Sidebar (desktop)] │  [Main Stage]                        │
│  / [Bottom Nav (mob)]│                                       │
│                      │                                       │
│  📊 Dashboard  ◄─────│─── Active Tab renders here            │
│  📚 Library          │                                       │
│  📖 Slides           │                                       │
│  📝 Exams            │                                       │
│  💬 Feedback         │                                       │
│  ⚙️ Settings         │                                       │
│  🛡️ Admin (if admin) │                                       │
│                      │                                       │
└──────────────────────┴──────────────────────────────────────┘
```

---

## 5. Tab Flows

### 5.1 Dashboard (AcuDash)
```
Dashboard
│
├── [Parent Role]
│   ├── Child Profile Management
│   │   ├── View children list
│   │   ├── Add child (name + grade)
│   │   └── Select active child → filter data
│   └── Per-child subject overview
│
├── [Student Role]
│   └── Subject-Level Overview Cards
│       ├── Subject name
│       ├── Chapters mapped count
│       ├── Tests attempted count
│       └── Average score %
│
├── Subject Drill-Down (click subject card)
│   ├── Chapter status grid
│   │   ├── ✅ Completed (attempted test)
│   │   ├── 🔄 Practice needed (uploaded but no test)
│   │   └── ⬜ Not started
│   └── Exam attempt logs (per chapter)
│       ├── Date, score, duration
│       └── Click → full scorecard
│
└── Drive Backup Warning Banner
    └── If not signed in to Drive → "Back up your data" CTA
```

### 5.2 Library (AcuLibrary)
```
Library
│
├── Configuration Panel
│   ├── Subject Selector dropdown (Science, Math, ... Custom)
│   │   └── If Custom → text input for subject name
│   ├── Upload Mode Toggle (Full Textbook / Single Chapter)
│   └── Upload Button
│       ├── [Free tier > 2 docs] → disabled with upgrade CTA
│       ├── [No Drive] → warning tooltip
│       └── [Ready] → file picker (.pdf/.docx/.txt/.png/.jpg/.jpeg/.webp)
│           ├── Documents: max 50 MB each
│           └── Images: max 10 MB each (OCR'd by Gemini Vision)
│
├── [Files Selected] Staging Modal
│   ├── File list with editable titles
│   ├── [Single Chapter, non-image] → saves directly (no mapping modal)
│   ├── [Full Textbook] → "Manual mapping required" notice
│   ├── [Any Image] → always goes through manual chapter mapping
│   ├── Cancel button
│   └── "Process & Extract" button
│       └── Images: shows status "Reading image with Gemini Vision OCR..."
│
├── [Full Textbook / Image] Manual Mapping Modal
│   ├── Chapter rows (name, start page, end page inputs)
│   ├── "Add Another Chapter" button
│   ├── Cancel button
│   └── "Save Document" button
│
├── Upload Progress
│   ├── Spinner + status message ("Extracting text...", "Indexing...",
│   │                             "Reading image with Gemini Vision OCR...")
│   └── Success message → auto-refresh
│
└── Indexed Syllabus Library
    ├── Free tier warning (X of 2 slots used)
    └── Collapsible Subject Groups
        ├── Subject header (file count, chapter count)
        ├── 🗑️ Delete Subject button → cascade-deletes all docs in group
        │   └── Confirmation dialog shows file + chapter count
        ├── File list with per-file delete button
        └── Chapter list (name, page range, source document)
```

### 5.3 Slides / Study Materials (AcuSlide)
```
Slides Workspace
│
├── Selection Bar
│   ├── Subject dropdown → populated from uploaded docs
│   └── Chapter dropdown → populated from selected doc's chapterMap
│
├── Artifact Tab Bar
│   ├── 📖 Study Guide (Briefing Notes)
│   ├── ❓ FAQ Sheet
│   ├── 📊 Presentation Slides
│   ├── ⏳ Timeline
│   ├── 🎙️ Podcast Overview
│   └── 📝 Practice MCQs
│
├── [Study Guide]
│   ├── Title + chapters with content + takeaways
│   ├── Glossary sidebar
│   └── Export PDF button
│
├── [FAQ]
│   ├── Q&A list
│   └── Export PDF button
│
├── [Presentation Slides]
│   ├── Slide list sidebar (thumbnails)
│   ├── Main slide viewer (16:9 aspect ratio)
│   ├── Inline editor (click to edit title/text)
│   ├── Theme selector (4 themes)
│   ├── Navigation arrows
│   ├── Export PDF → print-friendly layout
│   └── Export PPTX → pptxgenjs generation
│
├── [Timeline]
│   ├── Chronological timeline with step dots
│   └── Export PDF button
│
├── [Podcast]
│   ├── Script with speaker labels (Host A / Host B)
│   ├── Text-to-speech playback
│   │   ├── Play/Pause control
│   │   └── Speaker alternation (male/female voices)
│   └── Export PDF button
│
├── [MCQs]
│   ├── Collapsible question cards
│   │   ├── Question text
│   │   ├── Options (A/B/C/D)
│   │   ├── Click to reveal answer
│   │   └── Explanation
│   ├── Deck size selector (25-50 questions)
│   └── Export PDF (questions + answer key)
│
└── [Flashcards] (opened from MCQs tab or regenerate button)
    └── AcuCard Overlay Modal
        ├── 3D flip animation (front/back)
        ├── Prev / Next navigation
        ├── Card counter (X of Y)
        ├── Deck size selector (10/15/25/40)
        ├── Close button
        └── Regenerate button
```

### 5.4 Exams (AcuExam)
```
Exams Workspace
│
├── Exam Configuration Panel
│   ├── Board Blueprint Selector
│   │   ├── National → CBSE, ICSE
│   │   ├── State → 20 state boards
│   │   ├── Entrance → JEE, NEET, CAT, CLAT
│   │   └── Government → UPSC, SSC, Bank PO, NDA
│   │
│   ├── Grade Level dropdown (auto-filtered by blueprint)
│   ├── Subject dropdown
│   ├── Chapter Selection (checkbox list)
│   │   ├── "Select Entire Subject" checkbox → selects all chapters
│   │   ├── Individual chapter checkboxes
│   │   └── [Custom Chapter Override] text field (clears checkbox selection)
│   ├── Total Marks / Duration (auto-filled from blueprint)
│   ├── Blueprint Preview Card
│   │   ├── Section structure (A/B/C/D)
│   │   ├── Question types per section
│   │   ├── Competency-based % (if applicable)
│   │   └── Negative marking indicator
│   └── "Generate Exam" button
│       └── Aggregates text from all selected chapters/documents
│
├── [Paused Session Detected]
│   ├── Resume exam (load from localStorage)
│   ├── Discard saved session
│   └── Start fresh
│
├── Exam Taking View
│   ├── Sticky header: timer, question counter, progress bar
│   ├── MCQ Section
│   │   └── Styled radio buttons for each MCQ
│   ├── Written Section
│   │   ├── Textarea for typing answers
│   │   └── "Upload handwritten answer" → image input (optional)
│   ├── Navigation: Save & Next / Previous
│   ├── Bottom action bar
│   │   ├── "Submit & Grade"
│   │   ├── "Pause & Save" → saves to localStorage
│   │   └── "Quit Exam" → confirm modal (discard/submit/pause)
│   └── Auto-submit on timer expiry
│
├── Grading In Progress
│   ├── MCQ grading (instant)
│   ├── Written grading (spinner + Gemini API call)
│   └── [Handwriting] image sent as inlineData to Gemini
│
└── Scorecard View
    ├── Overall score (X / Y marks, percentage)
    ├── Pass/Fail badge (≥40% pass)
    ├── Confetti animation on pass
    ├── Bloom's Taxonomy Radar Chart
    │   └── 6 axes: Remembering → Creating
    ├── Per-Question Breakdown
    │   ├── Question text + type
    │   ├── Student answer vs Model answer
    │   ├── Marks awarded + justification
    │   └── Feedback: correct points, incorrect points, suggestions
    ├── [Written] Handwriting OCR transcription
    └── Export PDF (question paper + answer key)
```

### 5.5 Settings (SettingsPanel)
```
Settings
│
├── API Key Management
│   ├── Current key display (masked password field)
│   ├── "Get API key" link → aistudio.google.com
│   ├── "Save Key" button
│   │   └── validateApiKey() before saving to localStorage
│   └── "Delete Key" button → confirm → removes from localStorage
│
└── Premium Activation
    ├── [Active] → premium status badge + coupon code info
    └── [Free] → coupon input + "Redeem" button
```

### 5.6 Feedback (AcuFeedback)
```
Feedback
│
├── Star Rating (1-5 clickable stars with labels)
│   ├── 1 = Poor, 2 = Fair, 3 = Good, 4 = Very Good, 5 = Excellent
│   └── Disabled textarea until a rating is selected
│
├── Feedback Textarea
│   └── validates with regex (alphanumeric + basic punctuation)
│
├── Error display
├── "Submit Review" button
└── Success confirmation screen
```

### 5.7 Admin (AcuAdmin)
```
Admin Dashboard
│
├── [Access Denied] if role !== 'admin'
│
├── KPI Cards Row
│   ├── Total Users
│   ├── Documents Generated
│   └── Exams Taken
│
├── User Management Table
│   ├── Email, Role, Premium/Free status
│   └── Delete button (self excluded)
│
└── Review Moderation
    ├── Review cards with star rating, email, text
    └── Delete button per review
```

---

## 6. Navigation Map

```
Landing Page
  │
  ├── Sign In / Sign Up → Onboarding → App Shell
  │
  ├── Pricing → View Plans → [Sign In]
  │
  └── /tutorials → Tutorial Cards → Video Modals
         │
         └── "Back to Desk" → Landing Page

App Shell
  ├── Dashboard
  │     └── Subject Drill-Down → Scorecard
  ├── Library
  │     ├── Upload → Staging Modal → [Manual Mapping Modal]
  │     └── Subject Groups → Chapter List
  ├── Slides/Study Materials
  │     ├── Study Guide
  │     ├── FAQ
  │     ├── Slides → PDF / PPTX Export
  │     ├── Timeline
  │     ├── Podcast → TTS Playback
  │     ├── MCQs → PDF Export
  │     └── Flashcards → AcuCard Modal
  ├── Exams
  │     ├── Config → Blueprint Selector
  │     ├── Exam Taking View → Grade → Scorecard
  │     │     └── PDF Export
  │     └── Paused Session → Resume / Discard
  ├── Settings
  │     └── API Key / Premium / Drive
  ├── Feedback
  │     └── Star Rating + Text → Submit
  └── Admin (if admin)
        ├── KPI Cards
        ├── User Management
        └── Review Moderation
```
