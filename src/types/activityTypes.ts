// Tipos para actividades
export enum ActivityType {
  WORD_SEARCH = 'WORD_SEARCH',
  CROSSWORD = 'CROSSWORD',
  WORD_CONNECTION = 'WORD_CONNECTION'
}

export interface WordSearchData {
  words: string[];
  grid: string[][];
  solution: string[][];
}

export interface CrosswordClue {
  number: number;
  clue: string;
  answer: string;
  row: number;
  col: number;
  direction: 'across' | 'down';
}

export interface CrosswordData {
  grid: string[][];
  solution: string[][];
  clues: { number: number; direction: 'across' | 'down'; clue: string; answer: string }[];
}

export interface WordConnectionData {
  words?: string[];
  definitions?: string[];
  connections?: Array<{
    word1?: string;
    word2?: string;
    connection?: string;
    term?: string;
    definition?: string;
    relation?: string;
    description?: string;
  }>;
  pairs?: Array<{
    term?: string;
    definition?: string;
    relation?: string;
    description?: string;
  }>;
}

export interface BaseActivity {
  id: string;
  type: ActivityType;
  title: string;
  description: string;
  pdfId: string;
  createdAt: Date;
  updatedAt: Date;
  userId: string;
}

export interface WordSearchActivity extends BaseActivity {
  type: ActivityType.WORD_SEARCH;
  data: WordSearchData;
}

export interface CrosswordActivity extends BaseActivity {
  type: ActivityType.CROSSWORD;
  data: CrosswordData;
}

export interface WordConnectionActivity extends BaseActivity {
  type: ActivityType.WORD_CONNECTION;
  data: WordConnectionData;
}

export type ActivityTypeActivity = WordSearchActivity | CrosswordActivity | WordConnectionActivity;

export interface ActivityAttempt {
  id: string;
  activityId: string;
  userId: string;
  score: number;
  completed: boolean;
  startedAt: Date;
  completedAt: Date;
  answers: Record<string, any>;
}

// Tipos para herramientas
export interface ConceptMapData {
  nodes: {
    id: string;
    label: string;
    type: 'concept' | 'subconcept';
  }[];
  edges: {
    id: string;
    source: string;
    target: string;
    label: string;
  }[];
}

export interface MindMapData {
  nodes: {
    id: string;
    label: string;
    type: 'main' | 'subtopic' | 'detail';
  }[];
  edges: {
    id: string;
    source: string;
    target: string;
  }[];
}

export type WordSearchDirection = 'horizontal' | 'vertical' | 'diagonal';

export interface WordSearchWord {
  word: string;
  hint: string;
  found: boolean;
}

// Asociación de conceptos
export interface MatchConceptsData {
  words: string[];
  concepts: string[];
  pairs: { word: string; concept: string }[];
} 