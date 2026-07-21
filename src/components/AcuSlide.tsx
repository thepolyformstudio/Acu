"use client";

import React, { useState, useEffect, useRef } from "react";
import { DocumentSource, UserProfile } from "@/lib/db";
import { 
  generateSlideOutline, 
  generateBriefingNotes, 
  generateFAQSheet, 
  generateTimeline, 
  generatePodcastScript,
  generateMCQs,
  generateFlashcards
} from "@/lib/gemini";
import { saveNotesToDrive, loadNotesFromDrive, isDriveSignedIn } from "@/lib/googleDrive";
import { hydrateDocumentPayload } from "@/lib/docHydrator";
import PptxGenJS from "pptxgenjs";
import AcuCard from "./AcuCard";
import { 
  Play, Download, RefreshCw, Layers, Edit2, Palette, 
  ChevronLeft, ChevronRight, Check, AlertCircle, FileText,
  Volume2, VolumeX, HelpCircle, BookOpen, Clock, Presentation,
  ListCollapse, MessageCircle, Mic, ListChecks
} from "lucide-react";

interface AcuSlideProps {
  documents: DocumentSource[];
  user: UserProfile;
}

interface SlideTheme {
  name: string;
  bg: string;
  textColor: string;
  titleColor: string;
  accentColor: string;
  fontDisplay: string;
  fontSans: string;
}

const TRANSITION_THEMES: SlideTheme[] = [
  {
    name: "Midnight Obsidian",
    bg: "linear-gradient(135deg, #0f172a 0%, #020617 100%)",
    textColor: "#e2e8f0",
    titleColor: "#a78bfa", // soft violet
    accentColor: "#3b82f6",
    fontDisplay: "Outfit, sans-serif",
    fontSans: "Inter, sans-serif"
  },
  {
    name: "Editorial Sand",
    bg: "linear-gradient(135deg, #fbfbf9 0%, #f3f3ee 100%)",
    textColor: "#27272a",
    titleColor: "#0f0f11",
    accentColor: "#7f1d1d", // deep red
    fontDisplay: "Georgia, serif",
    fontSans: "Inter, sans-serif"
  },
  {
    name: "Cyber Gradient",
    bg: "linear-gradient(135deg, #090d16 0%, #030008 100%)",
    textColor: "#f8fafc",
    titleColor: "#0ea5e9", // neon cyan
    accentColor: "#10b981",
    fontDisplay: "Outfit, sans-serif",
    fontSans: "Inter, sans-serif"
  },
  {
    name: "Warm Amber",
    bg: "linear-gradient(135deg, #78350f 0%, #451a03 100%)",
    textColor: "#fef3c7",
    titleColor: "#fbbf24",
    accentColor: "#f97316",
    fontDisplay: "Outfit, sans-serif",
    fontSans: "Inter, sans-serif"
  }
];

