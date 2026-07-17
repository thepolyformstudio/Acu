// =============================================================================
// Board Exam Blueprint Database
// =============================================================================
// Contains structured question paper blueprints for all major Indian boards,
// competitive entrance exams, and government exams. Each blueprint defines the
// exact section structure, question types, marks distribution, and metadata.
//
// UPDATE WORKFLOW (Annual):
//   1. When a new academic year's blueprint is released (typically April-June),
//      check the official board website (listed in `officialSource`).
//   2. Update the relevant entry's `sections`, `academicYear`, and `lastVerified`.
//   3. Redeploy the app — all users get the updated blueprints instantly.
// =============================================================================

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface QuestionTypeSpec {
  type:
    | "MCQ"
    | "Assertion-Reasoning"
    | "Fill-in-the-Blank"
    | "Match"
    | "True-False"
    | "VSA"
    | "SA"
    | "LA"
    | "Case-Based"
    | "Numerical"
    | "TITA"
    | "Integer";
  marksPerQuestion: number;
  count: number;
  negativeMarking?: number; // e.g. -1, -0.25
  instructions?: string;   // e.g. "Answer in 30 words"
}

export interface SectionSpec {
  sectionLetter: string;
  sectionTitle: string;
  questionTypes: QuestionTypeSpec[];
  totalMarks: number;
  instructions: string;
}

export interface BoardBlueprint {
  boardId: string;            // Matches the dropdown <option> value
  boardName: string;          // Full display name
  boardAbbreviation: string;  // Short code: "CBSE", "RBSE", etc.
  category: "school" | "entrance" | "government";
  academicYear: string;       // "2025-26"
  totalTheoryMarks: number;
  totalQuestions: number;
  durationMinutes: number;
  sections: SectionSpec[];
  gradeLevels: string[];      // Which grades this blueprint applies to
  competencyBasedPercent?: number;
  negativeMarking: boolean;
  examMode: "online" | "offline" | "both";
  gradingStandard: string;    // Used in the grader prompt
  officialSource: string;     // URL for annual verification
  lastVerified: string;       // ISO date
}

// -----------------------------------------------------------------------------
// Blueprint Data — National Boards
// -----------------------------------------------------------------------------

const CBSE_BLUEPRINT: BoardBlueprint = {
  boardId: "CBSE",
  boardName: "Central Board of Secondary Education",
  boardAbbreviation: "CBSE",
  category: "school",
  academicYear: "2025-26",
  totalTheoryMarks: 80,
  totalQuestions: 39,
  durationMinutes: 180,
  sections: [
    {
      sectionLetter: "A",
      sectionTitle: "Objective Type Questions",
      questionTypes: [
        { type: "MCQ", marksPerQuestion: 1, count: 16 },
      ],
      totalMarks: 16,
      instructions: "All questions are compulsory. Each carries 1 mark.",
    },
    {
      sectionLetter: "B",
      sectionTitle: "Assertion-Reasoning Questions",
      questionTypes: [
        { type: "Assertion-Reasoning", marksPerQuestion: 1, count: 5 },
      ],
      totalMarks: 5,
      instructions: "Read both the Assertion (A) and Reason (R) and select the correct option.",
    },
    {
      sectionLetter: "C",
      sectionTitle: "Short Answer Questions",
      questionTypes: [
        { type: "SA", marksPerQuestion: 3, count: 9 },
      ],
      totalMarks: 27,
      instructions: "Answer in approximately 50-80 words. Internal choices may be provided.",
    },
    {
      sectionLetter: "D",
      sectionTitle: "Long Answer Questions",
      questionTypes: [
        { type: "LA", marksPerQuestion: 5, count: 4 },
      ],
      totalMarks: 20,
      instructions: "Answer in approximately 120-150 words. Internal choices may be provided.",
    },
    {
      sectionLetter: "E",
      sectionTitle: "Case-Based / Source-Based Questions",
      questionTypes: [
        { type: "Case-Based", marksPerQuestion: 4, count: 3 },
      ],
      totalMarks: 12,
      instructions: "Read the passage/case carefully and answer the sub-questions.",
    },
  ],
  gradeLevels: ["Grade 9", "Grade 10", "Grade 11", "Grade 12"],
  competencyBasedPercent: 50,
  negativeMarking: false,
  examMode: "offline",
  gradingStandard: "CBSE Board",
  officialSource: "https://cbseacademic.nic.in/",
  lastVerified: "2026-07-17",
};

const ICSE_BLUEPRINT: BoardBlueprint = {
  boardId: "ICSE",
  boardName: "Indian Certificate of Secondary Education / ISC",
  boardAbbreviation: "ICSE",
  category: "school",
  academicYear: "2025-26",
  totalTheoryMarks: 80,
  totalQuestions: 35,
  durationMinutes: 180,
  sections: [
    {
      sectionLetter: "A",
      sectionTitle: "Compulsory Short Questions",
      questionTypes: [
        { type: "MCQ", marksPerQuestion: 1, count: 10 },
        { type: "VSA", marksPerQuestion: 1, count: 5 },
      ],
      totalMarks: 15,
      instructions: "Attempt all questions. Each carries 1 mark.",
    },
    {
      sectionLetter: "B",
      sectionTitle: "Short Answer Questions",
      questionTypes: [
        { type: "SA", marksPerQuestion: 3, count: 10 },
      ],
      totalMarks: 30,
      instructions: "Answer any seven out of ten questions. Each carries 3 marks.",
    },
    {
      sectionLetter: "C",
      sectionTitle: "Long Answer Questions",
      questionTypes: [
        { type: "LA", marksPerQuestion: 5, count: 5 },
      ],
      totalMarks: 25,
      instructions: "Answer any five questions. Each carries 5 marks.",
    },
    {
      sectionLetter: "D",
      sectionTitle: "Application / Case-Based",
      questionTypes: [
        { type: "Case-Based", marksPerQuestion: 5, count: 2 },
      ],
      totalMarks: 10,
      instructions: "Read the given case/data and answer the questions.",
    },
  ],
  gradeLevels: ["Grade 9", "Grade 10", "Grade 11", "Grade 12"],
  negativeMarking: false,
  examMode: "offline",
  gradingStandard: "ICSE/ISC Board",
  officialSource: "https://www.cisce.org/",
  lastVerified: "2026-07-17",
};

// -----------------------------------------------------------------------------
// Blueprint Data — State Boards (Existing in Dropdown)
// -----------------------------------------------------------------------------

const MAHARASHTRA_BLUEPRINT: BoardBlueprint = {
  boardId: "State Board (Maharashtra)",
  boardName: "Maharashtra State Board (SSC / HSC)",
  boardAbbreviation: "MSBSHSE",
  category: "school",
  academicYear: "2025-26",
  totalTheoryMarks: 80,
  totalQuestions: 34,
  durationMinutes: 180,
  sections: [
    {
      sectionLetter: "A",
      sectionTitle: "Objective Type Questions",
      questionTypes: [
        { type: "MCQ", marksPerQuestion: 1, count: 10 },
        { type: "Fill-in-the-Blank", marksPerQuestion: 1, count: 5 },
        { type: "Match", marksPerQuestion: 1, count: 5 },
      ],
      totalMarks: 20,
      instructions: "Attempt all questions. 25% of paper is objective type.",
    },
    {
      sectionLetter: "B",
      sectionTitle: "Very Short Answer Questions",
      questionTypes: [
        { type: "VSA", marksPerQuestion: 2, count: 4 },
      ],
      totalMarks: 8,
      instructions: "Answer in 1-2 sentences.",
    },
    {
      sectionLetter: "C",
      sectionTitle: "Short Answer Questions",
      questionTypes: [
        { type: "SA", marksPerQuestion: 3, count: 5 },
      ],
      totalMarks: 15,
      instructions: "Answer in 50-80 words. Internal choice may be provided.",
    },
    {
      sectionLetter: "D",
      sectionTitle: "Long Answer Questions",
      questionTypes: [
        { type: "LA", marksPerQuestion: 5, count: 5 },
      ],
      totalMarks: 25,
      instructions: "Answer in detail. Internal choice provided.",
    },
    {
      sectionLetter: "E",
      sectionTitle: "Activity / Application Based",
      questionTypes: [
        { type: "Case-Based", marksPerQuestion: 4, count: 3 },
      ],
      totalMarks: 12,
      instructions: "Read the activity/case and answer.",
    },
  ],
  gradeLevels: ["Grade 9", "Grade 10", "Grade 11", "Grade 12"],
  negativeMarking: false,
  examMode: "offline",
  gradingStandard: "Maharashtra Board",
  officialSource: "https://www.mahahsscboard.in/",
  lastVerified: "2026-07-17",
};

const TAMILNADU_BLUEPRINT: BoardBlueprint = {
  boardId: "State Board (Tamil Nadu)",
  boardName: "Tamil Nadu State Board (SSLC / HSC)",
  boardAbbreviation: "TN Board",
  category: "school",
  academicYear: "2025-26",
  totalTheoryMarks: 100,
  totalQuestions: 42,
  durationMinutes: 180,
  sections: [
    {
      sectionLetter: "I",
      sectionTitle: "One Mark Questions",
      questionTypes: [
        { type: "MCQ", marksPerQuestion: 1, count: 15 },
      ],
      totalMarks: 15,
      instructions: "Choose the correct answer. All questions compulsory.",
    },
    {
      sectionLetter: "II",
      sectionTitle: "Two Mark Questions",
      questionTypes: [
        { type: "VSA", marksPerQuestion: 2, count: 10 },
      ],
      totalMarks: 20,
      instructions: "Answer in 2-3 sentences.",
    },
    {
      sectionLetter: "III",
      sectionTitle: "Three Mark Questions",
      questionTypes: [
        { type: "SA", marksPerQuestion: 3, count: 10 },
      ],
      totalMarks: 30,
      instructions: "Answer in 50-80 words.",
    },
    {
      sectionLetter: "IV",
      sectionTitle: "Five Mark Questions",
      questionTypes: [
        { type: "LA", marksPerQuestion: 5, count: 7 },
      ],
      totalMarks: 35,
      instructions: "Answer in detail with diagrams where applicable.",
    },
  ],
  gradeLevels: ["Grade 9", "Grade 10", "Grade 11", "Grade 12"],
  negativeMarking: false,
  examMode: "offline",
  gradingStandard: "Tamil Nadu Board",
  officialSource: "https://dge.tn.gov.in/",
  lastVerified: "2026-07-17",
};

