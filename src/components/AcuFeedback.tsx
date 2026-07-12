import React, { useState } from "react";
import { UserProfile, dbService } from "@/lib/db";
import { Star, MessageSquare, CheckCircle, AlertCircle } from "lucide-react";

export default function AcuFeedback({ user }: { user: UserProfile }) {
  const [rating, setRating] = useState<number>(0);
  const [feedbackText, setFeedbackText] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const handleFeedbackChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    // Strict alphanumeric and basic punctuation regex
    if (/^[a-zA-Z0-9\s.,!?'"()-]*$/.test(val) || val === "") {
      setFeedbackText(val);
      setError("");
    } else {
      setError("Please use only standard text and numbers. No special symbols or code allowed.");
    }
  };

  const handleSubmit = async () => {
    if (rating === 0) {
      setError("Please select a star rating before submitting.");
      return;
    }
    
    if (!feedbackText.trim()) {
      setError("Please write some feedback before submitting.");
      return;
    }

    try {
      await dbService.submitAppReview({
        id: "rev_" + Math.random().toString(36).substring(2, 9),
        profileId: user.id,
        authorEmail: user.email,
        rating,
        feedbackText: feedbackText.trim(),
        createdAt: new Date().toLocaleDateString()
      });
      setSubmitted(true);
      setError("");
    } catch (err: any) {
      setError("Failed to submit review: " + err.message);
    }
  };

  if (submitted) {
    return (
      <div className="glass-panel p-8 rounded-2xl flex flex-col items-center justify-center text-center space-y-4 max-w-lg mx-auto mt-12 animate-fade-in">
        <CheckCircle className="text-emerald-400" size={48} />
        <h2 className="text-2xl font-bold text-white">Thank You!</h2>
        <p className="text-slate-400 text-sm">
          Your review has been successfully submitted. We appreciate your feedback as it helps us improve the app!
        </p>
        <button
          onClick={() => {
            setSubmitted(false);
            setRating(0);
            setFeedbackText("");
          }}
          className="mt-4 px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm transition-colors cursor-pointer"
        >
          Submit Another Review
        </button>
      </div>
    );
  }

  const getPlaceholder = () => {
    if (rating === 0) return "Select a star rating first...";
    if (rating >= 4) return "What did you like about the app?";
    return "What did you not like in the app?";
  };

  return (
    <div className="glass-panel p-6 sm:p-8 rounded-2xl space-y-8 max-w-2xl mx-auto mt-6 text-left animate-fade-in">
      <div>
        <h2 className="text-2xl sm:text-3xl font-display font-bold text-white mb-2 flex items-center gap-2">
          <MessageSquare className="text-violet-400" size={28} /> Rate Your Experience
        </h2>
        <p className="text-slate-400 text-sm">
          Tell us what you think about Acu. Your review will be visible on the landing page!
        </p>
      </div>

      <div className="space-y-6">
        <div className="flex flex-col items-center space-y-4 py-4 bg-slate-950/30 rounded-2xl border border-slate-900/50">
          <span className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Overall Rating</span>
          <div className="flex gap-2 sm:gap-4">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => setRating(star)}
                className="focus:outline-none transition-transform hover:scale-110 cursor-pointer"
              >
                <Star
                  size={40}
                  className={
                    rating >= star
                      ? "fill-amber-400 text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]"
                      : "fill-slate-900/50 text-slate-700"
                  }
                />
              </button>
            ))}
          </div>
          <span className="text-xs text-slate-500 font-medium">
            {rating === 0 && "Click to rate"}
            {rating === 1 && "Poor"}
            {rating === 2 && "Fair"}
            {rating === 3 && "Good"}
            {rating === 4 && "Very Good"}
            {rating === 5 && "Excellent!"}
          </span>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Your Feedback
          </label>
          <textarea
            value={feedbackText}
            onChange={handleFeedbackChange}
            disabled={rating === 0}
            placeholder={getPlaceholder()}
            rows={5}
            className="w-full bg-slate-950/40 border border-slate-800 focus:border-violet-500 rounded-xl py-3 px-4 text-sm text-white placeholder-slate-600 outline-none resize-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <p className="text-[10px] text-slate-500 text-right">Only text and numbers allowed.</p>
        </div>

        {error && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-950/40 border border-rose-900/50 text-rose-400 text-xs">
            <AlertCircle size={14} className="shrink-0 mt-0.5" />
            <p>{error}</p>
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={rating === 0 || !feedbackText.trim()}
          className="w-full py-3 bg-violet-600 hover:bg-violet-500 disabled:bg-violet-900/50 disabled:text-slate-500 text-white rounded-xl text-sm font-bold tracking-wide transition-colors shadow-md shadow-violet-600/20 cursor-pointer"
        >
          Submit Review
        </button>
      </div>
    </div>
  );
}
