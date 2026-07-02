import type { Beetle, BeetleSex, BeetleStatus, LarvalInstar } from '@/types';
import type { DbBeetle, DbBeetleInsert, BeetleProfileMeta } from '@/types/database';

function buildNotesMeta(beetle: Beetle): string {
  const meta: BeetleProfileMeta = {
    name: beetle.name,
    sex: beetle.sex,
    status: beetle.status,
    instarStage: beetle.status === 'larva' ? beetle.instarStage : undefined,
    generation: beetle.generation,
    origin: beetle.origin,
    sizeMm: beetle.sizeMm > 0 ? beetle.sizeMm : undefined,
    color: beetle.color,
    notes: beetle.notes,
    source: beetle.source,
    bloodline: beetle.bloodline,
  };
  return JSON.stringify(meta);
}

function beetlePayload(beetle: Beetle) {
  return {
    species: beetle.species || beetle.name,
    inventory_counts: {} as import('@/types/database-json').Json,
    larval_growth_track: null,
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
  const sex = (meta?.sex as BeetleSex | undefined) ?? 'unknown';
  const status = (meta?.status as BeetleStatus | undefined) ?? 'larva';

  return {
    id: row.id,
    name: meta?.name ?? row.species ?? 'Unnamed',
    species: row.species,
    sex,
    status,
    instarStage:
      status === 'larva' &&
      (meta?.instarStage === 'L1' || meta?.instarStage === 'L2' || meta?.instarStage === 'L3')
        ? meta.instarStage
        : undefined,
    generation: meta?.generation ?? '',
    origin: meta?.origin === 'CB' || meta?.origin === 'WC' ? meta.origin : '',
    sizeMm: typeof meta?.sizeMm === 'number' && meta.sizeMm > 0 ? meta.sizeMm : 0,
    color: meta?.color ?? '',
    notes: meta?.notes ?? '',
    source: meta?.source ?? '',
    bloodline: meta?.bloodline ?? '',
    createdAt: row.created_at.slice(0, 10),
  };
}

export function dbBeetlesToBeetles(rows: DbBeetle[]): Beetle[] {
  return rows.map(dbBeetleToBeetle);
}

export function parseBeetleMeta(notes: string | null): BeetleProfileMeta | null {
  if (!notes?.trim()) return null;
  try {
    const parsed = JSON.parse(notes) as BeetleProfileMeta & Record<string, unknown>;
    return {
      name: parsed.name ?? 'Unnamed',
      sex: parsed.sex,
      status: parsed.status,
      instarStage:
        parsed.instarStage === 'L1' || parsed.instarStage === 'L2' || parsed.instarStage === 'L3'
          ? parsed.instarStage
          : undefined,
      generation: parsed.generation,
      origin: parsed.origin === 'CB' || parsed.origin === 'WC' ? parsed.origin : '',
      sizeMm: typeof parsed.sizeMm === 'number' && parsed.sizeMm > 0 ? parsed.sizeMm : undefined,
      color: typeof parsed.color === 'string' ? parsed.color : '',
      notes: parsed.notes ?? '',
      source: parsed.source ?? '',
      bloodline: parsed.bloodline ?? '',
    };
  } catch {
    return { name: notes, notes: '' };
  }
}

export function dbBeetleDisplayName(row: DbBeetle): string {
  const meta = parseBeetleMeta(row.notes);
  return meta?.name || row.species || 'Unnamed';
}