const KARNATAKA_BLUEPRINT: BoardBlueprint = {
  boardId: "State Board (Karnataka)",
  boardName: "Karnataka State Board (SSLC / PUC)",
  boardAbbreviation: "KSEAB",
  category: "school",
  academicYear: "2025-26",
  totalTheoryMarks: 80,
  totalQuestions: 38,
  durationMinutes: 195, // 3 hours 15 minutes
  sections: [
    {
      sectionLetter: "A",
      sectionTitle: "Multiple Choice Questions",
      questionTypes: [
        { type: "MCQ", marksPerQuestion: 1, count: 10 },
      ],
      totalMarks: 10,
      instructions: "Choose the correct answer for each question.",
    },
    {
      sectionLetter: "B",
      sectionTitle: "Very Short Answer Questions",
      questionTypes: [
        { type: "VSA", marksPerQuestion: 1, count: 8 },
      ],
      totalMarks: 8,
      instructions: "Answer in one word or one sentence.",
    },
    {
      sectionLetter: "C",
      sectionTitle: "Short Answer Questions (2 marks)",
      questionTypes: [
        { type: "SA", marksPerQuestion: 2, count: 8 },
      ],
      totalMarks: 16,
      instructions: "Answer in 2-3 sentences.",
    },
    {
      sectionLetter: "D",
      sectionTitle: "Short Answer Questions (3 marks)",
      questionTypes: [
        { type: "SA", marksPerQuestion: 3, count: 6 },
      ],
      totalMarks: 18,
      instructions: "Answer in 80-100 words.",
    },
    {
      sectionLetter: "E",
      sectionTitle: "Long Answer Questions",
      questionTypes: [
        { type: "LA", marksPerQuestion: 4, count: 4 },
      ],
      totalMarks: 16,
      instructions: "Answer in detail.",
    },
    {
      sectionLetter: "F",
      sectionTitle: "Application / Value-Based",
      questionTypes: [
        { type: "Case-Based", marksPerQuestion: 4, count: 3 },
      ],
      totalMarks: 12,
      instructions: "Read the case/scenario and answer.",
    },
  ],
  gradeLevels: ["Grade 9", "Grade 10", "Grade 11", "Grade 12"],
  negativeMarking: false,
  examMode: "offline",
  gradingStandard: "Karnataka Board",
  officialSource: "https://kseab.karnataka.gov.in/",
  lastVerified: "2026-07-17",
};

// -----------------------------------------------------------------------------
// Blueprint Data — State Boards (New Additions)
// -----------------------------------------------------------------------------

const AP_BLUEPRINT: BoardBlueprint = {
  boardId: "State Board (Andhra Pradesh)",
  boardName: "Andhra Pradesh State Board (SSC / Intermediate)",
  boardAbbreviation: "BSEAP",
  category: "school",
  academicYear: "2025-26",
  totalTheoryMarks: 100,
  totalQuestions: 38,
  durationMinutes: 180,
  sections: [
    {
      sectionLetter: "A",
      sectionTitle: "Objective Type Questions",
      questionTypes: [
        { type: "MCQ", marksPerQuestion: 1, count: 12 },
        { type: "Fill-in-the-Blank", marksPerQuestion: 1, count: 4 },
      ],
      totalMarks: 16,
      instructions: "All questions are compulsory.",
    },
    {
      sectionLetter: "B",
      sectionTitle: "Very Short Answer Questions",
      questionTypes: [
        { type: "VSA", marksPerQuestion: 2, count: 8 },
      ],
      totalMarks: 16,
      instructions: "Answer in 1-2 sentences.",
    },
    {
      sectionLetter: "C",
      sectionTitle: "Short Answer Questions",
      questionTypes: [
        { type: "SA", marksPerQuestion: 4, count: 8 },
      ],
      totalMarks: 32,
      instructions: "Answer in 60-80 words.",
    },
    {
      sectionLetter: "D",
      sectionTitle: "Long Answer Questions",
      questionTypes: [
        { type: "LA", marksPerQuestion: 6, count: 6 },
      ],
      totalMarks: 36,
      instructions: "Answer in detail with examples.",
    },
  ],
  gradeLevels: ["Grade 9", "Grade 10", "Grade 11", "Grade 12"],
  negativeMarking: false,
  examMode: "offline",
  gradingStandard: "Andhra Pradesh Board",
  officialSource: "https://bse.ap.gov.in/",
  lastVerified: "2026-07-17",
};

const TELANGANA_BLUEPRINT: BoardBlueprint = {
  boardId: "State Board (Telangana)",
  boardName: "Telangana State Board (SSC / Intermediate)",
  boardAbbreviation: "BSETS",
  category: "school",
  academicYear: "2025-26",
  totalTheoryMarks: 80,
  totalQuestions: 33,
  durationMinutes: 180,
  sections: [
    {
      sectionLetter: "A",
      sectionTitle: "Objective Type Questions",
      questionTypes: [
        { type: "MCQ", marksPerQuestion: 1, count: 10 },
        { type: "Fill-in-the-Blank", marksPerQuestion: 1, count: 3 },
      ],
      totalMarks: 13,
      instructions: "All questions are compulsory.",
    },
    {
      sectionLetter: "B",
      sectionTitle: "Very Short Answer Questions",
      questionTypes: [
        { type: "VSA", marksPerQuestion: 2, count: 5 },
      ],
      totalMarks: 10,
      instructions: "Answer in 1-2 sentences.",
    },
    {
      sectionLetter: "C",
      sectionTitle: "Short Answer Questions",
      questionTypes: [
        { type: "SA", marksPerQuestion: 4, count: 7 },
      ],
      totalMarks: 28,
      instructions: "Answer in 60-80 words. Internal choice provided.",
    },
    {
      sectionLetter: "D",
      sectionTitle: "Long Answer Questions",
      questionTypes: [
        { type: "LA", marksPerQuestion: 5, count: 4 },
      ],
      totalMarks: 20,
      instructions: "Answer in detail.",
    },
    {
      sectionLetter: "E",
      sectionTitle: "Case-Based Questions",
      questionTypes: [
        { type: "Case-Based", marksPerQuestion: 3, count: 3 },
      ],
      totalMarks: 9,
      instructions: "Read the passage and answer.",
    },
  ],
  gradeLevels: ["Grade 9", "Grade 10", "Grade 11", "Grade 12"],
  negativeMarking: false,
  examMode: "offline",
  gradingStandard: "Telangana Board",
  officialSource: "https://bse.telangana.gov.in/",
  lastVerified: "2026-07-17",
};

const KERALA_BLUEPRINT: BoardBlueprint = {
  boardId: "State Board (Kerala)",
  boardName: "Kerala State Board (SSLC / Plus Two)",
  boardAbbreviation: "KBPE",
  category: "school",
  academicYear: "2025-26",
  totalTheoryMarks: 80,
  totalQuestions: 32,
  durationMinutes: 165, // 2 hours 45 minutes
  sections: [
    {
      sectionLetter: "A",
      sectionTitle: "Objective Type Questions",
      questionTypes: [
        { type: "MCQ", marksPerQuestion: 1, count: 8 },
        { type: "VSA", marksPerQuestion: 1, count: 4 },
      ],
      totalMarks: 12,
      instructions: "All questions are compulsory. 1 mark each.",
    },
    {
      sectionLetter: "B",
      sectionTitle: "Short Answer Questions (2 marks)",
      questionTypes: [
        { type: "SA", marksPerQuestion: 2, count: 8 },
      ],
      totalMarks: 16,
      instructions: "Answer in 2-3 sentences.",
    },
    {
      sectionLetter: "C",
      sectionTitle: "Short Answer Questions (3 marks)",
      questionTypes: [
        { type: "SA", marksPerQuestion: 3, count: 6 },
      ],
      totalMarks: 18,
      instructions: "Answer in 50-60 words.",
    },
    {
      sectionLetter: "D",
      sectionTitle: "Long Answer Questions",
      questionTypes: [
        { type: "LA", marksPerQuestion: 5, count: 4 },
      ],
      totalMarks: 20,
      instructions: "Answer in detail with diagrams where applicable.",
    },
    {
      sectionLetter: "E",
      sectionTitle: "Essay / Application Questions",
      questionTypes: [
        { type: "LA", marksPerQuestion: 7, count: 2 },
      ],
      totalMarks: 14,
      instructions: "Answer comprehensively.",
    },
  ],
  gradeLevels: ["Grade 9", "Grade 10", "Grade 11", "Grade 12"],
  negativeMarking: false,
  examMode: "offline",
  gradingStandard: "Kerala Board",
  officialSource: "https://scert.kerala.gov.in/",
  lastVerified: "2026-07-17",
};

