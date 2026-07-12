// Google Drive Integration Service
// Uses Firebase Auth (Google provider) to obtain an OAuth access token,
// then calls Drive API v3 directly via fetch().
// All user data (documents, exam attempts, notes) is saved to the user's own Google Drive.

import { getAuth, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { getApps, initializeApp } from "firebase/app";

const SCOPES = ["https://www.googleapis.com/auth/drive.file"];

const APP_FOLDER_NAME = "Acudex";

// Singleton state
let accessToken: string | null = null;
const folderIdCache: { [name: string]: string } = {};

// ---------------------------------------------------------------------------
// Firebase Auth helper
// ---------------------------------------------------------------------------

function getFirebaseAuth() {
  const apps = getApps();
  const app = apps.length > 0 ? apps[0] : initializeApp({});
  return getAuth(app);
}

// ---------------------------------------------------------------------------
// Public: check if signed in
// ---------------------------------------------------------------------------

export function isDriveSignedIn(): boolean {
  if (typeof window === "undefined") return false;
  return !!accessToken || !!localStorage.getItem("acu_drive_access_token");
}

// ---------------------------------------------------------------------------
// Public: sign in / sign out
// ---------------------------------------------------------------------------

export async function signInToDrive(): Promise<boolean> {
  try {
    const auth = getFirebaseAuth();
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'consent' }); // Force consent screen to guarantee Drive scopes
    SCOPES.forEach((s) => provider.addScope(s));

    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);

    if (!credential?.accessToken) {
      console.error("Drive sign-in: no access token returned");
      return false;
    }

    accessToken = credential.accessToken;
    localStorage.setItem("acu_drive_access_token", accessToken);
    return true;
  } catch (err: any) {
    console.error("Drive sign-in failed:", err);
    return false;
  }
}

export function signOutFromDrive(): void {
  accessToken = null;
  if (typeof window !== "undefined") {
    localStorage.removeItem("acu_drive_access_token");
  }
}

/** Try to restore a previous session silently (no popup). */
export async function tryRestoreDriveSession(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  const saved = localStorage.getItem("acu_drive_access_token");
  if (!saved) return false;

  accessToken = saved;
  try {
    const resp = await fetch("https://www.googleapis.com/drive/v3/about?fields=user", {
      headers: { Authorization: `Bearer ${saved}` },
    });
    if (resp.ok) return true;
    // Token expired
    signOutFromDrive();
    return false;
  } catch {
    signOutFromDrive();
    return false;
  }
}

// ---------------------------------------------------------------------------
// Internal: folder helpers
// ---------------------------------------------------------------------------

async function findOrCreateFolder(name: string, parent_id?: string): Promise<string> {
  if (folderIdCache[name]) return folderIdCache[name];

  const q = parent_id
    ? `name='${name}' and mimeType='application/vnd.google-apps.folder' and '${parent_id}' in parents and trashed=false`
    : `name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;

  const resp = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id)`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!resp.ok) {
    const errText = await resp.text();
    console.error("findOrCreateFolder failed during search:", errText);
    throw new Error("Drive search failed: " + errText);
  }
  const data = await resp.json();

  if (data.files && data.files.length > 0) {
    folderIdCache[name] = data.files[0].id;
    return data.files[0].id;
  }

  // Create the folder
  const body: any = {
    name,
    mimeType: "application/vnd.google-apps.folder",
  };
  if (parent_id) body.parents = [parent_id];

  const createResp = await fetch("https://www.googleapis.com/drive/v3/files", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!createResp.ok) {
    const errText = await createResp.text();
    console.error("findOrCreateFolder failed during creation:", errText);
    throw new Error("Drive creation failed: " + errText);
  }
  const created = await createResp.json();
  folderIdCache[name] = created.id;
  return created.id;
}

async function getAppRootFolderId(): Promise<string> {
  return findOrCreateFolder(APP_FOLDER_NAME);
}

// ---------------------------------------------------------------------------
// Internal: file CRUD
// ---------------------------------------------------------------------------

async function findFileByName(name: string, parent_id: string): Promise<string | null> {
  const q = `name='${name}' and '${parent_id}' in parents and trashed=false`;
  const resp = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id)`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const data = await resp.json();
  return data.files && data.files.length > 0 ? data.files[0].id : null;
}

async function uploadOrUpdateFile(
  name: string,
  content: string,
  parent_id: string,
  mimeType = "application/json"
): Promise<void> {
  let fileId = await findFileByName(name, parent_id);

  if (!fileId) {
    // 1. Create the empty file with metadata
    const metadata = { name, parents: [parent_id] };
    const createResp = await fetch("https://www.googleapis.com/drive/v3/files", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(metadata),
    });
    
    if (!createResp.ok) {
      throw new Error("Failed to create file metadata: " + await createResp.text());
    }
    const created = await createResp.json();
    fileId = created.id;
  }

  // 2. Upload the actual content to the file
  const patchResp = await fetch(
    `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": mimeType,
      },
      body: content,
    }
  );
  
  if (!patchResp.ok) {
    throw new Error("Failed to upload file content: " + await patchResp.text());
  }
}

async function readFileByName(name: string, parent_id: string): Promise<string | null> {
  const fileId = await findFileByName(name, parent_id);
  if (!fileId) return null;

  const resp = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  return resp.ok ? resp.text() : null;
}

async function deleteFileByName(name: string, parent_id: string): Promise<void> {
  const fileId = await findFileByName(name, parent_id);
  if (fileId) {
    await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  }
}

// ---------------------------------------------------------------------------
// Public: High-level sync operations
// ---------------------------------------------------------------------------

