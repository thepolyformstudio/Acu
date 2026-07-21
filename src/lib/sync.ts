import { collection, doc, getDocs, setDoc, deleteDoc, query } from "firebase/firestore";
import { DocumentSource, ExamAttempt, UserProfile } from "./db";
import { trackUsage } from "./usageMonitor";

const DB_NAME = "acu_local_db";
const DB_VERSION = 1;
const MIGRATION_FLAG_KEY = "acu_migration_completed";

interface SyncQueueItem {
  id: string;
  collection: string;
  profileId: string;
  data: any;
  action: "upsert" | "delete";
  timestamp: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("documents")) {
        db.createObjectStore("documents", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("attempts")) {
        db.createObjectStore("attempts", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("syncQueue")) {
        const store = db.createObjectStore("syncQueue", { keyPath: "id", autoIncrement: true });
        store.createIndex("timestamp", "timestamp");
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function idbGetAll(storeName: string): Promise<any[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const store = tx.objectStore(storeName);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet(storeName: string, key: string): Promise<any> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const store = tx.objectStore(storeName);
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbPut(storeName: string, data: any): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);
    store.put(data);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function idbDelete(storeName: string, key: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);
    store.delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function idbClear(storeName: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);
    store.clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function isFirestoreAvailable(): boolean {
  return !!(
    typeof window !== "undefined" &&
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY &&
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  );
}

export async function migrateLocalStorageToFirestore(firestore: any): Promise<{ success: number; failed: number; skipped: number }> {
  if (typeof window === "undefined") return { success: 0, failed: 0, skipped: 0 };
  if (localStorage.getItem(MIGRATION_FLAG_KEY)) return { success: 0, failed: 0, skipped: 0 };
  if (!isFirestoreAvailable()) return { success: 0, failed: 0, skipped: 0 };

  const result = { success: 0, failed: 0, skipped: 0 };

  const activeUserRaw = localStorage.getItem("acu_mock_active_user");
  if (!activeUserRaw) {
    localStorage.setItem(MIGRATION_FLAG_KEY, "true");
    return result;
  }

  const activeUser: UserProfile = JSON.parse(activeUserRaw);
  const uid = activeUser.id;

  // Migrate documents
  try {
    const docsRaw = localStorage.getItem("acu_mock_documents");
    if (docsRaw) {
      const docs: DocumentSource[] = JSON.parse(docsRaw);
      for (const docItem of docs) {
        try {
          await setDoc(doc(firestore, "profiles", uid, "documents", docItem.id), docItem);
          result.success++;
          trackUsage("firestoreWrite");
        } catch {
          result.failed++;
        }
      }
    }
  } catch {
    result.skipped++;
  }

  // Migrate exam attempts
  try {
    const attemptsRaw = localStorage.getItem("acu_mock_attempts");
    if (attemptsRaw) {
      const allAttempts: Record<string, ExamAttempt[]> = JSON.parse(attemptsRaw);
      const userAttempts = allAttempts[uid] || [];
      for (const attempt of userAttempts) {
        try {
          await setDoc(doc(firestore, "profiles", uid, "attempts", attempt.id), attempt);
          result.success++;
          trackUsage("firestoreWrite");
        } catch {
          result.failed++;
        }
      }
    }
  } catch {
    result.skipped++;
  }

  localStorage.setItem(MIGRATION_FLAG_KEY, "true");
  console.log(`[Acu Sync] Migration complete: ${result.success} written, ${result.failed} failed, ${result.skipped} skipped`);
  return result;
}

export async function syncFromFirestore(firestore: any, profileId: string): Promise<void> {
  if (!isFirestoreAvailable()) return;

  // Sync documents - carefully preserve local pages if Firestore doc has empty pages
  try {
    const snap = await getDocs(collection(firestore, "profiles", profileId, "documents"));
    for (const d of snap.docs) {
      const remoteData = d.data() as DocumentSource;
      const localExisting = await getCachedDocument(remoteData.id);
      
      if (localExisting && localExisting.pages && localExisting.pages.length > 0 && (!remoteData.pages || remoteData.pages.length === 0)) {
        await idbPut("documents", { ...remoteData, pages: localExisting.pages });
      } else {
        await idbPut("documents", remoteData);
      }
    }
    trackUsage("firestoreRead");
  } catch (err) {
    console.error("[Acu Sync] Failed to sync documents:", err);
  }

  // Sync attempts
  try {
    const snap = await getDocs(collection(firestore, "profiles", profileId, "attempts"));
    for (const d of snap.docs) {
      await idbPut("attempts", d.data());
    }
    trackUsage("firestoreRead");
  } catch (err) {
    console.error("[Acu Sync] Failed to sync attempts:", err);
  }

  console.log("[Acu Sync] Sync complete");
}

export async function getCachedDocuments(): Promise<DocumentSource[]> {
  try {
    return await idbGetAll("documents");
  } catch {
    return [];
  }
}

export async function getCachedDocument(docId: string): Promise<DocumentSource | null> {
  try {
    return await idbGet("documents", docId);
  } catch {
    return null;
  }
}

export async function getCachedAttempts(): Promise<ExamAttempt[]> {
  try {
    return await idbGetAll("attempts");
  } catch {
    return [];
  }
}

export async function cacheDocument(docItem: DocumentSource): Promise<void> {
  await idbPut("documents", docItem);
}

export async function cacheAttempt(attempt: ExamAttempt): Promise<void> {
  await idbPut("attempts", attempt);
}

export async function removeCachedDocument(docId: string): Promise<void> {
  await idbDelete("documents", docId);
}

export async function removeCachedAttempt(attemptId: string): Promise<void> {
  await idbDelete("attempts", attemptId);
}

export async function clearLocalCache(): Promise<void> {
  await idbClear("documents");
  await idbClear("attempts");
  await idbClear("syncQueue");
}
