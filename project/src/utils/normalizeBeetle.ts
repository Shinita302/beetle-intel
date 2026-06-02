import type { Beetle, BeetleInstarWeights, BeetleInventoryCounts, BeetleSex, BeetleStageNotes } from '../types';
import { emptyInventoryCounts, latestInstarWeight } from '../types';
import { cellHasWeightUnit } from './spreadsheetMetrics';

type LegacyBeetle = Partial<Beetle> & {
  parentPair?: string;
  larvalSize?: number;
};

function parseParentPair(parentPair: string): { fatherParent: string; motherParent: string } {
  const parts = parentPair.split(/[×x]/).map((s) => s.trim()).filter(Boolean);
  return {
    fatherParent: parts[0] ?? '',
    motherParent: parts[1] ?? '',
  };
}

function normalizeSex(sex: unknown): BeetleSex {
  if (sex === 'male' || sex === 'female' || sex === 'unknown') {
    return sex;
  }
  return 'unknown';
}

function normalizeStageNotes(raw: Partial<BeetleStageNotes> | undefined): BeetleStageNotes {
  return {
    egg: raw?.egg ?? '',
    l1: raw?.l1 ?? '',
    l2: raw?.l2 ?? '',
    l3: raw?.l3 ?? '',
    pupa: raw?.pupa ?? '',
    adult: raw?.adult ?? '',
  };
}

function normalizeInventoryCounts(raw: Partial<BeetleInventoryCounts> | undefined): BeetleInventoryCounts {
  return {
    egg: raw?.egg ?? 0,
    l1: raw?.l1 ?? 0,
    l2: raw?.l2 ?? 0,
    l3: raw?.l3 ?? 0,
    pupa: raw?.pupa ?? 0,
    adult: raw?.adult ?? 0,
  };
}

function normalizeInstarWeights(
  raw: Partial<BeetleInstarWeights> | undefined,
  legacyLarvalWeight: number,
  stageNotes: BeetleStageNotes
): BeetleInstarWeights {
  const weights: BeetleInstarWeights = {
    l1: raw?.l1 ?? 0,
    l2: raw?.l2 ?? 0,
    l3: raw?.l3 ?? 0,
  };
  if (latestInstarWeight(weights) === 0 && legacyLarvalWeight > 0) {
    weights.l3 = legacyLarvalWeight;
  }

  for (const key of ['l1', 'l2', 'l3'] as const) {
    const note = stageNotes[key]?.trim() ?? '';
    if (weights[key] > 0 && note && !cellHasWeightUnit(note) && !/\d\s*g\b/i.test(note)) {
      const bare = note.match(/^Count:\s*(\d+)/i) || note.match(/^(\d+)$/);
      if (bare) {
        weights[key] = 0;
      }
    }
  }

  return weights;
}

export function normalizeBeetle(raw: LegacyBeetle): Beetle {
  const { parentPair, larvalSize, ...rest } = raw;
  void larvalSize;
  let fatherParent = rest.fatherParent ?? '';
  let motherParent = rest.motherParent ?? '';

  if (!fatherParent && !motherParent && parentPair) {
    const parsed = parseParentPair(parentPair);
    fatherParent = parsed.fatherParent;
    motherParent = parsed.motherParent;
  }

  const stageNotes = normalizeStageNotes(rest.stageNotes);
  const inventoryCounts = normalizeInventoryCounts(rest.inventoryCounts ?? emptyInventoryCounts());
  const instarWeights = normalizeInstarWeights(rest.instarWeights, rest.larvalWeight ?? 0, stageNotes);

  return {
    id: rest.id ?? '',
    name: rest.name ?? '',
    species: rest.species ?? '',
    sex: normalizeSex(rest.sex),
    source: rest.source ?? '',
    generation: rest.generation != null ? String(rest.generation) : '',
    emergenceDate: rest.emergenceDate ?? '',
    instarWeights,
    inventoryCounts,
    larvalWeight: latestInstarWeight(instarWeights) || rest.larvalWeight || 0,
    adultSize: rest.adultSize ?? 0,
    adultWeight: rest.adultWeight ?? 0,
    bloodline: rest.bloodline ?? '',
    stageNotes,
    fatherParent,
    motherParent,
    status: rest.status ?? 'larva',
    isBigHitter: rest.isBigHitter ?? false,
    createdAt: rest.createdAt ?? '',
  };
}

export function normalizeBeetles(beetles: LegacyBeetle[]): Beetle[] {
  return beetles.map(normalizeBeetle);
}
