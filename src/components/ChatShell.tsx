'use client';

import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { APP_STORE } from '@/lib/data/store';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  ts: number;
}

interface ChatShellProps {
  threadKey: string;
  intro: ChatMessage;
  placeholder: string;
  suggestions?: string[];
  footer?: ReactNode;
  onRespond: (text: string) => Promise<{ content: string; matched: boolean }>;
  escalate?: {
    enableAfter: number;
    prompt: string;
    submitLabel: string;
    onSubmit: (subject: string) => string;
  };
}

function makeId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export default function ChatShell({
  threadKey,
  intro,
  placeholder,
  suggestions,
  footer,
  onRespond,
  escalate,
}: ChatShellProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [unmatched, setUnmatched] = useState(0);
  const [showEscalate, setShowEscalate] = useState(false);
  const [escalated, setEscalated] = useState<string | null>(null);
  const [escalateSubject, setEscalateSubject] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  const respondRef = useRef(onRespond);
  respondRef.current = onRespond;

  useEffect(() => {
    const saved = APP_STORE.getChat(threadKey);
    setMessages(saved.length > 0 ? saved : [intro]);
  }, [threadKey]);

  useEffect(() => {
    if (messages.length === 0) return;
    APP_STORE.saveChat(threadKey, messages);
  }, [messages, threadKey]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, busy]);

  const push = (role: 'user' | 'assistant', content: string) =>
    setMessages((prev) => [...prev, { id: makeId(), role, content, ts: Date.now() }]);

  const send = async (raw: string) => {
    const text = raw.trim();
    if (!text || busy) return;
    setInput('');
    push('user', text);
    setBusy(true);
    try {
      const result = await respondRef.current(text);
      push('assistant', result.content);
      if (result.matched) {
        setUnmatched(0);
      } else {
        setUnmatched((count) => {
          const next = count + 1;
          if (next >= (escalate?.enableAfter ?? Infinity)) setShowEscalate(true);
          return next;
        });
      }
    } catch {
      push('assistant', 'Something went wrong while answering. Please try again.');
    }
    setBusy(false);
  };

  const newChat = () => {
    APP_STORE.clearChat(threadKey);
    setMessages([intro]);
    setUnmatched(0);
    setShowEscalate(false);
    setEscalated(null);
  };

  const createEscalation = () => {
    if (!escalate) return;
    const id = escalate.onSubmit(escalateSubject.trim() || 'Support request');
    setEscalated(id);
    setShowEscalate(false);
    setEscalateSubject('');
    push(
      'assistant',
      `Your support ticket was created (reference ${id}). Someone from the team will get back to you within one working day.`,
    );
  };

  const lockInput = escalated !== null;
  const showEscalateForm = !!escalate && unmatched >= escalate.enableAfter && escalated === null && showEscalate;

  return (
    <div className="flex flex-col h-[calc(100vh-13rem)] min-h-[540px]">
      <div className="flex items-center justify-between px-1 pb-3">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[20px] text-primary">forum</span>
          <span className="text-[13px] font-semibold text-on-surface-variant">
            {messages.length} messages • conversation is saved
          </span>
        </div>
        <button
          type="button"
          onClick={newChat}
          className="text-[13px] font-semibold text-on-surface-variant hover:text-primary transition flex items-center gap-1"
        >
          <span className="material-symbols-outlined text-[16px]">delete_sweep</span>
          New conversation
        </button>
      </div>

      <div className="flex-1 overflow-y-auto rounded-2xl border border-outline-variant bg-white/60 p-4 space-y-2">
        {messages.map((message) => (
          <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className="max-w-[82%]">
              <div
                className={`rounded-2xl px-4 py-2.5 text-[13px] leading-relaxed whitespace-pre-wrap shadow-sm ${
                  message.role === 'user'
                    ? 'bg-primary text-white rounded-br-md'
                    : 'bg-surface border border-outline-variant rounded-bl-md'
                }`}
              >
                {message.content}
              </div>
              <p className={`mt-1 text-[10px] text-on-surface-variant/70 ${message.role === 'user' ? 'text-right' : ''}`}>
                {new Date(message.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}
        {busy && (
          <div className="flex items-center gap-1.5 pl-1">
            <span className="h-1.5 w-1.5 rounded-full bg-primary/60 animate-bounce" />
            <span className="h-1.5 w-1.5 rounded-full bg-primary/60 animate-bounce [animation-delay:120ms]" />
            <span className="h-1.5 w-1.5 rounded-full bg-primary/60 animate-bounce [animation-delay:240ms]" />
          </div>
        )}
        <div ref={endRef} />
      </div>

      {suggestions && suggestions.length > 0 && !lockInput && (
        <div className="flex flex-wrap gap-1.5 pt-3">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => send(suggestion)}
              className="rounded-full border border-outline-variant px-3 py-1.5 text-[12px] font-semibold text-on-surface-variant hover:border-primary hover:text-primary transition"
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}

      {showEscalate && escalated === null && !showEscalateForm && (
        <button
          type="button"
          onClick={() => setShowEscalate(true)}
          className="mt-3 w-full rounded-xl border border-[#b45309]/30 bg-[#fef3e7] px-4 py-3 text-[13px] font-bold text-[#b45309] hover:bg-[#fde9d3] transition"
        >
          I still need help — raise a human support ticket
        </button>
      )}

      {showEscalateForm && (
        <div className="mt-3 rounded-xl border border-[#b45309]/30 bg-[#fef3e7] p-4">
          <p className="text-[13px] font-bold text-[#b45309]">{escalate?.prompt}</p>
          <div className="mt-3 flex gap-2">
            <input
              value={escalateSubject}
              onChange={(e) => setEscalateSubject(e.target.value)}
              placeholder="Brief summary — e.g. 'Download doesn't work'"
              className="flex-1 rounded-xl border border-outline-variant bg-white px-3.5 py-2.5 text-[13px] text-on-surface outline-none focus:border-primary"
            />
            <button
              type="button"
              onClick={createEscalation}
              className="rounded-xl bg-[#b45309] px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-[#92400e] transition"
            >
              {escalate?.submitLabel || 'Send ticket'}
            </button>
            <button
              type="button"
              onClick={() => setShowEscalate(false)}
              className="rounded-xl border border-outline-variant bg-surface px-4 py-2.5 text-[13px] font-semibold text-on-surface hover:border-[#b45309] hover:text-[#b45309] transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {footer && <div className="pt-3">{footer}</div>}

      <form
        className="mt-3 flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <div className="relative flex-1">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            rows={Math.min(4, Math.max(1, input.split('\n').length))}
            placeholder={placeholder}
            disabled={busy || lockInput}
            className="w-full rounded-2xl border border-outline-variant bg-surface px-4 py-3 pr-12 text-[14px] text-on-surface placeholder:text-on-surface-variant/60 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition resize-none"
          />
          <button
            type="submit"
            disabled={busy || !input.trim() || lockInput}
            className="absolute bottom-2 right-2 rounded-xl bg-primary p-2.5 text-white hover:bg-primary-dark disabled:opacity-40 disabled:cursor-not-allowed transition"
            aria-label="Send message"
          >
            <span className="material-symbols-outlined text-[18px]">send</span>
          </button>
        </div>
      </form>
      {lockInput ? (
        <p className="pt-2 text-[12px] text-on-surface-variant">
          You have an open ticket — our team will reach out. Start a new conversation if you need more help.
        </p>
      ) : (
        <p className="pt-2 text-[12px] text-on-surface-variant">Enter to send • Shift+Enter for a new line</p>
      )}
    </div>
  );
}