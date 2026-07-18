import { GoogleGenerativeAI } from "@google/generative-ai";
import { BoardBlueprint, getSubjectSpecificInstructions } from "@/lib/boardBlueprints";

export const MOCK_API_KEY = "AIzaSyMockKeyForTutorial";

const RATE_LIMIT_CONFIG = {
  maxRequestsPerMinute: Number(process.env.NEXT_PUBLIC_GEMINI_RATE_PER_MINUTE) || 5,
  maxRequestsPerDay: Number(process.env.NEXT_PUBLIC_GEMINI_RATE_PER_DAY) || 20,
};

// Retrieves the user's Gemini key securely from local storage
export function getGeminiApiKey(): string {
  if (typeof window !== "undefined") {
    return localStorage.getItem("acu_gemini_api_key") || "";
  }
  return "";
}

export function isFreeTierKey(): boolean {
  if (typeof window !== "undefined") {
    return localStorage.getItem("acu_gemini_free_tier") !== "false";
  }
  return true;
}

export function getDailyUsage(): { date: string; count: number } {
  if (typeof window !== "undefined") {
    const usageStr = localStorage.getItem("acu_gemini_daily_usage");
    if (usageStr) {
      try {
        return JSON.parse(usageStr);
      } catch (e) {}
    }
  }
  return { date: new Date().toISOString().split('T')[0], count: 0 };
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
  if (typeof window === "undefined" || !isFreeTierKey()) return;

  const now = Date.now();
  const today = new Date().toISOString().split('T')[0];

  const timestampsStr = localStorage.getItem("acu_gemini_timestamps") || "[]";
  let timestamps: number[] = [];
  try {
    timestamps = JSON.parse(timestampsStr);
  } catch (e) {}

  timestamps = timestamps.filter(t => now - t < 60000);

  if (timestamps.length >= RATE_LIMIT_CONFIG.maxRequestsPerMinute) {
    throw new Error(`You are generating too fast! Please wait a minute before trying again. (Limit: ${RATE_LIMIT_CONFIG.maxRequestsPerMinute}/min)`);
  }

  let dailyUsage = getDailyUsage();
  if (dailyUsage.date !== today) {
    dailyUsage = { date: today, count: 0 };
  }

  if (dailyUsage.count >= RATE_LIMIT_CONFIG.maxRequestsPerDay) {
    throw new Error(`You have reached your daily limit of ${RATE_LIMIT_CONFIG.maxRequestsPerDay} requests. The quota will reset ${getLocalResetTime()}. Come back then or upgrade your API tier!`);
  }

  timestamps.push(now);
  localStorage.setItem("acu_gemini_timestamps", JSON.stringify(timestamps));

  dailyUsage.count += 1;
  localStorage.setItem("acu_gemini_daily_usage", JSON.stringify(dailyUsage));
}

