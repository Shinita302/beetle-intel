import type { BeetleOrigin } from '@/types';

const BEETLE_GENERATION_RE = /^F\d+$/i;

export const BEETLE_ORIGIN_OPTIONS: { value: BeetleOrigin; label: string }[] = [
  { value: 'CB', label: 'Captive Bred (CB)' },
  { value: 'WC', label: 'Wild Caught (WC)' },
];

/** Normalize generation to uppercase F{digits}, or empty when blank. */
export function normalizeBeetleGeneration(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  const match = trimmed.match(/^F(\d+)$/i);
  if (!match) return trimmed;
  return `F${match[1]}`;
}

export function isValidBeetleGeneration(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) return true;
  return BEETLE_GENERATION_RE.test(trimmed);
}

export function beetleGenerationError(raw: string): string | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;

  if (/^(CB|WC)$/i.test(trimmed)) {
    return 'Use the Origin field for CB or WC. Generation should be F1, F2, F20, etc.';
  }

  if (!BEETLE_GENERATION_RE.test(trimmed)) {
    return 'Generation must be F followed by one or more digits (e.g. F1, F2, F20).';
  }

  return undefined;
}

export function isValidBeetleOrigin(raw: string): raw is BeetleOrigin {
  return raw === 'CB' || raw === 'WC';
}

export function beetleOriginError(raw: string): string | undefined {
  if (!raw) return 'Origin is required.';
  if (!isValidBeetleOrigin(raw)) return 'Select Captive Bred (CB) or Wild Caught (WC).';
  return undefined;
}
