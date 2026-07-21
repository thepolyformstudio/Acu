"use client";

import React, { useState, useEffect } from "react";
import { dbService, UserProfile } from "@/lib/db";
import { 
  Check, ArrowLeft, RefreshCw, Sparkles, ShieldCheck, 
  BookOpen, Zap, Clock 
} from "lucide-react";
import { validateCoupon } from "@/lib/validation";
import { safeError, logError } from "@/lib/errors";
import { loadRazorpayScript, openRazorpayCheckout } from "@/lib/payments/razorpay";
import { PLANS } from "@/lib/payments";

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

const EARLY_BIRD_SLOTS = 100;
const EARLY_BIRD_DURATION_DAYS = 90;
const LAUNCH_DATE = new Date("2026-07-19");

function getEarlyBirdEndDate(): Date {
  const end = new Date(LAUNCH_DATE);
  end.setDate(end.getDate() + EARLY_BIRD_DURATION_DAYS);
  return end;
}

function getDaysRemaining(target: Date): number {
  const now = new Date();
  const diff = target.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

export default function PricingPage({ onBack, onUpgrade }: PricingPageProps) {
  const [coupon, setCoupon] = useState("");
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponSuccess, setCouponSuccess] = useState(false);
  const [couponError, setCouponError] = useState("");
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [premiumCount, setPremiumCount] = useState(0);
  const [payLoading, setPayLoading] = useState<string | null>(null);
  const [payError, setPayError] = useState("");
  const [paySuccess, setPaySuccess] = useState(false);

  const earlyBirdEnd = getEarlyBirdEndDate();
  const daysLeft = getDaysRemaining(earlyBirdEnd);
  const slotsRemaining = Math.max(0, EARLY_BIRD_SLOTS - premiumCount);
  const earlyBirdActive = daysLeft > 0 && slotsRemaining > 0;
  const isEarlyBirdUser = currentUser?.coupon_applied === "BETA_EARLY_BIRD" && currentUser?.premium_expires_at;
  const isInternalTester = currentUser?.coupon_applied === "INTERNAL_TESTER";

  useEffect(() => {
    const unsub = dbService.subscribeAuthState((user) => {
      setCurrentUser(user);
    });
    dbService.getPremiumUserCount().then(setPremiumCount).catch(console.error);
    return () => unsub();
  }, []);

  const handleRedeemCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) { setCouponError("Please sign in first."); return; }
    const couponErr = validateCoupon(coupon);
    if (couponErr) { setCouponError(couponErr); return; }

    setCouponError("");
    setCouponSuccess(false);
    setCouponLoading(true);

    try {
      await dbService.applyCoupon(currentUser.id, coupon);
      setCouponSuccess(true);
      setCoupon("");
      if (onUpgrade) onUpgrade();
    } catch (err) {
      logError("Coupon redemption", err);
      setCouponError(safeError(err, "Invalid coupon code."));
    } finally {
      setCouponLoading(false);
    }
  };

  const handleSubscribe = async (planId: "monthly" | "yearly") => {
    if (!currentUser) {
      setPayError("Please sign in first.");
      return;
    }

    setPayError("");
    setPaySuccess(false);
    setPayLoading(planId);

    try {
      const razorpayKey = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
      if (!razorpayKey || !razorpayKey.startsWith("rzp_")) {
        setPayError("Payment not configured yet. Razorpay keys are missing.");
        setPayLoading(null);
        return;
      }

      // 1. Load Razorpay script
      const loaded = await loadRazorpayScript();
      if (!loaded) {
        setPayError("Failed to load payment gateway. Please try again.");
        setPayLoading(null);
        return;
      }

      // 2. Create order server-side
      const apiBase = typeof window !== "undefined" && window.location.hostname === "localhost" ? "" : "https://ssracudex-963945863708.us-central1.run.app";
      const orderRes = await fetch(`${apiBase}/api/payments/create-order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId,
          userId: currentUser.id,
          userEmail: currentUser.email,
        }),
      });

      if (!orderRes.ok) {
        const errData = await orderRes.json();
        throw new Error(errData.error || "Failed to create order");
      }

      const order = await orderRes.json();
      const plan = PLANS[planId];

      // 3. Open Razorpay Checkout (UPI only)
      openRazorpayCheckout({
        key: razorpayKey,
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        name: "Acu",
        description: plan.description,
        email: currentUser.email,
        onSuccess: async (payload) => {
          try {
            // 4. Verify signature server-side
            const apiBase = typeof window !== "undefined" && window.location.hostname === "localhost" ? "" : "https://ssracudex-963945863708.us-central1.run.app";
            const verifyRes = await fetch(`${apiBase}/api/payments/verify`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                ...payload,
                planId,
                userId: currentUser.id,
              }),
            });

            if (!verifyRes.ok) {
              const errData = await verifyRes.json();
              throw new Error(errData.error || "Payment verification failed");
            }

            const verifyData = await verifyRes.json();

            // 5. Activate premium in Firestore
            await dbService.activatePremium(currentUser.id, planId, verifyData.premium_expires_at);

            setPaySuccess(true);
            if (onUpgrade) onUpgrade();
          } catch (err) {
            logError("Payment verification", err);
            setPayError(safeError(err, "Payment was completed but verification failed. Contact support."));
          }
        },
        onError: (err) => {
          const msg = safeError(err, "Payment was cancelled or failed.");
          if (msg !== "Payment cancelled") {
            logError("Payment", err);
            setPayError(msg);
          }
        },
      });
    } catch (err) {
      logError("Payment", err);
      setPayError(safeError(err, "Something went wrong. Please try again."));
    } finally {
      setPayLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0c10] relative overflow-hidden py-12 px-4">
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

        {/* Success message */}
        {paySuccess && (
          <div className="max-w-md mx-auto p-4 rounded-xl border border-emerald-500/20 bg-emerald-950/20 text-emerald-400 text-sm text-center font-medium">
            <Check size={16} className="inline mr-1.5" />
            Premium activated! Enjoy unlimited access.
          </div>
        )}

        {/* Error message */}
        {payError && (
          <div className="max-w-md mx-auto p-3 rounded-lg border border-red-500/20 bg-red-950/30 text-red-400 text-xs text-center font-medium">
            {payError}
          </div>
        )}

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Free Tier */}
          <div className="glass-panel p-6 rounded-2xl border border-slate-850 relative flex flex-col">
            <div className="space-y-4 flex-1">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400">
                  <BookOpen size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Free</h3>
                  <p className="text-xs text-slate-500">Getting started</p>
                </div>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-display font-extrabold text-white">₹0</span>
              </div>
              {earlyBirdActive && (
                <div className="p-3 rounded-xl border border-emerald-500/20 bg-emerald-950/10 text-emerald-400 text-xs space-y-1">
                  <div className="flex items-center gap-1.5 font-semibold">
                    <Clock size={12} /> Early Bird ends in {daysLeft}d
                  </div>
                  <div className="text-emerald-500/70">{slotsRemaining} of {EARLY_BIRD_SLOTS} premium slots left</div>
                </div>
              )}
              <ul className="space-y-2.5 text-xs">
                {FEATURES.map((f, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    {f.free === true || typeof f.free === "string" ? (
                      <Check size={14} className="text-emerald-400 mt-0.5 shrink-0" />
                    ) : (
                      <span className="w-3.5 block mt-0.5 shrink-0" />
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

          {/* Premium Monthly */}
          <div className="glass-panel p-6 rounded-2xl border border-slate-800 relative flex flex-col">
            <div className="space-y-4 flex-1 flex flex-col">
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-violet-400">
                    <Zap size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Premium</h3>
                    <p className="text-xs text-slate-500">Monthly</p>
                  </div>
                </div>
                <div className="flex items-baseline gap-1 mb-4">
                  <span className="text-3xl font-display font-extrabold text-white">₹99</span>
                  <span className="text-xs text-slate-500">/month</span>
                </div>
              </div>
              <ul className="space-y-2.5 text-xs flex-1">
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
              <button
                onClick={() => handleSubscribe("monthly")}
                disabled={payLoading === "monthly" || currentUser?.is_premium}
                className="mt-4 w-full py-2.5 bg-violet-600 hover:bg-violet-500 disabled:bg-violet-800 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                {payLoading === "monthly" ? (
                  <><RefreshCw className="animate-spin" size={14} /> Processing...</>
                ) : currentUser?.is_premium ? (
                  "Already Premium"
                ) : (
                  "Subscribe ₹99/mo"
                )}
              </button>
            </div>
          </div>

          {/* Premium Annual (Recommended) */}
          <div className="glass-panel p-6 rounded-2xl border border-violet-500/30 relative flex flex-col overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-violet-600/10 blur-2xl pointer-events-none"></div>
            <div className="absolute top-3 right-3">
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-600 text-white font-bold uppercase tracking-wider">
                Best Value
              </span>
            </div>
            <div className="space-y-4 relative flex-1 flex flex-col">
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-xl bg-violet-950/40 text-violet-400">
                    <Zap size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Premium</h3>
                    <p className="text-xs text-slate-500">Annual (save 58%)</p>
                  </div>
                </div>
                <div className="flex items-baseline gap-1 mb-4">
                  <span className="text-3xl font-display font-extrabold text-white">₹499</span>
                  <span className="text-xs text-slate-500">/year</span>
                </div>
                <div className="text-[10px] text-emerald-400 font-semibold mb-4">
                  ₹42/month — equivalent to the old one-time price
                </div>
              </div>
              <ul className="space-y-2.5 text-xs flex-1">
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
              <button
                onClick={() => handleSubscribe("yearly")}
                disabled={payLoading === "yearly" || currentUser?.is_premium}
                className="mt-4 w-full py-2.5 bg-violet-600 hover:bg-violet-500 disabled:bg-violet-800 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                {payLoading === "yearly" ? (
                  <><RefreshCw className="animate-spin" size={14} /> Processing...</>
                ) : currentUser?.is_premium ? (
                  "Already Premium"
                ) : (
                  "Subscribe ₹499/yr"
                )}
              </button>
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
                {isEarlyBirdUser && currentUser.premium_expires_at && (
                  <span className="text-emerald-500/70">
                    — expires {new Date(currentUser.premium_expires_at).toLocaleDateString()}
                  </span>
                )}
                {isInternalTester && (
                  <span className="text-violet-400"> (internal tester)</span>
                )}
              </div>
            ) : currentUser ? (
              <form onSubmit={handleRedeemCoupon} className="space-y-3">
                <input
                  type="text"
                  value={coupon}
                  onChange={(e) => setCoupon(e.target.value)}
                  placeholder="Enter coupon code"
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
          <p>UPI payments only. No cards, no hidden fees.</p>
          <p className="mt-1">Payments processed securely by Razorpay.</p>
        </div>
      </div>
    </div>
  );
}