const RAJASTHAN_BLUEPRINT: BoardBlueprint = {
  boardId: "State Board (Rajasthan)",
  boardName: "Rajasthan Board of Secondary Education",
  boardAbbreviation: "RBSE",
  category: "school",
  academicYear: "2025-26",
  totalTheoryMarks: 80,
  totalQuestions: 35,
  durationMinutes: 195,
  sections: [
    {
      sectionLetter: "A",
      sectionTitle: "Objective Type Questions",
      questionTypes: [
        { type: "MCQ", marksPerQuestion: 1, count: 12 },
        { type: "True-False", marksPerQuestion: 1, count: 4 },
        { type: "Fill-in-the-Blank", marksPerQuestion: 1, count: 4 },
      ],
      totalMarks: 20,
      instructions: "All questions are compulsory.",
    },
    {
      sectionLetter: "B",
      sectionTitle: "Very Short Answer Questions",
      questionTypes: [
        { type: "VSA", marksPerQuestion: 2, count: 5 },
      ],
      totalMarks: 10,
      instructions: "Answer in 1-2 sentences.",
    },
    {
      sectionLetter: "C",
      sectionTitle: "Short Answer Questions",
      questionTypes: [
        { type: "SA", marksPerQuestion: 3, count: 5 },
      ],
      totalMarks: 15,
      instructions: "Answer in about 50 words.",
    },
    {
      sectionLetter: "D",
      sectionTitle: "Long Answer Questions",
      questionTypes: [
        { type: "LA", marksPerQuestion: 5, count: 5 },
      ],
      totalMarks: 25,
      instructions: "Answer in detail with diagrams where required.",
    },
    {
      sectionLetter: "E",
      sectionTitle: "Application / Map Based",
      questionTypes: [
        { type: "Case-Based", marksPerQuestion: 5, count: 2 },
      ],
      totalMarks: 10,
      instructions: "Application or map-based questions.",
    },
  ],
  gradeLevels: ["Grade 9", "Grade 10", "Grade 11", "Grade 12"],
  negativeMarking: false,
  examMode: "offline",
  gradingStandard: "Rajasthan Board (RBSE)",
  officialSource: "https://rajeduboard.rajasthan.gov.in/",
  lastVerified: "2026-07-17",
};

const GUJARAT_BLUEPRINT: BoardBlueprint = {
  boardId: "State Board (Gujarat)",
  boardName: "Gujarat Secondary & Higher Secondary Education Board",
  boardAbbreviation: "GSEB",
  category: "school",
  academicYear: "2025-26",
  totalTheoryMarks: 80,
  totalQuestions: 34,
  durationMinutes: 180,
  sections: [
    {
      sectionLetter: "A",
      sectionTitle: "Objective Type Questions",
      questionTypes: [
        { type: "MCQ", marksPerQuestion: 1, count: 14 },
      ],
      totalMarks: 14,
      instructions: "All questions are compulsory.",
    },
    {
      sectionLetter: "B",
      sectionTitle: "Very Short Answer Questions",
      questionTypes: [
        { type: "VSA", marksPerQuestion: 2, count: 6 },
      ],
      totalMarks: 12,
      instructions: "Answer briefly in 1-2 sentences.",
    },
    {
      sectionLetter: "C",
      sectionTitle: "Short Answer Questions",
      questionTypes: [
        { type: "SA", marksPerQuestion: 3, count: 6 },
      ],
      totalMarks: 18,
      instructions: "Answer in 50-60 words.",
    },
    {
      sectionLetter: "D",
      sectionTitle: "Long Answer Questions",
      questionTypes: [
        { type: "LA", marksPerQuestion: 5, count: 4 },
      ],
      totalMarks: 20,
      instructions: "Answer in detail.",
    },
    {
      sectionLetter: "E",
      sectionTitle: "Descriptive / Application",
      questionTypes: [
        { type: "LA", marksPerQuestion: 4, count: 4 },
      ],
      totalMarks: 16,
      instructions: "Answer with reasoning and examples.",
    },
  ],
  gradeLevels: ["Grade 9", "Grade 10", "Grade 11", "Grade 12"],
  negativeMarking: false,
  examMode: "offline",
  gradingStandard: "Gujarat Board (GSEB)",
  officialSource: "https://gsebeservice.com/",
  lastVerified: "2026-07-17",
};

const WESTBENGAL_BLUEPRINT: BoardBlueprint = {
  boardId: "State Board (West Bengal)",
  boardName: "West Bengal Board (WBBSE / WBCHSE)",
  boardAbbreviation: "WBBSE",
  category: "school",
  academicYear: "2025-26",
  totalTheoryMarks: 90,
  totalQuestions: 36,
  durationMinutes: 195,
  sections: [
    {
      sectionLetter: "A",
      sectionTitle: "Multiple Choice Questions",
      questionTypes: [
        { type: "MCQ", marksPerQuestion: 1, count: 15 },
      ],
      totalMarks: 15,
      instructions: "Choose the correct option. All MCQs compulsory.",
    },
    {
      sectionLetter: "B",
      sectionTitle: "Very Short Answer Questions",
      questionTypes: [
        { type: "VSA", marksPerQuestion: 1, count: 6 },
      ],
      totalMarks: 6,
      instructions: "Answer in one sentence.",
    },
    {
      sectionLetter: "C",
      sectionTitle: "Short Answer Questions",
      questionTypes: [
        { type: "SA", marksPerQuestion: 2, count: 8 },
      ],
      totalMarks: 16,
      instructions: "Answer in 2-3 sentences.",
    },
    {
      sectionLetter: "D",
      sectionTitle: "Descriptive Answer Questions",
      questionTypes: [
        { type: "SA", marksPerQuestion: 3, count: 5 },
      ],
      totalMarks: 15,
      instructions: "Answer in about 60 words.",
    },
    {
      sectionLetter: "E",
      sectionTitle: "Long Answer / Essay Questions",
      questionTypes: [
        { type: "LA", marksPerQuestion: 5, count: 5 },
      ],
      totalMarks: 25,
      instructions: "Answer in detail.",
    },
    {
      sectionLetter: "F",
      sectionTitle: "Application / Map Based",
      questionTypes: [
        { type: "Case-Based", marksPerQuestion: 3, count: 2 },
        { type: "SA", marksPerQuestion: 3.5, count: 2 },
      ],
      totalMarks: 13,
      instructions: "Application-based questions.",
    },
  ],
  gradeLevels: ["Grade 9", "Grade 10", "Grade 11", "Grade 12"],
  negativeMarking: false,
  examMode: "offline",
  gradingStandard: "West Bengal Board",
  officialSource: "https://wbbse.wb.gov.in/",
  lastVerified: "2026-07-17",
};

const UP_BLUEPRINT: BoardBlueprint = {
  boardId: "State Board (Uttar Pradesh)",
  boardName: "Uttar Pradesh Madhyamik Shiksha Parishad",
  boardAbbreviation: "UPMSP",
  category: "school",
  academicYear: "2025-26",
  totalTheoryMarks: 70,
  totalQuestions: 30,
  durationMinutes: 180,
  sections: [
    {
      sectionLetter: "A",
      sectionTitle: "Multiple Choice Questions",
      questionTypes: [
        { type: "MCQ", marksPerQuestion: 1, count: 10 },
      ],
      totalMarks: 10,
      instructions: "All questions are compulsory.",
    },
    {
      sectionLetter: "B",
      sectionTitle: "Very Short Answer Questions",
      questionTypes: [
        { type: "VSA", marksPerQuestion: 2, count: 5 },
      ],
      totalMarks: 10,
      instructions: "Answer in 1-2 sentences.",
    },
    {
      sectionLetter: "C",
      sectionTitle: "Short Answer Questions",
      questionTypes: [
        { type: "SA", marksPerQuestion: 3, count: 5 },
      ],
      totalMarks: 15,
      instructions: "Answer in 50-60 words.",
    },
    {
      sectionLetter: "D",
      sectionTitle: "Long Answer Questions",
      questionTypes: [
        { type: "LA", marksPerQuestion: 5, count: 5 },
      ],
      totalMarks: 25,
      instructions: "Answer in detail with diagrams if needed.",
    },
    {
      sectionLetter: "E",
      sectionTitle: "Application / Analytical",
      questionTypes: [
        { type: "Case-Based", marksPerQuestion: 5, count: 2 },
      ],
      totalMarks: 10,
      instructions: "Read the case/data and answer.",
    },
  ],
  gradeLevels: ["Grade 9", "Grade 10", "Grade 11", "Grade 12"],
  negativeMarking: false,
  examMode: "offline",
  gradingStandard: "UP Board (UPMSP)",
  officialSource: "https://upmsp.edu.in/",
  lastVerified: "2026-07-17",
};

