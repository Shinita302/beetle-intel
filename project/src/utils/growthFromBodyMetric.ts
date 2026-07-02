import type { Beetle, BeetleStatus, GrowthEntry, GrowthStage, LarvalInstar } from '@/types';
import { beetleUsesWeightMetric } from '@/utils/beetleProfileValidation';

function stageForBeetle(beetle: Beetle): GrowthStage | null {
  if (beetle.status === 'larva') {
    return beetle.instarStage ?? 'L3';
  }
  if (beetle.status === 'pupa') return 'Pupa';
  return null;
}

export function buildGrowthEntryFromBodyMetric(
  beetle: Beetle,
  existingEntryCount: number,
  date = new Date().toISOString().slice(0, 10)
): GrowthEntry | null {
  if (!beetleUsesWeightMetric(beetle.status)) return null;
  if (!Number.isFinite(beetle.sizeMm) || beetle.sizeMm <= 0) return null;

  const stage = stageForBeetle(beetle);
  if (!stage) return null;

  return {
    id: `GE-${String(existingEntryCount + 1).padStart(3, '0')}`,
    beetleId: beetle.id,
    date,
    stage,
    weight: beetle.sizeMm,
    temperature: 0,
    humidity: 0,
    substrate: '',
    notes: 'Recorded from beetle profile',
    createdAt: date,
  };
}

export function shouldRecordBodyMetricGrowth(
  previous: Beetle | null,
  next: Beetle
): boolean {
  if (!beetleUsesWeightMetric(next.status)) return false;
  if (!Number.isFinite(next.sizeMm) || next.sizeMm <= 0) return false;
  if (!previous) return true;
  if (previous.sizeMm !== next.sizeMm) return true;
  if (previous.instarStage !== next.instarStage) return true;
  if (previous.status !== next.status && beetleUsesWeightMetric(next.status)) return true;
  return false;
}

export function latestLarvalInstarFromGrowth(
  beetleId: string,
  growthEntries: GrowthEntry[]
): LarvalInstar | undefined {
  const instars: LarvalInstar[] = ['L1', 'L2', 'L3'];
  const latest = growthEntries
    .filter((entry) => entry.beetleId === beetleId && instars.includes(entry.stage as LarvalInstar))
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))[0];

  if (!latest) return undefined;
  return latest.stage as LarvalInstar;
}
