"use client";

import React, { useState } from "react";
import { dbService, UserProfile, DocumentSource } from "@/lib/db";
import { extractTextPageByPage } from "@/lib/pdfParser";
import { extractWordText } from "@/lib/docxParser";
import { generateChapterMap } from "@/lib/gemini";
import { 
  Upload, FileText, Trash2, FolderOpen, Calendar, 
  Layers, RefreshCw, BookOpen, ShieldAlert,
  ChevronRight, ChevronDown
} from "lucide-react";

interface AcuLibraryProps {
  user: UserProfile;
  documents: DocumentSource[];
  onRefresh: () => void;
}

export default function AcuLibrary({ user, documents, onRefresh }: AcuLibraryProps) {
  const [uploading, setUploading] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  // Subject selectors
  const [selectedSubjectType, setSelectedSubjectType] = useState("Science");
  const [customSubjectText, setCustomSubjectText] = useState("");
  const activeSubject = selectedSubjectType === "Custom" ? customSubjectText : selectedSubjectType;

  // Collapsible subjects state (default collapsed: empty state means all collapsed)
  const [expandedSubjects, setExpandedSubjects] = useState<{ [subject: string]: boolean }>({});

  const toggleSubject = (subject: string) => {
    setExpandedSubjects((prev) => ({
      ...prev,
      [subject]: !prev[subject],
    }));
  };

  const handleDeviceUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newUploadCount = files.length;
    if (!user.is_premium && documents.length + newUploadCount > 2) {
      alert(`Free accounts are limited to 2 uploaded documents. You currently have ${documents.length} and are attempting to upload ${newUploadCount}. Upgrade to Premium to upload unlimited study materials!`);
      return;
    }

    setUploading(true);

    try {
      for (let fIdx = 0; fIdx < files.length; fIdx++) {
        const file = files[fIdx];
        setStatusMessage(`[File ${fIdx + 1}/${files.length}] Extracting text from ${file.name}...`);

        let pages: { pageNumber: number; text: string }[] = [];
        const extension = file.name.split('.').pop()?.toLowerCase();

        if (extension === "pdf") {
          pages = await extractTextPageByPage(file);
        } else if (extension === "docx") {
          pages = await extractWordText(file);
        } else if (extension === "txt") {
          const text = await file.text();
          pages = [{ pageNumber: 1, text }];
        } else {
          throw new Error(`Unsupported file format for ${file.name}. Please upload PDF, Docx, or Txt files.`);
        }

        if (pages.length === 0 || pages.every(p => !p.text)) {
          throw new Error(`No readable text found in ${file.name}. If this is a scanned PDF, please convert it to selectable text.`);
        }

        setStatusMessage(`[File ${fIdx + 1}/${files.length}] Mapping syllabus chapters for ${file.name}...`);

        const tocPages = pages.slice(0, 5).map(p => `[Page ${p.pageNumber}]\n${p.text}`).join("\n\n");
        let chapterMap: { name: string; summary: string; startPage: number; endPage: number }[] = [];

        try {
          chapterMap = await generateChapterMap(tocPages);
        } catch (err) {
          console.warn("Could not auto-generate chapter map, creating default pages mapping.", err);
          chapterMap = [];
          const pagesPerChapter = 10;
          for (let i = 0; i < pages.length; i += pagesPerChapter) {
            const chapNum = Math.floor(i / pagesPerChapter) + 1;
            const endPage = Math.min(i + pagesPerChapter, pages.length);
            chapterMap.push({
              name: `Chapter ${chapNum} (Pages ${i+1} to ${endPage})`,
              summary: "Syllabus reading block.",
              startPage: i + 1,
              endPage
            });
          }
        }

        // Normalize: Convert "Unit X" chapter names to "Chapter X" for consistent terminology
        chapterMap = chapterMap.map((chap, idx) => ({
          ...chap,
          name: chap.name.replace(/^Unit\s+\d+/, `Chapter ${idx + 1}`),
          summary: chap.summary || "Syllabus section."
        }));

        const newDoc: DocumentSource = {
          id: "doc_" + Math.random().toString(36).substring(2, 9),
          name: file.name,
          subject: activeSubject || "General",
          pages,
          chapterMap,
          created_at: new Date().toISOString()
        };

        await dbService.saveDocumentSource(newDoc);
      }

      setStatusMessage("Success! All files indexed.");
      
      // Auto-expand the target upload subject so the user sees their new document immediately!
      if (activeSubject) {
        setExpandedSubjects(prev => ({ ...prev, [activeSubject]: true }));
      }

      setTimeout(() => {
        setUploading(false);
        setStatusMessage("");
        onRefresh();
      }, 1500);
    } catch (err: any) {
      alert("Ingestion failed: " + (err.message || String(err)));
      setUploading(false);
      setStatusMessage("");
      onRefresh();
    }
  };

  const handleDeleteDocument = async (docId: string) => {
    if (confirm("Are you sure you want to delete this document from your library?")) {
      await dbService.deleteDocumentSource(docId);
      onRefresh();
    }
  };

  // Group documents by their subject
  const groupedDocs: { [subject: string]: DocumentSource[] } = {};
  documents.forEach((doc) => {
    const subj = doc.subject || "General";
    if (!groupedDocs[subj]) {
      groupedDocs[subj] = [];
    }
    groupedDocs[subj].push(doc);
  });

  return (
    <div className="space-y-6">
      {/* Configuration Header Panel */}
      <div className="glass-panel p-6 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-1 text-left">
          <h2 className="text-2xl sm:text-3xl font-display font-bold text-white mb-1">Acu Library</h2>
          <p className="text-slate-400 text-sm">Upload and manage textbook chapters, lecture transcripts, and study notes.</p>
        </div>

        {/* Dynamic Subject & Upload Configuration Panel */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3 w-full md:w-auto shrink-0">
          <div className="space-y-1 text-left">
            <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Choose Subject</label>
            <select
              value={selectedSubjectType}
              onChange={(e) => setSelectedSubjectType(e.target.value)}
              className="w-full bg-slate-950/60 border border-slate-800 focus:border-violet-500 rounded-xl py-2.5 px-3 text-xs text-white outline-none cursor-pointer"
            >
              <option value="Science">🧪 Science</option>
              <option value="Mathematics">📐 Mathematics</option>
              <option value="Physics">🧲 Physics</option>
              <option value="Chemistry">🧪 Chemistry</option>
              <option value="Biology">🧬 Biology</option>
              <option value="History">📜 History</option>
              <option value="Geography">🗺️ Geography</option>
              <option value="Civics">⚖️ Civics / Political Science</option>
              <option value="English">📖 English</option>
              <option value="Economics">📊 Economics</option>
              <option value="Aptitude">🧠 Aptitude / Mental Ability</option>
              <option value="Custom">✏️ Custom / Other</option>
            </select>
          </div>

          {selectedSubjectType === "Custom" && (
            <div className="space-y-1 text-left">
              <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Custom Subject</label>
              <input
                type="text"
                placeholder="e.g. Sanskrit, Coding"
                value={customSubjectText}
                onChange={(e) => setCustomSubjectText(e.target.value)}
                className="w-full bg-slate-950/60 border border-slate-800 focus:border-violet-500 rounded-xl py-2.5 px-3 text-xs text-white outline-none"
              />
            </div>
          )}

          <div className="shrink-0">
            {uploading ? (
              <div className="py-2.5 px-6 rounded-xl border border-violet-500/20 bg-violet-950/20 text-center flex items-center justify-center gap-3 h-10">
                <RefreshCw className="animate-spin text-violet-400" size={16} />
                <span className="text-xs font-semibold text-violet-300 truncate max-w-[200px]">{statusMessage}</span>
              </div>
            ) : (
              <label className="flex items-center justify-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-xs font-semibold tracking-wide transition-colors cursor-pointer text-center shadow-lg shadow-violet-600/10 h-10">
                <Upload size={14} /> Upload Textbook
                <input 
                  type="file" 
                  accept=".pdf,.docx,.txt" 
                  multiple
                  onChange={handleDeviceUpload}
                  className="hidden" 
                />
              </label>
            )}
          </div>
        </div>
      </div>

      {/* Free Tier Limit Indicator */}
      {!user.is_premium && (
        <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-950/10 text-[11px] text-slate-400 flex items-start gap-2 max-w-xl text-left">
          <ShieldAlert size={16} className="text-amber-500 shrink-0" />
          <div>
            <span className="font-semibold text-white">Free Account Active:</span> You are currently using {documents.length} of 2 active upload slots. Upgrading to the Premium tier allows unlimited file storage, PPTX conversions, and CBSE examinations.
          </div>
        </div>
      )}

      {/* Syllabus Library Section */}
      <div className="glass-panel p-6 rounded-2xl">
        <div className="flex items-center gap-2 mb-6 text-violet-400">
          <BookOpen size={20} />
          <h3 className="font-display font-bold text-white text-base">Indexed Syllabus Library</h3>
        </div>

        {documents.length === 0 ? (
          <div className="text-center p-12 border border-dashed border-slate-800 rounded-2xl text-slate-500 space-y-2">
            <FolderOpen className="mx-auto text-slate-600 animate-pulse" size={32} />
            <h4 className="text-sm font-semibold text-white">Your study library is empty</h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Select "Upload Textbook" above to extract chapters and map lesson scopes for your syllabus.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(groupedDocs).map(([subject, docs]) => {
              const isExpanded = !!expandedSubjects[subject];
              const totalChaps = docs.reduce((acc, doc) => acc + (doc.chapterMap?.length || 0), 0);

              return (
                <div key={subject} className="border border-slate-850 bg-slate-950/10 rounded-2xl overflow-hidden text-left transition-all">
                  {/* Collapsible Subject Header Panel */}
                  <div 
                    onClick={() => toggleSubject(subject)}
                    className="flex items-center justify-between p-4 bg-slate-900/40 hover:bg-slate-900/60 cursor-pointer border-b border-slate-900 transition-colors select-none"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-sm font-bold text-white tracking-wide">
                        📚 {subject}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-950/40 border border-violet-500/20 text-violet-400 font-semibold uppercase tracking-wider">
                        {docs.length} File(s) • {totalChaps} Chapters Mapped
                      </span>
                    </div>
                    <div className="text-slate-500">
                      {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                    </div>
                  </div>

                  {/* Expanded Content View */}
                  {isExpanded && (
                    <div className="p-4 space-y-4 bg-slate-950/30">
                      {docs.map((doc) => (
                        <div key={doc.id} className="p-4 rounded-xl border border-slate-850 bg-slate-950/50 space-y-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex items-center gap-3">
                              <div className="p-2 rounded-lg bg-slate-900 border border-slate-850 text-slate-400">
                                <FileText size={20} />
                              </div>
                              <div className="text-left">
                                <h4 className="text-sm font-bold text-white leading-tight">{doc.name}</h4>
                                <div className="flex items-center gap-3 text-[10px] text-slate-500 mt-1.5">
                                  <span className="flex items-center gap-1"><Layers size={10} /> {doc.pages.length} Pages</span>
                                  <span className="flex items-center gap-1"><Calendar size={10} /> {new Date(doc.created_at).toLocaleDateString()}</span>
                                </div>
                              </div>
                            </div>
                            
                            <button 
                              onClick={() => handleDeleteDocument(doc.id)}
                              className="p-2 rounded-lg bg-transparent hover:bg-red-950/20 text-slate-500 hover:text-red-400 hover:border-red-500/20 transition-colors"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>

                          {doc.chapterMap && doc.chapterMap.length > 0 && (
                            <div className="border-t border-slate-900/60 pt-3 space-y-2 text-left">
                              <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                                Mapped Lesson Chapters
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {doc.chapterMap.map((chap, idx) => (
                                  <div key={idx} className="p-3 rounded-lg bg-slate-950/70 border border-slate-900/50 flex items-start justify-between gap-4">
                                    <div>
                                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-950/40 border border-violet-500/20 text-violet-400 font-semibold uppercase tracking-wider">
                                        Pages {chap.startPage}–{chap.endPage}
                                      </span>
                                      <h5 className="text-xs font-bold text-white mt-1.5">{chap.name}</h5>
                                      <p className="text-[10px] text-slate-500 mt-1 line-clamp-2">{chap.summary}</p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
