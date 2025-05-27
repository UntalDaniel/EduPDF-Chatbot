// src/types/examTypes.ts

export interface TrueFalseQuestion {
  id: string;
  text: string;
  type: "V_F";
  correct_answer: boolean;
  explanation?: string;
}

export interface MultipleChoiceQuestion {
  id: string;
  text: string;
  type: "MC";
  options: string[];
  correct_answer: string; // El texto de la opción correcta
  explanation?: string;
}

export type Question = TrueFalseQuestion | MultipleChoiceQuestion;

export interface QuestionConfig {
  vf_questions: number;
  mc_questions: number;
  // Futuro: open_questions, fill_in_the_blanks_questions
}

export interface ExamGenerationRequestData {
  pdf_id: string; // O el identificador que uses para el PDF
  sample_text_from_pdf?: string; // Temporal si es necesario para desarrollo del backend
  title: string;
  question_config: QuestionConfig;
  difficulty: "facil" | "medio" | "dificil";
}

export interface GeneratedExamData {
  exam_id?: string; // El backend lo puede retornar null inicialmente
  pdf_id: string;
  title: string;
  difficulty: string;
  questions: Question[];
  // user_id?: string;
}

// Para el guardado en Firestore (simplificado por ahora)
export interface ExamForFirestore {
  userId: string;
  pdfId: string;
  title: string;
  difficulty: "facil" | "medio" | "dificil";
  config: QuestionConfig;
  questions: Question[];
  createdAt: any; // Firestore Timestamp
}

