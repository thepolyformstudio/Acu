"use client";

import React, { useState, useEffect } from "react";
import { dbService, UserProfile, DocumentSource, ExamAttempt, ChildProfile } from "@/lib/db";
import { 
  Plus, RefreshCw, Users, Award, ChevronRight, ArrowLeft, 
  FileText, CheckCircle2, AlertTriangle, HelpCircle, Calendar, ClipboardCheck, BookOpen, Cloud, CloudOff
} from "lucide-react";
import { isDriveSignedIn } from "@/lib/googleDrive";

interface AcuDashProps {
  user: UserProfile;
  documents: DocumentSource[];
  attempts: ExamAttempt[];
  onRefresh: () => void;
  activeProfileId: string;
  setActiveProfileId: (id: string) => void;
  onNavigateSettings?: () => void;
}

export default function AcuDash({ 
  user, documents, attempts, onRefresh, activeProfileId, setActiveProfileId, onNavigateSettings
}: AcuDashProps) {
  // Profiles (only relevant if role is Parent)
  const [children, setChildren] = useState<ChildProfile[]>([]);
  const [showAddChild, setShowAddChild] = useState(false);
  const [newChildName, setNewChildName] = useState("");
  const [newChildGrade, setNewChildGrade] = useState("Grade 10");
  const [childLoading, setChildLoading] = useState(false);

  // Drilldown states
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);

  useEffect(() => {
    if (user.role === "parent") {
      dbService.getChildProfiles(user.id).then((list) => {
        setChildren(list);
        if (list.length > 0 && activeProfileId === user.id) {
          setActiveProfileId(list[0].id);
        }
      }).catch(console.error);
    }
  }, [user, activeProfileId]);

  const handleAddChild = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChildName.trim()) return;

    setChildLoading(true);
    try {
      const newChild = await dbService.addChildProfile(user.id, newChildName.trim(), newChildGrade);
      setChildren([...children, newChild]);
      setActiveProfileId(newChild.id);
      setNewChildName("");
      setShowAddChild(false);
      onRefresh();
    } catch (err) {
      console.error(err);
    } finally {
      setChildLoading(false);
    }
  };

  const handleDeleteChild = async (childId: string) => {
    if (confirm("Are you sure you want to delete this child's profile? This will wipe their local study progress.")) {
      await dbService.deleteChildProfile(childId);
      const remaining = children.filter(c => c.id !== childId);
      setChildren(remaining);
      if (activeProfileId === childId) {
        setActiveProfileId(remaining.length > 0 ? remaining[0].id : user.id);
      }
      onRefresh();
    }
  };

  // Helper: check if a specific chapter in a subject is completed
  const getChapterStatus = (subject: string, chapName: string) => {
    const chapAttempts = attempts.filter(a => {
      // Direct metadata match
      if (a.subject && a.chapterName) {
        return a.subject.toLowerCase() === subject.toLowerCase() && a.chapterName.toLowerCase() === chapName.toLowerCase();
      }
      // Fallback: title match
      const aTitle = a.examTitle.toLowerCase();
      const cName = chapName.toLowerCase();
      return aTitle.includes(cName) || cName.includes(aTitle);
    });

    if (chapAttempts.length === 0) return { status: "not_started", maxScore: 0, avgScore: 0, attemptsCount: 0 };
    
    const scores = chapAttempts.map(a => (a.marksObtained / a.maxMarks) * 100);
    const maxScore = Math.max(...scores);
    const avgScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    const passed = maxScore >= 40;
    
    return {
      status: passed ? "completed" : "practice_needed",
      maxScore: Math.round(maxScore),
      avgScore,
      attemptsCount: chapAttempts.length
    };
  };

  // Group stats by Subject
  // We extract subjects from all uploaded documents
  const subjectsMap: { [subject: string]: { 
    subjectName: string;
    docs: DocumentSource[]; 
    totalChapters: number; 
    completedChapters: number; 
    attemptsCount: number; 
    totalAttemptsScore: number; 
  }} = {};

  documents.forEach((doc) => {
    const subj = doc.subject || "General";
    if (!subjectsMap[subj]) {
      subjectsMap[subj] = {
        subjectName: subj,
        docs: [],
        totalChapters: 0,
        completedChapters: 0,
        attemptsCount: 0,
        totalAttemptsScore: 0
      };
    }
    subjectsMap[subj].docs.push(doc);
    subjectsMap[subj].totalChapters += doc.chapterMap?.length || 0;
    
    // Check completion status for each chapter in this doc
    doc.chapterMap?.forEach((chap) => {
      const stats = getChapterStatus(subj, chap.name);
      if (stats.status === "completed") {
        subjectsMap[subj].completedChapters += 1;
      }
    });
  });

  // Map attempts to existing document subjects
  attempts.forEach((a) => {
    const subj = a.subject || "General";
    if (subjectsMap[subj]) {
      subjectsMap[subj].attemptsCount += 1;
      subjectsMap[subj].totalAttemptsScore += (a.marksObtained / a.maxMarks) * 100;
    }
  });

  const subjectsList = Object.values(subjectsMap);

  return (
    <div className="space-y-6">

      {/* -------------------------------------------------------------
          PARENT ROLE PROFILE MANAGEMENT
         ------------------------------------------------------------- */}
      {user.role === "parent" && (
        <div className="glass-panel p-6 rounded-2xl">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-2 text-violet-400">
              <Users size={20} />
              <h3 className="font-display font-bold text-white text-base">Children Profiles</h3>
            </div>
            <button
              onClick={() => setShowAddChild(!showAddChild)}
              className="flex items-center gap-1 text-xs bg-violet-600 hover:bg-violet-500 text-white px-3 py-1.5 rounded-xl font-medium transition-colors cursor-pointer"
            >
              <Plus size={14} /> Add Child Profile
            </button>
          </div>

          {showAddChild && (
            <form onSubmit={handleAddChild} className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6 p-4 rounded-xl border border-slate-800 bg-slate-950/40">
              <div className="space-y-1 text-left">
                <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Child Name</label>
                <input
                  type="text"
                  required
                  placeholder="Rahul"
                  value={newChildName}
                  onChange={(e) => setNewChildName(e.target.value)}
                  className="w-full bg-slate-950/60 border border-slate-800 focus:border-violet-500 rounded-lg py-1.5 px-3 text-xs text-white outline-none"
                />
              </div>
              <div className="space-y-1 text-left">
                <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Class Grade</label>
                <select
                  value={newChildGrade}
                  onChange={(e) => setNewChildGrade(e.target.value)}
                  className="w-full bg-slate-950/60 border border-slate-800 focus:border-violet-500 rounded-lg py-1.5 px-3 text-xs text-white outline-none cursor-pointer"
                >
                  <option value="Grade 1">Grade 1</option>
                  <option value="Grade 2">Grade 2</option>
                  <option value="Grade 3">Grade 3</option>
                  <option value="Grade 4">Grade 4</option>
                  <option value="Grade 5">Grade 5</option>
                  <option value="Grade 6">Grade 6</option>
                  <option value="Grade 7">Grade 7</option>
                  <option value="Grade 8">Grade 8</option>
                  <option value="Grade 9">Grade 9</option>
                  <option value="Grade 10">Grade 10</option>
                  <option value="Grade 11">Grade 11</option>
                  <option value="Grade 12">Grade 12</option>
                  <option value="Undergraduate">College Level</option>
                </select>
              </div>
              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={childLoading}
                  className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold cursor-pointer flex items-center justify-center gap-1"
                >
                  {childLoading ? <RefreshCw className="animate-spin" size={12} /> : null}
                  Confirm Profile
                </button>
              </div>
            </form>
          )}

          {/* Child selection tabs */}
          {children.length === 0 ? (
            <div className="text-center p-4 rounded-xl border border-dashed border-slate-800 text-slate-500 text-xs font-medium">
              No children profiles created yet. Click "Add Child" to manage your first child's desk.
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {children.map((c) => (
                <div 
                  key={c.id} 
                  className={`flex items-center gap-2 py-2 px-4 rounded-xl border transition-all cursor-pointer ${
                    activeProfileId === c.id 
                      ? "bg-violet-950/40 border-violet-500/50 text-white font-medium" 
                      : "border-slate-800 text-slate-400 bg-slate-950/20 hover:text-white"
                  }`}
                  onClick={() => {
                    setActiveProfileId(c.id);
                    setSelectedSubject(null); // Clear selected drilldown on switch
                  }}
                >
                  <span>🎓 {c.name} ({c.grade})</span>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteChild(c.id);
                    }}
                    className="p-0.5 rounded text-slate-500 hover:text-red-400 hover:bg-red-950/20 transition-colors"
                  >
                    <Plus size={12} className="rotate-45" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* -------------------------------------------------------------
          DASHBOARD SCREEN 1: SUBJECT-LEVEL OVERVIEW LIST
         ------------------------------------------------------------- */}
      {!selectedSubject ? (
        <div className="space-y-6 text-left animate-fade-in">
          <div className="flex items-center justify-between">
            <h3 className="font-display font-bold text-white text-base">Subject Diagnostics & Progress</h3>
            <span className="text-[10px] text-slate-500 font-semibold tracking-wider uppercase">Click card to drill down</span>
          </div>

          {subjectsList.length === 0 ? (
            <div className="glass-panel p-12 text-center text-slate-500 border border-dashed border-slate-800 rounded-2xl space-y-2">
              <BookOpen size={32} className="mx-auto text-slate-700 animate-pulse" />
              <h4 className="text-sm font-semibold text-white">No active subjects in your library</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Go to the **AcuLibrary** tab and upload study materials to start tracking performance metrics.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {subjectsList.map((subjectData) => {
                const totalChaps = subjectData.totalChapters;
                const completedChaps = subjectData.completedChapters;
                const progressPercent = totalChaps > 0 ? Math.round((completedChaps / totalChaps) * 100) : 0;
                const avgScore = subjectData.attemptsCount > 0 
                  ? Math.round(subjectData.totalAttemptsScore / subjectData.attemptsCount)
                  : 0;

                return (
                  <div 
                    key={subjectData.subjectName}
                    onClick={() => setSelectedSubject(subjectData.subjectName)}
                    className="glass-panel p-6 rounded-2xl hover:border-violet-500/40 hover:bg-slate-950/30 transition-all cursor-pointer group text-left flex flex-col justify-between h-52 border border-slate-850"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-violet-400 bg-violet-950/40 border border-violet-500/20 px-2.5 py-1 rounded">
                          📚 {subjectData.subjectName}
                        </span>
                        <ChevronRight size={16} className="text-slate-600 group-hover:text-violet-400 transition-colors" />
                      </div>

                      <div className="pt-2">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-slate-400 font-semibold">{completedChaps} / {totalChaps} Chapters Mapped</span>
                          <span className="text-white font-bold">{progressPercent}%</span>
                        </div>
                        <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-850">
                          <div 
                            className="bg-violet-600 h-full rounded-full transition-all duration-500"
                            style={{ width: `${progressPercent}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-slate-900 pt-3 grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Tests Attempted</span>
                        <span className="text-sm font-bold text-white mt-0.5 block">{subjectData.attemptsCount} test(s)</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Avg Score</span>
                        <span className="text-sm font-bold text-white mt-0.5 block">
                          {subjectData.attemptsCount > 0 ? `${avgScore}%` : "—"}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* -------------------------------------------------------------
            DASHBOARD SCREEN 2: DRILL-DOWN SUBJECT DETAIL PANEL
           ------------------------------------------------------------- */
        <div className="space-y-6 text-left animate-fade-in">
          {/* Back Action Bar */}
          <button
            onClick={() => setSelectedSubject(null)}
            className="flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors cursor-pointer bg-slate-950 hover:bg-slate-900 border border-slate-800 py-2 px-4 rounded-xl"
          >
            <ArrowLeft size={14} /> Back to Subjects Overview
          </button>

          {/* Subject Overview Cards */}
          <div className="glass-panel p-6 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="space-y-1">
              <h2 className="text-2xl font-display font-extrabold text-white">Subject Detail: {selectedSubject}</h2>
              <p className="text-slate-400 text-xs">Chapter completion analytics and historical revision blueprints.</p>
            </div>

            <div className="flex flex-wrap gap-4">
              <div className="py-2.5 px-4 bg-slate-950 border border-slate-800 rounded-xl text-center">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold block">Topics Mapped</span>
                <span className="text-lg font-extrabold text-white mt-0.5 block">
                  {subjectsMap[selectedSubject]?.totalChapters || 0}
                </span>
              </div>
              <div className="py-2.5 px-4 bg-slate-950 border border-slate-800 rounded-xl text-center">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold block">Tests Taken</span>
                <span className="text-lg font-extrabold text-white mt-0.5 block">
                  {subjectsMap[selectedSubject]?.attemptsCount || 0}
                </span>
              </div>
              <div className="py-2.5 px-4 bg-slate-950 border border-slate-800 rounded-xl text-center">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold block">Average Score</span>
                <span className="text-lg font-extrabold text-emerald-400 mt-0.5 block">
                  {subjectsMap[selectedSubject]?.attemptsCount > 0 
                    ? `${Math.round(subjectsMap[selectedSubject].totalAttemptsScore / subjectsMap[selectedSubject].attemptsCount)}%` 
                    : "—"
                  }
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left: Chapter / Topic Progress List */}
            <div className="lg:col-span-7 glass-panel p-6 rounded-2xl space-y-4">
              <div className="flex items-center gap-2 text-violet-400 border-b border-slate-900 pb-3">
                <ClipboardCheck size={18} />
                <h4 className="font-display font-bold text-white text-sm">Chapter & Topic Progress</h4>
              </div>

              <div className="space-y-3">
                {subjectsMap[selectedSubject]?.docs.flatMap(doc => 
                  (doc.chapterMap || []).map(chap => {
                    const statusData = getChapterStatus(selectedSubject, chap.name);
                    return { docName: doc.name, chapName: chap.name, ...statusData };
                  })
                ).map((chapData, idx) => (
                  <div 
                    key={idx}
                    className="p-3.5 rounded-xl border border-slate-850 bg-slate-950/30 flex items-center justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <h5 className="text-xs font-bold text-white">{chapData.chapName}</h5>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[9px] text-slate-500">
                        <span>Source: {chapData.docName}</span>
                        {chapData.attemptsCount > 0 && (
                          <span className="text-violet-400 font-semibold">
                            • {chapData.attemptsCount} test(s) • Avg: {chapData.avgScore}%
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-2">
                      {chapData.status === "completed" && (
                        <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-emerald-950/40 border border-emerald-500/20 text-emerald-400 font-semibold uppercase">
                          <CheckCircle2 size={10} /> Passed ({chapData.maxScore}%)
                        </span>
                      )}
                      {chapData.status === "practice_needed" && (
                        <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-amber-950/40 border border-amber-500/20 text-amber-400 font-semibold uppercase">
                          <AlertTriangle size={10} /> Needs Practice ({chapData.maxScore}%)
                        </span>
                      )}
                      {chapData.status === "not_started" && (
                        <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-500 font-semibold uppercase">
                          Not Started
                        </span>
                      )}
                    </div>
                  </div>
                ))}

                {(!subjectsMap[selectedSubject]?.docs || subjectsMap[selectedSubject].docs.length === 0) && (
                  <p className="text-xs text-slate-500 text-center py-4">No mapped textbook chapters.</p>
                )}
              </div>
            </div>

            {/* Right: Subject Exam Diagnostics logs */}
            <div className="lg:col-span-5 glass-panel p-6 rounded-2xl space-y-4">
              <div className="flex items-center gap-2 text-violet-400 border-b border-slate-900 pb-3">
                <Award size={18} />
                <h4 className="font-display font-bold text-white text-sm">Subject Exam Attempts ({attempts.filter(a => (a.subject || "General").toLowerCase() === selectedSubject.toLowerCase()).length})</h4>
              </div>

              <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
                {attempts
                  .filter(a => (a.subject || "General").toLowerCase() === selectedSubject.toLowerCase())
                  .map((attempt) => {
                    const pct = Math.round((attempt.marksObtained / attempt.maxMarks) * 100);
                    const passed = pct >= 40;

                    return (
                      <div key={attempt.id} className="p-3 bg-slate-950/50 border border-slate-900 rounded-xl space-y-2">
                        <div className="flex justify-between items-start gap-2">
                          <div className="text-left">
                            <h5 className="text-[11px] font-bold text-white leading-tight line-clamp-1">{attempt.examTitle}</h5>
                            <span className="text-[9px] text-slate-500 block mt-0.5">{attempt.chapterName || "General Revision"}</span>
                          </div>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase shrink-0 ${
                            passed ? "bg-emerald-950/40 text-emerald-400" : "bg-red-950/40 text-red-400"
                          }`}>
                            {pct}%
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-[9px] text-slate-500 border-t border-slate-900/60 pt-1.5">
                          <span className="flex items-center gap-0.5"><Calendar size={8} /> {attempt.date}</span>
                          <span>Score: {attempt.marksObtained}/{attempt.maxMarks} marks</span>
                        </div>
                      </div>
                    );
                  })
                }

                {attempts.filter(a => (a.subject || "General").toLowerCase() === selectedSubject.toLowerCase()).length === 0 && (
                  <p className="text-xs text-slate-500 text-center py-6">No test papers submitted for this subject yet.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
