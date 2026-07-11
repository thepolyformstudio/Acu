"use client";

import React, { useState, useEffect } from "react";
import { dbService, UserProfile } from "@/lib/db";
import { Key, Globe, Gift, Check, ShieldAlert, Sparkles, RefreshCw, Cloud, CloudOff, AlertTriangle } from "lucide-react";
import { 
  initGoogleDrive, signInToDrive, signOutFromDrive, isDriveSignedIn, 
  isDriveConfigured, getDriveSyncStatus, onDriveSyncStatusChange 
} from "@/lib/googleDrive";

interface SettingsPanelProps {
  user: UserProfile;
  onRefresh: () => void;
}

export default function SettingsPanel({ user, onRefresh }: SettingsPanelProps) {
  const [geminiKey, setGeminiKey] = useState("");
  const [clientId, setClientId] = useState("");
  const [devKey, setDevKey] = useState("");
  
  const [coupon, setCoupon] = useState("");
  const [couponSuccess, setCouponSuccess] = useState(false);
  const [couponError, setCouponError] = useState("");
  const [couponLoading, setCouponLoading] = useState(false);
  
  const [keysSaved, setKeysSaved] = useState(false);

  // Google Drive connection state
  const [driveConnected, setDriveConnected] = useState(false);
  const [driveConnecting, setDriveConnecting] = useState(false);
  const [driveSyncStatus, setDriveSyncStatus] = useState(getDriveSyncStatus());

  useEffect(() => {
    // Load existing settings from localStorage
    if (typeof window !== "undefined") {
      setGeminiKey(localStorage.getItem("acu_gemini_api_key") || "");
      setClientId(localStorage.getItem("acu_google_client_id") || "");
      setDevKey(localStorage.getItem("acu_google_dev_key") || "");
      setDriveConnected(isDriveSignedIn());
    }
    const unsub = onDriveSyncStatusChange(setDriveSyncStatus);
    return unsub;
  }, []);

  const handleSaveKeys = (e: React.FormEvent) => {
    e.preventDefault();
    if (typeof window !== "undefined") {
      localStorage.setItem("acu_gemini_api_key", geminiKey.trim());
      localStorage.setItem("acu_google_client_id", clientId.trim());
      localStorage.setItem("acu_google_dev_key", devKey.trim());
    }
    setKeysSaved(true);
    setTimeout(() => setKeysSaved(false), 3000);
  };

  const handleClearKeys = () => {
    if (typeof window !== "undefined" && confirm("Are you sure you want to delete all saved API keys? This will disconnect Google Drive imports.")) {
      localStorage.removeItem("acu_gemini_api_key");
      localStorage.removeItem("acu_google_client_id");
      localStorage.removeItem("acu_google_dev_key");
      signOutFromDrive();
      setGeminiKey("");
      setClientId("");
      setDevKey("");
      setDriveConnected(false);
    }
  };

  const handleConnectDrive = async () => {
    if (!clientId.trim()) {
      alert("Please save your Google OAuth Client ID first before connecting Drive.");
      return;
    }
    setDriveConnecting(true);
    try {
      localStorage.setItem("acu_google_client_id", clientId.trim());
      await initGoogleDrive();
      const ok = await signInToDrive();
      setDriveConnected(ok);
    } catch (err: any) {
      alert("Failed to connect Google Drive: " + (err.message || String(err)));
    } finally {
      setDriveConnecting(false);
    }
  };

  const handleDisconnectDrive = () => {
    if (confirm("Disconnect Google Drive? Your local data will remain, but Drive sync will stop.")) {
      signOutFromDrive();
      setDriveConnected(false);
    }
  };

  const handleRedeemCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!coupon.trim()) return;

    setCouponError("");
    setCouponSuccess(false);
    setCouponLoading(true);

    try {
      await dbService.applyCoupon(user.id, coupon);
      setCouponSuccess(true);
      setCoupon("");
      onRefresh(); // Refresh user state in parent page.tsx
    } catch (err: any) {
      setCouponError(err.message || "Invalid coupon code.");
    } finally {
      setCouponLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto pb-12">
      {/* Page Title */}
      <div>
        <h2 className="text-2xl sm:text-3xl font-display font-bold text-white mb-1">Settings & Configurations</h2>
        <p className="text-slate-400 text-sm">Manage your private API credentials and account details.</p>
      </div>

      {/* API Key Box */}
      <div className="glass-panel p-6 rounded-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-violet-600/5 blur-2xl pointer-events-none"></div>
        
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-xl bg-violet-950/40 text-violet-400">
            <Key size={20} />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">Gemini API Credentials</h3>
            <p className="text-xs text-slate-500">Provide your own key to power note generation and grading.</p>
          </div>
        </div>

        <form onSubmit={handleSaveKeys} className="space-y-4">
          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Gemini API Key
              </label>
              <a 
                href="https://aistudio.google.com/" 
                target="_blank" 
                rel="noreferrer" 
                className="text-[10px] text-violet-400 hover:underline"
              >
                Get a free key from Google AI Studio ➔
              </a>
            </div>
            <input
              type="password"
              value={geminiKey}
              onChange={(e) => setGeminiKey(e.target.value)}
              placeholder="Paste your AI Studio API key here"
              className="w-full bg-slate-950/50 border border-slate-800 focus:border-violet-500 rounded-xl py-2.5 px-4 text-sm text-white placeholder-slate-700 outline-none transition-colors"
            />
          </div>

          <div className="p-4 rounded-xl border border-slate-850 bg-slate-950/40 text-left text-xs space-y-2">
            <h4 className="font-semibold text-white flex items-center gap-1.5">
              <Sparkles size={14} className="text-violet-400" />
              How to get your free Gemini API Key:
            </h4>
            <ol className="list-decimal list-inside space-y-2 text-slate-400">
              <li>
                Navigate to <a href="https://aistudio.google.com/" target="_blank" rel="noreferrer" className="text-violet-400 hover:underline">Google AI Studio</a>.
              </li>
              <li>
                Sign in using your personal or school Google Account.
              </li>
              <li>
                Click on the blue <span className="text-white font-semibold">"Get API key"</span> link in the left-hand navigation sidebar.
              </li>
              <li>
                Select <span className="text-white font-semibold">"Create API key"</span>. You can choose to generate it in a new Google Cloud project.
              </li>
              <li>
                Copy the generated key (usually starts with <code className="text-violet-300 font-mono text-[10px]">AIzaSy...</code>) and paste it into the password box above.
              </li>
            </ol>
            <p className="text-[10px] text-slate-500 pt-1">
              💡 **Pricing Note:** The default AI Studio tier is **free of charge** (zero cost) and provides plenty of API quota for student revision tasks!
            </p>
          </div>

          <div className="border-t border-slate-900 my-4 pt-4"></div>

          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-xl bg-violet-950/40 text-violet-400">
              <Globe size={20} />
            </div>
            <div className="flex-1">
              <h3 className="text-base font-semibold text-white">Google Drive Backup</h3>
              <p className="text-xs text-slate-500">Store your uploaded files, notes, and exam history in your own Google Drive.</p>
            </div>
            {driveConnected && (
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/40 border border-emerald-500/20 text-emerald-400 text-[10px] font-semibold uppercase">
                <Cloud size={12} /> Connected
              </div>
            )}
          </div>

          {/* Privacy notice */}
          <div className="p-3 rounded-xl border border-slate-850 bg-slate-950/40 text-left text-xs space-y-1.5">
            <p className="text-slate-400">
              <span className="font-semibold text-white">Your data stays yours.</span>{" "}
              We do not store any of your uploaded file content or AI-generated notes on our servers. 
              All study materials are kept in your browser&apos;s local storage. 
              To preserve your data across devices and browser sessions, connect your Google Drive below — 
              your files, notes, and exam history will be backed up to a private <code className="text-violet-300 font-mono text-[10px]">SmartGuide/</code> folder in your own Drive.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Google OAuth Client ID
              </label>
              <input
                type="text"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder="Client ID from Google Cloud"
                className="w-full bg-slate-950/50 border border-slate-800 focus:border-violet-500 rounded-xl py-2.5 px-4 text-xs text-white placeholder-slate-700 outline-none transition-colors"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Google Developer Key
              </label>
              <input
                type="password"
                value={devKey}
                onChange={(e) => setDevKey(e.target.value)}
                placeholder="Developer API Key"
                className="w-full bg-slate-950/50 border border-slate-800 focus:border-violet-500 rounded-xl py-2.5 px-4 text-xs text-white placeholder-slate-700 outline-none transition-colors"
              />
            </div>
          </div>

          <div className="p-4 rounded-xl border border-slate-850 bg-slate-950/40 text-left text-xs space-y-2">
            <h4 className="font-semibold text-white flex items-center gap-1.5">
              <Sparkles size={14} className="text-violet-400" />
              How to get your Google Drive credentials:
            </h4>
            <ol className="list-decimal list-inside space-y-2 text-slate-400">
              <li>
                Go to <a href="https://console.cloud.google.com/" target="_blank" rel="noreferrer" className="text-violet-400 hover:underline">Google Cloud Console</a>.
              </li>
              <li>
                Sign in and create a <span className="text-white font-semibold">new project</span> (or select an existing one) from the project dropdown at the top of the page.
              </li>
              <li>
                In the left sidebar, navigate to <span className="text-white font-semibold">APIs & Services &gt; Library</span>, search for <span className="text-white font-semibold">"Google Drive API"</span>, and click <span className="text-white font-semibold">Enable</span>.
              </li>
              <li>
                Go to <span className="text-white font-semibold">APIs & Services &gt; Credentials</span> and click <span className="text-white font-semibold">"+ Create Credentials"</span>, then select <span className="text-white font-semibold">"OAuth client ID"</span>.
              </li>
              <li>
                If prompted, configure the <span className="text-white font-semibold">OAuth consent screen</span> first (choose <span className="text-white font-semibold">External</span>, fill in the app name, and add your email as a test user), then return to create the OAuth client ID.
              </li>
              <li>
                Choose <span className="text-white font-semibold">"Web application"</span> as the application type. Under <span className="text-white font-semibold">"Authorized JavaScript origins"</span>, add your site&apos;s URL (e.g. <code className="text-violet-300 font-mono text-[10px]">http://localhost:3000</code> for local testing).
              </li>
              <li>
                Copy the <span className="text-white font-semibold">Client ID</span> (ends with <code className="text-violet-300 font-mono text-[10px]">.apps.googleusercontent.com</code>) and paste it into the field above.
              </li>
              <li>
                Back on the <span className="text-white font-semibold">Credentials</span> page, click <span className="text-white font-semibold">"+ Create Credentials"</span> again and select <span className="text-white font-semibold">"API key"</span>. Copy the generated key and paste it into the <span className="text-white font-semibold">Developer Key</span> field above.
              </li>
            </ol>
            <p className="text-[10px] text-slate-500 pt-1">
              💡 Both credentials are stored locally in your browser and are never sent to any third-party server.
            </p>
          </div>

          <div className="flex items-center gap-3 pt-2 flex-wrap">
            <button
              type="submit"
              className="px-6 py-2.5 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5"
            >
              {keysSaved ? <Check size={14} /> : null}
              {keysSaved ? "Saved Successfully!" : "Save Keys"}
            </button>
            <button
              type="button"
              onClick={handleClearKeys}
              className="px-4 py-2.5 bg-transparent hover:bg-red-950/20 text-red-500 border border-red-500/20 hover:border-red-500/30 rounded-xl text-xs font-medium transition-colors cursor-pointer"
            >
              Delete Keys
            </button>

            {/* Drive Connect / Disconnect */}
            <div className="ml-auto">
              {driveConnected ? (
                <div className="flex items-center gap-2">
                  {driveSyncStatus.syncing && (
                    <span className="text-[10px] text-violet-400 flex items-center gap-1">
                      <RefreshCw className="animate-spin" size={10} /> Syncing...
                    </span>
                  )}
                  {driveSyncStatus.error && (
                    <span className="text-[10px] text-red-400 flex items-center gap-1" title={driveSyncStatus.error}>
                      <AlertTriangle size={10} /> Sync error
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={handleDisconnectDrive}
                    className="px-4 py-2.5 bg-transparent hover:bg-slate-900 text-slate-400 border border-slate-800 hover:border-slate-600 rounded-xl text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <CloudOff size={14} /> Disconnect Drive
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleConnectDrive}
                  disabled={driveConnecting || !clientId.trim()}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 disabled:opacity-50 text-white rounded-xl text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  {driveConnecting ? <RefreshCw className="animate-spin" size={14} /> : <Cloud size={14} />}
                  {driveConnecting ? "Connecting..." : "Connect Google Drive"}
                </button>
              )}
            </div>
          </div>
        </form>
      </div>

      {/* Monetization / Coupon Panel */}
      <div className="glass-panel p-6 rounded-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 blur-2xl pointer-events-none"></div>

        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-xl bg-emerald-950/40 text-emerald-400">
            <Gift size={20} />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">Premium Tier Activation</h3>
            <p className="text-xs text-slate-500">Activate premium features or check your subscription.</p>
          </div>
        </div>

        {user.is_premium ? (
          <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-950/10 flex items-start gap-3">
            <div className="p-1 rounded-full bg-emerald-500/20 text-emerald-400 mt-0.5">
              <Check size={14} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                Premium License Active <Sparkles size={14} className="text-amber-400" />
              </h4>
              <p className="text-xs text-slate-400 mt-1">
                You have unlimited local file uploads, full Google Drive picker integrations, automated backups, and detailed Bloom's cognitive score reports.
              </p>
              {user.coupon_applied && (
                <div className="mt-2 text-[10px] text-emerald-400/80 font-medium">
                  Status: Activated via code ({user.coupon_applied})
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-950/10 flex items-start gap-3">
              <ShieldAlert className="text-amber-500 mt-0.5 shrink-0" size={16} />
              <div>
                <h4 className="text-sm font-bold text-white">Free Account Limits</h4>
                <p className="text-xs text-slate-400 mt-1">
                  You are currently using the Free Tier (max 2 documents, basic quizzes). Redeeming a coupon code upgrades your account to premium instantly.
                </p>
              </div>
            </div>

            <form onSubmit={handleRedeemCoupon} className="flex gap-2">
              <div className="flex-1">
                <input
                  type="text"
                  value={coupon}
                  onChange={(e) => setCoupon(e.target.value)}
                  placeholder="Enter Coupon Code (e.g. ACUBETA)"
                  required
                  className="w-full bg-slate-950/50 border border-slate-800 focus:border-violet-500 rounded-xl py-2 px-3 text-xs text-white placeholder-slate-700 outline-none transition-colors"
                />
              </div>
              <button
                type="submit"
                disabled={couponLoading}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 text-white rounded-xl text-xs font-medium transition-colors cursor-pointer flex items-center gap-1"
              >
                {couponLoading ? <RefreshCw className="animate-spin" size={12} /> : null}
                Redeem
              </button>
            </form>

            {couponSuccess && (
              <div className="p-3 rounded-lg border border-emerald-500/20 bg-emerald-950/30 text-emerald-400 text-xs text-center font-medium">
                Success! Premium Tier has been activated!
              </div>
            )}

            {couponError && (
              <div className="p-3 rounded-lg border border-red-500/20 bg-red-950/30 text-red-400 text-xs text-center font-medium">
                {couponError}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
