'use client';

import { useEffect, useRef, useState } from 'react';

interface FormFieldProps {
  label: string;
  children: React.ReactNode;
  required?: boolean;
  className?: string;
  error?: string;
  hint?: string;
}

export function FormField({
  label,
  children,
  required = false,
  className = '',
  error,
  hint,
}: FormFieldProps) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label className="text-xs font-medium text-gray-400">
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
      {hint && !error && <p className="text-[11px] text-gray-500 leading-snug">{hint}</p>}
      {error && <p className="text-[11px] text-red-400 leading-snug">{error}</p>}
    </div>
  );
}

export function TextInput({
  value,
  onChange,
  placeholder,
  type = 'text',
  required = false,
  invalid = false,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
  invalid?: boolean;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      required={required}
      aria-invalid={invalid || undefined}
      className={`w-full bg-gray-800/80 border rounded-lg px-3 py-2 text-sm text-gray-200 placeholder:text-gray-600 focus:outline-none focus:ring-1 transition-colors ${
        invalid
          ? 'border-red-500/60 focus:ring-red-500/40 focus:border-red-500/60'
          : 'border-gray-700 focus:ring-sky-500/50 focus:border-sky-500/50'
      }`}
    />
  );
}

export function SelectInput({
  value,
  onChange,
  options,
  placeholder,
  required = false,
  invalid = false,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  required?: boolean;
  invalid?: boolean;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required={required}
      aria-invalid={invalid || undefined}
      className={`w-full bg-gray-800/80 border rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-1 transition-colors appearance-none ${
        invalid
          ? 'border-red-500/60 focus:ring-red-500/40 focus:border-red-500/60'
          : 'border-gray-700 focus:ring-sky-500/50 focus:border-sky-500/50'
      }`}
    >
      {placeholder && (
        <option value="" disabled>
          {placeholder}
        </option>
      )}
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

function formatNumberDisplay(value: number | string): string {
  const n = typeof value === 'number' ? value : parseFloat(String(value));
  if (Number.isNaN(n) || n === 0) return '';
  return Number.isInteger(n) ? String(n) : String(n);
}

function parseNumberInput(raw: string, integersOnly: boolean): number | null {
  const trimmed = raw.trim();
  if (trimmed === '' || trimmed === '-') return null;

  if (integersOnly) {
    if (!/^\d+$/.test(trimmed)) return null;
    return parseInt(trimmed, 10);
  }

  if (!/^\d*\.?\d+$/.test(trimmed)) return null;
  const parsed = parseFloat(trimmed);
  return Number.isNaN(parsed) ? null : parsed;
}

function clampNumber(n: number, min?: number, max?: number): number {
  let result = n;
  if (min !== undefined) result = Math.max(min, result);
  if (max !== undefined) result = Math.min(max, result);
  return result;
}

export function NumberInput({
  value,
  onChange,
  placeholder,
  min,
  max,
  step,
  required = false,
}: {
  value: number | string;
  onChange: (v: number) => void;
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
  required?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(() => formatNumberDisplay(value));
  const integersOnly = step === 1 && min === 0;

  useEffect(() => {
    if (document.activeElement === inputRef.current) return;
    setText(formatNumberDisplay(value));
  }, [value]);

  const commit = (raw: string) => {
    const parsed = parseNumberInput(raw, integersOnly);
    if (parsed === null) {
      onChange(0);
      setText('');
      return;
    }

    const final = clampNumber(parsed, min, max);
    onChange(final);
    setText(final === 0 ? '' : formatNumberDisplay(final));
  };

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode={integersOnly ? 'numeric' : 'decimal'}
      value={text}
      onChange={(e) => {
        const raw = e.target.value;
        if (raw === '') {
          setText('');
          onChange(0);
          return;
        }

        if (integersOnly && !/^\d*$/.test(raw)) return;
        if (!integersOnly && !/^\d*\.?\d*$/.test(raw)) return;

        setText(raw);
        const parsed = parseNumberInput(raw, integersOnly);
        if (parsed !== null) {
          onChange(clampNumber(parsed, min, max));
        }
      }}
      onBlur={() => commit(text)}
      placeholder={placeholder ?? '0'}
      min={min}
      max={max}
      step={step}
      required={required}
      className="w-full bg-gray-800/80 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder:text-gray-600 focus:outline-none focus:ring-1 focus:ring-sky-500/50 focus:border-sky-500/50 transition-colors"
    />
  );
}
