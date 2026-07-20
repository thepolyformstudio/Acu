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

  const handleDismiss = (dontShowAgain: boolean) => {
    if (dontShowAgain) {
      localStorage.setItem(`acu_onboarding_seen_${userId}`, "true");
    }
    setVisible(false);
    setTimeout(onClose, 350); // wait for fade-out
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-all duration-300 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
      style={{ backgroundColor: "rgba(0,0,0,0.80)", backdropFilter: "blur(8px)" }}
    >
      <div
        className={`relative w-full max-w-5xl rounded-3xl border border-slate-800 bg-[#0d0e14] shadow-2xl shadow-black/60 overflow-hidden transition-all duration-300 ${
          visible ? "scale-100 translate-y-0" : "scale-95 translate-y-4"
        }`}
      >
        {/* Ambient glows */}
        <div className="absolute top-0 left-1/4 w-80 h-80 bg-violet-600/8 blur-[100px] pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-emerald-600/6 blur-[100px] pointer-events-none" />

        {/* Header */}
        <div className="relative flex items-start justify-between p-6 pb-0">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-950/40 border border-violet-500/25 text-violet-400 text-[10px] font-bold uppercase tracking-wider mb-3">
              <Sparkles size={10} />
              Welcome to Acu
            </div>
            <h2 className="text-2xl sm:text-3xl font-display font-extrabold text-white leading-tight">
              Your complete AI study workflow
            </h2>
            <p className="text-slate-400 text-sm mt-1">
              Here's how Acu works — follow these four steps to supercharge your studies.
            </p>
          </div>
          <button
            onClick={() => handleDismiss(false)}
            className="ml-4 p-2 rounded-xl text-slate-500 hover:text-white hover:bg-slate-800 transition-colors shrink-0 cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Step Cards */}
        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {STEPS.map((step, i) => {
            const Icon = step.icon;
            const isActive = activeStep === i;
            return (
              <div key={i} className="relative flex flex-col">
                {/* Arrow connector (hidden on last) */}
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
        <div className="flex justify-center gap-1.5 sm:hidden px-6 pb-2">
          {STEPS.map((_, i) => (
            <button
              key={i}
              onClick={() => setActiveStep(i)}
              className={`w-2 h-2 rounded-full transition-all cursor-pointer ${
                activeStep === i ? "bg-violet-500 w-4" : "bg-slate-700"
              }`}
            />
          ))}
        </div>

        {/* Footer */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-4 border-t border-slate-900 bg-slate-950/40">
          <p className="text-[11px] text-slate-600 text-center sm:text-left">
            You can revisit this guide anytime from the Help section.
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={() => handleDismiss(true)}
              className="text-xs text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
            >
              Don't show again
            </button>
            <button
              onClick={() => handleDismiss(false)}
              className="px-5 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-xs font-bold tracking-wide transition-colors cursor-pointer shadow-lg shadow-violet-600/20"
            >
              Got it, let's start →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
