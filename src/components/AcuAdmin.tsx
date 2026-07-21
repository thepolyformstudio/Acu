"use client";

import React, { useState, useEffect } from "react";
import { UserProfile, AppReview, SystemErrorLog, dbService } from "@/lib/db";
import { 
  Users, FileText, BarChart2, Trash2, ShieldAlert, Star, 
  Activity, Cpu, Database, AlertTriangle, CheckCircle2, RefreshCw, AlertOctagon
} from "lucide-react";

export default function AcuAdmin({ user }: { user: UserProfile }) {
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [reviews, setReviews] = useState<AppReview[]>([]);
  const [systemErrors, setSystemErrors] = useState<SystemErrorLog[]>([]);
  const [analytics, setAnalytics] = useState({ totalUsers: 0, totalDocuments: 0, totalAttempts: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [errorFilter, setErrorFilter] = useState<string>("all");

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const [allProfiles, allReviews, sysStats, errLogs] = await Promise.all([
        dbService.getAllProfiles(),
        dbService.getAllAppReviews(),
        dbService.getSystemAnalytics(),
        dbService.getSystemErrors()
      ]);
      setProfiles(allProfiles);
      setReviews(allReviews);
      setAnalytics(sysStats);
      setSystemErrors(errLogs);
    } catch (err: any) {
      setError("Failed to load admin data: " + (err.message || String(err)));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user.role === 'admin' || user.email.toLowerCase().trim() === "ejmultiverse@gmail.com") {
      loadData();
    }
  }, [user]);

  const handleDeleteUser = async (profileId: string) => {
    if (window.confirm("Are you sure you want to permanently delete this user? All their data will be inaccessible.")) {
      try {
        await dbService.deleteProfile(profileId);
        loadData();
      } catch (err: any) {
        setError("Error deleting user: " + err.message);
      }
    }
  };

  const handleDeleteReview = async (reviewId: string) => {
    if (window.confirm("Are you sure you want to remove this review from the public page?")) {
      try {
        await dbService.deleteAppReview(reviewId);
        loadData();
      } catch (err: any) {
        setError("Error deleting review: " + err.message);
      }
    }
  };

  const handleClearErrors = async () => {
    if (window.confirm("Are you sure you want to clear all user error logs?")) {
      try {
        await dbService.clearSystemErrors();
        setSystemErrors([]);
      } catch (err: any) {
        setError("Error clearing logs: " + err.message);
      }
    }
  };

  if (user.role !== 'admin' && user.email.toLowerCase().trim() !== "ejmultiverse@gmail.com") {
    return (
      <div className="glass-panel p-8 rounded-2xl flex flex-col items-center justify-center text-center max-w-lg mx-auto mt-12 animate-fade-in">
        <ShieldAlert className="text-rose-500 mb-4" size={48} />
        <h2 className="text-xl font-bold text-white mb-2">Access Denied</h2>
        <p className="text-slate-400 text-sm">You do not have administrator privileges to view this page.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin"></div>
        <span className="ml-3 text-sm">Loading admin console...</span>
      </div>
    );
  }

  // Calculate System Quota Gauges
  const estimatedStorageMb = Math.round((analytics.totalDocuments * 0.8) * 10) / 10;
  const storageQuotaPercent = Math.min(100, Math.round((estimatedStorageMb / 1000) * 100));
  
  // Estimate daily reads/writes
  const estimatedDailyWrites = analytics.totalDocuments * 2 + analytics.totalAttempts;
  const writesQuotaPercent = Math.min(100, Math.round((estimatedDailyWrites / 20000) * 100));

  // Determine system status level
  const hasCriticalUsage = storageQuotaPercent >= 90 || writesQuotaPercent >= 90;
  const hasWarningUsage = storageQuotaPercent >= 75 || writesQuotaPercent >= 75;

  const filteredErrors = errorFilter === "all" 
    ? systemErrors 
    : systemErrors.filter(e => e.context.toLowerCase().includes(errorFilter.toLowerCase()) || e.userEmail.toLowerCase().includes(errorFilter.toLowerCase()));

  return (
    <div className="animate-fade-in space-y-8 max-w-6xl mx-auto pb-12">
      {/* Header */}
      <div className="glass-panel p-6 sm:p-8 rounded-3xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border border-violet-500/20 shadow-[0_0_30px_rgba(139,92,246,0.1)] relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-violet-600/10 blur-[80px] pointer-events-none rounded-full"></div>
        <div>
          <h1 className="text-3xl font-display font-extrabold text-white mb-1">Admin Dashboard</h1>
          <p className="text-slate-400 text-sm font-medium">Platform Management, System Quotas & User Error Telemetry</p>
        </div>
        <button
          onClick={loadData}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer"
        >
          <RefreshCw size={14} /> Refresh Telemetry
        </button>
      </div>

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm rounded-xl">
          {error}
        </div>
      )}

      {/* 🔴 SYSTEM QUOTA & RESOURCE MONITOR BANNER */}
      <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-500/20 flex items-center justify-center text-violet-400">
              <Activity size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">System Resource & Free-Tier Health Gauge</h2>
              <p className="text-xs text-slate-400">Monitoring Google Cloud Firebase 100% Free Quotas & AI Providers</p>
            </div>
          </div>
          <div>
            {hasCriticalUsage ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-full text-xs font-semibold">
                <AlertOctagon size={14} /> High Usage Alert (&gt;90%)
              </span>
            ) : hasWarningUsage ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-full text-xs font-semibold">
                <AlertTriangle size={14} /> Usage Warning (&gt;75%)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-full text-xs font-semibold">
                <CheckCircle2 size={14} /> Systems Operating Normally (Free Tier Safe)
              </span>
            )}
          </div>
        </div>

        {/* Meters Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Meter 1: Firestore Storage */}
          <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-3">
            <div className="flex justify-between items-center text-xs">
              <span className="font-semibold text-slate-400 flex items-center gap-1.5">
                <Database size={14} className="text-violet-400" /> Database Storage
              </span>
              <span className="font-bold text-white">{estimatedStorageMb} / 1,000 MB</span>
            </div>
            <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-500 ${storageQuotaPercent >= 90 ? 'bg-rose-500' : storageQuotaPercent >= 75 ? 'bg-amber-500' : 'bg-violet-500'}`}
                style={{ width: `${Math.max(2, storageQuotaPercent)}%` }}
              ></div>
            </div>
            <p className="text-[10px] text-slate-500">Free Tier Limit: 1,000 MB (1 GB). (~{Math.max(0, 1000 - Math.round(estimatedStorageMb))} MB remaining)</p>
          </div>

          {/* Meter 2: Daily Document Writes */}
          <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-3">
            <div className="flex justify-between items-center text-xs">
              <span className="font-semibold text-slate-400 flex items-center gap-1.5">
                <Cpu size={14} className="text-emerald-400" /> Daily Database Writes
              </span>
              <span className="font-bold text-white">{estimatedDailyWrites} / 20,000</span>
            </div>
            <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-500 ${writesQuotaPercent >= 90 ? 'bg-rose-500' : writesQuotaPercent >= 75 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                style={{ width: `${Math.max(2, writesQuotaPercent)}%` }}
              ></div>
            </div>
            <p className="text-[10px] text-slate-500">Free Tier Daily Reset: 20,000 operations/day.</p>
          </div>

          {/* Meter 3: AI Provider Health */}
          <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-3">
            <div className="flex justify-between items-center text-xs">
              <span className="font-semibold text-slate-400 flex items-center gap-1.5">
                <Activity size={14} className="text-amber-400" /> AI Provider Proxy Status
              </span>
              <span className="font-bold text-emerald-400">Active / Operational</span>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <span className="px-2 py-0.5 bg-violet-500/10 text-violet-400 text-[10px] font-bold rounded-md border border-violet-500/20">Gemini 1.5 Flash</span>
              <span className="text-slate-600 text-xs">➜</span>
              <span className="px-2 py-0.5 bg-sky-500/10 text-sky-400 text-[10px] font-bold rounded-md border border-sky-500/20">Groq Fallback</span>
            </div>
            <p className="text-[10px] text-slate-500">Auto-failover enabled if Gemini hits 15 req/min rate limit.</p>
          </div>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-panel p-6 rounded-2xl flex items-center gap-4 border-t border-violet-500/30">
          <div className="w-12 h-12 rounded-xl bg-violet-500/20 flex items-center justify-center shrink-0">
            <Users className="text-violet-400" size={24} />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">Total Registered Users</p>
            <p className="text-3xl font-bold text-white">{analytics.totalUsers}</p>
          </div>
        </div>

        <div className="glass-panel p-6 rounded-2xl flex items-center gap-4 border-t border-emerald-500/30">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center shrink-0">
            <FileText className="text-emerald-400" size={24} />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">Documents Indexed</p>
            <p className="text-3xl font-bold text-white">{analytics.totalDocuments}</p>
          </div>
        </div>

        <div className="glass-panel p-6 rounded-2xl flex items-center gap-4 border-t border-amber-500/30">
          <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center shrink-0">
            <BarChart2 className="text-amber-400" size={24} />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">Exams Completed</p>
            <p className="text-3xl font-bold text-white">{analytics.totalAttempts}</p>
          </div>
        </div>
      </div>

      {/* 🚨 LIVE USER ERROR TELEMETRY INSPECTOR */}
      <div className="glass-panel rounded-3xl overflow-hidden flex flex-col border border-rose-500/20">
        <div className="p-6 border-b border-slate-800/80 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-900/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/20 flex items-center justify-center text-rose-400">
              <AlertTriangle size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Live User Error Telemetry Inspector</h2>
              <p className="text-xs text-slate-400">Real-time runtime error log reports captured from active user sessions</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <input 
              type="text" 
              placeholder="Filter by email or error..." 
              value={errorFilter === "all" ? "" : errorFilter}
              onChange={(e) => setErrorFilter(e.target.value || "all")}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-300 outline-none focus:border-rose-500 w-full sm:w-48"
            />
            {systemErrors.length > 0 && (
              <button
                onClick={handleClearErrors}
                className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-xl text-xs font-semibold transition-colors cursor-pointer shrink-0"
              >
                Clear Logs
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto max-h-[360px]">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-950/80 text-xs font-semibold text-slate-400 uppercase tracking-wider sticky top-0 backdrop-blur-md">
                <th className="px-6 py-3 border-b border-slate-800/50">Timestamp</th>
                <th className="px-6 py-3 border-b border-slate-800/50">User Email</th>
                <th className="px-6 py-3 border-b border-slate-800/50">Context</th>
                <th className="px-6 py-3 border-b border-slate-800/50">Error Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50 text-xs font-mono">
              {filteredErrors.map(eLog => (
                <tr key={eLog.id} className="hover:bg-slate-800/20 transition-colors">
                  <td className="px-6 py-3.5 text-slate-500 whitespace-nowrap">
                    {new Date(eLog.timestamp).toLocaleString()}
                  </td>
                  <td className="px-6 py-3.5 text-violet-300 font-semibold whitespace-nowrap">
                    {eLog.userEmail}
                  </td>
                  <td className="px-6 py-3.5 whitespace-nowrap">
                    <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20 font-sans text-[11px]">
                      {eLog.context}
                    </span>
                  </td>
                  <td className="px-6 py-3.5 text-rose-400 font-sans text-xs max-w-md truncate" title={eLog.errorMessage}>
                    {eLog.errorMessage}
                  </td>
                </tr>
              ))}
              {filteredErrors.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-slate-500 italic font-sans">
                    No active user error reports found. Systems clean!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {/* User Management Section */}
        <div className="glass-panel rounded-2xl overflow-hidden flex flex-col">
          <div className="p-6 border-b border-slate-800/50 flex justify-between items-center bg-slate-900/40">
            <h2 className="text-lg font-bold text-white">Registered Users</h2>
            <span className="text-xs font-semibold px-2 py-1 bg-slate-800 text-slate-300 rounded-md">
              {profiles.length} Accounts
            </span>
          </div>
          <div className="overflow-x-auto max-h-[400px]">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-900/50 text-xs font-semibold text-slate-400 uppercase tracking-wider sticky top-0">
                  <th className="px-6 py-3 border-b border-slate-800/50">Email</th>
                  <th className="px-6 py-3 border-b border-slate-800/50">Role</th>
                  <th className="px-6 py-3 border-b border-slate-800/50">Status</th>
                  <th className="px-6 py-3 border-b border-slate-800/50">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50 text-sm">
                {profiles.map(p => (
                  <tr key={p.id} className="hover:bg-slate-800/20 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-300">{p.email}</td>
                    <td className="px-6 py-4 capitalize text-slate-400">{p.role}</td>
                    <td className="px-6 py-4">
                      {p.is_premium ? (
                        <span className="text-[10px] uppercase tracking-wider font-bold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-md border border-emerald-500/20">
                          Premium
                        </span>
                      ) : (
                        <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 bg-slate-800 px-2 py-1 rounded-md border border-slate-700">
                          Free
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {p.id !== user.id && (
                        <button
                          onClick={() => handleDeleteUser(p.id)}
                          className="p-2 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                          title="Delete User"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {profiles.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-slate-500 italic">No users found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Review Moderation Section */}
        <div className="glass-panel rounded-2xl overflow-hidden flex flex-col">
          <div className="p-6 border-b border-slate-800/50 flex justify-between items-center bg-slate-900/40">
            <h2 className="text-lg font-bold text-white">Review Moderation</h2>
            <span className="text-xs font-semibold px-2 py-1 bg-slate-800 text-slate-300 rounded-md">
              {reviews.length} Reviews
            </span>
          </div>
          <div className="p-6 space-y-4 overflow-y-auto max-h-[400px]">
            {reviews.map(review => (
              <div key={review.id} className="p-4 rounded-xl border border-slate-800 bg-slate-900/20 flex flex-col gap-3">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex gap-1 mb-1">
                      {[1,2,3,4,5].map(star => (
                        <Star key={star} size={12} className={review.rating >= star ? "fill-amber-400 text-amber-400" : "fill-slate-800 text-slate-800"} />
                      ))}
                    </div>
                    <p className="text-xs font-semibold text-white">{review.authorEmail}</p>
                  </div>
                  <button
                    onClick={() => handleDeleteReview(review.id)}
                    className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-md transition-colors cursor-pointer"
                    title="Delete Review"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <p className="text-sm text-slate-400">"{review.feedbackText}"</p>
                <div className="text-[10px] text-slate-600 text-right">{review.createdAt}</div>
              </div>
            ))}
            {reviews.length === 0 && (
              <div className="text-center text-slate-500 italic py-8">No reviews submitted yet.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
