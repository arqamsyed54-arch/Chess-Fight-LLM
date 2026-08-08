'use client';

import { useEffect, useState } from 'react';
import ChatShell from '@/components/ChatShell';
import type { ChatMessage } from '@/components/ChatShell';
import { Card } from '@/components/FormControls';
import { APP_STORE } from '@/lib/data/store';
import type { Paper } from '@/lib/data/types';

const CREDITS_PER_PAPER = 30;
const CREDITS_START = 4850;

const MODELS = [
  { id: 'gemini', label: 'Gemini 2.5 Flash' },
  { id: 'openai', label: 'OpenAI GPT-4o' },
  { id: 'groq', label: 'Groq Llama 4' },
] as const;

const EFFORTS = ['Low', 'Medium', 'High'] as const;

type Effort = (typeof EFFORTS)[number];

const INTRO: ChatMessage = {
  id: 'intro',
  role: 'assistant',
  content:
    'Hi! I’m your SinkWake assistant — connected read-only to your workspace data (papers, subjects, credits). Ask me “how many papers have I generated?”, “which subjects have I covered?”, or “how many credits do I have left?”.',
  ts: Date.now(),
};

interface DataContext {
  papers: Paper[];
  creditsUsed: number;
  creditsLeft: number;
}

function loadContext(): DataContext {
  const papers = APP_STORE.getPapers();
  return {
    papers,
    creditsUsed: papers.length * CREDITS_PER_PAPER,
    creditsLeft: Math.max(0, CREDITS_START - papers.length * CREDITS_PER_PAPER),
  };
}

function mostCommon(values: string[]): string {
  const counts = new Map<string, number>();
  values.forEach((v) => counts.set(v, (counts.get(v) || 0) + 1));
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || '—';
}

function decorate(content: string, model: string, effort: Effort): string {
  return `${content}\n\n— ${model} • effort ${effort}`;
}

async function respond(
  userText: string,
  ctx: DataContext,
  model: string,
  effort: Effort,
): Promise<{ content: string; matched: boolean }> {
  await new Promise((resolve) => setTimeout(resolve, 700));
  const text = userText.toLowerCase();
  const papers = ctx.papers;

  if (/(how many|count of|total).*papers?/.test(text) || /papers?.*(generated|made|created)/.test(text)) {
    if (papers.length === 0) {
      return {
        matched: true,
        content: decorate(
          'You haven’t generated any papers yet — use the Generate Paper wizard to create your first one and this answer will update instantly.',
          model,
          effort,
        ),
      };
    }
    const byDifficulty = new Map<string, number>();
    papers.forEach((p) => byDifficulty.set(p.difficulty, (byDifficulty.get(p.difficulty) || 0) + 1));
    const breakdown = [...byDifficulty.entries()].map(([level, count]) => `${level}: ${count}`).join(', ');
    const core = `You have generated **${papers.length} paper${papers.length === 1 ? '' : 's'}** in total (${breakdown}). This used ${ctx.creditsUsed} credits.`;
    const extra =
      effort === 'High'
        ? `\n\nSuggestions: keep the strongest subject rotating, and reuse the Standard template as a default to save review time.`
        : '';
    return { matched: true, content: decorate(core + extra, model, effort) };
  }

  if (/subject/.test(text) || /cover/.test(text) || /topics/.test(text)) {
    if (papers.length === 0) {
      return {
        matched: true,
        content: decorate('No papers yet, so no subjects to report. Generate a paper first.', model, effort),
      };
    }
    const counts = new Map<string, number>();
    papers.forEach((p) => counts.set(p.subject, (counts.get(p.subject) || 0) + 1));
    const lines = [...counts.entries()].map(([subject, count]) => `${subject}: ${count} paper${count === 1 ? '' : 's'}`);
    const core = `You've covered **${counts.size} subject${counts.size === 1 ? '' : 's'}** so far:\n${lines.join('\n')}`;
    const extra = effort === 'High' ? '\n\nHint: question-bank entries already exist for these subjects if you want to reuse them.' : '';
    return { matched: true, content: decorate(core + extra, model, effort) };
  }

  if (/credit|balance|left/.test(text)) {
    const core = `You started with ${CREDITS_START} credits. Each paper costs ${CREDITS_PER_PAPER} credits, so you've spent **${ctx.creditsUsed}** and have **${ctx.creditsLeft}** remaining.`;
    const extra = effort === 'High' ? '\n\nWhen balance approaches zero, upgrade on the Pricing page to keep generating without interruption.' : '';
    return { matched: true, content: decorate(core, model, effort) };
  }

  if (/marks|difficulty/.test(text)) {
    const totalMarks = papers.reduce((sum, p) => sum + p.totalMarks, 0);
    const totalQuestions = papers.reduce((sum, p) => sum + p.totalQuestions, 0);
    const core = `Across all papers you've authored **${totalMarks} marks** of content (${totalQuestions} questions). Most-used difficulty: **${mostCommon(papers.map((p) => p.difficulty))}**.`;
    const extra = effort === 'High' ? `\n\nAverage paper size: ${totalQuestions ? (totalQuestions / Math.max(1, papers.length)).toFixed(1) : '0'} questions.` : '';
    return { matched: true, content: decorate(core, model, effort) };
  }

  if (/recent|latest|last/.test(text)) {
    if (papers.length === 0) {
      return { matched: true, content: decorate('No papers yet — nothing to list.', model, effort) };
    }
    const recent = papers
      .slice(0, 3)
      .map((p) => `• ${p.title} — ${new Date(p.createdAt).toLocaleDateString()}`)
      .join('\n');
    return { matched: true, content: decorate(`Your most recent papers:\n${recent}`, model, effort) };
  }

  if (/delete|clear|reset/.test(text)) {
    return {
      matched: true,
      content: decorate('History clearing is coming with the database migration; today your papers live in your browser workspace and can be cleared from it.', model, effort),
    };
  }

  if (/help|what can you|suggestions?/.test(text)) {
    return {
      matched: true,
      content: decorate(
        "I answer from your real workspace data. Try:\n• “How many papers have I generated?”\n• “Which subjects have I covered?”\n• “How many credits do I have left?”\n• “Show my recent papers”\n• “What's my most common difficulty?”",
        model,
        effort,
      ),
    };
  }

  if (effort === 'Low') {
    return { matched: true, content: decorate('I can only answer from your account data. Ask about papers count, subjects, credits, marks, or recent activity.', model, effort) };
  }
  return {
    matched: true,
    content: decorate(
      'I can only answer from your account data (papers, subjects, marks, credits) — I’m not a general-purpose bot. Ask me “how many papers have I generated?” or pick one of the suggestion chips.',
      model,
      effort,
    ),
  };
}

