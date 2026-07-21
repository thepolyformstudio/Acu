// Multi-Tier Document Hydration Utility
// Resolves document page text across 4 resilient tiers:
//   Tier 1: Memory (doc.pages if already populated)
//   Tier 2: Local IndexedDB Cache (fast zero-latency client storage)
//   Tier 3: Firestore Server Subcollection (cross-device cloud storage)
//   Tier 4: Google Drive Backup (if user connected Drive)

import { DocumentSource, dbService } from "@/lib/db";
import { getCachedDocument, cacheDocument } from "@/lib/sync";
import { loadSingleDocumentFromDrive } from "@/lib/googleDrive";

export async function hydrateDocumentPayload(
  doc: DocumentSource,
  profileId: string = "anonymous"
): Promise<DocumentSource> {
  if (!doc) throw new Error("Invalid document object provided.");

  // Tier 1: Memory check
  if (doc.pages && doc.pages.length > 0) {
    return doc;
  }

  // Tier 2: Local IndexedDB check
  try {
    const cachedDoc = await getCachedDocument(doc.id);
    if (cachedDoc && cachedDoc.pages && cachedDoc.pages.length > 0) {
      return { ...doc, pages: cachedDoc.pages };
    }
  } catch (e) {
    console.warn("[DocHydrator] Tier 2 IndexedDB lookup failed:", e);
  }

  // Tier 3: Firestore Server Subcollection check (documents/{docId}/pages)
  try {
    const serverPages = await dbService.getDocumentPagesFromFirestore(profileId, doc.id);
    if (serverPages && serverPages.length > 0) {
      const hydrated: DocumentSource = { ...doc, pages: serverPages };
      // Cache to IndexedDB for subsequent instant reloads
      await cacheDocument(hydrated).catch(() => {});
      return hydrated;
    }
  } catch (e) {
    console.warn("[DocHydrator] Tier 3 Firestore subcollection lookup failed:", e);
  }

  // Tier 4: Google Drive Backup check
  try {
    const driveDoc = await loadSingleDocumentFromDrive(doc.id);
    if (driveDoc && driveDoc.pages && driveDoc.pages.length > 0) {
      const hydrated: DocumentSource = { ...doc, pages: driveDoc.pages };
      // Cache to IndexedDB for subsequent instant reloads
      await cacheDocument(hydrated).catch(() => {});
      return hydrated;
    }
  } catch (e) {
    console.warn("[DocHydrator] Tier 4 Google Drive lookup failed:", e);
  }

  // All 4 tiers failed to locate page content
  throw new Error(
    `Textbook content for "${doc.name}" was not found in browser cache, server storage, or Google Drive. ` +
    `Please re-upload the document into your library.`
  );
}
