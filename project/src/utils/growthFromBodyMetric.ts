import type { Beetle, BeetleStatus, GrowthEntry, GrowthStage } from '@/types';
import { beetleUsesWeightMetric } from '@/utils/beetleProfileValidation';

function stageForStatus(status: BeetleStatus): GrowthStage | null {
  if (status === 'larva') return 'L3';
  if (status === 'pupa') return 'Pupa';
  return null;
}

export function buildGrowthEntryFromBodyMetric(
  beetle: Beetle,
  existingEntryCount: number,
  date = new Date().toISOString().slice(0, 10)
): GrowthEntry | null {
  if (!beetleUsesWeightMetric(beetle.status)) return null;
  if (!Number.isFinite(beetle.sizeMm) || beetle.sizeMm <= 0) return null;

  const stage = stageForStatus(beetle.status);
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
  if (previous.status !== next.status && beetleUsesWeightMetric(next.status)) return true;
  return false;
}
