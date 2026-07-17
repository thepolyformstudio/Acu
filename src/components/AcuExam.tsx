"use client";

import React, { useState, useEffect } from "react";
import { DocumentSource, ExamAttempt, dbService, UserProfile } from "@/lib/db";
import { generateExamPaper, gradeWrittenAnswer } from "@/lib/gemini";
import { getBlueprintForBoard, BOARD_OPTION_GROUPS, BoardBlueprint } from "@/lib/boardBlueprints";
import { saveExamAttemptsToDrive, loadExamAttemptsFromDrive, isDriveSignedIn, loadSingleDocumentFromDrive } from "@/lib/googleDrive";
import { 
  Play, FileText, CheckCircle, RefreshCw, BarChart2, 
  ChevronRight, Award, Timer, AlertCircle, Send, Check, Trash2, Download
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

  // Blueprint state — looked up from the static database
  const [activeBlueprint, setActiveBlueprint] = useState<BoardBlueprint | null>(getBlueprintForBoard("CBSE"));
  const [userOverriddenConfig, setUserOverriddenConfig] = useState(false);

  // When the board changes, look up the blueprint and auto-populate defaults
  useEffect(() => {
    const bp = getBlueprintForBoard(selectedBoardType);
    setActiveBlueprint(bp);
    setUserOverriddenConfig(false);
    if (bp) {
      setTotalMarks(bp.totalTheoryMarks);
      setTotalQuestions(bp.totalQuestions);
      setDurationMinutes(bp.durationMinutes);
    }
  }, [selectedBoardType]);

  // Track if user has manually overridden config values away from blueprint defaults
  const handleConfigOverride = (setter: (v: number) => void, value: number) => {
    setter(value);
    if (activeBlueprint) {
      setUserOverriddenConfig(true);
    }
  };

  // Manual chapter override state
  const [manualChapterOverride, setManualChapterOverride] = useState(false);
  const [customChapterName, setCustomChapterName] = useState("");
  const [customStartPage, setCustomStartPage] = useState(1);
  const [customEndPage, setCustomEndPage] = useState(10);

  // Running Exam State
  const [activeExam, setActiveExam] = useState<any | null>(null);
  const [studentAnswers, setStudentAnswers] = useState<{ [qId: string]: string }>({});
  const [studentAnswerImages, setStudentAnswerImages] = useState<{ [qId: string]: string }>({});
  const [secondsRemaining, setSecondsRemaining] = useState(0);
  const [examRunning, setExamRunning] = useState(false);

  // Paused / Quit Session states
  const [pausedSession, setPausedSession] = useState<any | null>(null);
  const [showQuitPrompt, setShowQuitPrompt] = useState(false);

  // Graded Result Scorecard
  const [scorecard, setScorecard] = useState<ExamAttempt | null>(null);

  // Check for paused session on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("acu_paused_exam_session");
      if (stored) {
        try {
          setPausedSession(JSON.parse(stored));
        } catch (e) {
          console.error("Failed to parse paused session", e);
        }
      }
    }
  }, []);

  // Update distribution preview on config change (only used in Legacy/Custom mode)
  useEffect(() => {
    if (!activeBlueprint) {
      const dist = calculateQuestionDistribution(totalMarks, totalQuestions, activeBoard);
      setDistribution(dist);
    }
  }, [totalMarks, totalQuestions, activeBoard, activeBlueprint]);

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
    let selectedDoc = documents.find(d => d.id === chap.docId);
    if (!selectedDoc) return;
    
    // If doc metadata is loaded but pages payload is empty, fetch from Drive
    if (!selectedDoc.pages || selectedDoc.pages.length === 0) {
      setLoading(true);
      setLoadingMessage("Fetching document payload from Google Drive...");
      const fullDoc = await loadSingleDocumentFromDrive(selectedDoc.id);
      if (fullDoc) {
        selectedDoc = { ...selectedDoc, pages: fullDoc.pages };
      } else {
        alert("Could not load document payload from Google Drive. Please ensure it is synced.");
        setLoading(false);
        setLoadingMessage("");
        return;
      }
    }
    
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
      const docSubject = selectedDoc.subject || "General";
      const examPaper = await generateExamPaper(textSlices, examTitle, classGrade, activeBoard, distribution, totalMarks, docSubject, activeBlueprint);
      
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
              studentAns,
              activeBlueprint?.gradingStandard || "CBSE Board",
              studentAnswerImages[q.id]
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
        loadExamAttemptsFromDrive(activeProfileId).then((all) => {
          all.push(attemptResult);
          saveExamAttemptsToDrive(activeProfileId, all).catch(() => {});
        }).catch(() => {});
      }
      localStorage.removeItem("acu_paused_exam_session");
      setStudentAnswers({});
      setStudentAnswerImages({});
      setPausedSession(null);
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
        loadExamAttemptsFromDrive(activeProfileId).then((all) => {
          const filtered = all.filter((a: any) => a.id !== scorecard.id);
          saveExamAttemptsToDrive(activeProfileId, filtered).catch(() => {});
        }).catch(() => {});
      }
      
      setScorecard(null);
      onRefresh();
    }
  };

  // Helper to open a beautifully styled print window for PDF download
  const exportToPDF = (title: string, contentHTML: string) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Please allow popups to export PDFs.");
      return;
    }

    printWindow.document.write(`
      <html>
        <head>
          <title>${title}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
            body {
              font-family: 'Inter', sans-serif;
              color: #1e293b;
              line-height: 1.6;
              padding: 40px;
              max-width: 800px;
              margin: 0 auto;
              background-color: #ffffff;
            }
            h1 {
              font-size: 22px;
              border-bottom: 2px solid #e2e8f0;
              padding-bottom: 10px;
              color: #0f172a;
              margin-bottom: 20px;
              font-weight: 700;
            }
            h2 {
              font-size: 15px;
              color: #4f46e5;
              margin-top: 24px;
              border-bottom: 1px solid #f1f5f9;
              padding-bottom: 4px;
              font-weight: 600;
            }
            .section {
              margin-bottom: 24px;
              page-break-inside: avoid;
            }
            .mcq-item {
              margin-bottom: 16px;
              page-break-inside: avoid;
              background: #f8fafc;
              padding: 16px;
              border-radius: 8px;
              border: 1px solid #e2e8f0;
            }
            .mcq-q {
              font-weight: 600;
              margin-bottom: 10px;
              font-size: 13px;
              color: #0f172a;
            }
            .mcq-option {
              margin-left: 10px;
              margin-bottom: 6px;
              font-size: 12px;
              color: #334155;
            }
            .mcq-ans {
              margin-top: 8px;
              font-weight: 600;
              color: #059669;
              font-size: 12px;
            }
            .grading-rubric {
              font-size: 11px;
              background: #fffbeb;
              border: 1px solid #fef3c7;
              color: #b45309;
              padding: 8px 12px;
              margin-top: 8px;
              border-radius: 6px;
            }
            @media print {
              body {
                padding: 0;
              }
            }
          </style>
        </head>
        <body>
          <h1>${title}</h1>
          ${contentHTML}
          <script>
            window.onload = function() {
              window.print();
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleExportExamPDF = () => {
    if (!activeExam) return;
    const html = activeExam.sections.map((sec: any) => {
      const qHTML = sec.questions.map((q: any, idx: number) => {
        let qContent = `<div class="mcq-q">Q${idx + 1} [${q.marks} Mark(s) - Bloom's: ${q.blooms_level || "Understanding"}]: ${q.question_text}</div>`;
        if (q.question_type === "MCQ" && q.options) {
          qContent += (q.options || []).map((o: any) => `
            <div class="mcq-option">(${o.key}) ${o.text}</div>
          `).join("");
        }

        qContent += `
          <div class="mcq-ans" style="margin-top:8px;">Model Answer / Guideline: <span style="font-weight:normal;color:#334155;">${q.model_answer}</span></div>
          <div class="grading-rubric">Grading Rubric: ${q.grading_rubric}</div>
        `;
        return `<div class="mcq-item">${qContent}</div>`;
      }).join("");

      return `
        <div class="section">
          <h2>Section ${sec.section_letter}: ${sec.section_title || "Questions"}</h2>
          <p><em>Instructions: ${sec.instructions}</em></p>
          ${qHTML}
        </div>
      `;
    }).join("");

    exportToPDF(`${activeExam.title} - Question Paper & Answer Key`, html);
  };

  const handlePauseToggle = () => {
    const nextState = !examRunning;
    setExamRunning(nextState);

    if (!nextState && activeExam) {
      // Pause: Save state to localStorage
      const session = {
        activeExam,
        studentAnswers,
        studentAnswerImages,
        secondsRemaining,
        selectedSubject,
        selectedChapterKey,
        examTitle,
        classGrade,
        totalQuestions,
        totalMarks,
        durationMinutes,
        selectedBoardType,
        customBoardText
      };
      localStorage.setItem("acu_paused_exam_session", JSON.stringify(session));
    } else {
      // Resume: Clear active paused storage
      localStorage.removeItem("acu_paused_exam_session");
    }
  };

  const handleResumePausedExam = () => {
    if (!pausedSession) return;

    setExamTitle(pausedSession.examTitle);
    setSelectedSubject(pausedSession.selectedSubject);
    setSelectedChapterKey(pausedSession.selectedChapterKey);
    setClassGrade(pausedSession.classGrade);
    setTotalQuestions(pausedSession.totalQuestions);
    setTotalMarks(pausedSession.totalMarks);
    setDurationMinutes(pausedSession.durationMinutes);
    setSelectedBoardType(pausedSession.selectedBoardType);
    setCustomBoardText(pausedSession.customBoardText);

    setActiveExam(pausedSession.activeExam);
    setStudentAnswers(pausedSession.studentAnswers);
    setSecondsRemaining(pausedSession.secondsRemaining);
    if (pausedSession.studentAnswerImages) {
      setStudentAnswerImages(pausedSession.studentAnswerImages);
    }

    setExamRunning(true);
    setPausedSession(null);
  };

  const handleDiscardPausedExam = () => {
    if (confirm("Are you sure you want to discard this paused exam session? All progress will be lost.")) {
      localStorage.removeItem("acu_paused_exam_session");
      setPausedSession(null);
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
      {/* Paused Session Prompt Banner */}
      {pausedSession && !activeExam && !scorecard && (
        <div className="glass-panel p-4 rounded-xl border border-amber-500/20 bg-amber-950/10 text-left flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fade-in">
          <div>
            <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider">Paused Exam Session Detected</h4>
            <p className="text-sm font-semibold text-white mt-1">"{pausedSession.examTitle}" — {pausedSession.selectedSubject}</p>
            <p className="text-[10px] text-slate-500 mt-0.5">{pausedSession.totalQuestions} questions · {pausedSession.totalMarks} marks · {Math.ceil(pausedSession.secondsRemaining / 60)} minutes left</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleResumePausedExam}
              className="py-1.5 px-4 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold transition-all cursor-pointer shadow-md shadow-amber-600/10"
            >
              Resume Exam
            </button>
            <button
              onClick={handleDiscardPausedExam}
              className="py-1.5 px-3 border border-slate-800 hover:border-red-900/40 text-slate-400 hover:text-red-400 rounded-lg text-xs transition-colors cursor-pointer"
            >
              Discard
            </button>
          </div>
        </div>
      )}

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
                    {BOARD_OPTION_GROUPS.map((group) => (
                      <optgroup key={group.label} label={group.label}>
                        {group.options.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.display}</option>
                        ))}
                      </optgroup>
                    ))}
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
                    onChange={(e) => handleConfigOverride(setTotalQuestions, Math.max(1, Number(e.target.value)))}
                    className="w-full bg-slate-950/60 border border-slate-800 focus:border-violet-500 rounded-xl py-2 px-3 text-xs text-white outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Total Marks</label>
                  <input
                    type="number"
                    min={1}
                    value={totalMarks}
                    onChange={(e) => handleConfigOverride(setTotalMarks, Math.max(1, Number(e.target.value)))}
                    className="w-full bg-slate-950/60 border border-slate-800 focus:border-violet-500 rounded-xl py-2 px-3 text-xs text-white outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Duration (Minutes)</label>
                  <input
                    type="number"
                    min={1}
                    value={durationMinutes}
                    onChange={(e) => handleConfigOverride(setDurationMinutes, Math.max(1, Number(e.target.value)))}
                    className="w-full bg-slate-950/60 border border-slate-800 focus:border-violet-500 rounded-xl py-2 px-3 text-xs text-white outline-none"
                  />
                </div>
              </div>

              {/* Override warning */}
              {activeBlueprint && userOverriddenConfig && (
                <div className="flex items-center gap-2 p-3 rounded-xl border border-amber-500/30 bg-amber-950/20 text-amber-400 text-xs">
                  <AlertCircle size={14} />
                  <span>Custom configuration differs from the official {activeBlueprint.boardAbbreviation} {activeBlueprint.academicYear} blueprint.</span>
                </div>
              )}

              {/* Blueprint Preview Card OR Legacy Distribution Preview */}
              {activeBlueprint ? (
                <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/40 text-left space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                      📋 {activeBlueprint.boardAbbreviation} {activeBlueprint.academicYear} Blueprint · {activeBlueprint.totalTheoryMarks} marks · {activeBlueprint.totalQuestions} Qs
                    </div>
                    <span className="text-[9px] text-slate-600">Verified {activeBlueprint.lastVerified}</span>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    {activeBlueprint.sections.map((sec) => (
                      <div key={sec.sectionLetter} className="py-1 px-3 rounded-lg bg-slate-900 border border-slate-800 text-slate-300">
                        {sec.sectionLetter}: <span className="font-bold text-violet-400">
                          {sec.questionTypes.map((qt) => `${qt.count} ${qt.type}`).join(" + ")}
                        </span> = {sec.totalMarks}m
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-3 text-[10px] text-slate-500">
                    {activeBlueprint.competencyBasedPercent && (
                      <span>🎯 {activeBlueprint.competencyBasedPercent}% Competency-Based</span>
                    )}
                    {activeBlueprint.negativeMarking && (
                      <span className="text-red-400">⚠ Negative Marking</span>
                    )}
                    <span>⏱ {activeBlueprint.durationMinutes} min</span>
                    <span>📝 {activeBlueprint.examMode}</span>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/40 text-left">
                  <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    📊 Auto-Calculated Marking Distribution (Legacy Mode)
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
              )}

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
              <p className="text-xs text-slate-500">{activeBlueprint ? `${activeBlueprint.boardAbbreviation} ${activeBlueprint.academicYear} Blueprint` : "Board Standard Exam Blueprint"}</p>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={handleExportExamPDF}
                className="py-2 px-3 border border-slate-800 bg-slate-950 hover:bg-slate-900 text-slate-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Download size={14} /> Export PDF
              </button>
              <button
                onClick={handlePauseToggle}
                className="py-2 px-3 border border-slate-800 bg-slate-950 hover:bg-slate-900 text-slate-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                {examRunning ? "Pause Exam" : "Resume Exam"}
              </button>
              <button
                onClick={() => setShowQuitPrompt(true)}
                className="py-2 px-3 bg-red-950/20 border border-red-900/35 text-red-400 hover:bg-red-900 hover:text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                Quit Exam
              </button>
              <div className="flex items-center gap-2 py-2 px-4 rounded-xl border border-amber-500/20 bg-amber-950/20 text-amber-400 font-display font-bold">
                <Timer size={18} />
                <span>{formatTimer(secondsRemaining)}</span>
              </div>
            </div>
          </div>

          {/* Exam Questions Form */}
          <div className="relative">
            {!examRunning && (
              <div className="absolute inset-0 z-30 bg-[#0b0c10]/95 backdrop-blur-md flex flex-col items-center justify-center p-8 rounded-2xl border border-slate-850">
                <AlertCircle className="text-amber-400 mb-2" size={32} />
                <h4 className="text-lg font-bold text-white mb-1">Exam is Paused</h4>
                <p className="text-xs text-slate-500 mb-4 max-w-xs text-center leading-relaxed">
                  Questions are hidden to maintain test integrity. Click Resume to continue.
                </p>
                <button
                  onClick={handlePauseToggle}
                  className="px-6 py-2.5 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-xs font-bold tracking-wide transition-all cursor-pointer shadow-lg shadow-violet-600/20"
                >
                  Resume Exam
                </button>
              </div>
            )}
            
            <div className={`space-y-8 ${!examRunning ? 'opacity-10 filter blur-sm pointer-events-none' : ''}`}>
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
                          <div className="space-y-3">
                            <textarea
                              value={studentAnswers[q.id] || ""}
                              onChange={(e) => setStudentAnswers({ ...studentAnswers, [q.id]: e.target.value })}
                              placeholder="Write your answer here..."
                              rows={q.marks > 3 ? 5 : 3}
                              className="w-full bg-slate-950/40 border border-slate-800 focus:border-violet-500 rounded-xl py-2 px-3 text-xs text-white placeholder-slate-700 outline-none resize-none"
                              disabled={!!studentAnswerImages[q.id]}
                            />
                            
                            <div className="flex items-center gap-2 pt-1">
                              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Or</span>
                              <div className="relative">
                                <input
                                  type="file"
                                  accept="image/*"
                                  id={`handwritten-file-upload-${q.id}`}
                                  onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                      const reader = new FileReader();
                                      reader.onloadend = () => {
                                        setStudentAnswerImages({
                                          ...studentAnswerImages,
                                          [q.id]: reader.result as string
                                        });
                                      };
                                      reader.readAsDataURL(file);
                                    }
                                  }}
                                  className="hidden"
                                />
                                <label
                                  htmlFor={`handwritten-file-upload-${q.id}`}
                                  className="flex items-center gap-1.5 py-1 px-3 border border-violet-500/25 bg-violet-950/20 hover:bg-violet-900 text-violet-400 hover:text-white rounded-lg text-[10px] font-semibold transition-all cursor-pointer"
                                >
                                  📷 Upload Handwritten Answer Sheet
                                </label>
                              </div>
                              
                              {studentAnswerImages[q.id] && (
                                <div className="flex items-center gap-2">
                                  <span className="text-[9px] text-emerald-400 font-semibold flex items-center gap-1">
                                    <Check size={11} /> Image Attached
                                  </span>
                                  <button
                                    onClick={() => {
                                      const newImages = { ...studentAnswerImages };
                                      delete newImages[q.id];
                                      setStudentAnswerImages(newImages);
                                    }}
                                    className="text-[9px] text-rose-450 hover:text-rose-350 font-semibold underline cursor-pointer"
                                  >
                                    Remove
                                  </button>
                                </div>
                              )}
                            </div>

                            {studentAnswerImages[q.id] && (
                              <div className="relative w-full max-w-[200px] aspect-[4/3] rounded-lg overflow-hidden border border-slate-800 mt-2 bg-slate-950/45">
                                <img
                                  src={studentAnswerImages[q.id]}
                                  alt="Attached answer sheet preview"
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
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
      {/* Quit Exam Session Prompt Modal */}
      {showQuitPrompt && (
        <div className="fixed inset-0 z-50 bg-[#0b0c10]/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel p-6 rounded-2xl max-w-sm w-full text-center space-y-4 border border-slate-800 animate-fade-in">
            <AlertCircle size={32} className="text-red-400 mx-auto" />
            <div>
              <h4 className="text-base font-bold text-white">Quit Active Exam</h4>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                What would you like to do with this exam attempt?
              </p>
            </div>
            
            <div className="flex flex-col gap-2 pt-2">
              <button
                onClick={() => {
                  setShowQuitPrompt(false);
                  handleExamSubmit();
                }}
                className="w-full py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                Submit & Grade Current Answers
              </button>
              
              <button
                onClick={() => {
                  setShowQuitPrompt(false);
                  setExamRunning(false);
                  const session = {
                    activeExam,
                    studentAnswers,
                    studentAnswerImages,
                    secondsRemaining,
                    selectedSubject,
                    selectedChapterKey,
                    examTitle,
                    classGrade,
                    totalQuestions,
                    totalMarks,
                    durationMinutes,
                    selectedBoardType,
                    customBoardText
                  };
                  localStorage.setItem("acu_paused_exam_session", JSON.stringify(session));
                  setPausedSession(session);
                  setActiveExam(null); // return to Screen A
                }}
                className="w-full py-2 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-350 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                Pause & Save for Later
              </button>
              
              <button
                onClick={() => {
                  if (confirm("Are you sure you want to discard this exam? All answers and progress will be permanently lost.")) {
                    setShowQuitPrompt(false);
                    setExamRunning(false);
                    localStorage.removeItem("acu_paused_exam_session");
                    setPausedSession(null);
                    setActiveExam(null); // return to Screen A
                  }
                }}
                className="w-full py-2 bg-red-950/20 border border-red-900/30 hover:bg-red-900 hover:text-white text-red-400 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                Discard & Quit
              </button>
              
              <button
                onClick={() => setShowQuitPrompt(false)}
                className="w-full py-2 border border-slate-900 hover:border-slate-800 text-slate-500 hover:text-slate-400 rounded-xl text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
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
