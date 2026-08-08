'use client';

import { useEffect, useMemo, useState } from 'react';
import { Badge, Card, SelectField } from '@/components/FormControls';
import {
  DIFFICULTIES,
  QUESTION_BANK,
  QUESTION_TYPES,
  SUBJECTS,
  TOPICS,
  searchQuestions,
} from '@/lib/data/questionBank';

const PAGE_SIZE = 8;

export default function QuestionBankPage() {
  const [query, setQuery] = useState('');
  const [subject, setSubject] = useState('');
  const [topic, setTopic] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [type, setType] = useState('');
  const [page, setPage] = useState(1);
  const [stats, setStats] = useState({ total: QUESTION_BANK.length });

  useEffect(() => {
    setStats({ total: QUESTION_BANK.length });
  }, []);

  const results = useMemo(
    () => searchQuestions({ subject: subject || undefined, topic: topic || undefined, difficulty: difficulty || undefined, type: type || undefined, query: query || undefined }),
    [query, subject, topic, difficulty, type],
  );

  const totalPages = Math.max(1, Math.ceil(results.length / PAGE_SIZE));
  const pageItems = results.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const reset = () => {
    setSubject('');
    setTopic('');
    setDifficulty('');
    setType('');
    setQuery('');
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <Card
        title="Question Bank"
        subtitle={`${stats.total} questions in your bank • ${results.length} match current filters`}
      >
        <div className="grid md:grid-cols-[1fr_auto_auto_auto_auto_auto] gap-3 items-end">
          <label className="block">
            <span className="text-[13px] font-semibold text-on-surface block mb-1.5">Search</span>
            <input
              value={query}
              onChange={(e) => { setQuery(e.target.value); setPage(1); }}
              placeholder="Search questions, topics…"
              className="w-full rounded-xl border border-outline-variant bg-surface px-3.5 py-2.5 text-[14px] text-on-surface placeholder:text-on-surface-variant/60 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition"
            />
          </label>
          <SelectField label="Subject" value={subject} onChange={(v) => { setSubject(v); setTopic(''); setPage(1); }} options={SUBJECTS.map((s) => ({ value: s, label: s }))} placeholder="All subjects" />
          <SelectField label="Topic" value={topic} onChange={(v) => { setTopic(v); setPage(1); }} options={Object.entries(TOPICS).filter(([s]) => !subject || s === subject).flatMap(([s, topics]) => topics.map((t) => ({ value: t, label: t })))} placeholder="All topics" />
          <SelectField label="Difficulty" value={difficulty} onChange={(v) => { setDifficulty(v); setPage(1); }} options={DIFFICULTIES.map((d) => ({ value: d, label: d }))} placeholder="All" />
          <SelectField label="Type" value={type} onChange={(v) => { setType(v); setPage(1); }} options={QUESTION_TYPES.map((t) => ({ value: t, label: t }))} placeholder="All" />
          <button
            type="button"
            onClick={reset}
            className="rounded-xl border border-outline-variant bg-surface px-4 py-2.5 text-[13px] font-semibold text-on-surface hover:border-primary hover:text-primary transition"
          >
            Reset
          </button>
        </div>
      </Card>

      {pageItems.length === 0 ? (
        <Card title="No questions found">
          <p className="text-[13px] text-on-surface-variant">
            Nothing matches the current filters. Try clearing the search or choosing a different subject.
          </p>
          <button type="button" onClick={reset} className="mt-4 rounded-xl border border-outline-variant px-4 py-2 text-[13px] font-semibold text-primary hover:border-primary transition">
            Clear all filters
          </button>
        </Card>
      ) : (
        <div className="space-y-3">
          {pageItems.map((question) => (
            <div key={question.id} className="rounded-2xl border border-outline-variant bg-surface p-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="primary">{question.subject}</Badge>
                <Badge tone="neutral">{question.topic}</Badge>
                <Badge tone="warn">{question.difficulty}</Badge>
                <Badge tone="neutral">{question.type}</Badge>
                <span className="ml-auto text-[12px] font-semibold text-on-surface-variant">{question.marks} mark{question.marks === 1 ? '' : 's'}</span>
              </div>
              <p className="mt-3 text-[14px] font-medium text-on-surface leading-relaxed">{question.text}</p>
              <details className="mt-3 group">
                <summary className="cursor-pointer list-none text-[13px] font-semibold text-primary flex items-center gap-1">
                  <span className="material-symbols-outlined text-[16px]">expand_more</span>
                  Answer & solution
                </summary>
                <div className="mt-2 rounded-xl bg-surface-container px-4 py-3 space-y-1">
                  <p className="text-[13px] text-on-surface"><b>Answer:</b> {question.answer}</p>
                  <p className="text-[13px] text-on-surface-variant"><b>Solution:</b> {question.solution}</p>
                </div>
              </details>
            </div>
          ))}

          <div className="flex items-center justify-between pt-2">
            <p className="text-[12px] text-on-surface-variant">
              Page {page} of {totalPages}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
                className="rounded-xl border border-outline-variant px-4 py-2 text-[13px] font-semibold text-on-surface disabled:opacity-40 hover:border-primary hover:text-primary transition"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={page === totalPages}
                onClick={() => setPage(page + 1)}
                className="rounded-xl border border-outline-variant px-4 py-2 text-[13px] font-semibold text-on-surface disabled:opacity-40 hover:border-primary hover:text-primary transition"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}