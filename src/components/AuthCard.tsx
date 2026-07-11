"use client";

import React, { useState, useEffect } from "react";
import { dbService, UserProfile } from "@/lib/db";
import { Mail, Lock, User, Check, RefreshCw } from "lucide-react";

interface AuthCardProps {
  onSuccess: (profile: UserProfile) => void;
}

export default function AuthCard({ onSuccess }: AuthCardProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"student" | "parent">("student");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  
  // Early bird spots tracking
  const [premiumCount, setPremiumCount] = useState(0);
  const totalSlots = 100;
  const spotsRemaining = Math.max(0, totalSlots - premiumCount);

  useEffect(() => {
    // Fetch count of premium accounts
    dbService.getPremiumUserCount().then(setPremiumCount).catch(console.error);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      let profile: UserProfile;
      if (isSignUp) {
        profile = await dbService.signUp(email, password, role);
      } else {
        profile = await dbService.signIn(email, password);
      }
      onSuccess(profile);
    } catch (err: any) {
      setError(err.message || "An authentication error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError("");
    setLoading(true);
    try {
      const profile = await dbService.signInWithGoogle(role);
      onSuccess(profile);
    } catch (err: any) {
      setError(err.message || "Google Sign-In failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md glass-panel p-8 rounded-2xl relative overflow-hidden">
      {/* Background radial highlight */}
      <div className="absolute -top-24 -left-24 w-48 h-48 rounded-full bg-violet-600/10 blur-3xl pointer-events-none"></div>
      
      <div className="text-center mb-6 relative">
        <h2 className="text-3xl font-display font-bold tracking-tight text-white mb-2">
          {isSignUp ? "Create Account" : "Welcome to Acu"}
        </h2>
        <p className="text-slate-400 text-sm">
          {isSignUp 
            ? "Sign up to start mastering your syllabus" 
            : "Sign in to access your study desk"}
        </p>
      </div>

      {/* Early bird premium activation banner */}
      {isSignUp && (
        <div className="mb-6 p-4 rounded-xl border border-violet-500/20 bg-violet-950/20 text-center relative overflow-hidden">
          <div className="text-xs text-violet-400 font-semibold tracking-wider uppercase mb-1">
            🔥 Early Bird Beta Offer
          </div>
          {spotsRemaining > 0 ? (
            <div className="text-sm text-slate-300">
              The first <span className="font-bold text-violet-400">100 users</span> get auto-upgraded to the <span className="font-bold text-emerald-400">Premium Tier</span> for free.
              <div className="mt-2 text-xs font-medium text-emerald-400/90 flex items-center justify-center gap-1">
                <Check size={12} /> {spotsRemaining} free slots remaining!
              </div>
            </div>
          ) : (
            <div className="text-sm text-slate-300">
              Free beta slots are full. Premium upgrades now require a beta coupon code.
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="mb-6 p-3 rounded-lg border border-red-500/20 bg-red-950/30 text-red-400 text-xs text-center font-medium">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Student vs Parent Toggle (Only shown during Sign Up) */}
        {isSignUp && (
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              I am a:
            </label>
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-950/50 border border-slate-800 rounded-xl">
              <button
                type="button"
                onClick={() => setRole("student")}
                className={`py-2 px-4 rounded-lg text-sm font-medium transition-all ${
                  role === "student"
                    ? "bg-violet-600 text-white shadow-md shadow-violet-600/20"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                🎓 Student
              </button>
              <button
                type="button"
                onClick={() => setRole("parent")}
                className={`py-2 px-4 rounded-lg text-sm font-medium transition-all ${
                  role === "parent"
                    ? "bg-violet-600 text-white shadow-md shadow-violet-600/20"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                👥 Parent
              </button>
            </div>
          </div>
        )}

        {/* Email Field */}
        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Email Address
          </label>
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@domain.com"
              required
              className="w-full bg-slate-950/50 border border-slate-800 focus:border-violet-500 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white placeholder-slate-600 outline-none transition-colors"
            />
          </div>
        </div>

        {/* Password Field */}
        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Password
          </label>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full bg-slate-950/50 border border-slate-800 focus:border-violet-500 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white placeholder-slate-600 outline-none transition-colors"
            />
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-violet-600 hover:bg-violet-500 disabled:bg-violet-800 text-white rounded-xl py-2.5 font-medium text-sm transition-colors shadow-lg shadow-violet-600/20 flex items-center justify-center gap-2 mt-2 cursor-pointer"
        >
          {loading ? (
            <RefreshCw className="animate-spin" size={16} />
          ) : isSignUp ? (
            "Create Account"
          ) : (
            "Sign In"
          )}
        </button>
      </form>

      <div className="relative flex py-2 items-center">
        <div className="flex-grow border-t border-slate-900"></div>
        <span className="flex-shrink mx-4 text-[10px] text-slate-500 uppercase tracking-widest font-bold">Or</span>
        <div className="flex-grow border-t border-slate-900"></div>
      </div>

      <button
        type="button"
        disabled={loading}
        onClick={handleGoogleSignIn}
        className="w-full py-2.5 bg-slate-950 hover:bg-slate-900 border border-slate-800 text-slate-300 hover:text-white rounded-xl text-xs font-semibold tracking-wide transition-all cursor-pointer flex items-center justify-center gap-2"
      >
        <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
          <path
            fill="currentColor"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="currentColor"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="currentColor"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
          />
          <path
            fill="currentColor"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
          />
        </svg>
        {isSignUp ? "Continue with Google" : "Sign In with Google"}
      </button>

      {/* Switch Mode Link */}
      <div className="mt-6 text-center text-xs text-slate-500">
        {isSignUp ? "Already have an account?" : "New to Acu?"}{" "}
        <button
          type="button"
          onClick={() => {
            setIsSignUp(!isSignUp);
            setError("");
          }}
          className="text-violet-400 hover:text-violet-300 font-medium underline outline-none"
        >
          {isSignUp ? "Sign In Here" : "Register Free"}
        </button>
      </div>
    </div>
  );
}
