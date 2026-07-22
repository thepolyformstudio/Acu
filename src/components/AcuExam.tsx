"use client";

import React, { useState, useEffect } from "react";
import { DocumentSource, ExamAttempt, dbService, UserProfile } from "@/lib/db";
import { generateExamPaper, gradeWrittenAnswer } from "@/lib/gemini";
import { getBlueprintForBoard, buildIeltsModuleBlueprint, BOARD_OPTION_GROUPS, BoardBlueprint } from "@/lib/boardBlueprints";
import { CAMBRIDGE_19_BENCHMARK_PAPER } from "@/lib/ieltsCorpus";
import { saveExamAttemptsToDrive, loadExamAttemptsFromDrive, isDriveSignedIn } from "@/lib/googleDrive";
import { hydrateDocumentPayload } from "@/lib/docHydrator";
import { 
  Play, Pause, Mic, MicOff, Volume2, FileText, CheckCircle, RefreshCw, BarChart2, 
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
  const [selectedChapterKeys, setSelectedChapterKeys] = useState<string[]>([]);
  const [selectAllChapters, setSelectAllChapters] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");

  // Build unique subject list from all documents plus global default subjects (e.g. IELTS)
  const DEFAULT_GLOBAL_SUBJECTS = ["IELTS (English Proficiency)"];
  const subjectsList = [...new Set([...DEFAULT_GLOBAL_SUBJECTS, ...documents.map(d => d.subject || "General")])];

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
  const [durationMinutes, setDurationMinutes] = useState<number | string>(30);
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
  const [customStartPage, setCustomStartPage] = useState<number | string>(1);
  const [customEndPage, setCustomEndPage] = useState<number | string>(10);

  // IELTS Exam Configurator State
  const [ieltsTrack, setIeltsTrack] = useState<"Academic" | "General">("Academic");
  const [ieltsSourceMode, setIeltsSourceMode] = useState<"ai_generator" | "benchmark_corpus">("ai_generator");
  const [ieltsModules, setIeltsModules] = useState<{ [key: string]: boolean }>({
    reading: true,
    writing: true,
    listening: true,
    speaking: true,
  });

  // Audio Playback & Mic STT State
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [activeAudioQuestionId, setActiveAudioQuestionId] = useState<string | null>(null);
  const [isRecordingMic, setIsRecordingMic] = useState<string | null>(null);

  // Restructured Exam Configurator & Custom Builder State
  const [chapterSearchFilter, setChapterSearchFilter] = useState("");
  const [creationMode, setCreationMode] = useState<"official_blueprint" | "custom_builder">("official_blueprint");

  interface CustomQuestionTypeState {
    id: string;
    name: string;
    description: string;
    enabled: boolean;
    count: number | string;
    marksPerQuestion: number | string;
  }

  const [customQuestionTypes, setCustomQuestionTypes] = useState<CustomQuestionTypeState[]>([
    { id: "mcq", name: "Multiple Choice Questions (MCQ)", description: "Single-choice objective items", enabled: true, count: 10, marksPerQuestion: 1 },
    { id: "true_false", name: "True / False", description: "Binary boolean statements", enabled: false, count: 5, marksPerQuestion: 1 },
    { id: "vsa", name: "Very Short Answers (VSA)", description: "1-2 sentence definitions & facts", enabled: true, count: 5, marksPerQuestion: 2 },
    { id: "sa", name: "Short Answers (SA)", description: "Short explanatory analytical questions", enabled: true, count: 4, marksPerQuestion: 3 },
    { id: "la", name: "Long Answers (LA)", description: "In-depth multi-part descriptive questions", enabled: true, count: 2, marksPerQuestion: 5 },
    { id: "comprehension", name: "Comprehension / Passage-Based", description: "Case passage followed by sub-questions", enabled: false, count: 1, marksPerQuestion: 5 },
    { id: "case_study", name: "Case Study / Assertion-Reasoning", description: "Real-world context & logical reasoning", enabled: false, count: 1, marksPerQuestion: 4 },
  ]);

  const activeCustomTypes = customQuestionTypes.filter(t => t.enabled && (Number(t.count) || 0) > 0);
  const customTotalQuestions = activeCustomTypes.reduce((acc, t) => acc + (parseInt(String(t.count), 10) || 0), 0);
  const customTotalMarks = activeCustomTypes.reduce((acc, t) => acc + ((parseInt(String(t.count), 10) || 0) * (parseInt(String(t.marksPerQuestion), 10) || 0)), 0);

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

  // Dynamically update IELTS test duration based on selected Track & Modules
  useEffect(() => {
    if (selectedSubject && selectedSubject.includes("IELTS")) {
      if (ieltsSourceMode === "benchmark_corpus") {
        setDurationMinutes(120);
      } else {
        const { durationMinutes: targetDuration } = buildIeltsModuleBlueprint(ieltsTrack, ieltsModules);
        setDurationMinutes(targetDuration);
      }
    }
  }, [selectedSubject, ieltsTrack, ieltsModules, ieltsSourceMode]);

  // Web Speech Synthesis Audio Handler for Listening Passages
  const handleToggleListeningAudio = (qId: string, textToSpeak: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      alert("Audio playback is not supported on this browser.");
      return;
    }

    if (isPlayingAudio && activeAudioQuestionId === qId) {
      window.speechSynthesis.cancel();
      setIsPlayingAudio(false);
      setActiveAudioQuestionId(null);
      return;
    }

    window.speechSynthesis.cancel();
    const cleanText = textToSpeak.replace(/(Audio Transcript|Section|Instructions|Question[\s\S]*?$)/gi, "").trim();
    const utterance = new SpeechSynthesisUtterance(cleanText || textToSpeak);
    utterance.rate = 0.92; // Natural, clear IELTS listening pace
    utterance.pitch = 1.0;
    
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(v => v.lang.includes("en-GB") || v.lang.includes("en-AU") || v.lang.includes("en"));
    if (preferredVoice) utterance.voice = preferredVoice;

    utterance.onend = () => {
      setIsPlayingAudio(false);
      setActiveAudioQuestionId(null);
    };
    utterance.onerror = () => {
      setIsPlayingAudio(false);
      setActiveAudioQuestionId(null);
    };

    window.speechSynthesis.speak(utterance);
    setIsPlayingAudio(true);
    setActiveAudioQuestionId(qId);
  };

  // Web Speech Recognition (Mic STT) Handler for Speaking Responses
  const handleToggleMicRecording = (qId: string) => {
    if (typeof window === "undefined") return;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Speech-to-Text recording requires Google Chrome or Microsoft Edge browser.");
      return;
    }

    if (isRecordingMic === qId) {
      setIsRecordingMic(null);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      recognition.onresult = (event: any) => {
        let transcript = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        setStudentAnswers(prev => ({
          ...prev,
          [qId]: (prev[qId] ? prev[qId] + " " : "") + transcript
        }));
      };

      recognition.onerror = (err: any) => {
        console.error("STT Error:", err);
        setIsRecordingMic(null);
      };

      recognition.onend = () => {
        setIsRecordingMic(null);
      };

      recognition.start();
      setIsRecordingMic(qId);
    } catch (err: any) {
      alert("Microphone access error: " + err.message);
      setIsRecordingMic(null);
    }
  };

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
    // ── Manual override path (custom page range) ──────────────────────────────
    if (manualChapterOverride) {
      // For manual override we still need exactly one document selected via subject
      const subjectDocs = documents.filter(d => (d.subject || "General") === selectedSubject);
      if (subjectDocs.length === 0) {
        alert("Please select a subject first.");
        return;
      }
      if (!customChapterName.trim()) {
        alert("Please enter a custom Chapter / Topic name.");
        return;
      }
      const parsedStart = parseInt(String(customStartPage), 10);
      const startP = Math.max(1, isNaN(parsedStart) ? 1 : parsedStart);
      let selectedDoc = subjectDocs[0];
      if (!selectedDoc.pages || selectedDoc.pages.length === 0) {
        setLoading(true);
        setLoadingMessage(`Loading payload for "${selectedDoc.name}"...`);
        try {
          selectedDoc = await hydrateDocumentPayload(selectedDoc, user?.id || "anonymous");
        } catch (hErr: any) {
          alert(hErr.message || "Could not load document payload.");
          setLoading(false);
          setLoadingMessage("");
          return;
        }
      }
      const parsedEnd = parseInt(String(customEndPage), 10);
      const endP = Math.min(selectedDoc.pages.length, isNaN(parsedEnd) ? selectedDoc.pages.length : parsedEnd);
      if (startP > endP) {
        alert("Start page cannot be greater than end page.");
        return;
      }

      setLoading(true);
      setLoadingMessage("Gemini is reading textbook text...");
      try {
        const textSlices = selectedDoc.pages
          .filter(p => p.pageNumber >= startP && p.pageNumber <= endP)
          .map(p => p.text)
          .join("\n\n");
        if (textSlices.trim().length === 0) throw new Error("No readable text content in the selected page range.");
        setLoadingMessage("Creating board blueprint paper questions...");
        const docSubject = selectedDoc.subject || "General";
        const isCustomMode = creationMode === "custom_builder";
        const customSpecs = isCustomMode 
          ? activeCustomTypes.map(t => ({
              type: t.name,
              count: parseInt(String(t.count), 10) || 1,
              marksPerQuestion: parseInt(String(t.marksPerQuestion), 10) || 1
            }))
          : null;
        const paperTotalMarks = isCustomMode ? customTotalMarks : totalMarks;
        const paperBlueprint = isCustomMode ? null : activeBlueprint;
        const finalDuration = parseInt(String(durationMinutes), 10) || 30;

        const examPaper = await generateExamPaper(
          textSlices, 
          examTitle, 
          classGrade, 
          activeBoard, 
          distribution, 
          paperTotalMarks, 
          docSubject, 
          paperBlueprint, 
          customSpecs
        );
        let questionIndex = 1;
        examPaper.sections.forEach((sec: any) => { sec.questions.forEach((q: any) => { q.id = `q_${questionIndex}`; questionIndex++; }); });
        examPaper.title = examTitle;
        examPaper.maxMarks = paperTotalMarks;
        examPaper.durationMinutes = finalDuration;
        examPaper.subject = docSubject;
        examPaper.documentId = selectedDoc.id;
        examPaper.chapterName = customChapterName.trim();
        setActiveExam(examPaper);
        setStudentAnswers({});
        setSecondsRemaining(finalDuration * 60);
        setExamRunning(true);
        setScorecard(null);
      } catch (err: any) {
        alert("Generation failed: " + (err.message || String(err)));
      } finally {
        setLoading(false);
        setLoadingMessage("");
      }
      return;
    }

    // ── Normal multi-chapter path ─────────────────────────────────────────────
    const chaptersToUse = selectAllChapters
      ? flatChapters
      : flatChapters.filter(c => selectedChapterKeys.includes(`${c.docId}_${c.chapIdx}`));

    // ── IELTS Global Test Paper Path (No user document required) ─────────────
    if (selectedSubject.includes("IELTS") && chaptersToUse.length === 0) {
      // 1. Frozen Benchmark Test Path (Cambridge 19)
      if (ieltsSourceMode === "benchmark_corpus") {
        setLoading(true);
        setLoadingMessage("Loading Cambridge IELTS 19 Official Benchmark Test...");
        setTimeout(() => {
          setActiveExam(CAMBRIDGE_19_BENCHMARK_PAPER);
          setStudentAnswers({});
          setSecondsRemaining(120 * 60);
          setExamRunning(true);
          setScorecard(null);
          setLoading(false);
          setLoadingMessage("");
        }, 400);
        return;
      }

      // 2. Dynamic AI Generation Path
      const activeModuleNames = Object.entries(ieltsModules)
        .filter(([_, active]) => active)
        .map(([key]) => key.charAt(0).toUpperCase() + key.slice(1))
        .join(" & ");

      setLoading(true);
      setLoadingMessage(`Generating IELTS ${ieltsTrack} ${activeModuleNames || "Test"} Paper...`);
      try {
        const { blueprint: paperBlueprint, durationMinutes: targetDuration, totalMarks: paperTotalMarks } = buildIeltsModuleBlueprint(ieltsTrack, ieltsModules);
        const paperBoard = `IELTS ${ieltsTrack}`;
        const ieltsTextSlices = `[CAMBRIDGE IELTS 19 BENCHMARK STANDARDS]\n${ieltsTrack} Track (${activeModuleNames} Modules). Official test specifications: Reading passages, Writing Task 1 & 2 prompts, Listening dialogues, Speaking cue cards.`;

        const examPaper = await generateExamPaper(
          ieltsTextSlices,
          `IELTS ${ieltsTrack} (${activeModuleNames}) Test`,
          classGrade,
          paperBoard,
          distribution,
          paperTotalMarks,
          `IELTS (${ieltsTrack})`,
          paperBlueprint,
          null
        );

        let questionIndex = 1;
        examPaper.sections.forEach((sec: any) => {
          sec.questions.forEach((q: any) => {
            q.id = `q_${questionIndex}`;
            questionIndex++;
          });
        });

        examPaper.title = `IELTS ${ieltsTrack} ${activeModuleNames || "Practice"} Test`;
        examPaper.maxMarks = paperTotalMarks;
        examPaper.durationMinutes = targetDuration;
        examPaper.subject = `IELTS (${ieltsTrack})`;
        examPaper.documentId = "ielts_global_corpus";
        examPaper.chapterName = `${ieltsTrack} (${activeModuleNames || "Standard"}) Test`;

        setActiveExam(examPaper);
        setStudentAnswers({});
        setSecondsRemaining(targetDuration * 60);
        setExamRunning(true);
        setScorecard(null);
      } catch (err: any) {
        alert("IELTS Generation failed: " + (err.message || String(err)));
      } finally {
        setLoading(false);
        setLoadingMessage("");
      }
      return;
    }

    setLoading(true);
    setLoadingMessage("Fetching document payloads...");

    try {
      // Group selected chapters by document so we only fetch each doc once
      const docIdSet = [...new Set(chaptersToUse.map(c => c.docId))];
      const resolvedDocs: Record<string, DocumentSource> = {};

      for (const docId of docIdSet) {
        let doc = documents.find(d => d.id === docId);
        if (!doc) continue;
        if (!doc.pages || doc.pages.length === 0) {
          setLoadingMessage(`Loading payload for "${doc.name}"...`);
          try {
            doc = await hydrateDocumentPayload(doc, user?.id || "anonymous");
          } catch (hErr: any) {
            throw new Error(`Could not load document "${doc.name}". ${hErr.message || ""}`);
          }
        }
        resolvedDocs[docId] = doc;
      }

      setLoadingMessage("Gemini is reading textbook text...");

      // Collect text slices for every selected chapter in reading order
      const allTextParts: string[] = [];
      for (const chap of chaptersToUse) {
        const doc = resolvedDocs[chap.docId];
        if (!doc) continue;
        const slice = doc.pages
          .filter(p => p.pageNumber >= chap.startPage && p.pageNumber <= chap.endPage)
          .map(p => p.text)
          .join("\n\n");
        if (slice.trim()) allTextParts.push(`=== ${chap.name} ===\n${slice}`);
      }

      const textSlices = allTextParts.join("\n\n");
      if (textSlices.trim().length === 0) {
        throw new Error("No readable text content found in the selected chapters.");
      }

      // Derive a human-readable chapter label
      const chapLabel = selectAllChapters
        ? `Entire Subject — ${selectedSubject}`
        : chaptersToUse.length === 1
          ? chaptersToUse[0].name
          : `${chaptersToUse.length} Chapters (${chaptersToUse.map(c => c.name).join(", ")})`;

      setLoadingMessage("Creating question paper...");
      const docSubject = selectedSubject || "General";
      const isCustomMode = creationMode === "custom_builder";
      const customSpecs = isCustomMode 
        ? activeCustomTypes.map(t => ({
            type: t.name,
            count: parseInt(String(t.count), 10) || 1,
            marksPerQuestion: parseInt(String(t.marksPerQuestion), 10) || 1
          }))
        : null;
      const paperTotalMarks = isCustomMode ? customTotalMarks : totalMarks;
      const paperBlueprint = isCustomMode ? null : activeBlueprint;
      const finalDuration = parseInt(String(durationMinutes), 10) || 30;

      const examPaper = await generateExamPaper(
        textSlices, 
        examTitle, 
        classGrade, 
        activeBoard, 
        distribution, 
        paperTotalMarks, 
        docSubject, 
        paperBlueprint, 
        customSpecs
      );

      let questionIndex = 1;
      examPaper.sections.forEach((sec: any) => {
        sec.questions.forEach((q: any) => {
          q.id = `q_${questionIndex}`;
          questionIndex++;
        });
      });

      examPaper.title = examTitle;
      examPaper.maxMarks = paperTotalMarks;
      examPaper.durationMinutes = finalDuration;
      examPaper.subject = docSubject;
      examPaper.documentId = chaptersToUse[0].docId;
      examPaper.chapterName = chapLabel;

      setActiveExam(examPaper);
      setStudentAnswers({});
      setSecondsRemaining(finalDuration * 60);
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
        durationMinutes: typeof durationMinutes === "number" ? durationMinutes : (parseInt(String(durationMinutes), 10) || 30),
        date: new Date().toLocaleDateString(),
        bloomsAnalytics,
        answers: gradedAnswers
      };

      await dbService.saveExamAttempt(activeProfileId, attemptResult);
      // Async backup exam results to Google Drive (non-blocking)
      if (isDriveSignedIn()) {
        loadExamAttemptsFromDrive(activeProfileId).then((all) => {
          all.push(attemptResult);
          saveExamAttemptsToDrive(activeProfileId, all).catch((err) => console.error("[Acu] Drive sync error:", err));
        }).catch((err) => console.error("[Acu] Drive sync error:", err));
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
          saveExamAttemptsToDrive(activeProfileId, filtered).catch((err) => console.error("[Acu] Drive sync error:", err));
        }).catch((err) => console.error("[Acu] Drive sync error:", err));
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
            .page-break {
              page-break-before: always;
              break-before: page;
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

    // 1. Generate the Question Paper HTML (without answers & rubrics)
    const questionPaperHTML = activeExam.sections.map((sec: any) => {
      const qHTML = sec.questions.map((q: any, idx: number) => {
        let qContent = `<div class="mcq-q">Q${idx + 1} [${q.marks} Mark(s) - Bloom's: ${q.blooms_level || "Understanding"}]: ${q.question_text}</div>`;
        if (q.question_type === "MCQ" && q.options) {
          qContent += (q.options || []).map((o: any) => `
            <div class="mcq-option">(${o.key}) ${o.text}</div>
          `).join("");
        }
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

    // 2. Generate the Answer Key HTML (with answers & rubrics)
    const answerKeyHTML = activeExam.sections.map((sec: any) => {
      const aHTML = sec.questions.map((q: any, idx: number) => {
        let qContent = `<div class="mcq-q">Q${idx + 1}: ${q.question_text}</div>`;
        qContent += `
          <div class="mcq-ans" style="margin-top:8px;">Model Answer / Guideline: <span style="font-weight:normal;color:#334155;">${q.model_answer}</span></div>
          <div class="grading-rubric">Grading Rubric: ${q.grading_rubric}</div>
        `;
        return `<div class="mcq-item">${qContent}</div>`;
      }).join("");

      return `
        <div class="section">
          <h2>Section ${sec.section_letter}: ${sec.section_title || "Questions"} — Answer Key</h2>
          ${aHTML}
        </div>
      `;
    }).join("");

    // Combine both with a page break element
    const combinedHTML = `
      <div class="question-paper-section">
        ${questionPaperHTML}
      </div>
      <div class="page-break">
        <h1 style="margin-top: 40px; border-top: 2px dashed #cbd5e1; padding-top: 20px;">Answer Key & Grading Rubrics</h1>
        ${answerKeyHTML}
      </div>
    `;

    exportToPDF(`${activeExam.title} - Question Paper & Answer Key`, combinedHTML);
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
        selectedChapterKeys,
        selectAllChapters,
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
    setSelectedChapterKeys(pausedSession.selectedChapterKeys ?? []);
    setSelectAllChapters(pausedSession.selectAllChapters ?? false);
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
        <div className="space-y-6">
          {/* Header Banner */}
          <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-violet-500/20 shadow-[0_0_30px_rgba(139,92,246,0.1)] relative overflow-hidden text-left">
            <div className="absolute top-0 right-0 w-64 h-64 bg-violet-600/10 blur-[80px] pointer-events-none rounded-full"></div>
            <h2 className="text-2xl sm:text-3xl font-display font-extrabold text-white mb-1">AcuExam Paper Generator</h2>
            <p className="text-slate-400 text-sm font-medium">Generate CBSE & Board-aligned exam papers or build your own custom question paper pattern.</p>
          </div>

          {loading ? (
            <div className="glass-panel p-12 rounded-3xl text-center space-y-4">
              <RefreshCw className="animate-spin text-violet-400 mx-auto" size={32} />
              <h4 className="text-base font-bold text-white">{loadingMessage}</h4>
              <p className="text-xs text-slate-500">Acu AI is structuring questions, model answers, and evaluation rubrics...</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* -------------------------------------------------------------
                  STEP 1: SYLLABUS & CHAPTER SELECTION CARD
                 ------------------------------------------------------------- */}
              <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-6 text-left">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
                  <div>
                    <span className="text-[10px] font-bold text-violet-400 uppercase tracking-widest px-2.5 py-1 bg-violet-500/10 rounded-md border border-violet-500/20">Step 1</span>
                    <h3 className="text-lg font-bold text-white mt-1">Target Subject & Chapter Selection</h3>
                  </div>

                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors">
                      <input
                        type="checkbox"
                        checked={manualChapterOverride}
                        onChange={(e) => setManualChapterOverride(e.target.checked)}
                        className="accent-violet-500 cursor-pointer w-4 h-4 rounded"
                      />
                      <span>Input Topic / Page Range Manually</span>
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                  {/* Subject Dropdown */}
                  <div className="space-y-1.5 md:col-span-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Select Subject</label>
                    <select
                      value={selectedSubject}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSelectedSubject(val);
                        setSelectedChapterKeys([]);
                        setSelectAllChapters(false);
                        if (val.includes("IELTS")) {
                          setSelectedBoardType(`IELTS ${ieltsTrack}`);
                          setExamTitle("IELTS Practice Test");
                          setClassGrade("Medium (Band 6.5 - 7.5)");
                        }
                      }}
                      className="w-full bg-slate-950/80 border border-slate-800 focus:border-violet-500 rounded-xl py-2.5 px-3 text-xs font-semibold text-white outline-none cursor-pointer"
                    >
                      <option value="">-- Choose Subject --</option>
                      {subjectsList.map((s) => {
                        const count = documents
                          .filter(d => (d.subject || "General") === s)
                          .reduce((acc, d) => acc + (d.chapterMap?.length || 0), 0);
                        return <option key={s} value={s}>{s} {count > 0 ? `(${count} chapters available)` : "(Default Global Subject)"}</option>;
                      })}
                    </select>
                  </div>

                  {/* Chapter Search Filter (when not manual override & not IELTS default) */}
                  {!manualChapterOverride && selectedSubject && !selectedSubject.includes("IELTS") && flatChapters.length > 0 && (
                    <div className="space-y-1.5 md:col-span-2 flex items-center gap-3">
                      <div className="flex-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Filter Chapters</label>
                        <input
                          type="text"
                          placeholder="Search chapter title or topic..."
                          value={chapterSearchFilter}
                          onChange={(e) => setChapterSearchFilter(e.target.value)}
                          className="w-full bg-slate-950/80 border border-slate-800 focus:border-violet-500 rounded-xl py-2 px-3 text-xs text-white outline-none"
                        />
                      </div>
                      <div className="pt-4">
                        <button
                          type="button"
                          onClick={() => {
                            const next = !selectAllChapters;
                            setSelectAllChapters(next);
                            setSelectedChapterKeys(next ? flatChapters.map(c => `${c.docId}_${c.chapIdx}`) : []);
                          }}
                          className={`text-xs font-bold px-3 py-2 rounded-xl transition-all cursor-pointer ${
                            selectAllChapters
                              ? "bg-violet-600 text-white shadow-md shadow-violet-600/20"
                              : "border border-slate-700 text-slate-300 hover:border-violet-500 hover:text-violet-400 bg-slate-950/60"
                          }`}
                        >
                          {selectAllChapters ? "✓ Entire Subject Selected" : "Select Entire Subject"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* IELTS Specific Controls Panel */}
                {selectedSubject.includes("IELTS") && (
                  <div className="p-4 sm:p-5 rounded-2xl border border-violet-500/30 bg-violet-950/20 space-y-4 text-left">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-violet-500/20 pb-3">
                      <div>
                        <h4 className="text-xs font-bold text-violet-300 uppercase tracking-wider flex items-center gap-1.5">
                          <span>🇬🇧 IELTS Cambridge Standard Test Track</span>
                        </h4>
                        <p className="text-[11px] text-slate-400 mt-0.5">Select test paper source, official module specs, and exam type.</p>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Test Paper Source Mode Switcher */}
                        <div className="flex bg-slate-950 border border-slate-800 p-1 rounded-xl shrink-0">
                          <button
                            type="button"
                            onClick={() => setIeltsSourceMode("ai_generator")}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                              ieltsSourceMode === "ai_generator"
                                ? "bg-violet-600 text-white shadow-md shadow-violet-600/20"
                                : "text-slate-400 hover:text-slate-200"
                            }`}
                          >
                            🤖 Fresh AI Test
                          </button>
                          <button
                            type="button"
                            onClick={() => setIeltsSourceMode("benchmark_corpus")}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                              ieltsSourceMode === "benchmark_corpus"
                                ? "bg-amber-600 text-white shadow-md shadow-amber-600/20"
                                : "text-slate-400 hover:text-slate-200"
                            }`}
                          >
                            🎯 Cambridge 19 (ielts.md)
                          </button>
                        </div>

                        {/* Academic vs General Track Switcher */}
                        <div className="flex bg-slate-950 border border-slate-800 p-1 rounded-xl shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setIeltsTrack("Academic");
                              setSelectedBoardType("IELTS Academic");
                            }}
                            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                              ieltsTrack === "Academic"
                                ? "bg-violet-600 text-white shadow-md shadow-violet-600/20"
                                : "text-slate-400 hover:text-slate-200"
                            }`}
                          >
                            🎓 Academic
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setIeltsTrack("General");
                              setSelectedBoardType("IELTS General");
                            }}
                            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                              ieltsTrack === "General"
                                ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/20"
                                : "text-slate-400 hover:text-slate-200"
                            }`}
                          >
                            💼 General Training
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* 4-Module Selector */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Target IELTS Modules</label>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {[
                          { id: "reading", label: "Reading Module", icon: "📖" },
                          { id: "writing", label: "Writing Module", icon: "✍️" },
                          { id: "listening", label: "Listening Module", icon: "🎧" },
                          { id: "speaking", label: "Speaking Module", icon: "🗣️" },
                        ].map((m) => {
                          const checked = ieltsModules[m.id];
                          return (
                            <label
                              key={m.id}
                              className={`p-2.5 rounded-xl border cursor-pointer transition-all flex items-center gap-2 ${
                                checked
                                  ? "bg-violet-950/60 border-violet-500/60 text-white font-semibold shadow-md"
                                  : "bg-slate-950/40 border-slate-800 text-slate-400 hover:text-slate-200"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => {
                                  setIeltsModules(prev => ({ ...prev, [m.id]: e.target.checked }));
                                }}
                                className="accent-violet-500 cursor-pointer w-4 h-4 shrink-0"
                              />
                              <span className="text-xs truncate">{m.icon} {m.label}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* Chapter Cards Selection Area */}
                {!manualChapterOverride ? (
                  <div className="space-y-2">
                    {!selectedSubject ? (
                      <div className="p-8 text-center border border-dashed border-slate-800 rounded-2xl text-slate-500 text-xs italic">
                        Please select a subject above to view and choose chapters.
                      </div>
                    ) : flatChapters.length === 0 ? (
                      <div className="p-8 text-center border border-dashed border-slate-800 rounded-2xl text-slate-500 text-xs italic">
                        No indexed chapters found under "{selectedSubject}".
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-72 overflow-y-auto pr-1">
                        {flatChapters
                          .filter(c => !chapterSearchFilter.trim() || c.name.toLowerCase().includes(chapterSearchFilter.toLowerCase()))
                          .map((c) => {
                            const key = `${c.docId}_${c.chapIdx}`;
                            const checked = selectedChapterKeys.includes(key);
                            return (
                              <div
                                key={key}
                                onClick={() => {
                                  setSelectAllChapters(false);
                                  setSelectedChapterKeys(prev =>
                                    checked ? prev.filter(k => k !== key) : [...prev, key]
                                  );
                                }}
                                className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between gap-2 ${
                                  checked 
                                    ? "bg-violet-950/40 border-violet-500/80 shadow-[0_0_15px_rgba(139,92,246,0.15)]" 
                                    : "bg-slate-950/60 border-slate-800/80 hover:border-slate-700 hover:bg-slate-900/40"
                                }`}
                              >
                                <div className="flex items-start gap-2.5">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => {}} // Handled by parent container div onClick
                                    className="accent-violet-500 mt-0.5 shrink-0 cursor-pointer w-4 h-4"
                                  />
                                  <div className="space-y-1">
                                    <h4 className="text-xs font-bold text-white leading-tight">{c.name}</h4>
                                    <p className="text-[10px] text-slate-400 line-clamp-2 leading-relaxed">{c.summary}</p>
                                  </div>
                                </div>

                                <div className="flex items-center justify-between border-t border-slate-800/60 pt-2 text-[10px] text-slate-500">
                                  <span className="truncate max-w-[140px]" title={c.docName}>{c.docName}</span>
                                  <span className="px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800 font-mono text-slate-400 font-semibold">
                                    pp. {c.startPage}–{c.endPage}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    )}

                    {selectedChapterKeys.length > 0 && (
                      <div className="text-xs font-semibold text-violet-400 pt-1">
                        ✓ {selectAllChapters ? `All ${flatChapters.length} chapters selected for exam paper` : `${selectedChapterKeys.length} of ${flatChapters.length} chapters selected`}
                      </div>
                    )}
                  </div>
                ) : (
                  /* Manual Topic Entry Fields */
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-2xl bg-slate-950/60 border border-slate-800">
                    <div className="space-y-1 sm:col-span-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Custom Topic Title</label>
                      <input
                        type="text"
                        placeholder="e.g. Chemical Equations & Reactions"
                        value={customChapterName}
                        onChange={(e) => setCustomChapterName(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 focus:border-violet-500 rounded-xl py-2 px-3 text-xs text-white outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Start Page</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={customStartPage}
                        onChange={(e) => {
                          const raw = e.target.value.replace(/[^0-9]/g, "");
                          setCustomStartPage(raw);
                        }}
                        onBlur={() => {
                          const parsed = parseInt(String(customStartPage), 10);
                          setCustomStartPage(isNaN(parsed) || parsed < 1 ? 1 : parsed);
                        }}
                        className="w-full bg-slate-900 border border-slate-800 focus:border-violet-500 rounded-xl py-2 px-3 text-xs text-white outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">End Page</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={customEndPage}
                        onChange={(e) => {
                          const raw = e.target.value.replace(/[^0-9]/g, "");
                          setCustomEndPage(raw);
                        }}
                        onBlur={() => {
                          const parsed = parseInt(String(customEndPage), 10);
                          setCustomEndPage(isNaN(parsed) || parsed < 1 ? 1 : parsed);
                        }}
                        className="w-full bg-slate-900 border border-slate-800 focus:border-violet-500 rounded-xl py-2 px-3 text-xs text-white outline-none"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* -------------------------------------------------------------
                  STEP 2: EXAM BLUEPRINT & CUSTOM QUESTION BUILDER CARD
                 ------------------------------------------------------------- */}
              <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-6 text-left">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
                  <div>
                    <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest px-2.5 py-1 bg-emerald-500/10 rounded-md border border-emerald-500/20">Step 2</span>
                    <h3 className="text-lg font-bold text-white mt-1">Exam Blueprint & Marking Pattern</h3>
                  </div>

                  {/* Mode Switcher Tabs */}
                  <div className="flex bg-slate-950 border border-slate-800 p-1 rounded-2xl shrink-0">
                    <button
                      type="button"
                      onClick={() => setCreationMode("official_blueprint")}
                      className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        creationMode === "official_blueprint"
                          ? "bg-violet-600 text-white shadow-md shadow-violet-600/20"
                          : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      🏛️ Board Blueprint Mode
                    </button>
                    <button
                      type="button"
                      onClick={() => setCreationMode("custom_builder")}
                      className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        creationMode === "custom_builder"
                          ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/20"
                          : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      ⚙️ Custom Question Builder
                    </button>
                  </div>
                </div>

                {/* MODE A: OFFICIAL BOARD BLUEPRINT */}
                {creationMode === "official_blueprint" ? (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Board / Blueprint</label>
                        <select
                          value={selectedBoardType}
                          onChange={(e) => setSelectedBoardType(e.target.value)}
                          className="w-full bg-slate-950/80 border border-slate-800 focus:border-violet-500 rounded-xl py-2.5 px-3 text-xs font-semibold text-white outline-none cursor-pointer"
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

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          {selectedSubject.includes("IELTS") ? "Difficulty Level (Band Target)" : "Grade Level"}
                        </label>
                        {selectedSubject.includes("IELTS") ? (
                          <select
                            value={classGrade}
                            onChange={(e) => setClassGrade(e.target.value)}
                            className="w-full bg-slate-950/80 border border-violet-500/50 focus:border-violet-500 rounded-xl py-2.5 px-3 text-xs font-semibold text-white outline-none cursor-pointer"
                          >
                            <option value="Easy (Band 5.0 - 6.0)">🟢 Easy (Target Band 5.0 - 6.0)</option>
                            <option value="Medium (Band 6.5 - 7.5)">🟡 Medium (Target Band 6.5 - 7.5)</option>
                            <option value="Hard (Band 8.0 - 9.0)">🔴 Hard / Advanced (Target Band 8.0 - 9.0)</option>
                          </select>
                        ) : (
                          <select
                            value={classGrade}
                            onChange={(e) => setClassGrade(e.target.value)}
                            className="w-full bg-slate-950/80 border border-slate-800 focus:border-violet-500 rounded-xl py-2.5 px-3 text-xs font-semibold text-white outline-none cursor-pointer"
                          >
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
                        )}
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Exam Title</label>
                        <input
                          type="text"
                          value={examTitle}
                          onChange={(e) => setExamTitle(e.target.value)}
                          className="w-full bg-slate-950/80 border border-slate-800 focus:border-violet-500 rounded-xl py-2 px-3 text-xs text-white outline-none"
                        />
                      </div>
                    </div>

                    {/* Active Board Blueprint Preview */}
                    {activeBlueprint && (() => {
                      const displayBp = selectedSubject.includes("IELTS")
                        ? buildIeltsModuleBlueprint(ieltsTrack, ieltsModules).blueprint
                        : activeBlueprint;

                      return (
                        <div className="p-4 rounded-2xl border border-slate-800 bg-slate-950/40 space-y-3">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                            <div className="text-xs font-bold text-white flex items-center gap-2">
                              <span>📋 {displayBp.boardAbbreviation} {displayBp.academicYear} Official Blueprint</span>
                            </div>
                            <span className="text-xs font-bold text-violet-400 bg-violet-950/40 border border-violet-500/20 px-2.5 py-1 rounded-lg">
                              Total Marks: {displayBp.totalTheoryMarks}m · {displayBp.totalQuestions} Questions
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-2 text-xs">
                            {displayBp.sections.map((sec) => (
                              <div key={sec.sectionLetter} className="py-1 px-3 rounded-lg bg-slate-900 border border-slate-800 text-slate-300">
                                {sec.sectionLetter}: <span className="font-bold text-violet-400">
                                  {sec.questionTypes.map((qt) => `${qt.count} ${qt.type}`).join(" + ")}
                                </span> = {sec.totalMarks}m
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                ) : (
                  /* MODE B: CUSTOM QUESTION PAPER BUILDER */
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Test Paper Title</label>
                        <input
                          type="text"
                          value={examTitle}
                          onChange={(e) => setExamTitle(e.target.value)}
                          placeholder="e.g. Unit 3 Custom Assessment"
                          className="w-full bg-slate-950/80 border border-slate-800 focus:border-violet-500 rounded-xl py-2 px-3 text-xs text-white outline-none"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Grade Level</label>
                        <select
                          value={classGrade}
                          onChange={(e) => setClassGrade(e.target.value)}
                          className="w-full bg-slate-950/80 border border-slate-800 focus:border-violet-500 rounded-xl py-2.5 px-3 text-xs font-semibold text-white outline-none cursor-pointer"
                        >
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
                    </div>

                    {/* Interactive Question Types Builder */}
                    <div className="space-y-3">
                      <div className="flex justify-between items-center text-xs font-bold text-slate-400 uppercase tracking-wider">
                        <span>Select Question Types & Marking Scheme</span>
                        <span>{activeCustomTypes.length} Types Selected</span>
                      </div>

                      {/* Mobile Card Stack Layout (< sm) */}
                      <div className="space-y-3 sm:hidden">
                        {customQuestionTypes.map((qType) => {
                          const countVal = parseInt(String(qType.count), 10) || 0;
                          const marksVal = parseInt(String(qType.marksPerQuestion), 10) || 0;
                          const subtotal = countVal * marksVal;
                          return (
                            <div
                              key={qType.id}
                              className={`p-4 rounded-2xl border transition-all space-y-3 ${
                                qType.enabled
                                  ? "bg-slate-900/60 border-slate-700 shadow-md"
                                  : "bg-slate-950/40 border-slate-800/80 opacity-60"
                              }`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <label className="flex items-start gap-3 cursor-pointer flex-1">
                                  <input
                                    type="checkbox"
                                    checked={qType.enabled}
                                    onChange={(e) => {
                                      const checked = e.target.checked;
                                      setCustomQuestionTypes(prev => prev.map(t => t.id === qType.id ? { ...t, enabled: checked } : t));
                                    }}
                                    className="accent-emerald-500 cursor-pointer w-4 h-4 mt-0.5 shrink-0"
                                  />
                                  <div>
                                    <p className="font-bold text-white text-xs">{qType.name}</p>
                                    <p className="text-[10px] text-slate-400 leading-relaxed mt-0.5">{qType.description}</p>
                                  </div>
                                </label>
                                <span className={`font-mono text-xs font-bold shrink-0 ${qType.enabled ? "text-emerald-400" : "text-slate-600"}`}>
                                  {qType.enabled ? `${subtotal} Marks` : "—"}
                                </span>
                              </div>

                              {qType.enabled && (
                                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-800/60">
                                  <div className="space-y-1">
                                    <label className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">No. of Questions</label>
                                    <input
                                      type="text"
                                      inputMode="numeric"
                                      pattern="[0-9]*"
                                      value={qType.count}
                                      onChange={(e) => {
                                        const raw = e.target.value.replace(/[^0-9]/g, "");
                                        setCustomQuestionTypes(prev => prev.map(t => t.id === qType.id ? { ...t, count: raw } : t));
                                      }}
                                      onBlur={() => {
                                        const parsed = parseInt(String(qType.count), 10);
                                        const finalVal = isNaN(parsed) || parsed < 1 ? 1 : Math.min(50, parsed);
                                        setCustomQuestionTypes(prev => prev.map(t => t.id === qType.id ? { ...t, count: finalVal } : t));
                                      }}
                                      className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-500 rounded-xl p-2 text-center text-xs font-bold text-white outline-none"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Marks / Question</label>
                                    <input
                                      type="text"
                                      inputMode="numeric"
                                      pattern="[0-9]*"
                                      value={qType.marksPerQuestion}
                                      onChange={(e) => {
                                        const raw = e.target.value.replace(/[^0-9]/g, "");
                                        setCustomQuestionTypes(prev => prev.map(t => t.id === qType.id ? { ...t, marksPerQuestion: raw } : t));
                                      }}
                                      onBlur={() => {
                                        const parsed = parseInt(String(qType.marksPerQuestion), 10);
                                        const finalVal = isNaN(parsed) || parsed < 1 ? 1 : Math.min(20, parsed);
                                        setCustomQuestionTypes(prev => prev.map(t => t.id === qType.id ? { ...t, marksPerQuestion: finalVal } : t));
                                      }}
                                      className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-500 rounded-xl p-2 text-center text-xs font-bold text-white outline-none"
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Desktop Table Layout (>= sm) */}
                      <div className="hidden sm:block overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950/60">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-slate-900/60 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                              <th className="p-3 w-10">Include</th>
                              <th className="p-3">Question Type</th>
                              <th className="p-3 w-32">No. of Questions</th>
                              <th className="p-3 w-32">Marks per Question</th>
                              <th className="p-3 w-28 text-right">Subtotal</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/60 text-xs">
                            {customQuestionTypes.map((qType) => {
                              const countVal = parseInt(String(qType.count), 10) || 0;
                              const marksVal = parseInt(String(qType.marksPerQuestion), 10) || 0;
                              const subtotal = countVal * marksVal;
                              return (
                                <tr key={qType.id} className={qType.enabled ? "bg-slate-900/30" : "opacity-60"}>
                                  <td className="p-3 text-center">
                                    <input
                                      type="checkbox"
                                      checked={qType.enabled}
                                      onChange={(e) => {
                                        const checked = e.target.checked;
                                        setCustomQuestionTypes(prev => prev.map(t => t.id === qType.id ? { ...t, enabled: checked } : t));
                                      }}
                                      className="accent-emerald-500 cursor-pointer w-4 h-4"
                                    />
                                  </td>
                                  <td className="p-3">
                                    <p className="font-bold text-white">{qType.name}</p>
                                    <p className="text-[10px] text-slate-500">{qType.description}</p>
                                  </td>
                                  <td className="p-3">
                                    <input
                                      type="text"
                                      inputMode="numeric"
                                      pattern="[0-9]*"
                                      disabled={!qType.enabled}
                                      value={qType.count}
                                      onChange={(e) => {
                                        const raw = e.target.value.replace(/[^0-9]/g, "");
                                        setCustomQuestionTypes(prev => prev.map(t => t.id === qType.id ? { ...t, count: raw } : t));
                                      }}
                                      onBlur={() => {
                                        const parsed = parseInt(String(qType.count), 10);
                                        const finalVal = isNaN(parsed) || parsed < 1 ? 1 : Math.min(50, parsed);
                                        setCustomQuestionTypes(prev => prev.map(t => t.id === qType.id ? { ...t, count: finalVal } : t));
                                      }}
                                      className="w-20 bg-slate-900 border border-slate-700 focus:border-emerald-500 rounded-lg p-1.5 text-center font-bold text-white outline-none disabled:opacity-30"
                                    />
                                  </td>
                                  <td className="p-3">
                                    <input
                                      type="text"
                                      inputMode="numeric"
                                      pattern="[0-9]*"
                                      disabled={!qType.enabled}
                                      value={qType.marksPerQuestion}
                                      onChange={(e) => {
                                        const raw = e.target.value.replace(/[^0-9]/g, "");
                                        setCustomQuestionTypes(prev => prev.map(t => t.id === qType.id ? { ...t, marksPerQuestion: raw } : t));
                                      }}
                                      onBlur={() => {
                                        const parsed = parseInt(String(qType.marksPerQuestion), 10);
                                        const finalVal = isNaN(parsed) || parsed < 1 ? 1 : Math.min(20, parsed);
                                        setCustomQuestionTypes(prev => prev.map(t => t.id === qType.id ? { ...t, marksPerQuestion: finalVal } : t));
                                      }}
                                      className="w-20 bg-slate-900 border border-slate-700 focus:border-emerald-500 rounded-lg p-1.5 text-center font-bold text-white outline-none disabled:opacity-30"
                                    />
                                  </td>
                                  <td className="p-3 text-right">
                                    <span className={`font-mono font-bold ${qType.enabled ? "text-emerald-400" : "text-slate-600"}`}>
                                      {qType.enabled ? `${subtotal} Marks` : "—"}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Live Calculation Summary Bar */}
                    <div className="p-4 rounded-2xl bg-emerald-950/20 border border-emerald-500/30 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div className="flex items-center gap-6">
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Questions</p>
                          <p className="text-2xl font-black text-white">{customTotalQuestions}</p>
                        </div>
                        <div className="h-8 w-px bg-slate-800"></div>
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Marks</p>
                          <p className="text-2xl font-black text-emerald-400">{customTotalMarks} Marks</p>
                        </div>
                      </div>

                      <div className="space-y-1 w-full sm:w-auto">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Test Duration (Minutes)</label>
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={durationMinutes}
                          onChange={(e) => {
                            const raw = e.target.value.replace(/[^0-9]/g, "");
                            setDurationMinutes(raw);
                          }}
                          onBlur={() => {
                            const parsed = parseInt(String(durationMinutes), 10);
                            setDurationMinutes(isNaN(parsed) || parsed < 5 ? 5 : parsed);
                          }}
                          className="w-full sm:w-36 bg-slate-900 border border-slate-700 focus:border-emerald-500 rounded-xl p-2 text-xs font-bold text-white outline-none"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Primary Action Button */}
                <div className="pt-4 border-t border-slate-800/80">
                  <button
                    onClick={handleGenerateExam}
                    disabled={
                      !selectedSubject ||
                      (!selectedSubject.includes("IELTS") && !manualChapterOverride && selectedChapterKeys.length === 0 && !selectAllChapters) ||
                      (!selectedSubject.includes("IELTS") && manualChapterOverride && !customChapterName.trim()) ||
                      (selectedSubject.includes("IELTS") && !Object.values(ieltsModules).some(Boolean)) ||
                      (creationMode === "custom_builder" && activeCustomTypes.length === 0)
                    }
                    className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-violet-600 via-purple-600 to-emerald-600 hover:from-violet-500 hover:to-emerald-500 text-white font-bold text-sm shadow-xl shadow-violet-600/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    <span>Generate Question Paper</span>
                  </button>
                </div>
              </div>

              {/* -------------------------------------------------------------
                  STEP 3: PAST COMPLETED TESTS & REVIEW LOG
                 ------------------------------------------------------------- */}
              {attempts && attempts.length > 0 && (
                <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-slate-800 space-y-6 text-left">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
                    <div>
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-950/40 border border-violet-500/25 text-violet-400 text-[10px] font-bold uppercase tracking-wider mb-1">
                        <Award size={12} />
                        Test History & Review Log
                      </div>
                      <h3 className="text-xl font-bold text-white">Revisit Completed Tests ({attempts.length})</h3>
                      <p className="text-slate-400 text-xs">
                        Click any past attempt to review your full scorecard, AI feedback, model answers, and export PDF papers.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {attempts.map((attempt) => {
                      const percent = attempt.maxMarks > 0 ? Math.round((attempt.marksObtained / attempt.maxMarks) * 100) : 0;
                      const isPassed = percent >= 40;

                      return (
                        <div
                          key={attempt.id}
                          className="p-5 rounded-2xl border border-slate-800 bg-slate-950/60 hover:bg-slate-900/40 hover:border-slate-700 transition-all text-left flex flex-col justify-between gap-4 group"
                        >
                          <div className="space-y-2">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <span className="text-[10px] font-bold uppercase tracking-wider text-violet-400 bg-violet-950/40 border border-violet-500/20 px-2 py-0.5 rounded">
                                  📚 {attempt.subject || "General"}
                                </span>
                                <h4 className="text-sm font-bold text-white mt-1.5 group-hover:text-violet-300 transition-colors">
                                  {attempt.examTitle}
                                </h4>
                                <p className="text-[11px] text-slate-400 line-clamp-1">
                                  {attempt.chapterName || "Mixed Syllabus"}
                                </p>
                              </div>

                              <div className="text-right shrink-0">
                                <span className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${
                                  isPassed
                                    ? "bg-emerald-950/40 border-emerald-500/30 text-emerald-400"
                                    : "bg-red-950/40 border-red-500/30 text-red-400"
                                }`}>
                                  {percent}% ({attempt.marksObtained}/{attempt.maxMarks}m)
                                </span>
                                <span className="text-[10px] text-slate-500 block mt-1">{attempt.date}</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-3 border-t border-slate-900 gap-2">
                            <button
                              type="button"
                              onClick={() => setScorecard(attempt)}
                              className="flex-1 py-2 px-3 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-violet-600/10"
                            >
                              <FileText size={14} />
                              <span>Review Scorecard</span>
                            </button>

                            <button
                              type="button"
                              onClick={async () => {
                                if (confirm(`Delete results for "${attempt.examTitle}"?`)) {
                                  await dbService.deleteExamAttempt(activeProfileId, attempt.id);
                                  onRefresh();
                                }
                              }}
                              className="p-2 rounded-xl border border-slate-800 hover:border-red-900/40 text-slate-500 hover:text-red-400 transition-colors cursor-pointer"
                              title="Delete attempt record"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
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
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-900 pb-4 sticky top-[72px] bg-[#0b0c10]/95 backdrop-blur-md py-3 px-2 z-20 gap-3 shadow-lg">
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-white leading-tight">{activeExam.title}</h3>
                  <p className="text-xs font-semibold text-violet-400 mt-0.5">
                    {activeBlueprint ? `${activeBlueprint.boardAbbreviation} ${activeBlueprint.academicYear} Standard Blueprint` : "Board Standard Exam Blueprint"}
                  </p>
                </div>
                
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    onClick={handleExportExamPDF}
                    className="py-1.5 px-3 border border-slate-800 bg-slate-950 hover:bg-slate-900 text-slate-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <Download size={14} /> Export PDF
                  </button>
                  <button
                    onClick={handlePauseToggle}
                    className="py-1.5 px-3 border border-slate-800 bg-slate-950 hover:bg-slate-900 text-slate-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                  >
                    {examRunning ? "Pause Exam" : "Resume Exam"}
                  </button>
                  <button
                    onClick={() => setShowQuitPrompt(true)}
                    className="py-1.5 px-3 bg-red-950/20 border border-red-900/35 text-red-400 hover:bg-red-900 hover:text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Quit Exam
                  </button>
                  <div className="flex items-center gap-2 py-1.5 px-3.5 rounded-xl border border-amber-500/20 bg-amber-950/20 text-amber-400 font-display font-bold text-xs sm:text-sm">
                    <Timer size={16} />
                    <span>{formatTimer(secondsRemaining)}</span>
                  </div>
                </div>
              </div>

              {/* Exam Questions Form Container with Top Clearance Spacing */}
              <div className="relative pt-4">
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
                  <div className="p-3 rounded-xl border border-slate-800 bg-slate-950/30 text-left">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <h4 className="text-sm font-bold text-white uppercase tracking-wider">
                        Section {sec.section_letter}: ({sec.marks_per_question}m each)
                      </h4>
                      {/* Listening Audio Synthesis Player Button */}
                      {(sec.sectionTitle?.toLowerCase().includes("listening") || sec.instructions?.toLowerCase().includes("audio") || sec.instructions?.toLowerCase().includes("transcript")) && (
                        <button
                          type="button"
                          onClick={() => handleToggleListeningAudio(`sec_${sec.section_letter}`, sec.instructions)}
                          className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                            isPlayingAudio && activeAudioQuestionId === `sec_${sec.section_letter}`
                              ? "bg-amber-600 text-white animate-pulse"
                              : "bg-violet-950/60 border border-violet-500/30 text-violet-300 hover:bg-violet-900 hover:text-white"
                          }`}
                        >
                          {isPlayingAudio && activeAudioQuestionId === `sec_${sec.section_letter}` ? (
                            <>
                              <Pause size={12} />
                              <span>Pause Audio Track</span>
                            </>
                          ) : (
                            <>
                              <Volume2 size={12} className="text-emerald-400" />
                              <span>🔊 Play Audio Listening Track</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                    {sec.instructions && (
                      <div className="mt-1.5">
                        {sec.instructions.length > 250 ? (
                          <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 space-y-1 text-left">
                            <div className="flex items-center justify-between text-[10px] font-bold text-violet-400 uppercase tracking-wider">
                              <span>📖 Section Instructions / Audio Transcript</span>
                              <span className="text-[9px] text-slate-500 font-normal">↕ Scroll to read</span>
                            </div>
                            <div className="max-h-[220px] overflow-y-auto text-xs text-slate-300 leading-relaxed whitespace-pre-wrap pr-1">
                              {sec.instructions}
                            </div>
                          </div>
                        ) : (
                          <p className="text-[10px] text-slate-500">{sec.instructions}</p>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="space-y-6">
                    {sec.questions.map((q: any) => {
                      const qText = q.question_text || "";
                      const lowerText = qText.toLowerCase();
                      const isLongPassage = qText.length > 280 || lowerText.includes("passage") || lowerText.includes("reading excerpt");

                      return (
                        <div key={q.id} className="space-y-3 p-4 rounded-xl bg-slate-950/20 border border-slate-900/60 text-left">
                          <div className="flex justify-between items-start gap-4">
                            <div className="flex-1">
                              {isLongPassage ? (
                                <div className="space-y-3 w-full">
                                  <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 space-y-2 text-left shadow-inner">
                                    <div className="flex items-center justify-between text-[10px] font-bold text-violet-400 uppercase tracking-wider border-b border-slate-800/80 pb-2">
                                      <span className="flex items-center gap-1.5">
                                        <span>📖 IELTS Reading / Reference Passage</span>
                                      </span>
                                      <span className="text-[9px] text-slate-500 font-normal px-2 py-0.5 rounded bg-slate-900 border border-slate-800">
                                        ↕ Scroll to read
                                      </span>
                                    </div>
                                    <div className="max-h-[260px] sm:max-h-[320px] overflow-y-auto pr-2 text-xs sm:text-sm text-slate-200 leading-relaxed font-sans whitespace-pre-wrap select-text">
                                      {qText}
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <h5 className="text-xs sm:text-sm font-semibold text-white leading-relaxed">
                                  {qText}
                                </h5>
                              )}
                            </div>
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
                              placeholder="Write or dictate your answer here..."
                              rows={q.marks > 3 ? 5 : 3}
                              className="w-full bg-slate-950/40 border border-slate-800 focus:border-violet-500 rounded-xl py-2 px-3 text-xs text-white placeholder-slate-700 outline-none resize-none"
                              disabled={!!studentAnswerImages[q.id]}
                            />
                            
                            <div className="flex flex-wrap items-center gap-2 pt-1">
                              {/* Speaking Voice Mic STT Button */}
                              <button
                                type="button"
                                onClick={() => handleToggleMicRecording(q.id)}
                                className={`flex items-center gap-1.5 py-1 px-3 rounded-lg text-[10px] font-semibold transition-all cursor-pointer border ${
                                  isRecordingMic === q.id
                                    ? "bg-red-600 border-red-500 text-white animate-pulse shadow-md shadow-red-600/30"
                                    : "bg-violet-950/40 border-violet-500/25 hover:bg-violet-900 text-violet-300 hover:text-white"
                                }`}
                              >
                                {isRecordingMic === q.id ? (
                                  <>
                                    <MicOff size={12} />
                                    <span>Stop Mic Recording</span>
                                  </>
                                ) : (
                                  <>
                                    <Mic size={12} className="text-red-400" />
                                    <span>🎙️ Speak Answer (Mic STT)</span>
                                  </>
                                )}
                              </button>

                              <span className="text-[9px] font-bold text-slate-600 uppercase tracking-widest">Or</span>

                              <div className="relative">
                                <input
                                  type="file"
                                  accept="image/*"
                                  id={`handwritten-file-upload-${q.id}`}
                                  onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;

                                    if (!file.type.startsWith("image/")) {
                                      alert("Please upload an image file (JPEG, PNG, etc.).");
                                      e.target.value = "";
                                      return;
                                    }

                                    const maxSize = 5 * 1024 * 1024;
                                    if (file.size > maxSize) {
                                      alert("Image is too large. Maximum size is 5 MB.");
                                      e.target.value = "";
                                      return;
                                    }

                                    if (file.size === 0) {
                                      alert("The image file appears to be empty.");
                                      e.target.value = "";
                                      return;
                                    }

                                    const reader = new FileReader();
                                    reader.onloadend = () => {
                                      setStudentAnswerImages({
                                        ...studentAnswerImages,
                                        [q.id]: reader.result as string
                                      });
                                    };
                                    reader.onerror = () => {
                                      alert("Failed to read the image file. Please try again.");
                                    };
                                    reader.readAsDataURL(file);
                                  }}
                                  className="hidden"
                                />
                                <label
                                  htmlFor={`handwritten-file-upload-${q.id}`}
                                  className="flex items-center gap-1.5 py-1 px-3 border border-slate-800 bg-slate-950/60 hover:bg-slate-900 text-slate-300 rounded-lg text-[10px] font-semibold transition-all cursor-pointer"
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
                    );
                  })}
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
                    selectedChapterKeys,
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
                    <div className="space-y-1 flex-1">
                      <h4 className="text-xs font-bold text-slate-400">Question {idx + 1} ({ans.bloomsLevel})</h4>
                      {ans.questionText && ans.questionText.length > 280 ? (
                        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 space-y-1.5 text-left mt-1">
                          <div className="flex items-center justify-between text-[10px] font-bold text-violet-400 uppercase tracking-wider border-b border-slate-800/80 pb-1">
                            <span>📖 Reference Passage / Text</span>
                            <span className="text-[9px] text-slate-500 font-normal">↕ Scroll passage</span>
                          </div>
                          <div className="max-h-[220px] overflow-y-auto text-xs text-slate-200 leading-relaxed font-sans whitespace-pre-wrap">
                            {ans.questionText}
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-white leading-relaxed">{ans.questionText}</p>
                      )}
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
