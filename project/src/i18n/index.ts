import en from './locales/en';
import ko from './locales/ko';
import {
  DEFAULT_LOCALE,
  getMessage,
  interpolate,
  type Locale,
  type MessageTree,
} from './types';

export { DEFAULT_LOCALE, LOCALES, LOCALE_STORAGE_KEY, type Locale } from './types';

const dictionaries: Record<Locale, MessageTree> = {
  en,
  ko,
};

export function t(
  locale: Locale,
  key: string,
  values?: Record<string, string | number>
): string {
  const dict = dictionaries[locale] ?? dictionaries[DEFAULT_LOCALE];
  const fallback = dictionaries[DEFAULT_LOCALE];
  const message = getMessage(dict, key);
  const resolved = message === key ? getMessage(fallback, key) : message;
  return interpolate(resolved, values);
}

export function isLocale(value: string | null | undefined): value is Locale {
  return value === 'en' || value === 'ko';
}
