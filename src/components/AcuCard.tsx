"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Layers, ChevronLeft, ChevronRight, Check, AlertCircle } from "lucide-react";

interface Flashcard {
  front: string;
  back: string;
}

interface AcuCardProps {
  cards: Flashcard[];
  onClose: () => void;
  chapterName: string;
  onGenerateMore?: (count: number) => void;
  isLoading?: boolean;
}

export default function AcuCard({ 
  cards, 
  onClose, 
  chapterName, 
  onGenerateMore, 
  isLoading = false 
}: AcuCardProps) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  // If loading, show a premium loading skeleton/spinner overlay
  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 bg-[#0b0c10]/90 backdrop-blur-md flex flex-col items-center justify-center p-4">
        <div className="glass-panel p-8 rounded-2xl text-center space-y-4 max-w-md w-full border border-slate-800 animate-fade-in">
          <div className="relative w-16 h-16 mx-auto">
            <div className="absolute inset-0 border-4 border-violet-500/20 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-violet-500 rounded-full border-t-transparent animate-spin"></div>
          </div>
          <div>
            <h4 className="text-base font-semibold text-white mb-1">Generating custom flashcards...</h4>
            <p className="text-xs text-slate-500 leading-relaxed max-w-xs mx-auto">
              Our AI is analyzing the textbook context and crafting active-recall study cards.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const hasCards = cards && cards.length > 0;
  const activeCard = hasCards ? cards[currentIdx] : null;

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
    <div className="fixed inset-0 z-50 bg-[#0b0c10]/85 backdrop-blur-md flex flex-col items-center justify-center p-4 animate-fade-in">
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
        {hasCards && activeCard ? (
          <div 
            className="w-full aspect-[4/3] relative cursor-pointer perspective-1000"
            onClick={() => setIsFlipped(!isFlipped)}
          >
            <motion.div 
              className="w-full h-full relative preserve-3d"
              style={{ transformStyle: "preserve-3d" }}
              animate={{ rotateY: isFlipped ? 180 : 0 }}
              transition={{ duration: 0.4, ease: "easeInOut" }}
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
                  borderColor: "rgba(16, 185, 129, 0.25)"
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
        ) : (
          <div className="w-full aspect-[4/3] rounded-2xl glass-panel p-8 flex flex-col items-center justify-center text-center border border-dashed border-slate-800">
            <AlertCircle size={24} className="text-slate-600 mb-2" />
            <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
              No flashcards generated yet for this chapter. Use the bar below to generate a custom deck.
            </p>
          </div>
        )}

        {/* Carousel controls */}
        {hasCards && (
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
        )}

        {/* Size Selection / Custom Deck Generator */}
        {onGenerateMore && (
          <div className="flex items-center justify-between gap-3 p-4 rounded-xl border border-slate-900 bg-slate-950/40">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Deck Size:</span>
              <select
                id="flashcard-deck-size"
                defaultValue={15}
                className="bg-slate-900 border border-slate-800 rounded-lg py-1 px-2.5 text-[10px] text-white outline-none cursor-pointer focus:border-violet-500"
              >
                <option value={10}>10 Cards</option>
                <option value={15}>15 Cards</option>
                <option value={25}>25 Cards</option>
                <option value={40}>40 Cards</option>
              </select>
            </div>
            
            <button
              onClick={() => {
                const select = document.getElementById("flashcard-deck-size") as HTMLSelectElement;
                if (select && onGenerateMore) {
                  onGenerateMore(Number(select.value));
                  setCurrentIdx(0);
                  setIsFlipped(false);
                }
              }}
              className="py-1.5 px-4 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-[10px] font-bold transition-all cursor-pointer shadow-md hover:shadow-violet-600/20"
            >
              {hasCards ? "Regenerate Deck" : "Generate Custom Deck"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
