import { BoardBlueprint, getSubjectSpecificInstructions } from "@/lib/boardBlueprints";

// ---------------------------------------------------------------------------
// JSON Repair Utility
// Handles two common AI failure modes:
//   1. Response wrapped in markdown code fences (```json ... ```)
//   2. Response truncated mid-JSON due to token limits
// ---------------------------------------------------------------------------
function repairAndParse(raw: string): any {
  // 1. Strip markdown code fences if present
  let text = raw.trim();
  const fenceMatch = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenceMatch) {
    text = fenceMatch[1].trim();
  } else {
    // Partial fence — strip leading ``` line if closing fence is missing
    text = text.replace(/^```(?:json)?\s*/i, "").trim();
  }

  // 2. Try direct parse first (happy path)
  try {
    return JSON.parse(text);
  } catch (_) {
    // 3. Attempt to auto-close a truncated JSON structure
    try {
      const stack: string[] = [];
      let inString = false;
      let escaped = false;
      let lastValidPos = 0;

      for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (escaped) { escaped = false; continue; }
        if (ch === "\\") { escaped = true; continue; }
        if (ch === '"') {
          inString = !inString;
          continue;
        }
        if (inString) continue;
        if (ch === '{' || ch === '[') {
          stack.push(ch === '{' ? '}' : ']');
          lastValidPos = i;
        } else if (ch === '}' || ch === ']') {
          if (stack.length > 0 && stack[stack.length - 1] === ch) {
            stack.pop();
            lastValidPos = i;
          }
        } else if (ch !== ' ' && ch !== '\n' && ch !== '\r' && ch !== '\t' && ch !== ',' && ch !== ':') {
          lastValidPos = i;
        }
      }

      // Truncate to last "safe" position and close all open brackets
      // Find the last complete value boundary (closing } ] or a scalar end)
      let repaired = text.substring(0, lastValidPos + 1);
      // Remove trailing incomplete key-value (e.g. "key": )
      repaired = repaired.replace(/,\s*"[^"]*"\s*:\s*$/, "");
      repaired = repaired.replace(/,\s*$/, "");
      // Close all open structures
      const closing = stack.reverse().join("");
      repaired = repaired + closing;

      return JSON.parse(repaired);
    } catch (repairErr) {
      // Re-throw the original parse error with a friendly message
      throw new Error(
        `The AI returned an incomplete or malformed response. This usually happens when the question paper is very large. ` +
        `Try reducing the number of questions or selecting a smaller chapter, then try again.`
      );
    }
  }
}

const RATE_LIMIT_CONFIG = {
  maxRequestsPerMinute: Number(process.env.NEXT_PUBLIC_GEMINI_RATE_PER_MINUTE) || 5,
  maxRequestsPerDay: Number(process.env.NEXT_PUBLIC_GEMINI_RATE_PER_DAY) || 20,
};

function isMockMode(): boolean {
  if (typeof window !== "undefined") {
    return localStorage.getItem("acu_ai_mock_mode") === "true";
  }
  return false;
}

function getLocalResetTime(): string {
  try {
    const now = new Date();
    const laTimeString = now.toLocaleString("en-US", { timeZone: "America/Los_Angeles" });
    const laDate = new Date(laTimeString);
    const diff = now.getTime() - laDate.getTime();
    
    const nextMidnightLA = new Date(laDate);
    nextMidnightLA.setHours(24, 0, 0, 0);
    
    const localResetTime = new Date(nextMidnightLA.getTime() + diff);
    return "at " + localResetTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + " (your local time)";
  } catch (e) {
    return "tomorrow";
  }
}

function checkAndRecordRateLimit() {
  if (typeof window === "undefined") return;

  const now = Date.now();
  const today = new Date().toISOString().split('T')[0];

  const timestampsStr = localStorage.getItem("acu_ai_timestamps") || "[]";
  let timestamps: number[] = [];
  try {
    timestamps = JSON.parse(timestampsStr);
  } catch (e) {}

  timestamps = timestamps.filter(t => now - t < 60000);

  if (timestamps.length >= RATE_LIMIT_CONFIG.maxRequestsPerMinute) {
    throw new Error(`You are generating too fast! Please wait a minute before trying again. (Limit: ${RATE_LIMIT_CONFIG.maxRequestsPerMinute}/min)`);
  }

  let usageStr = localStorage.getItem("acu_ai_daily_usage");
  let dailyUsage = usageStr ? JSON.parse(usageStr) : { date: today, count: 0 };
  if (dailyUsage.date !== today) {
    dailyUsage = { date: today, count: 0 };
  }

  if (dailyUsage.count >= RATE_LIMIT_CONFIG.maxRequestsPerDay) {
    throw new Error(`You have reached your daily limit of ${RATE_LIMIT_CONFIG.maxRequestsPerDay} requests. The quota will reset ${getLocalResetTime()}.`);
  }

  timestamps.push(now);
  localStorage.setItem("acu_ai_timestamps", JSON.stringify(timestamps));

  dailyUsage.count += 1;
  localStorage.setItem("acu_ai_daily_usage", JSON.stringify(dailyUsage));
}

async function callAI(request: {
  contents: any[];
  systemInstruction?: string;
  temperature?: number;
  model?: string;
}): Promise<string> {
  if (isMockMode()) {
    return getMockResponse(request);
  }

  checkAndRecordRateLimit();

  const res = await fetch("/api/ai/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: request.contents,
      systemInstruction: request.systemInstruction,
      generationConfig: { temperature: request.temperature ?? 0.2 },
      model: request.model,
    }),
  });

  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || `AI request failed (${res.status})`);
  }

  const data = await res.json();
  return data.text;
}

function getMockResponse(request: { contents: any[]; systemInstruction?: string }): string {
  const requestText = request.contents.map((r: any) => r.text || "").join("\n");

  if (requestText.includes("TAXONOMY_SYSTEM_PROMPT") || requestText.includes("Table of Contents") || requestText.includes("Analyze this Table of Contents")) {
    return JSON.stringify([
      { "name": "Chapter 1: Nutrition in Plants", "summary": "Explains autotrophic and heterotrophic modes of nutrition, photosynthesis, and how nutrients are replenished in the soil.", "startPage": 1, "endPage": 10 }
    ]);
  }
  if (requestText.includes("Identify the chapter title") || requestText.includes("given the first few pages")) {
    return "Nutrition in Plants";
  }
  if (requestText.includes("SLIDES_SYSTEM_PROMPT") || requestText.includes("presentation slide outline") || requestText.includes("Generate a presentation slide outline")) {
    return JSON.stringify([
      { "id": "slide_1", "layout": "title", "title": "Nutrition in Plants", "subtitle": "Chapter 1 Overview" },
      { "id": "slide_2", "layout": "bullets", "title": "Photosynthesis", "bullets": ["Plants synthesize food using sunlight, water, and CO2.", "Chlorophyll in leaves traps solar energy.", "Oxygen is released as a byproduct."] }
    ]);
  }
  if (requestText.includes("EXAM_SYSTEM_PROMPT") || requestText.includes("question paper") || requestText.includes("Generate a question paper")) {
    return JSON.stringify({ "title": "Nutrition in Plants Test", "sections": [{ "section_letter": "A", "instructions": "Answer all multiple choice questions", "marks_per_question": 1, "questions": [{ "question_text": "Which of the following is a parasitic plant?", "question_type": "MCQ", "marks": 1, "blooms_level": "Remembering", "options": [{ "key": "A", "text": "Cuscuta (Amarbel)" }, { "key": "B", "text": "Rose" }, { "key": "C", "text": "Mango" }, { "key": "D", "text": "Algae" }], "model_answer": "A", "grading_rubric": "1 mark for selecting A" }] }] });
  }
  if (requestText.includes("GRADER_SYSTEM_PROMPT") || requestText.includes("Evaluate this response")) {
    return JSON.stringify({ "marks_awarded": 1.0, "justification": "Correct choice of Cuscuta.", "feedback_details": { "correct_points": ["Correct option chosen"], "incorrect_points": [], "suggestions": ["Great job! Keep revising."] } });
  }
  if (requestText.includes("BRIEFING_SYSTEM_PROMPT") || requestText.includes("briefing notes") || requestText.includes("Generate briefing notes")) {
    return JSON.stringify({ "title": "Topic Briefing: Nutrition in Plants", "chapters": [{ "title": "Introduction", "content": "All living organisms require food.", "takeaways": ["Plants are autotrophs.", "Animals are heterotrophs."] }], "glossary": [{ "term": "Autotrophic", "definition": "Mode of nutrition in which organisms make food themselves." }] });
  }
  if (requestText.includes("FAQ_SYSTEM_PROMPT") || requestText.includes("FAQ Sheet") || requestText.includes("Generate FAQ Sheet")) {
    return JSON.stringify({ "faqs": [{ "question": "Why are plants green?", "answer": "Plants are green because of the pigment chlorophyll." }] });
  }
  if (requestText.includes("TIMELINE_SYSTEM_PROMPT") || requestText.includes("chronological timeline")) {
    return JSON.stringify({ "timeline": [{ "timeLabel": "Step 1", "title": "Water absorption", "description": "Water and minerals are absorbed by roots." }] });
  }
  if (requestText.includes("PODCAST_SYSTEM_PROMPT") || requestText.includes("dialogue podcast script")) {
    return JSON.stringify({ "script": [{ "speaker": "Host A", "text": "Welcome!" }, { "speaker": "Host B", "text": "Yes, let's learn." }] });
  }
  if (requestText.includes("MCQ_SYSTEM_PROMPT") || requestText.includes("MCQs") || requestText.includes("Generate 25-50")) {
    return JSON.stringify([{ "question": "Which of the following is a parasite?", "options": ["Cuscuta", "Algae", "Pitcher plant", "Lichen"], "correctAnswer": "Cuscuta", "explanation": "Cuscuta is a parasitic plant." }]);
  }
  return "Mock response content";
}

// -------------------------------------------------------------
// 1. Chapter Taxonomy Mapping Prompt
// -------------------------------------------------------------
const TAXONOMY_SYSTEM_PROMPT = `
You are a curriculum analysis assistant.
Analyze the provided Table of Contents text from a document and extract the structured list of Chapters and their corresponding page ranges.
For each chapter:
1. Provide the chapter name.
2. Provide a 1-2 sentence summary covering its core concepts.
3. Identify the startPage and endPage numbers (1-indexed, relative to the document pages).
Output strictly a valid JSON array matching the schema below. Do not wrap in markdown or write conversational text.

JSON Schema:
[
  {
    "name": "Chapter 1: Chemical Reactions and Equations",
    "summary": "Details how to balance equations, reviews major reaction types (displacement, combination), and explains daily corrosion impacts.",
    "startPage": 1,
    "endPage": 14
  }
]
`;

// -------------------------------------------------------------
// 0b. Image OCR Prompt (Gemini Vision — extracts text from images)
// -------------------------------------------------------------
export const IMAGE_OCR_SYSTEM_PROMPT = `
You are a precise OCR assistant.
Your only task is to faithfully transcribe ALL readable text from the provided image.

Rules:
- Preserve the original layout as closely as possible using markdown:
    * Use # / ## / ### for visible headings.
    * Use - or * for bullet lists.
    * Use | tables for tabular data.
    * Preserve blank lines between paragraphs.
- Include every word, number, label, caption, and formula visible in the image.
- Do NOT summarise, paraphrase, or add commentary.
- If part of the text is illegible, write [illegible] in its place.
- Output ONLY the transcribed text — no preamble, no explanation.
`;

export interface BookMetadata {
  name?: string;
  isbn?: string;
  publisher?: string;
  edition?: string;
}

export async function generateChapterMap(
  tocText: string,
  metadata?: BookMetadata
): Promise<{ name: string; summary: string; startPage: number; endPage: number }[]> {
  let metaContext = "";
  if (metadata && (metadata.name || metadata.isbn || metadata.publisher)) {
    metaContext = `\nBook Context: ${metadata.name || 'Unknown'} (ISBN: ${metadata.isbn || 'N/A'}, Publisher: ${metadata.publisher || 'N/A'}, Edition: ${metadata.edition || 'N/A'})\nUse this knowledge to accurately deduce the chapters if the text is messy.`;
  }

  const prompt = `Analyze this Table of Contents text and map chapters to page numbers:${metaContext}\n\n[TEXT]\n${tocText}`;

  const text = await callAI({
    contents: [{ text: TAXONOMY_SYSTEM_PROMPT }, { text: prompt }],
    temperature: 0.1,
  });
  return repairAndParse(text);
}

// -------------------------------------------------------------
// 1b. Single Chapter Title Extraction (lightweight)
// -------------------------------------------------------------
export async function extractChapterTitle(
  firstPageText: string,
  metadata?: BookMetadata
): Promise<string> {
  try {
    let metaContext = "";
    if (metadata && (metadata.name || metadata.isbn || metadata.publisher)) {
      metaContext = `\nContext: This file is a chapter from the book "${metadata.name || 'Unknown'}" (ISBN: ${metadata.isbn || 'N/A'}, Publisher: ${metadata.publisher || 'N/A'}). Use your knowledge of this book's official Table of Contents to identify which chapter this text belongs to.`;
    }

    const prompt = `You are given the first few pages of a textbook chapter. Identify the chapter title.\n${metaContext}\n\nRules:\n- The chapter title is typically a bold heading or chapter name like "Chapter 9: Cell - The Building Block of Life" or just "Cell: The Building Block of Life".\n- If the text includes something like "9 Cell The Building Block of Life", the title is "Cell: The Building Block of Life".\n- If you cannot find a clear chapter title, return an empty string.\n\nOutput ONLY the chapter title. Nothing else. No quotes. No explanations.\n\nText:\n${firstPageText}`;

    const text = await callAI({ contents: [{ text: prompt }], temperature: 0.1 });
    const title = text.trim();
    if (title) return title;
  } catch {
    // AI failed, fall through to heuristic
  }

  // Fallback heuristic
  const textToSearch = firstPageText.replace(/\s+/g, ' ');
  const chapterMatch = textToSearch.match(/(?:(?:Chapter|Unit|Lesson)\s+\d+\s*[-–:.]?\s*|\b\d+\s+)([A-Z][a-zA-Z0-9\s:,-]+?)(?=\s*(?:Chapter|Unit|Lesson|1\.|Page|$|\d{2,}))/i);
  if (chapterMatch && chapterMatch[1]) {
    let title = chapterMatch[1].trim();
    if (title.length > 2 && title.length < 150) return title;
  }

  const lines = firstPageText.split('\n').map(l => l.trim()).filter(Boolean);
  for (const line of lines) {
    if (line.length < 5 || line.length > 150) continue;
    const cm = line.match(/^(?:chapter|unit|lesson)\s+\d+\s*[-–:.]?\s*(.+)/i);
    if (cm && cm[1]) return cm[1].trim();
  }

  return "";
}