async function safeGenerateContent(model: any, request: any) {
  const apiKey = getGeminiApiKey();
  if (apiKey === MOCK_API_KEY) {
    let requestText = "";
    if (typeof request === "string") {
      requestText = request;
    } else if (Array.isArray(request)) {
      requestText = request.map((r: any) => r.text || "").join("\n");
    }

    let mockText = "";
    if (requestText.includes("TAXONOMY_SYSTEM_PROMPT") || requestText.includes("Table of Contents") || requestText.includes("Analyze this Table of Contents")) {
      mockText = JSON.stringify([
        {
          "name": "Chapter 1: Nutrition in Plants",
          "summary": "Explains autotrophic and heterotrophic modes of nutrition, photosynthesis, and how nutrients are replenished in the soil.",
          "startPage": 1,
          "endPage": 10
        }
      ]);
    } else if (requestText.includes("Identify the chapter title") || requestText.includes("given the first few pages")) {
      mockText = "Nutrition in Plants";
    } else if (requestText.includes("SLIDES_SYSTEM_PROMPT") || requestText.includes("presentation slide outline") || requestText.includes("Generate a presentation slide outline")) {
      mockText = JSON.stringify([
        {
          "id": "slide_1",
          "layout": "title",
          "title": "Nutrition in Plants",
          "subtitle": "Chapter 1 Overview"
        },
        {
          "id": "slide_2",
          "layout": "bullets",
          "title": "Photosynthesis",
          "bullets": [
            "Plants synthesize food using sunlight, water, and CO2.",
            "Chlorophyll in leaves traps solar energy.",
            "Oxygen is released as a byproduct."
          ]
        }
      ]);
    } else if (requestText.includes("EXAM_SYSTEM_PROMPT") || requestText.includes("question paper") || requestText.includes("Generate a question paper")) {
      mockText = JSON.stringify({
        "title": "Nutrition in Plants Test",
        "sections": [
          {
            "section_letter": "A",
            "instructions": "Answer all multiple choice questions",
            "marks_per_question": 1,
            "questions": [
              {
                "question_text": "Which of the following is a parasitic plant?",
                "question_type": "MCQ",
                "marks": 1,
                "blooms_level": "Remembering",
                "options": [
                  {"key": "A", "text": "Cuscuta (Amarbel)"},
                  {"key": "B", "text": "Rose"},
                  {"key": "C", "text": "Mango"},
                  {"key": "D", "text": "Algae"}
                ],
                "model_answer": "A",
                "grading_rubric": "1 mark for selecting A"
              }
            ]
          }
        ]
      });
    } else if (requestText.includes("GRADER_SYSTEM_PROMPT") || requestText.includes("Evaluate this response")) {
      mockText = JSON.stringify({
        "marks_awarded": 1.0,
        "justification": "Correct choice of Cuscuta.",
        "feedback_details": {
          "correct_points": ["Correct option chosen"],
          "incorrect_points": [],
          "suggestions": ["Great job! Keep revising."]
        }
      });
    } else if (requestText.includes("BRIEFING_SYSTEM_PROMPT") || requestText.includes("briefing notes") || requestText.includes("Generate briefing notes")) {
      mockText = JSON.stringify({
        "title": "Topic Briefing: Nutrition in Plants",
        "chapters": [
          {
            "title": "Introduction",
            "content": "All living organisms require food. Plants can make their food themselves but animals including humans cannot.",
            "takeaways": ["Plants are autotrophs.", "Animals are heterotrophs."]
          }
        ],
        "glossary": [
          { "term": "Autotrophic", "definition": "Mode of nutrition in which organisms make food themselves." }
        ]
      });
    } else if (requestText.includes("FAQ_SYSTEM_PROMPT") || requestText.includes("FAQ Sheet") || requestText.includes("Generate FAQ Sheet")) {
      mockText = JSON.stringify({
        "faqs": [
          { "question": "Why are plants green?", "answer": "Plants are green because of the pigment chlorophyll, which absorbs sunlight for photosynthesis." }
        ]
      });
    } else if (requestText.includes("TIMELINE_SYSTEM_PROMPT") || requestText.includes("chronological timeline") || requestText.includes("Generate chronological timeline")) {
      mockText = JSON.stringify({
        "timeline": [
          { "timeLabel": "Step 1", "title": "Water absorption", "description": "Water and minerals are absorbed by roots." },
          { "timeLabel": "Step 2", "title": "Carbon dioxide entry", "description": "Carbon dioxide enters leaves through stomata." },
          { "timeLabel": "Step 3", "title": "Light absorption", "description": "Chlorophyll traps solar energy." }
        ]
      });
    } else if (requestText.includes("PODCAST_SYSTEM_PROMPT") || requestText.includes("dialogue podcast script") || requestText.includes("Generate a lively dialogue")) {
      mockText = JSON.stringify({
        "script": [
          { "speaker": "Host A", "text": "Welcome! Today we are learning about plant nutrition." },
          { "speaker": "Host B", "text": "Yes, did you know some plants are parasitic like Cuscuta?" }
        ]
      });
    } else if (requestText.includes("MCQ_SYSTEM_PROMPT") || requestText.includes("MCQs") || requestText.includes("Generate 25-50 high quality MCQs")) {
      mockText = JSON.stringify([
        {
          "question": "Which of the following is a parasite?",
          "options": ["Cuscuta", "Algae", "Pitcher plant", "Lichen"],
          "correctAnswer": "Cuscuta",
          "explanation": "Cuscuta is a parasitic plant that climbs on other trees to obtain nutrition."
        },
        {
          "question": "The food factory of a plant is its:",
          "options": ["Leaves", "Roots", "Stem", "Flowers"],
          "correctAnswer": "Leaves",
          "explanation": "Leaves contain chlorophyll and are the primary site of photosynthesis."
        }
      ]);
    } else {
      mockText = "Mock response content";
    }

    return {
      response: {
        text: () => mockText
      }
    };
  }

  checkAndRecordRateLimit();

  try {
    return await model.generateContent(request);
  } catch (err: any) {
    const msg = err?.message || String(err);
    if (msg.includes("429") || msg.includes("Quota") || msg.includes("quota") || msg.includes("rate limit")) {
      throw new Error("You have exceeded your Gemini API quota. Please wait a moment and try again.");
    }
    throw err;
  }
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
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error("Gemini API Key is missing. Please add your key in the Settings page.");
  }

  // Use the standard client SDK
  const ai = new GoogleGenerativeAI(apiKey);
  
  // We use gemini-flash-latest-lite as the default for lightning-fast parsing tasks
  const model = ai.getGenerativeModel({ 
    model: "gemini-flash-latest",
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.1
    }
  });

  let metaContext = "";
  if (metadata && (metadata.name || metadata.isbn || metadata.publisher)) {
    metaContext = `\nBook Context: ${metadata.name || 'Unknown'} (ISBN: ${metadata.isbn || 'N/A'}, Publisher: ${metadata.publisher || 'N/A'}, Edition: ${metadata.edition || 'N/A'})\nUse this knowledge to accurately deduce the chapters if the text is messy.`;
  }

  const prompt = `
  Analyze this Table of Contents text and map chapters to page numbers:${metaContext}
  
  [TEXT]
  ${tocText}
  `;

  const result = await safeGenerateContent(model, [
    { text: TAXONOMY_SYSTEM_PROMPT },
    { text: prompt }
  ]);

  const responseText = result.response.text();
  return JSON.parse(responseText.trim());
}