const PUNJAB_BLUEPRINT: BoardBlueprint = {
  boardId: "State Board (Punjab)",
  boardName: "Punjab School Education Board",
  boardAbbreviation: "PSEB",
  category: "school",
  academicYear: "2025-26",
  totalTheoryMarks: 80,
  totalQuestions: 33,
  durationMinutes: 180,
  sections: [
    {
      sectionLetter: "A",
      sectionTitle: "Objective Type Questions",
      questionTypes: [
        { type: "MCQ", marksPerQuestion: 1, count: 10 },
        { type: "Fill-in-the-Blank", marksPerQuestion: 1, count: 5 },
      ],
      totalMarks: 15,
      instructions: "All questions are compulsory.",
    },
    {
      sectionLetter: "B",
      sectionTitle: "Very Short Answer Questions",
      questionTypes: [
        { type: "VSA", marksPerQuestion: 2, count: 5 },
      ],
      totalMarks: 10,
      instructions: "Answer in 1-2 sentences.",
    },
    {
      sectionLetter: "C",
      sectionTitle: "Short Answer Questions",
      questionTypes: [
        { type: "SA", marksPerQuestion: 3, count: 5 },
      ],
      totalMarks: 15,
      instructions: "Answer in about 50 words.",
    },
    {
      sectionLetter: "D",
      sectionTitle: "Long Answer Questions",
      questionTypes: [
        { type: "LA", marksPerQuestion: 5, count: 5 },
      ],
      totalMarks: 25,
      instructions: "Answer in detail.",
    },
    {
      sectionLetter: "E",
      sectionTitle: "Case-Based / Source-Based",
      questionTypes: [
        { type: "Case-Based", marksPerQuestion: 5, count: 3 },
      ],
      totalMarks: 15,
      instructions: "Read the passage and answer.",
    },
  ],
  gradeLevels: ["Grade 9", "Grade 10", "Grade 11", "Grade 12"],
  negativeMarking: false,
  examMode: "offline",
  gradingStandard: "Punjab Board (PSEB)",
  officialSource: "https://pseb.ac.in/",
  lastVerified: "2026-07-17",
};

const HARYANA_BLUEPRINT: BoardBlueprint = {
  boardId: "State Board (Haryana)",
  boardName: "Board of School Education, Haryana",
  boardAbbreviation: "HBSE",
  category: "school",
  academicYear: "2025-26",
  totalTheoryMarks: 80,
  totalQuestions: 35,
  durationMinutes: 180,
  sections: [
    {
      sectionLetter: "A",
      sectionTitle: "Objective Type Questions",
      questionTypes: [
        { type: "MCQ", marksPerQuestion: 1, count: 8 },
        { type: "Fill-in-the-Blank", marksPerQuestion: 1, count: 4 },
        { type: "Assertion-Reasoning", marksPerQuestion: 1, count: 4 },
      ],
      totalMarks: 16,
      instructions: "All questions are compulsory.",
    },
    {
      sectionLetter: "B",
      sectionTitle: "Very Short Answer Questions",
      questionTypes: [
        { type: "VSA", marksPerQuestion: 2, count: 5 },
      ],
      totalMarks: 10,
      instructions: "Answer in 1-2 sentences.",
    },
    {
      sectionLetter: "C",
      sectionTitle: "Short Answer Questions",
      questionTypes: [
        { type: "SA", marksPerQuestion: 3, count: 6 },
      ],
      totalMarks: 18,
      instructions: "Answer in about 50 words.",
    },
    {
      sectionLetter: "D",
      sectionTitle: "Long Answer Questions",
      questionTypes: [
        { type: "LA", marksPerQuestion: 5, count: 4 },
      ],
      totalMarks: 20,
      instructions: "Answer in 100-150 words.",
    },
    {
      sectionLetter: "E",
      sectionTitle: "Case-Based / Application",
      questionTypes: [
        { type: "Case-Based", marksPerQuestion: 4, count: 4 },
      ],
      totalMarks: 16,
      instructions: "Read the given data/case and answer.",
    },
  ],
  gradeLevels: ["Grade 9", "Grade 10", "Grade 11", "Grade 12"],
  negativeMarking: false,
  examMode: "offline",
  gradingStandard: "Haryana Board (HBSE)",
  officialSource: "https://bseh.org.in/",
  lastVerified: "2026-07-17",
};

const MP_BLUEPRINT: BoardBlueprint = {
  boardId: "State Board (Madhya Pradesh)",
  boardName: "Madhya Pradesh Board of Secondary Education",
  boardAbbreviation: "MPBSE",
  category: "school",
  academicYear: "2025-26",
  totalTheoryMarks: 75,
  totalQuestions: 30,
  durationMinutes: 180,
  sections: [
    {
      sectionLetter: "A",
      sectionTitle: "Objective Type Questions",
      questionTypes: [
        { type: "MCQ", marksPerQuestion: 1, count: 6 },
        { type: "Fill-in-the-Blank", marksPerQuestion: 1, count: 6 },
        { type: "True-False", marksPerQuestion: 1, count: 5 },
        { type: "Match", marksPerQuestion: 1, count: 5 },
      ],
      totalMarks: 22,
      instructions: "All questions are compulsory. 1 mark each.",
    },
    {
      sectionLetter: "B",
      sectionTitle: "Very Short Answer Questions",
      questionTypes: [
        { type: "VSA", marksPerQuestion: 2, count: 3 },
      ],
      totalMarks: 6,
      instructions: "Answer in about 30 words.",
    },
    {
      sectionLetter: "C",
      sectionTitle: "Short Answer Questions",
      questionTypes: [
        { type: "SA", marksPerQuestion: 3, count: 3 },
      ],
      totalMarks: 9,
      instructions: "Answer in about 75 words.",
    },
    {
      sectionLetter: "D",
      sectionTitle: "Analytical / Application Questions",
      questionTypes: [
        { type: "SA", marksPerQuestion: 4, count: 3 },
      ],
      totalMarks: 12,
      instructions: "Answer with reasoning.",
    },
    {
      sectionLetter: "E",
      sectionTitle: "Long Answer Questions",
      questionTypes: [
        { type: "LA", marksPerQuestion: 5, count: 4 },
      ],
      totalMarks: 20,
      instructions: "Answer in about 150 words.",
    },
    {
      sectionLetter: "F",
      sectionTitle: "Map / Diagram Based",
      questionTypes: [
        { type: "Case-Based", marksPerQuestion: 3, count: 2 },
      ],
      totalMarks: 6,
      instructions: "Map or diagram-based questions.",
    },
  ],
  gradeLevels: ["Grade 9", "Grade 10", "Grade 11", "Grade 12"],
  negativeMarking: false,
  examMode: "offline",
  gradingStandard: "MP Board (MPBSE)",
  officialSource: "https://mpbse.nic.in/",
  lastVerified: "2026-07-17",
};

const BIHAR_BLUEPRINT: BoardBlueprint = {
  boardId: "State Board (Bihar)",
  boardName: "Bihar School Examination Board",
  boardAbbreviation: "BSEB",
  category: "school",
  academicYear: "2025-26",
  totalTheoryMarks: 100,
  totalQuestions: 60, // 50% objective + 50% subjective
  durationMinutes: 195, // 3 hours 15 minutes
  sections: [
    {
      sectionLetter: "A",
      sectionTitle: "Objective Type Questions (50%)",
      questionTypes: [
        { type: "MCQ", marksPerQuestion: 1, count: 50 },
      ],
      totalMarks: 50,
      instructions: "Attempt any 50 out of 60 MCQs. Each carries 1 mark. No negative marking.",
    },
    {
      sectionLetter: "B",
      sectionTitle: "Subjective — Short Answer",
      questionTypes: [
        { type: "SA", marksPerQuestion: 2, count: 5 },
      ],
      totalMarks: 10,
      instructions: "Answer in 2-3 sentences.",
    },
    {
      sectionLetter: "C",
      sectionTitle: "Subjective — Long Answer",
      questionTypes: [
        { type: "LA", marksPerQuestion: 5, count: 5 },
      ],
      totalMarks: 25,
      instructions: "Answer in about 100 words.",
    },
    {
      sectionLetter: "D",
      sectionTitle: "Subjective — Essay Type",
      questionTypes: [
        { type: "LA", marksPerQuestion: 5, count: 3 },
      ],
      totalMarks: 15,
      instructions: "Answer in detail with diagrams if applicable.",
    },
  ],
  gradeLevels: ["Grade 9", "Grade 10", "Grade 11", "Grade 12"],
  negativeMarking: false,
  examMode: "offline",
  gradingStandard: "Bihar Board (BSEB)",
  officialSource: "https://biharboardonline.bihar.gov.in/",
  lastVerified: "2026-07-17",
};

const ODISHA_BLUEPRINT: BoardBlueprint = {
  boardId: "State Board (Odisha)",
  boardName: "Council of Higher Secondary Education, Odisha",
  boardAbbreviation: "CHSE",
  category: "school",
  academicYear: "2025-26",
  totalTheoryMarks: 80,
  totalQuestions: 33,
  durationMinutes: 180,
  sections: [
    {
      sectionLetter: "A",
      sectionTitle: "Multiple Choice Questions",
      questionTypes: [
        { type: "MCQ", marksPerQuestion: 1, count: 10 },
      ],
      totalMarks: 10,
      instructions: "Choose the correct answer.",
    },
    {
      sectionLetter: "B",
      sectionTitle: "Very Short Answer Questions",
      questionTypes: [
        { type: "VSA", marksPerQuestion: 2, count: 5 },
      ],
      totalMarks: 10,
      instructions: "Answer in one or two sentences.",
    },
    {
      sectionLetter: "C",
      sectionTitle: "Short Answer Questions",
      questionTypes: [
        { type: "SA", marksPerQuestion: 3, count: 8 },
      ],
      totalMarks: 24,
      instructions: "Answer in about 60 words.",
    },
    {
      sectionLetter: "D",
      sectionTitle: "Long Answer Questions",
      questionTypes: [
        { type: "LA", marksPerQuestion: 5, count: 5 },
      ],
      totalMarks: 25,
      instructions: "Answer in detail.",
    },
    {
      sectionLetter: "E",
      sectionTitle: "Analytical / Application",
      questionTypes: [
        { type: "Case-Based", marksPerQuestion: 5.5, count: 2 },
      ],
      totalMarks: 11,
      instructions: "Application-based questions.",
    },
  ],
  gradeLevels: ["Grade 9", "Grade 10", "Grade 11", "Grade 12"],
  negativeMarking: false,
  examMode: "offline",
  gradingStandard: "Odisha Board (CHSE)",
  officialSource: "https://chseodisha.nic.in/",
  lastVerified: "2026-07-17",
};

