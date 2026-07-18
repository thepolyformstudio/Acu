"use client";

import React, { useState } from "react";
import { dbService, UserProfile, DocumentSource } from "@/lib/db";
import { extractTextPageByPage } from "@/lib/pdfParser";
import { extractWordText } from "@/lib/docxParser";
import { generateChapterMap, extractChapterTitle, BookMetadata, MOCK_API_KEY } from "@/lib/gemini";
import { safeError, logError } from "@/lib/errors";
import { validateFile, validateChapterTitle, validateCustomSubject } from "@/lib/validation";
import { saveDocumentToDrive, deleteDocumentFromDrive, isDriveSignedIn } from "@/lib/googleDrive";
import { 
  Upload, FileText, Trash2, FolderOpen, Calendar, 
  Layers, RefreshCw, BookOpen, ShieldAlert,
  ChevronRight, ChevronDown, Plus, X
} from "lucide-react";

interface AcuLibraryProps {
  user: UserProfile;
  documents: DocumentSource[];
  onRefresh: () => void;
}

export default function AcuLibrary({ user, documents, onRefresh }: AcuLibraryProps) {
  const [uploading, setUploading] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [uploadMode, setUploadMode] = useState<"full_textbook" | "single_chapter">("full_textbook");

  // Staging state
  const [stagedFiles, setStagedFiles] = useState<{file: File, title: string}[] | null>(null);

  // Manual Mapping state
  const [manualMappingQueue, setManualMappingQueue] = useState<{
    file: File;
    pages: { pageNumber: number; text: string }[];
  } | null>(null);
  
  const [manualChapters, setManualChapters] = useState<{name: string, startPage: number, endPage: number}[]>([
    {name: "", startPage: 1, endPage: 1}
  ]);

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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newUploadCount = files.length;
    if (!user.is_premium && documents.length + newUploadCount > 2) {
      alert(`Free accounts are limited to 2 uploaded documents. You currently have ${documents.length} and are attempting to upload ${newUploadCount}. Upgrade to Premium to upload unlimited study materials!`);
      return;
    }

    for (const f of Array.from(files)) {
      const fileErr = validateFile(f);
      if (fileErr) {
        alert(`Invalid file "${f.name}": ${fileErr}`);
        e.target.value = '';
        return;
      }
    }

    setStagedFiles(Array.from(files).map(f => ({ file: f, title: f.name.replace(/\.[^/.]+$/, "") })));
    e.target.value = '';
  };

  const handleProcessStagedFiles = async () => {
    if (!stagedFiles || stagedFiles.length === 0) return;
    const files = stagedFiles;
    
    setStagedFiles(null);
    setUploading(true);

    try {
      for (let fIdx = 0; fIdx < files.length; fIdx++) {
        const stagedItem = files[fIdx];
        const file = stagedItem.file;
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

        setStatusMessage(`[File ${fIdx + 1}/${files.length}] Indexing ${file.name}...`);

        let chapterMap: { name: string; summary: string; startPage: number; endPage: number }[] = [];

        if (uploadMode === "single_chapter") {
          chapterMap = [{
            name: stagedItem.title,
            summary: "Chapter content.",
            startPage: 1,
            endPage: pages.length
          }];
        } else {
          setManualMappingQueue({ file, pages });
          setUploading(false);
          setStatusMessage("");
          return; // Wait for user to manually map
        }

        const newDoc: DocumentSource = {
          id: "doc_" + Math.random().toString(36).substring(2, 9),
          name: stagedItem.title || file.name,
          subject: activeSubject || "General",
          pages,
          chapterMap,
          created_at: new Date().toISOString()
        };

        await dbService.saveDocumentSource(user?.id || "anonymous", newDoc);
        if (isDriveSignedIn()) {
          saveDocumentToDrive(newDoc).catch((err) => logError("Drive backup", err));
        }
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
    } catch (err) {
      logError("File ingestion", err);
      alert(safeError(err, "File ingestion failed. Please check that your file is a valid PDF, DOCX, or TXT."));
      setUploading(false);
      setStatusMessage("");
      onRefresh();
    }
  };

  const handleSaveManualMapping = async () => {
    if (!manualMappingQueue) return;
    
    // Filter out invalid chapters
    const validChapters = manualChapters
      .filter(c => c.name.trim() !== "")
      .map(c => ({
        name: c.name,
        summary: "Manually mapped section.",
        startPage: c.startPage,
        endPage: c.endPage
      }));

    const newDoc: DocumentSource = {
      id: "doc_" + Math.random().toString(36).substring(2, 9),
      name: manualMappingQueue.file.name,
      subject: activeSubject || "General",
      pages: manualMappingQueue.pages,
      chapterMap: validChapters.length > 0 ? validChapters : [{ name: manualMappingQueue.file.name.replace(/\.[^/.]+$/, ""), summary: "Full document", startPage: 1, endPage: manualMappingQueue.pages.length }],
      created_at: new Date().toISOString()
    };

    await dbService.saveDocumentSource(user?.id || "anonymous", newDoc);
    if (isDriveSignedIn()) {
      saveDocumentToDrive(newDoc).catch((err) => logError("Drive backup (manual mapping)", err));
    }

    setManualMappingQueue(null);
    setManualChapters([{name: "", startPage: 1, endPage: 1}]);
    
    if (activeSubject) {
      setExpandedSubjects(prev => ({ ...prev, [activeSubject]: true }));
    }
    onRefresh();
  };

  const handleDeleteDocument = async (docId: string) => {
    if (confirm("Are you sure you want to delete this document from your library?")) {
      await dbService.deleteDocumentSource(user?.id || "anonymous", docId);
      if (isDriveSignedIn()) {
        deleteDocumentFromDrive(docId).catch((err) => logError("Drive delete", err));
      }
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
      <div className="glass-panel p-6 rounded-2xl flex flex-col gap-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 w-full">
          <div className="space-y-1 text-left">
            <div className="flex items-center gap-3 mb-1">
              <h2 className="text-2xl sm:text-3xl font-display font-bold text-white">Acu Library</h2>
              {isDriveSignedIn() && (
                <button 
                  onClick={async () => {
                    const btn = document.getElementById('sync-btn');
                    if (btn) btn.innerText = 'Syncing...';
                    try {
                      for (const doc of documents) {
                        await saveDocumentToDrive(doc);
                        await dbService.saveDocumentSource(user?.id || "anonymous", doc);
                      }
                      if (btn) btn.innerText = 'Synced ✓';
                    } catch (e) {
                      logError("Library backup sync", e);
                      if (btn) btn.innerText = 'Sync Failed';
                    }
                    setTimeout(() => { if (btn) btn.innerText = 'Backup Library'; }, 2000);
                  }}
                  id="sync-btn"
                  className="px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full text-[10px] font-bold uppercase tracking-wider hover:bg-emerald-500/20 transition-colors cursor-pointer"
                  title="Upload all existing files in your library to Google Drive"
                >
                  Backup Library
                </button>
              )}
            </div>
            <p className="text-slate-400 text-sm">Upload and manage textbook chapters, lecture transcripts, and study notes.</p>
          </div>

          {/* Dynamic Subject & Upload Configuration Panel */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3 w-full md:w-auto shrink-0">
            <div className="flex flex-col gap-3">
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
            </div>

            <div className="shrink-0 space-y-1">
              <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Upload Mode</label>
              <div className="flex gap-1 p-0.5 bg-slate-950/50 border border-slate-800 rounded-xl">
                <button
                  type="button"
                  onClick={() => setUploadMode("full_textbook")}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-semibold transition-all cursor-pointer ${
                    uploadMode === "full_textbook"
                      ? "bg-violet-600 text-white shadow-sm"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  Full Textbook
                </button>
                <button
                  type="button"
                  onClick={() => setUploadMode("single_chapter")}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-semibold transition-all cursor-pointer ${
                    uploadMode === "single_chapter"
                      ? "bg-violet-600 text-white shadow-sm"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  Single Chapter
                </button>
              </div>
            </div>

            <div className="shrink-0 flex flex-col gap-1 items-end">
              {uploading ? (
                <div className="py-2.5 px-6 rounded-xl border border-violet-500/20 bg-violet-950/20 text-center flex items-center justify-center gap-3 h-10 w-full sm:w-auto">
                  <RefreshCw className="animate-spin text-violet-400" size={16} />
                  <span className="text-xs font-semibold text-violet-300 truncate max-w-[200px]">{statusMessage}</span>
                </div>
              ) : (!isDriveSignedIn() && !(typeof window !== "undefined" && localStorage.getItem("acu_gemini_api_key") === MOCK_API_KEY)) ? (
                <div className="group relative">
                  <button disabled className="flex items-center justify-center gap-2 px-5 py-2.5 bg-slate-800 text-slate-500 rounded-xl text-xs font-semibold tracking-wide cursor-not-allowed text-center h-10 w-full sm:w-auto">
                    <Upload size={14} /> Upload Textbook
                  </button>
                  <div className="absolute top-full right-0 mt-2 p-3 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-300 shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none w-[220px] z-10 text-right">
                    Please connect your Google Drive in Settings to enable cross-device Library Sync before uploading.
                  </div>
                </div>
              ) : (
                <label className="flex items-center justify-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-xs font-semibold tracking-wide transition-colors cursor-pointer text-center shadow-lg shadow-violet-600/10 h-10 w-full sm:w-auto">
                  <Upload size={14} /> Upload Textbook
                  <input 
                    type="file" 
                    className="hidden" 
                    accept=".pdf,.docx,.txt" 
                    multiple 
                    onChange={handleFileSelect} 
                  />
                </label>
              )}
            </div>
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

                  {/* Expanded Content View — Chapter-level indexing */}
                  {isExpanded && (
                    <div className="p-4 space-y-4 bg-slate-950/30">
                      {/* Compact file list with delete controls */}
                      <div className="flex flex-wrap gap-2">
                        {docs.map((doc) => (
                          <div key={doc.id} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-[10px] text-slate-400">
                            <FileText size={12} className="shrink-0" />
                            <span className="font-semibold text-slate-300 truncate max-w-[160px]">{doc.name}</span>
                            <span className="text-slate-600">({doc.pages.length}p)</span>
                            <button 
                              onClick={() => handleDeleteDocument(doc.id)}
                              className="ml-1 p-0.5 rounded text-slate-600 hover:text-red-400 hover:bg-red-950/20 transition-colors"
                            >
                              <Trash2 size={10} />
                            </button>
                          </div>
                        ))}
                      </div>

                      {/* Flattened chapter list across all documents */}
                      <div className="space-y-2">
                        <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                          All Chapters ({totalChaps})
                        </div>
                        {docs.flatMap((doc) =>
                          (doc.chapterMap || []).map((chap, cIdx) => ({
                            docId: doc.id,
                            docName: doc.name,
                            cIdx,
                            ...chap,
                          }))
                        ).map((chap) => (
                          <div key={`${chap.docId}_${chap.cIdx}`} className="p-3 rounded-lg bg-slate-950/70 border border-slate-900/50 flex items-start justify-between gap-4 text-left">
                            <div className="space-y-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-950/40 border border-violet-500/20 text-violet-400 font-semibold uppercase tracking-wider shrink-0">
                                  Pages {chap.startPage}–{chap.endPage}
                                </span>
                                <span className="text-[10px] text-slate-600 truncate">{chap.docName}</span>
                              </div>
                              <h5 className="text-xs font-bold text-white">{chap.name}</h5>
                              <p className="text-[10px] text-slate-500 line-clamp-2">{chap.summary}</p>
                            </div>
                          </div>
                        ))}
                        {totalChaps === 0 && (
                          <p className="text-[10px] text-slate-600 text-center py-2">No chapters mapped in these files.</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Manual Mapping Modal */}
      {manualMappingQueue && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-950/50">
              <div>
                <h3 className="text-lg font-bold text-white">Manual Chapter Mapping</h3>
                <p className="text-xs text-slate-400 mt-1">We couldn't automatically detect the chapters for <strong className="text-violet-300">{manualMappingQueue.file.name}</strong>.</p>
              </div>
              <button onClick={() => setManualMappingQueue(null)} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {manualChapters.map((chap, idx) => (
                <div key={idx} className="flex gap-3 items-start">
                  <div className="flex-1 space-y-1">
                    <label className="text-[10px] font-semibold text-slate-500 uppercase">Chapter Title</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Chapter 1: Introduction" 
                      value={chap.name} 
                      onChange={(e) => {
                        const newChaps = [...manualChapters];
                        newChaps[idx].name = e.target.value;
                        setManualChapters(newChaps);
                      }}
                      className="w-full bg-slate-950/60 border border-slate-800 focus:border-violet-500 rounded-lg py-2 px-3 text-sm text-white outline-none"
                    />
                  </div>
                  <div className="w-24 space-y-1">
                    <label className="text-[10px] font-semibold text-slate-500 uppercase">Start Pg</label>
                    <input 
                      type="number" 
                      min="1"
                      value={chap.startPage} 
                      onChange={(e) => {
                        const newChaps = [...manualChapters];
                        newChaps[idx].startPage = parseInt(e.target.value) || 1;
                        setManualChapters(newChaps);
                      }}
                      className="w-full bg-slate-950/60 border border-slate-800 focus:border-violet-500 rounded-lg py-2 px-3 text-sm text-white outline-none text-center"
                    />
                  </div>
                  <div className="w-24 space-y-1">
                    <label className="text-[10px] font-semibold text-slate-500 uppercase">End Pg</label>
                    <input 
                      type="number" 
                      min="1"
                      value={chap.endPage} 
                      onChange={(e) => {
                        const newChaps = [...manualChapters];
                        newChaps[idx].endPage = parseInt(e.target.value) || 1;
                        setManualChapters(newChaps);
                      }}
                      className="w-full bg-slate-950/60 border border-slate-800 focus:border-violet-500 rounded-lg py-2 px-3 text-sm text-white outline-none text-center"
                    />
                  </div>
                  <button 
                    onClick={() => {
                      setManualChapters(manualChapters.filter((_, i) => i !== idx));
                    }}
                    className="mt-6 p-2 text-slate-500 hover:text-red-400 transition-colors cursor-pointer"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
              
              <button 
                onClick={() => setManualChapters([...manualChapters, {name: "", startPage: 1, endPage: 1}])}
                className="flex items-center gap-2 text-xs font-semibold text-violet-400 hover:text-violet-300 py-2 transition-colors cursor-pointer"
              >
                <Plus size={14} /> Add Another Chapter
              </button>
            </div>
            
            <div className="p-6 border-t border-slate-800 bg-slate-950/80 flex justify-end gap-3">
              <button 
                onClick={() => setManualMappingQueue(null)}
                className="px-5 py-2.5 rounded-xl text-xs font-semibold text-slate-300 hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveManualMapping}
                className="px-5 py-2.5 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-violet-600/20 transition-colors cursor-pointer"
              >
                Save Document
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Staging Modal */}
      {stagedFiles && stagedFiles.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-950/50">
              <div>
                <h3 className="text-lg font-bold text-white">Confirm Upload</h3>
                <p className="text-xs text-slate-400 mt-1">You selected <strong className="text-violet-300">{stagedFiles.length} file(s)</strong>. Help us identify them for better extraction.</p>
              </div>
              <button onClick={() => setStagedFiles(null)} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              {/* Selected Files List with Editable Titles */}
              <div className="space-y-4">
                <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Review & Edit Chapter Titles</label>
                <div className="space-y-3">
                  {stagedFiles.map((f, i) => (
                    <div key={i} className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-lg bg-slate-950/50 border border-slate-800">
                      <div className="flex items-center gap-2 shrink-0 sm:w-1/3">
                        <FileText size={14} className="text-violet-400" />
                        <span className="text-xs text-slate-400 truncate" title={f.file.name}>{f.file.name}</span>
                      </div>
                      {uploadMode === "single_chapter" ? (
                        <div className="flex-1 w-full">
                          <input 
                            type="text" 
                            value={f.title}
                            onChange={(e) => {
                              const newFiles = [...stagedFiles];
                              newFiles[i].title = e.target.value;
                              setStagedFiles(newFiles);
                            }}
                            className="w-full bg-slate-900 border border-slate-700 focus:border-violet-500 rounded-lg py-1.5 px-3 text-xs text-white outline-none"
                            placeholder="Chapter Title"
                          />
                        </div>
                      ) : (
                        <div className="flex-1 text-xs text-slate-500 italic">
                          Manual mapping will be required after extraction.
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            
            <div className="p-6 border-t border-slate-800 bg-slate-950/80 flex justify-between items-center gap-3">
              <div className="text-xs text-slate-500">
                Uploading to <strong className="text-slate-300">{activeSubject || "General"}</strong> as {uploadMode === "full_textbook" ? "Full Textbook" : "Single Chapter(s)"}
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={() => setStagedFiles(null)}
                  className="px-5 py-2.5 rounded-xl text-xs font-semibold text-slate-300 hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleProcessStagedFiles}
                  className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-violet-600/20 transition-colors cursor-pointer"
                >
                  <Upload size={14} /> Process & Extract
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
