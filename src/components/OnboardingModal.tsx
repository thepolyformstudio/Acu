"use client";

import React, { useState, useEffect } from "react";
import { X, Upload, Layers, ClipboardCheck, BarChart2, ChevronRight, Sparkles } from "lucide-react";

interface OnboardingModalProps {
  userId: string;
  onClose: () => void;
}

const STEPS = [
  {
    icon: Upload,
    accentColor: "#7c3aed",
    glowColor: "rgba(124,58,237,0.25)",
    borderColor: "border-violet-500/30",
    bgColor: "bg-violet-950/30",
    iconBg: "bg-violet-600/20",
    iconColor: "text-violet-400",
    badgeColor: "bg-violet-600",
    label: "Step 1",
    title: "Acu Library",
    description: "Upload your textbooks, notes, and images. Acu indexes every chapter automatically.",
    tags: ["PDF", "DOCX", "TXT", "PNG / JPG"],
  },
  {
    icon: Layers,
    accentColor: "#4f46e5",
    glowColor: "rgba(79,70,229,0.22)",
    borderColor: "border-indigo-500/30",
    bgColor: "bg-indigo-950/30",
    iconBg: "bg-indigo-600/20",
    iconColor: "text-indigo-400",
    badgeColor: "bg-indigo-600",
    label: "Step 2",
    title: "AcuSlide",
    description: "Generate AI-powered slides, briefing notes, flashcards, FAQs, and timelines from your uploads.",
    tags: ["Slides", "Notes", "Flashcards", "Podcast Script"],
  },
  {
    icon: ClipboardCheck,
    accentColor: "#059669",
    glowColor: "rgba(5,150,105,0.2)",
    borderColor: "border-emerald-500/30",
    bgColor: "bg-emerald-950/30",
    iconBg: "bg-emerald-600/20",
    iconColor: "text-emerald-400",
    badgeColor: "bg-emerald-600",
    label: "Step 3",
    title: "AcuExam",
    description: "Take board-aligned practice tests. Gemini grades your answers with detailed rubrics and feedback.",
    tags: ["MCQ", "Short Answer", "Long Answer", "AI Grading"],
  },
  {
    icon: BarChart2,
    accentColor: "#d97706",
    glowColor: "rgba(217,119,6,0.2)",
    borderColor: "border-amber-500/30",
    bgColor: "bg-amber-950/30",
    iconBg: "bg-amber-600/20",
    iconColor: "text-amber-400",
    badgeColor: "bg-amber-600",
    label: "Step 4",
    title: "AcuDash",
    description: "Track performance across subjects and topics with Bloom's Taxonomy analytics and score history.",
    tags: ["Score History", "Bloom's Analytics", "Subject Trends"],
  },
];