const ASSAM_BLUEPRINT: BoardBlueprint = {
  boardId: "State Board (Assam)",
  boardName: "Board of Secondary Education, Assam / AHSEC",
  boardAbbreviation: "SEBA",
  category: "school",
  academicYear: "2025-26",
  totalTheoryMarks: 80,
  totalQuestions: 32,
  durationMinutes: 180,
  sections: [
    {
      sectionLetter: "A",
      sectionTitle: "Multiple Choice Questions",
      questionTypes: [
        { type: "MCQ", marksPerQuestion: 1, count: 10 },
      ],
      totalMarks: 10,
      instructions: "Choose the correct answer.",
    },
    {
      sectionLetter: "B",
      sectionTitle: "Very Short Answer",
      questionTypes: [
        { type: "VSA", marksPerQuestion: 2, count: 5 },
      ],
      totalMarks: 10,
      instructions: "Answer in one or two sentences.",
    },
    {
      sectionLetter: "C",
      sectionTitle: "Short Answer Questions",
      questionTypes: [
        { type: "SA", marksPerQuestion: 3, count: 7 },
      ],
      totalMarks: 21,
      instructions: "Answer in 50-60 words.",
    },
    {
      sectionLetter: "D",
      sectionTitle: "Long Answer Questions",
      questionTypes: [
        { type: "LA", marksPerQuestion: 5, count: 5 },
      ],
      totalMarks: 25,
      instructions: "Answer in detail with examples.",
    },
    {
      sectionLetter: "E",
      sectionTitle: "Application / Value-Based",
      questionTypes: [
        { type: "Case-Based", marksPerQuestion: 7, count: 2 },
      ],
      totalMarks: 14,
      instructions: "Read the passage/data and answer.",
    },
  ],
  gradeLevels: ["Grade 9", "Grade 10", "Grade 11", "Grade 12"],
  negativeMarking: false,
  examMode: "offline",
  gradingStandard: "Assam Board (SEBA)",
  officialSource: "https://sebaonline.org/",
  lastVerified: "2026-07-17",
};

const JHARKHAND_BLUEPRINT: BoardBlueprint = {
  boardId: "State Board (Jharkhand)",
  boardName: "Jharkhand Academic Council",
  boardAbbreviation: "JAC",
  category: "school",
  academicYear: "2025-26",
  totalTheoryMarks: 80,
  totalQuestions: 33,
  durationMinutes: 180,
  sections: [
    {
      sectionLetter: "A",
      sectionTitle: "Objective Type Questions",
      questionTypes: [
        { type: "MCQ", marksPerQuestion: 1, count: 10 },
        { type: "Fill-in-the-Blank", marksPerQuestion: 1, count: 3 },
      ],
      totalMarks: 13,
      instructions: "All questions compulsory. Competency-based.",
    },
    {
      sectionLetter: "B",
      sectionTitle: "Very Short Answer Questions",
      questionTypes: [
        { type: "VSA", marksPerQuestion: 2, count: 5 },
      ],
      totalMarks: 10,
      instructions: "Answer in 1-2 sentences.",
    },
    {
      sectionLetter: "C",
      sectionTitle: "Short Answer Questions",
      questionTypes: [
        { type: "SA", marksPerQuestion: 3, count: 5 },
      ],
      totalMarks: 15,
      instructions: "Answer in about 50 words.",
    },
    {
      sectionLetter: "D",
      sectionTitle: "Long Answer Questions",
      questionTypes: [
        { type: "LA", marksPerQuestion: 5, count: 5 },
      ],
      totalMarks: 25,
      instructions: "Answer in detail.",
    },
    {
      sectionLetter: "E",
      sectionTitle: "Application / Case-Based",
      questionTypes: [
        { type: "Case-Based", marksPerQuestion: 5, count: 2 },
        { type: "SA", marksPerQuestion: 3.5, count: 2 },
      ],
      totalMarks: 17,
      instructions: "Read the scenario and answer.",
    },
  ],
  gradeLevels: ["Grade 9", "Grade 10", "Grade 11", "Grade 12"],
  negativeMarking: false,
  examMode: "offline",
  gradingStandard: "Jharkhand Board (JAC)",
  officialSource: "https://jac.jharkhand.gov.in/",
  lastVerified: "2026-07-17",
};

const UTTARAKHAND_BLUEPRINT: BoardBlueprint = {
  boardId: "State Board (Uttarakhand)",
  boardName: "Uttarakhand Board of School Education",
  boardAbbreviation: "UBSE",
  category: "school",
  academicYear: "2025-26",
  totalTheoryMarks: 80,
  totalQuestions: 32,
  durationMinutes: 180,
  sections: [
    {
      sectionLetter: "A",
      sectionTitle: "Objective Type Questions",
      questionTypes: [
        { type: "MCQ", marksPerQuestion: 1, count: 10 },
      ],
      totalMarks: 10,
      instructions: "All questions compulsory.",
    },
    {
      sectionLetter: "B",
      sectionTitle: "Very Short Answer Questions",
      questionTypes: [
        { type: "VSA", marksPerQuestion: 2, count: 5 },
      ],
      totalMarks: 10,
      instructions: "Answer in 1-2 sentences.",
    },
    {
      sectionLetter: "C",
      sectionTitle: "Short Answer Questions",
      questionTypes: [
        { type: "SA", marksPerQuestion: 3, count: 6 },
      ],
      totalMarks: 18,
      instructions: "Answer in about 50 words.",
    },
    {
      sectionLetter: "D",
      sectionTitle: "Long Answer Questions",
      questionTypes: [
        { type: "LA", marksPerQuestion: 5, count: 5 },
      ],
      totalMarks: 25,
      instructions: "Answer in detail.",
    },
    {
      sectionLetter: "E",
      sectionTitle: "Case-Based Questions",
      questionTypes: [
        { type: "Case-Based", marksPerQuestion: 4, count: 3 },
        { type: "SA", marksPerQuestion: 3, count: 1 },
      ],
      totalMarks: 17,
      instructions: "Read the given case and answer.",
    },
  ],
  gradeLevels: ["Grade 9", "Grade 10", "Grade 11", "Grade 12"],
  negativeMarking: false,
  examMode: "offline",
  gradingStandard: "Uttarakhand Board (UBSE)",
  officialSource: "https://ubse.uk.gov.in/",
  lastVerified: "2026-07-17",
};

const CHHATTISGARH_BLUEPRINT: BoardBlueprint = {
  boardId: "State Board (Chhattisgarh)",
  boardName: "Chhattisgarh Board of Secondary Education",
  boardAbbreviation: "CGBSE",
  category: "school",
  academicYear: "2025-26",
  totalTheoryMarks: 75,
  totalQuestions: 30,
  durationMinutes: 180,
  sections: [
    {
      sectionLetter: "A",
      sectionTitle: "Objective Type Questions",
      questionTypes: [
        { type: "MCQ", marksPerQuestion: 1, count: 5 },
        { type: "Fill-in-the-Blank", marksPerQuestion: 1, count: 5 },
        { type: "True-False", marksPerQuestion: 1, count: 5 },
        { type: "Match", marksPerQuestion: 1, count: 5 },
      ],
      totalMarks: 20,
      instructions: "All objective questions are compulsory.",
    },
    {
      sectionLetter: "B",
      sectionTitle: "Very Short Answer Questions",
      questionTypes: [
        { type: "VSA", marksPerQuestion: 2, count: 3 },
      ],
      totalMarks: 6,
      instructions: "Answer in about 30 words.",
    },
    {
      sectionLetter: "C",
      sectionTitle: "Short Answer Questions",
      questionTypes: [
        { type: "SA", marksPerQuestion: 3, count: 3 },
      ],
      totalMarks: 9,
      instructions: "Answer in about 75 words.",
    },
    {
      sectionLetter: "D",
      sectionTitle: "Long Answer Questions",
      questionTypes: [
        { type: "LA", marksPerQuestion: 4, count: 2 },
      ],
      totalMarks: 8,
      instructions: "Answer in about 120 words.",
    },
    {
      sectionLetter: "E",
      sectionTitle: "Essay Type Questions",
      questionTypes: [
        { type: "LA", marksPerQuestion: 5, count: 2 },
      ],
      totalMarks: 10,
      instructions: "Answer in about 150 words.",
    },
  ],
  gradeLevels: ["Grade 9", "Grade 10", "Grade 11", "Grade 12"],
  negativeMarking: false,
  examMode: "offline",
  gradingStandard: "Chhattisgarh Board (CGBSE)",
  officialSource: "https://cgbse.nic.in/",
  lastVerified: "2026-07-17",
};