// -------------------------------------------------------------
// 2. AcuSlide Presentation Outline Generator Prompt
// -------------------------------------------------------------
const SLIDES_SYSTEM_PROMPT = `
You are an expert educational content creator.
Create a detailed, beautiful, and highly structured presentation outline based ONLY on the provided text passage.
Select the most important concepts and organize them into clear slides.
You MUST follow the layout system below to ensure slides look visually distinct:
- "title": Used for the intro slide. Has a main "title" and a "subtitle".
- "bullets": Standard bullet points. Has a "title" and a "bullets" array (max 4 points, keep text concise).
- "comparison": Comparing two items. Has a "title", "leftColumn" (header, items), and "rightColumn" (header, items).
- "quote": Highlights a key definition, law, or quote. Has a "quote" and "author".

Output strictly a valid JSON array matching the schema below. Do not include markdown codeblocks or outer text.

JSON Schema:
[
  {
    "id": "slide_1",
    "layout": "title",
    "title": "Main Title",
    "subtitle": "Subtitle description"
  },
  {
    "id": "slide_2",
    "layout": "bullets",
    "title": "Slide Header",
    "bullets": ["Point one", "Point two", "Point three"]
  },
  {
    "id": "slide_3",
    "layout": "comparison",
    "title": "Slide Header",
    "leftColumn": { "header": "Column Header", "items": ["Item A", "Item B"] },
    "rightColumn": { "header": "Column Header", "items": ["Item X", "Item Y"] }
  },
  {
    "id": "slide_4",
    "layout": "quote",
    "quote": "Important theorem or concept text",
    "author": "Source or Scientist"
  }
]
`;

