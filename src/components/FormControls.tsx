'use client';

import type { ReactNode } from 'react';

export function Card({
  title,
  subtitle,
  children,
  className = '',
}: {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`bg-surface rounded-2xl border border-outline-variant p-6 ${className}`}>
      {title && <h3 className="text-[16px] font-bold text-on-surface">{title}</h3>}
      {subtitle && <p className="text-[13px] text-on-surface-variant mt-1">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="text-[13px] font-semibold text-on-surface block mb-1.5">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-outline-variant bg-surface px-3.5 py-2.5 text-[14px] text-on-surface placeholder:text-on-surface-variant/60 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition"
      />
      {hint && <span className="text-[12px] text-on-surface-variant mt-1 block">{hint}</span>}
    </label>
  );
}

export function TextArea({
  label,
  value,
  onChange,
  rows = 3,
  placeholder,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  placeholder?: string;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="text-[13px] font-semibold text-on-surface block mb-1.5">{label}</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholder}
        className="w-full rounded-xl border border-outline-variant bg-surface px-3.5 py-2.5 text-[14px] text-on-surface placeholder:text-on-surface-variant/60 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition resize-y"
      />
      {hint && <span className="text-[12px] text-on-surface-variant mt-1 block">{hint}</span>}
    </label>
  );
}

export function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-[13px] font-semibold text-on-surface block mb-1.5">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-outline-variant bg-surface px-3.5 py-2.5 text-[14px] text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition appearance-none cursor-pointer"
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function ChoiceChip({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-4 py-2 text-[13px] font-semibold border transition ${
        selected
          ? 'bg-primary text-white border-primary shadow-sm'
          : 'bg-surface text-on-surface-variant border-outline-variant hover:border-primary hover:text-primary'
      }`}
    >
      {children}
    </button>
  );
}

export function PrimaryButton({
  children,
  onClick,
  disabled,
  className = '',
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-[14px] font-semibold text-white hover:bg-primary-dark disabled:opacity-40 disabled:cursor-not-allowed transition ${className}`}
    >
      {children}
    </button>
  );
}

export function SecondaryButton({
  children,
  onClick,
  disabled,
  className = '',
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-2 rounded-xl border border-outline-variant bg-surface px-5 py-2.5 text-[14px] font-semibold text-on-surface hover:border-primary hover:text-primary disabled:opacity-40 disabled:cursor-not-allowed transition ${className}`}
    >
      {children}
    </button>
  );
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'primary' | 'success' | 'warn' }) {
  const tones = {
    neutral: 'bg-surface-container text-on-surface-variant border border-outline-variant',
    primary: 'bg-primary/10 text-primary border border-primary/20',
    success: 'bg-[#e8f5ee] text-[#137a4b] border border-[#137a4b]/20',
    warn: 'bg-[#fef3e7] text-[#b45309] border border-[#b45309]/20',
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[12px] font-semibold ${tones[tone]}`}>
      {children}
    </span>
  );
}