// -------------------------------------------------------------
// 1b. Single Chapter Title Extraction (lightweight)
// -------------------------------------------------------------
// -------------------------------------------------------------
export async function extractChapterTitle(
  firstPageText: string,
  metadata?: BookMetadata
): Promise<string> {
  // Try Gemini first
  try {
    const apiKey = getGeminiApiKey();
    if (apiKey) {
      const ai = new GoogleGenerativeAI(apiKey);
      const model = ai.getGenerativeModel({ 
        model: "gemini-flash-latest",
        generationConfig: { temperature: 0.1 }
      });

      let metaContext = "";
      if (metadata && (metadata.name || metadata.isbn || metadata.publisher)) {
        metaContext = `\nContext: This file is a chapter from the book "${metadata.name || 'Unknown'}" (ISBN: ${metadata.isbn || 'N/A'}, Publisher: ${metadata.publisher || 'N/A'}). Use your knowledge of this book's official Table of Contents to identify which chapter this text belongs to.`;
      }

      const prompt =
`You are given the first few pages of a textbook chapter. Identify the chapter title.
${metaContext}

Rules:
- The chapter title is typically a bold heading or chapter name like "Chapter 9: Cell - The Building Block of Life" or just "Cell: The Building Block of Life".
- If the text includes something like "9 Cell The Building Block of Life", the title is "Cell: The Building Block of Life".
- If you cannot find a clear chapter title, return an empty string.

Output ONLY the chapter title. Nothing else. No quotes. No explanations.

Text:
${firstPageText}`;

      const result = await safeGenerateContent(model, prompt);
      const title = result.response.text().trim();
      if (title) return title;
    }
  } catch {
    // Gemini failed, fall through to heuristic
  }

  // Fallback heuristic
  // Since page texts now have newlines, we can look line by line or search the whole block
  const textToSearch = firstPageText.replace(/\s+/g, ' ');
  
  // Look for "Chapter X: Title", "Unit X: Title", or "9 Cell The Building Block of Life"
  // Match "Chapter X" or just a number at the start of a logical line, followed by the title
  const chapterMatch = textToSearch.match(/(?:(?:Chapter|Unit|Lesson)\s+\d+\s*[-–:.]?\s*|\b\d+\s+)([A-Z][a-zA-Z0-9\s:,-]+?)(?=\s*(?:Chapter|Unit|Lesson|1\.|Page|$|\d{2,}))/i);
  
  if (chapterMatch && chapterMatch[1]) {
    let title = chapterMatch[1].trim();
    if (title.length > 2 && title.length < 150) {
      return title;
    }
  }

  // If the above complex regex fails, let's just try to find the first line that looks like a title
  const lines = firstPageText.split('\n').map(l => l.trim()).filter(Boolean);
  for (const line of lines) {
    if (line.length < 5 || line.length > 150) continue;
    // e.g. "Chapter 9: Cell - The Building Block of Life"
    const cm = line.match(/^(?:chapter|unit|lesson)\s+\d+\s*[-–:.]?\s*(.+)/i);
    if (cm && cm[1]) {
      return cm[1].trim();
    }
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
    "leftColumn": {
      "header": "Column Header",
      "items": ["Item A", "Item B"]
    },
    "rightColumn": {
      "header": "Column Header",
      "items": ["Item X", "Item Y"]
    }
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
  const apiKey = getGeminiApiKey();
  if (!apiKey) throw new Error("Gemini API Key missing.");

  const ai = new GoogleGenerativeAI(apiKey);
  const model = ai.getGenerativeModel({
    model: "gemini-flash-latest",
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.3
    }
  });

  const prompt = `
  Generate a presentation slide outline for: "${title}".
  Use the following text passage as the exclusive source:
  
  [TEXT PASSAGE]
  ${sourceText}

  ${getSubjectSpecificInstructions(subject)}
  `;

  const result = await safeGenerateContent(model, [
    { text: SLIDES_SYSTEM_PROMPT },
    { text: prompt }
  ]);

  return JSON.parse(result.response.text().trim());
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
          "question_type": "MCQ", // MCQ, Short (2-3 marks), Long (5 marks)
          "marks": 1,
          "blooms_level": "Remembering",
          "options": [ // Only include if question_type is MCQ
            {"key": "A", "text": "Option A text"},
            {"key": "B", "text": "Option B text"},
            {"key": "C", "text": "Option C text"},
            {"key": "D", "text": "Option D text"}
          ],
          "model_answer": "A", // Correct option key for MCQ, or full model text for Short/Long
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
  const apiKey = getGeminiApiKey();
  if (!apiKey) throw new Error("Gemini API Key missing.");

  const ai = new GoogleGenerativeAI(apiKey);
  const model = ai.getGenerativeModel({
    model: "gemini-flash-latest",
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.2
    }
  });

  // Get subject-specific instructions (works for both blueprint and legacy modes)
  const subjectRules = getSubjectSpecificInstructions(subject);

  let prompt: string;

  if (blueprint) {
    // --- Blueprint Mode: inject exact section structure from the blueprint ---
    const blueprintSections = blueprint.sections.map((s) => {
      const qtDescriptions = s.questionTypes.map((qt) => {
        let desc = `${qt.count} ${qt.type} × ${qt.marksPerQuestion}m`;
        if (qt.negativeMarking) desc += ` (${qt.negativeMarking}m for incorrect)`;
        return desc;
      }).join(", ");
      return `${s.sectionLetter}. ${s.sectionTitle}: ${qtDescriptions}. Total: ${s.totalMarks}m. Instructions: ${s.instructions}`;
    }).join("\n  ");

    prompt = `
  Generate a question paper titled "${examTitle}" for ${grade}.

  [BOARD BLUEPRINT — ${blueprint.boardName} ${blueprint.academicYear}]
  Follow this EXACT structure:
  ${blueprintSections}

  Total: ${blueprint.totalTheoryMarks} marks, ${blueprint.totalQuestions} questions.
  ${blueprint.competencyBasedPercent ? `Competency-based questions (case studies, source-based, application) must be at least ${blueprint.competencyBasedPercent}% of the paper.` : ""}
  ${blueprint.negativeMarking ? "Negative marking applies — mention this in section instructions." : ""}

  ${subjectRules}

  [CONTEXT PASSAGES]
  ${sourceText}
  `;
  } else {
    // --- Legacy Mode: use the old section distribution heuristic ---
    const sectionsInstructions = [];
    if (distribution.mcq > 0) {
      const marksPerMcq = (distribution.vsa === 0 && distribution.sa === 0 && distribution.la === 0)
        ? (totalMarks / distribution.mcq)
        : 1;
      sectionsInstructions.push(`Section A: ${distribution.mcq} MCQs (${marksPerMcq.toFixed(1)} mark(s) each).`);
    }
    if (distribution.vsa > 0) sectionsInstructions.push(`Section B: ${distribution.vsa} Very Short Answer questions (2 marks each).`);
    if (distribution.sa > 0) sectionsInstructions.push(`Section C: ${distribution.sa} Short Answer questions (3 marks each).`);
    if (distribution.la > 0) sectionsInstructions.push(`Section D: ${distribution.la} Long Answer questions (5 marks each).`);

    prompt = `
  Generate a question paper titled "${examTitle}" for ${grade} (${board} standard).

  [SECTIONS TO INCLUDE]
  ${sectionsInstructions.join("\n")}

  ${subjectRules}

  [CONTEXT PASSAGES]
  ${sourceText}
  `;
  }

  const result = await safeGenerateContent(model, [
    { text: EXAM_SYSTEM_PROMPT },
    { text: prompt }
  ]);

  return JSON.parse(result.response.text().trim());
}