const GOA_BLUEPRINT: BoardBlueprint = {
  boardId: "State Board (Goa)",
  boardName: "Goa Board of Secondary & Higher Secondary Education",
  boardAbbreviation: "GBSHSE",
  category: "school",
  academicYear: "2025-26",
  totalTheoryMarks: 80,
  totalQuestions: 32,
  durationMinutes: 180,
  sections: [
    {
      sectionLetter: "A",
      sectionTitle: "Objective Type Questions",
      questionTypes: [
        { type: "MCQ", marksPerQuestion: 1, count: 10 },
      ],
      totalMarks: 10,
      instructions: "Choose the correct answer.",
    },
    {
      sectionLetter: "B",
      sectionTitle: "Very Short Answer Questions",
      questionTypes: [
        { type: "VSA", marksPerQuestion: 2, count: 5 },
      ],
      totalMarks: 10,
      instructions: "Answer in 1-2 sentences.",
    },
    {
      sectionLetter: "C",
      sectionTitle: "Short Answer Questions",
      questionTypes: [
        { type: "SA", marksPerQuestion: 3, count: 6 },
      ],
      totalMarks: 18,
      instructions: "Answer in about 50 words.",
    },
    {
      sectionLetter: "D",
      sectionTitle: "Long Answer Questions",
      questionTypes: [
        { type: "LA", marksPerQuestion: 5, count: 5 },
      ],
      totalMarks: 25,
      instructions: "Answer in detail.",
    },
    {
      sectionLetter: "E",
      sectionTitle: "Application / Case-Based",
      questionTypes: [
        { type: "Case-Based", marksPerQuestion: 4, count: 2 },
        { type: "SA", marksPerQuestion: 4.5, count: 2 },
      ],
      totalMarks: 17,
      instructions: "Read the given case and answer.",
    },
  ],
  gradeLevels: ["Grade 9", "Grade 10", "Grade 11", "Grade 12"],
  negativeMarking: false,
  examMode: "offline",
  gradingStandard: "Goa Board (GBSHSE)",
  officialSource: "https://gbshse.in/",
  lastVerified: "2026-07-17",
};

// -----------------------------------------------------------------------------
// Blueprint Data — Competitive / Entrance Exams
// -----------------------------------------------------------------------------

const JEE_MAIN_BLUEPRINT: BoardBlueprint = {
  boardId: "JEE Main",
  boardName: "Joint Entrance Examination (Main)",
  boardAbbreviation: "JEE Main",
  category: "entrance",
  academicYear: "2025-26",
  totalTheoryMarks: 300,
  totalQuestions: 75,
  durationMinutes: 180,
  sections: [
    {
      sectionLetter: "Physics-A",
      sectionTitle: "Physics — Multiple Choice Questions",
      questionTypes: [
        { type: "MCQ", marksPerQuestion: 4, count: 20, negativeMarking: -1 },
      ],
      totalMarks: 80,
      instructions: "Each question has 4 options, only one is correct. +4 for correct, -1 for incorrect.",
    },
    {
      sectionLetter: "Physics-B",
      sectionTitle: "Physics — Numerical Value Questions",
      questionTypes: [
        { type: "Numerical", marksPerQuestion: 4, count: 5, negativeMarking: -1 },
      ],
      totalMarks: 20,
      instructions: "Enter the numerical value. +4 for correct, -1 for incorrect.",
    },
    {
      sectionLetter: "Chemistry-A",
      sectionTitle: "Chemistry — Multiple Choice Questions",
      questionTypes: [
        { type: "MCQ", marksPerQuestion: 4, count: 20, negativeMarking: -1 },
      ],
      totalMarks: 80,
      instructions: "Each question has 4 options, only one is correct. +4 for correct, -1 for incorrect.",
    },
    {
      sectionLetter: "Chemistry-B",
      sectionTitle: "Chemistry — Numerical Value Questions",
      questionTypes: [
        { type: "Numerical", marksPerQuestion: 4, count: 5, negativeMarking: -1 },
      ],
      totalMarks: 20,
      instructions: "Enter the numerical value. +4 for correct, -1 for incorrect.",
    },
    {
      sectionLetter: "Mathematics-A",
      sectionTitle: "Mathematics — Multiple Choice Questions",
      questionTypes: [
        { type: "MCQ", marksPerQuestion: 4, count: 20, negativeMarking: -1 },
      ],
      totalMarks: 80,
      instructions: "Each question has 4 options, only one is correct. +4 for correct, -1 for incorrect.",
    },
    {
      sectionLetter: "Mathematics-B",
      sectionTitle: "Mathematics — Numerical Value Questions",
      questionTypes: [
        { type: "Numerical", marksPerQuestion: 4, count: 5, negativeMarking: -1 },
      ],
      totalMarks: 20,
      instructions: "Enter the numerical value. +4 for correct, -1 for incorrect.",
    },
  ],
  gradeLevels: ["Grade 11", "Grade 12", "Undergraduate"],
  negativeMarking: true,
  examMode: "online",
  gradingStandard: "NTA JEE Main",
  officialSource: "https://jeemain.nta.nic.in/",
  lastVerified: "2026-07-17",
};

const JEE_ADVANCED_BLUEPRINT: BoardBlueprint = {
  boardId: "JEE Advanced",
  boardName: "Joint Entrance Examination (Advanced)",
  boardAbbreviation: "JEE Advanced",
  category: "entrance",
  academicYear: "2025-26",
  totalTheoryMarks: 306,
  totalQuestions: 54,
  durationMinutes: 180,
  sections: [
    {
      sectionLetter: "1",
      sectionTitle: "Single Correct MCQ (per subject)",
      questionTypes: [
        { type: "MCQ", marksPerQuestion: 3, count: 18, negativeMarking: -1 },
      ],
      totalMarks: 54,
      instructions: "One correct option out of four. +3 for correct, -1 for incorrect.",
    },
    {
      sectionLetter: "2",
      sectionTitle: "Multiple Correct MCQ (per subject)",
      questionTypes: [
        { type: "MCQ", marksPerQuestion: 4, count: 18 },
      ],
      totalMarks: 72,
      instructions: "One or more options may be correct. Partial marking applicable.",
    },
    {
      sectionLetter: "3",
      sectionTitle: "Integer / Numerical Answer (per subject)",
      questionTypes: [
        { type: "Integer", marksPerQuestion: 4, count: 18, negativeMarking: -1 },
      ],
      totalMarks: 72,
      instructions: "Enter the integer answer. +4 correct, -1 incorrect.",
    },
  ],
  gradeLevels: ["Grade 12", "Undergraduate"],
  negativeMarking: true,
  examMode: "online",
  gradingStandard: "NTA JEE Advanced",
  officialSource: "https://jeeadv.ac.in/",
  lastVerified: "2026-07-17",
};

const NEET_BLUEPRINT: BoardBlueprint = {
  boardId: "NEET",
  boardName: "National Eligibility cum Entrance Test",
  boardAbbreviation: "NEET",
  category: "entrance",
  academicYear: "2025-26",
  totalTheoryMarks: 720,
  totalQuestions: 180,
  durationMinutes: 180,
  sections: [
    {
      sectionLetter: "Physics",
      sectionTitle: "Physics",
      questionTypes: [
        { type: "MCQ", marksPerQuestion: 4, count: 45, negativeMarking: -1 },
      ],
      totalMarks: 180,
      instructions: "All 45 questions compulsory. +4 for correct, -1 for incorrect, 0 for unattempted.",
    },
    {
      sectionLetter: "Chemistry",
      sectionTitle: "Chemistry",
      questionTypes: [
        { type: "MCQ", marksPerQuestion: 4, count: 45, negativeMarking: -1 },
      ],
      totalMarks: 180,
      instructions: "All 45 questions compulsory. +4 for correct, -1 for incorrect, 0 for unattempted.",
    },
    {
      sectionLetter: "Botany",
      sectionTitle: "Botany",
      questionTypes: [
        { type: "MCQ", marksPerQuestion: 4, count: 45, negativeMarking: -1 },
      ],
      totalMarks: 180,
      instructions: "All 45 questions compulsory. +4 for correct, -1 for incorrect, 0 for unattempted.",
    },
    {
      sectionLetter: "Zoology",
      sectionTitle: "Zoology",
      questionTypes: [
        { type: "MCQ", marksPerQuestion: 4, count: 45, negativeMarking: -1 },
      ],
      totalMarks: 180,
      instructions: "All 45 questions compulsory. +4 for correct, -1 for incorrect, 0 for unattempted.",
    },
  ],
  gradeLevels: ["Grade 11", "Grade 12", "Undergraduate"],
  negativeMarking: true,
  examMode: "offline",
  gradingStandard: "NTA NEET",
  officialSource: "https://neet.nta.nic.in/",
  lastVerified: "2026-07-17",
};

const CAT_BLUEPRINT: BoardBlueprint = {
  boardId: "CAT",
  boardName: "Common Admission Test",
  boardAbbreviation: "CAT",
  category: "entrance",
  academicYear: "2025-26",
  totalTheoryMarks: 198,
  totalQuestions: 66,
  durationMinutes: 120,
  sections: [
    {
      sectionLetter: "VARC",
      sectionTitle: "Verbal Ability & Reading Comprehension",
      questionTypes: [
        { type: "MCQ", marksPerQuestion: 3, count: 16, negativeMarking: -1 },
        { type: "TITA", marksPerQuestion: 3, count: 8 },
      ],
      totalMarks: 72,
      instructions: "MCQs: +3 correct, -1 incorrect. TITA: +3 correct, no negative.",
    },
    {
      sectionLetter: "DILR",
      sectionTitle: "Data Interpretation & Logical Reasoning",
      questionTypes: [
        { type: "MCQ", marksPerQuestion: 3, count: 14, negativeMarking: -1 },
        { type: "TITA", marksPerQuestion: 3, count: 6 },
      ],
      totalMarks: 60,
      instructions: "MCQs: +3 correct, -1 incorrect. TITA: +3 correct, no negative.",
    },
    {
      sectionLetter: "QA",
      sectionTitle: "Quantitative Ability",
      questionTypes: [
        { type: "MCQ", marksPerQuestion: 3, count: 14, negativeMarking: -1 },
        { type: "TITA", marksPerQuestion: 3, count: 8 },
      ],
      totalMarks: 66,
      instructions: "MCQs: +3 correct, -1 incorrect. TITA: +3 correct, no negative.",
    },
  ],
  gradeLevels: ["Undergraduate", "Postgraduate"],
  negativeMarking: true,
  examMode: "online",
  gradingStandard: "IIM CAT",
  officialSource: "https://iimcat.ac.in/",
  lastVerified: "2026-07-17",
};

