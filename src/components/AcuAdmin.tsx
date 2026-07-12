import React, { useState, useEffect } from "react";
import { UserProfile, AppReview, dbService } from "@/lib/db";
import { Users, FileText, BarChart2, Trash2, ShieldAlert, Star } from "lucide-react";

export default function AcuAdmin({ user }: { user: UserProfile }) {
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [reviews, setReviews] = useState<AppReview[]>([]);
  const [analytics, setAnalytics] = useState({ totalUsers: 0, totalDocuments: 0, totalAttempts: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadData = async () => {
    setLoading(true);
    try {
      const [allProfiles, allReviews, sysStats] = await Promise.all([
        dbService.getAllProfiles(),
        dbService.getAllAppReviews(),
        dbService.getSystemAnalytics()
      ]);
      setProfiles(allProfiles);
      setReviews(allReviews);
      setAnalytics(sysStats);
    } catch (err: any) {
      setError("Failed to load admin data: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user.role === 'admin') {
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

  if (user.role !== 'admin') {
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

  return (
    <div className="animate-fade-in space-y-8 max-w-6xl mx-auto pb-12">
      {/* Header */}
      <div className="glass-panel p-6 sm:p-8 rounded-3xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border border-violet-500/20 shadow-[0_0_30px_rgba(139,92,246,0.1)] relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-violet-600/10 blur-[80px] pointer-events-none rounded-full"></div>
        <div>
          <h1 className="text-3xl font-display font-extrabold text-white mb-1">Admin Dashboard</h1>
          <p className="text-slate-400 text-sm font-medium">Platform Management & Moderation Center</p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm rounded-xl">
          {error}
        </div>
      )}

      {/* KPI Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-panel p-6 rounded-2xl flex items-center gap-4 border-t border-violet-500/30">
          <div className="w-12 h-12 rounded-xl bg-violet-500/20 flex items-center justify-center shrink-0">
            <Users className="text-violet-400" size={24} />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">Total Users</p>
            <p className="text-3xl font-bold text-white">{analytics.totalUsers}</p>
          </div>
        </div>

        <div className="glass-panel p-6 rounded-2xl flex items-center gap-4 border-t border-emerald-500/30">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center shrink-0">
            <FileText className="text-emerald-400" size={24} />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">Documents Generated</p>
            <p className="text-3xl font-bold text-white">{analytics.totalDocuments}</p>
          </div>
        </div>

        <div className="glass-panel p-6 rounded-2xl flex items-center gap-4 border-t border-amber-500/30">
          <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center shrink-0">
            <BarChart2 className="text-amber-400" size={24} />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">Exams Taken</p>
            <p className="text-3xl font-bold text-white">{analytics.totalAttempts}</p>
          </div>
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
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-900/50 text-xs font-semibold text-slate-400 uppercase tracking-wider">
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
          <div className="p-6 space-y-4 overflow-y-auto max-h-[600px]">
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