export async function generateSlideOutline(
  sourceText: string,
  title: string,
  subject: string = ""
): Promise<any[]> {
  const prompt = `Generate a presentation slide outline for: "${title}".\nUse the following text passage as the exclusive source:\n\n[TEXT PASSAGE]\n${sourceText}\n\n${getSubjectSpecificInstructions(subject)}`;
  const text = await callAI({
    contents: [{ text: SLIDES_SYSTEM_PROMPT }, { text: prompt }],
    temperature: 0.3,
  });
  return repairAndParse(text);
}

// -------------------------------------------------------------
// 3. AcuExam Question Paper Generator Prompt
// -------------------------------------------------------------
const EXAM_SYSTEM_PROMPT = `
You are a senior curriculum designer and examiner.
Draft a highly realistic, syllabus-compliant question paper based ONLY on the context provided.
Every question must be fully answerable using the facts stated in the context. Do not invent information.
For each question, categorize it with exactly one Bloom's Taxonomy cognitive level (Remembering, Understanding, Applying, Analyzing, Evaluating, Creating) and provide a detailed step-by-step grading rubric.

You MUST follow the specified schema. Output strictly a single JSON object.

JSON Schema:
{
  "title": "Exam Title",
  "sections": [
    {
      "section_letter": "A",
      "instructions": "Instructions for this section",
      "marks_per_question": 1,
      "questions": [
        {
          "question_text": "Write the question content here",
          "question_type": "MCQ",
          "marks": 1,
          "blooms_level": "Remembering",
          "options": [
            {"key": "A", "text": "Option A text"},
            {"key": "B", "text": "Option B text"},
            {"key": "C", "text": "Option C text"},
            {"key": "D", "text": "Option D text"}
          ],
          "model_answer": "A",
          "grading_rubric": "1 mark for correct key selection."
        }
      ]
    }
  ]
}
`;

