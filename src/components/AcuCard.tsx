"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Layers, ChevronLeft, ChevronRight, Check } from "lucide-react";

interface Flashcard {
  front: string;
  back: string;
}

interface AcuCardProps {
  cards: Flashcard[];
  onClose: () => void;
  chapterName: string;
}

export default function AcuCard({ cards, onClose, chapterName }: AcuCardProps) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  if (cards.length === 0) {
    return (
      <div className="glass-panel p-6 rounded-2xl text-center space-y-3 max-w-md mx-auto">
        <p className="text-sm text-slate-400">No flashcards found for this chapter.</p>
        <button onClick={onClose} className="px-4 py-2 bg-violet-600 text-white rounded-xl text-xs">
          Close
        </button>
      </div>
    );
  }

  const activeCard = cards[currentIdx];

  const handleNext = () => {
    setIsFlipped(false);
    setTimeout(() => {
      setCurrentIdx((currentIdx + 1) % cards.length);
    }, 150);
  };

  const handlePrev = () => {
    setIsFlipped(false);
    setTimeout(() => {
      setCurrentIdx((currentIdx - 1 + cards.length) % cards.length);
    }, 150);
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0b0c10]/80 backdrop-blur-md flex flex-col items-center justify-center p-4">
      {/* Container */}
      <div className="w-full max-w-md space-y-6 text-center">
        {/* Header */}
        <div className="flex justify-between items-center text-slate-400">
          <div className="text-left">
            <span className="text-[10px] font-bold text-violet-400 uppercase tracking-wider">AcuCard Active Recall</span>
            <h3 className="text-xs text-white font-bold truncate max-w-[220px]">{chapterName}</h3>
          </div>
          <button 
            onClick={onClose}
            className="text-xs py-1 px-3 border border-slate-800 hover:border-slate-500 rounded-lg text-slate-300 transition-colors cursor-pointer"
          >
            Close / Exit
          </button>
        </div>

        {/* 3D Flip Card Container */}
        <div 
          className="w-full aspect-[4/3] relative cursor-pointer perspective-1000"
          onClick={() => setIsFlipped(!isFlipped)}
        >
          <motion.div 
            className="w-full h-full relative preserve-3d transition-transform duration-500"
            style={{ transformStyle: "preserve-3d" }}
            animate={{ rotateY: isFlipped ? 180 : 0 }}
          >
            {/* Front of Card */}
            <div 
              className="absolute inset-0 w-full h-full rounded-2xl glass-panel p-8 flex flex-col items-center justify-center text-center backface-hidden"
              style={{ backfaceVisibility: "hidden" }}
            >
              <div className="absolute top-4 left-4 p-1.5 rounded-lg bg-violet-950/30 text-violet-400">
                <Layers size={14} />
              </div>
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-2">Question / Concept</span>
              <p className="text-sm sm:text-base font-medium text-white leading-relaxed">{activeCard.front}</p>
              <span className="absolute bottom-4 text-[9px] text-slate-500 uppercase tracking-widest">Click to Flip</span>
            </div>

            {/* Back of Card */}
            <div 
              className="absolute inset-0 w-full h-full rounded-2xl glass-panel p-8 flex flex-col items-center justify-center text-center backface-hidden"
              style={{ 
                backfaceVisibility: "hidden", 
                transform: "rotateY(180deg)",
                borderColor: "rgba(16, 185, 129, 0.2)"
              }}
            >
              <div className="absolute top-4 left-4 p-1.5 rounded-lg bg-emerald-950/30 text-emerald-400">
                <Check size={14} />
              </div>
              <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider mb-2">Definition / Answer</span>
              <p className="text-sm sm:text-base font-semibold text-emerald-300 leading-relaxed">{activeCard.back}</p>
              <span className="absolute bottom-4 text-[9px] text-slate-500 uppercase tracking-widest">Click to Flip</span>
            </div>
          </motion.div>
        </div>

        {/* Carousel controls */}
        <div className="flex justify-between items-center px-4">
          <button
            onClick={handlePrev}
            className="p-2.5 rounded-xl bg-slate-950 hover:bg-slate-900 border border-slate-800 text-slate-300 transition-colors cursor-pointer"
          >
            <ChevronLeft size={16} />
          </button>
          
          <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
            Card {currentIdx + 1} of {cards.length}
          </span>

          <button
            onClick={handleNext}
            className="p-2.5 rounded-xl bg-slate-950 hover:bg-slate-900 border border-slate-800 text-slate-300 transition-colors cursor-pointer"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
