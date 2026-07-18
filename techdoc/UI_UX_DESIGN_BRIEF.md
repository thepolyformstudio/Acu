# UI/UX Design Brief — Acu

## 1. Design Philosophy

**"Dark, Immersive, Study-Focused"**

Acu uses a dark-theme glassmorphism aesthetic designed to minimize eye strain during long study sessions while creating a premium, futuristic feel. The design emphasizes content readability with high contrast text, spacious layouts, and subtle glow effects that direct attention without distraction.

---

## 2. Visual Identity

### Color Palette

```
Background:         #0b0c10 (near-black with subtle warmth)
Panel/Surface:      slate-900/30 with glass blur
Border:             slate-800 (subtle)
Text Primary:       white (#ffffff)
Text Secondary:     slate-400 (#94a3b8)
Text Muted:         slate-600 (#475569)

Primary Accent:     violet-600 (#7c3aed)
  → Glows:          violet-600/20 blur-3xl
  → Hover:          violet-500
  → Text on accent: white

Success Accent:     emerald-400 (#34d399)
  → Background:     emerald-500/10
  → Border:         emerald-500/20

Warning/Alert:      amber-500
Error/Danger:       rose-500 / red-400

Chart Colors:
  - Radar fill:     violet-600/30
  - Radar stroke:   violet-400
```

### Typography

| Usage | Font | Weight | Size |
|---|---|---|---|
| Display/Headings | Outfit (sans-serif) | 700-800 | 24px-48px |
| Body text | Inter (sans-serif) | 400-500 | 12px-14px |
| Labels/Badges | Inter | 600-700 | 10px-11px |
| Code/monospace | font-mono (system) | 400 | 10px |

### Glassmorphism Panels

```css
.glass-panel {
  background: rgba(15, 23, 42, 0.3);  /* slate-900/30 */
  backdrop-filter: blur(12px);
  border: 1px solid rgba(51, 65, 85, 0.5);  /* slate-800 */
  border-radius: 16px;
}
```

---

## 3. Layout Structure

### Desktop (>1024px)
```
┌──────────────────────────────────────────────────────────┐
│  Header: logo | tutorials | premium badge | user | signout│  h-16
├──────────┬───────────────────────────────────────────────┤
│ Sidebar  │                                               │
│ w-56     │           Main Content Area                   │
│          │     (max-w-6xl, centered, scrollable)          │
│ 📊 Dash  │                                               │
│ 📚 Lib   │                                               │
│ 📖 Slides│                                               │
│ 📝 Exams │                                               │
│ 💬 Feed  │                                               │
│ ⚙️ Setngs│                                               │
│ 🛡️ Admin │                                               │
├──────────┴───────────────────────────────────────────────┤
│  Footer (minimal, copyright)                              │
└──────────────────────────────────────────────────────────┘
```

### Mobile (<768px)
```
┌──────────────────────┐
│  Header (compact)    │
├──────────────────────┤
│                      │
│   Main Content       │
│   (full width)       │
│                      │
│                      │
├──────────────────────┤
│  Bottom Tab Bar      │
│ 📊📚📖📝⚙️          │
└──────────────────────┘
```

---

## 4. Component Design Patterns

### Cards
- Rounded-2xl (16px)
- Dark glass background with 1px subtle border
- Consistent inner padding (p-6 / 24px)
- Hover: border brightens (slate-800 → slate-700)
- Optional: top accent border in accent color (violet/emerald/amber)

### Buttons
| Variant | Style |
|---|---|
| Primary | `bg-violet-600 hover:bg-violet-500 text-white rounded-xl px-5 py-2.5` |
| Secondary | `bg-slate-950 hover:bg-slate-900 border border-slate-800 text-slate-300` |
| Ghost | `bg-transparent hover:bg-slate-900 text-slate-400` |
| Success | `bg-emerald-600 hover:bg-emerald-500 text-white` |
| Danger | `text-red-500 border border-red-500/20 hover:bg-red-950/20` |
| Disabled | `opacity-60 cursor-not-allowed` |

