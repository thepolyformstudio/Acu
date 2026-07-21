import { initializeApp, getApps } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut as fbSignOut, onAuthStateChanged, User as FirebaseUser, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { getFirestore, doc, getDoc, setDoc, updateDoc, collection, getDocs, query, where, getCountFromServer, deleteDoc, writeBatch } from "firebase/firestore";
import { migrateLocalStorageToFirestore, syncFromFirestore, getCachedDocuments, getCachedAttempts, cacheDocument, cacheAttempt, removeCachedDocument, removeCachedAttempt } from "./sync";

export const INTERNAL_TESTER_EMAIL = "ejmultiverse@gmail.com";

export function isInternalTester(email: string): boolean {
  return email.toLowerCase().trim() === INTERNAL_TESTER_EMAIL;
}

// Define TypeScript interfaces
export interface UserProfile {
  id: string;
  email: string;
  role: 'parent' | 'student' | 'admin';
  is_premium: boolean;
  coupon_applied: string | null;
  created_at: string;
  premium_expires_at?: string | null;
}

export interface ChildProfile {
  id: string;
  parentId: string;
  name: string;
  grade: string;
  created_at: string;
}

export interface DocumentSource {
  id: string;
  name: string;
  subject?: string;
  pages: { pageNumber: number; text: string }[];
  chapterMap: { name: string; summary: string; startPage: number; endPage: number }[] | null;
  created_at: string;
}

export interface ExamAttempt {
  id: string;
  examTitle: string;
  subject?: string;
  documentId?: string;
  chapterName?: string;
  maxMarks: number;
  marksObtained: number;
  durationMinutes: number;
  date: string;
  bloomsAnalytics: { [key: string]: number }; // category -> percentage
  answers: {
    questionText: string;
    questionType: string;
    bloomsLevel: string;
    maxMarks: number;
    studentAnswer: string;
    modelAnswer: string;
    marksAwarded: number;
    justification: string;
    feedback: {
      correct_points: string[];
      incorrect_points: string[];
      suggestions: string[];
    };
  }[];
}

export interface AppReview {
  id: string;
  profileId: string;
  authorEmail: string;
  rating: number; // 0 to 5
  feedbackText: string;
  createdAt: string;
}

export interface SystemErrorLog {
  id: string;
  userEmail: string;
  context: string;
  errorMessage: string;
  timestamp: string;
}

// -------------------------------------------------------------
// 1. Firebase Initialization with Dynamic Detection
// -------------------------------------------------------------
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

const isFirebaseConfigured = !!(firebaseConfig.apiKey && firebaseConfig.projectId);

let app: any = null;
let auth: any = null;
let firestore: any = null;

if (isFirebaseConfigured) {
  try {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
    auth = getAuth(app);
    firestore = getFirestore(app);
    console.log("[Acu DB] Connected successfully to Cloud Firebase.");
  } catch (error) {
    console.error("[Acu DB] Error initializing Firebase. Falling back to Mock Storage.", error);
  }
} else {
  console.log("[Acu DB] No environment keys found. Running in Local Storage Mock Mode.");
}

// -------------------------------------------------------------
// 2. Mock Local Storage Database Implementation
// -------------------------------------------------------------
const LOCAL_MOCK_PROFILES = "acu_mock_profiles";
const LOCAL_MOCK_CHILDREN = "acu_mock_children";
const LOCAL_MOCK_ACTIVE_USER = "acu_mock_active_user";
const LOCAL_MOCK_DOCUMENTS = "acu_mock_documents";
const LOCAL_MOCK_ATTEMPTS = "acu_mock_attempts";
const LOCAL_MOCK_REVIEWS = "acu_mock_reviews";
const LOCAL_MOCK_ERRORS = "acu_mock_errors";

const getMockData = (key: string, defaultValue: any) => {
  if (typeof window === "undefined") return defaultValue;
  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) : defaultValue;
};

const saveMockData = (key: string, data: any) => {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(data));
};

