import { GoogleGenerativeAI } from "@google/generative-ai";

// Retrieves the user's Gemini key securely from local storage
export function getGeminiApiKey(): string {
  if (typeof window !== "undefined") {
    return localStorage.getItem("acu_gemini_api_key") || "";
  }
  return "";
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

export async function generateChapterMap(
  tocText: string
): Promise<{ name: string; summary: string; startPage: number; endPage: number }[]> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error("Gemini API Key is missing. Please add your key in the Settings page.");
  }

  // Use the standard client SDK
  const ai = new GoogleGenerativeAI(apiKey);
  
  // We use gemini-2.5-flash-lite as the default for lightning-fast parsing tasks
  const model = ai.getGenerativeModel({ 
    model: "gemini-2.5-flash",
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.1
    }
  });

  const prompt = `
  Analyze this Table of Contents text and map chapters to page numbers:
  
  [TEXT]
  ${tocText}
  `;

  const result = await model.generateContent([
    { text: TAXONOMY_SYSTEM_PROMPT },
    { text: prompt }
  ]);

  const responseText = result.response.text();
  return JSON.parse(responseText.trim());
}

// -------------------------------------------------------------
// 1b. Single Chapter Title Extraction (lightweight)
// -------------------------------------------------------------
export async function extractChapterTitle(
  firstPageText: string
): Promise<string> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error("Gemini API Key is missing. Please add your key in the Settings page.");
  }

  const ai = new GoogleGenerativeAI(apiKey);
  const model = ai.getGenerativeModel({ 
    model: "gemini-2.5-flash",
    generationConfig: { temperature: 0.1 }
  });

  const prompt =
`You are given the first few pages of a textbook chapter. Identify the chapter title.

Rules:
- The chapter title is typically a bold heading or chapter name like "Chapter 9: Cell - The Building Block of Life" or just "Cell: The Building Block of Life".
- If the text includes something like "9 Cell The Building Block of Life", the title is "Cell: The Building Block of Life".
- If you cannot find a clear chapter title, return an empty string.

Output ONLY the chapter title. Nothing else. No quotes. No explanations.

Text:
${firstPageText}`;

  const result = await model.generateContent(prompt);
  return result.response.text().trim();
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
  title: string
): Promise<any[]> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) throw new Error("Gemini API Key missing.");

  const ai = new GoogleGenerativeAI(apiKey);
  const model = ai.getGenerativeModel({
    model: "gemini-2.5-flash",
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
  `;

  const result = await model.generateContent([
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
  totalMarks: number
): Promise<any> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) throw new Error("Gemini API Key missing.");

  const ai = new GoogleGenerativeAI(apiKey);
  const model = ai.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.2
    }
  });

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

  const prompt = `
  Generate a question paper titled "${examTitle}" for ${grade} (${board} standard blueprint).
  
  [SECTIONS TO INCLUDE]
  ${sectionsInstructions.join("\n")}

  [CONTEXT PASSAGES]
  ${sourceText}
  `;

  const result = await model.generateContent([
    { text: EXAM_SYSTEM_PROMPT },
    { text: prompt }
  ]);

  return JSON.parse(result.response.text().trim());
}

// -------------------------------------------------------------
// 4. AcuExam Grader Prompt
// -------------------------------------------------------------
const GRADER_SYSTEM_PROMPT = `
You are an objective CBSE Board examiner grading student answers.
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

export async function gradeWrittenAnswer(
  questionText: string,
  maxMarks: number,
  modelAnswer: string,
  gradingRubric: string,
  studentAnswer: string
): Promise<any> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) throw new Error("Gemini API Key missing.");

  const ai = new GoogleGenerativeAI(apiKey);
  const model = ai.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.1
    }
  });

  const prompt = `
  Evaluate this response:
  
  [QUESTION]
  ${questionText}
  Marks Available: ${maxMarks}
  
  [MODEL ANSWER]
  ${modelAnswer}
  
  [GRADING RUBRIC]
  ${gradingRubric}
  
  [STUDENT ANSWER]
  ${studentAnswer}
  `;

  const result = await model.generateContent([
    { text: GRADER_SYSTEM_PROMPT },
    { text: prompt }
  ]);

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

export async function generateBriefingNotes(sourceText: string, title: string): Promise<any> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) throw new Error("Gemini API Key missing.");

  const ai = new GoogleGenerativeAI(apiKey);
  const model = ai.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: { responseMimeType: "application/json", temperature: 0.2 }
  });

  const prompt = `Generate briefing notes for "${title}" based on this text:\n\n${sourceText}`;
  const result = await model.generateContent([
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

export async function generateFAQSheet(sourceText: string, title: string): Promise<any> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) throw new Error("Gemini API Key missing.");

  const ai = new GoogleGenerativeAI(apiKey);
  const model = ai.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: { responseMimeType: "application/json", temperature: 0.2 }
  });

  const prompt = `Generate FAQ Sheet for "${title}" based on this text:\n\n${sourceText}`;
  const result = await model.generateContent([
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

export async function generateTimeline(sourceText: string, title: string): Promise<any> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) throw new Error("Gemini API Key missing.");

  const ai = new GoogleGenerativeAI(apiKey);
  const model = ai.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: { responseMimeType: "application/json", temperature: 0.2 }
  });

  const prompt = `Generate chronological timeline or process phases for "${title}" based on this text:\n\n${sourceText}`;
  const result = await model.generateContent([
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

export async function generatePodcastScript(sourceText: string, title: string): Promise<any> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) throw new Error("Gemini API Key missing.");

  const ai = new GoogleGenerativeAI(apiKey);
  const model = ai.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: { responseMimeType: "application/json", temperature: 0.3 }
  });

  const prompt = `Generate a lively dialogue podcast script for "${title}" based on this text:\n\n${sourceText}`;
  const result = await model.generateContent([
    { text: PODCAST_SYSTEM_PROMPT },
    { text: prompt }
  ]);
  return JSON.parse(result.response.text().trim());
}
