export type Difficulty =
  | 'Easy'
  | 'Medium'
  | 'Average'
  | 'Moderate'
  | 'Hard'
  | 'Extra Hard';

export interface Question {
  id: string;
  subject: string;
  topic: string;
  difficulty: Difficulty;
  type: string;
  text: string;
  answer: string;
  solution: string;
  marks?: number;
}

export interface PaperDoc {
  question: string;
  answer: string;
  solution: string;
}

export interface Paper {
  id: string;
  title: string;
  subject: string;
  difficulty: string;
  purpose: string;
  totalMarks: number;
  totalQuestions: number;
  types: string[];
  createdAt: string;
  docs: PaperDoc;
}

export interface ApiKey {
  id: string;
  label: string;
  key: string;
  hash?: string;
  createdAt: string;
  revoked: boolean;
  lastUsedAt?: string;
  calls: number;
  creditsUsed: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  ts: number;
}

export interface LoginEvent {
  id: string;
  device: string;
  location: string;
  at: string;
  status: 'success' | 'failed';
}

export interface UserProfile {
  name: string;
  email: string;
  school: string;
  role: string;
}

export interface AppSettings {
  templateId: string;
  defaultDifficulty: Difficulty;
  defaultPurpose: string;
  excludeAnswerKeys: boolean;
  defaultQuestionTypes: string[];
  mcpServerUrl: string;
  mcpEnabled: boolean;
}

export interface TemplateStyle {
  id: string;
  name: string;
  description: string;
  header: string;
  footerNote: string;
}

export interface Ticket {
  id: string;
  subject: string;
  message: string;
  transcript: string;
  status: 'open' | 'resolved';
  createdAt: string;
}

export interface GenerationConfig {
  difficulty: Difficulty;
  purpose: string;
  images: ImageMeta[];
  subject: string;
  totalMarks: number;
  totalQuestions: number;
  types: string[];
  customQuestions: string[];
  templateId: string;
  header: {
    logo?: string;
    schoolName: string;
    teacherName: string;
    instructions: string;
  };
  otherInstructions: string;
}

export interface ImageMeta {
  name: string;
  size: number;
  dataUrl: string;
}