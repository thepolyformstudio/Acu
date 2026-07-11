// Google Drive Integration Service
// Uses Google Identity Services (GIS) for OAuth and gapi for Drive API operations.
// All user data (documents, exam attempts, notes) is saved to the user's own Google Drive.

const GAPI_URL = "https://apis.google.com/js/api.js";
const GIS_URL = "https://accounts.google.com/gsi/client";
const DISCOVERY_DOCS = ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"];
const SCOPES = "https://www.googleapis.com/auth/drive.file";

const APP_FOLDER_NAME = "SmartGuide";

// Singleton state
let gapiLoaded = false;
let gisLoaded = false;
let accessToken: string | null = null;
let folderIdCache: { [name: string]: string } = {};

// ---------------------------------------------------------------------------
// Script loaders
// ---------------------------------------------------------------------------

function loadScript(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${url}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = url;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${url}`));
    document.head.appendChild(script);
  });
}

// ---------------------------------------------------------------------------
// Public: check credentials
// ---------------------------------------------------------------------------

export function getGoogleClientId(): string {
  if (typeof window !== "undefined") {
    return localStorage.getItem("acu_google_client_id") || "";
  }
  return "";
}

export function isDriveConfigured(): boolean {
  return !!getGoogleClientId();
}

// ---------------------------------------------------------------------------
// Public: initialization
// ---------------------------------------------------------------------------

let initPromise: Promise<void> | null = null;

export function initGoogleDrive(): Promise<void> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    const clientId = getGoogleClientId();
    if (!clientId) return;

    await Promise.all([loadScript(GAPI_URL), loadScript(GIS_URL)]);
    gapiLoaded = true;
    gisLoaded = true;

    await new Promise<void>((resolve) => (window as any).gapi.load("client", () => resolve()));
    await (window as any).gapi.client.init({
      discoveryDocs: DISCOVERY_DOCS,
    });
  })();
  return initPromise;
}

// ---------------------------------------------------------------------------
// Public: sign in / sign out
// ---------------------------------------------------------------------------

export async function signInToDrive(): Promise<boolean> {
  const clientId = getGoogleClientId();
  if (!clientId || !gisLoaded) return false;

  return new Promise<boolean>((resolve) => {
    const tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPES,
      callback: (response: any) => {
        if (response.error) {
          console.error("Drive OAuth error:", response);
          resolve(false);
          return;
        }
        accessToken = response.access_token as string;
        localStorage.setItem("acu_drive_access_token", accessToken);
        (window as any).gapi.client.setToken({ access_token: accessToken });
        resolve(true);
      },
    });
    tokenClient.requestAccessToken();
  });
}

export function signOutFromDrive(): void {
  const token = localStorage.getItem("acu_drive_access_token");
  if (token && (window as any).google?.accounts?.oauth2) {
    (window as any).google.accounts.oauth2.revoke(token, () => {});
  }
  accessToken = null;
  localStorage.removeItem("acu_drive_access_token");
  if ((window as any).gapi?.client) {
    (window as any).gapi.client.setToken(null);
  }
}

export function isDriveSignedIn(): boolean {
  return !!accessToken || !!localStorage.getItem("acu_drive_access_token");
}

/** Try to restore a previous session silently (no popup). */
export async function tryRestoreDriveSession(): Promise<boolean> {
  const saved = localStorage.getItem("acu_drive_access_token");
  if (!saved) return false;

  accessToken = saved;
  if ((window as any).gapi?.client) {
    (window as any).gapi.client.setToken({ access_token: saved });
  }
  // Verify token is still valid by making a lightweight request
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
  const existingId = await findFileByName(name, parent_id);

  if (existingId) {
    // Update existing file
    await fetch(
      `https://www.googleapis.com/upload/drive/v3/files/${existingId}?uploadType=media`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": mimeType,
        },
        body: content,
      }
    );
  } else {
    // Create new file with metadata
    const metadata = { name, parents: [parent_id] };
    const form = new FormData();
    form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
    form.append("file", new Blob([content], { type: mimeType }));

    await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: form,
    });
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
    // Strip full page text to reduce size — store only metadata + chapter maps
    const lightweight = {
      id: doc.id,
      name: doc.name,
      subject: doc.subject,
      chapterMap: doc.chapterMap,
      created_at: doc.created_at,
      pageCount: doc.pages?.length || 0,
    };
    await uploadOrUpdateFile(fileName, JSON.stringify(lightweight, null, 2), docsFolder);
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
    // List all JSON files in the Documents folder
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

export async function saveNotesToDrive(docId: string, chapterName: string, type: string, content: any): Promise<void> {
  if (!isDriveSignedIn()) return;
  try {
    updateStatus({ syncing: true, error: null });
    const root = await getAppRootFolderId();
    const folder = await findOrCreateFolder("Notes", root);
    const safeChapter = chapterName.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 60);
    const fileName = `${docId}_${safeChapter}_${type}.json`;
    await uploadOrUpdateFile(fileName, JSON.stringify(content, null, 2), folder);
    updateStatus({ syncing: false, lastSync: new Date().toISOString() });
  } catch (err: any) {
    console.error("Drive sync (notes) failed:", err);
    updateStatus({ syncing: false, error: err.message || "Drive sync failed" });
  }
}
