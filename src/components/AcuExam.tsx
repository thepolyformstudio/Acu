"use client";

import React, { useState, useEffect } from "react";
import { DocumentSource, ExamAttempt, dbService, UserProfile } from "@/lib/db";
import { generateExamPaper, gradeWrittenAnswer } from "@/lib/gemini";
import { saveExamAttemptsToDrive, isDriveSignedIn } from "@/lib/googleDrive";
import { 
  Play, FileText, CheckCircle, RefreshCw, BarChart2, 
  ChevronRight, Award, Timer, AlertCircle, Send, Check, Trash2
} from "lucide-react";
import { 
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer 
} from 'recharts';
import confetti from "canvas-confetti";

interface AcuExamProps {
  documents: DocumentSource[];
  attempts: ExamAttempt[];
  activeProfileId: string;
  onRefresh: () => void;
  user: UserProfile;
}

// Translate Python calculate_question_distribution to TS
function calculateQuestionDistribution(totalMarks: number, totalQuestions: number, board: string): { mcq: number; vsa: number; sa: number; la: number } {
  const isCompetitive = [
    "JEE Main", "JEE Advanced", "NEET", "CAT", "CLAT", "UPSC CSE", "SSC CGL", "Bank PO", "NDA"
  ].includes(board) || board.toLowerCase().includes("entrance") || board.toLowerCase().includes("government") || board.toLowerCase().includes("aptitude");
  
  if (isCompetitive) {
    // All questions are MCQs for competitive/entrance exams in India
    return { mcq: totalQuestions, vsa: 0, sa: 0, la: 0 };
  }

  let bestDist = { mcq: 0, vsa: 0, sa: 0, la: 0 };
  let bestScore = Infinity;
  
  const targetRatios = { mcq: 0.25, vsa: 0.20, sa: 0.35, la: 0.20 };
  let found = false;
  
  for (let mcq = 0; mcq <= totalQuestions; mcq++) {
    for (let vsa = 0; vsa <= totalQuestions - mcq; vsa++) {
      for (let sa = 0; sa <= totalQuestions - mcq - vsa; sa++) {
        const la = totalQuestions - mcq - vsa - sa;
        if (la >= 0) {
          const marks = 1 * mcq + 2 * vsa + 3 * sa + 5 * la;
          if (marks === totalMarks) {
            found = true;
            const r_mcq = mcq / totalQuestions;
            const r_vsa = vsa / totalQuestions;
            const r_sa = sa / totalQuestions;
            const r_la = la / totalQuestions;
            
            const score = (
              Math.pow(r_mcq - targetRatios.mcq, 2) +
              Math.pow(r_vsa - targetRatios.vsa, 2) +
              Math.pow(r_sa - targetRatios.sa, 2) +
              Math.pow(r_la - targetRatios.la, 2)
            );
            
            if (score < bestScore) {
              bestScore = score;
              bestDist = { mcq, vsa, sa, la };
            }
          }
        }
      }
    }
  }
  
  if (found) return bestDist;

  // Fallback heuristic if no algebraic solution exists
  const avgMarks = totalMarks / Math.max(1, totalQuestions);
  if (avgMarks <= 1.5) {
    const mcq = Math.floor(totalQuestions * 0.7);
    return { mcq, vsa: totalQuestions - mcq, sa: 0, la: 0 };
  } else if (avgMarks <= 2.5) {
    const mcq = Math.floor(totalQuestions * 0.4);
    const vsa = Math.floor(totalQuestions * 0.4);
    return { mcq, vsa, sa: totalQuestions - mcq - vsa, la: 0 };
  } else {
    const vsa = Math.floor(totalQuestions * 0.3);
    const sa = Math.floor(totalQuestions * 0.4);
    return { mcq: 0, vsa, sa, la: totalQuestions - vsa - sa };
  }
}

