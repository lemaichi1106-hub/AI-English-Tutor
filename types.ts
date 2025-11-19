export enum AppState {
  HOME = 'HOME',
  LESSON_PREVIEW = 'LESSON_PREVIEW',
  PRACTICE_CHAT = 'PRACTICE_CHAT',
  ASSESSMENT = 'ASSESSMENT',
}

export interface Topic {
  id: string;
  title: string;
  description: string;
  icon: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
}

export interface LessonContent {
  topic: string;
  vocabulary: { 
    word: string; 
    translation: string; 
    context: string;
    phonetic: string;
    pronunciationTip: string;
  }[];
  patterns: { pattern: string; example: string; translation: string }[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
  pronunciationFeedback?: string | null;
}

export interface ChatResponse {
  text: string;
  pronunciationFeedback?: string | null;
  suggestions?: string[];
}

export interface AssessmentResult {
  scores: {
    grammar: number;
    vocabulary: number;
    fluency: number;
  };
  feedback: string;
  corrections: {
    original: string;
    correction: string;
    explanation: string;
  }[];
  overallComment: string;
}

export interface SpeechState {
  isListening: boolean;
  transcript: string;
  isSupported: boolean;
}