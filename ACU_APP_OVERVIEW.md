# Acu - AI Study Companion
## Core Objective & Key Features

---

## Core Objective

**Transform traditional textbooks into AI-powered, interactive study materials that help students study smarter, not harder.**

Acu is an AI-powered educational platform that converts student textbooks (PDFs, photos) into:
- Visual presentations (slides)
- Interactive flashcards  
- Practice exams with auto-grading
- Graded mock tests with Bloom's taxonomy analytics

The platform aims to eliminate the manual effort of creating study materials while providing personalized, board-aligned practice tools that improve learning outcomes.

---

## Key Features

### 1. Content Conversion Engine
- **Input**: Textbook PDFs, photos, scanned pages
- **Output**: 
  - AcuSlide: Visual presentations with key concepts
  - AcuLibrary: Organized flashcard system
  - AcuExam: Practice papers with auto-grading

### 2. Board-Aligned Exam Generation
- **Supported Boards**: CBSE, ICSE, JEE, NEET
- **Features**:
  - Timed exam papers
  - Auto-grading with detailed feedback
  - Bloom's Taxonomy analytics
  - Subject and chapter-specific questions

### 3. Mobile-First Experience
- Upload directly from smartphone cameras
- No desktop required
- Responsive design for all devices
- Progress syncs across devices

### 4. Privacy-First Architecture
- **Data Ownership**: Student materials remain in Google Drive or browser storage
- **No Server Storage**: AI processing happens client-side when possible
- **Google Drive Integration**: Secure backup and sync option
- **Transparent Data Policy**: Clear user control over all content

### 5. AI-Powered Analytics
- **Bloom's Taxonomy Breakdown**: Categorizes questions by cognitive level (Remember, Understand, Apply, Analyze, Evaluate, Create)
- **Performance Tracking**: Track improvement across chapters and subjects
- **Feedback System**: Detailed justification for each answer

### 6. Multi-User Roles
- **Student**: Primary users creating and studying with materials
- **Parent**: Secondary role for managing child's study progress
- **Admin**: Platform administrators for monitoring and support

### 7. Premium Features
- Extended document processing
- Advanced analytics dashboards
- Priority AI processing
- Early access to new features

---

## Target Audience

1. **Primary**: Students (Grades 6-12, Competitive Exam Aspirants)
2. **Secondary**: Parents managing children's education
3. **Tertiary**: Educators seeking supplementary materials

---

## Value Proposition

> "Upload your textbooks once, get unlimited AI-generated study materials that actually help you learn—and keep your work private in Google Drive."

---

## Technical Architecture

- **Frontend**: Next.js 15 with React Server Components
- **AI Processing**: Google Gemini API integration
- **Storage**: IndexedDB (local) + Google Drive (backup)
- **Auth**: Firebase Authentication with Google/Email support
- **Database**: Firestore (metadata only, no content storage)

---

## Competitive Advantages

1. **Privacy-First**: Unlike most AI education tools, data stays with the student
2. **Board-Specific**: Direct alignment with Indian curriculum boards
3. **Multi-Modal Output**: Generates slides, cards, and exams from single input
4. **Mobile-Native**: Designed for phone-based textbook uploads
5. **Bloom's Analytics**: Advanced cognitive level tracking not found in competitors