export async function generateExamPaper(
  sourceText: string,
  examTitle: string,
  grade: string,
  board: string,
  distribution: { mcq: number; vsa: number; sa: number; la: number },
  totalMarks: number,
  subject: string = "",
  blueprint: BoardBlueprint | null = null
): Promise<any> {
  const subjectRules = getSubjectSpecificInstructions(subject);

  let prompt: string;
  if (blueprint) {
    const blueprintSections = blueprint.sections.map((s) => {
      const qtDescriptions = s.questionTypes.map((qt) => {
        let desc = `${qt.count} ${qt.type} × ${qt.marksPerQuestion}m`;
        if (qt.negativeMarking) desc += ` (${qt.negativeMarking}m for incorrect)`;
        return desc;
      }).join(", ");
      return `${s.sectionLetter}. ${s.sectionTitle}: ${qtDescriptions}. Total: ${s.totalMarks}m. Instructions: ${s.instructions}`;
    }).join("\n  ");

    prompt = `Generate a question paper titled "${examTitle}" for ${grade}.\n\n[BOARD BLUEPRINT — ${blueprint.boardName} ${blueprint.academicYear}]\nFollow this EXACT structure:\n${blueprintSections}\n\nTotal: ${blueprint.totalTheoryMarks} marks, ${blueprint.totalQuestions} questions.\n${blueprint.competencyBasedPercent ? `Competency-based questions must be at least ${blueprint.competencyBasedPercent}% of the paper.` : ""}\n${blueprint.negativeMarking ? "Negative marking applies." : ""}\n\n${subjectRules}\n\n[CONTEXT PASSAGES]\n${sourceText}`;
  } else {
    const sectionsInstructions = [];
    if (distribution.mcq > 0) {
      const marksPerMcq = (distribution.vsa === 0 && distribution.sa === 0 && distribution.la === 0) ? (totalMarks / distribution.mcq) : 1;
      sectionsInstructions.push(`Section A: ${distribution.mcq} MCQs (${marksPerMcq.toFixed(1)} mark(s) each).`);
    }
    if (distribution.vsa > 0) sectionsInstructions.push(`Section B: ${distribution.vsa} Very Short Answer questions (2 marks each).`);
    if (distribution.sa > 0) sectionsInstructions.push(`Section C: ${distribution.sa} Short Answer questions (3 marks each).`);
    if (distribution.la > 0) sectionsInstructions.push(`Section D: ${distribution.la} Long Answer questions (5 marks each).`);
    prompt = `Generate a question paper titled "${examTitle}" for ${grade} (${board} standard).\n\n[SECTIONS TO INCLUDE]\n${sectionsInstructions.join("\n")}\n\n${subjectRules}\n\n[CONTEXT PASSAGES]\n${sourceText}`;
  }

  const text = await callAI({
    contents: [{ text: EXAM_SYSTEM_PROMPT }, { text: prompt }],
    temperature: 0.2,
  });
  return repairAndParse(text);
}

