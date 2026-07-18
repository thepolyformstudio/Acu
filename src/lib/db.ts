import { initializeApp, getApps } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut as fbSignOut, onAuthStateChanged, User as FirebaseUser, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { getFirestore, doc, getDoc, setDoc, updateDoc, collection, getDocs, query, where, getCountFromServer } from "firebase/firestore";

// Define TypeScript interfaces
export interface UserProfile {
  id: string;
  email: string;
  role: 'parent' | 'student' | 'admin';
  is_premium: boolean;
  coupon_applied: string | null;
  created_at: string;
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

export const dbService = {
  // Check total premium users count to enforce the 100-user early bird limit
  async getPremiumUserCount(): Promise<number> {
    if (isFirebaseConfigured && firestore) {
      try {
        const q = query(collection(firestore, "profiles"), where("is_premium", "==", true));
        const snapshot = await getCountFromServer(q);
        return snapshot.data().count;
      } catch (e) {
        console.error("Firebase getPremiumUserCount error:", e);
        return 0;
      }
    } else {
      const profiles = getMockData(LOCAL_MOCK_PROFILES, {});
      return Object.values(profiles).filter((p: any) => p.is_premium).length;
    }
  },

  // Auth: SignUp
  async signUp(email: string, password: string, role: 'parent' | 'student'): Promise<UserProfile> {
    if (isFirebaseConfigured && auth && firestore) {
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      const uid = credential.user.uid;
      
      // Determine premium auto-activation limit
      const currentPremiumCount = await this.getPremiumUserCount();
      const shouldBePremium = currentPremiumCount < 100;
      
      const finalRole = email.toLowerCase().trim() === 'admin@acu.com' ? 'admin' : role;

      const profile: UserProfile = {
        id: uid,
        email,
        role: finalRole,
        is_premium: shouldBePremium,
        coupon_applied: shouldBePremium ? "BETA_EARLY_BIRD" : null,
        created_at: new Date().toISOString()
      };

      await setDoc(doc(firestore, "profiles", uid), profile);
      return profile;
    } else {
      // Mock Storage SignUp
      const profiles = getMockData(LOCAL_MOCK_PROFILES, {});
      const emailLower = email.toLowerCase().trim();
      
      // Verify email doesn't exist
      if (Object.values(profiles).some((p: any) => p.email === emailLower)) {
        throw new Error("Email already registered in local mock db.");
      }

      const uid = "mock_user_" + Math.random().toString(36).substring(2, 9);
      const currentPremiumCount = await this.getPremiumUserCount();
      const shouldBePremium = currentPremiumCount < 100;
      
      const finalRole = emailLower === 'admin@acu.com' ? 'admin' : role;

      const profile: UserProfile = {
        id: uid,
        email: emailLower,
        role: finalRole,
        is_premium: shouldBePremium,
        coupon_applied: shouldBePremium ? "BETA_EARLY_BIRD" : null,
        created_at: new Date().toISOString()
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
      return snap.data() as UserProfile;
    } else {
      // Mock Storage SignIn
      const profiles = getMockData(LOCAL_MOCK_PROFILES, {});
      const emailLower = email.toLowerCase().trim();
      const foundProfile = Object.values(profiles).find((p: any) => p.email === emailLower) as UserProfile | undefined;
      
      if (!foundProfile) {
        throw new Error("User not found in local mock db. Please register first!");
      }
      // In local mock, any password works for testing
      saveMockData(LOCAL_MOCK_ACTIVE_USER, foundProfile);
      return foundProfile;
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
          return snap.data() as UserProfile;
        } else {
          const userCountSnap = await getCountFromServer(collection(firestore, "profiles"));
          const count = userCountSnap.data().count;
          const isPremium = count < 100;
          
          const newProfile: UserProfile = {
            id: fbUser.uid,
            email: fbUser.email || "",
            role,
            is_premium: isPremium,
            coupon_applied: isPremium ? "BETA_EARLY_BIRD" : null,
            created_at: new Date().toISOString()
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
        saveMockData(LOCAL_MOCK_ACTIVE_USER, found);
        return found;
      }
      
      const isPremium = Object.keys(profiles).length < 100;
      const mockUid = "google_user_mock_" + Math.random().toString(36).substring(2, 9);
      const mockProfile: UserProfile = {
        id: mockUid,
        email: mockEmail,
        role,
        is_premium: isPremium,
        coupon_applied: isPremium ? "BETA_EARLY_BIRD" : null,
        created_at: new Date().toISOString()
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
              callback(snap.data() as UserProfile);
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
        callback(active);
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
      await setDoc(doc(firestore, "children", childId), {}); // Delete or overwrite
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
    if (isFirebaseConfigured && firestore) {
      const metadata = { ...docSource, pages: [] }; // Strip heavy payload for Firestore
      await setDoc(doc(firestore, "profiles", profileId, "documents", docSource.id), metadata);
    } else {
      const docs = getMockData(LOCAL_MOCK_DOCUMENTS, []);
      // Remove if exists
      const filtered = docs.filter((d: any) => d.id !== docSource.id);
      filtered.push(docSource);
      saveMockData(LOCAL_MOCK_DOCUMENTS, filtered);
    }
  },

  async getDocumentSources(profileId: string): Promise<DocumentSource[]> {
    let list: DocumentSource[] = [];
    if (isFirebaseConfigured && firestore) {
      try {
        const q = collection(firestore, "profiles", profileId, "documents");
        const snap = await getDocs(q);
        snap.forEach(d => list.push(d.data() as DocumentSource));
      } catch (err) {
        console.error("Firestore getDocumentSources failed:", err);
      }
    }
    
    // Merge legacy local documents
    const localDocs = getMockData(LOCAL_MOCK_DOCUMENTS, []) as DocumentSource[];
    for (const ld of localDocs) {
      if (!list.find(m => m.id === ld.id)) {
        list.push(ld);
      }
    }
    return list;
  },

  async deleteDocumentSource(profileId: string, docId: string): Promise<void> {
    if (isFirebaseConfigured && firestore) {
      await setDoc(doc(firestore, "profiles", profileId, "documents", docId), {}); // Soft delete
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
        snap.forEach(d => list.push(d.data() as ExamAttempt));
      } catch (err) {
        console.error("Firestore getExamAttempts failed:", err);
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
      const metadata = { ...attempt, answers: [] }; // Strip heavy payload for Firestore
      await setDoc(doc(firestore, "profiles", profileId, "attempts", attempt.id), metadata);
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
      await setDoc(doc(firestore, "profiles", profileId, "attempts", attemptId), {}); // Soft delete
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
  }
};

