'use client';

import ChatShell from '@/components/ChatShell';
import type { ChatMessage } from '@/components/ChatShell';
import { Card } from '@/components/FormControls';
import { APP_STORE, uid } from '@/lib/data/store';

interface FaqEntry {
  keywords: string[];
  answer: string;
}

const FAQ: FaqEntry[] = [
  {
    keywords: ['generate', 'create', 'paper', 'wizard', 'step'],
    answer:
      'To generate a paper: open **Generate Paper** in the sidebar, pick difficulty and purpose, optionally upload source images, choose subject/marks/types, then press **Generate Paper** on the review step. Three downloads appear: Question Paper, Answer Key, Solution Paper.',
  },
  {
    keywords: ['upload', 'image', 'photo', 'scan', 'notes', 'book'],
    answer:
      'Step 3 of the wizard accepts JPG/PNG images up to 10MB each — book pages, worksheets or handwritten notes — with previews and remove buttons before you continue.',
  },
  {
    keywords: ['template', 'layout', 'style'],
    answer:
      'The Templates page offers four layouts (School Letterhead, Board-Exam Style, Minimalist, Modern Grid). “Use this template” carries your choice straight into the wizard’s template step. You can also set a default in Settings → Template Defaults.',
  },
  {
    keywords: ['credit', 'price', 'cost', 'plan', 'upgrade', 'free', 'billing'],
    answer:
      'Each generated paper costs 30 credits; your balance shows in the top bar. Free (50), Student and Teacher plans are listed on the /pricing page. Billing processing is still being connected — the page content and limits are live now.',
  },
  {
    keywords: ['api', 'key', 'integration', 'mcp'],
    answer:
      'Create, copy and revoke API keys on the API Keys page — keys are stored hashed and shown only once. MCP endpoints and enable/disable live on the MCP page, and Settings → MCP Config carries the same settings.',
  },
  {
    keywords: ['delete', 'clear', 'remove', 'privacy'],
    answer:
      'Clearing generation history is part of the database migration milestone. Today your papers live in your browser workspace, and the analytics empty once all papers are removed from it.',
  },
  {
    keywords: ['password', 'login', 'forgot', 'session'],
    answer:
      'Change your password and review login sessions under Settings → Security → password page. Forgot password support is on the roadmap — write a ticket below and we’ll reset it manually.',
  },
  {
    keywords: ['question bank', 'bank', 'questions', 'search'],
    answer:
      'Question Bank holds 50+ seeded questions across 8 subjects, filterable by subject, topic, difficulty and type, with per-question answers and solutions. New questions sync once database seeding ships.',
  },
  {
    keywords: ['model', 'effort', 'assistant', 'ai'],
    answer:
      'The assistant lets you pick backend models (Gemini 2.5 Flash / OpenAI GPT-4o / Groq Llama 4) and an effort level (Low/Medium/High) which controls answer depth. It only answers from your workspace data — not an open chatbot.',
  },
  {
    keywords: ['error', 'bug', 'broken', 'issue', 'not working', 'failed', 'download'],
    answer:
      'Downloads in the wizard produce .md files (plain-text preview of Q/A/S documents). If you hit an error, use the ticket button below and include what you were doing so we can reproduce it.',
  },
];

const INTRO: ChatMessage = {
  id: 'support-intro',
  role: 'assistant',
  content:
    'Hi! I’m the SinkWake support assistant. Ask me anything about generating papers, templates, credits, API keys, MCP or your account. If I can’t resolve it in a couple of turns, you can escalate to a human ticket.',
  ts: Date.now(),
};

function matchFaq(text: string): string | null {
  const lower = text.toLowerCase();
  let best: string | null = null;
  let bestScore = 0;
  for (const entry of FAQ) {
    const score = entry.keywords.filter((k) => lower.includes(k)).length;
    if (score > bestScore) {
      bestScore = score;
      best = entry.answer;
    }
  }
  return best;
}

export default function SupportPage() {
  return (
    <Card title="Support" subtitle="Product help and FAQ — escalate to a human ticket when you're still stuck.">
      <ChatShell
        threadKey="support"
        intro={INTRO}
        placeholder="How can we help you?"
        suggestions={[
          'How do I generate a paper?',
          'I can’t upload images',
          'Where are my API keys?',
          'What do credits cost?',
        ]}
        onRespond={async (text) => {
          await new Promise((resolve) => setTimeout(resolve, 650));
          const answer = matchFaq(text);
          return { content: answer || 'I don’t have an answer for that yet — try rephrasing, or hit the escalate button below and a human will take over.', matched: answer !== null };
        }}
        escalate={{
          enableAfter: 2,
          prompt: 'We couldn’t resolve this automatically. Raise a ticket and our team will pick it up — the full chat transcript is attached.',
          submitLabel: 'Send ticket',
          onSubmit: (subject) => {
            const transcript = APP_STORE.getChat('support')
              .map((m) => `${m.role === 'user' ? 'User' : 'Support'}: ${m.content}`)
              .join('\n');
            const id = uid();
            APP_STORE.addTicket({
              id,
              subject: subject || 'Support request (escalated from assistant)',
              message: transcript,
              transcript,
              status: 'open',
              createdAt: new Date().toISOString(),
            });
            return id;
          },
        }}
      />
    </Card>
  );
}