### Inputs
- Dark background: `bg-slate-950/50`
- Border: `border-slate-800`, focus: `border-violet-500`
- Rounded-xl (12px)
- Placeholder: `text-slate-600`
- Left icon padding: `pl-10` (for icon inputs)

### Badges / Tags
- `rounded-full` pill shape
- `text-[10px] uppercase tracking-wider font-bold`
- Colored borders and backgrounds matching semantic intent

### Modals
- Fixed overlay with `bg-black/60 backdrop-blur-sm`
- Centered panel: `max-w-2xl bg-slate-900 border border-slate-700 rounded-2xl`
- Close button: top-right, `text-slate-400 hover:text-white`

---

## 5. Key Screen Designs

### 5.1 Landing Page
- Centered hero with gradient text (violet-400 to indigo-300)
- Feature cards in 2x2 grid showing privacy, AI capabilities, board support, export options
- AuthCard as the primary conversion element
- Reviews section at bottom for social proof

### 5.2 Auth Card
- Compact card (max-w-md), centered on page
- Role toggle as tab-style pill buttons
- Early bird premium banner with slot counter
- Google sign-in button with icon

### 5.3 Dashboard
- Subject overview as horizontal cards with icons
- Chapter status grid with emoji indicators (✅/🔄/⬜)
- Exam attempt log as compact list with date, score, duration
- Parent mode adds child management section

### 5.4 Library
- Split into config panel (top) and syllabus library (bottom)
- Collapsible subject groups with chevron indicators
- File/chapter rows with delete and expand controls
- Staging and mapping modals for upload flow

### 5.5 Slides Viewer
- 16:9 slide preview (dominant visual element)
- Slide list sidebar (vertical thumbnails on left)
- Theme selector as color swatch pills
- Inline editing — click text to edit directly on slide
- Export buttons as icon+text in toolbar

### 5.6 Exam Workspace
- Config view: blueprint selector as categorized dropdown groups
- Exam view: clean, minimal, timer always visible
- MCQ radio buttons styled as selectable cards
- Scorecard: KPI cards row (score, time, rank), radar chart, per-question accordion

---

## 6. Micro-interactions & Animations

| Element | Animation | Implementation |
|---|---|---|
| Page transitions | Fade in (`animate-fade-in`) | CSS animation |
| Button hover | Background color + scale | Tailwind `transition-all duration-300` / `hover:scale-110` |
| Card hover | Border brightens | Tailwind `hover:border-slate-700` |
| Flashcard flip | 3D rotation Y-axis | Framer Motion `rotateY` |
| Loading state | Spinning border | CSS `animate-spin` |
| Exam pass | Confetti burst | `canvas-confetti` library |
| Dashboard stats | Pulse glow | CSS `pulseGlow` keyframes |
| Modal open | Backdrop blur + fade | Tailwind `backdrop-blur-sm` |
| Upload progress | Spinning icon + status text | Tailwind `animate-spin` on RefreshCw icon |

---

## 7. Responsive Breakpoints

| Breakpoint | Width | Layout Changes |
|---|---|---|
| Mobile | <640px | Single column, bottom tab nav, compact header |
| Tablet | 640-1024px | 2-column grids, sidebar hidden behind hamburger |
| Desktop | >1024px | Sidebar visible, 3+ column grids, max-w-6xl constraint |

---

## 8. Accessibility Considerations

- All interactive elements use `cursor-pointer`
- Form inputs have visible `focus:border-violet-500` states
- Buttons have disabled states with `opacity-60 cursor-not-allowed`
- Color is never the sole indicator (icons + text accompany color changes)
- High contrast ratio (white on `#0b0c10` = ~17.5:1)
- `sr-only` labels used where appropriate

---

## 9. Empty States

| Feature | Empty State Message | Action |
|---|---|---|
| Library | "Your study library is empty" with folder icon + description | "Upload Textbook" button |
| Dashboard (no data) | Shows zero states for each KPI | Upload documents CTA |
| Reviews (landing) | "No reviews yet. Be the first!" | AuthCard sign-up CTA |
| Admin (no data) | "No users found." / "No reviews submitted yet." | — |
| Exam attempts | Empty attempt log per subject | "Generate Exam" button |