const CLAT_BLUEPRINT: BoardBlueprint = {
  boardId: "CLAT",
  boardName: "Common Law Admission Test",
  boardAbbreviation: "CLAT",
  category: "entrance",
  academicYear: "2025-26",
  totalTheoryMarks: 120,
  totalQuestions: 120,
  durationMinutes: 120,
  sections: [
    {
      sectionLetter: "I",
      sectionTitle: "English Language",
      questionTypes: [
        { type: "MCQ", marksPerQuestion: 1, count: 24, negativeMarking: -0.25 },
      ],
      totalMarks: 24,
      instructions: "+1 for correct, -0.25 for incorrect.",
    },
    {
      sectionLetter: "II",
      sectionTitle: "Current Affairs & General Knowledge",
      questionTypes: [
        { type: "MCQ", marksPerQuestion: 1, count: 28, negativeMarking: -0.25 },
      ],
      totalMarks: 28,
      instructions: "+1 for correct, -0.25 for incorrect.",
    },
    {
      sectionLetter: "III",
      sectionTitle: "Legal Reasoning",
      questionTypes: [
        { type: "MCQ", marksPerQuestion: 1, count: 28, negativeMarking: -0.25 },
      ],
      totalMarks: 28,
      instructions: "+1 for correct, -0.25 for incorrect.",
    },
    {
      sectionLetter: "IV",
      sectionTitle: "Logical Reasoning",
      questionTypes: [
        { type: "MCQ", marksPerQuestion: 1, count: 24, negativeMarking: -0.25 },
      ],
      totalMarks: 24,
      instructions: "+1 for correct, -0.25 for incorrect.",
    },
    {
      sectionLetter: "V",
      sectionTitle: "Quantitative Techniques",
      questionTypes: [
        { type: "MCQ", marksPerQuestion: 1, count: 16, negativeMarking: -0.25 },
      ],
      totalMarks: 16,
      instructions: "+1 for correct, -0.25 for incorrect.",
    },
  ],
  gradeLevels: ["Grade 12", "Undergraduate"],
  negativeMarking: true,
  examMode: "offline",
  gradingStandard: "CLAT Consortium",
  officialSource: "https://consortiumofnlus.ac.in/",
  lastVerified: "2026-07-17",
};

// -----------------------------------------------------------------------------
// Blueprint Data — Government Exams
// -----------------------------------------------------------------------------

const UPSC_BLUEPRINT: BoardBlueprint = {
  boardId: "UPSC CSE",
  boardName: "UPSC Civil Services Examination (Prelims)",
  boardAbbreviation: "UPSC CSE",
  category: "government",
  academicYear: "2025-26",
  totalTheoryMarks: 200,
  totalQuestions: 100,
  durationMinutes: 120,
  sections: [
    {
      sectionLetter: "GS-I",
      sectionTitle: "General Studies Paper I",
      questionTypes: [
        { type: "MCQ", marksPerQuestion: 2, count: 100, negativeMarking: -0.67 },
      ],
      totalMarks: 200,
      instructions: "100 MCQs. +2 for correct, -0.67 for incorrect (1/3rd penalty).",
    },
  ],
  gradeLevels: ["Undergraduate", "Postgraduate"],
  negativeMarking: true,
  examMode: "offline",
  gradingStandard: "UPSC Civil Services",
  officialSource: "https://upsc.gov.in/",
  lastVerified: "2026-07-17",
};

const SSC_CGL_BLUEPRINT: BoardBlueprint = {
  boardId: "SSC CGL",
  boardName: "SSC Combined Graduate Level (Tier I)",
  boardAbbreviation: "SSC CGL",
  category: "government",
  academicYear: "2025-26",
  totalTheoryMarks: 200,
  totalQuestions: 100,
  durationMinutes: 60,
  sections: [
    {
      sectionLetter: "I",
      sectionTitle: "General Intelligence & Reasoning",
      questionTypes: [
        { type: "MCQ", marksPerQuestion: 2, count: 25, negativeMarking: -0.5 },
      ],
      totalMarks: 50,
      instructions: "+2 for correct, -0.5 for incorrect.",
    },
    {
      sectionLetter: "II",
      sectionTitle: "General Awareness",
      questionTypes: [
        { type: "MCQ", marksPerQuestion: 2, count: 25, negativeMarking: -0.5 },
      ],
      totalMarks: 50,
      instructions: "+2 for correct, -0.5 for incorrect.",
    },
    {
      sectionLetter: "III",
      sectionTitle: "Quantitative Aptitude",
      questionTypes: [
        { type: "MCQ", marksPerQuestion: 2, count: 25, negativeMarking: -0.5 },
      ],
      totalMarks: 50,
      instructions: "+2 for correct, -0.5 for incorrect.",
    },
    {
      sectionLetter: "IV",
      sectionTitle: "English Comprehension",
      questionTypes: [
        { type: "MCQ", marksPerQuestion: 2, count: 25, negativeMarking: -0.5 },
      ],
      totalMarks: 50,
      instructions: "+2 for correct, -0.5 for incorrect.",
    },
  ],
  gradeLevels: ["Undergraduate", "Postgraduate"],
  negativeMarking: true,
  examMode: "online",
  gradingStandard: "SSC Government",
  officialSource: "https://ssc.gov.in/",
  lastVerified: "2026-07-17",
};

const BANK_PO_BLUEPRINT: BoardBlueprint = {
  boardId: "Bank PO",
  boardName: "IBPS Bank PO (Prelims)",
  boardAbbreviation: "Bank PO",
  category: "government",
  academicYear: "2025-26",
  totalTheoryMarks: 100,
  totalQuestions: 100,
  durationMinutes: 60,
  sections: [
    {
      sectionLetter: "I",
      sectionTitle: "English Language",
      questionTypes: [
        { type: "MCQ", marksPerQuestion: 1, count: 30, negativeMarking: -0.25 },
      ],
      totalMarks: 30,
      instructions: "Sectional time: 20 minutes. +1 correct, -0.25 incorrect.",
    },
    {
      sectionLetter: "II",
      sectionTitle: "Quantitative Aptitude",
      questionTypes: [
        { type: "MCQ", marksPerQuestion: 1, count: 35, negativeMarking: -0.25 },
      ],
      totalMarks: 35,
      instructions: "Sectional time: 20 minutes. +1 correct, -0.25 incorrect.",
    },
    {
      sectionLetter: "III",
      sectionTitle: "Reasoning Ability",
      questionTypes: [
        { type: "MCQ", marksPerQuestion: 1, count: 35, negativeMarking: -0.25 },
      ],
      totalMarks: 35,
      instructions: "Sectional time: 20 minutes. +1 correct, -0.25 incorrect.",
    },
  ],
  gradeLevels: ["Undergraduate", "Postgraduate"],
  negativeMarking: true,
  examMode: "online",
  gradingStandard: "IBPS Bank PO",
  officialSource: "https://ibps.in/",
  lastVerified: "2026-07-17",
};

const NDA_BLUEPRINT: BoardBlueprint = {
  boardId: "NDA",
  boardName: "National Defence Academy Entrance",
  boardAbbreviation: "NDA",
  category: "government",
  academicYear: "2025-26",
  totalTheoryMarks: 900,
  totalQuestions: 270,
  durationMinutes: 300, // 2.5 hours per paper
  sections: [
    {
      sectionLetter: "I",
      sectionTitle: "Mathematics",
      questionTypes: [
        { type: "MCQ", marksPerQuestion: 2.5, count: 120, negativeMarking: -0.83 },
      ],
      totalMarks: 300,
      instructions: "+2.5 for correct, -0.83 for incorrect (1/3rd penalty). Duration: 2.5 hours.",
    },
    {
      sectionLetter: "II",
      sectionTitle: "General Ability Test",
      questionTypes: [
        { type: "MCQ", marksPerQuestion: 4, count: 150, negativeMarking: -1.33 },
      ],
      totalMarks: 600,
      instructions: "+4 for correct, -1.33 for incorrect (1/3rd penalty). Duration: 2.5 hours.",
    },
  ],
  gradeLevels: ["Grade 12", "Undergraduate"],
  negativeMarking: true,
  examMode: "offline",
  gradingStandard: "UPSC NDA",
  officialSource: "https://upsc.gov.in/",
  lastVerified: "2026-07-17",
};

// -----------------------------------------------------------------------------
// Master Registry & Lookup
// -----------------------------------------------------------------------------

/** All blueprints in a flat array */
export const ALL_BLUEPRINTS: BoardBlueprint[] = [
  // National
  CBSE_BLUEPRINT,
  ICSE_BLUEPRINT,
  // State — existing in dropdown
  MAHARASHTRA_BLUEPRINT,
  TAMILNADU_BLUEPRINT,
  KARNATAKA_BLUEPRINT,
  // State — new additions
  AP_BLUEPRINT,
  TELANGANA_BLUEPRINT,
  KERALA_BLUEPRINT,
  RAJASTHAN_BLUEPRINT,
  GUJARAT_BLUEPRINT,
  WESTBENGAL_BLUEPRINT,
  UP_BLUEPRINT,
  PUNJAB_BLUEPRINT,
  HARYANA_BLUEPRINT,
  MP_BLUEPRINT,
  BIHAR_BLUEPRINT,
  ODISHA_BLUEPRINT,
  ASSAM_BLUEPRINT,
  JHARKHAND_BLUEPRINT,
  UTTARAKHAND_BLUEPRINT,
  CHHATTISGARH_BLUEPRINT,
  GOA_BLUEPRINT,
  // Entrance
  JEE_MAIN_BLUEPRINT,
  JEE_ADVANCED_BLUEPRINT,
  NEET_BLUEPRINT,
  CAT_BLUEPRINT,
  CLAT_BLUEPRINT,
  // Government
  UPSC_BLUEPRINT,
  SSC_CGL_BLUEPRINT,
  BANK_PO_BLUEPRINT,
  NDA_BLUEPRINT,
];

