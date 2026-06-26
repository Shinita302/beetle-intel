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

const MAX_BEETLE_SIZE_MM = 300;
const MAX_BEETLE_COLOR_LENGTH = 120;

export function normalizeBeetleColor(raw: string): string {
  return raw.trim().slice(0, MAX_BEETLE_COLOR_LENGTH);
}

export function normalizeBeetleSizeMm(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.round(value * 10) / 10;
}

export function beetleSizeMmError(value: number): string | undefined {
  if (!Number.isFinite(value) || value <= 0) return undefined;
  if (value > MAX_BEETLE_SIZE_MM) {
    return `Size must be ${MAX_BEETLE_SIZE_MM} mm or less.`;
  }
  return undefined;
}

export function beetleColorError(raw: string): string | undefined {
  if (raw.trim().length > MAX_BEETLE_COLOR_LENGTH) {
    return `Color must be ${MAX_BEETLE_COLOR_LENGTH} characters or less.`;
  }
  return undefined;
}

export function formatBeetleSizeMm(sizeMm: number): string {
  if (!Number.isFinite(sizeMm) || sizeMm <= 0) return '—';
  const rounded = Number.isInteger(sizeMm) ? String(sizeMm) : sizeMm.toFixed(1);
  return `${rounded} mm`;
}