// -------------------------------------------------------------
// 3. Unified Database & Authentication Service Methods
// -------------------------------------------------------------

export function checkPremiumExpiry(profile: UserProfile): UserProfile {
  const isInternal = isInternalTester(profile.email);
  const isAdminEmail = profile.email.toLowerCase().trim() === 'admin@acu.com';
  if (isInternal || isAdminEmail) {
    return { ...profile, role: 'admin', is_premium: true, premium_expires_at: null };
  }
  if (profile.premium_expires_at && new Date() > new Date(profile.premium_expires_at)) {
    return { ...profile, is_premium: false, premium_expires_at: null };
  }
  return profile;
}

export const dbService = {
  // Check total premium users count to enforce the 100-user early bird limit
  async getPremiumUserCount(): Promise<number> {
    if (isFirebaseConfigured && firestore) {
      try {
        const q = query(collection(firestore, "profiles"), where("is_premium", "==", true));
        const snapshot = await getDocs(q);
        const allPremium = snapshot.docs.map(d => d.data() as UserProfile);
        return allPremium.filter(p => p.coupon_applied !== "INTERNAL_TESTER").length;
      } catch (e) {
        console.error("Firebase getPremiumUserCount error:", e);
        return 0;
      }
    } else {
      const profiles = getMockData(LOCAL_MOCK_PROFILES, {});
      return Object.values(profiles).filter((p: any) => p.is_premium && p.coupon_applied !== "INTERNAL_TESTER").length;
    }
  },

  // Auth: SignUp
  async signUp(email: string, password: string, role: 'parent' | 'student'): Promise<UserProfile> {
    const emailClean = email.toLowerCase().trim();
    const isInternal = isInternalTester(emailClean);
    const finalRole = (emailClean === 'admin@acu.com' || isInternal) ? 'admin' : role;

    if (isFirebaseConfigured && auth && firestore) {
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      const uid = credential.user.uid;
      
      const currentPremiumCount = await this.getPremiumUserCount();
      const shouldBePremium = isInternal || currentPremiumCount < 100;

      const profile: UserProfile = {
        id: uid,
        email,
        role: finalRole,
        is_premium: shouldBePremium,
        coupon_applied: isInternal ? "INTERNAL_TESTER" : (shouldBePremium ? "BETA_EARLY_BIRD" : null),
        created_at: new Date().toISOString(),
        premium_expires_at: isInternal ? null : (shouldBePremium ? new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString() : null)
      };

      await setDoc(doc(firestore, "profiles", uid), profile);
      return profile;
    } else {
      const profiles = getMockData(LOCAL_MOCK_PROFILES, {});
      if (Object.values(profiles).some((p: any) => p.email === emailClean)) {
        throw new Error("Email already registered in local mock db.");
      }

      const uid = "mock_user_" + Math.random().toString(36).substring(2, 9);
      const currentPremiumCount = await this.getPremiumUserCount();
      const shouldBePremium = isInternal || currentPremiumCount < 100;

      const profile: UserProfile = {
        id: uid,
        email: emailClean,
        role: finalRole,
        is_premium: shouldBePremium,
        coupon_applied: isInternal ? "INTERNAL_TESTER" : (shouldBePremium ? "BETA_EARLY_BIRD" : null),
        created_at: new Date().toISOString(),
        premium_expires_at: isInternal ? null : (shouldBePremium ? new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString() : null)
      };

      profiles[uid] = profile;
      saveMockData(LOCAL_MOCK_PROFILES, profiles);
      saveMockData(LOCAL_MOCK_ACTIVE_USER, profile);
      return profile;
    }
  },

  // Auth: SignIn
  async signIn(email: string, password: string): Promise<UserProfile> {
    if (isFirebaseConfigured && auth && firestore) {
      const credential = await signInWithEmailAndPassword(auth, email, password);
      const uid = credential.user.uid;
      const docRef = doc(firestore, "profiles", uid);
      const snap = await getDoc(docRef);
      if (!snap.exists()) {
        throw new Error("User profile not found in database.");
      }
      return checkPremiumExpiry(snap.data() as UserProfile);
    } else {
      // Mock Storage SignIn
      const profiles = getMockData(LOCAL_MOCK_PROFILES, {});
      const emailLower = email.toLowerCase().trim();
      const foundProfile = Object.values(profiles).find((p: any) => p.email === emailLower) as UserProfile | undefined;
      
      if (!foundProfile) {
        throw new Error("User not found in local mock db. Please register first!");
      }
      // In local mock, any password works for testing
      const checked = checkPremiumExpiry(foundProfile);
      saveMockData(LOCAL_MOCK_ACTIVE_USER, checked);
      return checked;
    }
  },

  // Auth: Google SignIn / SignUp
  async signInWithGoogle(role: 'student' | 'parent'): Promise<UserProfile> {
    if (isFirebaseConfigured && auth && firestore) {
      try {
        const provider = new GoogleAuthProvider();
        // Request Drive file scope so the token can be used for Drive backup
        provider.addScope("https://www.googleapis.com/auth/drive.file");
        const credentials = await signInWithPopup(auth, provider);
        const fbUser = credentials.user;

        // Capture Drive access token if available
        const credential = GoogleAuthProvider.credentialFromResult(credentials);
        if (credential?.accessToken) {
          if (typeof window !== "undefined") {
            localStorage.setItem("acu_drive_access_token", credential.accessToken);
          }
        }
        
        const userDocRef = doc(firestore, "profiles", fbUser.uid);
        const snap = await getDoc(userDocRef);
        
        if (snap.exists()) {
          return checkPremiumExpiry(snap.data() as UserProfile);
        } else {
          const userCountSnap = await getCountFromServer(collection(firestore, "profiles"));
          const count = userCountSnap.data().count;
          const fbEmail = fbUser.email || "";
          const isInternal = isInternalTester(fbEmail);
          const isPremium = isInternal || count < 100;
          
          const newProfile: UserProfile = {
            id: fbUser.uid,
            email: fbEmail,
            role,
            is_premium: isPremium,
            coupon_applied: isInternal ? "INTERNAL_TESTER" : (isPremium ? "BETA_EARLY_BIRD" : null),
            created_at: new Date().toISOString(),
            premium_expires_at: isInternal ? null : (isPremium ? new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString() : null)
          };
          
          await setDoc(userDocRef, newProfile);
          return newProfile;
        }
      } catch (err: any) {
        const code = err?.code || "";
        if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") {
          throw new Error("__CANCELLED__");
        }
        throw new Error(err.message || "Google Sign-In failed.");
      }
    } else {
      // Local Mock Google Sign-In
      const mockEmail = `google-${role}-mock@test.com`;
      const profiles = getMockData(LOCAL_MOCK_PROFILES, {});
      const existingGoogleUserKey = Object.keys(profiles).find(k => profiles[k].email === mockEmail);
      
      if (existingGoogleUserKey) {
        const found = profiles[existingGoogleUserKey];
        const checked = checkPremiumExpiry(found);
        saveMockData(LOCAL_MOCK_ACTIVE_USER, checked);
        return checked;
      }
      
      const isPremium = Object.keys(profiles).length < 100;
      const mockUid = "google_user_mock_" + Math.random().toString(36).substring(2, 9);
      const mockProfile: UserProfile = {
        id: mockUid,
        email: mockEmail,
        role,
        is_premium: isPremium,
        coupon_applied: isPremium ? "BETA_EARLY_BIRD" : null,
        created_at: new Date().toISOString(),
        premium_expires_at: isPremium ? new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString() : null
      };
      
      profiles[mockUid] = mockProfile;
      saveMockData(LOCAL_MOCK_PROFILES, profiles);
      saveMockData(LOCAL_MOCK_ACTIVE_USER, mockProfile);
      return mockProfile;
    }
  },

  // Auth: SignOut
  async signOut(): Promise<void> {
    if (isFirebaseConfigured && auth) {
      await fbSignOut(auth);
    } else {
      if (typeof window !== "undefined") {
        localStorage.removeItem(LOCAL_MOCK_ACTIVE_USER);
      }
    }
  },

  // Listen to Auth state changes
  subscribeAuthState(callback: (user: UserProfile | null) => void): () => void {
    if (isFirebaseConfigured && auth && firestore) {
      return onAuthStateChanged(auth, async (fbUser: FirebaseUser | null) => {
        if (fbUser) {
          try {
            const snap = await getDoc(doc(firestore, "profiles", fbUser.uid));
            if (snap.exists()) {
              const profile = snap.data() as UserProfile;
              // Run migration + sync in background (non-blocking)
              migrateLocalStorageToFirestore(firestore).then(() => {
                syncFromFirestore(firestore, profile.id);
              });
              callback(checkPremiumExpiry(profile));
            } else {
              callback(null);
            }
          } catch {
            callback(null);
          }
        } else {
          callback(null);
        }
      });
    } else {
      // Mock triggers immediately with active mock user
      const checkUser = () => {
        const active = getMockData(LOCAL_MOCK_ACTIVE_USER, null);
        callback(active ? checkPremiumExpiry(active) : null);
      };
      
      checkUser();
      
      // Simulate an unmount/cleanup function
      return () => {};
    }
  },

  // Apply a manual premium activation code (e.g. for users beyond 100)
  async applyCoupon(userId: string, code: string): Promise<boolean> {
    const cleanCode = code.toUpperCase().trim();
    
    if (isFirebaseConfigured && firestore) {
      try {
        const couponRef = doc(firestore, "coupons", cleanCode);
        const snap = await getDoc(couponRef);
        if (!snap.exists()) {
          throw new Error("Invalid Coupon Code.");
        }
        const data = snap.data();
        if (data.is_used) {
          throw new Error("Coupon has already been redeemed.");
        }

        // Update coupon and user profile atomically
        await updateDoc(couponRef, { is_used: true, used_by: userId });
        await updateDoc(doc(firestore, "profiles", userId), { is_premium: true, coupon_applied: cleanCode });
        return true;
      } catch (err: any) {
        throw new Error(err.message || "Redemption failed.");
      }
    } else {
      // Local Mock Coupon Redeem: any code containing "FREE" will work for local testing
      if (cleanCode.includes("FREE") || cleanCode === "ACUBETA") {
        const profiles = getMockData(LOCAL_MOCK_PROFILES, {});
        if (profiles[userId]) {
          profiles[userId].is_premium = true;
          profiles[userId].coupon_applied = cleanCode;
          saveMockData(LOCAL_MOCK_PROFILES, profiles);
          
          const currentActive = getMockData(LOCAL_MOCK_ACTIVE_USER, null);
          if (currentActive && currentActive.id === userId) {
            currentActive.is_premium = true;
            currentActive.coupon_applied = cleanCode;
            saveMockData(LOCAL_MOCK_ACTIVE_USER, currentActive);
          }
          return true;
        }
        throw new Error("User profile not found.");
      } else {
        throw new Error("Invalid mock coupon. Hint: Try a code containing 'FREE'.");
      }
    }
  },

  // -------------------------------------------------------------
  // Child Profiles Management (for Parent Role)
  // -------------------------------------------------------------
  async getChildProfiles(parentId: string): Promise<ChildProfile[]> {
    if (isFirebaseConfigured && firestore) {
      const q = query(collection(firestore, "children"), where("parentId", "==", parentId));
      const snap = await getDocs(q);
      const list: ChildProfile[] = [];
      snap.forEach(d => list.push(d.data() as ChildProfile));
      return list;
    } else {
      const children = getMockData(LOCAL_MOCK_CHILDREN, []);
      return children.filter((c: any) => c.parentId === parentId);
    }
  },

  async addChildProfile(parentId: string, name: string, grade: string): Promise<ChildProfile> {
    const id = "child_" + Math.random().toString(36).substring(2, 9);
    const newChild: ChildProfile = {
      id,
      parentId,
      name,
      grade,
      created_at: new Date().toISOString()
    };

    if (isFirebaseConfigured && firestore) {
      await setDoc(doc(firestore, "children", id), newChild);
      return newChild;
    } else {
      const children = getMockData(LOCAL_MOCK_CHILDREN, []);
      children.push(newChild);
      saveMockData(LOCAL_MOCK_CHILDREN, children);
      return newChild;
    }
  },

  async deleteChildProfile(childId: string): Promise<void> {
    if (isFirebaseConfigured && firestore) {
      await deleteDoc(doc(firestore, "children", childId));
    } else {
      let children = getMockData(LOCAL_MOCK_CHILDREN, []);
      children = children.filter((c: any) => c.id !== childId);
      saveMockData(LOCAL_MOCK_CHILDREN, children);
    }
  },

  // -------------------------------------------------------------
  // Library & Document Parsing Caches (Stored Client-Side in Local IndexedDB)
  // -------------------------------------------------------------
  // For document uploads, we always store them locally in the browser's IndexedDB
  // because user text documents can be megabytes in size, and client-side processing
  // is faster and safer for privacy than uploading to databases.
  
  async saveDocumentSource(profileId: string, docSource: DocumentSource): Promise<void> {
    // 1. Always cache full document (including pages) to IndexedDB locally
    await cacheDocument(docSource);

    if (isFirebaseConfigured && firestore) {
      try {
        // 2. Save metadata-only shell to main documents collection (respecting 1MB limit)
        const metadataOnlyDoc: DocumentSource = {
          id: docSource.id,
          name: docSource.name,
          subject: docSource.subject,
          pages: [], // Stripped for main doc metadata shell
          chapterMap: docSource.chapterMap,
          created_at: docSource.created_at
        };
        await setDoc(doc(firestore, "profiles", profileId, "documents", docSource.id), metadataOnlyDoc);

        // 3. Save page chunks in subcollection: profiles/{profileId}/documents/{docId}/pages/{pageNumber}
        if (docSource.pages && docSource.pages.length > 0) {
          const pagesCollectionRef = collection(firestore, "profiles", profileId, "documents", docSource.id, "pages");
          const batchSize = 450; // Max batch size is 500
          for (let i = 0; i < docSource.pages.length; i += batchSize) {
            const chunk = docSource.pages.slice(i, i + batchSize);
            const batch = writeBatch(firestore);
            for (const page of chunk) {
              const pRef = doc(pagesCollectionRef, String(page.pageNumber));
              batch.set(pRef, { pageNumber: page.pageNumber, text: page.text });
            }
            await batch.commit();
          }
        }
      } catch (err) {
        console.error("Firestore saveDocumentSource failed:", err);
      }
    } else {
      const docs = getMockData(LOCAL_MOCK_DOCUMENTS, []);
      const filtered = docs.filter((d: any) => d.id !== docSource.id);
      filtered.push(docSource);
      saveMockData(LOCAL_MOCK_DOCUMENTS, filtered);
    }
  },

  async getDocumentPagesFromFirestore(profileId: string, docId: string): Promise<{ pageNumber: number; text: string }[]> {
    if (isFirebaseConfigured && firestore) {
      try {
        const pagesRef = collection(firestore, "profiles", profileId, "documents", docId, "pages");
        const snap = await getDocs(pagesRef);
        const pages: { pageNumber: number; text: string }[] = [];
        snap.forEach(d => {
          const data = d.data();
          if (data && typeof data.pageNumber === "number") {
            pages.push({ pageNumber: data.pageNumber, text: data.text || "" });
          }
        });
        return pages.sort((a, b) => a.pageNumber - b.pageNumber);
      } catch (err) {
        console.error("Firestore getDocumentPagesFromFirestore failed:", err);
      }
    }
    return [];
  },

  async getDocumentSources(profileId: string): Promise<DocumentSource[]> {
    let list: DocumentSource[] = [];
    if (isFirebaseConfigured && firestore) {
      try {
        const q = collection(firestore, "profiles", profileId, "documents");
        const snap = await getDocs(q);
        snap.forEach(d => {
          const data = d.data() as DocumentSource;
          if (data && data.id) {
            list.push(data);
          }
        });
      } catch (err) {
        console.error("Firestore getDocumentSources failed:", err);
      }
    }
    
    // Hydrate Firestore docs with IndexedDB pages if local copy exists
    const cachedDocs = await getCachedDocuments();
    for (const cd of cachedDocs) {
      const existingIdx = list.findIndex(m => m.id === cd.id);
      if (existingIdx !== -1) {
        if ((!list[existingIdx].pages || list[existingIdx].pages.length === 0) && cd.pages && cd.pages.length > 0) {
          list[existingIdx].pages = cd.pages;
        }
      } else {
        list.push(cd);
      }
    }
    
    // Merge legacy local storage docs
    const localDocs = getMockData(LOCAL_MOCK_DOCUMENTS, []) as DocumentSource[];
    for (const ld of localDocs) {
      const existingIdx = list.findIndex(m => m.id === ld.id);
      if (existingIdx !== -1) {
        if ((!list[existingIdx].pages || list[existingIdx].pages.length === 0) && ld.pages && ld.pages.length > 0) {
          list[existingIdx].pages = ld.pages;
        }
      } else {
        list.push(ld);
      }
    }
    return list;
  },

  async deleteDocumentSource(profileId: string, docId: string): Promise<void> {
    if (isFirebaseConfigured && firestore) {
      try {
        const pagesRef = collection(firestore, "profiles", profileId, "documents", docId, "pages");
        const pageSnap = await getDocs(pagesRef);
        for (const pDoc of pageSnap.docs) {
          await deleteDoc(pDoc.ref);
        }
        await deleteDoc(doc(firestore, "profiles", profileId, "documents", docId));
      } catch (err) {
        console.error("Firestore deleteDocumentSource failed:", err);
      }
      await removeCachedDocument(docId);
    } else {
      const docs = getMockData(LOCAL_MOCK_DOCUMENTS, []);
      const filtered = docs.filter((d: any) => d.id !== docId);
      saveMockData(LOCAL_MOCK_DOCUMENTS, filtered);
    }
  },

  // -------------------------------------------------------------
  // Exam Attempts History
  // -------------------------------------------------------------
  async getExamAttempts(profileId: string): Promise<ExamAttempt[]> {
    let list: ExamAttempt[] = [];
    if (isFirebaseConfigured && firestore) {
      try {
        const q = collection(firestore, "profiles", profileId, "attempts");
        const snap = await getDocs(q);
        snap.forEach(d => {
          const data = d.data() as ExamAttempt;
          if (data && data.id) {
            list.push(data);
          }
        });
      } catch (err) {
        console.error("Firestore getExamAttempts failed:", err);
      }
    }
    
    // Merge IndexedDB attempts not in Firestore
    const cachedAttempts = await getCachedAttempts();
    for (const ca of cachedAttempts) {
      if (!list.find(m => m.id === ca.id)) {
        list.push(ca);
      }
    }
    
    // Merge legacy local attempts
    const allAttempts = getMockData(LOCAL_MOCK_ATTEMPTS, {});
    const localAttempts = allAttempts[profileId] || [];
    for (const la of localAttempts) {
      if (!list.find(m => m.id === la.id)) {
        list.push(la);
      }
    }
    return list;
  },

  async saveExamAttempt(profileId: string, attempt: ExamAttempt): Promise<void> {
    if (isFirebaseConfigured && firestore) {
      await setDoc(doc(firestore, "profiles", profileId, "attempts", attempt.id), attempt);
      await cacheAttempt(attempt);
    } else {
      const allAttempts = getMockData(LOCAL_MOCK_ATTEMPTS, {});
      if (!allAttempts[profileId]) {
        allAttempts[profileId] = [];
      }
      allAttempts[profileId].push(attempt);
      saveMockData(LOCAL_MOCK_ATTEMPTS, allAttempts);
    }
  },

  async deleteExamAttempt(profileId: string, attemptId: string): Promise<void> {
    if (isFirebaseConfigured && firestore) {
      await deleteDoc(doc(firestore, "profiles", profileId, "attempts", attemptId));
      await removeCachedAttempt(attemptId);
    } else {
      const allAttempts = getMockData(LOCAL_MOCK_ATTEMPTS, {});
      if (allAttempts[profileId]) {
        allAttempts[profileId] = allAttempts[profileId].filter((a: ExamAttempt) => a.id !== attemptId);
        saveMockData(LOCAL_MOCK_ATTEMPTS, allAttempts);
      }
    }
  },

  // -------------------------------------------------------------
  // App Reviews
  // -------------------------------------------------------------
  async submitAppReview(review: AppReview): Promise<void> {
    const allReviews: AppReview[] = getMockData(LOCAL_MOCK_REVIEWS, []);
    allReviews.push(review);
    saveMockData(LOCAL_MOCK_REVIEWS, allReviews);
  },

  async getAllAppReviews(): Promise<AppReview[]> {
    if (isFirebaseConfigured && firestore) {
      try {
        const q = query(collection(firestore, "reviews"));
        const snap = await getDocs(q);
        return snap.docs.map(d => d.data() as AppReview);
      } catch (e) {
        console.error("Firestore getAllAppReviews failed:", e);
        return [];
      }
    }
    return getMockData(LOCAL_MOCK_REVIEWS, []);
  },

  // -------------------------------------------------------------
  // Payment / Premium Activation
  // -------------------------------------------------------------
  async activatePremium(userId: string, planId: string, expiresAt: string): Promise<void> {
    if (isFirebaseConfigured && firestore) {
      await updateDoc(doc(firestore, "profiles", userId), {
        is_premium: true,
        coupon_applied: `razorpay_${planId}`,
        premium_expires_at: expiresAt,
      });
    } else {
      const profiles = getMockData(LOCAL_MOCK_PROFILES, {});
      if (profiles[userId]) {
        profiles[userId].is_premium = true;
        profiles[userId].coupon_applied = `razorpay_${planId}`;
        profiles[userId].premium_expires_at = expiresAt;
        saveMockData(LOCAL_MOCK_PROFILES, profiles);

        const currentActive = getMockData(LOCAL_MOCK_ACTIVE_USER, null);
        if (currentActive && currentActive.id === userId) {
          currentActive.is_premium = true;
          currentActive.coupon_applied = `razorpay_${planId}`;
          currentActive.premium_expires_at = expiresAt;
          saveMockData(LOCAL_MOCK_ACTIVE_USER, currentActive);
        }
      }
    }
  },

  // -------------------------------------------------------------
  // Admin Methods
  // -------------------------------------------------------------
  async getAllProfiles(): Promise<UserProfile[]> {
    if (isFirebaseConfigured && firestore) {
      try {
        const q = query(collection(firestore, "profiles"));
        const snap = await getDocs(q);
        return snap.docs.map(d => d.data() as UserProfile);
      } catch (e) {
        console.error("Firestore getAllProfiles failed:", e);
        return [];
      }
    }
    const profiles = getMockData(LOCAL_MOCK_PROFILES, {});
    return Object.values(profiles);
  },

  async deleteProfile(profileId: string): Promise<void> {
    if (isFirebaseConfigured && firestore) {
      try {
        await setDoc(doc(firestore, "profiles", profileId), { deleted: true }, { merge: true });
      } catch (e) {
        console.error("Firestore deleteProfile failed:", e);
      }
      return;
    }
    const profiles = getMockData(LOCAL_MOCK_PROFILES, {});
    if (profiles[profileId]) {
      delete profiles[profileId];
      saveMockData(LOCAL_MOCK_PROFILES, profiles);
    }
  },

  async deleteAppReview(reviewId: string): Promise<void> {
    if (isFirebaseConfigured && firestore) {
      try {
        await setDoc(doc(firestore, "reviews", reviewId), { deleted: true }, { merge: true });
      } catch (e) {
        console.error("Firestore deleteAppReview failed:", e);
      }
      return;
    }
    const reviews: AppReview[] = getMockData(LOCAL_MOCK_REVIEWS, []);
    const filtered = reviews.filter((r) => r.id !== reviewId);
    saveMockData(LOCAL_MOCK_REVIEWS, filtered);
  },

  async getSystemAnalytics(): Promise<{ totalUsers: number, totalDocuments: number, totalAttempts: number }> {
    if (isFirebaseConfigured && firestore) {
      try {
        const usersSnap = await getCountFromServer(collection(firestore, "profiles"));
        const totalUsers = usersSnap.data().count;
        const docsSnap = await getCountFromServer(collection(firestore, "documents"));
        const totalDocuments = docsSnap.data().count;
        let totalAttempts = 0;
        const profilesSnap = await getDocs(collection(firestore, "profiles"));
        for (const pDoc of profilesSnap.docs) {
          try {
            const attemptsSnap = await getCountFromServer(collection(firestore, "profiles", pDoc.id, "attempts"));
            totalAttempts += attemptsSnap.data().count;
          } catch { }
        }
        return { totalUsers, totalDocuments, totalAttempts };
      } catch (e) {
        console.error("Firestore getSystemAnalytics failed:", e);
      }
    }
    const profiles = Object.values(getMockData(LOCAL_MOCK_PROFILES, {}));
    const documents = getMockData(LOCAL_MOCK_DOCUMENTS, []);
    
    let attemptsCount = 0;
    const attemptsDb = getMockData(LOCAL_MOCK_ATTEMPTS, {});
    for (const key of Object.keys(attemptsDb)) {
      attemptsCount += attemptsDb[key].length || 0;
    }

    return {
      totalUsers: profiles.length,
      totalDocuments: documents.length,
      totalAttempts: attemptsCount
    };
  },

  // -------------------------------------------------------------
  // System Error Telemetry
  // -------------------------------------------------------------
  async reportSystemError(errorReport: SystemErrorLog): Promise<void> {
    if (isFirebaseConfigured && firestore) {
      try {
        await setDoc(doc(firestore, "system_errors", errorReport.id), errorReport);
      } catch (e) {
        console.error("Failed to report error to Firestore:", e);
      }
    } else {
      const errors: SystemErrorLog[] = getMockData("acu_mock_errors", []);
      errors.unshift(errorReport);
      saveMockData("acu_mock_errors", errors.slice(0, 100));
    }
  },

  async getSystemErrors(): Promise<SystemErrorLog[]> {
    if (isFirebaseConfigured && firestore) {
      try {
        const q = query(collection(firestore, "system_errors"));
        const snap = await getDocs(q);
        const list: SystemErrorLog[] = [];
        snap.forEach(d => list.push(d.data() as SystemErrorLog));
        return list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      } catch (e) {
        console.error("Firestore getSystemErrors failed:", e);
        return [];
      }
    }
    return getMockData("acu_mock_errors", []);
  },

  async clearSystemErrors(): Promise<void> {
    if (isFirebaseConfigured && firestore) {
      try {
        const q = query(collection(firestore, "system_errors"));
        const snap = await getDocs(q);
        for (const d of snap.docs) {
          await deleteDoc(d.ref);
        }
      } catch (e) {
        console.error("Firestore clearSystemErrors failed:", e);
      }
    }
    saveMockData("acu_mock_errors", []);
  }
};
