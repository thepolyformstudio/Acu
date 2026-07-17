# Session Log — 2026-07-12

## Issue: Chapter Title shows filename instead of actual title in Single Chapter mode

### Problem
When uploading files in "Single Chapter" mode (e.g., `Science Chapter 2.pdf`), the chapter index showed `"Science Chapter 2"` instead of the actual chapter title like `"Cell: The Building Block of Life"`.

### Root Cause
The `single_chapter` code path in `AcuLibrary.tsx` was using `file.name.replace(/\.[^/.]+$/, "")` — just stripping the file extension — as the chapter name, instead of extracting the title from the PDF content.

### Attempted Fixes

#### Fix 1: Gemini JSON extraction (line 87, original)
- Added `extractChapterTitle()` function in `src/lib/gemini.ts`
- Called Gemini with `responseMimeType: "application/json"` to extract chapter title
- Only scanned `pages[0]` (first page)
- **Result**: Failed — chapter title often appears on page 2, not page 1

#### Fix 2: Scan first 3 pages + plain text (line 87, revised)
- Changed to `pages.slice(0, 3)` to scan first 3 pages
- Changed prompt to plain text output (removed JSON mode)
- **Result**: Still failed — user reported "No change"

#### Fix 3: Added heuristic fallback (line 73, current)
- `extractChapterTitle()` now tries Gemini first, falls back to regex heuristic
- Heuristic scans page starts for patterns like `"9 Cell The Building Block of Life"`
- Verified locally: heuristic correctly extracts "Cell The Building Block of Life"
- **Result**: Still failed — unknown reason

### Current State
- Last deployed commit: `79d27fd`
- Production URL: https://acudex.web.app
- Dev server: http://localhost:3000

### Files Changed
- `src/lib/gemini.ts` — `extractChapterTitle()` with Gemini + heuristic fallback
- `src/components/AcuLibrary.tsx` — calls `extractChapterTitle()`, detailed status messages

### Hypothesis for Remaining Failure
- Gemini API key may not be set or may be invalid for the user's account (`ejmultiverse@gmail.com`)
- Browser cache may be serving old JS bundle
- Silent catch block falls back to filename on any error

### Next Steps
- Debug whether `getGeminiApiKey()` returns a valid key for the user
- Check browser console for errors during upload
- Verify catch block fires vs. title extraction returning empty

---

## Session 2 — 2026-07-12 (Evening, 9:48 PM – 11:30 PM IST)

### Trigger
User `ejmultiverse@gmail.com` reported a `429 Quota Exceeded` error while generating MCQs on the production app (`acudex.web.app`). Screenshot provided: `ErrorScreenShot ej.jpg`.

### Root Cause
The user's Gemini API key is on the **Free Tier** which has strict limits:
- **RPM (Requests Per Minute):** 5 requests/min
- **RPD (Requests Per Day):** 20 requests/day
- **TPM (Tokens Per Minute):** 250K tokens/min

The user had exceeded both RPM (6/5) and RPD (23/20). The raw Google API error was being shown directly in an `alert()` popup, which was confusing and unhelpful.

### Changes Made

#### 1. Friendly 429 Error Messages (`src/lib/gemini.ts`)
- Added `safeGenerateContent()` wrapper around all `model.generateContent()` calls
- Catches 429/quota/rate-limit errors and throws a clean user-friendly message
- Applied to all 10 generative functions (slides, exams, MCQs, notes, FAQ, timeline, podcast, grader, chapter map, chapter title extraction)
- **Deployed:** Commit `c076d57`

#### 2. Client-Side Rate Limiting (`src/lib/gemini.ts`)
- Added `checkAndRecordRateLimit()` function that enforces:
  - **RPM limit:** Max 5 requests in any rolling 60-second window
  - **RPD limit:** Max 20 requests per day
- Timestamps stored in `localStorage` key `acu_gemini_timestamps`
- Daily counter stored in `localStorage` key `acu_gemini_daily_usage`
- RPM error: *"You are generating too fast! Please wait a minute before trying again."*
- RPD error: *"You have reached your daily limit of 20 requests. The quota will reset at [LOCAL TIME]. Come back then or upgrade your API tier!"*

#### 3. Dynamic Local Reset Time (`src/lib/gemini.ts`)
- Added `getLocalResetTime()` helper that calculates when Midnight Pacific Time occurs in the user's local timezone
- Uses `Intl` timezone conversion (`America/Los_Angeles`) to compute exact local reset time
- Displays like: *"at 01:30 PM (your local time)"*
- Falls back to *"tomorrow"* if timezone conversion fails