export interface DriveSyncStatus {
  lastSync: string | null;
  error: string | null;
  syncing: boolean;
}

let _syncStatus: DriveSyncStatus = { lastSync: null, error: null, syncing: false };
let _statusListeners: ((s: DriveSyncStatus) => void)[] = [];

export function getDriveSyncStatus(): DriveSyncStatus {
  return _syncStatus;
}

export function onDriveSyncStatusChange(cb: (s: DriveSyncStatus) => void): () => void {
  _statusListeners.push(cb);
  return () => {
    _statusListeners = _statusListeners.filter((l) => l !== cb);
  };
}

function updateStatus(patch: Partial<DriveSyncStatus>) {
  _syncStatus = { ..._syncStatus, ...patch };
  _statusListeners.forEach((l) => l(_syncStatus));
}

// -- Documents ---------------------------------------------------------------

export async function saveDocumentToDrive(doc: any): Promise<void> {
  if (!isDriveSignedIn()) return;
  try {
    updateStatus({ syncing: true, error: null });
    const root = await getAppRootFolderId();
    const docsFolder = await findOrCreateFolder("Documents", root);
    const fileName = `${doc.id}.json`;
    await uploadOrUpdateFile(fileName, JSON.stringify(doc), docsFolder);
    updateStatus({ syncing: false, lastSync: new Date().toISOString() });
  } catch (err: any) {
    console.error("Drive sync (document) failed:", err);
    updateStatus({ syncing: false, error: err.message || "Drive sync failed" });
  }
}

export async function deleteDocumentFromDrive(docId: string): Promise<void> {
  if (!isDriveSignedIn()) return;
  try {
    const root = await getAppRootFolderId();
    const docsFolder = await findOrCreateFolder("Documents", root);
    await deleteFileByName(`${docId}.json`, docsFolder);
  } catch (err) {
    console.error("Drive delete (document) failed:", err);
  }
}

export async function loadDocumentsFromDrive(): Promise<any[]> {
  if (!isDriveSignedIn()) return [];
  try {
    const root = await getAppRootFolderId();
    const docsFolder = await findOrCreateFolder("Documents", root);
    const q = `'-${docsFolder}' in parents and trashed=false and mimeType='application/json'`;
    const resp = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)&pageSize=1000`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const data = await resp.json();
    if (!data.files || data.files.length === 0) return [];

    const docs: any[] = [];
    for (const f of data.files) {
      try {
        const content = await fetch(
          `https://www.googleapis.com/drive/v3/files/${f.id}?alt=media`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        if (content.ok) {
          docs.push(await content.json());
        }
      } catch {
        // skip corrupt files
      }
    }
    return docs;
  } catch (err) {
    console.error("Drive load (documents) failed:", err);
    return [];
  }
}

// -- Exam Attempts -----------------------------------------------------------

export async function saveExamAttemptsToDrive(profileId: string, attempts: any[]): Promise<void> {
  if (!isDriveSignedIn()) return;
  try {
    updateStatus({ syncing: true, error: null });
    const root = await getAppRootFolderId();
    const folder = await findOrCreateFolder("ExamAttempts", root);
    const fileName = `${profileId}.json`;
    await uploadOrUpdateFile(fileName, JSON.stringify(attempts, null, 2), folder);
    updateStatus({ syncing: false, lastSync: new Date().toISOString() });
  } catch (err: any) {
    console.error("Drive sync (attempts) failed:", err);
    updateStatus({ syncing: false, error: err.message || "Drive sync failed" });
  }
}

export async function loadExamAttemptsFromDrive(profileId: string): Promise<any[]> {
  if (!isDriveSignedIn()) return [];
  try {
    const root = await getAppRootFolderId();
    const folder = await findOrCreateFolder("ExamAttempts", root);
    const content = await readFileByName(`${profileId}.json`, folder);
    return content ? JSON.parse(content) : [];
  } catch (err) {
    console.error("Drive load (attempts) failed:", err);
    return [];
  }
}

// -- Notes / Generated Content -----------------------------------------------

export async function saveNotesToDrive(subject: string, chapterName: string, type: string, content: any): Promise<void> {
  if (!isDriveSignedIn()) return;
  try {
    updateStatus({ syncing: true, error: null });
    const root = await getAppRootFolderId();
    const folder = await findOrCreateFolder("Notes", root);
    const safeSubject = (subject || "General").replace(/[^a-zA-Z0-9]/g, "_").substring(0, 30);
    const safeChapter = chapterName.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 60);
    const fileName = `${safeSubject}_${safeChapter}_${type}.json`;
    await uploadOrUpdateFile(fileName, JSON.stringify(content, null, 2), folder);
    updateStatus({ syncing: false, lastSync: new Date().toISOString() });
  } catch (err: any) {
    console.error("Drive sync (notes) failed:", err);
    updateStatus({ syncing: false, error: err.message || "Drive sync failed" });
  }
}

export async function loadNotesFromDrive(subject: string, chapterName: string, type: string): Promise<any | null> {
  if (!isDriveSignedIn()) return null;
  try {
    const root = await getAppRootFolderId();
    const folder = await findOrCreateFolder("Notes", root);
    const safeSubject = (subject || "General").replace(/[^a-zA-Z0-9]/g, "_").substring(0, 30);
    const safeChapter = chapterName.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 60);
    const fileName = `${safeSubject}_${safeChapter}_${type}.json`;
    const content = await readFileByName(fileName, folder);
    return content ? JSON.parse(content) : null;
  } catch (err) {
    console.error("Drive load (notes) failed:", err);
    return null;
  }
}
