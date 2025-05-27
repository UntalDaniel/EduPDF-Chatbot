// src/types/examTypes.ts

// Interfaz para preguntas de Verdadero/Falso que se mostrarán en el frontend
export interface TrueFalseQuestion {
  id: string;
  text: string; // El texto de la pregunta
  type: "V_F"; // Tipo de pregunta
  correct_answer: boolean; // La respuesta correcta (true o false)
  explanation?: string; // Explicación opcional
}

// Interfaz para preguntas de Opción Múltiple que se mostrarán en el frontend
export interface MultipleChoiceQuestion {
  id: string;
  text: string; // El texto de la pregunta
  type: "MC"; // Tipo de pregunta
  options: string[]; // Lista de opciones de respuesta
  correct_answer_index: number; // Índice (0-based) de la opción correcta en la lista 'options'
  explanation?: string; // Explicación opcional
}

// Tipo unión para representar cualquier tipo de pregunta en el frontend
export type Question = TrueFalseQuestion | MultipleChoiceQuestion;

// Configuración para la cantidad de preguntas por tipo
export interface QuestionConfig {
  vf_questions: number; // Número de preguntas Verdadero/Falso
  mc_questions: number; // Número de preguntas Opción Múltiple
  // Futuro: open_questions, fill_in_the_blanks_questions
}

// Datos para la solicitud de generación de examen desde el frontend al backend
export interface ExamGenerationRequestData {
  pdf_id: string; // ID del PDF base para el examen
  title: string; // Título del examen
  question_config: QuestionConfig; // Configuración de tipos y cantidad de preguntas
  difficulty: "facil" | "medio" | "dificil"; // Nivel de dificultad
  language: string; // Idioma para las preguntas (ej. "es", "en")
  model_id?: string; // Modelo de IA a utilizar (opcional, el backend tiene un default)
}

// Datos del examen generado que el backend devuelve al frontend
export interface GeneratedExamData {
  pdf_id: string; // ID del PDF base del examen
  title: string; // Título del examen
  difficulty: "facil" | "medio" | "dificil"; // Dificultad del examen
  questions: Question[]; // Lista de preguntas generadas
  error?: string; // Campo para mensajes de error si la generación falla parcial o totalmente
}

// (Opcional) Interfaz para guardar un examen en Firestore desde el frontend
export interface ExamForFirestore {
  userId: string; // ID del usuario que crea el examen
  pdfId: string; // ID del PDF asociado
  title: string; // Título del examen
  difficulty: "facil" | "medio" | "dificil"; // Dificultad
  config: QuestionConfig; // Configuración de preguntas utilizada
  questions: Question[]; // Las preguntas generadas (tal como se muestran en el frontend)
  createdAt: any; // Timestamp de Firestore para la fecha de creación
  language?: string; // Idioma del examen (opcional)
  model_id_used?: string; // Modelo de IA utilizado (opcional)
}