// -------------------------------------------------------------
// 4. AcuExam Grader Prompt
// -------------------------------------------------------------
function buildGraderSystemPrompt(gradingStandard: string = "CBSE Board"): string {
  return `You are an objective ${gradingStandard} examiner grading student answers.\nAnalyze the student's answer against the Model Answer and the step-by-step Grading Rubric.\nAllocate marks precisely based on the rubric guidelines (decimal values like 0.5 increments are allowed, from 0 to max_marks).\nProvide an objective justification explaining exactly why marks were awarded or deducted.\nOutput strictly a single valid JSON object.\n\nJSON Schema:\n{\n  "marks_awarded": 2.5,\n  "justification": "Explanation of score allocation",\n  "feedback_details": {\n    "correct_points": ["Aspects student answered correctly"],\n    "incorrect_points": ["Missing key details or errors"],\n    "suggestions": ["Actionable study tips to improve"]\n  }\n}`;
}

export async function gradeWrittenAnswer(
  questionText: string,
  maxMarks: number,
  modelAnswer: string,
  gradingRubric: string,
  studentAnswer: string,
  gradingStandard: string = "CBSE Board",
  studentAnswerImageBase64?: string
): Promise<any> {
  let userPrompt = `Evaluate this response:\n\n[QUESTION]\n${questionText}\nMarks Available: ${maxMarks}\n\n[MODEL ANSWER]\n${modelAnswer}\n\n[GRADING RUBRIC]\n${gradingRubric}\n\n[STUDENT ANSWER]\n${studentAnswer}`;

  if (studentAnswerImageBase64) {
    userPrompt += `\n\n[STUDENT ANSWER IMAGE]\nThe student submitted a handwritten image. Please transcribe and grade it.`;
  }

  const text = await callAI({
    contents: [{ text: buildGraderSystemPrompt(gradingStandard) }, { text: userPrompt }],
    temperature: 0.1,
  });
  return repairAndParse(text);
}