export default function OnboardingModal({ userId, onClose }: OnboardingModalProps) {
  const [visible, setVisible] = useState(false);
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    // Animate in
    const t = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(t);
  }, []);

  // Keyboard Escape dismissal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleDismiss(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleDismiss = (dontShowAgain: boolean) => {
    if (dontShowAgain) {
      localStorage.setItem(`acu_onboarding_seen_${userId}`, "true");
    }
    setVisible(false);
    setTimeout(onClose, 350); // wait for fade-out
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) handleDismiss(false);
      }}
      className={`fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 transition-all duration-300 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
      style={{ backgroundColor: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)" }}
    >
      <div
        className={`relative w-full max-w-5xl max-h-[92vh] sm:max-h-[85vh] flex flex-col rounded-2xl sm:rounded-3xl border border-slate-800 bg-[#0d0e14] shadow-2xl shadow-black/80 overflow-hidden transition-all duration-300 ${
          visible ? "scale-100 translate-y-0" : "scale-95 translate-y-4"
        }`}
      >
        {/* Ambient glows */}
        <div className="absolute top-0 left-1/4 w-80 h-80 bg-violet-600/8 blur-[100px] pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-emerald-600/6 blur-[100px] pointer-events-none" />

        {/* Sticky Header with prominent Close Button */}
        <div className="relative flex-shrink-0 flex items-start justify-between p-4 sm:p-6 border-b border-slate-800/60 bg-[#0d0e14]/95 backdrop-blur-md z-20">
          <div className="pr-8 sm:pr-12">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-950/40 border border-violet-500/25 text-violet-400 text-[10px] font-bold uppercase tracking-wider mb-2 sm:mb-3">
              <Sparkles size={10} />
              Welcome to Acu
            </div>
            <h2 className="text-xl sm:text-3xl font-display font-extrabold text-white leading-tight">
              Your complete AI study workflow
            </h2>
            <p className="text-slate-400 text-xs sm:text-sm mt-1">
              Here's how Acu works — follow these four steps to supercharge your studies.
            </p>
          </div>

          {/* Touch-friendly Close Button always visible on mobile & desktop */}
          <button
            type="button"
            onClick={() => handleDismiss(false)}
            aria-label="Close onboarding modal"
            title="Close"
            className="p-2 sm:p-2.5 rounded-full sm:rounded-xl bg-slate-900/90 border border-slate-700/70 text-slate-300 hover:text-white hover:bg-slate-800 hover:border-slate-600 transition-all shrink-0 cursor-pointer shadow-lg active:scale-95 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
          >
            <X size={20} className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Step Cards Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {STEPS.map((step, i) => {
            const Icon = step.icon;
            const isActive = activeStep === i;
            return (
              <div key={i} className="relative flex flex-col">
                {/* Arrow connector (hidden on last card) */}
                {i < STEPS.length - 1 && (
                  <div className="hidden lg:flex absolute -right-2.5 top-1/2 -translate-y-1/2 z-10 items-center justify-center w-5 h-5">
                    <ChevronRight size={16} className="text-slate-600" />
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setActiveStep(i)}
                  className={`text-left flex-1 p-4 rounded-2xl border transition-all duration-200 cursor-pointer ${
                    isActive
                      ? `${step.borderColor} ${step.bgColor} shadow-lg`
                      : "border-slate-800 bg-slate-950/40 hover:border-slate-700 hover:bg-slate-900/40"
                  }`}
                  style={
                    isActive
                      ? { boxShadow: `0 0 30px 0 ${step.glowColor}` }
                      : {}
                  }
                >
                  {/* Icon */}
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${step.iconBg}`}
                  >
                    <Icon size={18} className={step.iconColor} />
                  </div>

                  {/* Badge */}
                  <span
                    className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full text-white ${step.badgeColor} mb-2 inline-block`}
                  >
                    {step.label}
                  </span>

                  <h3 className="text-sm font-bold text-white mb-1">{step.title}</h3>
                  <p className="text-[11px] text-slate-400 leading-relaxed mb-3">
                    {step.description}
                  </p>

                  {/* Tag chips */}
                  <div className="flex flex-wrap gap-1">
                    {step.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-[9px] px-1.5 py-0.5 rounded-md border border-slate-700 text-slate-500 bg-slate-900"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </button>
              </div>
            );
          })}
        </div>

        {/* Step indicator dots (mobile) */}
        <div className="flex-shrink-0 flex justify-center gap-1.5 sm:hidden px-4 pb-2 bg-[#0d0e14]">
          {STEPS.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setActiveStep(i)}
              aria-label={`Go to step ${i + 1}`}
              className={`h-2 rounded-full transition-all cursor-pointer ${
                activeStep === i ? "bg-violet-500 w-5" : "bg-slate-700 w-2"
              }`}
            />
          ))}
        </div>

        {/* Sticky Footer */}
        <div className="flex-shrink-0 flex flex-col-reverse sm:flex-row items-center justify-between gap-3 p-4 sm:px-6 sm:py-4 border-t border-slate-900 bg-slate-950/90 z-20">
          <p className="text-[11px] text-slate-500 text-center sm:text-left">
            You can revisit this guide anytime from the Help section.
          </p>
          <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-3">
            <button
              type="button"
              onClick={() => handleDismiss(true)}
              className="text-xs text-slate-400 hover:text-slate-200 transition-colors cursor-pointer py-1.5 px-2"
            >
              Don't show again
            </button>
            <button
              type="button"
              onClick={() => handleDismiss(false)}
              className="px-5 py-2.5 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-xs font-bold tracking-wide transition-colors cursor-pointer shadow-lg shadow-violet-600/20 active:scale-95"
            >
              Got it, let's start →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
