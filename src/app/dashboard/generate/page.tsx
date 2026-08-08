'use client';

import { useMemo, useRef, useState } from 'react';
import { Card, ChoiceChip, PrimaryButton, SecondaryButton, TextArea, TextField } from '@/components/FormControls';
import { buildPaper, downloadDoc, generateConfigDefault, TEMPLATES } from '@/lib/data/generator';
import { DIFFICULTIES, PURPOSES, QUESTION_TYPES, SUBJECTS } from '@/lib/data/questionBank';
import { APP_STORE } from '@/lib/data/store';
import type { GenerationConfig, Paper } from '@/lib/data/types';

const STEP_TITLES = [
  'Difficulty',
  'Purpose',
  'Upload Sources',
  'Subject',
  'Marks & Questions',
  'Question Types',
  'Custom Questions',
  'Template',
  'Header & Branding',
  'Other Instructions',
  'Review & Generate',
];

const GENERATING_STAGES = [
  'Reading uploaded images…',
  'Selecting questions from bank…',
  'Assembling question paper…',
  'Writing answer key…',
  'Compiling step-by-step solutions…',
  'Formatting documents…',
];

function SearchSelect({
  options,
  value,
  onChange,
  placeholder,
}: {
  options: string[];
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const filtered = useMemo(
    () => options.filter((option) => option.toLowerCase().includes(query.toLowerCase())),
    [options, query],
  );
  return (
    <div className="relative">
      <input
        value={open ? query : value}
        onFocus={() => {
          setOpen(true);
          setQuery('');
        }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-outline-variant bg-surface px-3.5 py-2.5 text-[14px] text-on-surface placeholder:text-on-surface-variant/60 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition"
      />
      {open && (
        <div className="absolute z-20 mt-2 w-full max-h-64 overflow-y-auto rounded-xl border border-outline-variant bg-surface shadow-lg">
          {filtered.length === 0 && (
            <div className="px-4 py-3 text-[13px] text-on-surface-variant">No subjects found.</div>
          )}
          {filtered.map((option) => (
            <button
              key={option}
              type="button"
              onMouseDown={() => {
                onChange(option);
                setOpen(false);
              }}
              className={`block w-full px-4 py-2 text-left text-[13px] hover:bg-primary/10 ${
                option === value ? 'text-primary font-semibold' : 'text-on-surface'
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function GeneratePage() {
  const [step, setStep] = useState(0);
  const [config, setConfig] = useState<GenerationConfig>(() => generateConfigDefault());
  const [phase, setPhase] = useState<'config' | 'generating' | 'done'>('config');
  const [stageIndex, setStageIndex] = useState(0);
  const [paper, setPaper] = useState<Paper | null>(null);
  const [customText, setCustomText] = useState('');
  const [logoName, setLogoName] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const patch = (updates: Partial<GenerationConfig>) =>
    setConfig((prev) => ({ ...prev, ...updates }));

  const isLast = step === STEP_TITLES.length - 1;

  const canNext = useMemo(() => {
    switch (step) {
      case 0:
        return Boolean(config.difficulty);
      case 1:
        return config.purpose !== '';
      case 2:
        return true;
      case 3:
        return config.subject !== '';
      case 4:
        return config.totalMarks > 0 && config.totalQuestions > 0;
      case 5:
        return config.types.length > 0;
      case 6:
        return true;
      case 7:
        return true;
      case 8:
        return true;
      case 9:
        return true;
      case 10:
        return true;
      default:
        return false;
    }
  }, [step, config]);

  const handleImages = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = String(reader.result);
        setConfig((prev) => ({
          ...prev,
          images: [...prev.images, { name: file.name, size: file.size, dataUrl }],
        }));
      };
      reader.readAsDataURL(file);
    });
  };

  const handleLogo = (files: FileList | null) => {
    const file = files && files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setLogoName(file.name);
      patch({ header: { ...config.header, logo: String(reader.result) } });
    };
    reader.readAsDataURL(file);
  };

  const startGeneration = () => {
    setPhase('generating');
    setStageIndex(0);
    let index = 0;
    const timer = setInterval(() => {
      index += 1;
      if (index >= GENERATING_STAGES.length) {
        clearInterval(timer);
        const result = buildPaper(config);
        APP_STORE.addPaper(result);
        setPaper(result);
        setPhase('done');
      } else {
        setStageIndex(index);
      }
    }, 500);
  };

  const resetWizard = () => {
    setConfig(generateConfigDefault());
    setPaper(null);
    setPhase('config');
    setStep(0);
    setCustomText('');
    setLogoName('');
  };

  if (phase === 'generating') {
    return (
      <div className="grid gap-6">
        <Card title="Generating your paper" subtitle="SinkWake is assembling your question paper, answer key and solutions.">
          <div className="space-y-3 py-4">
            {GENERATING_STAGES.map((label, i) => (
              <div key={label} className="flex items-center gap-3">
                {i < stageIndex ? (
                  <span className="material-symbols-rounded text-[18px] text-[#137a4b]">check_circle</span>
                ) : i === stageIndex ? (
                  <span className="h-4 w-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                ) : (
                  <span className="h-4 w-4 rounded-full border border-outline-variant" />
                )}
                <span className={`text-[14px] ${i <= stageIndex ? 'text-on-surface' : 'text-on-surface-variant/50'}`}>
                  {label}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    );
  }

  if (phase === 'done' && paper) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card
          title="Paper generated successfully!"
          subtitle={`${paper.title.split(' — ')[0]} • ${paper.totalQuestions} questions • ${paper.totalMarks} marks — saved to your history.`}
        >
          <div className="grid gap-3 my-6">
            {[
              { label: 'Question Paper', icon: 'description', file: 'question-paper', doc: paper.docs.question },
              { label: 'Answer Key', icon: 'key', file: 'answer-paper', doc: paper.docs.answer },
              { label: 'Solution Paper', icon: 'menu_book', file: 'solution-paper', doc: paper.docs.solution },
            ].map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => downloadDoc(`${paper.subject}-${item.file}`, item.doc)}
                className="flex items-center justify-between rounded-xl border border-outline-variant bg-surface px-4 py-3.5 hover:border-primary hover:shadow-sm transition group"
              >
                <span className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-[22px] text-primary">{item.icon}</span>
                  <span className="text-[14px] font-semibold text-on-surface">{item.label}</span>
                  <span className="text-[12px] text-on-surface-variant">.md — downloads instantly</span>
                </span>
                <span className="material-symbols-outlined text-[20px] text-on-surface-variant group-hover:text-primary">download</span>
              </button>
            ))}
          </div>
          <div className="flex gap-3">
            <PrimaryButton onClick={resetWizard}>
              <span className="material-symbols-outlined text-[18px]">add_circle</span>
              Generate another paper
            </PrimaryButton>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
      {/* Step summary sidebar */}
      <aside className="hidden lg:block">
        <Card>
          <p className="text-[12px] font-bold uppercase tracking-wider text-on-surface-variant mb-3">Configuration</p>
          <ol className="space-y-1.5">
            {STEP_TITLES.map((title, i) => (
              <li key={title}>
                <button
                  type="button"
                  onClick={() => setStep(Math.min(i, step + 1))}
                  disabled={i > step + 1}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[13px] transition disabled:cursor-default ${
                    i === step ? 'bg-primary/10 text-primary font-semibold' : 'text-on-surface-variant'
                  }`}
                >
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold ${
                      i < step || (phase === 'done')
                        ? 'bg-primary text-white'
                        : i === step
                          ? 'bg-primary/10 text-primary border border-primary'
                          : 'border border-outline-variant text-on-surface-variant'
                    }`}
                  >
                    {i < step ? '✓' : i + 1}
                  </span>
                  {title}
                </button>
              </li>
            ))}
          </ol>
        </Card>
      </aside>

      <div className="space-y-6">
        <Card
          title={`Step ${step + 1}: ${STEP_TITLES[step]}`}
          subtitle={
            [
              'Choose how challenging the paper should be.',
              'What will this paper be used for?',
              'Attach photos of your book pages or class notes.',
              'Pick the subject for this paper.',
              'Set the total marks and question count.',
              'Select the question formats to include.',
              'Optionally add your own questions below.',
              'Pick a layout style, or skip to the default.',
              'Personalize the paper header with school branding.',
              'Add any other instructions for students.',
              'Check everything and generate the paper.',
            ][step]
          }
        >
          {step === 0 && (
            <div className="flex flex-wrap gap-2.5">
              {DIFFICULTIES.map((difficulty) => (
                <ChoiceChip
                  key={difficulty}
                  selected={config.difficulty === difficulty}
                  onClick={() => patch({ difficulty })}
                >
                  {difficulty}
                </ChoiceChip>
              ))}
            </div>
          )}

          {step === 1 && (
            <div className="flex flex-wrap gap-2.5">
              {PURPOSES.map((purpose) => (
                <ChoiceChip
                  key={purpose}
                  selected={config.purpose === purpose}
                  onClick={() => patch({ purpose })}
                >
                  {purpose}
                </ChoiceChip>
              ))}
            </div>
          )}

          {step === 2 && (
            <div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => handleImages(e.target.files)}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="w-full rounded-xl border-2 border-dashed border-outline-variant py-10 text-center hover:border-primary transition group"
              >
                <span className="material-symbols-outlined text-[36px] text-on-surface-variant group-hover:text-primary">image_search</span>
                <p className="mt-2 text-[14px] font-semibold text-on-surface">Click to upload images</p>
                <p className="text-[12px] text-on-surface-variant mt-1">Book pages, worksheets or handwritten notes — JPG/PNG up to 10MB each</p>
              </button>
              {config.images.length > 0 && (
                <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {config.images.map((image, i) => (
                    <div key={`${image.name}-${i}`} className="relative rounded-xl border border-outline-variant overflow-hidden group">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={image.dataUrl} alt={image.name} className="h-28 w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => patch({ images: config.images.filter((_, j) => j !== i) })}
                        className="absolute top-1.5 right-1.5 rounded-full bg-black/60 text-white p-1 hover:bg-black/80 transition"
                        aria-label="Remove image"
                      >
                        <span className="material-symbols-outlined text-[16px]">close</span>
                      </button>
                      <p className="px-2 py-1 text-[11px] text-on-surface-variant bg-surface truncate">{image.name}</p>
                    </div>
                  ))}
                </div>
              )}
              {config.images.length === 0 && (
                <p className="mt-3 text-[12px] text-on-surface-variant">No images yet — you can skip this step and generate from the question bank instead.</p>
              )}
            </div>
          )}

          {step === 3 && (
            <SearchSelect
              options={SUBJECTS}
              value={config.subject}
              onChange={(subject) => patch({ subject })}
              placeholder="Search subjects — e.g. Mathematics, Physics…"
            />
          )}

          {step === 4 && (
            <div className="grid sm:grid-cols-2 gap-4 max-w-md">
              <label className="block">
                <span className="text-[13px] font-semibold text-on-surface block mb-1.5">Total marks</span>
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={config.totalMarks || ''}
                  onChange={(e) => patch({ totalMarks: Number(e.target.value) })}
                  className="w-full rounded-xl border border-outline-variant bg-surface px-3.5 py-2.5 text-[14px] text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </label>
              <label className="block">
                <span className="text-[13px] font-semibold text-on-surface block mb-1.5">Total questions</span>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={config.totalQuestions || ''}
                  onChange={(e) => patch({ totalQuestions: Math.max(1, e.target.value === '' ? 0 : Number(e.target.value)) })}
                  className="w-full rounded-xl border border-outline-variant bg-surface px-3.5 py-2.5 text-[14px] text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </label>
            </div>
          )}

          {step === 5 && (
            <div className="flex flex-wrap gap-2.5">
              {QUESTION_TYPES.map((type) => (
                <ChoiceChip
                  key={type}
                  selected={config.types.includes(type)}
                  onClick={() =>
                    patch({
                      types: config.types.includes(type)
                        ? config.types.filter((t) => t !== type)
                        : [...config.types, type],
                    })
                  }
                >
                  {type}
                </ChoiceChip>
              ))}
              {config.types.length === 0 && (
                <p className="w-full text-[12px] text-[#b45309]">Select at least one question type.</p>
              )}
            </div>
          )}

          {step === 6 && (
            <div className="space-y-4 max-w-xl">
              <textarea
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                rows={4}
                placeholder={'Paste one question per line. These are added to the paper exactly as written.'}
                className="w-full rounded-xl border border-outline-variant bg-surface px-3.5 py-2.5 text-[14px] text-on-surface placeholder:text-on-surface-variant/60 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 resize-y"
              />
              <PrimaryButton
                onClick={() => {
                  const list = customText.split('\n').map((s) => s.trim()).filter(Boolean);
                  if (list.length) patch({ customQuestions: [...config.customQuestions, ...list] });
                  setCustomText('');
                }}
                disabled={!customText.trim()}
              >
                Add custom question(s)
              </PrimaryButton>
              {config.customQuestions.length > 0 && (
                <ul className="space-y-2">
                  {config.customQuestions.map((question, i) => (
                    <li key={i} className="flex items-start gap-2 rounded-xl border border-outline-variant px-3.5 py-2.5">
                      <span className="text-[12px] font-bold text-primary mt-0.5">Q{i + 1}</span>
                      <span className="text-[13px] text-on-surface flex-1">{question}</span>
                      <button
                        type="button"
                        className="text-on-surface-variant hover:text-[#b3261e] transition"
                        onClick={() => patch({ customQuestions: config.customQuestions.filter((_, j) => j !== i) })}
                        aria-label="Remove"
                      >
                        <span className="material-symbols-outlined text-[18px]">close</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {step === 7 && (
            <div className="grid sm:grid-cols-2 gap-3">
              {TEMPLATES.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => patch({ templateId: template.id })}
                  className={`rounded-xl border p-4 text-left transition ${
                    config.templateId === template.id
                      ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                      : 'border-outline-variant hover:border-primary/50'
                  }`}
                >
                  <p className="text-[14px] font-bold text-on-surface">{template.name}</p>
                  <p className="text-[12px] text-on-surface-variant mt-1">{template.desc}</p>
                </button>
              ))}
              <button
                type="button"
                onClick={() => patch({ templateId: '' })}
                className={`rounded-xl border p-4 text-left transition ${
                  config.templateId === ''
                    ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                    : 'border-outline-variant hover:border-primary/50'
                }`}
              >
                <span className="text-[14px] font-bold text-on-surface">Skip — no template</span>
                <span className="text-[12px] text-on-surface-variant mt-1">Plain paper, no extra styling.</span>
              </button>
            </div>
          )}

          {step === 8 && (
            <div className="grid sm:grid-cols-2 gap-4 max-w-2xl">
              <div className="space-y-4">
                <button
                  type="button"
                  onClick={() => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = 'image/*';
                    input.onchange = () => handleLogo(input.files);
                    input.click();
                  }}
                  className="flex items-center gap-3 rounded-xl border-2 border-dashed border-outline-variant px-4 py-5 hover:border-primary transition w-full"
                >
                  {config.header.logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={config.header.logo} alt="logo" className="h-10 w-10 rounded-lg object-contain bg-surface-container" />
                  ) : (
                    <span className="material-symbols-outlined text-[28px] text-on-surface-variant">add_photo_alternate</span>
                  )}
                  <div className="text-left">
                    <p className="text-[13px] font-semibold text-on-surface">{logoName || 'Upload your logo'}</p>
                    <p className="text-[12px] text-on-surface-variant">Appears at the top of the paper</p>
                  </div>
                </button>
                <TextField
                  label="School / institute name"
                  value={config.header.schoolName}
                  onChange={(schoolName) => patch({ header: { ...config.header, schoolName } })}
                  placeholder="Springfield High School"
                />
                <TextField
                  label="Teacher name"
                  value={config.header.teacherName}
                  onChange={(teacherName) => patch({ header: { ...config.header, teacherName } })}
                  placeholder="Ms. A. Sharma"
                />
              </div>
              <TextArea
                label="Instructions for students"
                value={config.header.instructions}
                onChange={(instructions) => patch({ header: { ...config.header, instructions } })}
                rows={5}
                placeholder="Answer all questions. Calculators are not allowed.…"
              />
            </div>
          )}

          {step === 9 && (
            <TextArea
              label="Other instructions & paper notes"
              value={config.otherInstructions}
              onChange={(otherInstructions) => patch({ otherInstructions })}
              rows={5}
              placeholder={'e.g. "This paper is for 45 minutes only." or "Section B must be answered on a separate sheet."'}
            />
          )}

          {step === 10 && (
            <div className="space-y-3 text-[13px]">
              <div className="grid sm:grid-cols-2 gap-3">
                <SummaryRow label="Difficulty" value={config.difficulty} />
                <SummaryRow label="Purpose" value={config.purpose} />
                <SummaryRow label="Subject" value={config.subject || '—'} />
                <SummaryRow label="Marks / questions" value={`${config.totalMarks} / ${config.totalQuestions}`} />
                <SummaryRow label="Images uploaded" value={String(config.images.length)} />
                <SummaryRow label="Question types" value={config.types.join(', ')} />
                <SummaryRow label="Custom questions" value={String(config.customQuestions.length)} />
                <SummaryRow label="Template" value={TEMPLATES.find((t) => t.id === config.templateId)?.name || 'Skip'} />
                <SummaryRow label="School" value={config.header.schoolName || '—'} />
                <SummaryRow label="Teacher" value={config.header.teacherName || '—'} />
              </div>
              {config.images.length > 0 && (
                <div className="rounded-xl bg-surface-container px-4 py-3">
                  <span className="font-semibold">Images:</span>{' '}
                  {config.images.map((img) => img.name).join(', ')}
                </div>
              )}
              {config.otherInstructions && (
                <div className="rounded-xl bg-surface-container px-4 py-3">
                  <span className="font-semibold">Other instructions:</span> {config.otherInstructions}
                </div>
              )}
            </div>
          )}
        </Card>

        <div className="flex items-center justify-between">
          <SecondaryButton onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}>
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            Back
          </SecondaryButton>
          {isLast ? (
            <PrimaryButton onClick={startGeneration}>
              <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
              Generate paper
            </PrimaryButton>
          ) : (
            <PrimaryButton onClick={() => setStep(step + 1)} disabled={!canNext}>
              Next
              <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </PrimaryButton>
          )}
        </div>

        {isLast && (
          <p className="text-[12px] text-on-surface-variant -mt-2">
            Generate will create three downloadable documents: Question Paper, Answer Key and Solutions.
          </p>
        )}
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-outline-variant px-4 py-3">
      <p className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">{label}</p>
      <p className="text-[13px] font-semibold text-on-surface mt-0.5 break-words">{value}</p>
    </div>
  );
}