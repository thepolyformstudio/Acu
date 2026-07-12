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
