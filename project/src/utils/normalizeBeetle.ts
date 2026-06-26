import type { Beetle, BeetleSex, BeetleStatus } from '../types';

type LegacyBeetle = Partial<Beetle> & {
  emergenceDate?: string;
  larvalWeight?: number;
  adultSize?: number;
  adultWeight?: number;
  fatherParent?: string;
  motherParent?: string;
  isBigHitter?: boolean;
  stageNotes?: Record<string, string>;
  instarWeights?: Record<string, number>;
  inventoryCounts?: Record<string, number>;
  parentPair?: string;
};

function normalizeSex(sex: unknown): BeetleSex {
  if (sex === 'male' || sex === 'female' || sex === 'unknown') {
    return sex;
  }
  return 'unknown';
}

export function normalizeBeetle(raw: LegacyBeetle): Beetle {
  return {
    id: raw.id ?? '',
    name: raw.name ?? '',
    species: raw.species ?? '',
    sex: normalizeSex(raw.sex),
    status: (raw.status as BeetleStatus | undefined) ?? 'larva',
    generation: raw.generation != null ? String(raw.generation) : '',
    origin: raw.origin === 'CB' || raw.origin === 'WC' ? raw.origin : '',
    notes: raw.notes ?? '',
    source: raw.source ?? '',
    bloodline: raw.bloodline ?? '',
    createdAt: raw.createdAt ?? '',
  };
}

export function normalizeBeetles(beetles: LegacyBeetle[]): Beetle[] {
  return beetles.map(normalizeBeetle);
}
