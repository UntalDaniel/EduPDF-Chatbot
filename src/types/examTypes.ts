// src/types/examTypes.ts
import type { Timestamp, FieldValue } from 'firebase/firestore';

// Asumiendo que ya tienes BaseQuestion y otros tipos definidos.
// Solo mostraré las adiciones y modificaciones relevantes.

export interface BaseQuestion {
  id: string;
  text: string;
  explanation?: string;
  // El 'type' se definirá en los tipos específicos
}

// Actualiza tu QuestionTypeLiteral o como lo tengas definido
export type QuestionTypeLiteral = "V_F" | "MC" | "OPEN" | "FITB"; // <--- AÑADIDO "FITB"

export interface TrueFalseQuestion extends BaseQuestion {
  type: "V_F";
  correct_answer: boolean;
}

export interface MultipleChoiceQuestion extends BaseQuestion {
  type: "MC";
  options: string[];
  correct_answer_index: number;
}

export interface OpenQuestion extends BaseQuestion {
  type: "OPEN";
  // 'explanation' en BaseQuestion puede servir como guía de respuesta
}

// --- NUEVO TIPO DE PREGUNTA PARA COMPLETAR ---
export interface FillInTheBlankQuestion extends BaseQuestion {
  type: "FITB";
  // 'text' contendrá los placeholders, ej: "La capital de __BLANK__ es __BLANK__."
  answers: string[]; // Lista de respuestas correctas en orden
}

// Actualiza tu tipo unión Question
export type Question = TrueFalseQuestion | MultipleChoiceQuestion | OpenQuestion | FillInTheBlankQuestion; // <--- AÑADIDO FillInTheBlankQuestion

// Actualiza tu QuestionConfig
export interface QuestionConfig {
  vf_questions: number;
  mc_questions: number;
  open_questions: number;
  fitb_questions?: number; // <--- AÑADIDO como opcional, o requerido si siempre se envía
}

// Para la solicitud al backend (puede ser diferente a QuestionConfig si es necesario)
// En CreateExamScreen.tsx ya definimos BackendExamGenerationRequest['question_config']
// como Dict[str, int], lo cual es flexible.

// Para la respuesta del backend
export interface GeneratedExamData {
  pdf_id: string;
  title: string;
  difficulty: "facil" | "medio" | "dificil";
  questions: Question[]; // Ya debería manejar el nuevo tipo por la unión
  error?: string;
  config_used?: { // Para reflejar QuestionConfigForExam del backend
    num_true_false?: number;
    num_multiple_choice?: number;
    num_open_questions?: number;
    num_fill_in_the_blank?: number; // <--- AÑADIDO
    difficulty?: "facil" | "medio" | "dificil";
    language?: string;
    model_id?: string;
    user_id?: string;
  };
}

// Para guardar en Firestore
export interface ExamForFirestore {
  id: string;
  pdf_id: string;
  title: string;
  difficulty: 'facil' | 'medio' | 'dificil';
  questions: Question[];
  created_at: Timestamp | FieldValue;
  author_id: string;
  is_assigned: boolean;
  group_id: string | null;
  share_link: string | null;
  google_form_link: string | null;
  is_google_form: boolean;
}

// Otros tipos que puedas tener...
export interface ExamGenerationRequestData {
    pdf_id: string;
    title: string;
    question_config: QuestionConfig; // Asegúrate que este tipo se alinee con lo que envías
    difficulty: 'facil' | 'medio' | 'dificil';
    language: string;
    model_id?: string;
    user_id: string; // Importante
}