export default function AcuExam({ 
  documents, attempts, activeProfileId, onRefresh, user 
}: AcuExamProps) {
  const [selectedSubject, setSelectedSubject] = useState("");
  const [selectedChapterKey, setSelectedChapterKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");

  // Build unique subject list from all documents
  const subjectsList = [...new Set(documents.map(d => d.subject || "General"))];

  // Flatten all chapters under the selected subject across all documents
  type FlatChapter = { docId: string; chapIdx: number; name: string; summary: string; startPage: number; endPage: number; docName: string; docPageCount: number };
  const flatChapters: FlatChapter[] = selectedSubject
    ? documents
        .filter(d => (d.subject || "General") === selectedSubject)
        .flatMap(d =>
          (d.chapterMap || []).map((chap, idx) => ({
            docId: d.id,
            chapIdx: idx,
            name: chap.name,
            summary: chap.summary,
            startPage: chap.startPage,
            endPage: chap.endPage,
            docName: d.name,
            docPageCount: d.pages.length,
          }))
        )
    : [];

  // Exam Configurator Options
  const [examTitle, setExamTitle] = useState("Weekly Revision Test");
  const [selectedBoardType, setSelectedBoardType] = useState("CBSE");
  const [customBoardText, setCustomBoardText] = useState("");
  const [classGrade, setClassGrade] = useState("Grade 10");
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [totalQuestions, setTotalQuestions] = useState(10);
  const [totalMarks, setTotalMarks] = useState(25);
  
  const [distribution, setDistribution] = useState({ mcq: 0, vsa: 0, sa: 0, la: 0 });

  const activeBoard = selectedBoardType === "Custom" ? customBoardText : selectedBoardType;

  // Manual chapter override state
  const [manualChapterOverride, setManualChapterOverride] = useState(false);
  const [customChapterName, setCustomChapterName] = useState("");
  const [customStartPage, setCustomStartPage] = useState(1);
  const [customEndPage, setCustomEndPage] = useState(10);

  // Running Exam State
  const [activeExam, setActiveExam] = useState<any | null>(null);
  const [studentAnswers, setStudentAnswers] = useState<{ [qId: string]: string }>({});
  const [secondsRemaining, setSecondsRemaining] = useState(0);
  const [examRunning, setExamRunning] = useState(false);

  // Graded Result Scorecard
  const [scorecard, setScorecard] = useState<ExamAttempt | null>(null);

  // Update distribution preview on config change
  useEffect(() => {
    const dist = calculateQuestionDistribution(totalMarks, totalQuestions, activeBoard);
    setDistribution(dist);
  }, [totalMarks, totalQuestions, activeBoard]);

  // active Countdown Timer Hook
  useEffect(() => {
    if (!examRunning || secondsRemaining <= 0) {
      if (examRunning && secondsRemaining <= 0) {
        // Auto-submit when timer expires
        handleExamSubmit();
      }
      return;
    }
    const timer = setInterval(() => {
      setSecondsRemaining(prev => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [examRunning, secondsRemaining]);

  const handleGenerateExam = async () => {
    // Find the selected chapter and its parent document
    const chap = flatChapters.find(c => `${c.docId}_${c.chapIdx}` === selectedChapterKey);
    if (!chap) {
      alert("Please select a subject and chapter.");
      return;
    }
    const selectedDoc = documents.find(d => d.id === chap.docId);
    if (!selectedDoc) return;
    
    let chapName = "";
    let startP = 1;
    let endP = selectedDoc.pages.length;

    if (manualChapterOverride) {
      if (!customChapterName.trim()) {
        alert("Please enter a custom Chapter / Topic name.");
        return;
      }
      chapName = customChapterName.trim();
      startP = Math.max(1, customStartPage);
      endP = Math.min(selectedDoc.pages.length, customEndPage);
      if (startP > endP) {
        alert("Start page cannot be greater than end page.");
        return;
      }
    } else {
      chapName = chap.name;
      startP = chap.startPage;
      endP = chap.endPage;
    }

    setLoading(true);
    setLoadingMessage("Gemini is reading textbook text...");

    try {
      const textSlices = selectedDoc.pages
        .filter(p => p.pageNumber >= startP && p.pageNumber <= endP)
        .map(p => p.text)
        .join("\n\n");

      if (textSlices.trim().length === 0) {
        throw new Error("No readable text content in the selected page range.");
      }

      setLoadingMessage("Creating board blueprint paper questions...");
      const examPaper = await generateExamPaper(textSlices, examTitle, classGrade, activeBoard, distribution, totalMarks);
      
      // Assign unique local IDs to generated questions for student answering
      let questionIndex = 1;
      examPaper.sections.forEach((sec: any) => {
        sec.questions.forEach((q: any) => {
          q.id = `q_${questionIndex}`;
          questionIndex++;
        });
      });

      // Inject subject and chapter metadata
      examPaper.title = examTitle;
      examPaper.maxMarks = totalMarks;
      examPaper.durationMinutes = durationMinutes;
      examPaper.subject = selectedDoc.subject || "General";
      examPaper.documentId = selectedDoc.id;
      examPaper.chapterName = chapName;

      setActiveExam(examPaper);
      setStudentAnswers({});
      setSecondsRemaining(durationMinutes * 60);
      setExamRunning(true);
      setScorecard(null);
    } catch (err: any) {
      alert("Generation failed: " + (err.message || String(err)));
    } finally {
      setLoading(false);
      setLoadingMessage("");
    }
  };

  const handleExamSubmit = async () => {
    setExamRunning(false);
    setLoading(true);
    setLoadingMessage("Acu Grader is evaluating MCQs...");

    try {
      const gradedAnswers: any[] = [];
      let totalMarksObtained = 0.0;
      
      // Group results by Bloom's category for analytics
      const bloomsScores: { [level: string]: { obtained: number; max: number } } = {};

      // Flatten questions to grade sequentially
      const allQuestions: { sec: any; q: any }[] = [];
      activeExam.sections.forEach((sec: any) => {
        sec.questions.forEach((q: any) => {
          allQuestions.push({ sec, q });
        });
      });

      for (let i = 0; i < allQuestions.length; i++) {
        const { sec, q } = allQuestions[i];
        const studentAns = studentAnswers[q.id] || "";
        
        // Track maximum score inside Bloom's levels
        const level = q.blooms_level || "Understanding";
        if (!bloomsScores[level]) {
          bloomsScores[level] = { obtained: 0.0, max: 0.0 };
        }
        bloomsScores[level].max += q.marks;

        let marksAwarded = 0.0;
        let justification = "";
        let feedback: { correct_points: string[]; incorrect_points: string[]; suggestions: string[] } = { 
          correct_points: [], 
          incorrect_points: [], 
          suggestions: [] 
        };

        if (q.question_type === "MCQ") {
          // MCQ Graded Locally (Deterministic)
          const isCorrect = studentAns.trim().toUpperCase() === q.model_answer.trim().toUpperCase();
          marksAwarded = isCorrect ? q.marks : 0.0;
          justification = isCorrect 
            ? `Answer '${studentAns}' is correct.` 
            : `Incorrect choice. The correct option is ${q.model_answer}.`;
          feedback = {
            correct_points: isCorrect ? [`Correctly chose option ${studentAns}`] : [],
            incorrect_points: isCorrect ? [] : [` chosed option ${studentAns || 'None'}. Correct was ${q.model_answer}`],
            suggestions: isCorrect ? [] : ["Review this exact textbook definition."]
          };
        } else {
          // Written Questions (Short/Long) evaluated by Gemini Grader
          setLoadingMessage(`Evaluating written response for Question ${i + 1} against rubrics...`);
          try {
            const gradingResult = await gradeWrittenAnswer(
              q.question_text,
              q.marks,
              q.model_answer,
              q.grading_rubric,
              studentAns
            );
            marksAwarded = Math.max(0, Math.min(q.marks, Number(gradingResult.marks_awarded || 0)));
            justification = gradingResult.justification || "Graded by AI Grader.";
            feedback = gradingResult.feedback_details || { correct_points: [], incorrect_points: [], suggestions: [] };
          } catch (e) {
            console.error("Grading failed for question index", i, e);
            marksAwarded = 0.0;
            justification = "Failed to run automated grader. Awarded 0 marks by default.";
          }
        }

        totalMarksObtained += marksAwarded;
        bloomsScores[level].obtained += marksAwarded;

        gradedAnswers.push({
          questionText: q.question_text,
          questionType: q.question_type,
          bloomsLevel: level,
          maxMarks: q.marks,
          studentAnswer: studentAns,
          modelAnswer: q.model_answer,
          marksAwarded,
          justification,
          feedback
        });
      }

      // Compute Bloom's Taxonomy analytics percentages
      const bloomsAnalytics: { [key: string]: number } = {};
      Object.entries(bloomsScores).forEach(([level, score]) => {
        bloomsAnalytics[level] = score.max > 0 ? Math.round((score.obtained / score.max) * 100) : 0;
      });

      const attemptResult: ExamAttempt = {
        id: "attempt_" + Math.random().toString(36).substring(2, 9),
        examTitle: activeExam.title,
        subject: activeExam.subject,
        documentId: activeExam.documentId,
        chapterName: activeExam.chapterName,
        maxMarks: totalMarks,
        marksObtained: totalMarksObtained,
        durationMinutes,
        date: new Date().toLocaleDateString(),
        bloomsAnalytics,
        answers: gradedAnswers
      };

      await dbService.saveExamAttempt(activeProfileId, attemptResult);
      // Async backup exam results to Google Drive (non-blocking)
      if (isDriveSignedIn()) {
        dbService.getExamAttempts(activeProfileId).then((all) => {
          saveExamAttemptsToDrive(activeProfileId, all).catch(() => {});
        });
      }
      setScorecard(attemptResult);
      setActiveExam(null);
      onRefresh();

      // Celebration confetti for successful pass
      if (totalMarksObtained / totalMarks >= 0.4) {
        confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
      }
    } catch (err: any) {
      alert("Grading submission failed: " + String(err));
    } finally {
      setLoading(false);
      setLoadingMessage("");
    }
  };

  const handleDeleteScorecard = async () => {
    if (!scorecard) return;
    if (confirm("Are you sure you want to delete this graded test result?")) {
      await dbService.deleteExamAttempt(activeProfileId, scorecard.id);
      
      // Update Drive if signed in
      if (isDriveSignedIn()) {
        dbService.getExamAttempts(activeProfileId).then((all) => {
          saveExamAttemptsToDrive(activeProfileId, all).catch(() => {});
        });
      }
      
      setScorecard(null);
      onRefresh();
    }
  };

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  // Prepare Recharts data for radar display
  const getRadarData = (attempt: ExamAttempt) => {
    const levels = ["Remembering", "Understanding", "Applying", "Analyzing", "Evaluating", "Creating"];
    return levels.map(level => ({
      subject: level,
      score: attempt.bloomsAnalytics[level] !== undefined ? attempt.bloomsAnalytics[level] : 0,
      fullMark: 100
    }));
  };

  return (
    <div className="space-y-6">
      {/* -------------------------------------------------------------
          SCREEN A: EXAM CONFIGURATOR (INITIAL DESIGN SCREEN)
         ------------------------------------------------------------- */}
      {!activeExam && !scorecard && (
        <div className="glass-panel p-6 rounded-2xl space-y-6">
          <div>
            <h2 className="text-2xl sm:text-3xl font-display font-bold text-white mb-1">AcuExam Paper Generator</h2>
            <p className="text-slate-400 text-sm">Create CBSE / Board syllabus-aligned exam papers with custom marking blueprints.</p>
          </div>

          {loading ? (
            <div className="p-12 text-center space-y-3">
              <RefreshCw className="animate-spin text-violet-400 mx-auto" size={28} />
              <h4 className="text-sm font-semibold text-white">{loadingMessage}</h4>
              <p className="text-xs text-slate-500">Do not refresh. Gathering questions and marking guides.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Inputs grids */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 items-end">
                <div className="space-y-1 text-left">
                  <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Subject</label>
                  <select
                    value={selectedSubject}
                    onChange={(e) => {
                      setSelectedSubject(e.target.value);
                      setSelectedChapterKey("");
                    }}
                    className="w-full bg-slate-950/60 border border-slate-800 focus:border-violet-500 rounded-xl py-2 px-3 text-xs text-white outline-none cursor-pointer"
                  >
                    <option value="">-- Choose subject --</option>
                    {subjectsList.map((s) => {
                      const count = documents
                        .filter(d => (d.subject || "General") === s)
                        .reduce((acc, d) => acc + (d.chapterMap?.length || 0), 0);
                      return <option key={s} value={s}>{s} ({count} chapters)</option>;
                    })}
                  </select>
                </div>

                {!manualChapterOverride ? (
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Chapter</label>
                    <select
                      disabled={!selectedSubject}
                      value={selectedChapterKey}
                      onChange={(e) => setSelectedChapterKey(e.target.value)}
                      className="w-full bg-slate-950/60 border border-slate-800 focus:border-violet-500 rounded-xl py-2 px-3 text-xs text-white outline-none cursor-pointer disabled:opacity-50"
                    >
                      <option value="">-- Choose chapter --</option>
                      {flatChapters.map((c) => (
                        <option key={`${c.docId}_${c.chapIdx}`} value={`${c.docId}_${c.chapIdx}`}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    {selectedChapterKey && (
                      <p className="text-[10px] text-slate-600 mt-0.5">
                        Source: {flatChapters.find(c => `${c.docId}_${c.chapIdx}` === selectedChapterKey)?.docName}
                      </p>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Chapter / Topic Title</label>
                      <input
                        type="text"
                        placeholder="e.g. Chemical Equations"
                        value={customChapterName}
                        onChange={(e) => setCustomChapterName(e.target.value)}
                        className="w-full bg-slate-950/60 border border-slate-800 focus:border-violet-500 rounded-xl py-2 px-3 text-xs text-white outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Start Page</label>
                      <input
                        type="number"
                        min={1}
                        value={customStartPage}
                        onChange={(e) => setCustomStartPage(Math.max(1, Number(e.target.value)))}
                        className="w-full bg-slate-950/60 border border-slate-800 focus:border-violet-500 rounded-xl py-2 px-3 text-xs text-white outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">End Page</label>
                      <input
                        type="number"
                        min={1}
                        value={customEndPage}
                        onChange={(e) => setCustomEndPage(Math.max(1, Number(e.target.value)))}
                        className="w-full bg-slate-950/60 border border-slate-800 focus:border-violet-500 rounded-xl py-2 px-3 text-xs text-white outline-none"
                      />
                    </div>
                  </>
                )}

                <div className="flex items-center gap-2 pt-5">
                  <input
                    type="checkbox"
                    id="manualChapterOverride"
                    checked={manualChapterOverride}
                    onChange={(e) => setManualChapterOverride(e.target.checked)}
                    className="accent-violet-600 cursor-pointer w-4 h-4"
                  />
                  <label htmlFor="manualChapterOverride" className="text-xs text-slate-400 font-semibold cursor-pointer">
                    Input Topic manually
                  </label>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Board Blueprint</label>
                  <select
                    value={selectedBoardType}
                    onChange={(e) => setSelectedBoardType(e.target.value)}
                    className="w-full bg-slate-950/60 border border-slate-800 focus:border-violet-500 rounded-xl py-2 px-3 text-xs text-white outline-none cursor-pointer"
                  >
                    <option value="CBSE">CBSE (School)</option>
                    <option value="ICSE">ICSE (School)</option>
                    <option value="State Board (Maharashtra)">State Board (MH)</option>
                    <option value="State Board (Tamil Nadu)">State Board (TN)</option>
                    <option value="State Board (Karnataka)">State Board (KA)</option>
                    <option value="JEE Main">JEE Main (Entrance)</option>
                    <option value="JEE Advanced">JEE Advanced (Entrance)</option>
                    <option value="NEET">NEET (Medical)</option>
                    <option value="CAT">CAT (Management)</option>
                    <option value="CLAT">CLAT (Law)</option>
                    <option value="UPSC CSE">UPSC Civil Services</option>
                    <option value="SSC CGL">SSC Government Exam</option>
                    <option value="Bank PO">Bank PO Exam</option>
                    <option value="NDA">NDA Entrance</option>
                    <option value="Custom">Custom / Other</option>
                  </select>
                </div>

                {selectedBoardType === "Custom" && (
                  <div className="space-y-1 sm:col-span-2 md:col-span-1">
                    <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Custom Board Name</label>
                    <input
                      type="text"
                      placeholder="e.g. CBSE 2026, AP Chemistry"
                      value={customBoardText}
                      onChange={(e) => setCustomBoardText(e.target.value)}
                      className="w-full bg-slate-950/60 border border-slate-800 focus:border-violet-500 rounded-xl py-2 px-3 text-xs text-white outline-none"
                    />
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Grade Level</label>
                  <select
                    value={classGrade}
                    onChange={(e) => setClassGrade(e.target.value)}
                    className="w-full bg-slate-950/60 border border-slate-800 focus:border-violet-500 rounded-xl py-2 px-3 text-xs text-white outline-none cursor-pointer"
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
                    <option value="Postgraduate">Postgraduate Level</option>
                  </select>
                </div>
              </div>

              {/* Numeric Inputs for Question Limits */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-2 text-left">
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Total Questions</label>
                  <input
                    type="number"
                    min={1}
                    value={totalQuestions}
                    onChange={(e) => setTotalQuestions(Math.max(1, Number(e.target.value)))}
                    className="w-full bg-slate-950/60 border border-slate-800 focus:border-violet-500 rounded-xl py-2 px-3 text-xs text-white outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Total Marks</label>
                  <input
                    type="number"
                    min={1}
                    value={totalMarks}
                    onChange={(e) => setTotalMarks(Math.max(1, Number(e.target.value)))}
                    className="w-full bg-slate-950/60 border border-slate-800 focus:border-violet-500 rounded-xl py-2 px-3 text-xs text-white outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Duration (Minutes)</label>
                  <input
                    type="number"
                    min={1}
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(Math.max(1, Number(e.target.value)))}
                    className="w-full bg-slate-950/60 border border-slate-800 focus:border-violet-500 rounded-xl py-2 px-3 text-xs text-white outline-none"
                  />
                </div>
              </div>

              {/* Calculated blueprint structure mapping preview */}
              <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/40 text-left">
                <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  📊 Auto-Calculated Marking Distribution (Board Standard)
                </div>
                <div className="flex flex-wrap gap-4 text-xs">
                  <div className="py-1 px-3 rounded-lg bg-slate-900 border border-slate-800 text-slate-300">
                    Section A: <span className="font-bold text-violet-400">{distribution.mcq}</span> MCQs (1m)
                  </div>
                  <div className="py-1 px-3 rounded-lg bg-slate-900 border border-slate-800 text-slate-300">
                    Section B: <span className="font-bold text-violet-400">{distribution.vsa}</span> Very Short Answer (2m)
                  </div>
                  <div className="py-1 px-3 rounded-lg bg-slate-900 border border-slate-800 text-slate-300">
                    Section C: <span className="font-bold text-violet-400">{distribution.sa}</span> Short Answer (3m)
                  </div>
                  <div className="py-1 px-3 rounded-lg bg-slate-900 border border-slate-800 text-slate-300">
                    Section D: <span className="font-bold text-violet-400">{distribution.la}</span> Long Answer (5m)
                  </div>
                </div>
              </div>

              {/* Confirm trigger */}
              <button
                onClick={handleGenerateExam}
                disabled={!selectedSubject || (!manualChapterOverride && !selectedChapterKey)}
                className="px-6 py-3 bg-violet-600 hover:bg-violet-500 disabled:bg-violet-800 text-white rounded-xl text-xs font-bold tracking-wide transition-colors cursor-pointer flex items-center justify-center gap-2 mx-auto disabled:opacity-50"
              >
                <Play size={14} /> Generate and Start Exam
              </button>
            </div>
          )}
        </div>
      )}

      {/* -------------------------------------------------------------
          SCREEN B: TIMED EXAM MODE WORKSPACE
         ------------------------------------------------------------- */}
      {activeExam && !scorecard && (
        <div className="glass-panel p-6 rounded-2xl space-y-6 text-left relative">
          {loading ? (
            <div className="p-20 text-center space-y-5 animate-fade-in">
              <div className="relative w-16 h-16 mx-auto">
                <div className="absolute inset-0 border-4 border-violet-500/20 rounded-full"></div>
                <div className="absolute inset-0 border-4 border-violet-500 rounded-full border-t-transparent animate-spin"></div>
              </div>
              <div>
                <h4 className="text-xl font-display font-bold text-white mb-2">{loadingMessage}</h4>
                <p className="text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
                  Please wait while your answers are evaluated. Our AI AcuGrader is actively matching your responses against the board blueprint rubrics...
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Top Sticky Timer Bar */}
              <div className="flex items-center justify-between border-b border-slate-900 pb-4 sticky top-[72px] bg-[#0b0c10]/95 backdrop-blur-md py-2 z-20">
                <div>
              <h3 className="text-lg font-bold text-white">{activeExam.title}</h3>
              <p className="text-xs text-slate-500">Board Standard Exam Blueprint</p>
            </div>
            
            <div className="flex items-center gap-2 py-2 px-4 rounded-xl border border-amber-500/20 bg-amber-950/20 text-amber-400 font-display font-bold">
              <Timer size={18} />
              <span>{formatTimer(secondsRemaining)}</span>
            </div>
          </div>

          {/* Exam Questions Form */}
          <div className="space-y-8">
            {activeExam.sections.map((sec: any) => {
              if (sec.questions.length === 0) return null;
              return (
                <div key={sec.section_letter} className="space-y-4">
                  <div className="p-3 rounded-xl border border-slate-800 bg-slate-950/30">
                    <h4 className="text-sm font-bold text-white uppercase tracking-wider">
                      Section {sec.section_letter}: ({sec.marks_per_question}m each)
                    </h4>
                    <p className="text-[10px] text-slate-500 mt-1">{sec.instructions}</p>
                  </div>

                  <div className="space-y-6">
                    {sec.questions.map((q: any) => (
                      <div key={q.id} className="space-y-3 p-4 rounded-xl bg-slate-950/20 border border-slate-900/60">
                        <div className="flex justify-between items-start gap-4">
                          <h5 className="text-xs sm:text-sm font-semibold text-white leading-relaxed">
                            {q.question_text}
                          </h5>
                          <span className="text-[10px] font-bold text-violet-400 bg-violet-950/40 border border-violet-500/20 px-2 py-0.5 rounded uppercase shrink-0">
                            {q.marks} Mark
                          </span>
                        </div>

                        {/* RENDER INPUT BASED ON TYPE */}
                        {q.question_type === "MCQ" ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
                            {(q.options || []).map((opt: any) => (
                              <label 
                                key={opt.key}
                                className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all text-xs ${
                                  studentAnswers[q.id] === opt.key
                                    ? "bg-violet-950/40 border-violet-500/50 text-white font-medium"
                                    : "border-slate-800 text-slate-400 bg-slate-950/20 hover:text-white"
                                }`}
                              >
                                <input
                                  type="radio"
                                  name={q.id}
                                  value={opt.key}
                                  checked={studentAnswers[q.id] === opt.key}
                                  onChange={(e) => setStudentAnswers({ ...studentAnswers, [q.id]: e.target.value })}
                                  className="hidden"
                                />
                                <span className="w-6 h-6 rounded bg-slate-900 border border-slate-800 flex items-center justify-center font-bold text-[10px] uppercase shrink-0">
                                  {opt.key}
                                </span>
                                <span>{opt.text}</span>
                              </label>
                            ))}
                          </div>
                        ) : (
                          <textarea
                            value={studentAnswers[q.id] || ""}
                            onChange={(e) => setStudentAnswers({ ...studentAnswers, [q.id]: e.target.value })}
                            placeholder="Write your answer here..."
                            rows={q.marks > 3 ? 5 : 3}
                            className="w-full bg-slate-950/40 border border-slate-800 focus:border-violet-500 rounded-xl py-2 px-3 text-xs text-white placeholder-slate-700 outline-none resize-none"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Submit Actions */}
          <div className="border-t border-slate-900 pt-6 flex justify-center">
            <button
              onClick={handleExamSubmit}
              className="px-8 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold tracking-wide transition-colors cursor-pointer flex items-center gap-1.5 shadow-md shadow-emerald-600/20"
            >
              <Send size={14} /> Submit Answer Sheet
            </button>
          </div>
            </>
          )}
        </div>
      )}

      {/* -------------------------------------------------------------
          SCREEN C: GRADED SCORECARD DASHBOARD (RECHARTS RADAR)
         ------------------------------------------------------------- */}
      {scorecard && (
        <div className="space-y-6">
          <div className="glass-panel p-6 rounded-2xl text-left">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-900 pb-4 mb-6">
              <div>
                <h3 className="text-xl font-bold text-white">{scorecard.examTitle}</h3>
                <p className="text-xs text-slate-500">Graded on {scorecard.date}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleDeleteScorecard}
                  className="text-xs px-4 py-2 border border-rose-900/50 hover:bg-rose-900/20 text-rose-400 rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Trash2 size={14} /> Delete Result
                </button>
                <button
                  onClick={() => setScorecard(null)}
                  className="text-xs px-4 py-2 border border-slate-800 hover:border-slate-500 rounded-xl text-slate-300 transition-all cursor-pointer"
                >
                  Done / Back
                </button>
              </div>
            </div>

            {/* Scorecard grid (Glow + Recharts Radar Chart) */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
              
              {/* Score text card */}
              <div className="md:col-span-5 p-6 rounded-2xl border border-slate-800 bg-slate-950/30 flex flex-col items-center justify-center text-center space-y-4">
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Exam Results</h4>
                
                <div className="space-y-1">
                  <div className="text-5xl font-display font-extrabold text-white">
                    {scorecard.marksObtained} <span className="text-xl text-slate-500 font-semibold">/ {scorecard.maxMarks}</span>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider border ${
                    scorecard.marksObtained / scorecard.maxMarks >= 0.4 
                      ? "border-emerald-500/20 bg-emerald-950/20 text-emerald-400" 
                      : "border-red-500/20 bg-red-950/20 text-red-400"
                  }`}>
                    {scorecard.marksObtained / scorecard.maxMarks >= 0.4 ? "Pass Score" : "Fail / Needs Study"}
                  </span>
                </div>

                <div className="border-t border-slate-900 w-full pt-4 text-xs text-slate-400 space-y-2">
                  <div className="flex justify-between">
                    <span>Performance index:</span>
                    <span className="font-semibold text-white">
                      {Math.round((scorecard.marksObtained / scorecard.maxMarks) * 100)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Target duration:</span>
                    <span className="font-semibold text-white">{scorecard.durationMinutes} minutes</span>
                  </div>
                </div>
              </div>

              {/* RECHARTS RADAR CHART (Bloom's Taxonomy) */}
              <div className="md:col-span-7 flex flex-col items-center justify-center min-h-[300px]">
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Cognitive Profile (Bloom's Taxonomy)</h4>
                
                <div className="w-full h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="80%" data={getRadarData(scorecard)}>
                      <PolarGrid stroke="#1f2937" />
                      <PolarAngleAxis dataKey="subject" stroke="#94a3b8" fontSize={9} />
                      <PolarRadiusAxis angle={30} domain={[0, 100]} stroke="#475569" fontSize={8} />
                      <Radar
                        name="Student"
                        dataKey="score"
                        stroke="#8b5cf6"
                        fill="#8b5cf6"
                        fillOpacity={0.25}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>

          {/* Question Breakdown list */}
          <div className="glass-panel p-6 rounded-2xl space-y-6 text-left">
            <h3 className="font-display font-bold text-white text-base">Graded Answer Sheet Breakdown</h3>
            
            <div className="space-y-6">
              {scorecard.answers.map((ans, idx) => (
                <div key={idx} className="p-4 rounded-xl border border-slate-900 bg-slate-950/20 space-y-4">
                  
                  {/* Heading header */}
                  <div className="flex justify-between items-start gap-4">
                    <div className="space-y-1">
                      <h4 className="text-xs font-bold text-slate-400">Question {idx + 1} ({ans.bloomsLevel})</h4>
                      <p className="text-xs text-white leading-relaxed">{ans.questionText}</p>
                    </div>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded border whitespace-nowrap ${
                      ans.marksAwarded === ans.maxMarks 
                        ? "border-emerald-500/20 bg-emerald-950/20 text-emerald-400" 
                        : ans.marksAwarded > 0 
                        ? "border-amber-500/20 bg-amber-950/20 text-amber-400" 
                        : "border-red-500/20 bg-red-950/20 text-red-400"
                    }`}>
                      {ans.marksAwarded} / {ans.maxMarks}
                    </span>
                  </div>

                  {/* Student vs Model Answer */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs border-t border-slate-900 pt-3">
                    <div className="space-y-1">
                      <span className="font-semibold text-slate-500">Your Answer:</span>
                      <p className="text-slate-300 bg-slate-950/40 p-2.5 rounded-lg border border-slate-800 min-h-[50px] whitespace-pre-wrap">
                        {ans.studentAnswer || "No answer provided."}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <span className="font-semibold text-slate-500">Model Answer:</span>
                      <p className="text-slate-300 bg-slate-950/40 p-2.5 rounded-lg border border-slate-800 min-h-[50px] whitespace-pre-wrap">
                        {ans.modelAnswer}
                      </p>
                    </div>
                  </div>

                  {/* Grader justification feedback details */}
                  <div className="p-3 rounded-lg border border-slate-900 bg-slate-950/40 space-y-2">
                    <div className="text-xs font-semibold text-slate-400">Justification:</div>
                    <p className="text-xs text-slate-300 leading-relaxed">{ans.justification}</p>

                    {ans.feedback && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 text-[10px]">
                        {ans.feedback.incorrect_points.length > 0 && (
                          <div className="space-y-1">
                            <span className="font-bold text-red-400 uppercase tracking-wide">Missing / Incorrect points:</span>
                            <ul className="list-disc pl-4 text-slate-400 space-y-1">
                              {ans.feedback.incorrect_points.map((pt, i) => <li key={i}>{pt}</li>)}
                            </ul>
                          </div>
                        )}
                        {ans.feedback.suggestions.length > 0 && (
                          <div className="space-y-1 col-span-1">
                            <span className="font-bold text-emerald-400 uppercase tracking-wide">AI Study Suggestions:</span>
                            <ul className="list-disc pl-4 text-slate-400 space-y-1">
                              {ans.feedback.suggestions.map((pt, i) => <li key={i}>{pt}</li>)}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Initial empty library notice */}
      {documents.length === 0 && !activeExam && !scorecard && (
        <div className="p-12 text-center border border-dashed border-slate-800 rounded-2xl text-slate-500 space-y-2">
          <Award className="mx-auto text-slate-600 animate-pulse" size={32} />
          <h4 className="text-sm font-semibold text-white">Create your first exam</h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            You must upload textbook chapters in the Library dashboard before generating exams.
          </p>
        </div>
      )}
    </div>
  );
}