// -------------------------------------------------------------
// 4. AcuExam Grader Prompt
// -------------------------------------------------------------
function buildGraderSystemPrompt(gradingStandard: string = "CBSE Board"): string {
  return `
You are an objective ${gradingStandard} examiner grading student answers.
Analyze the student's answer against the Model Answer and the step-by-step Grading Rubric.
Allocate marks precisely based on the rubric guidelines (decimal values like 0.5 increments are allowed, from 0 to max_marks).
Provide an objective justification explaining exactly why marks were awarded or deducted.
Output strictly a single valid JSON object.

JSON Schema:
{
  "marks_awarded": 2.5, // float between 0 and max_marks
  "justification": "Explanation of score allocation",
  "feedback_details": {
    "correct_points": ["Aspects student answered correctly"],
    "incorrect_points": ["Missing key details or errors"],
    "suggestions": ["Actionable study tips to improve"]
  }
}
`;
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
  const apiKey = getGeminiApiKey();
  if (!apiKey) throw new Error("Gemini API Key missing.");

  const ai = new GoogleGenerativeAI(apiKey);
  const model = ai.getGenerativeModel({
    model: "gemini-flash-latest",
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.1
    }
  });

  const contents: any[] = [
    { text: buildGraderSystemPrompt(gradingStandard) }
  ];

  let userPrompt = `
  Evaluate this response:
  
  [QUESTION]
  ${questionText}
  Marks Available: ${maxMarks}
  
  [MODEL ANSWER]
  ${modelAnswer}
  
  [GRADING RUBRIC]
  ${gradingRubric}
  `;

  if (studentAnswerImageBase64) {
    const matches = studentAnswerImageBase64.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
    if (matches && matches.length === 3) {
      const mimeType = matches[1];
      const base64Data = matches[2];
      
      userPrompt += `
      [STUDENT ANSWER IMAGE]
      We have attached an image of the student's handwritten answer sheet. 
      Please transcribe the handwriting in the image, analyze it, and grade it against the model answer and grading rubric.
      Include the transcribed answer text or key extracts inside the justification.
      `;
      
      contents.push({
        inlineData: {
          data: base64Data,
          mimeType: mimeType
        }
      });
    } else {
      userPrompt += `
      [STUDENT ANSWER]
      ${studentAnswer}
      `;
    }
  } else {
    userPrompt += `
    [STUDENT ANSWER]
    ${studentAnswer}
    `;
  }

  contents.push({ text: userPrompt });

  const result = await safeGenerateContent(model, contents);
  return JSON.parse(result.response.text().trim());
}