/** Map for O(1) lookup by boardId */
const BLUEPRINT_MAP = new Map<string, BoardBlueprint>(
  ALL_BLUEPRINTS.map((bp) => [bp.boardId, bp])
);

/**
 * Look up a blueprint by the dropdown value (boardId).
 * Returns `null` for "Custom" or unknown boards — caller should fall back to
 * the legacy `calculateQuestionDistribution` heuristic.
 */
export function getBlueprintForBoard(boardId: string): BoardBlueprint | null {
  if (boardId === "Custom") return null;
  return BLUEPRINT_MAP.get(boardId) ?? null;
}

// -----------------------------------------------------------------------------
// Dropdown Option Groups (used by AcuExam UI)
// -----------------------------------------------------------------------------

export interface BoardOptionGroup {
  label: string;
  options: { value: string; display: string }[];
}

export const BOARD_OPTION_GROUPS: BoardOptionGroup[] = [
  {
    label: "National Boards",
    options: [
      { value: "CBSE", display: "CBSE" },
      { value: "ICSE", display: "ICSE / ISC" },
    ],
  },
  {
    label: "State Boards",
    options: [
      { value: "State Board (Maharashtra)", display: "Maharashtra (MSBSHSE)" },
      { value: "State Board (Tamil Nadu)", display: "Tamil Nadu" },
      { value: "State Board (Karnataka)", display: "Karnataka (KSEAB)" },
      { value: "State Board (Andhra Pradesh)", display: "Andhra Pradesh" },
      { value: "State Board (Telangana)", display: "Telangana" },
      { value: "State Board (Kerala)", display: "Kerala (KBPE)" },
      { value: "State Board (Rajasthan)", display: "Rajasthan (RBSE)" },
      { value: "State Board (Gujarat)", display: "Gujarat (GSEB)" },
      { value: "State Board (West Bengal)", display: "West Bengal (WBBSE)" },
      { value: "State Board (Uttar Pradesh)", display: "UP Board (UPMSP)" },
      { value: "State Board (Punjab)", display: "Punjab (PSEB)" },
      { value: "State Board (Haryana)", display: "Haryana (HBSE)" },
      { value: "State Board (Madhya Pradesh)", display: "MP Board (MPBSE)" },
      { value: "State Board (Bihar)", display: "Bihar (BSEB)" },
      { value: "State Board (Odisha)", display: "Odisha (CHSE)" },
      { value: "State Board (Assam)", display: "Assam (SEBA)" },
      { value: "State Board (Jharkhand)", display: "Jharkhand (JAC)" },
      { value: "State Board (Uttarakhand)", display: "Uttarakhand (UBSE)" },
      { value: "State Board (Chhattisgarh)", display: "Chhattisgarh (CGBSE)" },
      { value: "State Board (Goa)", display: "Goa (GBSHSE)" },
    ],
  },
  {
    label: "Entrance Exams",
    options: [
      { value: "JEE Main", display: "JEE Main" },
      { value: "JEE Advanced", display: "JEE Advanced" },
      { value: "NEET", display: "NEET (Medical)" },
      { value: "CAT", display: "CAT (Management)" },
      { value: "CLAT", display: "CLAT (Law)" },
    ],
  },
  {
    label: "Government Exams",
    options: [
      { value: "UPSC CSE", display: "UPSC Civil Services" },
      { value: "SSC CGL", display: "SSC CGL" },
      { value: "Bank PO", display: "Bank PO (IBPS)" },
      { value: "NDA", display: "NDA Entrance" },
    ],
  },
  {
    label: "Other",
    options: [
      { value: "Custom", display: "Custom / Legacy" },
    ],
  },
];

// -----------------------------------------------------------------------------
// Subject-Aware Instruction Generator
// -----------------------------------------------------------------------------

/**
 * Returns subject-specific instructions to inject into the Gemini prompt.
 * These guide the AI to produce contextually appropriate question types
 * (e.g. numerical problems for Maths, not essay-type questions).
 */
export function getSubjectSpecificInstructions(subject: string): string {
  const s = subject.toLowerCase();

  if (s.includes("math") || s.includes("maths") || s.includes("mathematics") || s.includes("algebra") || s.includes("geometry") || s.includes("calculus")) {
    return `
[SUBJECT-SPECIFIC RULES — Mathematics]
- For Short and Long Answer questions: Generate NUMERICAL PROBLEMS, SUMS, and EXERCISES
  similar to textbook chapter exercises. Students must SOLVE and SHOW working steps.
- For MCQs: Prefer calculation-based MCQs (e.g., "Find the value of...", "Solve for x...").
  Keep pure theory/definition MCQs to a maximum of 20% of total MCQs.
- Avoid essay-type or purely descriptive questions. Maths papers test problem-solving, not writing.
- Include diagram-based questions where relevant (geometry, graphs, coordinate geometry).
- Grading rubrics must award marks for intermediate steps, not just final answers.
- Where possible, match the style of problems found in textbook chapter exercises.
`;
  }

  if (s.includes("physics")) {
    return `
[SUBJECT-SPECIFIC RULES — Physics]
- For Short and Long Answer questions: Prioritize NUMERICAL PROBLEMS and DERIVATIONS.
  At least 50% of SA/LA marks should be numerical/derivation questions.
- For MCQs: Mix conceptual MCQs with calculation-based MCQs (roughly 50-50).
- Include diagram-based questions (circuit diagrams, ray diagrams, force diagrams) where relevant.
- Grading rubrics must specify marks for formula, substitution, calculation, and units separately.
- Questions should test both mathematical ability and conceptual understanding of physical principles.
`;
  }

  if (s.includes("chemistry") || s.includes("chem")) {
    return `
[SUBJECT-SPECIFIC RULES — Chemistry]
- Balance between numerical problems (molarity, stoichiometry, electrochemistry)
  and conceptual questions (reactions, mechanisms, properties).
- MCQs should test both factual recall (elements, compounds) and application (predict products).
- Include balanced chemical equation questions and name-reaction identification.
- For organic chemistry: include reaction mechanisms and conversion chains.
- Grading rubrics should award marks for correct equations, products, and explanations separately.
`;
  }

  if (s.includes("biology") || s.includes("bio") || s.includes("botany") || s.includes("zoology") || s.includes("life science")) {
    return `
[SUBJECT-SPECIFIC RULES — Biology]
- Focus on conceptual understanding, diagram-based questions, and process descriptions.
- MCQs should test factual recall AND application (e.g., "Which of the following would happen if...").
- Include diagram-labeling, flowchart, and "reason/explain" type questions.
- Long answers should ask students to explain biological processes with examples.
- Where relevant, include questions on experimental observations and their interpretations.
`;
  }

  if (s.includes("history") || s.includes("civics") || s.includes("political science") || s.includes("economics") || s.includes("geography") || s.includes("social science") || s.includes("social studies")) {
    return `
[SUBJECT-SPECIFIC RULES — Social Science / Humanities]
- Include source-based questions (extracts, maps, images, data tables) for case-based sections.
- MCQs should test factual recall and chronological/conceptual understanding.
- Short answers should ask for explanations, comparisons, and cause-effect analysis.
- Long answers should require structured essay-type responses with specific examples and dates.
- For Geography: include map-based and data-interpretation questions.
- For Economics: include data analysis, graph interpretation, and calculation-based questions.
`;
  }

  if (s.includes("english") || s.includes("hindi") || s.includes("language") || s.includes("tamil") || s.includes("marathi") || s.includes("kannada") || s.includes("telugu") || s.includes("bengali") || s.includes("malayalam") || s.includes("urdu") || s.includes("sanskrit") || s.includes("gujarati") || s.includes("punjabi") || s.includes("literature")) {
    return `
[SUBJECT-SPECIFIC RULES — Language / Literature]
- Include comprehension passages (unseen and from text), grammar exercises,
  and creative writing prompts.
- MCQs should focus on grammar, vocabulary, and reading comprehension.
- Short answers should include factual/inferential questions from text excerpts.
- Long answers should include essay writing, letter writing, or detailed text analysis.
- For literature sections: ask for character analysis, theme exploration, and critical appreciation.
`;
  }

  if (s.includes("computer") || s.includes("information") || s.includes("programming") || s.includes("it")) {
    return `
[SUBJECT-SPECIFIC RULES — Computer Science / IT]
- Include code-writing and output-prediction questions for Short and Long Answers.
- MCQs should cover both theory (concepts, terminology) and practical (code output, error detection).
- Include questions that require writing algorithms, pseudocode, or program snippets.
- For database topics, include SQL query writing questions.
- Grading rubrics should evaluate logic correctness, not just syntax.
`;
  }

  if (s.includes("account") || s.includes("commerce") || s.includes("business")) {
    return `
[SUBJECT-SPECIFIC RULES — Commerce / Accounts / Business Studies]
- For Accountancy: Include journal entries, ledger preparation, and financial statement questions.
  These should be numerical and calculation-heavy, not theoretical.
- For Business Studies: Include case-based questions about real-world business scenarios.
- MCQs should test conceptual understanding of business principles and accounting standards.
- Grading rubrics for accounts questions should award marks for format, entries, and totals separately.
`;
  }

  // Default: no special subject rules
  return "";
}
