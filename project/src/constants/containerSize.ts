import type { ContainerSizeUnit } from '../types';

export const CONTAINER_SIZE_UNITS: { value: ContainerSizeUnit; label: string }[] = [
  { value: 'cc', label: 'cc' },
  { value: 'mL', label: 'mL' },
  { value: 'L', label: 'L' },
  { value: 'gallons', label: 'gallons' },
];

export function formatContainerSize(value: number, unit: ContainerSizeUnit): string {
  if (!value) return '—';
  return `${value} ${unit}`;
}

export function parseLegacyContainerSize(raw: string): { value: number; unit: ContainerSizeUnit } {
  const normalized = raw.trim().toLowerCase();
  const gallonMatch = normalized.match(/([\d.]+)\s*gal/);
  if (gallonMatch) {
    return { value: parseFloat(gallonMatch[1]) || 0, unit: 'gallons' };
  }

  const literMatch = normalized.match(/([\d.]+)\s*l/);
  if (literMatch) {
    return { value: parseFloat(literMatch[1]) || 0, unit: 'L' };
  }

  const mlMatch = normalized.match(/([\d.]+)\s*ml/);
  if (mlMatch) {
    return { value: parseFloat(mlMatch[1]) || 0, unit: 'mL' };
  }

  const ccMatch = normalized.match(/([\d.]+)\s*cc/);
  if (ccMatch) {
    return { value: parseFloat(ccMatch[1]) || 0, unit: 'cc' };
  }

  const numeric = parseFloat(normalized);
  if (!Number.isNaN(numeric)) {
    return { value: numeric, unit: 'mL' };
  }

  return { value: 500, unit: 'mL' };
}
