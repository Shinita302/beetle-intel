import type { Beetle } from '@/types';
import type { DbBeetle, DbBeetleInsert, BeetleProfileMeta } from '@/types/database';
import type { LarvalGrowthStageEntry } from '@/utils/spreadsheetMetrics';
import type { LifecycleStage } from '@/types/lifecycle';

function buildLarvalGrowthTrack(beetle: Beetle): LarvalGrowthStageEntry[] | null {
  const entries: LarvalGrowthStageEntry[] = [];
  const stages: { stage: LifecycleStage; weight: number }[] = [
    { stage: 'L1', weight: beetle.instarWeights.l1 },
    { stage: 'L2', weight: beetle.instarWeights.l2 },
    { stage: 'L3', weight: beetle.instarWeights.l3 },
  ];

  for (const { stage, weight } of stages) {
    if (weight > 0) {
      entries.push({
        stage,
        date: beetle.createdAt || null,
        weightGrams: weight,
        sizeMm: null,
        notes: beetle.stageNotes[stage === 'L1' ? 'l1' : stage === 'L2' ? 'l2' : 'l3'] ?? '',
      });
    }
  }

  if (beetle.adultWeight > 0 || beetle.adultSize > 0) {
    entries.push({
      stage: 'adult',
      date: beetle.emergenceDate || beetle.createdAt || null,
      weightGrams: beetle.adultWeight > 0 ? beetle.adultWeight : null,
      sizeMm: beetle.adultSize > 0 ? beetle.adultSize : null,
      notes: beetle.stageNotes.adult ?? '',
    });
  }

  return entries.length > 0 ? entries : null;
}

function buildNotesMeta(beetle: Beetle): string {
  const meta: BeetleProfileMeta = {
    name: beetle.name,
    sex: beetle.sex,
    status: beetle.status,
    generation: beetle.generation,
    stageNotes: beetle.stageNotes,
  };
  return JSON.stringify(meta);
}

export function beetleToDbInsert(beetle: Beetle, userId: string): DbBeetleInsert {
  return {
    user_id: userId,
    species: beetle.species || beetle.name,
    inventory_counts: beetle.inventoryCounts as unknown as import('@/types/database').Json,
    larval_growth_track: buildLarvalGrowthTrack(beetle) as unknown as import('@/types/database').Json | null,
    notes: buildNotesMeta(beetle),
  };
}

export function parseBeetleMeta(notes: string | null): BeetleProfileMeta | null {
  if (!notes?.trim()) return null;
  try {
    return JSON.parse(notes) as BeetleProfileMeta;
  } catch {
    return { name: notes };
  }
}

export function dbBeetleDisplayName(row: DbBeetle): string {
  const meta = parseBeetleMeta(row.notes);
  return meta?.name || row.species || 'Unnamed';
}
