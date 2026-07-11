"use client";

import React, { useState, useEffect } from "react";
import { dbService, UserProfile } from "@/lib/db";
import { 
  Check, X, ArrowLeft, RefreshCw, Sparkles, ShieldCheck, 
  BookOpen, Layers, BarChart2, Cloud, Smartphone, Zap 
} from "lucide-react";

interface PricingPageProps {
  onBack: () => void;
  onUpgrade?: () => void;
}

const FEATURES = [
  { name: "Upload Study Materials", free: "2 documents", premium: "Unlimited documents" },
  { name: "Chapter Auto-Mapping", free: true, premium: true },
  { name: "Slide & Flashcard Generator", free: true, premium: true },
  { name: "Board-Aligned Exam Papers", free: true, premium: true },
  { name: "AI Auto-Grading", free: "MCQ only", premium: "MCQ + Written answers" },
  { name: "Bloom's Analytics Dashboard", free: false, premium: true },
  { name: "Google Drive Backup", free: false, premium: true },
  { name: "PPTX Export", free: false, premium: true },
  { name: "Parent Profile Management", free: false, premium: true },
  { name: "Priority AI Processing", free: false, premium: true },
];

export default function PricingPage({ onBack, onUpgrade }: PricingPageProps) {
  const [coupon, setCoupon] = useState("");
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponSuccess, setCouponSuccess] = useState(false);
  const [couponError, setCouponError] = useState("");
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [premiumCount, setPremiumCount] = useState(0);

  const totalSlots = 100;
  const spotsRemaining = Math.max(0, totalSlots - premiumCount);

  useEffect(() => {
    // Check if user is already logged in
    const unsub = dbService.subscribeAuthState((user) => {
      setCurrentUser(user);
    });
    // Get premium count
    dbService.getPremiumUserCount().then(setPremiumCount).catch(console.error);
    return () => unsub();
  }, []);

  const handleRedeemCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!coupon.trim() || !currentUser) return;

    setCouponError("");
    setCouponSuccess(false);
    setCouponLoading(true);

    try {
      await dbService.applyCoupon(currentUser.id, coupon);
      setCouponSuccess(true);
      setCoupon("");
      if (onUpgrade) onUpgrade();
    } catch (err: any) {
      setCouponError(err.message || "Invalid coupon code.");
    } finally {
      setCouponLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0c10] relative overflow-hidden py-12 px-4">
      {/* Background glows */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-glow-violet blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-glow-emerald blur-[120px] pointer-events-none"></div>

      <div className="max-w-5xl w-full mx-auto relative z-10 space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors cursor-pointer bg-slate-950 hover:bg-slate-900 border border-slate-800 py-2 px-4 rounded-xl"
          >
            <ArrowLeft size={14} /> Back
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center font-bold text-white shadow-md shadow-violet-600/20">A</div>
            <span className="font-display font-bold text-xl tracking-tight text-white">Acu</span>
          </div>
        </div>

        {/* Title */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-violet-500/30 bg-violet-950/20 text-xs text-violet-400 font-semibold tracking-wide">
            <Sparkles size={12} /> Choose Your Plan
          </div>
          <h1 className="text-3xl md:text-4xl font-display font-extrabold text-white">
            Simple, Transparent Pricing
          </h1>
          <p className="text-slate-400 text-sm max-w-lg mx-auto">
            Start for free. Upgrade when you need unlimited storage and advanced analytics.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
          {/* Free Tier */}
          <div className="glass-panel p-6 rounded-2xl border border-slate-850 relative">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400">
                  <BookOpen size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Free</h3>
                  <p className="text-xs text-slate-500">For students getting started</p>
                </div>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-display font-extrabold text-white">₹0</span>
                <span className="text-xs text-slate-500">/forever</span>
              </div>
              <ul className="space-y-2.5 text-xs">
                {FEATURES.map((f, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    {f.free === true ? (
                      <Check size={14} className="text-emerald-400 mt-0.5 shrink-0" />
                    ) : f.free === false ? (
                      <X size={14} className="text-slate-600 mt-0.5 shrink-0" />
                    ) : (
                      <Check size={14} className="text-emerald-400 mt-0.5 shrink-0" />
                    )}
                    <span className={f.free === false ? "text-slate-600" : "text-slate-300"}>
                      {f.name}
                      {typeof f.free === "string" && (
                        <span className="text-slate-500 ml-1">({f.free})</span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Premium Tier */}
          <div className="glass-panel p-6 rounded-2xl border border-violet-500/30 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-violet-600/10 blur-2xl pointer-events-none"></div>
            <div className="absolute top-3 right-3">
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-600 text-white font-bold uppercase tracking-wider">
                Popular
              </span>
            </div>
            <div className="space-y-4 relative">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-violet-950/40 text-violet-400">
                  <Zap size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Premium</h3>
                  <p className="text-xs text-slate-500">For serious students</p>
                </div>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-display font-extrabold text-white">₹499</span>
                <span className="text-xs text-slate-500">/one-time</span>
              </div>
              {spotsRemaining > 0 && (
                <div className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                  <Sparkles size={10} /> Early Bird: First 100 users get it FREE
                </div>
              )}
              <ul className="space-y-2.5 text-xs">
                {FEATURES.map((f, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <Check size={14} className="text-violet-400 mt-0.5 shrink-0" />
                    <span className="text-slate-300">
                      {f.name}
                      {typeof f.premium === "string" && (
                        <span className="text-violet-400 ml-1">({f.premium})</span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Coupon Redemption */}
        <div className="max-w-md mx-auto">
          <div className="glass-panel p-6 rounded-2xl space-y-4">
            <div className="flex items-center gap-2 text-violet-400">
              <ShieldCheck size={18} />
              <h3 className="font-display font-bold text-white text-sm">Have a Coupon Code?</h3>
            </div>

            {currentUser?.is_premium ? (
              <div className="p-3 rounded-xl border border-emerald-500/20 bg-emerald-950/10 text-emerald-400 text-xs text-center font-medium flex items-center justify-center gap-1.5">
                <Check size={14} /> Premium is already active on your account
              </div>
            ) : currentUser ? (
              <form onSubmit={handleRedeemCoupon} className="space-y-3">
                <input
                  type="text"
                  value={coupon}
                  onChange={(e) => setCoupon(e.target.value)}
                  placeholder="Enter coupon code (e.g. ACUBETA)"
                  required
                  className="w-full bg-slate-950/50 border border-slate-800 focus:border-violet-500 rounded-xl py-2.5 px-4 text-xs text-white placeholder-slate-600 outline-none transition-colors"
                />
                <button
                  type="submit"
                  disabled={couponLoading}
                  className="w-full py-2.5 bg-violet-600 hover:bg-violet-500 disabled:bg-violet-800 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {couponLoading ? <RefreshCw className="animate-spin" size={12} /> : null}
                  {couponLoading ? "Redeeming..." : "Redeem Code"}
                </button>

                {couponSuccess && (
                  <div className="p-3 rounded-lg border border-emerald-500/20 bg-emerald-950/30 text-emerald-400 text-xs text-center font-medium">
                    Premium activated! Enjoy unlimited access.
                  </div>
                )}
                {couponError && (
                  <div className="p-3 rounded-lg border border-red-500/20 bg-red-950/30 text-red-400 text-xs text-center font-medium">
                    {couponError}
                  </div>
                )}
              </form>
            ) : (
              <div className="text-center text-xs text-slate-500">
                <p>Sign in to redeem your coupon code.</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-slate-600 pt-4">
          <p>All payments are one-time. No subscriptions. No hidden fees.</p>
          <p className="mt-1">Your AI usage is billed directly to your own Google Gemini API account.</p>
        </div>
      </div>
    </div>
  );
}