// -------------------------------------------------------------
// 5. NotebookLM Artifact System Generators
// -------------------------------------------------------------

const BRIEFING_SYSTEM_PROMPT = `You are an expert curriculum writer. Analyze the provided study text and generate a Briefing Document in JSON format.\nInclude summary chapters with detailed, clear educational takeaways, and key glossary definitions.\nDo not use markdown inside JSON keys.\n\nJSON Output Schema:\n{\n  "title": "Topic Briefing",\n  "chapters": [\n    {\n      "title": "Section Title",\n      "content": "Paragraph summarising details and mechanisms of this section.",\n      "takeaways": ["Takeaway bullet point 1", "Takeaway bullet point 2"]\n    }\n  ],\n  "glossary": [\n    { "term": "Key Concept Name", "definition": "Clear concise definition" }\n  ]\n}`;

export async function generateBriefingNotes(sourceText: string, title: string, subject: string = ""): Promise<any> {
  const prompt = `Generate briefing notes for "${title}" based on this text:\n\n${sourceText}\n\n${getSubjectSpecificInstructions(subject)}`;
  const text = await callAI({ contents: [{ text: BRIEFING_SYSTEM_PROMPT }, { text: prompt }], temperature: 0.2 });
  return repairAndParse(text);
}

const FAQ_SYSTEM_PROMPT = `You are a study guide editor. Based on the textbook content, generate a list of 5 to 10 frequently asked questions (FAQs) with comprehensive, clear answers.\nOutput strictly in JSON.\n\nJSON Output Schema:\n{\n  "faqs": [\n    { "question": "Clear, direct conceptual question?", "answer": "Detailed answer explaining the underlying science, history or logic." }\n  ]\n}`;

export async function generateFAQSheet(sourceText: string, title: string, subject: string = ""): Promise<any> {
  const prompt = `Generate FAQ Sheet for "${title}" based on this text:\n\n${sourceText}\n\n${getSubjectSpecificInstructions(subject)}`;
  const text = await callAI({ contents: [{ text: FAQ_SYSTEM_PROMPT }, { text: prompt }], temperature: 0.2 });
  return repairAndParse(text);
}

