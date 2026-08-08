'use client';

import { useEffect, useMemo, useState } from 'react';
import { Badge, Card } from '@/components/FormControls';
import { APP_STORE } from '@/lib/data/store';
import type { Paper } from '@/lib/data/types';

const BARS = ['#004ac6', '#2563eb', '#60a5fa', '#93c5fd', '#bfdbfe', '#dbeafe'];

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(key: string): string {
  const [year, month] = key.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleString('en-US', { month: 'short' });
}

export default function AnalyticsPage() {
  const [papers, setPapers] = useState<Paper[]>([]);

  useEffect(() => {
    setPapers(APP_STORE.getPapers());
  }, []);

  const stats = useMemo(() => {
    const now = new Date();
    const months: string[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(monthKey(d));
    }
    const perMonth = new Map<string, number>();
    months.forEach((m) => perMonth.set(m, 0));
    papers.forEach((paper) => {
      const key = monthKey(new Date(paper.createdAt));
      if (perMonth.has(key)) perMonth.set(key, (perMonth.get(key) || 0) + 1);
    });

    const bySubject = new Map<string, number>();
    const byType = new Map<string, number>();
    const byDifficulty = new Map<string, number>();
    papers.forEach((paper) => {
      bySubject.set(paper.subject, (bySubject.get(paper.subject) || 0) + 1);
      byDifficulty.set(paper.difficulty, (byDifficulty.get(paper.difficulty) || 0) + 1);
      paper.types.forEach((t) => byType.set(t, (byType.get(t) || 0) + 1));
    });

    const totalQuestions = papers.reduce((sum, p) => sum + p.totalQuestions, 0);
    const totalMarks = papers.reduce((sum, p) => sum + p.totalMarks, 0);
    const totalImages = papers.length; // papers built from uploads counted here

    return {
      months,
      perMonth,
      bySubject: [...bySubject.entries()].sort((a, b) => b[1] - a[1]),
      byType: [...byType.entries()].sort((a, b) => b[1] - a[1]),
      byDifficulty: [...byDifficulty.entries()].sort((a, b) => b[1] - a[1]),
      total: papers.length,
      totalQuestions,
      totalMarks,
      totalImages,
    };
  }, [papers]);

  if (stats.total === 0) {
    return (
      <div className="max-w-lg mx-auto mt-10">
        <Card title="No data yet">
          <div className="flex flex-col items-center text-center py-8">
            <span className="material-symbols-outlined text-[56px] text-on-surface-variant/40">bar_chart</span>
            <p className="mt-3 text-[14px] text-on-surface-variant max-w-sm">
              Analytics appear here once you generate papers. Head over to <b>Generate Paper</b> and create your first paper.
            </p>
            <a
              href="/dashboard/generate"
              className="mt-5 rounded-xl bg-primary px-5 py-2.5 text-[14px] font-semibold text-white hover:bg-primary-dark transition"
            >
              Generate your first paper
            </a>
          </div>
        </Card>
      </div>
    );
  }

  const maxMonthly = Math.max(1, ...stats.perMonth.values());

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon="description" label="Papers generated" value={String(stats.total)} />
        <StatCard icon="quiz" label="Total questions" value={String(stats.totalQuestions)} />
        <StatCard icon="grade" label="Total marks authored" value={String(stats.totalMarks)} />
        <StatCard icon="image_search" label="Source images used" value={String(stats.totalImages)} />
      </div>

      <Card title="Papers generated over time" subtitle="Last 6 months">
        <div className="flex items-end gap-3 h-44">
          {stats.months.map((month, i) => {
            const count = stats.perMonth.get(month) || 0;
            const height = Math.max(6, (count / maxMonthly) * 100);
            return (
              <div key={month} className="flex-1 flex flex-col items-center gap-2">
                <span className="text-[11px] font-bold text-on-surface">{count || ''}</span>
                <div
                  className="w-full max-w-[52px] rounded-t-lg transition-all"
                  style={{ height: `${height * 1.3}px`, backgroundColor: BARS[i % BARS.length] }}
                  title={`${monthLabel(month)}: ${count}`}
                />
                <span className="text-[11px] text-on-surface-variant">{monthLabel(month)}</span>
              </div>
            );
          })}
        </div>
      </Card>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card title="Subject-wise breakdown">
          <DistributionRows items={stats.bySubject} />
        </Card>
        <Card title="Question-type distribution">
          <DistributionRows items={stats.byType} />
        </Card>
        <Card title="Difficulty distribution">
          <DistributionRows items={stats.byDifficulty} />
        </Card>
        <Card title="Recent papers" subtitle="Your latest generations">
          <ul className="space-y-2">
            {papers.slice(0, 5).map((paper) => (
              <li key={paper.id} className="flex items-center gap-3 rounded-xl border border-outline-variant px-4 py-3">
                <span className="material-symbols-outlined text-[20px] text-primary">description</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-on-surface truncate">{paper.title}</p>
                  <p className="text-[11px] text-on-surface-variant">{new Date(paper.createdAt).toLocaleString()}</p>
                </div>
                <Badge tone="primary">{paper.totalQuestions} Q</Badge>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-outline-variant bg-surface p-5">
      <span className="material-symbols-outlined text-[24px] text-primary">{icon}</span>
      <p className="mt-3 text-[28px] font-bold text-on-surface leading-none">{value}</p>
      <p className="mt-1.5 text-[12px] text-on-surface-variant">{label}</p>
    </div>
  );
}

function DistributionRows({ items }: { items: [string, number][] }) {
  const max = Math.max(1, ...items.map(([, n]) => n));
  if (items.length === 0) {
    return <p className="text-[13px] text-on-surface-variant">No data for this breakdown yet.</p>;
  }
  return (
    <ul className="space-y-3">
      {items.map(([label, count], i) => (
        <li key={label}>
          <div className="flex justify-between text-[12px] font-semibold mb-1">
            <span className="text-on-surface">{label}</span>
            <span className="text-on-surface-variant">{count}</span>
          </div>
          <div className="h-2 rounded-full bg-surface-container overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{ width: `${(count / max) * 100}%`, backgroundColor: BARS[i % BARS.length] }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}