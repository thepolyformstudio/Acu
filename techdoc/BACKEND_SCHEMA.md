# Backend Schema — Acu

## 1. Architecture Overview

Acu has **no application server**. The "backend" consists of:

1. **Firebase Firestore** — structured data storage (profiles, document metadata, exam metadata, reviews, coupons)
2. **Firebase Auth** — authentication (email/password, Google OAuth)
3. **Google Drive API v3** — user-controlled backup (documents, exams, notes)
4. **Google Gemini API** — AI content generation (no data stored)
5. **Browser localStorage** — fallback storage + ephemeral state

---

## 2. Firestore Schema

### Collection: `profiles`
**Document ID:** Firebase Auth UID
**Purpose:** User profile and account data

```typescript
interface ProfileDocument {
  id: string;             // Firebase Auth UID
  email: string;          // User's email address
  role: 'student' | 'parent' | 'admin';
  is_premium: boolean;    // Premium tier status
  coupon_applied: string | null;  // Coupon code used, e.g. "BETA_EARLY_BIRD"
  created_at: string;     // ISO 8601 timestamp
}
```

**Security Rules (recommended):**
```
match /profiles/{userId} {
  allow read: if request.auth.uid == userId || request.auth.token.email == 'admin@acu.com';
  allow write: if request.auth.uid == userId;
  allow delete: if request.auth.token.email == 'admin@acu.com';
}
```

---

### Subcollection: `profiles/{uid}/documents`
**Document ID:** `doc_` + random 7-char alphanumeric
**Purpose:** Uploaded textbook/document metadata

```typescript
interface DocumentDocument {
  id: string;             // e.g. "doc_a1b2c3d"
  name: string;           // Document title
  subject: string;        // Subject name (Science, Math, etc.)
  chapterMap: {           // AI-detected or manually mapped chapters
    name: string;         // Chapter title
    summary: string;      // Brief description
    startPage: number;    // 1-indexed start page
    endPage: number;      // 1-indexed end page
  }[] | null;
  created_at: string;     // ISO 8601 timestamp
}
```

**Note:** Full `pages[]` content is NOT stored in Firestore (too large). Stored in localStorage mock mode only.

---

### Subcollection: `profiles/{uid}/attempts`
**Document ID:** `attempt_` + random 7-char alphanumeric
**Purpose:** Exam attempt metadata (answers stored in localStorage only)

```typescript
interface AttemptDocument {
  id: string;
  examTitle: string;
  subject?: string;
  documentId?: string;
  chapterName?: string;
  maxMarks: number;
  marksObtained: number;
  durationMinutes: number;
  date: string;            // Locale date string
  bloomsAnalytics: {       // Category → percentage
    Remembering: number;
    Understanding: number;
    Applying: number;
    Analyzing: number;
    Evaluating: number;
    Creating: number;
  };
}
```

**Note:** Full `answers[]` array is NOT stored in Firestore (too large). Only metadata is persisted in Firestore.

---

### Collection: `children`
**Document ID:** `child_` + random 7-char alphanumeric
**Purpose:** Parent-managed child profiles

```typescript
interface ChildDocument {
  id: string;
  parentId: string;       // References profiles/{parentId}
  name: string;           // Child's name
  grade: string;          // Grade/class level
  created_at: string;     // ISO 8601 timestamp
}
```

---

### Collection: `coupons`
**Document ID:** Coupon code string (uppercase, e.g. `ACUBETA`)
**Purpose:** Premium coupon codes

```typescript
interface CouponDocument {
  is_used: boolean;
  used_by: string | null;  // Profiles/{uid} of user who redeemed
}
```

**Mock mode**: Any code containing "FREE" or "ACUBETA" is accepted.

---

### Collection: `reviews`
**Document ID:** `rev_` + random 7-char alphanumeric
**Purpose:** User-submitted app reviews (displayed on landing page)

```typescript
interface ReviewDocument {
  id: string;
  profileId: string;      // References profiles/{uid}
  authorEmail: string;
  rating: number;         // 1-5
  feedbackText: string;
  createdAt: string;      // Locale date string
}
```

---

## 3. localStorage Schema

| Key | Type | Format | Purpose |
|---|---|---|---|
| `acu_gemini_api_key` | string | Raw API key | Google Gemini key (user-provided) |
| `acu_gemini_free_tier` | string | `"true"` \| `"false"` | Whether rate limiting is active |
| `acu_gemini_daily_usage` | JSON | `{date: "YYYY-MM-DD", count: number}` | Daily request counter |
| `acu_gemini_timestamps` | JSON | `number[]` (epoch ms) | Per-minute request timestamps |
| `acu_drive_access_token` | string | OAuth access token | Google Drive API auth |
| `acu_mock_profiles` | JSON | `{[uid]: UserProfile}` | Mock user database |
| `acu_mock_children` | JSON | `{[childId]: ChildProfile}` | Mock children database |
| `acu_mock_active_user` | JSON | `UserProfile` | Currently logged-in user |
| `acu_mock_documents` | JSON | `{[uid]: DocumentSource[]}` | Mock document storage |
| `acu_mock_attempts` | JSON | `{[uid]: ExamAttempt[]}` | Mock exam attempts |
| `acu_mock_reviews` | JSON | `AppReview[]` | Mock reviews |
| `acu_paused_exam_session` | JSON | Full exam state | In-progress exam persistence |

