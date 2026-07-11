# SmartGuide (Acu) — Session Log

**Date:** Sat Jul 11 2026
**Deployed:** https://acudex.web.app
**Repo:** https://github.com/thepolyformstudio/Acu

---

## Changes Made This Session

### 1. Google Drive Credentials Guide (Settings)
- Added 8-step guide to SettingsPanel.tsx under Google Drive Credentials
- Explains how to get OAuth Client ID and Developer Key from Google Cloud Console

### 2. Chapter-Level Indexed Library
- **AcuLibrary.tsx:** Flattened Subject > Documents > Chapters into Subject > Chapters view
- Chapter names now prominently visible with page ranges, summaries, source file metadata
- Compact file chips with delete controls replace nested document cards

### 3. Exam Generator: Subject → Chapter Selection
- **AcuExam.tsx:** Replaced Document → Chapter selection with Subject → Chapter
- Subject dropdown shows chapter counts per subject
- Chapter dropdown flattens all chapters across documents under selected subject
- `handleGenerateExam` internally resolves the correct document from composite chapter key

### 4. Landing Page Copy Rewrite
- Badge: "Trusted by 100+ students across India" (was "Privacy-First BYOK Model")
- Headline: "Study Smarter. Not Harder." (was "Your Books. Your Keys. Complete Mastery.")
- Subheadline: benefit-driven, mentions Google Drive backup
- Features: 4 benefit-focused items (Slide Generator, Board Exams, Phone Upload, Data Privacy)
- Footer: "Know Thyself." (was "Running serverless with local IndexedDB caches")
- Nav tagline: "AI Study Companion" (was "Privacy-First AI Study Companion")

### 5. Google Drive Backup Integration (NEW)
- **src/lib/googleDrive.ts:** Full OAuth + Drive API service
  - GIS (Google Identity Services) for OAuth consent
  - Drive API v3 for file CRUD via `fetch()` (no gapi dependency)
  - Folder structure: `SmartGuide/Documents/`, `SmartGuide/ExamAttempts/`, `SmartGuide/Notes/`
  - Dual storage: localStorage (fast, offline) + async Drive backup (non-blocking)
  - Session restore on app load
  - Sync status observable via listener pattern
- **SettingsPanel.tsx:** Connect/Disconnect button, sync status indicator, privacy notice
- **AcuLibrary.tsx:** Drive sync on document upload + delete
- **AcuExam.tsx:** Drive sync on exam attempt save
- **AcuSlide.tsx:** Drive sync for generated slides, notes, FAQ, timeline, podcast
- **page.tsx:** Drive init on app load (restore session if credentials exist)

### 6. Pricing Page (NEW)
- **src/components/PricingPage.tsx:** Free vs Premium comparison
  - Free tier: ₹0/forever, 2 docs, MCQ-only grading
  - Premium tier: ₹499 one-time, unlimited, full grading, Drive backup, PPTX, Bloom's analytics
  - 10-item feature comparison with checkmarks
  - Coupon redemption form (only for logged-in users)
  - Early bird badge showing remaining free spots
- **page.tsx:** "Pricing" link in landing page header + sidebar

### 7. Settings Privacy Notice
- Added "Your data stays yours" notice explaining:
  - No file content or generated notes stored on servers
  - All study materials stay in browser's local storage
  - Google Drive backup available for cross-device sync

---

## Files Modified (12)

| File | Session Changes |
|---|---|
| `src/lib/googleDrive.ts` | **NEW** — Drive OAuth + API service |
| `src/components/PricingPage.tsx` | **NEW** — Free vs Premium pricing |
| `src/app/page.tsx` | Landing page rewrite, Pricing link, Drive init |
| `src/components/AcuExam.tsx` | Subject→Chapter selection, Drive sync |
| `src/components/AcuLibrary.tsx` | Flattened chapter view, Drive sync |
| `src/components/AcuSlide.tsx` | Drive sync for generated content |
| `src/components/SettingsPanel.tsx` | Drive Connect button, sync status, privacy notice, credential guide |
| `src/app/globals.css` | Prior session |
| `src/app/layout.tsx` | Prior session |
| `package.json` | Prior session |
| `package-lock.json` | Prior session |
| `.gitignore` | Added `.firebase/` |

---

## Git History

```
b5d8ff9 feat: chapter-level indexing, Google Drive backup, pricing page, landing page rewrite
```

---

## Firebase

- **Project:** acu1-9f3e8
- **Hosting site:** acudex
- **Deploy URL:** https://acudex.web.app
- **Deploy command:** `firebase deploy --only hosting`