// -------------------------------------------------------------
// 5. NotebookLM Artifact System Prompts & Generators
// -------------------------------------------------------------

const BRIEFING_SYSTEM_PROMPT = `
You are an expert curriculum writer. Analyze the provided study text and generate a Briefing Document in JSON format.
Include summary chapters with detailed, clear educational takeaways, and key glossary definitions.
Do not use markdown inside JSON keys.

JSON Output Schema:
{
  "title": "Topic Briefing",
  "chapters": [
    {
      "title": "Section Title",
      "content": "Paragraph summarising details and mechanisms of this section.",
      "takeaways": ["Takeaway bullet point 1", "Takeaway bullet point 2"]
    }
  ],
  "glossary": [
    { "term": "Key Concept Name", "definition": "Clear concise definition" }
  ]
}
`;

export async function generateBriefingNotes(
  sourceText: string,
  title: string,
  subject: string = ""
): Promise<any> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) throw new Error("Gemini API Key missing.");

  const ai = new GoogleGenerativeAI(apiKey);
  const model = ai.getGenerativeModel({
    model: "gemini-flash-latest",
    generationConfig: { responseMimeType: "application/json", temperature: 0.2 }
  });

  const prompt = `Generate briefing notes for "${title}" based on this text:\n\n${sourceText}\n\n${getSubjectSpecificInstructions(subject)}`;
  const result = await safeGenerateContent(model, [
    { text: BRIEFING_SYSTEM_PROMPT },
    { text: prompt }
  ]);
  return JSON.parse(result.response.text().trim());
}

