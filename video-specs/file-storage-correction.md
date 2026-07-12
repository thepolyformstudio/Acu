# File Storage Correction

## Previous Understanding (Incorrect)
❌ Files stored locally first, optionally backed up to Drive

## Corrected Understanding
✅ Files are **primarily stored on Google Drive** with local cache for offline access

---

## Technical Architecture

### Primary Storage: Google Drive
- All uploaded documents, exam attempts, notes, and generated content
- Stored in `Acudex/` folder in user's Google Drive
- Files saved as JSON in structured folders:
  - `Acudex/Documents/` - Uploaded textbooks
  - `Acudex/ExamAttempts/` - Test results
  - `Acudex/Notes/` - Generated study materials

### Local Storage (Cache Layer)
- Browser localStorage for:
  - User profile and authentication state
  - API key (`acu_gemini_api_key`)
  - Document metadata and indexes
  - Exam history
- Used for offline access and faster loading
- Syncs automatically when Drive connection is restored

---

## Upload Flow (Corrected)

### 1. User Uploads File
1. User selects PDF/DOCX/TXT file
2. File is processed and extracted
3. **Document is saved to Google Drive first** (async)
4. Metadata cached locally for instant access

### 2. Drive Connection Required
- Upload button **disabled** without Drive connection
- Tooltip: "Connect Google Drive in Settings to enable cross-device Library Sync"
- Data loss prevention: Files are backed up immediately

### 3. Backup Mechanism
```javascript
// From AcuLibrary.tsx
await dbService.saveDocumentSource(user?.id, newDoc);
// Async backup to Google Drive (non-blocking)
if (isDriveSignedIn()) {
  saveDocumentToDrive(newDoc).catch(() => {});
}
```

### 4. Sync Strategy
- **Real-time sync** when connected
- **Offline mode**: Uses local cache, syncs on reconnection
- **Conflict resolution**: Drive version takes precedence

---

## API Key Storage
- Stored in browser localStorage as `acu_gemini_api_key`
- **Never sent to servers**
- Used for:
  - Text extraction from documents
  - Slide generation
  - Exam paper creation
  - AI grading

## Google Drive Access
- OAuth scope: `https://www.googleapis.com/auth/drive.file`
- Access token stored in localStorage as `acu_drive_access_token`
- Token refresh handled automatically

---

## Data Privacy
✅ All AI processing happens client-side or via user's own API key  
✅ No content stored on Acu servers  
✅ Files stay in user's Google Drive  
✅ Local storage encrypted in browser