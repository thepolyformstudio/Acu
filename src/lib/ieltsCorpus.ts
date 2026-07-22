export interface IELTSBenchmarkPaper {
  id: string;
  title: string;
  maxMarks: number;
  durationMinutes: number;
  subject: string;
  documentId: string;
  chapterName: string;
  sections: {
    section_letter: string;
    instructions: string;
    marks_per_question: number;
    questions: {
      id: string;
      question_text: string;
      question_type: string;
      marks: number;
      options?: { key: string; text: string }[];
      model_answer: string;
      grading_rubric: string;
    }[];
  }[];
}

export const CAMBRIDGE_19_BENCHMARK_PAPER: IELTSBenchmarkPaper = {
  id: "cambridge_19_test_1",
  title: "Cambridge IELTS 19 Official Benchmark Practice Test",
  maxMarks: 40,
  durationMinutes: 120,
  subject: "IELTS (English Proficiency)",
  documentId: "ielts_md_corpus",
  chapterName: "Cambridge IELTS 19 Academic Test 1",
  sections: [
    {
      section_letter: "A",
      instructions: "READING PASSAGE 1: How tennis rackets have changed\n\nTennis plays a big part in modern sports history, and the evolution of tennis equipment, especially the racket, reflects major technological advances over the past century. Early rackets were handcrafted from solid wood, usually ash or mahogany, making them heavy, inflexible, and easily prone to warping when exposed to moisture. Stringing was accomplished using natural gut derived from cow intestines, providing superb elasticity but requiring meticulous maintenance. In the 1960s, metal frames forged from steel and aluminum revolutionized player stroke power, paving the way for graphite composite materials in the 1980s. Modern carbon-fiber rackets feature enlarged sweet spots, aerodynamic head shapes, and specialized string patterns designed to maximize topspin and ball velocity.",
      marks_per_question: 1,
      questions: [
        {
          id: "q_1",
          question_text: "True / False / Not Given: Early tennis racket frames were made primarily from solid hardwoods like ash.",
          question_type: "True-False",
          marks: 1,
          options: [
            { key: "True", text: "TRUE — Statement matches passage text" },
            { key: "False", text: "FALSE — Statement contradicts passage" },
            { key: "Not Given", text: "NOT GIVEN — Information not mentioned in text" }
          ],
          model_answer: "True",
          grading_rubric: "1 Mark awarded if candidate selects True matching passage paragraph 1."
        },
        {
          id: "q_2",
          question_text: "True / False / Not Given: Natural gut stringing was resistant to moisture damage and required no care.",
          question_type: "True-False",
          marks: 1,
          options: [
            { key: "True", text: "TRUE — Statement matches passage text" },
            { key: "False", text: "FALSE — Statement contradicts passage" },
            { key: "Not Given", text: "NOT GIVEN — Information not mentioned in text" }
          ],
          model_answer: "False",
          grading_rubric: "1 Mark for False (passage explicitly states gut required meticulous maintenance and wood/strings warped with moisture)."
        },
        {
          id: "q_3",
          question_text: "Complete note with NO MORE THAN THREE WORDS: Metal frames in the 1960s were forged from steel and __________.",
          question_type: "VSA",
          marks: 1,
          model_answer: "aluminum",
          grading_rubric: "1 Mark awarded for exact word 'aluminum' or 'aluminium'."
        },
        {
          id: "q_4",
          question_text: "Complete note with NO MORE THAN THREE WORDS: Modern carbon-fiber rackets feature enlarged sweet spots and specialized __________ to maximize topspin.",
          question_type: "VSA",
          marks: 1,
          model_answer: "string patterns",
          grading_rubric: "1 Mark awarded for exact phrase 'string patterns'."
        }
      ]
    },
    {
      section_letter: "B",
      instructions: "WRITING MODULE: Complete Task 1 (Data/Process Report - min 150 words) and Task 2 (Discursive Essay - min 250 words).",
      marks_per_question: 5,
      questions: [
        {
          id: "q_5",
          question_text: "Writing Task 1 (Academic / GT): The chart below shows the percentage of international students enrolled in higher education across four English-speaking countries between 2010 and 2024. Summarise the information by selecting and reporting the main features, and make comparisons where relevant. (Write at least 150 words).",
          question_type: "SA",
          marks: 3,
          model_answer: "The bar chart illustrates trends in international student enrollment across Australia, Canada, the UK, and the US from 2010 to 2024. Overall, Canada experienced the sharpest upward trajectory, rising from 12% to 28% of total student bodies. Australia maintained a consistently high proportion around 22%-25%, whereas the US saw a gradual decline post-2018. To summarize, North American and Australasian universities witnessed significant growth in overseas recruitment, with Canada taking the lead by 2024.",
          grading_rubric: "Band 9 Descriptor: Evaluated on Task Achievement (full overview & data trends), Coherence (logical paragraphs), Lexical Resource (rich academic vocabulary), and Grammatical Accuracy."
        },
        {
          id: "q_6",
          question_text: "Writing Task 2 (Essay): Some people believe that artificial intelligence will replace human teachers in schools, while others argue that the role of teachers will remain indispensable. Discuss both views and give your opinion. (Write at least 250 words).",
          question_type: "LA",
          marks: 6,
          model_answer: "The rapid evolution of artificial intelligence has sparked intense debate over the future of pedagogy. While AI systems offer personalized learning paths and automated feedback, I firmly believe that human educators remain irreplaceable due to their capacity for emotional intelligence, mentorship, and ethical guidance.\n\nOn the one hand, AI tutors can analyze vast datasets to tailor lesson plans to individual learning speeds. For example, intelligent algorithms can pinpoint student weakness in real-time, providing targeted exercises. Furthermore, automated grading relieves administrative burdens, allowing educational institutions to scale.\n\nHowever, education extends far beyond information delivery. Human teachers cultivate empathy, critical thinking, and social collaboration—attributes no machine can replicate. A teacher acts as a role model, providing moral support during formative years. In conclusion, while AI can enhance technical instruction, human teachers are indispensable for holistic personal development.",
          grading_rubric: "Band 9 Descriptor: Evaluated on Task Response (clear position & fully developed paragraphs), Coherence, Vocabulary range, and Complex grammatical structures."
        }
      ]
    },
    {
      section_letter: "C",
      instructions: "LISTENING MODULE (Section 1 Audio Transcript):\n\n[Audio Transcript — Hinchingbrooke Country Park Information Desk]\nOfficer: Good morning, Hinchingbrooke Park visitor center. How can I help you?\nVisitor: Hello! I'm planning an educational trip for a primary school group and wanted to ask about your wetland and grassland habitats.\nOfficer: Excellent! Our park spans over 70 hectares featuring woodland, grassland, and wetland habitats. The wetland area includes two large lakes, three ponds, and a stream where children can study aquatic wildlife.\nVisitor: That sounds great. What subjects do you cover in your school visits?\nOfficer: For Science, pupils examine interactive displays about native plants. For Geography, they learn navigation using a detailed map and compass.",
      marks_per_question: 1,
      questions: [
        {
          id: "q_7",
          question_text: "Listening Item 1: What is the total area of Hinchingbrooke Country Park in hectares?",
          question_type: "VSA",
          marks: 1,
          model_answer: "70",
          grading_rubric: "1 Mark awarded for exact number '70' or '70 hectares'."
        },
        {
          id: "q_8",
          question_text: "Listening Item 2: Besides two large lakes and three ponds, the wetland habitat includes a __________.",
          question_type: "VSA",
          marks: 1,
          model_answer: "stream",
          grading_rubric: "1 Mark awarded for exact word 'stream'."
        },
        {
          id: "q_9",
          question_text: "Listening Item 3: In Geography visits, pupils learn navigation using a map and a __________.",
          question_type: "VSA",
          marks: 1,
          model_answer: "compass",
          grading_rubric: "1 Mark awarded for exact word 'compass'."
        }
      ]
    },
    {
      section_letter: "D",
      instructions: "SPEAKING MODULE (3 Parts):\n\nPart 1: Personal Interview (4-5 mins)\nPart 2: Individual Cue Card Prompt (1 min prep, 2 mins speech)\nPart 3: Deep Discussion (4-5 mins)",
      marks_per_question: 3,
      questions: [
        {
          id: "q_10",
          question_text: "Speaking Part 1: Tell me about your hometown. What is the most interesting place for visitors to see in your hometown?",
          question_type: "VSA",
          marks: 2,
          model_answer: "I come from a coastal city known for its historic harbor and vibrant street markets. Visitors love exploring the ancient seaside fortress which offers panoramic views of the bay.",
          grading_rubric: "Evaluated on Fluency, Clear Pronunciation, Lexical Variety, and Grammatical Range."
        },
        {
          id: "q_11",
          question_text: "Speaking Part 2 (Cue Card):\nDescribe a sporting event or athletic competition you enjoyed watching.\nYou should say:\n- What the event was\n- Where and when you watched it\n- Who you watched it with\nAnd explain why you found this sporting event so memorable.",
          question_type: "SA",
          marks: 3,
          model_answer: "I would like to talk about the final match of the World Tennis Championship which I watched live in London last summer. I went with my older brother who is an avid tennis enthusiast. The atmosphere inside the arena was electric as the two top-ranked players battled through five intense sets. What made it unforgettable was the sheer resilience and sportsmanship displayed by both athletes under high-pressure conditions.",
          grading_rubric: "Evaluated on 1-2 minute continuous speech fluency, structured narrative, advanced vocabulary, and precise pronunciation."
        },
        {
          id: "q_12",
          question_text: "Speaking Part 3: Do you think international sporting events help promote world peace and understanding between nations? Why or why not?",
          question_type: "LA",
          marks: 4,
          model_answer: "Undoubtedly, global sporting spectacles like the Olympic Games foster cultural exchange and mutual respect. When athletes from diverse backgrounds compete on a shared platform, it transcends geopolitical boundaries and unites fans around shared human values.",
          grading_rubric: "Evaluated on abstract reasoning, complex cohesive devices, lexical resource, and grammatical accuracy."
        }
      ]
    }
  ]
};
