import { QUESTION_BANK } from './questionBank';
import type { Difficulty, GenerationConfig, Paper, Question } from './types';

const TYPE_MARKS: Record<string, number> = {
  'MCQ': 1,
  'True/False': 1,
  'Fill in the Blank': 1,
  'Match the Following': 2,
  'Short Answer': 2,
  'Assertion-Reason': 2,
  'Numerical': 3,
  'Case Study': 4,
  'Diagram-based': 3,
  'Long Answer': 5,
  'Custom': 3,
};

function synthesize(subject: string, difficulty: Difficulty, topic: string): Question[] {
  const texts = [
    `Mention the key formula or concept covered in your notes for ${topic}.`,
    `Briefly justify why "${topic}" matters in ${subject}.`,
    `Give the main difference between two core ideas of ${topic} in ${subject}.`,
    `Explain one common application of ${topic} in everyday life.`,
    `Define ${topic} with one example from ${subject}.`,
  ];
  return texts.map((text, i) => ({
    id: `syn-${subject}-${i}`,
    subject,
    topic,
    difficulty,
    type: 'Short Answer',
    text,
    answer: 'Answer depends on class notes for this topic; refer to the uploaded pages.',
    solution: `Model solution uses the definition of ${topic} in ${subject}.`,
  }));
}

function drawQuestions(cfg: GenerationConfig): Question[] {
  const needed = Math.max(1, cfg.totalQuestions);
  const byId = new Map<string, Question>();
  const poolMu = QUESTION_BANK.filter((question) => question.subject === cfg.subject);
  const matches = poolMu.filter(
    (question) =>
      question.difficulty === cfg.difficulty && cfg.types.includes(question.type),
  );
  const typesPool = poolMu.filter((question) => cfg.types.includes(question.type));
  const fallback = QUESTION_BANK;

  for (let i = 0; i < needed && i < matches.length + typesPool.length + fallback.length; i++) {
    const list =
      i < matches.length ? matches : i < matches.length + typesPool.length ? typesPool : fallback;
    const question = list[i % list.length];
    if (!byId.has(question.id)) byId.set(question.id, { ...question, marks: TYPE_MARKS[question.type] || 1 });
  }

  // fill the rest with synthesized items that reference the chosen topic
  const extras = synthesize(cfg.subject, cfg.difficulty, cfg.subject === '' ? 'topics' : cfg.subject);
  const out = [...byId.values()];
  for (const extra of extras) {
    if (out.length >= needed) break;
    out.push(extra);
  }
  return out.slice(0, needed);
}

function distributeMarks(questions: Question[], total: number): Question[] {
  if (!questions.length) return questions;
  const base = Math.floor(total / questions.length);
  let left = total - base * questions.length;
  return questions.map((question, idx) => {
    const bonus = left > 0 ? 1 : 0;
    if (left > 0) left -= 1;
    return { ...question, marks: Math.max(1, base + bonus) };
  });
}

function fmtQuestion(idx: number, question: Question): string {
  return `${idx + 1}. [${question.marks} mark${question.marks === 1 ? '' : 's'}] ${question.text}`;
}

function buildHeader(cfg: GenerationConfig): string {
  const lines: string[] = [];
  if (cfg.header.schoolName) lines.push(cfg.header.schoolName);
  if (cfg.header.teacherName) lines.push(`Teacher: ${cfg.header.teacherName}`);
  lines.push(`${cfg.subject} — ${cfg.difficulty} (${cfg.purpose})`);
  lines.push(`Total marks: ${cfg.totalMarks} | Total questions: ${cfg.totalQuestions}`);
  if (cfg.header.instructions) lines.push(`Instructions: ${cfg.header.instructions}`);
  if (cfg.otherInstructions) lines.push(`Additional instructions: ${cfg.otherInstructions}`);
  return lines.join('\n');
}

export const TEMPLATES = [
  { id: 'school', name: 'School Letterhead', desc: 'School name and logo prominent at the top, clean marks column.' },
  { id: 'board', name: 'Board-Exam Style', desc: 'Set-style header with instructions box, section headings and time allowed.' },
  { id: 'minimal', name: 'Minimalist', desc: 'Questions only — no decorative header, maximum white space.' },
  { id: 'grid', name: 'Modern Grid', desc: 'Carded question grid with corner marks, aimed at digital-first classrooms.' },
];

export function generateConfigDefault(): GenerationConfig {
  return {
    difficulty: 'Medium',
    purpose: 'Practice',
    images: [],
    subject: '',
    totalMarks: 25,
    totalQuestions: 10,
    types: ['MCQ', 'Short Answer'],
    customQuestions: [],
    templateId: 'school',
    header: { schoolName: '', teacherName: '', instructions: 'Answer all questions.' },
    otherInstructions: '',
  };
}

export function buildPaper(cfg: GenerationConfig): Paper {
  const questions = distributeMarks(
    [
      ...drawQuestions(cfg),
      ...cfg.customQuestions.map((text, i) => ({
        id: `custom-${i}`,
        subject: cfg.subject || 'General',
        topic: 'Custom Question',
        difficulty: cfg.difficulty,
        type: 'Custom',
        text,
        answer: '',
        solution: '',
      })),
    ],
    cfg.totalMarks,
  );

  const header = buildHeader(cfg);

  const question: string = [
    header,
    '',
    ...questions.map((question, idx) => `${idx + 1}. ${question.text} (${question.marks} mark${question.marks === 1 ? '' : 's'})`),
  ].join('\n');

  const answer: string = [
    header,
    '',
    'ANSWER PAPER',
    ...questions.map((question, idx) => `${idx + 1}. ${question.answer || '—'}`),
  ].join('\n');

  const solution: string = [
    header,
    '',
    'SOLUTION PAPER',
    ...questions.map((question, idx) => `Q${idx + 1}. ${question.text}\n   ${question.solution || question.answer || '—'}`),
  ].join('\n');

  return {
    id: Math.random().toString(36).slice(2, 10),
    title: `${cfg.subject} — ${cfg.difficulty} ${cfg.purpose} Paper`,
    subject: cfg.subject,
    difficulty: cfg.difficulty,
    purpose: cfg.purpose,
    totalMarks: cfg.totalMarks,
    totalQuestions: questions.length,
    types: cfg.types,
    createdAt: new Date().toISOString(),
    docs: { question, answer, solution },
  };
}

export function downloadDoc(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename.endsWith('.md') ? filename : `${filename}.md`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}