#### 4. Free Tier Toggle in Settings (`src/components/SettingsPanel.tsx`)
- Added `isFreeTier` state and `dailyUsageCount` state
- Persisted in `localStorage` as `acu_gemini_free_tier`
- Rate limiting is bypassed when `isFreeTier` is `false` (for paid API keys)
- Cleaned up on key deletion

#### 5. Mock API Key for Tutorial Recording (`src/lib/gemini.ts`)
- Special key `AIzaSyMockKeyForTutorial` triggers instant mock responses
- Returns canned JSON data for all features: chapter maps, slides, exams, MCQs, briefing notes, FAQ, timeline, podcast, grading
- Bypasses rate limiting and real API calls entirely
- Purpose: Record tutorial videos without consuming quota

### Deployments
| Commit | Description |
|--------|-------------|
| `c076d57` | Rate limiting + friendly error messages |
| `882aabb` | Mock API key for tutorial recording |

Both deployed to Firebase Hosting: https://acudex.web.app

### Tutorial Video Preparation
- Storyboard script exists at `video-specs/registration-tutorial.md`
- Detailed JSON scene spec at `video-specs/registration-tutorial.json`
- Automated browser recording attempted but failed due to browser agent rate limits (unrelated to app)
- Manual recording steps documented for 4 tutorial sections:
  1. Registration + API key setup
  2. File upload to Library
  3. Study material generation (Slides, Notes, MCQs)
  4. Exam generation, attempt, and grading

### Files Changed
- `src/lib/gemini.ts` — safeGenerateContent, rate limiting, mock key, local reset time
- `src/components/SettingsPanel.tsx` — Free tier toggle, daily usage tracking

### Git Status
- All changes committed and pushed to `master` on `github.com/thepolyformstudio/Acu`
- Latest commit: `882aabb`

---

## Session 3 — 2026-07-17 (Evening)

### Changes Made

#### 1. Board Blueprint Database & Custom Exam Generation (AcuExam)
- Created a structured blueprint registry ([`boardBlueprints.ts`](file:///e:/Antigravity/SmartGuide/src/lib/boardBlueprints.ts)) with pattern data for 31 boards.
- Expanded the dropdown to group national/state/entrance/government boards in `<optgroup>`.
- Added auto-population of defaults (marks, questions, duration) on board change, a warning badge for deviations from the official blueprint, and a dynamic board-specific grading standard.
- Preserved legacy mode as the "Custom / Legacy" selection.

#### 2. Subject-Aware Study Material Generation (AcuSlide)
- Passed the document's subject through to all study guide generators.
- Injected subject rules into all prompts (e.g. Mathematics forces sums/derivations, Languages focus on grammar/literature, Geography maps timeline, etc.).

#### 3. AI Flashcard Deck Generator & 3D Flip Fixes (AcuCard)
- Decoupled flashcard practice from slides so cards can be generated whenever a chapter is selected.
- Enabled custom deck sizes (10, 15, 25, 40 Cards) with an AI generator that backs up to/loads from Google Drive (type `"flashcards"`).
- Resolved flip transition issues by creating 3D helper classes in [`globals.css`](file:///e:/Antigravity/SmartGuide/src/app/globals.css) and removing conflicting CSS transition styles from the Framer Motion elements.
- Integrated a loading spinner overlay for active generations.

### Git & Deploy
- Committed and pushed to `master` ([8e68586](https://github.com/thepolyformstudio/Acu/commit/8e68586)).
- Deployed successfully to Firebase Hosting URL: https://acudex.web.app.

---

## Things to Do Later (Roadmap)

1. **Regeneration Option**: Add an option in AcuSlide to regenerate briefing notes, slides, FAQs, timelines, and MCQs once they are generated.
2. **Export Study Materials**: Add a feature to export slides, briefing notes, FAQs, and MCQs (with answers) into a PDF file and save it to the local device.
3. **Export Question Paper**: Add a feature to export the generated question paper (and its model answers/grading rubrics) into a local PDF.
4. **Pause & Resume Exams**: 
   - Add an option to pause the exam timer and save the current questions and student responses.
   - Allow resuming the exam later.
   - Add a "Quit Exam" button that prompts the user to save or discard the attempt.
5. **Handwritten Upload Grading**: Provide an option to upload an image of handwritten answer sheets inside AcuExam. The app will extract the handwritten text and grade it against model answers/rubrics using Gemini's multimodal capabilities.
6. **Mobile Applications**: Port the application into a full-fledged Android and iOS app (e.g., using React Native or Capacitor).

