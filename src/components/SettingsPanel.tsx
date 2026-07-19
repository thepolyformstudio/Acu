"use client";

import React, { useState, useEffect } from "react";
import { UserProfile } from "@/lib/db";
import { Check, Cloud, CloudOff, RefreshCw, AlertTriangle, Sparkles, Gift } from "lucide-react";
import { 
  signInToDrive, signOutFromDrive, isDriveSignedIn, 
  getDriveSyncStatus, onDriveSyncStatusChange 
} from "@/lib/googleDrive";
import { safeError, logError } from "@/lib/errors";

interface SettingsPanelProps {
  user: UserProfile;
}

export default function SettingsPanel({ user }: SettingsPanelProps) {
  const [driveConnected, setDriveConnected] = useState(() =>
    typeof window !== "undefined" ? isDriveSignedIn() : false
  );
  const [driveConnecting, setDriveConnecting] = useState(false);
  const [driveSyncStatus, setDriveSyncStatus] = useState(getDriveSyncStatus());

  const isInternalTester = user.coupon_applied === "INTERNAL_TESTER";

  useEffect(() => {
    const unsub = onDriveSyncStatusChange(setDriveSyncStatus);
    return unsub;
  }, []);

  const handleConnectDrive = async () => {
    setDriveConnecting(true);
    try {
      const ok = await signInToDrive();
      setDriveConnected(ok);
      if (!ok) {
        alert("Google Drive sign-in was cancelled or failed. Please try again.");
      }
    } catch (err) {
      logError("Drive connection", err);
      alert(safeError(err, "Failed to connect Google Drive."));
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

  return (
    <div className="space-y-6 max-w-2xl mx-auto pb-12">
      {/* Page Title */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-900 pb-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-display font-bold text-white mb-1">Settings</h2>
          <p className="text-slate-400 text-sm">Manage your account and data preferences.</p>
        </div>
      </div>

      {/* Account Info */}
      <div className="glass-panel p-6 rounded-2xl relative overflow-hidden">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-xl bg-violet-950/40 text-violet-400">
            <Sparkles size={20} />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">Account</h3>
            <p className="text-xs text-slate-500">{user.email}</p>
          </div>
        </div>

        {user.is_premium ? (
          <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-950/10 flex items-start gap-3">
            <div className="p-1 rounded-full bg-emerald-500/20 text-emerald-400 mt-0.5">
              <Check size={14} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                Premium Active <Sparkles size={14} className="text-amber-400" />
              </h4>
              <p className="text-xs text-slate-400 mt-1">
                Unlimited documents, full grading, Bloom&apos;s analytics, and cross-device sync.
              </p>
              {isInternalTester && (
                <div className="mt-2 text-[10px] text-violet-400/80 font-medium">
                  Internal tester account — no billing.
                </div>
              )}
              {user.coupon_applied === "BETA_EARLY_BIRD" && user.premium_expires_at && (
                <div className="mt-2 text-[10px] text-amber-400/80 font-medium">
                  Early bird access — expires {new Date(user.premium_expires_at).toLocaleDateString()}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-950/10 flex items-start gap-3">
            <Gift className="text-amber-500 mt-0.5 shrink-0" size={16} />
            <div>
              <h4 className="text-sm font-bold text-white">Free Account</h4>
              <p className="text-xs text-slate-400 mt-1">
                Limited to 2 documents. Upgrade to Premium for unlimited access across all your devices.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Google Drive Section */}
      <div className="glass-panel p-6 rounded-2xl relative overflow-hidden">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-xl bg-violet-950/40 text-violet-400">
            <Cloud size={20} />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-semibold text-white">Google Drive Backup</h3>
            <p className="text-xs text-slate-500">Extra backup of your files in your own Google Drive.</p>
          </div>
          {driveConnected && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/40 border border-emerald-500/20 text-emerald-400 text-[10px] font-semibold uppercase">
              <Cloud size={12} /> Connected
            </div>
          )}
        </div>

        <div className="p-3 rounded-xl border border-slate-850 bg-slate-950/40 text-left text-xs space-y-1.5 mb-4">
          <p className="text-slate-400">
            <span className="font-semibold text-white">Your data stays yours.</span>{" "}
            Your textbooks and study materials are stored securely in the cloud and synced across your devices. 
            AI is powered by our server-side multi-provider proxy (Gemini + Groq). 
            You can optionally back up to your own Google Drive for an extra copy.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
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
                onClick={handleDisconnectDrive}
                className="px-4 py-2 bg-transparent hover:bg-slate-900 text-slate-400 border border-slate-800 hover:border-slate-600 rounded-xl text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <CloudOff size={14} /> Disconnect Drive
              </button>
            </div>
          ) : (
            <button
              onClick={handleConnectDrive}
              disabled={driveConnecting}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 disabled:opacity-50 text-white rounded-xl text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5"
            >
              {driveConnecting ? <RefreshCw className="animate-spin" size={14} /> : <Cloud size={14} />}
              {driveConnecting ? "Connecting..." : "Connect Google Drive"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
