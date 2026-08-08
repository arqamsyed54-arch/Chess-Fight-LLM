'use client';

import { useEffect, useRef, useState } from 'react';
import { Card } from '@/components/FormControls';
import { APP_STORE, uid } from '@/lib/data/store';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface FaqEntry {
  keywords: string[];
  answer: string;
}

const FAQ: FaqEntry[] = [
  {
    keywords: ['generate', 'create', 'paper', 'wizard', 'step'],
    answer:
      'To generate a paper: open **Generate Paper** in the sidebar, choose difficulty, purpose and subject, then pick marks, question types and (optionally) upload your notes. On the final step click **Generate paper** — you’ll get the Question Paper, Answer Key and Solution Paper as downloadable files.',
  },
  {
    keywords: ['upload', 'image', 'photo', 'scan', 'notes', 'book'],
    answer:
      'In the wizard, Step 3 (Upload Sources) accepts JPG/PNG images up to 10MB each — book pages, worksheets or handwritten notes with instant preview before you continue.',
  },
  {
    keywords: ['template', 'layout', 'style'],
    answer:
      'Step 8 offers templates (Standard, School Letterhead, Board Style, Minimal) or you can skip. You can also set a default template in Settings → Template Defaults so new papers start with it.',
  },
  {
    keywords: ['credit', 'price', 'cost', 'plan', 'upgrade', 'subscription', 'billing'],
    answer:
      'Each generated paper uses 30 credits. Your current balance is always shown in the top bar. For plans, visit our /pricing page. Billing and upgrade flows are still being connected — pricing is the first of it, so spot-check the numbers there.',
  },
  {
    keywords: ['api', 'key', 'integration', 'mcp', 'connect'],
    answer:
      'Manage API keys under Settings → API Keys (create + revoke anytime). MCP connection settings live in Settings → MCP Config — paste your server endpoint there and enable the toggle to let AI agents read your paper history.',
  },
  {
    keywords: ['delete', 'clear', 'history', 'remove', 'privacy'],
    answer:
      'You can clear your generation history and it’ll empty the analytics charts too. Just confirm from Settings → Account or ask us and we’ll guide you.',
  },
  {
    keywords: ['password', 'login', 'sign in', 'forgot', 'session'],
    answer:
      'Go to Settings → Security to change your password and see/reject active login sessions. Forgot password? Send an email to support@sinkwake.app with your registered email address.',
  },
  {
    keywords: ['question bank', 'bank', 'questions', 'search'],
    answer:
      'The Question Bank page holds every generated-managed question with filters for subject, topic, difficulty and type. Use the search box to instantly narrow it down.',
  },
  {
    keywords: ['error', 'bug', 'broken', 'issue', 'not working', 'failed'],
    answer:
      'Sorry about that. If something broke, use the **Create support ticket** option below and include what you were doing — we’ll investigate whether we can reproduce the issue.',
  },
];

function intro(): Message {
  return {
    role: 'assistant',
    content:
      'Hi! I’m the SinkWake support assistant. Ask me about generating papers, uploads, templates, credits, API keys, or your account. If I can’t resolve your issue, you can escalate to a human support ticket.',
  };
}

function matchFaq(text: string): string | null {
  const lower = text.toLowerCase();
  let best: FaqEntry | null = null;
  let bestScore = 0;
  for (const entry of FAQ) {
    const score = entry.keywords.filter((k) => lower.includes(k)).length;
    if (score > bestScore) {
      bestScore = score;
      best = entry;
    }
  }
  return best && bestScore > 0 ? best.answer : null;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function SupportPage() {
  const [messages, setMessages] = useState<Message[]>([intro()]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [noMatchCount, setNoMatchCount] = useState(0);
  const [escalating, setEscalating] = useState(false);
  const [subject, setSubject] = useState('');
  const [ticketId, setTicketId] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, busy, escalating]);

  const send = async (text: string) => {
    const clean = text.trim();
    if (!clean || busy) return;
    setMessages((prev) => [...prev, { role: 'user', content: clean }]);
    setInput('');
    setBusy(true);

    await delay(700);
    const found = matchFaq(clean);
    if (found) {
      setNoMatchCount(0);
      setMessages((prev) => [...prev, { role: 'assistant', content: found }]);
    } else {
      setNoMatchCount((count) => count + 1);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content:
            'I don’t have a canned answer for that one. If it’s about an error: **Create a support ticket** below. Otherwise rephrase — for example “how do I generate a paper?”.',
        },
      ]);
    }
    setBusy(false);
  };

  const createTicket = () => {
    const transcript = messages
      .filter((m) => m.role === 'user' || m.content !== intro().content)
      .map((m) => `${m.role === 'user' ? 'User' : 'Support'}: ${m.content}`)
      .join('\n');
    const id = uid();
    APP_STORE.addTicket({
      id,
      subject: subject.trim() || 'Support request — could not resolve',
      message: transcript,
      transcript,
      status: 'open',
      createdAt: new Date().toISOString(),
    });
    setTicketId(id);
    setEscalating(false);
    setMessages((prev) => [
      ...prev,
      {
        role: 'assistant',
        content: `Your support ticket has been created — reference ${id}. The team usually responds within one working day.`,
      },
    ]);
  };

  return (
    <div className="max-w-2xl">
      <Card title="Support" subtitle="Product help and FAQ — escalate to a ticket when you’re still stuck.">
        <div className="scroll-auto space-y-3 min-h-[300px] max-h-[420px] overflow-y-auto pr-1">
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
          {['How do I generate a paper?', 'I can’t upload images', 'Where are my API keys?', 'How much does it cost?'].map((sug) => (
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

        {noMatchCount >= 2 && !escalating && ticketId === null && (
          <button
            type="button"
            onClick={() => setEscalating(true)}
            className="mt-4 w-full rounded-xl border border-[#b45309]/30 bg-[#fef3e7] px-4 py-3 text-[13px] font-bold text-[#b45309] hover:bg-[#fde9d3] transition"
          >
            I still need help — raise a human support ticket
          </button>
        )}

        {escalating && (
          <div className="mt-4 rounded-xl border border-outline-variant bg-surface-container p-4">
            <p className="text-[13px] font-bold text-on-surface">Create a support ticket</p>
            <p className="text-[12px] text-on-surface-variant mt-1">A full transcript of this chat goes along with your message.</p>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject — e.g. Downloads don’t work"
              className="mt-3 w-full rounded-xl border border-outline-variant bg-surface px-3.5 py-2.5 text-[13px] text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={createTicket}
                className="rounded-xl bg-primary px-4 py-2 text-[13px] font-semibold text-white hover:bg-primary-dark transition"
              >
                Send ticket
              </button>
              <button
                type="button"
                onClick={() => setEscalating(false)}
                className="rounded-xl border border-outline-variant px-4 py-2 text-[13px] font-semibold text-on-surface hover:border-primary hover:text-primary transition"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

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
            placeholder={busy ? 'Thinking…' : 'How can we help?'}
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