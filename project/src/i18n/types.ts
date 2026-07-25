export type Locale = 'en' | 'ko';

export const LOCALES: { code: Locale; label: string; nativeLabel: string }[] = [
  { code: 'en', label: 'English', nativeLabel: 'English' },
  { code: 'ko', label: 'Korean', nativeLabel: '한국어' },
];

export const DEFAULT_LOCALE: Locale = 'en';
export const LOCALE_STORAGE_KEY = 'beetle-intel-locale';

export type MessageTree = { [key: string]: string | MessageTree };

export function getMessage(tree: MessageTree, path: string): string {
  const parts = path.split('.');
  let current: string | MessageTree = tree;

  for (const part of parts) {
    if (typeof current === 'string' || current == null || !(part in current)) {
      return path;
    }
    current = current[part];
  }

  return typeof current === 'string' ? current : path;
}

export function interpolate(
  template: string,
  values?: Record<string, string | number>
): string {
  if (!values) return template;
  return template.replace(/\{(\w+)\}/g, (_, key: string) =>
    values[key] !== undefined ? String(values[key]) : `{${key}}`
  );
}