export default function AssistantPage() {
  const [modelId, setModelId] = useState('gemini');
  const [effort, setEffort] = useState<Effort>('Medium');

  useEffect(() => {
    const savedModel = localStorage.getItem('eah_chat_model');
    const savedEffort = localStorage.getItem('eah_chat_effort');
    if (savedModel) setModelId(savedModel);
    if (savedEffort === 'Low' || savedEffort === 'Medium' || savedEffort === 'High') setEffort(savedEffort);
  }, []);

  const chooseModel = (id: string) => {
    setModelId(id);
    localStorage.setItem('eah_chat_model', id);
  };
  const chooseEffort = (level: Effort) => {
    setEffort(level);
    localStorage.setItem('eah_chat_effort', level);
  };

  const currentModel = MODELS.find((m) => m.id === modelId) || MODELS[0];

  return (
    <Card title="AI Assistant" subtitle="Scoped to your workspace — answers computed from your real generation data.">
      <ChatShell
        threadKey="assistant"
        intro={INTRO}
        placeholder="Ask about your papers, subjects, credits…"
        suggestions={[
          'How many papers have I generated?',
          'Which subjects have I covered?',
          'How many credits do I have left?',
          'Show my recent papers',
        ]}
        onRespond={(text) => respond(text, loadContext(), currentModel.label, effort)}
        footer={
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2">
              <span className="text-[12px] font-semibold text-on-surface-variant">Model</span>
              <select
                value={modelId}
                onChange={(e) => chooseModel(e.target.value)}
                className="rounded-xl border border-outline-variant bg-surface px-3 py-2 text-[13px] font-semibold text-on-surface outline-none focus:border-primary cursor-pointer"
              >
                {MODELS.map((m) => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </select>
            </label>
            <div className="flex items-center gap-2">
              <span className="text-[12px] font-semibold text-on-surface-variant">Effort</span>
              <div className="flex rounded-xl border border-outline-variant overflow-hidden">
                {EFFORTS.map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => chooseEffort(level)}
                    className={`px-3.5 py-2 text-[12px] font-bold transition ${
                      effort === level ? 'bg-primary text-white' : 'bg-surface text-on-surface-variant hover:text-primary'
                    }`}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>
            <p className="ml-auto text-[11px] text-on-surface-variant hidden sm:block">
              Effort controls response detail and answer budget.
            </p>
          </div>
        }
      />
    </Card>
  );
}