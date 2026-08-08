'use client';

import { useEffect, useRef, useState } from 'react';
import { Card } from '@/components/FormControls';
import { APP_STORE } from '@/lib/data/store';
import type { Paper } from '@/lib/data/types';

const CREDITS_PER_PAPER = 30;
const CREDITS_START = 4850;

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface Context {
  papers: Paper[];
  subjects: string[];
  creditsUsed: number;
  creditsLeft: number;
}

function intro(): Message {
  return {
    role: 'assistant',
    content:
      'Hi! I’m your SinkWake assistant. I can answer questions about your account using your real data — ask me things like “How many papers have I generated?”, “Which subjects have I covered?”, or “How many credits do I have left?”',
  };
}

async function answer(userText: string, ctx: Context): Promise<string> {
  const text = userText.toLowerCase();
  const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
  await wait(600);

  const papers = ctx.papers;
  const countMatch = /(how many|count of|total).*papers?/.test(text) || /papers?.*(generated|made|created)/.test(text);

  if (countMatch || /how many papers/.test(text)) {
    if (papers.length === 0) {
      return 'You haven’t generated any papers yet. Open **Generate Paper** and create your first one — analytics and answers here will update instantly.';
    }
    const byDifficulty = new Map<string, number>();
    papers.forEach((p) => byDifficulty.set(p.difficulty, (byDifficulty.get(p.difficulty) || 0) + 1));
    const breakdown = [...byDifficulty.entries()]
      .map(([level, count]) => `${level}: ${count}`)
      .join(', ');
    return `You have generated **${papers.length} paper${papers.length === 1 ? '' : 's'}** in total (${breakdown}). That sums to ${ctx.creditsUsed} credits used.`;
  }

  if (/subject/.test(text) || /cover/.test(text) || /topics/.test(text)) {
    if (papers.length === 0) return 'You haven’t generated papers yet, so no subjects are covered. Try your first one in the Generate Paper wizard.';
    const counts = new Map<string, number>();
    papers.forEach((p) => counts.set(p.subject, (counts.get(p.subject) || 0) + 1));
    const lines = [...counts.entries()]
      .map(([subject, count]) => `${subject}: ${count} paper${count === 1 ? '' : 's'}`)
      .join('\n');
    return `You've covered **${counts.size} subject${counts.size === 1 ? '' : 's'}** so far:\n${lines}`;
  }

  if (/credit|balance|left/.test(text)) {
    return `You started with ${CREDITS_START} credits. Each paper uses ${CREDITS_PER_PAPER}, so you've spent **${ctx.creditsUsed}** and have **${ctx.creditsLeft}** left.`;
  }

  if (/marks/.test(text) || /difficulty/.test(text)) {
    const totalMarks = papers.reduce((sum, p) => sum + p.totalMarks, 0);
    const totalQuestions = papers.reduce((sum, p) => sum + p.totalQuestions, 0);
    return `Across all papers you've written **${totalMarks} marks** of content (${totalQuestions} questions). The most common difficulty is **${mostCommon(papers.map((p) => p.difficulty)) || '—'}**.`;
  }

  if (/recent|latest|last/.test(text)) {
    if (papers.length === 0) return 'You have no papers yet, so nothing to show here. Generate a paper and I’ll list them.';
    const recent = papers.slice(0, 3).map((p) => `• ${p.title} (${new Date(p.createdAt).toLocaleDateString()})`).join('\n');
    return `Your most recent papers:\n${recent}`;
  }

  if (/delete|clear|reset/.test(text)) {
    return 'You can clear your history from the Settings page anytime. Note this will also empty the charts on the Analytics page.';
  }

  if (/help|what can you|suggestions?/.test(text)) {
    return 'I can answer from your real data. Try:\n• “How many papers have I generated?”\n• “Which subjects have I covered?”\n• “How much credits do I have left?”\n• “Show my recent papers”\n• “What difficulty do I use most?”';
  }

  return 'I’m not sure I understand — but I can only answer from your own account data (papers, subjects, marks, credits). Try one of the suggestions below, or ask “what can you do?”.';
}

function mostCommon(values: string[]): string {
  const counts = new Map<string, number>();
  values.forEach((v) => counts.set(v, (counts.get(v) || 0) + 1));
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || '—';
}

export default function AssistantPage() {
  const [messages, setMessages] = useState<Message[]>([intro()]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, busy]);

  const send = async (text: string) => {
    const clean = text.trim();
    if (!clean || busy) return;
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: clean }]);
    setBusy(true);

    const ctx: Context = (() => {
      const papers = APP_STORE.getPapers();
      return {
        papers,
        subjects: [...new Set(papers.map((p) => p.subject))],
        creditsUsed: papers.length * CREDITS_PER_PAPER,
        creditsLeft: Math.max(0, CREDITS_START - papers.length * CREDITS_PER_PAPER),
      };
    })();

    const reply = await answer(clean, ctx);
    setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
    setBusy(false);
  };

  const suggestions = ['How many papers have I generated?', 'Which subjects have I covered?', 'How much credits do I have left?', 'Show my recent papers'];

  return (
    <div className="max-w-2xl">
      <Card title="Your personal assistant" subtitle="Answers are computed from your own generation history and account data.">
        <div className="space-y-3 min-h-[320px] max-h-[440px] overflow-y-auto pr-1">
          {messages.map((message, i) => (
            <div key={i} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-[13px] leading-relaxed ${
                  message.role === 'user'
                    ? 'bg-primary text-white rounded-br-md'
                    : 'bg-surface-container text-on-surface rounded-bl-md'
                }`}
              >
                {message.content}
              </div>
            </div>
          ))}
          {busy && (
            <div className="flex items-center gap-1.5 pl-1">
              <span className="h-1.5 w-1.5 rounded-full bg-on-surface-variant/50 animate-bounce" />
              <span className="h-1.5 w-1.5 rounded-full bg-on-surface-variant/50 animate-bounce [animation-delay:120ms]" />
              <span className="h-1.5 w-1.5 rounded-full bg-on-surface-variant/50 animate-bounce [animation-delay:240ms]" />
            </div>
          )}
          <div ref={endRef} />
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {suggestions.map((sug) => (
            <button
              key={sug}
              type="button"
              onClick={() => send(sug)}
              className="rounded-full border border-outline-variant px-3 py-1.5 text-[12px] font-semibold text-on-surface-variant hover:border-primary hover:text-primary transition"
            >
              {sug}
            </button>
          ))}
        </div>

        <form
          className="mt-4 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={busy ? 'Thinking…' : 'Ask about your account…'}
            disabled={busy}
            className="flex-1 rounded-xl border border-outline-variant bg-surface px-4 py-2.5 text-[14px] text-on-surface placeholder:text-on-surface-variant/60 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition"
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            className="rounded-xl bg-primary px-4 text-white hover:bg-primary-dark disabled:opacity-40 transition"
            aria-label="Send"
          >
            <span className="material-symbols-outlined text-[18px]">send</span>
          </button>
        </form>
      </Card>
    </div>
  );
}