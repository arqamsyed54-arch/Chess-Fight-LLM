'use client'

import { useState } from 'react'

const difficulties = [
  { value: 'Easy', icon: 'sentiment_satisfied' },
  { value: 'Medium', icon: 'trending_up' },
  { value: 'Average', icon: 'balance' },
  { value: 'Moderate', icon: 'stacked_line_chart' },
  { value: 'Hard', icon: 'psychology' },
  { value: 'Extra Hard', icon: 'local_fire_department' },
]

const purposes = [
  { value: 'Practice', icon: 'fitness_center', desc: 'Informal assessment for skill building and revision.' },
  { value: 'Exam', icon: 'assignment', desc: 'Formal summative assessment for standard curriculum.' },
  { value: 'National-level', icon: 'public', desc: 'High-stakes standardized testing format and rigor.' },
]

export default function GeneratePage() {
  const [step, setStep] = useState(1)
  const [difficulty, setDifficulty] = useState('')
  const [purpose, setPurpose] = useState('')

  const progress = (step / 11) * 100

  return (
    <div className="flex flex-col h-full">
      {/* Progress Bar */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-2">
          <span className="text-[14px] font-semibold text-on-surface-variant">Step {step} of 11</span>
          <span className="text-[14px] font-semibold text-primary-container">{Math.round(progress)}% Complete</span>
        </div>
        <div className="w-full bg-surface-container-highest rounded-full h-2">
          <div className="bg-primary-container h-2 rounded-full transition-all" style={{ width: `${progress}%` }}></div>
        </div>
      </div>

      {/* Step 1: Difficulty */}
      {step === 1 && (
        <section className="flex flex-col gap-8">
          <div>
            <h1 className="text-[32px] leading-[1.3] tracking-[-0.01em] font-bold text-on-surface mb-2">Step 1: Select Difficulty</h1>
            <p className="text-[16px] leading-[1.6] text-on-surface-variant">Choose the complexity level for your exam paper. This calibrates the AI&apos;s question generation.</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
            {difficulties.map((d) => (
              <button
                key={d.value}
                onClick={() => setDifficulty(d.value)}
                className={`step-card bg-surface-container-lowest border rounded-xl p-6 cursor-pointer text-center group transition-all ${
                  difficulty === d.value
                    ? 'border-primary bg-surface-container-low shadow-[0_4px_12px_rgba(15,23,42,0.05)]'
                    : 'border-outline-variant hover:shadow-[0_4px_12px_rgba(15,23,42,0.05)] hover:-translate-y-0.5'
                }`}
              >
                <span className={`material-symbols-outlined text-[32px] mb-3 transition-colors ${
                  difficulty === d.value ? 'text-primary' : 'text-tertiary group-hover:text-primary'
                }`}>{d.icon}</span>
                <h3 className={`text-[14px] font-semibold transition-colors ${
                  difficulty === d.value ? 'text-primary' : 'text-on-surface group-hover:text-primary'
                }`}>{d.value}</h3>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Step 2: Purpose */}
      {step === 2 && (
        <section className="flex flex-col gap-8">
          <div>
            <h1 className="text-[32px] leading-[1.3] tracking-[-0.01em] font-bold text-on-surface mb-2">Step 2: Paper Purpose</h1>
            <p className="text-[16px] leading-[1.6] text-on-surface-variant">Define the intended use case for this paper to ensure appropriate formatting and tone.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {purposes.map((p) => (
              <button
                key={p.value}
                onClick={() => setPurpose(p.value)}
                className={`step-card bg-surface-container-lowest border rounded-xl p-6 cursor-pointer group flex flex-col items-start text-left transition-all ${
                  purpose === p.value
                    ? 'border-primary bg-surface-container-low shadow-[0_4px_12px_rgba(15,23,42,0.05)]'
                    : 'border-outline-variant hover:shadow-[0_4px_12px_rgba(15,23,42,0.05)] hover:-translate-y-0.5'
                }`}
              >
                <span className={`material-symbols-outlined text-[28px] mb-4 transition-colors ${
                  purpose === p.value ? 'text-primary' : 'text-tertiary group-hover:text-primary'
                }`}>{p.icon}</span>
                <h3 className={`text-[24px] leading-[1.4] font-semibold mb-2 transition-colors ${
                  purpose === p.value ? 'text-primary' : 'text-on-surface group-hover:text-primary'
                }`}>{p.value}</h3>
                <p className="text-[16px] leading-[1.6] text-on-surface-variant">{p.desc}</p>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Step 3: Upload */}
      {step === 3 && (
        <section className="flex flex-col gap-8">
          <div>
            <h1 className="text-[32px] leading-[1.3] tracking-[-0.01em] font-bold text-on-surface mb-2">Upload Source Material</h1>
            <p className="text-[16px] leading-[1.6] text-on-surface-variant">Provide textbooks, class notes, or past papers to ground the AI generation in your curriculum.</p>
          </div>
          <div className="border-2 border-dashed border-outline-variant hover:border-primary-container bg-surface-container-lowest rounded-xl p-10 flex flex-col items-center justify-center text-center transition-colors cursor-pointer group">
            <div className="w-16 h-16 bg-surface-container-low rounded-full flex items-center justify-center mb-4 group-hover:bg-primary-fixed transition-colors">
              <span className="material-symbols-outlined text-3xl text-primary-container">cloud_upload</span>
            </div>
            <div className="text-[24px] leading-[1.4] font-semibold text-on-surface mb-2">Drag & Drop files here</div>
            <p className="text-[16px] leading-[1.6] text-on-surface-variant mb-6">Supports PDF, JPG, PNG, DOCX (Max 50MB per file)</p>
            <button className="bg-white border border-outline-variant text-on-surface text-[14px] font-semibold px-6 py-2 rounded-lg hover:bg-surface-container-lowest shadow-sm transition-all">
              Browse Files
            </button>
          </div>
        </section>
      )}

      {/* Step 4: Subject */}
      {step === 4 && (
        <section className="flex flex-col gap-8">
          <div>
            <h1 className="text-[32px] leading-[1.3] tracking-[-0.01em] font-bold text-on-surface mb-2">Select Subject</h1>
            <p className="text-[16px] leading-[1.6] text-on-surface-variant">Choose the primary subject area to calibrate the AI&apos;s domain knowledge.</p>
          </div>
          <div className="relative">
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant">search</span>
            <input className="w-full pl-12 pr-4 py-3 rounded-xl border border-outline-variant bg-surface-container-lowest focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-shadow" placeholder="Search subjects..." type="text" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {['Mathematics', 'Physics', 'Chemistry', 'Biology', 'English Lit', 'Geography', 'Computer Science', 'History', 'Economics'].map((subject) => (
              <div key={subject} className="border border-outline-variant bg-surface-container-lowest rounded-xl p-4 flex flex-col items-center justify-center text-center gap-3 hover:border-primary hover:bg-surface-container-low cursor-pointer transition-all">
                <div className="w-12 h-12 rounded-full bg-surface-variant flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined">school</span>
                </div>
                <span className="text-[14px] font-semibold text-on-surface">{subject}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Navigation */}
      <div className="mt-16 pt-6 border-t border-outline-variant flex justify-between items-center">
        <button
          onClick={() => setStep(Math.max(1, step - 1))}
          disabled={step === 1}
          className="text-on-surface-variant text-[14px] font-semibold px-6 py-3 rounded-lg hover:bg-surface-container-low transition-colors disabled:opacity-50"
        >
          Back
        </button>
        <button
          onClick={() => setStep(Math.min(11, step + 1))}
          className="bg-primary text-on-primary text-[14px] font-semibold px-8 py-3 rounded-lg hover:bg-primary/90 transition-colors shadow-sm flex items-center gap-2"
        >
          Next Step
          <span className="material-symbols-outlined text-sm">arrow_forward</span>
        </button>
      </div>
    </div>
  )
}
