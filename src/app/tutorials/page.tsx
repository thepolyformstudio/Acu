"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, Sparkles, UploadCloud, GraduationCap, Clock, Play, X } from "lucide-react";

interface TutorialCardProps {
  title: string;
  step: string;
  description: string;
  videoSrc: string;
  icon: React.ReactNode;
  bullets: string[];
  comingSoon?: boolean;
}

function TutorialCard({ title, step, description, videoSrc, icon, bullets, comingSoon }: TutorialCardProps) {
  const [showModal, setShowModal] = useState(false);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") setShowModal(false);
  }, []);

  useEffect(() => {
    if (showModal) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [showModal, handleKeyDown]);

  return (
    <>
      <div className="glass-panel p-6 rounded-2xl relative overflow-hidden flex flex-col justify-between border border-slate-800 bg-slate-900/30 hover:border-slate-700 transition-all duration-300 h-full">
        <div className="space-y-4">
          {/* Step Badge & Icon */}
          <div className="flex items-center justify-between">
            <span className="px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 text-[10px] font-bold uppercase tracking-wider">
              {step}
            </span>
            <div className="p-2 rounded-xl bg-slate-950 text-violet-400 border border-slate-800">
              {icon}
            </div>
          </div>

          {/* Video preview with play button */}
          <div className="relative aspect-video rounded-xl overflow-hidden bg-slate-950 border border-slate-800 flex items-center justify-center group">
            {comingSoon ? (
              <div className="flex flex-col items-center justify-center p-6 text-slate-500 text-center">
                <Clock size={32} className="mb-3 text-slate-600" />
                <span className="text-sm font-semibold text-slate-400">Demo Coming Soon</span>
                <span className="text-[10px] text-slate-600 mt-1">This tutorial is being recorded</span>
              </div>
            ) : (
              <div className="relative w-full h-full">
                <img
                  src={videoSrc}
                  alt={title}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = "none";
                    const parent = target.parentElement;
                    if (parent) {
                      const placeholder = document.createElement("div");
                      placeholder.className = "flex flex-col items-center justify-center p-6 text-slate-500 text-center";
                      placeholder.innerHTML = `<svg class="w-8 h-8 mb-3 text-slate-600" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z"/></svg><span class="text-sm font-semibold text-slate-400">Demo Coming Soon</span><span class="text-[10px] text-slate-600 mt-1">This tutorial is being recorded</span>`;
                      parent.appendChild(placeholder);
                    }
                  }}
                />
                <div
                  onClick={() => setShowModal(true)}
                  className="absolute inset-0 flex items-center justify-center bg-slate-950/70 cursor-pointer transition-opacity hover:bg-slate-950/50"
                >
                  <div className="w-16 h-16 rounded-full bg-violet-600/90 flex items-center justify-center shadow-lg shadow-violet-600/30 transition-transform hover:scale-110">
                    <Play size={28} className="text-white fill-white ml-1" />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Info */}
          <div className="space-y-2 text-left">
            <h3 className="text-lg font-display font-bold text-white tracking-tight">{title}</h3>
            <p className="text-slate-400 text-xs leading-relaxed">{description}</p>
          </div>
        </div>

        {/* Bullets */}
        <div className="mt-6 pt-4 border-t border-slate-900 flex flex-col gap-2 text-left">
          {bullets.map((b, idx) => (
            <div key={idx} className="flex items-start gap-2 text-[11px] text-slate-500">
              <span className="text-emerald-400 shrink-0 mt-0.5">✓</span>
              <span>{b}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Full-screen modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setShowModal(false)}
        >
          <div
            className="relative max-w-5xl w-full max-h-[90vh] rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-black/60 flex items-center justify-center text-white hover:bg-black/80 transition-colors"
            >
              <X size={20} />
            </button>
            <img
              src={videoSrc}
              alt={title}
              className="w-full h-full object-contain max-h-[90vh]"
            />
          </div>
        </div>
      )}
    </>
  );

}

export default function TutorialsPage() {
  return (
    <main className="min-h-screen bg-[#0b0c10] relative overflow-hidden flex flex-col justify-between py-12 px-4">
      {/* Background glow highlights */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-glow-violet blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-glow-emerald blur-[120px] pointer-events-none"></div>

      {/* Header */}
      <header className="max-w-6xl w-full mx-auto flex items-center justify-between z-10">
        <Link href="/" className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-xs font-semibold">
          <ArrowLeft size={16} /> Back to Desk
        </Link>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center font-bold text-white shadow-md shadow-violet-600/20">A</div>
          <span className="font-display font-bold text-xl tracking-tight text-white">Acu Tutorials</span>
        </div>
      </header>

      {/* Hero Section */}
      <div className="max-w-6xl w-full mx-auto z-10 text-center mt-12 mb-8 space-y-3">
        <h1 className="text-3xl md:text-5xl font-display font-extrabold tracking-tight text-white leading-[1.1]">
          Learn How to Use <span className="bg-gradient-to-r from-violet-400 to-indigo-300 bg-clip-text text-transparent">Acu</span>
        </h1>
        <p className="text-slate-400 text-sm max-w-xl mx-auto">
          Follow these simple step-by-step video guides to configure your account, upload textbooks, and start generating study guides instantly.
        </p>
      </div>

      {/* Grid of Tutorial Cards */}
      <div className="max-w-6xl w-full mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 z-10 mb-12">
        <TutorialCard
          step="Step 1"
          title="Upload & Syllabus Mapping"
          description="Upload textbooks or study materials and map syllabus chapters to index them in your library."
          videoSrc="/videos/upload_tutorial.webp"
          icon={<UploadCloud size={18} />}
          bullets={[
            "Select active subject from library dropdown",
            "Upload textbook PDFs or text documents",
            "Syllabus indexing via Single Chapter mode",
            "Visual chapter mapping list creation"
          ]}
        />
        <TutorialCard
          step="Step 2"
          title="Generate Summaries & Notes"
          description="Convert your uploaded indexed chapters into summaries, flashcards, briefing notes, and more."
          videoSrc=""
          icon={<Sparkles size={18} />}
          comingSoon
          bullets={[
            "Navigate to AcuSlide tab from workspace",
            "Select textbook and target chapter",
            "Click on Briefing Notes or study assets",
            "Interactive revision with local AI answers"
          ]}
        />
        <TutorialCard
          step="Step 3"
          title="Exam Generation & Grading"
          description="Create custom exams from your study materials and get instant AI-powered grading."
          videoSrc=""
          icon={<GraduationCap size={18} />}
          comingSoon
          bullets={[
            "Select subject and chapters to test on",
            "Configure exam type and difficulty",
            "Attempt and submit your answers",
            "Review graded results with feedback"
          ]}
        />
      </div>

      {/* Footer */}
      <footer className="max-w-6xl w-full mx-auto text-center text-xs text-slate-600 z-10 border-t border-slate-900 pt-6">
        © {new Date().getFullYear()} Acu Study Companion. Know Thyself.
      </footer>
    </main>
  );
}