export default function AcuSlide({ documents, user }: AcuSlideProps) {
  const [selectedSubject, setSelectedSubject] = useState("");
  const [selectedChapterKey, setSelectedChapterKey] = useState("");
  const [selectedDoc, setSelectedDoc] = useState<DocumentSource | null>(null);
  const [selectedChapterIdx, setSelectedChapterIdx] = useState<number>(-1);
  
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

  
  // Tab control
  const [activeStudyTab, setActiveStudyTab] = useState<"slides" | "notes" | "faq" | "timeline" | "podcast" | "mcq">("notes");
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");

  // Artifact States
  const [slides, setSlides] = useState<any[]>([]);
  const [notes, setNotes] = useState<any | null>(null);
  const [faq, setFaq] = useState<any | null>(null);
  const [timeline, setTimeline] = useState<any | null>(null);
  const [podcast, setPodcast] = useState<any | null>(null);
  const [mcqs, setMcqs] = useState<any[] | null>(null);

  // Slides-specific state
  const [activeSlideIdx, setActiveSlideIdx] = useState<number>(0);
  const [activeTheme, setActiveTheme] = useState<SlideTheme>(TRANSITION_THEMES[0]);
  const [editMode, setEditMode] = useState(false);
  const [showFlashcards, setShowFlashcards] = useState(false);
  const [flashcards, setFlashcards] = useState<any[] | null>(null);
  const [flashcardLoading, setFlashcardLoading] = useState(false);

  // Audio Podcast state
  const [podcastPlaying, setPodcastPlaying] = useState(false);
  const playingRef = useRef(false);

  // Auto clean speech on unmount
  useEffect(() => {
    return () => {
      window.speechSynthesis.cancel();
    };
  }, []);

  const handleChapterChange = (idx: number) => {
    setSelectedChapterIdx(idx);
    setSlides([]);
    setNotes(null);
    setFaq(null);
    setTimeline(null);
    setPodcast(null);
    setFlashcards(null);
    setFlashcardLoading(false);
    setActiveSlideIdx(0);
    window.speechSynthesis.cancel();
    setPodcastPlaying(false);
    playingRef.current = false;
  };

  // Generate standard Slides
  const handleGenerateSlides = async () => {
    if (!selectedDoc || selectedChapterIdx === -1) return;
    const chap = selectedDoc.chapterMap?.[selectedChapterIdx];
    if (!chap) return;

    setLoading(true);
    setLoadingMessage("Checking Google Drive for existing slides...");
    
    try {
      if (isDriveSignedIn()) {
        const existing = await loadNotesFromDrive(selectedDoc.subject || "General", chap.name, "slides");
        if (existing) {
          setSlides(existing);
          setActiveSlideIdx(0);
          setLoading(false);
          return;
        }
      }

      setLoadingMessage("Gemini is structuring your presentation outline...");
      
      const textSlices = selectedDoc.pages
        .filter(p => p.pageNumber >= chap.startPage && p.pageNumber <= chap.endPage)
        .map(p => p.text)
        .join("\n\n");

      if (textSlices.trim().length === 0) {
        throw new Error("No readable text content in the selected page range.");
      }

      const generated = await generateSlideOutline(textSlices, chap.name, selectedDoc.subject || "General");
      setSlides(generated);
      setActiveSlideIdx(0);
      // Async backup to Google Drive
      if (isDriveSignedIn()) {
        saveNotesToDrive(selectedDoc.subject || "General", chap.name, "slides", generated).catch((err) => console.error("[Acu] Drive sync error:", err));
      }
    } catch (err: any) {
      alert("Generation failed: " + (err.message || String(err)));
    } finally {
      setLoading(false);
    }
  };

  // Fetch NotebookLM Study Artifacts
  const fetchArtifact = async (tabType: "notes" | "faq" | "timeline" | "podcast" | "mcq") => {
    if (!selectedDoc || selectedChapterIdx === -1) return;
    const chap = selectedDoc.chapterMap?.[selectedChapterIdx];
    if (!chap) return;

    setLoading(true);
    setLoadingMessage(`Checking Google Drive for existing ${tabType}...`);

    try {
      if (isDriveSignedIn()) {
        const existing = await loadNotesFromDrive(selectedDoc.subject || "General", chap.name, tabType);
        if (existing) {
          if (tabType === "notes") setNotes(existing);
          else if (tabType === "faq") setFaq(existing);
          else if (tabType === "timeline") setTimeline(existing);
          else if (tabType === "podcast") setPodcast(existing);
          else if (tabType === "mcq") setMcqs(existing);
          setLoading(false);
          return;
        }
      }

      setLoadingMessage(`Gemini is creating your ${tabType === "notes" ? "study notes" : tabType === "faq" ? "FAQs" : tabType === "timeline" ? "timeline phases" : tabType === "mcq" ? "MCQs" : "podcast audio script"}...`);

      const textSlices = selectedDoc.pages
        .filter(p => p.pageNumber >= chap.startPage && p.pageNumber <= chap.endPage)
        .map(p => p.text)
        .join("\n\n");

      if (textSlices.trim().length === 0) {
        throw new Error("No readable text content in the selected page range.");
      }

      if (tabType === "notes") {
        const data = await generateBriefingNotes(textSlices, chap.name, selectedDoc.subject || "General");
        setNotes(data);
        if (isDriveSignedIn()) saveNotesToDrive(selectedDoc.subject || "General", chap.name, "notes", data).catch((err) => console.error("[Acu] Drive sync error:", err));
      } else if (tabType === "faq") {
        const data = await generateFAQSheet(textSlices, chap.name, selectedDoc.subject || "General");
        setFaq(data);
        if (isDriveSignedIn()) saveNotesToDrive(selectedDoc.subject || "General", chap.name, "faq", data).catch((err) => console.error("[Acu] Drive sync error:", err));
      } else if (tabType === "timeline") {
        const data = await generateTimeline(textSlices, chap.name, selectedDoc.subject || "General");
        setTimeline(data);
        if (isDriveSignedIn()) saveNotesToDrive(selectedDoc.subject || "General", chap.name, "timeline", data).catch((err) => console.error("[Acu] Drive sync error:", err));
      } else if (tabType === "podcast") {
        const data = await generatePodcastScript(textSlices, chap.name, selectedDoc.subject || "General");
        setPodcast(data);
        if (isDriveSignedIn()) saveNotesToDrive(selectedDoc.subject || "General", chap.name, "podcast", data).catch((err) => console.error("[Acu] Drive sync error:", err));
      } else if (tabType === "mcq") {
        const data = await generateMCQs(textSlices, chap.name, selectedDoc.subject || "General");
        setMcqs(data);
        if (isDriveSignedIn()) saveNotesToDrive(selectedDoc.subject || "General", chap.name, "mcq", data).catch((err) => console.error("[Acu] Drive sync error:", err));
      }
    } catch (err: any) {
      alert("Failed to generate: " + (err.message || String(err)));
    } finally {
      setLoading(false);
    }
  };

  // Custom Flashcards management
  const handleOpenFlashcards = async () => {
    setShowFlashcards(true);
    if (flashcards) return; // already loaded or generated in this session

    if (!selectedDoc || selectedChapterIdx === -1) return;
    const chap = selectedDoc.chapterMap?.[selectedChapterIdx];
    if (!chap) return;

    setFlashcardLoading(true);
    try {
      // 1. Try checking drive first
      if (isDriveSignedIn()) {
        const existing = await loadNotesFromDrive(selectedDoc.subject || "General", chap.name, "flashcards");
        if (existing) {
          setFlashcards(existing);
          setFlashcardLoading(false);
          return;
        }
      }

      // 2. If not found in drive, generate default of 15 active-recall cards
      const textSlices = selectedDoc.pages
        .filter(p => p.pageNumber >= chap.startPage && p.pageNumber <= chap.endPage)
        .map(p => p.text)
        .join("\n\n");

      if (textSlices.trim().length === 0) {
        throw new Error("No readable text content in the selected page range.");
      }

      const generated = await generateFlashcards(textSlices, chap.name, 15, selectedDoc.subject || "General");
      setFlashcards(generated);
      
      if (isDriveSignedIn()) {
        saveNotesToDrive(selectedDoc.subject || "General", chap.name, "flashcards", generated).catch((err) => console.error("[Acu] Drive sync error:", err));
      }
    } catch (err: any) {
      alert("Failed to generate flashcards: " + (err.message || String(err)));
      setShowFlashcards(false);
    } finally {
      setFlashcardLoading(false);
    }
  };

  const handleGenerateMoreFlashcards = async (count: number) => {
    if (!selectedDoc || selectedChapterIdx === -1) return;
    const chap = selectedDoc.chapterMap?.[selectedChapterIdx];
    if (!chap) return;

    setFlashcardLoading(true);
    try {
      const textSlices = selectedDoc.pages
        .filter(p => p.pageNumber >= chap.startPage && p.pageNumber <= chap.endPage)
        .map(p => p.text)
        .join("\n\n");

      if (textSlices.trim().length === 0) {
        throw new Error("No readable text content in the selected page range.");
      }

      const generated = await generateFlashcards(textSlices, chap.name, count, selectedDoc.subject || "General");
      setFlashcards(generated);
      
      if (isDriveSignedIn()) {
        saveNotesToDrive(selectedDoc.subject || "General", chap.name, "flashcards", generated).catch((err) => console.error("[Acu] Drive sync error:", err));
      }
    } catch (err: any) {
      alert("Failed to generate additional flashcards: " + (err.message || String(err)));
    } finally {
      setFlashcardLoading(false);
    }
  };

  const handleTabChange = (newTab: "slides" | "notes" | "faq" | "timeline" | "podcast" | "mcq") => {
    // Cancel podcast voice playback if user switches tabs
    if (activeStudyTab === "podcast" && newTab !== "podcast") {
      window.speechSynthesis.cancel();
      setPodcastPlaying(false);
      playingRef.current = false;
    }

    setActiveStudyTab(newTab);
    if (!selectedDoc || selectedChapterIdx === -1) return;

    if (newTab === "notes" && !notes) {
      fetchArtifact("notes");
      if (!faq) fetchArtifact("faq");
    }
    if (newTab === "slides" && slides.length === 0) handleGenerateSlides();
    if (newTab === "faq" && !faq) fetchArtifact("faq");
    if (newTab === "timeline" && !timeline) fetchArtifact("timeline");
    if (newTab === "mcq" && !mcqs) fetchArtifact("mcq");
    // Podcast will now be fetched manually by the user
  };

  // Play podcast audio overview alternates voices
  const handlePlayPodcast = () => {
    if (!podcast || !podcast.script || podcast.script.length === 0) return;

    if (playingRef.current) {
      window.speechSynthesis.cancel();
      playingRef.current = false;
      setPodcastPlaying(false);
      return;
    }

    playingRef.current = true;
    setPodcastPlaying(true);
    let lineIdx = 0;

    const speakLine = () => {
      if (lineIdx >= podcast.script.length) {
        setPodcastPlaying(false);
        playingRef.current = false;
        return;
      }

      const line = podcast.script[lineIdx];
      const utterance = new SpeechSynthesisUtterance(line.text);
      const voices = window.speechSynthesis.getVoices();

      // Alternate voice profile parameters
      if (line.speaker === "Host A" || line.speaker.includes("A")) {
        const maleVoice = voices.find(v => 
          v.name.toLowerCase().includes("male") || 
          v.name.toLowerCase().includes("david") || 
          v.name.toLowerCase().includes("google uk english male")
        );
        if (maleVoice) utterance.voice = maleVoice;
        utterance.pitch = 0.95;
        utterance.rate = 1.0;
      } else {
        const femaleVoice = voices.find(v => 
          v.name.toLowerCase().includes("female") || 
          v.name.toLowerCase().includes("zira") || 
          v.name.toLowerCase().includes("google uk english female")
        );
        if (femaleVoice) utterance.voice = femaleVoice;
        utterance.pitch = 1.15;
        utterance.rate = 1.05;
      }

      utterance.onend = () => {
        lineIdx++;
        if (playingRef.current) speakLine();
      };

      utterance.onerror = () => {
        setPodcastPlaying(false);
        playingRef.current = false;
      };

      window.speechSynthesis.speak(utterance);
    };

    speakLine();
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
              font-size: 16px;
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
            .bullets {
              padding-left: 20px;
              margin-top: 6px;
            }
            .bullet-item {
              margin-bottom: 6px;
              color: #334155;
              font-size: 13px;
            }
            .comparison-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 16px;
              margin-top: 12px;
            }
            .column {
              background: #f8fafc;
              padding: 12px;
              border-radius: 6px;
              border: 1px solid #e2e8f0;
            }
            .quote-box {
              background: #f5f3ff;
              border-left: 4px solid #8b5cf6;
              padding: 12px 16px;
              font-style: italic;
              margin: 16px 0;
              border-radius: 0 6px 6px 0;
              color: #5b21b6;
              font-size: 13px;
            }
            .faq-item {
              margin-bottom: 16px;
              page-break-inside: avoid;
              background: #fafafa;
              padding: 12px 16px;
              border-radius: 8px;
              border: 1px solid #f0f0f0;
            }
            .faq-q {
              font-weight: 600;
              color: #4338ca;
              font-size: 13px;
            }
            .faq-a {
              margin-top: 4px;
              color: #334155;
              font-size: 13px;
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
            .mcq-exp {
              font-size: 11px;
              color: #64748b;
              margin-top: 2px;
              font-style: italic;
            }
            .glossary-item {
              margin-bottom: 12px;
              font-size: 13px;
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

  const handleExportSlidesPDF = () => {
    if (slides.length === 0) return;
    const html = slides.map((s, idx) => {
      let content = "";
      if (s.layout === "title") {
        content = `<h3 style="color:#64748b; font-weight:normal; font-size:14px;">${s.subtitle || ""}</h3>`;
      } else if (s.layout === "bullets") {
        content = `<ul class="bullets">${(s.bullets || []).map((b: string) => `<li class="bullet-item">${b}</li>`).join("")}</ul>`;
      } else if (s.layout === "quote") {
        content = `<div class="quote-box">"${s.quote}"${s.author ? ` — <strong>${s.author}</strong>` : ""}</div>`;
      } else if (s.layout === "comparison") {
        content = `
          <div class="comparison-grid">
            <div class="column">
              <strong style="font-size:12px; text-transform:uppercase; color:#64748b;">${s.leftColumn?.header || ""}</strong>
              <ul class="bullets">${(s.leftColumn?.items || []).map((b: string) => `<li class="bullet-item">${b}</li>`).join("")}</ul>
            </div>
            <div class="column">
              <strong style="font-size:12px; text-transform:uppercase; color:#64748b;">${s.rightColumn?.header || ""}</strong>
              <ul class="bullets">${(s.rightColumn?.items || []).map((b: string) => `<li class="bullet-item">${b}</li>`).join("")}</ul>
            </div>
          </div>
        `;
      }
      return `
        <div class="section">
          <h2>Slide ${idx + 1}: ${s.title || "Untitled Slide"}</h2>
          ${content}
        </div>
      `;
    }).join("");

    const chapterName = selectedDoc?.chapterMap?.[selectedChapterIdx]?.name || "Study Guide";
    exportToPDF(`${chapterName} - Slide Presentation Outline`, html);
  };

  const handleExportNotesPDF = () => {
    if (!notes) return;
    const chHTML = (notes.chapters || []).map((ch: any, idx: number) => `
      <div class="section">
        <h2>Chapter ${idx + 1}: ${ch.title}</h2>
        <p style="font-size:13px; color:#334155; text-align:justify;">${ch.content}</p>
        <strong style="font-size:12px; color:#4f46e5;">Key Educational Takeaways:</strong>
        <ul class="bullets">
          ${(ch.takeaways || []).map((t: string) => `<li class="bullet-item">${t}</li>`).join("")}
        </ul>
      </div>
    `).join("");

    const glossHTML = notes.glossary && notes.glossary.length > 0 ? `
      <div class="section" style="page-break-before:always;">
        <h2>Glossary & Key Concepts</h2>
        <dl>
          ${notes.glossary.map((g: any) => `
            <div class="glossary-item">
              <dt><strong>${g.term}</strong></dt>
              <dd style="margin-left:0; color:#475569; margin-top:2px;">${g.definition}</dd>
            </div>
          `).join("")}
        </dl>
      </div>
    ` : "";

    const chapterName = selectedDoc?.chapterMap?.[selectedChapterIdx]?.name || "Study Guide";
    exportToPDF(`${chapterName} - Detailed Briefing Notes`, chHTML + glossHTML);
  };

  const handleExportFaqPDF = () => {
    if (!faq || !faq.faqs) return;
    const html = faq.faqs.map((f: any, idx: number) => `
      <div class="faq-item">
        <div class="faq-q">Q${idx + 1}: ${f.question}</div>
        <div class="faq-a">Answer: ${f.answer}</div>
      </div>
    `).join("");

    const chapterName = selectedDoc?.chapterMap?.[selectedChapterIdx]?.name || "Study Guide";
    exportToPDF(`${chapterName} - Frequently Asked Questions`, html);
  };

  const handleExportMcqPDF = () => {
    if (!mcqs) return;
    
    // 1. Generate the MCQs Practice Sheet (questions only)
    const questionsHTML = mcqs.map((m: any, idx: number) => `
      <div class="mcq-item">
        <div class="mcq-q">${idx + 1}. ${m.question}</div>
        ${(m.options || []).map((opt: string, oIdx: number) => `
          <div class="mcq-option">(${String.fromCharCode(65 + oIdx)}) ${opt}</div>
        `).join("")}
      </div>
    `).join("");

    // 2. Generate the MCQ Answer Key & Explanations
    const answersHTML = mcqs.map((m: any, idx: number) => `
      <div class="mcq-item">
        <div class="mcq-q">${idx + 1}. ${m.question}</div>
        <div class="mcq-ans">Correct Answer: ${m.correctAnswer}</div>
        <div class="mcq-exp">Explanation: ${m.explanation}</div>
      </div>
    `).join("");

    const combinedHTML = `
      <div class="questions-section">
        ${questionsHTML}
      </div>
      <div class="page-break">
        <h1 style="margin-top: 40px; border-top: 2px dashed #cbd5e1; padding-top: 20px;">Answer Key & Explanations</h1>
        ${answersHTML}
      </div>
    `;

    const chapterName = selectedDoc?.chapterMap?.[selectedChapterIdx]?.name || "Study Guide";
    exportToPDF(`${chapterName} - Practice MCQs`, combinedHTML);
  };

  // Force-regenerate artifact by bypassing local state and drive cache
  const handleRegenerateArtifact = async (tabType: "notes" | "faq" | "timeline" | "podcast" | "mcq" | "slides") => {
    if (!selectedDoc || selectedChapterIdx === -1) return;
    const chap = selectedDoc.chapterMap?.[selectedChapterIdx];
    if (!chap) return;

    setLoading(true);
    setLoadingMessage(`Gemini is regenerating your ${tabType === "notes" ? "study notes" : tabType === "faq" ? "FAQs" : tabType === "timeline" ? "timeline phases" : tabType === "mcq" ? "MCQs" : tabType === "slides" ? "slides" : "podcast audio script"}...`);

    try {
      const textSlices = selectedDoc.pages
        .filter(p => p.pageNumber >= chap.startPage && p.pageNumber <= chap.endPage)
        .map(p => p.text)
        .join("\n\n");

      if (textSlices.trim().length === 0) {
        throw new Error("No readable text content in the selected page range.");
      }

      const docSubject = selectedDoc.subject || "General";

      if (tabType === "slides") {
        const generated = await generateSlideOutline(textSlices, chap.name, docSubject);
        setSlides(generated);
        setActiveSlideIdx(0);
        if (isDriveSignedIn()) {
          saveNotesToDrive(docSubject, chap.name, "slides", generated).catch((err) => console.error("[Acu] Drive sync error:", err));
        }
      } else if (tabType === "notes") {
        const data = await generateBriefingNotes(textSlices, chap.name, docSubject);
        setNotes(data);
        if (isDriveSignedIn()) {
          saveNotesToDrive(docSubject, chap.name, "notes", data).catch((err) => console.error("[Acu] Drive sync error:", err));
        }
      } else if (tabType === "faq") {
        const data = await generateFAQSheet(textSlices, chap.name, docSubject);
        setFaq(data);
        if (isDriveSignedIn()) {
          saveNotesToDrive(docSubject, chap.name, "faq", data).catch((err) => console.error("[Acu] Drive sync error:", err));
        }
      } else if (tabType === "timeline") {
        const data = await generateTimeline(textSlices, chap.name, docSubject);
        setTimeline(data);
        if (isDriveSignedIn()) {
          saveNotesToDrive(docSubject, chap.name, "timeline", data).catch((err) => console.error("[Acu] Drive sync error:", err));
        }
      } else if (tabType === "podcast") {
        const data = await generatePodcastScript(textSlices, chap.name, docSubject);
        setPodcast(data);
        if (isDriveSignedIn()) {
          saveNotesToDrive(docSubject, chap.name, "podcast", data).catch((err) => console.error("[Acu] Drive sync error:", err));
        }
      } else if (tabType === "mcq") {
        const data = await generateMCQs(textSlices, chap.name, docSubject);
        setMcqs(data);
        if (isDriveSignedIn()) {
          saveNotesToDrive(docSubject, chap.name, "mcq", data).catch((err) => console.error("[Acu] Drive sync error:", err));
        }
      }
    } catch (err: any) {
      alert("Failed to regenerate: " + (err.message || String(err)));
    } finally {
      setLoading(false);
    }
  };

  // PowerPoint download compiler
  const handleDownloadPPTX = () => {
    if (slides.length === 0) return;
    const pptx = new PptxGenJS();
    pptx.layout = "LAYOUT_16x9";
    
    slides.forEach((slideData) => {
      const slide = pptx.addSlide();
      const hexColor = (color: string) => color.replace("#", "");
      const solidBg = activeTheme.name === "Editorial Sand" ? "F3F3EE" : 
                    activeTheme.name === "Warm Amber" ? "451A03" : 
                    activeTheme.name === "Cyber Gradient" ? "030008" : "020617";
                     
      slide.background = { fill: solidBg };

      if (slideData.layout === "title") {
        slide.addText(slideData.title, {
          x: 1, y: 2.2, w: 8, h: 1.5,
          align: "center", fontFace: activeTheme.fontDisplay.split(",")[0],
          fontSize: 36, color: hexColor(activeTheme.titleColor), bold: true
        });
        slide.addText(slideData.subtitle || "", {
          x: 1, y: 3.8, w: 8, h: 1,
          align: "center", fontFace: activeTheme.fontSans.split(",")[0],
          fontSize: 18, color: hexColor(activeTheme.textColor)
        });
      } else if (slideData.layout === "bullets") {
        slide.addText(slideData.title, {
          x: 0.8, y: 0.6, w: 8.4, h: 0.8,
          fontFace: activeTheme.fontDisplay.split(",")[0],
          fontSize: 28, color: hexColor(activeTheme.titleColor), bold: true
        });
        const points = (slideData.bullets || []).map((pt: string) => ({
          text: pt, options: { bullet: true, color: hexColor(activeTheme.textColor) }
        }));
        slide.addText(points, {
          x: 0.8, y: 1.6, w: 8.4, h: 4,
          fontFace: activeTheme.fontSans.split(",")[0], fontSize: 16, lineSpacing: 26
        });
      } else if (slideData.layout === "comparison") {
        slide.addText(slideData.title, {
          x: 0.8, y: 0.6, w: 8.4, h: 0.8,
          fontFace: activeTheme.fontDisplay.split(",")[0],
          fontSize: 28, color: hexColor(activeTheme.titleColor), bold: true
        });
        // Left Column
        slide.addText(slideData.leftColumn?.header || "Left", {
          x: 0.8, y: 1.4, w: 4, h: 0.5,
          fontFace: activeTheme.fontDisplay.split(",")[0],
          fontSize: 18, color: hexColor(activeTheme.accentColor), bold: true
        });
        const leftPoints = (slideData.leftColumn?.items || []).map((pt: string) => ({
          text: pt, options: { bullet: true, color: hexColor(activeTheme.textColor) }
        }));
        slide.addText(leftPoints, {
          x: 0.8, y: 2.0, w: 4, h: 3.5,
          fontFace: activeTheme.fontSans.split(",")[0], fontSize: 14, lineSpacing: 22
        });
        // Right Column
        slide.addText(slideData.rightColumn?.header || "Right", {
          x: 5.2, y: 1.4, w: 4, h: 0.5,
          fontFace: activeTheme.fontDisplay.split(",")[0],
          fontSize: 18, color: hexColor(activeTheme.accentColor), bold: true
        });
        const rightPoints = (slideData.rightColumn?.items || []).map((pt: string) => ({
          text: pt, options: { bullet: true, color: hexColor(activeTheme.textColor) }
        }));
        slide.addText(rightPoints, {
          x: 5.2, y: 2.0, w: 4, h: 3.5,
          fontFace: activeTheme.fontSans.split(",")[0], fontSize: 14, lineSpacing: 22
        });
      } else if (slideData.layout === "quote") {
        slide.addText(`“${slideData.quote}”`, {
          x: 1, y: 2.0, w: 8, h: 2,
          align: "center", fontFace: activeTheme.fontDisplay.split(",")[0],
          fontSize: 24, italic: true, color: hexColor(activeTheme.titleColor)
        });
        slide.addText(`— ${slideData.author || "Source"}`, {
          x: 1, y: 4.2, w: 8, h: 0.5,
          align: "center", fontFace: activeTheme.fontSans.split(",")[0],
          fontSize: 14, color: hexColor(activeTheme.textColor)
        });
      }
    });

    const docNameClean = selectedDoc?.name.split(".")[0] || "AcuSlide";
    pptx.writeFile({ fileName: `${docNameClean}-presentation.pptx` });
  };

  // Edit fields handlers
  const updateSlideField = (field: string, val: any) => {
    const copy = [...slides];
    copy[activeSlideIdx] = {
      ...copy[activeSlideIdx],
      [field]: val
    };
    setSlides(copy);
  };

  const updateSlideBullet = (idx: number, val: string) => {
    const copy = [...slides];
    const bulletCopy = [...copy[activeSlideIdx].bullets];
    bulletCopy[idx] = val;
    copy[activeSlideIdx] = {
      ...copy[activeSlideIdx],
      bullets: bulletCopy
    };
    setSlides(copy);
  };

  const activeSlide = slides[activeSlideIdx];

  return (
    <div className="space-y-6">
      {/* Configuration Header Panel */}
      <div className="glass-panel p-6 rounded-2xl space-y-4">
        <div className="text-left">
          <h2 className="text-2xl sm:text-3xl font-display font-bold text-white mb-1">AcuStudy Workspace</h2>
          <p className="text-slate-400 text-sm">Convert textbook chapters into slides, study guides, timelines, FAQs, and podcasts.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1 text-left">
            <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Select Subject</label>
            <select
              value={selectedSubject}
              onChange={(e) => {
                setSelectedSubject(e.target.value);
                setSelectedChapterKey("");
                setSelectedDoc(null);
                handleChapterChange(-1);
              }}
              className="w-full bg-slate-950/60 border border-slate-800 focus:border-violet-500 rounded-xl py-2 px-3 text-xs text-white outline-none cursor-pointer"
            >
              <option value="">-- Choose Subject --</option>
              {subjectsList.map((subj) => (
                <option key={subj} value={subj}>{subj}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1 text-left">
            <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Select Chapter</label>
            <select
              disabled={!selectedSubject}
              value={selectedChapterKey}
              onChange={async (e) => {
                const val = e.target.value;
                setSelectedChapterKey(val);
                if (!val) {
                  setSelectedDoc(null);
                  handleChapterChange(-1);
                  return;
                }
                const chap = flatChapters.find(c => `${c.docId}_${c.chapIdx}` === val);
                if (chap) {
                  let doc = documents.find(d => d.id === chap.docId) || null;
                  
                  if (doc && (!doc.pages || doc.pages.length === 0)) {
                    setLoading(true);
                    setLoadingMessage(`Loading payload for "${doc.name}"...`);
                    try {
                      doc = await hydrateDocumentPayload(doc, user?.id || "anonymous");
                    } catch (hErr: any) {
                      alert(hErr.message || "Could not load document payload.");
                    }
                    setLoading(false);
                    setLoadingMessage("");
                  }
                  
                  setSelectedDoc(doc);
                  handleChapterChange(chap.chapIdx);
                }
              }}
              className="w-full bg-slate-950/60 border border-slate-800 focus:border-violet-500 rounded-xl py-2 px-3 text-xs text-white outline-none cursor-pointer disabled:opacity-50"
            >
              <option value="">-- Choose chapter --</option>
              {flatChapters.map((chap) => (
                <option key={`${chap.docId}_${chap.chapIdx}`} value={`${chap.docId}_${chap.chapIdx}`}>
                  {chap.name} ({chap.docName})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={() => handleTabChange("notes")}
              disabled={loading || !selectedDoc || selectedChapterIdx === -1}
              className="w-full py-2.5 bg-violet-600 hover:bg-violet-500 disabled:bg-violet-800 text-white rounded-xl text-xs font-semibold tracking-wide transition-colors cursor-pointer flex items-center justify-center gap-1.5"
            >
              {loading ? <RefreshCw className="animate-spin" size={14} /> : <Play size={14} />}
              Open Study Desk
            </button>
          </div>
        </div>
      </div>

      {/* Loading Screen */}
      {loading && (
        <div className="p-12 text-center border border-slate-800 rounded-2xl space-y-3">
          <RefreshCw className="animate-spin text-violet-400 mx-auto" size={28} />
          <h4 className="text-sm font-semibold text-white">{loadingMessage}</h4>
          <p className="text-xs text-slate-500">Synthesizing layouts, keywords, questions, or scripts.</p>
        </div>
      )}

      {/* NotebookLM workspace Subtabs */}
      {!loading && (slides.length > 0 || notes || faq || timeline || podcast) && (
        <div className="flex flex-wrap gap-2 border-b border-slate-900 pb-3">
          <button
            onClick={() => handleTabChange("notes")}
            className={`flex items-center gap-2 py-2 px-4 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeStudyTab === "notes" 
                ? "bg-violet-600 text-white" 
                : "bg-slate-950 hover:bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
            }`}
          >
            <FileText size={14} /> Study Guide
          </button>
          <button
            onClick={() => handleTabChange("faq")}
            className={`flex items-center gap-2 py-2 px-4 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeStudyTab === "faq" 
                ? "bg-violet-600 text-white" 
                : "bg-slate-950 hover:bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
            }`}
          >
            <HelpCircle size={14} /> FAQ Sheet
          </button>
          <button
            onClick={() => handleTabChange("slides")}
            className={`flex items-center gap-2 py-2 px-4 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeStudyTab === "slides" 
                ? "bg-violet-600 text-white" 
                : "bg-slate-950 hover:bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
            }`}
          >
            <Presentation size={14} /> Presentation Slides
          </button>
          <button
            onClick={() => handleTabChange("timeline")}
            className={`flex items-center gap-2 py-2 px-4 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeStudyTab === "timeline" 
                ? "bg-violet-600 text-white" 
                : "bg-slate-950 hover:bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
            }`}
          >
            <Clock size={14} /> timeline
          </button>
          <button
            onClick={() => handleTabChange("podcast")}
            className={`flex items-center gap-2 py-2 px-4 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeStudyTab === "podcast" 
                ? "bg-violet-600 text-white" 
                : "bg-slate-950 hover:bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
            }`}
          >
            <Volume2 size={14} /> Podcast Overview
          </button>
          <button
            onClick={() => handleTabChange("mcq")}
            className={`flex items-center gap-2 py-2 px-4 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeStudyTab === "mcq" 
                ? "bg-violet-600 text-white" 
                : "bg-slate-950 hover:bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
            }`}
          >
            <ListChecks size={14} /> Practice MCQs
          </button>
          <button
            onClick={handleOpenFlashcards}
            disabled={!selectedDoc || selectedChapterIdx === -1}
            className="flex items-center gap-2 py-2 px-4 rounded-xl text-xs font-semibold bg-violet-950 text-violet-400 hover:text-white hover:bg-slate-900 border border-violet-500/30 transition-all cursor-pointer disabled:opacity-50"
          >
            <Layers size={14} /> Practice Flashcards
          </button>
        </div>
      )}

      {/* TAB CONTENT STAGE */}
      {!loading && (
        <>
          {/* TAB 1: PRESENTATION SLIDES */}
          {activeStudyTab === "slides" && slides.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start animate-fade-in">
              <div className="lg:col-span-3 glass-panel p-4 rounded-2xl space-y-2 max-h-[500px] overflow-y-auto">
                <h4 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2 text-left">Slide List</h4>
                {slides.map((s, idx) => (
                  <div 
                    key={s.id} 
                    className={`p-3 rounded-xl border text-xs text-left cursor-pointer transition-all flex items-center gap-3 ${
                      activeSlideIdx === idx 
                        ? "bg-violet-950/40 border-violet-500/50 text-white font-medium" 
                        : "border-slate-900 bg-slate-950/20 text-slate-400 hover:text-white"
                    }`}
                    onClick={() => {
                      setActiveSlideIdx(idx);
                      setEditMode(false);
                    }}
                  >
                    <div className="w-5 h-5 rounded bg-slate-900 border border-slate-800 flex items-center justify-center text-[10px]">{idx + 1}</div>
                    <div className="truncate flex-1">
                      <p className="font-bold truncate">{s.title || "Untitled"}</p>
                      <p className="text-[9px] text-slate-500 uppercase truncate">{s.layout} Layout</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="lg:col-span-9 space-y-6">
                <div 
                  className="w-full aspect-[16/9] rounded-2xl flex flex-col justify-between p-8 sm:p-12 relative overflow-hidden transition-all duration-300 border border-slate-800"
                  style={{ background: activeTheme.bg, color: activeTheme.textColor, fontFamily: activeTheme.fontSans }}
                >
                  <div className="absolute top-1/4 left-1/4 w-72 h-72 rounded-full bg-white/5 blur-3xl pointer-events-none"></div>

                  {activeSlide.layout === "title" && (
                    <div className="my-auto text-center space-y-3">
                      <h3 className="text-2xl sm:text-4xl font-extrabold tracking-tight" style={{ color: activeTheme.titleColor, fontFamily: activeTheme.fontDisplay }}>
                        {activeSlide.title}
                      </h3>
                      {activeSlide.subtitle && <p className="text-sm sm:text-lg opacity-80">{activeSlide.subtitle}</p>}
                    </div>
                  )}

                  {activeSlide.layout === "bullets" && (
                    <div className="h-full flex flex-col justify-start space-y-4">
                      <h3 className="text-xl sm:text-2xl font-bold tracking-tight border-b border-white/10 pb-2 text-left" style={{ color: activeTheme.titleColor, fontFamily: activeTheme.fontDisplay }}>
                        {activeSlide.title}
                      </h3>
                      <ul className="space-y-3 pl-4 text-left list-disc text-xs sm:text-sm leading-relaxed">
                        {(activeSlide.bullets || []).map((bullet: string, i: number) => (
                          <li key={i} className="opacity-90">{bullet}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {activeSlide.layout === "comparison" && (
                    <div className="h-full flex flex-col justify-start space-y-4">
                      <h3 className="text-xl sm:text-2xl font-bold tracking-tight border-b border-white/10 pb-2 text-left" style={{ color: activeTheme.titleColor, fontFamily: activeTheme.fontDisplay }}>
                        {activeSlide.title}
                      </h3>
                      <div className="grid grid-cols-2 gap-6 flex-1 text-left">
                        <div className="space-y-2">
                          <h4 className="text-xs sm:text-sm font-bold uppercase tracking-wider" style={{ color: activeTheme.accentColor }}>
                            {activeSlide.leftColumn?.header || "Column Left"}
                          </h4>
                          <ul className="space-y-2 pl-4 list-disc text-[10px] sm:text-xs leading-relaxed opacity-80">
                            {(activeSlide.leftColumn?.items || []).map((item: string, i: number) => (
                              <li key={i}>{item}</li>
                            ))}
                          </ul>
                        </div>
                        <div className="space-y-2">
                          <h4 className="text-xs sm:text-sm font-bold uppercase tracking-wider" style={{ color: activeTheme.accentColor }}>
                            {activeSlide.rightColumn?.header || "Column Right"}
                          </h4>
                          <ul className="space-y-2 pl-4 list-disc text-[10px] sm:text-xs leading-relaxed opacity-80">
                            {(activeSlide.rightColumn?.items || []).map((item: string, i: number) => (
                              <li key={i}>{item}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeSlide.layout === "quote" && (
                    <div className="my-auto text-center space-y-4">
                      <p className="text-lg sm:text-2xl italic leading-relaxed" style={{ color: activeTheme.titleColor, fontFamily: activeTheme.fontDisplay }}>
                        “{activeSlide.quote}”
                      </p>
                      {activeSlide.author && <p className="text-xs sm:text-sm tracking-wider uppercase opacity-75">— {activeSlide.author}</p>}
                    </div>
                  )}

                  <div className="flex justify-between items-center text-[8px] sm:text-[10px] opacity-50 border-t border-white/5 pt-2">
                    <span>Chapter: {selectedDoc?.chapterMap?.[selectedChapterIdx]?.name || ""}</span>
                    <span>Slide {activeSlideIdx + 1} of {slides.length}</span>
                  </div>
                </div>

                {/* Toolbar */}
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-1.5">
                    <button
                      disabled={activeSlideIdx === 0}
                      onClick={() => { setActiveSlideIdx(activeSlideIdx - 1); setEditMode(false); }}
                      className="p-2 rounded-xl bg-slate-950 hover:bg-slate-900 border border-slate-800 disabled:opacity-50 text-slate-300 transition-colors cursor-pointer"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <span className="text-xs text-slate-400 font-semibold px-2">{activeSlideIdx + 1} / {slides.length}</span>
                    <button
                      disabled={activeSlideIdx === slides.length - 1}
                      onClick={() => { setActiveSlideIdx(activeSlideIdx + 1); setEditMode(false); }}
                      className="p-2 rounded-xl bg-slate-950 hover:bg-slate-900 border border-slate-800 disabled:opacity-50 text-slate-300 transition-colors cursor-pointer"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="relative group">
                      <button className="flex items-center gap-1.5 px-4 py-2 bg-slate-950 hover:bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-300 transition-colors cursor-pointer">
                        <Palette size={14} /> Theme
                      </button>
                      <div className="absolute bottom-full right-0 mb-2 w-48 bg-slate-950 border border-slate-800 rounded-xl p-2 hidden group-hover:block z-20 shadow-xl">
                        {TRANSITION_THEMES.map((theme, i) => (
                          <button
                            key={i}
                            onClick={() => setActiveTheme(theme)}
                            className={`w-full py-1.5 px-3 rounded-lg text-left text-xs transition-colors flex items-center justify-between ${
                              activeTheme.name === theme.name ? "bg-violet-950/40 text-violet-400 font-semibold" : "text-slate-400 hover:text-white hover:bg-slate-900"
                            }`}
                          >
                            {theme.name}
                            {activeTheme.name === theme.name && <Check size={10} />}
                          </button>
                        ))}
                      </div>
                    </div>

                    <button 
                      onClick={() => setEditMode(!editMode)}
                      className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs transition-colors cursor-pointer border ${
                        editMode ? "bg-violet-600 border-violet-500 text-white" : "bg-slate-950 hover:bg-slate-900 border-slate-800 text-slate-300"
                      }`}
                    >
                      <Edit2 size={14} /> {editMode ? "Close Editor" : "Edit Slide"}
                    </button>

                    <button
                      onClick={handleExportSlidesPDF}
                      className="flex items-center gap-1.5 px-4 py-2 bg-indigo-650 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer shadow-md"
                    >
                      <Download size={14} /> Export PDF
                    </button>

                    <button
                      onClick={handleDownloadPPTX}
                      className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer shadow-md"
                    >
                      <Download size={14} /> Export PowerPoint
                    </button>

                    <button
                      onClick={() => handleRegenerateArtifact("slides")}
                      className="flex items-center gap-1.5 px-4 py-2 bg-violet-950 border border-violet-900/40 text-violet-400 hover:text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                    >
                      <RefreshCw size={14} /> Regenerate
                    </button>
                  </div>
                </div>

                {/* Inline slide editor */}
                {editMode && (
                  <div className="glass-panel p-6 rounded-2xl space-y-4 text-left">
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-2">Edit Slide Content</h4>
                    {(activeSlide.layout === "title" || activeSlide.layout === "bullets" || activeSlide.layout === "comparison") && (
                      <div className="space-y-1">
                        <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Slide Title</label>
                        <input
                          type="text"
                          value={activeSlide.title || ""}
                          onChange={(e) => updateSlideField("title", e.target.value)}
                          className="w-full bg-slate-950/60 border border-slate-800 focus:border-violet-500 rounded-lg py-2 px-3 text-xs text-white outline-none"
                        />
                      </div>
                    )}
                    {activeSlide.layout === "title" && (
                      <div className="space-y-1">
                        <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Slide Subtitle</label>
                        <input
                          type="text"
                          value={activeSlide.subtitle || ""}
                          onChange={(e) => updateSlideField("subtitle", e.target.value)}
                          className="w-full bg-slate-950/60 border border-slate-800 focus:border-violet-500 rounded-lg py-2 px-3 text-xs text-white outline-none"
                        />
                      </div>
                    )}
                    {activeSlide.layout === "bullets" && (
                      <div className="space-y-3">
                        <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Bullet Points</label>
                        {(activeSlide.bullets || []).map((bullet: string, i: number) => (
                          <input
                            key={i}
                            type="text"
                            value={bullet}
                            onChange={(e) => updateSlideBullet(i, e.target.value)}
                            className="w-full bg-slate-950/60 border border-slate-800 focus:border-violet-500 rounded-lg py-2 px-3 text-xs text-white outline-none"
                          />
                        ))}
                      </div>
                    )}
                    {activeSlide.layout === "quote" && (
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Quote Content</label>
                          <textarea
                            value={activeSlide.quote || ""}
                            onChange={(e) => updateSlideField("quote", e.target.value)}
                            rows={3}
                            className="w-full bg-slate-950/60 border border-slate-800 focus:border-violet-500 rounded-lg py-2 px-3 text-xs text-white outline-none resize-none"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Author Reference</label>
                          <input
                            type="text"
                            value={activeSlide.author || ""}
                            onChange={(e) => updateSlideField("author", e.target.value)}
                            className="w-full bg-slate-950/60 border border-slate-800 focus:border-violet-500 rounded-lg py-2 px-3 text-xs text-white outline-none"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: STUDY GUIDE NOTES */}
          {activeStudyTab === "notes" && notes && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start text-left animate-fade-in">
              <div className="lg:col-span-8 glass-panel p-6 rounded-2xl space-y-6">
                <div className="border-b border-slate-800 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <h3 className="font-display font-extrabold text-white text-lg">{notes.title || "Study Briefing Guide"}</h3>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleExportNotesPDF}
                      className="py-1 px-3 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 rounded-lg text-[10px] font-semibold transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <Download size={10} /> Export PDF
                    </button>
                    <button
                      onClick={() => handleRegenerateArtifact("notes")}
                      className="py-1 px-3 bg-violet-950 border border-violet-900/40 hover:bg-slate-900 text-violet-400 hover:text-white rounded-lg text-[10px] font-semibold transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <RefreshCw size={10} /> Regenerate
                    </button>
                    <span className="text-[10px] font-semibold text-violet-400 bg-violet-950/40 px-2.5 py-1 rounded border border-violet-500/20 uppercase tracking-wider">Syllabus Summary</span>
                  </div>
                </div>
                
                <div className="space-y-6">
                  {notes.chapters?.map((chap: any, idx: number) => (
                    <div key={idx} className="space-y-3">
                      <h4 className="text-sm font-bold text-white flex items-center gap-2">
                        <span className="w-5 h-5 rounded bg-violet-600/20 border border-violet-500/30 text-violet-400 text-[10px] flex items-center justify-center font-bold font-display">{idx+1}</span>
                        {chap.title}
                      </h4>
                      <p className="text-xs text-slate-400 leading-relaxed pl-7">{chap.content}</p>
                      
                      {chap.takeaways && chap.takeaways.length > 0 && (
                        <div className="pl-7 pt-1 space-y-1">
                          {chap.takeaways.map((takeaway: string, tIdx: number) => (
                            <div key={tIdx} className="text-xs text-slate-300 flex items-start gap-2">
                              <span className="text-violet-500 pt-0.5">•</span>
                              <span>{takeaway}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Glossary Definitions Sidebar */}
              <div className="lg:col-span-4 glass-panel p-6 rounded-2xl space-y-4">
                <div className="flex items-center gap-2 text-violet-400 border-b border-slate-800 pb-2">
                  <ListCollapse size={16} />
                  <h4 className="font-display font-bold text-white text-sm">Key Glossary Terms</h4>
                </div>
                
                {notes.glossary && notes.glossary.length > 0 ? (
                  <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                    {notes.glossary.map((g: any, idx: number) => (
                      <div key={idx} className="p-3 bg-slate-950/40 border border-slate-800 rounded-xl space-y-1 text-[11px]">
                        <span className="font-bold text-violet-300">{g.term}</span>
                        <p className="text-slate-500 leading-relaxed">{g.definition}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">No glossary terms identified for this section.</p>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: FAQ SHEET */}
          {activeStudyTab === "faq" && faq && (
            <div className="glass-panel p-6 rounded-2xl text-left space-y-6 max-w-4xl mx-auto animate-fade-in">
              <div className="border-b border-slate-800 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h3 className="font-display font-extrabold text-white text-lg">Frequently Asked Questions (FAQ)</h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleExportFaqPDF}
                    className="py-1 px-3 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 rounded-lg text-[10px] font-semibold transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <Download size={10} /> Export PDF
                  </button>
                  <button
                    onClick={() => handleRegenerateArtifact("faq")}
                    className="py-1 px-3 bg-violet-950 border border-violet-900/40 hover:bg-slate-900 text-violet-400 hover:text-white rounded-lg text-[10px] font-semibold transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <RefreshCw size={10} /> Regenerate
                  </button>
                  <span className="text-[10px] font-semibold text-violet-400 bg-violet-950/40 px-2.5 py-1 rounded border border-violet-500/20 uppercase tracking-wider">Concept Clues</span>
                </div>
              </div>

              {faq.faqs && faq.faqs.length > 0 ? (
                <div className="space-y-4">
                  {faq.faqs.map((f: any, idx: number) => (
                    <div key={idx} className="p-4 rounded-xl border border-slate-850 bg-slate-950/20 space-y-2">
                      <div className="flex items-start gap-2.5">
                        <span className="text-xs font-bold text-violet-400 bg-violet-950/60 border border-violet-500/30 px-1.5 py-0.5 rounded shrink-0">Q</span>
                        <h4 className="text-xs sm:text-sm font-bold text-white pt-0.5">{f.question}</h4>
                      </div>
                      <div className="pl-8 text-xs text-slate-400 leading-relaxed">
                        {f.answer}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500 text-center">No FAQs generated.</p>
              )}
            </div>
          )}

          {/* TAB 4: CHRONOLOGICAL TIMELINE */}
          {activeStudyTab === "timeline" && timeline && (
            <div className="glass-panel p-6 rounded-2xl text-left space-y-6 max-w-3xl mx-auto animate-fade-in">
              <div className="border-b border-slate-800 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h3 className="font-display font-extrabold text-white text-lg">Chronological Timeline & Process steps</h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleRegenerateArtifact("timeline")}
                    className="py-1 px-3 bg-violet-950 border border-violet-900/40 hover:bg-slate-900 text-violet-400 hover:text-white rounded-lg text-[10px] font-semibold transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <RefreshCw size={10} /> Regenerate
                  </button>
                  <span className="text-[10px] font-semibold text-violet-400 bg-violet-950/40 px-2.5 py-1 rounded border border-violet-500/20 uppercase tracking-wider">Workflow Mapping</span>
                </div>
              </div>

              {timeline.timeline && timeline.timeline.length > 0 ? (
                <div className="relative pl-6 border-l border-slate-800 space-y-8 py-2 ml-4">
                  {timeline.timeline.map((item: any, idx: number) => (
                    <div key={idx} className="relative">
                      {/* Timeline dot */}
                      <span className="absolute -left-[31px] top-1.5 w-4 h-4 rounded-full bg-violet-600 border border-slate-950 flex items-center justify-center shadow-lg shadow-violet-600/30">
                        <span className="w-1.5 h-1.5 rounded-full bg-white"></span>
                      </span>
                      
                      <div className="space-y-1.5">
                        <span className="text-[10px] font-semibold text-violet-400 uppercase tracking-wider bg-violet-950/40 border border-violet-500/20 px-2 py-0.5 rounded">
                          {item.timeLabel}
                        </span>
                        <h4 className="text-xs sm:text-sm font-bold text-white pt-1">{item.title}</h4>
                        <p className="text-xs text-slate-400 leading-relaxed">{item.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500 text-center">No chronological sequence mapped from this text.</p>
              )}
            </div>
          )}

          {/* TAB 5: MCQ */}
          {activeStudyTab === "mcq" && mcqs && (
            <div className="glass-panel p-6 rounded-2xl text-left space-y-6 max-w-4xl mx-auto animate-fade-in">
              <div className="border-b border-slate-800 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h3 className="font-display font-extrabold text-white text-lg">Practice MCQs</h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleExportMcqPDF}
                    className="py-1 px-3 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 rounded-lg text-[10px] font-semibold transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <Download size={10} /> Export PDF
                  </button>
                  <button
                    onClick={() => handleRegenerateArtifact("mcq")}
                    className="py-1 px-3 bg-violet-950 border border-violet-900/40 hover:bg-slate-900 text-violet-400 hover:text-white rounded-lg text-[10px] font-semibold transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <RefreshCw size={10} /> Regenerate
                  </button>
                  <span className="text-[10px] font-semibold text-violet-400 bg-violet-950/40 px-2.5 py-1 rounded border border-violet-500/20 uppercase tracking-wider">Self Assessment</span>
                </div>
              </div>
              <div className="space-y-4">
                {mcqs.map((mcq: any, idx: number) => (
                  <details key={idx} className="group p-4 rounded-xl border border-slate-850 bg-slate-950/20 space-y-2 cursor-pointer">
                    <summary className="flex items-start gap-2.5 outline-none list-none">
                      <span className="text-xs font-bold text-violet-400 bg-violet-950/60 border border-violet-500/30 px-1.5 py-0.5 rounded shrink-0">{idx + 1}</span>
                      <div className="space-y-3 pt-0.5 w-full">
                        <h4 className="text-xs sm:text-sm font-bold text-white">{mcq.question}</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-300">
                          {mcq.options.map((opt: string, oIdx: number) => (
                            <div key={oIdx} className="bg-slate-900/50 p-2 rounded-lg border border-slate-800 flex items-center gap-2">
                              <div className="w-4 h-4 rounded-full border border-slate-700 flex-shrink-0" />
                              {opt}
                            </div>
                          ))}
                        </div>
                        <div className="text-xs text-violet-400 font-semibold mt-2 group-open:hidden">
                          Click to reveal answer
                        </div>
                      </div>
                    </summary>
                    <div className="pl-8 pt-4 text-xs space-y-2 border-t border-slate-800/50 mt-4">
                      <div className="font-bold text-emerald-400 flex items-center gap-2">
                        <Check size={14} /> Correct Answer: {mcq.correctAnswer}
                      </div>
                      <div className="text-slate-400 leading-relaxed">
                        {mcq.explanation}
                      </div>
                    </div>
                  </details>
                ))}
              </div>
            </div>
          )}

          {/* TAB 6: PODCAST */}
          {activeStudyTab === "podcast" && (
            <>
              {!podcast ? (
                <div className="glass-panel p-8 rounded-2xl text-center space-y-4 max-w-2xl mx-auto animate-fade-in border border-amber-500/30 bg-amber-950/10">
                  <div className="w-12 h-12 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-2 text-amber-400">
                    <AlertCircle size={24} />
                  </div>
                  <h3 className="font-display font-bold text-white text-lg">Generate Audio Podcast</h3>
                  <p className="text-sm text-slate-300 leading-relaxed max-w-lg mx-auto">
                    Creating a full conversational podcast script consumes significant AI quota and takes a few moments. Are you sure you want to generate it for this chapter?
                  </p>
                  <button 
                    onClick={() => fetchArtifact("podcast")}
                    className="mt-4 px-6 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-sm font-semibold transition-colors flex items-center gap-2 mx-auto"
                  >
                    <Volume2 size={16} /> Generate Podcast Script
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch text-left animate-fade-in">
                  {/* Left Column: Dialogue script list */}
                  <div className="lg:col-span-8 glass-panel p-6 rounded-2xl flex flex-col justify-between space-y-6">
                    <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
                      <h3 className="font-display font-extrabold text-white text-lg">Audio Podcast Overview Script</h3>
                      <span className="text-[10px] font-semibold text-violet-400 bg-violet-950/40 px-2.5 py-1 rounded border border-violet-500/20 uppercase tracking-wider">Audio Overview</span>
                    </div>

                    <div className="space-y-4 max-h-[450px] overflow-y-auto pr-2 flex-1 mb-4">
                      {podcast.script?.map((line: any, idx: number) => {
                        const isHostA = line.speaker === "Host A" || line.speaker.includes("A");
                        return (
                          <div key={idx} className={`flex gap-4 ${isHostA ? "" : "flex-row-reverse"}`}>
                            <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center font-bold text-[10px] ${isHostA ? "bg-violet-600/20 text-violet-400 border border-violet-500/30" : "bg-emerald-600/20 text-emerald-400 border border-emerald-500/30"}`}>
                              {isHostA ? "HA" : "HB"}
                            </div>
                            <div className={`p-3 rounded-xl max-w-[80%] text-sm leading-relaxed ${isHostA ? "bg-slate-900/50 border border-slate-800 text-slate-300 rounded-tl-none" : "bg-violet-950/20 border border-violet-900/30 text-slate-300 rounded-tr-none"}`}>
                              <span className={`text-[10px] uppercase font-bold block mb-1 ${isHostA ? "text-violet-400" : "text-emerald-400"}`}>{line.speaker}</span>
                              {line.text}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Right Column: Audio player controls */}
                  <div className="lg:col-span-4 glass-panel p-6 rounded-2xl flex flex-col items-center justify-center space-y-6 text-center border border-violet-500/20">
                    <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-violet-600 to-fuchsia-600 p-1">
                      <div className="w-full h-full bg-slate-950 rounded-full flex items-center justify-center">
                        <Mic size={32} className={podcastPlaying ? "text-violet-400 animate-pulse" : "text-slate-500"} />
                      </div>
                    </div>
                    <div>
                      <h4 className="font-bold text-white text-lg">AI Audio Playback</h4>
                      <p className="text-xs text-slate-400 mt-1">Listen to the generated overview</p>
                    </div>
                    
                    <button
                      onClick={handlePlayPodcast}
                      className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${
                        podcastPlaying 
                          ? "bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 border border-rose-500/30" 
                          : "bg-violet-600 text-white hover:bg-violet-500"
                      }`}
                    >
                      {podcastPlaying ? (
                        <><VolumeX size={18} /> Stop Playback</>
                      ) : (
                        <><Play size={18} /> Play Podcast</>
                      )}
                    </button>

                    <button 
                      onClick={() => handleRegenerateArtifact("podcast")}
                      className="w-full py-2.5 bg-slate-950 hover:bg-slate-900 border border-slate-800 text-slate-300 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer mt-2"
                    >
                      <RefreshCw size={14} /> Regenerate Script
                    </button>
                    
                    <div className="text-[10px] text-slate-500 max-w-xs leading-relaxed">
                      Using standard browser text-to-speech API. Voice quality depends on your OS configuration.
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Initial empty library notice */}
      {slides.length === 0 && !loading && (
        <div className="p-12 text-center border border-dashed border-slate-800 rounded-2xl text-slate-500 space-y-2">
          <FileText className="mx-auto text-slate-600 animate-pulse" size={32} />
          <h4 className="text-sm font-semibold text-white">Generate your study guide workspace</h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Select a textbook and chapter in the panel above to generate presentation slides, faq questions, briefing notes, and podcast transcripts.
          </p>
        </div>
      )}

      {/* 3D Active-Recall Flashcards Overlay */}
      {showFlashcards && (
        <AcuCard
          cards={flashcards || []}
          onClose={() => setShowFlashcards(false)}
          chapterName={selectedDoc?.chapterMap?.[selectedChapterIdx]?.name || ""}
          onGenerateMore={handleGenerateMoreFlashcards}
          isLoading={flashcardLoading}
        />
      )}
    </div>
  );
}