---

## 4. Google Drive Schema

**Root Folder:** `Acudex/` (auto-created in user's Drive)

```
Acudex/
├── Documents/
│   ├── {docId}.json          → DocumentSource (with full pages + chapterMap)
│   └── ...
├── ExamAttempts/
│   ├── {profileId}.json      → ExamAttempt[] (full array with answers)
│   └── ...
└── Notes/
    ├── {subject}_{chapter}_slides.json
    ├── {subject}_{chapter}_notes.json
    ├── {subject}_{chapter}_faq.json
    ├── {subject}_{chapter}_timeline.json
    ├── {subject}_{chapter}_podcast.json
    ├── {subject}_{chapter}_mcq.json
    ├── {subject}_{chapter}_flashcards.json
    └── ...
```

**Permissions:** OAuth scope `https://www.googleapis.com/auth/drive.file` — app can only read/write files it creates.

---

## 5. External API Contracts

### 5.1 Firebase Auth (Client SDK)
```
signInWithEmailAndPassword(auth, email, password) → UserCredential
createUserWithEmailAndPassword(auth, email, password) → UserCredential
signInWithPopup(auth, provider) → UserCredential
onAuthStateChanged(auth, callback) → unsubscribe
signOut(auth) → void
```

### 5.2 Google Gemini API (`@google/generative-ai`)
```
GenerativeModel.generateContent(request) → GenerateContentResponse
// request: string | (string | {inlineData: {data, mimeType}})[]
// response: {response: {text(): string}}
```

### 5.3 Google Drive API v3

| Operation | Method | Endpoint |
|---|---|---|
| Find/create folder | GET/POST | `https://www.googleapis.com/drive/v3/files` |
| Upload file (metadata + content) | POST (multipart) | `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart` |
| Update file content | PATCH (multipart) | `https://www.googleapis.com/upload/drive/v3/files/{fileId}?uploadType=multipart` |
| Read file content | GET | `https://www.googleapis.com/drive/v3/files/{fileId}?alt=media` |
| List files in folder | GET | `https://www.googleapis.com/drive/v3/files?q=...` |
| Delete file | DELETE | `https://www.googleapis.com/drive/v3/files/{fileId}` |
| Validate token | GET | `https://www.googleapis.com/drive/v3/files?pageSize=1` |

All requests include header: `Authorization: Bearer {accessToken}`

---

## 6. Data Relationship Diagram

```
Firebase Auth
    │
    ▼
profiles/{uid} ────── has many ──── profiles/{uid}/documents/{docId}
    │                                profiles/{uid}/attempts/{attemptId}
    │
    ├── role = 'parent'
    │       └── children/{childId} (linked by parentId field)
    │
    ├── is_premium
    │       └── coupons/{code} (linked by coupon_applied field)
    │
    └── email (for reviews)
            └── reviews/{reviewId} (linked by profileId + authorEmail)

localStorage (mirror)
    ├── acu_mock_profiles       ↔  Firestore: profiles
    ├── acu_mock_documents      ↔  Firestore: profiles/{uid}/documents
    ├── acu_mock_attempts       ↔  Firestore: profiles/{uid}/attempts
    ├── acu_mock_reviews        ↔  Firestore: reviews
    └── acu_mock_children       ↔  Firestore: children

Google Drive (backup)
    ├── Acudex/Documents/       ↔  localStorage mock documents
    ├── Acudex/ExamAttempts/    ↔  localStorage mock attempts
    └── Acudex/Notes/           ↔  Generated study artifacts
```

---

## 7. Data Classification

| Data Type | Sensitivity | Storage | Encryption |
|---|---|---|---|
| User email | PII | Firestore + localStorage | TLS in transit |
| Auth credentials | Sensitive | Firebase Auth only | Firebase handles |
| Gemini API key | Secret | localStorage | Plaintext (user-managed) |
| Drive OAuth token | Secret | localStorage (memory) | 1-hour expiry |
| Textbook content | User content | localStorage + Drive backup | User's Drive |
| Exam answers | User content | localStorage + Drive backup | User's Drive |
| App reviews | Public | Firestore | TLS in transit |
| Rate limit data | Non-sensitive | localStorage | None needed |
