'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Badge, Card } from '@/components/FormControls';
import { TEMPLATES } from '@/lib/data/generator';
import { APP_STORE } from '@/lib/data/store';

function Preview({ id }: { id: string }) {
  // Generic mini-paper illustration: header + question lines
  const lines = [70, 88, 55, 80, 65, 74];
  if (id === 'school') {
    return (
      <div className="h-36 rounded-lg bg-white p-3 border border-outline-variant relative overflow-hidden">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center">
            <span className="material-symbols-outlined text-[14px] text-primary">school</span>
          </div>
          <div className="space-y-1 flex-1">
            <div className="h-1.5 w-2/3 bg-primary/40 rounded-full" />
            <div className="h-1.5 w-1/2 bg-[#dbe1ea] rounded-full" />
          </div>
          <span className="text-[8px] font-bold text-on-surface-variant">25</span>
        </div>
        <div className="mt-2 h-[3px] w-full bg-primary/60 rounded" />
        <div className="mt-2 space-y-1.5">
          {lines.slice(0, 4).map((width, i) => (
            <div key={i} className="h-1.5 rounded-full bg-[#e2e8f0]" style={{ width: `${width}%` }} />
          ))}
        </div>
      </div>
    );
  }
  if (id === 'board') {
    return (
      <div className="flex h-36 rounded-lg border border-outline-variant bg-white overflow-hidden">
        <div className="w-1 bg-primary" />
        <div className="flex-1 p-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-on-surface tracking-widest">SET A</span>
            <span className="text-[8px] font-bold text-on-surface-variant">Time: 90 min</span>
          </div>
          <div className="mt-1.5 h-1 w-3/4 bg-on-surface/70 rounded-full" />
          <div className="mt-1.5 rounded border border-outline-variant bg-surface-container px-2 py-1">
            <div className="h-1 w-full bg-on-surface-variant/40 rounded" />
            <div className="mt-1 h-1 w-2/3 bg-on-surface-variant/30 rounded" />
          </div>
          <div className="mt-2 space-y-1.5">
            {lines.slice(0, 3).map((width, i) => (
              <div key={i} className="h-1 rounded-full bg-[#e2e8f0]" style={{ width: `${width}%` }} />
            ))}
          </div>
        </div>
      </div>
    );
  }
  if (id === 'minimal') {
    return (
      <div className="h-36 rounded-2xl border border-dashed border-outline-variant bg-white p-4">
        <div className="space-y-2.5">
          {lines.map((width, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-[7px] font-bold text-on-surface-variant w-3 text-right">{i + 1}</span>
              <div className="h-1.5 rounded-full bg-[#e2e8f0]" style={{ width: `${width}%` }} />
            </div>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className="h-36 rounded-2xl border border-outline-variant bg-white p-3">
      <div className="flex items-center justify-between">
        <span className="h-2 w-10 rounded-full bg-primary/70" />
        <span className="h-2 w-6 rounded-full bg-[#fd761a]/70" />
      </div>
      <div className="mt-2 grid grid-cols-2 gap-1.5">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-lg border border-outline-variant bg-surface-container p-1.5">
            <div className="h-1 w-2/3 rounded-full bg-[#e2e8f0]" />
            <div className="mt-1 h-1 w-1/2 rounded-full bg-[#e2e8f0]" />
            <div className="mt-1.5 h-1.5 w-4 rounded bg-primary/50" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function TemplatesPage() {
  const [defaultId, setDefaultId] = useState('school');
  const router = useRouter();

  useEffect(() => {
    setDefaultId(APP_STORE.getSettings().templateId);
  }, []);

  const useTemplate = (id: string) => {
    APP_STORE.setPreferredTemplate(id);
    router.push('/dashboard/generate');
  };

  const setDefault = (id: string) => {
    APP_STORE.saveSettings({ ...APP_STORE.getSettings(), templateId: id });
    setDefaultId(id);
  };

  return (
    <div className="space-y-6">
      <Card
        title="Paper Templates"
        subtitle="Pick a layout for the wizard, or set your default for new papers."
      >
        <div className="grid sm:grid-cols-2 gap-4">
          {TEMPLATES.map((template) => (
            <div
              key={template.id}
              className={`rounded-2xl border p-4 transition ${
                defaultId === template.id ? 'border-primary ring-2 ring-primary/20' : 'border-outline-variant'
              }`}
            >
              <Preview id={template.id} />
              <div className="mt-3 flex items-start justify-between gap-3">
                <div className="flex-1">
                  <p className="text-[14px] font-bold text-on-surface">{template.name}</p>
                  <p className="text-[12px] text-on-surface-variant mt-0.5">{template.desc}</p>
                </div>
                {defaultId === template.id && <Badge tone="primary">Default</Badge>}
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => useTemplate(template.id)}
                  className="flex-1 rounded-xl bg-primary px-4 py-2 text-[13px] font-semibold text-white hover:bg-primary-dark transition"
                >
                  Use this template
                </button>
                <button
                  type="button"
                  onClick={() => setDefault(template.id)}
                  className={`rounded-xl border px-4 py-2 text-[13px] font-semibold transition ${
                    defaultId === template.id
                      ? 'border-primary text-primary bg-primary/5'
                      : 'border-outline-variant text-on-surface-variant hover:border-primary hover:text-primary'
                  }`}
                >
                  Set default
                </button>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}