const FAQ_SYSTEM_PROMPT = `
You are a study guide editor. Based on the textbook content, generate a list of 5 to 10 frequently asked questions (FAQs) with comprehensive, clear answers.
Output strictly in JSON.

JSON Output Schema:
{
  "faqs": [
    { "question": "Clear, direct conceptual question?", "answer": "Detailed answer explaining the underlying science, history or logic." }
  ]
}
`;

export async function generateFAQSheet(
  sourceText: string,
  title: string,
  subject: string = ""
): Promise<any> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) throw new Error("Gemini API Key missing.");

  const ai = new GoogleGenerativeAI(apiKey);
  const model = ai.getGenerativeModel({
    model: "gemini-flash-latest",
    generationConfig: { responseMimeType: "application/json", temperature: 0.2 }
  });

  const prompt = `Generate FAQ Sheet for "${title}" based on this text:\n\n${sourceText}\n\n${getSubjectSpecificInstructions(subject)}`;
  const result = await safeGenerateContent(model, [
    { text: FAQ_SYSTEM_PROMPT },
    { text: prompt }
  ]);
  return JSON.parse(result.response.text().trim());
}

const TIMELINE_SYSTEM_PROMPT = `
You are a chronological database builder. Scan the study text for key events, dates, process steps, formulas, or chronological milestones.
Generate a sequential list of steps or historical events in JSON.

JSON Output Schema:
{
  "timeline": [
    { "timeLabel": "Step 1 or Date (e.g. 1914, Phase A)", "title": "Milestone Title", "description": "Details of what occurs here." }
  ]
}
`;

export async function generateTimeline(
  sourceText: string,
  title: string,
  subject: string = ""
): Promise<any> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) throw new Error("Gemini API Key missing.");

  const ai = new GoogleGenerativeAI(apiKey);
  const model = ai.getGenerativeModel({
    model: "gemini-flash-latest",
    generationConfig: { responseMimeType: "application/json", temperature: 0.2 }
  });

  const prompt = `Generate chronological timeline or process phases for "${title}" based on this text:\n\n${sourceText}\n\n${getSubjectSpecificInstructions(subject)}`;
  const result = await safeGenerateContent(model, [
    { text: TIMELINE_SYSTEM_PROMPT },
    { text: prompt }
  ]);
  return JSON.parse(result.response.text().trim());
}

const PODCAST_SYSTEM_PROMPT = `
You are a podcast writer. Create a script of an audio overview where two co-hosts (Host A and Host B) engage in a lively, informative conversation about the syllabus text.
Host A is curious and asks conceptual questions. Host B explains ideas simply using clear analogies. Keep the script fun, brief, and educational (10 to 15 dialogue lines).
Output strictly in JSON.

JSON Output Schema:
{
  "script": [
    { "speaker": "Host A", "text": "Welcome back to the podcast. Today we are looking at..." },
    { "speaker": "Host B", "text": "Yes! And it's a fascinating topic because..." }
  ]
}
`;

