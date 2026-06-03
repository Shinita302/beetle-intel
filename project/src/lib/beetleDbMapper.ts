import type { Beetle, BeetleSex, BeetleStatus } from '@/types';
import { emptyInstarWeights, emptyStageNotes, latestInstarWeight } from '@/types';
import type { DbBeetle, DbBeetleInsert, BeetleProfileMeta } from '@/types/database';
import { parseInventoryCounts } from '@/types/database';
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
    source: beetle.source,
    emergenceDate: beetle.emergenceDate,
    bloodline: beetle.bloodline,
    fatherParent: beetle.fatherParent,
    motherParent: beetle.motherParent,
    isBigHitter: beetle.isBigHitter,
    adultSize: beetle.adultSize,
    adultWeight: beetle.adultWeight,
  };
  return JSON.stringify(meta);
}

function parseGrowthTrack(json: DbBeetle['larval_growth_track']): LarvalGrowthStageEntry[] | null {
  if (!json || !Array.isArray(json)) return null;
  return json as unknown as LarvalGrowthStageEntry[];
}

function growthTrackToInstarWeights(track: LarvalGrowthStageEntry[] | null) {
  const weights = emptyInstarWeights();
  if (!track) return weights;
  for (const entry of track) {
    const grams = entry.weightGrams ?? 0;
    if (entry.stage === 'L1' && grams > 0) weights.l1 = grams;
    if (entry.stage === 'L2' && grams > 0) weights.l2 = grams;
    if (entry.stage === 'L3' && grams > 0) weights.l3 = grams;
  }
  return weights;
}

function beetlePayload(beetle: Beetle) {
  return {
    species: beetle.species || beetle.name,
    inventory_counts: beetle.inventoryCounts as unknown as import('@/types/database').Json,
    larval_growth_track: buildLarvalGrowthTrack(beetle) as unknown as import('@/types/database').Json | null,
    notes: buildNotesMeta(beetle),
  };
}

export function beetleToDbInsert(beetle: Beetle, userId: string): DbBeetleInsert {
  return { user_id: userId, ...beetlePayload(beetle) };
}

export function beetleToDbUpdate(beetle: Beetle): Omit<DbBeetleInsert, 'user_id'> {
  return beetlePayload(beetle);
}

export function dbBeetleToBeetle(row: DbBeetle): Beetle {
  const meta = parseBeetleMeta(row.notes);
  const track = parseGrowthTrack(row.larval_growth_track);
  const instarWeights = growthTrackToInstarWeights(track);
  const counts = parseInventoryCounts(row.inventory_counts);
  const adultEntry = track?.find((e) => e.stage === 'adult');

  const sex = (meta?.sex as BeetleSex | undefined) ?? 'unknown';
  const status = (meta?.status as BeetleStatus | undefined) ?? 'larva';

  return {
    id: row.id,
    name: (meta?.name ?? row.species) || 'Unnamed',
    species: row.species,
    sex,
    source: meta?.source ?? '',
    generation: meta?.generation ?? '',
    emergenceDate: meta?.emergenceDate ?? adultEntry?.date ?? '',
    instarWeights,
    inventoryCounts: counts,
    larvalWeight: latestInstarWeight(instarWeights),
    adultSize: meta?.adultSize ?? adultEntry?.sizeMm ?? 0,
    adultWeight: meta?.adultWeight ?? adultEntry?.weightGrams ?? 0,
    bloodline: meta?.bloodline ?? '',
    stageNotes: meta?.stageNotes ?? emptyStageNotes(),
    fatherParent: meta?.fatherParent ?? '',
    motherParent: meta?.motherParent ?? '',
    status,
    isBigHitter: meta?.isBigHitter ?? false,
    createdAt: row.created_at.slice(0, 10),
  };
}

export function dbBeetlesToBeetles(rows: DbBeetle[]): Beetle[] {
  return rows.map(dbBeetleToBeetle);
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
