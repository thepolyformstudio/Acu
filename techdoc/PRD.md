# Product Requirements Document — Acu

## 1. Product Overview

**Product Name:** Acu (Acu Study Companion)
**Tagline:** Your Privacy-First Study Companion
**One-liner:** A client-side AI-powered study platform that helps students upload textbooks, generate structured study materials, practice with board-aligned exams, and track cognitive progress — all without a backend server.

---

## 2. Vision & Goals

### Vision
Empower every student with a personal AI tutor that works entirely in their own browser, respecting privacy while delivering board-specific, syllabus-aligned study materials.

### Goals
- **Privacy-first**: All AI calls go directly from the user's browser to Google Gemini. No intermediary server ever sees the student's data.
- **Curriculum-aligned**: Support Indian education boards (CBSE, ICSE, 20 state boards) and entrance exams (JEE, NEET, CAT, CLAT, UPSC).
- **Zero infrastructure**: The entire app runs as a static Next.js SPA on Firebase Hosting. No backend to maintain.
- **Offline-resilient**: Mock localStorage mode works without Firebase config for development and offline testing.
- **Premium sustainability**: Freemium model (free tier with 2 documents, ₹499 one-time for unlimited).

---

## 3. Target Users

| Persona | Description | Key Needs |
|---|---|---|
| **Student** (class 6-12) | Preparing for school exams and board exams | Upload textbooks, generate notes/slides/flashcards, practice with past-paper-style exams |
| **Parent** | Monitoring multiple children's progress | Create child profiles, view analytics, track exam performance |
| **Competitive Exam Aspirant** | JEE/NEET/CAT/UPSC prep | Board-specific blueprints, timed mock tests, Bloom's taxonomy analytics |
| **Teacher/Admin** | Managing class content | Admin dashboard with user management, review moderation |

---

## 4. User Stories

### Authentication & Onboarding
- As a new user, I want to sign up with email/password or Google so I can access the platform.
- As a new user, I want to configure my free Gemini API key so AI features work.
- As a user, I want to optionally connect Google Drive so my data persists across devices.

### Document Management
- As a student, I want to upload PDF/DOCX/TXT textbooks so I can work with my syllabus content.
- As a student, I want to map chapters to page ranges so I can navigate my materials.
- As a student, I want to assign subjects to my uploads so materials stay organized.

### Study Materials
- As a student, I want to generate presentation slides from a chapter so I can revise visually.
- As a student, I want to create briefing notes, FAQs, timelines, and podcast scripts from textbook content.
- As a student, I want to generate active-recall flashcards from chapters.
- As a student, I want to export slides as PPTX or PDF.

### Exam Practice
- As a student, I want to generate board-aligned exam papers from my syllabus content.
- As a student, I want to take timed mock exams with MCQ and written answers.
- As a student, I want handwritten answer sheets graded by AI.
- As a student, I want to see Bloom's taxonomy analytics after grading.
- As a student, I want to pause and resume exams.

### Data Persistence
- As a user, I want my data backed up to Google Drive so I don't lose it if I clear browser storage.
- As a user, I want the app to work offline in development mode with mock localStorage.

### Admin
- As an admin, I want to view platform analytics (user count, documents, attempts).
- As an admin, I want to manage user accounts and moderate reviews.

---

## 5. Feature List

### MVP (Current)
| Feature | Priority | Complexity | Status |
|---|---|---|---|
| Email/Password + Google Authentication | P0 | Medium | Done |
| Gemini API Key onboarding & management | P0 | Low | Done |
| PDF/DOCX/TXT upload & text extraction | P0 | Medium | Done |
| Chapter mapping (AI + manual) | P0 | High | Done |
| Subject organization | P1 | Low | Done |
| Presentation slide generation & export | P0 | High | Done |
| Board-aligned exam generation | P0 | High | Done |
| MCQ + Written answer grading | P0 | High | Done |
| Bloom's taxonomy analytics chart | P1 | Medium | Done |
| Flashcards with 3D flip | P1 | Medium | Done |
| Briefing notes, FAQ, timeline, podcast scripts | P1 | Medium | Done |
| 30 exam board blueprints | P0 | High | Done |
| Google Drive backup | P1 | Medium | Done |
| Client-side rate limiting | P2 | Low | Done |
| Admin panel | P1 | Low | Done |
| Tutorial videos page | P2 | Low | Done |
| Coupon-based premium activation | P1 | Low | Done |

### Post-MVP (Planned)
| Feature | Priority |
|---|---|
| Server-side API key proxy (to hide keys from client) | P1 |
| Multi-language support (Hindi, regional languages) | P2 |
| Collaborative study groups | P2 |
| Spaced-repetition flashcard scheduling | P2 |
| Mobile app (React Native) | P3 |
| Offline-first PWA | P2 |
| AI-powered doubt-solving chat | P1 |
| PDF-splitting & chapter-level extraction | P1 |

---

## 6. Success Metrics

| Metric | Target |
|---|---|
| Daily active users | Track via Firebase Analytics |
| Documents uploaded per user | Avg ≥ 3 |
| Exams attempted per week | Avg ≥ 2 |
| Google Drive connection rate | ≥ 40% of users |
| Premium conversion rate | ≥ 5% of free users |
| Gemini API success rate | ≥ 95% |

---

## 7. Constraints & Assumptions

- **Client-side only**: All AI calls go directly to Google Gemini API. The user must provide their own API key.
- **Firebase required for cross-device sync**: Without Firebase config, data is limited to a single browser via localStorage.
- **PDF text extraction**: Scanned/image-only PDFs cannot be parsed (no OCR). User must provide selectable-text PDFs.
- **Board blueprints**: Based on publicly available exam patterns; accuracy depends on periodic verification.
- **No real payments**: Premium is coupon-activated only (₹499 one-time). No payment gateway integration yet.
