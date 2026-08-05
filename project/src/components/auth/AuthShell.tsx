'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';

interface AuthShellProps {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function AuthShell({ title, subtitle, children, footer }: AuthShellProps) {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <p className="text-xs font-mono text-sky-400/80 mb-2">{t('brand.name')}</p>
          <h1 className="text-2xl font-bold text-gray-100">{title}</h1>
          <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
        </div>

        <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-6 shadow-xl shadow-black/20">
          {children}
        </div>

        {footer && <div className="mt-6 text-center text-sm text-gray-500">{footer}</div>}

        <p className="mt-8 text-center text-[11px] text-gray-600">
          <Link href="/" className="hover:text-gray-400 transition-colors">
            {t('common.backHome')}
          </Link>
        </p>
      </div>
    </div>
  );
}

export function AuthError({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300"
    >
      {message}
    </div>
  );
}

export function AuthField({
  label,
  id,
  type = 'text',
  value,
  onChange,
  autoComplete,
  required = true,
}: {
  label: string;
  id: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  required?: boolean;
}) {
  return (
    <div className="mb-4">
      <label htmlFor={id} className="block text-xs font-medium text-gray-400 mb-1.5">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        required={required}
        className="w-full rounded-lg border border-gray-700 bg-gray-800/80 px-3 py-2.5 text-sm text-gray-100 placeholder:text-gray-600 focus:outline-none focus:ring-1 focus:ring-sky-500/50 focus:border-sky-500/50"
      />
    </div>
  );
}

export function AuthButton({
  children,
  type = 'submit',
  variant = 'primary',
  disabled,
  onClick,
}: {
  children: ReactNode;
  type?: 'submit' | 'button';
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  onClick?: () => void;
}) {
  const classes =
    variant === 'primary'
      ? 'bg-sky-600 hover:bg-sky-500 text-white border-sky-500/30'
      : 'bg-gray-800 hover:bg-gray-700 text-gray-200 border-gray-700';

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`w-full rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${classes}`}
    >
      {children}
    </button>
  );
}