export async function generatePodcastScript(
  sourceText: string,
  title: string,
  subject: string = ""
): Promise<any> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) throw new Error("Gemini API Key missing.");

  const ai = new GoogleGenerativeAI(apiKey);
  const model = ai.getGenerativeModel({
    model: "gemini-flash-latest",
    generationConfig: { responseMimeType: "application/json", temperature: 0.3 }
  });

  const prompt = `Generate a lively dialogue podcast script for "${title}" based on this text:\n\n${sourceText}\n\n${getSubjectSpecificInstructions(subject)}`;
  const result = await safeGenerateContent(model, [
    { text: PODCAST_SYSTEM_PROMPT },
    { text: prompt }
  ]);
  return JSON.parse(result.response.text().trim());
}

// -------------------------------------------------------------
// 8. MCQ Generation
// -------------------------------------------------------------
const MCQ_SYSTEM_PROMPT = `
You are an expert curriculum designer.
Generate 25 to 50 high-quality Multiple Choice Questions (MCQs) covering the provided chapter text comprehensively.
Ensure the questions vary in difficulty and test both factual recall and conceptual understanding.
Output strictly a valid JSON array.

JSON Schema:
[
  {
    "question": "What is the primary function of mitochondria?",
    "options": ["Respiration", "Digestion", "Photosynthesis", "Circulation"],
    "correctAnswer": "Respiration",
    "explanation": "Mitochondria are often referred to as the powerhouse of the cell, responsible for cellular respiration."
  }
]
`;

export async function generateMCQs(
  sourceText: string,
  title: string,
  subject: string = ""
): Promise<any> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) throw new Error("Gemini API Key missing.");

  const ai = new GoogleGenerativeAI(apiKey);
  const model = ai.getGenerativeModel({
    model: "gemini-flash-latest",
    generationConfig: { responseMimeType: "application/json", temperature: 0.2 }
  });

  const prompt = `Generate 25-50 high quality MCQs for the chapter "${title}" using this source text:\n\n${sourceText}\n\n${getSubjectSpecificInstructions(subject)}`;
  const result = await safeGenerateContent(model, [
    { text: MCQ_SYSTEM_PROMPT },
    { text: prompt }
  ]);
  return JSON.parse(result.response.text().trim());
}

// -------------------------------------------------------------
// 9. Active-Recall Flashcard Generation
// -------------------------------------------------------------
const FLASHCARD_SYSTEM_PROMPT = `
You are an expert active-recall study guide tutor.
Based on the textbook text, generate a comprehensive list of high-quality active-recall study flashcards.
Each flashcard must contain:
- "front": a clear question, concept, term, or prompt
- "back": a concise, clear definition, answer, or explanation (keep it punchy and easy to memorize)
Do not use markdown inside JSON keys. Output strictly a valid JSON array matching the schema.

JSON Schema:
[
  {
    "front": "What is the primary function of chloroplasts?",
    "back": "Photosynthesis. They capture light energy to synthesize food/sugars."
  }
]
`;

export async function generateFlashcards(
  sourceText: string,
  title: string,
  count: number = 15,
  subject: string = ""
): Promise<any[]> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) throw new Error("Gemini API Key missing.");

  const ai = new GoogleGenerativeAI(apiKey);
  const model = ai.getGenerativeModel({
    model: "gemini-flash-latest",
    generationConfig: { responseMimeType: "application/json", temperature: 0.3 }
  });

  const prompt = `
  Generate exactly ${count} educational flashcards for the chapter "${title}".
  Use this textbook source text as the exclusive source:

  [TEXT PASSAGE]
  ${sourceText}

  ${getSubjectSpecificInstructions(subject)}
  `;

  const result = await safeGenerateContent(model, [
    { text: FLASHCARD_SYSTEM_PROMPT },
    { text: prompt }
  ]);
  return JSON.parse(result.response.text().trim());
}
