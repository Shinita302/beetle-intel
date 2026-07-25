'use client';

import { LOCALES, type Locale } from '@/i18n';
import { useLanguage } from '@/contexts/LanguageContext';

export function LanguageSwitcher({ className = '' }: { className?: string }) {
  const { locale, setLocale, t } = useLanguage();

  return (
    <div
      className={`inline-flex items-center rounded-lg border border-gray-700 bg-gray-800/80 p-0.5 ${className}`}
      role="group"
      aria-label={t('common.language')}
    >
      {LOCALES.map((item) => {
        const active = locale === item.code;
        return (
          <button
            key={item.code}
            type="button"
            onClick={() => setLocale(item.code as Locale)}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
              active
                ? 'bg-sky-500/20 text-sky-300'
                : 'text-gray-500 hover:text-gray-300'
            }`}
            aria-pressed={active}
          >
            {item.code === 'en' ? 'EN' : '한국어'}
          </button>
        );
      })}
    </div>
  );
}
