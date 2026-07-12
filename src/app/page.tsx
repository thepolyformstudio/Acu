"use client";

import React, { useState, useEffect } from "react";
import { dbService, UserProfile, DocumentSource, ExamAttempt } from "@/lib/db";
import AuthCard from "@/components/AuthCard";
import { 
  Sparkles, CheckCircle, Smartphone, ShieldCheck, 
  LogOut, Settings, BarChart2, BookOpen, Layers, HelpCircle, UserCheck, FolderOpen 
} from "lucide-react";
import { tryRestoreDriveSession, isDriveSignedIn } from "@/lib/googleDrive";

// Sub-components will be integrated directly
import SettingsPanel from "@/components/SettingsPanel";
import AcuDash from "@/components/AcuDash";
import AcuLibrary from "@/components/AcuLibrary";
import AcuSlide from "@/components/AcuSlide";
import AcuExam from "@/components/AcuExam";
import AcuCard from "@/components/AcuCard";
import PricingPage from "@/components/PricingPage";

export default function Home() {
  const [activeUser, setActiveUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"dashboard" | "library" | "slides" | "exams" | "settings">("dashboard");
  
  // Loaded documents & attempts shared across components
  const [documents, setDocuments] = useState<DocumentSource[]>([]);
  const [attempts, setAttempts] = useState<ExamAttempt[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string>("");
  const [showPricing, setShowPricing] = useState(false);

  useEffect(() => {
    // Listen to authentication changes
    const unsubscribe = dbService.subscribeAuthState((user) => {
      setActiveUser(user);
      if (user) {
        setActiveProfileId(user.id);
      }
      setLoading(false);
    });

    // Restore Google Drive session if previously connected
    if (isDriveSignedIn()) {
      tryRestoreDriveSession().catch(() => {});
    }

    return () => unsubscribe();
  }, []);

  // Fetch documents and attempts when active profile change
  useEffect(() => {
    if (activeProfileId) {
      dbService.getDocumentSources().then(setDocuments).catch(console.error);
      dbService.getExamAttempts(activeProfileId).then(setAttempts).catch(console.error);
    }
  }, [activeProfileId]);

  const refreshData = async () => {
    if (activeProfileId) {
      const docs = await dbService.getDocumentSources();
      const atts = await dbService.getExamAttempts(activeProfileId);
      setDocuments(docs);
      setAttempts(atts);
    }
  };

  const handleSignOut = async () => {
    await dbService.signOut();
    setActiveUser(null);
    setDocuments([]);
    setAttempts([]);
    setActiveTab("dashboard");
  };

  // -------------------------------------------------------------
  // SCREEN 1: Loading State
  // -------------------------------------------------------------
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0b0c10] flex flex-col items-center justify-center relative overflow-hidden">
        {/* Glow Effects */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-violet-600/10 blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-500/5 blur-3xl pointer-events-none"></div>
        
        <div className="text-center relative">
          <div className="w-16 h-16 border-4 border-violet-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <h2 className="text-xl font-display font-bold text-white">Loading Acu Workspace...</h2>
          <p className="text-slate-500 text-sm mt-1">Gathering study notes</p>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // SCREEN 2.5: Pricing Page
  // -------------------------------------------------------------
  if (showPricing) {
    return (
      <PricingPage 
        onBack={() => setShowPricing(false)} 
      />
    );
  }

  // -------------------------------------------------------------
  // SCREEN 2: Unauthenticated Landing Page + AuthCard
  // -------------------------------------------------------------
  if (!activeUser) {
    return (
      <main className="min-h-screen bg-[#0b0c10] relative overflow-hidden flex flex-col justify-between py-12 px-4">
        {/* Background glows */}
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-glow-violet blur-[120px] pointer-events-none"></div>
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-glow-emerald blur-[120px] pointer-events-none"></div>

        {/* Global Nav Header */}
        <header className="max-w-6xl w-full mx-auto flex items-center justify-between z-10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center font-bold text-white shadow-md shadow-violet-600/20">A</div>
            <span className="font-display font-bold text-xl tracking-tight text-white">Acu</span>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowPricing(true)}
              className="text-xs text-slate-400 hover:text-white transition-colors cursor-pointer font-medium"
            >
              Pricing
            </button>
            <div className="text-xs text-slate-500 font-medium">AI Study Companion</div>
          </div>
        </header>

        {/* Hero + Auth Layout */}
        <div className="max-w-6xl w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center z-10 my-auto py-8">
          
          {/* Left Column: Selling Points */}
          <div className="lg:col-span-7 space-y-6 text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-violet-500/30 bg-violet-950/20 text-xs text-violet-400 font-semibold tracking-wide">
              <Sparkles size={12} /> Trusted by 100+ students across India
            </div>
            
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-display font-extrabold tracking-tight text-white leading-[1.1]">
              Study Smarter. <br />
              <span className="bg-gradient-to-r from-violet-400 to-indigo-300 bg-clip-text text-transparent">Not Harder.</span>
            </h1>
            
            <p className="text-slate-400 text-base md:text-lg max-w-xl">
              Upload your textbooks, and Acu turns them into slides, flashcards, practice exams, and graded mock tests — powered by AI, stored privately in your own Google Drive.
            </p>

            {/* Feature Checkmarks */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 max-w-xl">
              <div className="flex items-start gap-3">
                <CheckCircle className="text-violet-500 mt-1 shrink-0" size={16} />
                <div>
                  <h4 className="text-white font-semibold text-sm">Slide & Flashcard Generator</h4>
                  <p className="text-slate-500 text-xs">Turn any chapter into visual presentations and revision flashcards in seconds.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle className="text-violet-500 mt-1 shrink-0" size={16} />
                <div>
                  <h4 className="text-white font-semibold text-sm">Board-Aligned Exam Papers</h4>
                  <p className="text-slate-500 text-xs">CBSE, ICSE, JEE, NEET — timed papers with auto-grading and Bloom's analytics.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Smartphone className="text-violet-500 mt-1 shrink-0" size={16} />
                <div>
                  <h4 className="text-white font-semibold text-sm">Upload from Your Phone</h4>
                  <p className="text-slate-500 text-xs">Snap a photo or upload PDFs directly from your device. No desktop needed.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <ShieldCheck className="text-violet-500 mt-1 shrink-0" size={16} />
                <div>
                  <h4 className="text-white font-semibold text-sm">Your Data Never Leaves You</h4>
                  <p className="text-slate-500 text-xs">All files stay in your browser. Connect Google Drive to backup everything to your own account.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Auth Card */}
          <div className="lg:col-span-5 flex justify-center w-full">
            <AuthCard onSuccess={(profile) => {
              setActiveUser(profile);
              setActiveProfileId(profile.id);
            }} />
          </div>
        </div>

        {/* Footer */}
        <footer className="max-w-6xl w-full mx-auto text-center text-xs text-slate-600 z-10 border-t border-slate-900 pt-6">
          © {new Date().getFullYear()} Acu Study Companion. Know Thyself.
        </footer>
      </main>
    );
  }

  // -------------------------------------------------------------
  // SCREEN 3: Authenticated App Shell (Mobile-First SPA Nav)
  // -------------------------------------------------------------
  return (
    <div className="min-h-screen bg-[#0b0c10] flex flex-col justify-between text-slate-100 relative">
      {/* Background glow highlights */}
      <div className="absolute top-0 right-1/4 w-[400px] h-[400px] bg-glow-violet blur-[150px] pointer-events-none"></div>
      <div className="absolute bottom-0 left-1/4 w-[400px] h-[400px] bg-glow-emerald blur-[150px] pointer-events-none"></div>

      {/* Top Header */}
      <header className="sticky top-0 z-30 glass-panel border-x-0 border-t-0 py-4 px-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center font-bold text-white shadow-md shadow-violet-600/20">A</div>
          <span className="font-display font-bold text-lg tracking-tight text-white">Acu</span>
          <span className="hidden sm:inline-block text-[10px] px-2 py-0.5 rounded-full border border-emerald-500/20 bg-emerald-950/20 text-emerald-400 font-semibold uppercase tracking-wider">
            {activeUser.is_premium ? "Premium Active" : "Free Account"}
          </span>
        </div>

        {/* Right Header: Profile & SignOut */}
        <div className="flex items-center gap-4">
          <div className="hidden md:flex flex-col text-right">
            <span className="text-xs text-white font-medium">{activeUser.email}</span>
            <span className="text-[10px] text-slate-400 capitalize">{activeUser.role} Account</span>
          </div>
          
          <button 
            onClick={handleSignOut}
            className="p-2 rounded-xl bg-slate-950 hover:bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
            title="Sign Out"
          >
            <LogOut size={16} />
          </button>
        </div>
      </header>

      {/* Main Body Layout (Sidebar + Stage) */}
      <div className="flex-1 max-w-7xl w-full mx-auto flex flex-col md:flex-row p-4 md:p-6 gap-6 relative z-10">
        
        {/* Responsive Desktop Sidebar Navigation */}
        <aside className="hidden md:flex flex-col w-64 shrink-0 glass-panel p-4 rounded-2xl h-fit space-y-2">
          <button
            onClick={() => setActiveTab("dashboard")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all cursor-pointer ${
              activeTab === "dashboard"
                ? "bg-violet-600 text-white shadow-md shadow-violet-600/20"
                : "text-slate-400 hover:text-white hover:bg-slate-950/50"
            }`}
          >
            <BookOpen size={18} />
            AcuDash
          </button>

          <button
            onClick={() => setActiveTab("library")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all cursor-pointer ${
              activeTab === "library"
                ? "bg-violet-600 text-white shadow-md shadow-violet-600/20"
                : "text-slate-400 hover:text-white hover:bg-slate-950/50"
            }`}
          >
            <FolderOpen size={18} />
            AcuLibrary
          </button>
          
          <button
            onClick={() => setActiveTab("slides")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all cursor-pointer ${
              activeTab === "slides"
                ? "bg-violet-600 text-white shadow-md shadow-violet-600/20"
                : "text-slate-400 hover:text-white hover:bg-slate-950/50"
            }`}
          >
            <Layers size={18} />
            AcuSlide
          </button>

          <button
            onClick={() => setActiveTab("exams")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all cursor-pointer ${
              activeTab === "exams"
                ? "bg-violet-600 text-white shadow-md shadow-violet-600/20"
                : "text-slate-400 hover:text-white hover:bg-slate-950/50"
            }`}
          >
            <BarChart2 size={18} />
            AcuExam
          </button>

          <div className="border-t border-slate-900 my-4 pt-4"></div>

          <button
            onClick={() => setActiveTab("settings")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all cursor-pointer ${
              activeTab === "settings"
                ? "bg-violet-600 text-white shadow-md shadow-violet-600/20"
                : "text-slate-400 hover:text-white hover:bg-slate-950/50"
            }`}
          >
            <Settings size={18} />
            Settings
          </button>

          <button
            onClick={() => setShowPricing(true)}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-950/50 transition-all cursor-pointer"
          >
            <Sparkles size={18} />
            Pricing
          </button>
        </aside>

        {/* Main Stage Panel */}
        <main className="flex-1 w-full overflow-hidden">
          {activeTab === "dashboard" && (
            <AcuDash 
              user={activeUser} 
              documents={documents} 
              attempts={attempts} 
              onRefresh={refreshData}
              activeProfileId={activeProfileId}
              setActiveProfileId={setActiveProfileId}
            />
          )}
          {activeTab === "library" && (
            <AcuLibrary 
              user={activeUser} 
              documents={documents} 
              onRefresh={refreshData}
            />
          )}
          {activeTab === "slides" && (
            <AcuSlide 
              documents={documents} 
              user={activeUser}
            />
          )}
          {activeTab === "exams" && (
            <AcuExam 
              documents={documents} 
              attempts={attempts}
              activeProfileId={activeProfileId}
              onRefresh={refreshData}
              user={activeUser}
            />
          )}
          {activeTab === "settings" && (
            <SettingsPanel 
              user={activeUser} 
              onRefresh={refreshData}
            />
          )}
        </main>
      </div>

      {/* Bottom Sticky Mobile Navigation (Mobile-First UI) */}
      <nav className="sticky bottom-0 z-30 md:hidden glass-panel border-x-0 border-b-0 py-2 px-4 flex items-center justify-around">
        <button
          onClick={() => setActiveTab("dashboard")}
          className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all cursor-pointer ${
            activeTab === "dashboard" ? "text-violet-400" : "text-slate-500"
          }`}
        >
          <BookOpen size={18} />
          <span className="text-[10px] font-semibold">AcuDash</span>
        </button>

        <button
          onClick={() => setActiveTab("library")}
          className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all cursor-pointer ${
            activeTab === "library" ? "text-violet-400" : "text-slate-500"
          }`}
        >
          <FolderOpen size={18} />
          <span className="text-[10px] font-semibold">Library</span>
        </button>
        
        <button
          onClick={() => setActiveTab("slides")}
          className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all cursor-pointer ${
            activeTab === "slides" ? "text-violet-400" : "text-slate-500"
          }`}
        >
          <Layers size={18} />
          <span className="text-[10px] font-semibold">AcuSlide</span>
        </button>

        <button
          onClick={() => setActiveTab("exams")}
          className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all cursor-pointer ${
            activeTab === "exams" ? "text-violet-400" : "text-slate-500"
          }`}
        >
          <BarChart2 size={18} />
          <span className="text-[10px] font-semibold">AcuExam</span>
        </button>

        <button
          onClick={() => setActiveTab("settings")}
          className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all cursor-pointer ${
            activeTab === "settings" ? "text-violet-400" : "text-slate-500"
          }`}
        >
          <Settings size={18} />
          <span className="text-[10px] font-semibold">Settings</span>
        </button>
      </nav>
    </div>
  );
}