const TIMELINE_SYSTEM_PROMPT = `You are a chronological database builder. Scan the study text for key events, dates, process steps, formulas, or chronological milestones.\nGenerate a sequential list of steps or historical events in JSON.\n\nJSON Output Schema:\n{\n  "timeline": [\n    { "timeLabel": "Step 1 or Date (e.g. 1914, Phase A)", "title": "Milestone Title", "description": "Details of what occurs here." }\n  ]\n}`;

export async function generateTimeline(sourceText: string, title: string, subject: string = ""): Promise<any> {
  const prompt = `Generate chronological timeline or process phases for "${title}" based on this text:\n\n${sourceText}\n\n${getSubjectSpecificInstructions(subject)}`;
  const text = await callAI({ contents: [{ text: TIMELINE_SYSTEM_PROMPT }, { text: prompt }], temperature: 0.2 });
  return repairAndParse(text);
}

const PODCAST_SYSTEM_PROMPT = `You are a podcast writer. Create a script of an audio overview where two co-hosts (Host A and Host B) engage in a lively, informative conversation about the syllabus text.\nHost A is curious and asks conceptual questions. Host B explains ideas simply using clear analogies. Keep the script fun, brief, and educational (10 to 15 dialogue lines).\nOutput strictly in JSON.\n\nJSON Output Schema:\n{\n  "script": [\n    { "speaker": "Host A", "text": "Welcome back to the podcast. Today we are looking at..." },\n    { "speaker": "Host B", "text": "Yes! And it's a fascinating topic because..." }\n  ]\n}`;

export async function generatePodcastScript(sourceText: string, title: string, subject: string = ""): Promise<any> {
  const prompt = `Generate a lively dialogue podcast script for "${title}" based on this text:\n\n${sourceText}\n\n${getSubjectSpecificInstructions(subject)}`;
  const text = await callAI({ contents: [{ text: PODCAST_SYSTEM_PROMPT }, { text: prompt }], temperature: 0.3 });
  return repairAndParse(text);
}

const MCQ_SYSTEM_PROMPT = `You are an expert curriculum designer.\nGenerate 25 to 50 high-quality Multiple Choice Questions (MCQs) covering the provided chapter text comprehensively.\nEnsure the questions vary in difficulty and test both factual recall and conceptual understanding.\nOutput strictly a valid JSON array.\n\nJSON Schema:\n[\n  {\n    "question": "What is the primary function of mitochondria?",\n    "options": ["Respiration", "Digestion", "Photosynthesis", "Circulation"],\n    "correctAnswer": "Respiration",\n    "explanation": "Mitochondria are often referred to as the powerhouse of the cell, responsible for cellular respiration."\n  }\n]`;

export async function generateMCQs(sourceText: string, title: string, subject: string = ""): Promise<any> {
  const prompt = `Generate 25-50 high quality MCQs for the chapter "${title}" using this source text:\n\n${sourceText}\n\n${getSubjectSpecificInstructions(subject)}`;
  const text = await callAI({ contents: [{ text: MCQ_SYSTEM_PROMPT }, { text: prompt }], temperature: 0.2 });
  return repairAndParse(text);
}

const FLASHCARD_SYSTEM_PROMPT = `You are an expert active-recall study guide tutor.\nBased on the textbook text, generate a comprehensive list of high-quality active-recall study flashcards.\nEach flashcard must contain:\n- "front": a clear question, concept, term, or prompt\n- "back": a concise, clear definition, answer, or explanation (keep it punchy and easy to memorize)\nDo not use markdown inside JSON keys. Output strictly a valid JSON array matching the schema.\n\nJSON Schema:\n[\n  {\n    "front": "What is the primary function of chloroplasts?",\n    "back": "Photosynthesis. They capture light energy to synthesize food/sugars."\n  }\n]`;

export async function generateFlashcards(sourceText: string, title: string, count: number = 15, subject: string = ""): Promise<any[]> {
  const prompt = `Generate exactly ${count} educational flashcards for the chapter "${title}".\nUse this textbook source text as the exclusive source:\n\n[TEXT PASSAGE]\n${sourceText}\n\n${getSubjectSpecificInstructions(subject)}`;
  const text = await callAI({ contents: [{ text: FLASHCARD_SYSTEM_PROMPT }, { text: prompt }], temperature: 0.3 });
  return repairAndParse(text);
}
