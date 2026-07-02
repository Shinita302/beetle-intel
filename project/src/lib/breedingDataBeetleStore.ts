import type { SupabaseClient } from '@supabase/supabase-js';
import type { DbBeetle } from '@/types/database';
import type { Beetle } from '@/types';
import {
  EMPTY_USER_BREEDING_DATA,
  normalizeUserBreedingData,
  type UserBreedingData,
} from '@/lib/userBreedingData';

/** Hidden beetle row used to sync breeding data when user_breeding_data table is unavailable. */
export const BREEDING_SYNC_SPECIES = '__BEETLE_INTEL_BREEDING_SYNC__';

interface BreedingSyncPayload {
  __breedingSync: true;
  version: 1;
  growthEntries: UserBreedingData['growthEntries'];
  speciesInventory: UserBreedingData['speciesInventory'];
  pairings: UserBreedingData['pairings'];
  pestRisks: UserBreedingData['pestRisks'];
}

export function isBreedingSyncRow(row: Pick<DbBeetle, 'species'> | Pick<Beetle, 'species'>): boolean {
  return row.species === BREEDING_SYNC_SPECIES;
}

function parseBreedingSyncPayload(notes: string | null): UserBreedingData | null {
  if (!notes?.trim()) return null;
  try {
    const parsed = JSON.parse(notes) as Partial<BreedingSyncPayload>;
    if (parsed.__breedingSync !== true) return null;
    return normalizeUserBreedingData({
      growthEntries: parsed.growthEntries,
      speciesInventory: parsed.speciesInventory,
      pairings: parsed.pairings,
      pestRisks: parsed.pestRisks,
    });
  } catch {
    return null;
  }
}

export async function fetchBreedingDataFromBeetleStore(
  client: SupabaseClient,
  userId: string
): Promise<UserBreedingData> {
  const { data, error } = await client
    .from('beetles')
    .select('notes')
    .eq('user_id', userId)
    .eq('species', BREEDING_SYNC_SPECIES)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) return { ...EMPTY_USER_BREEDING_DATA };
  return parseBreedingSyncPayload(data.notes) ?? { ...EMPTY_USER_BREEDING_DATA };
}

export async function upsertBreedingDataToBeetleStore(
  client: SupabaseClient,
  userId: string,
  data: UserBreedingData
): Promise<void> {
  const normalized = normalizeUserBreedingData(data);
  const payload: BreedingSyncPayload = {
    __breedingSync: true,
    version: 1,
    ...normalized,
  };
  const notes = JSON.stringify(payload);

  const { data: existing, error: readError } = await client
    .from('beetles')
    .select('id')
    .eq('user_id', userId)
    .eq('species', BREEDING_SYNC_SPECIES)
    .maybeSingle();

  if (readError) {
    throw new Error(readError.message);
  }

  if (existing?.id) {
    const { error } = await client
      .from('beetles')
      .update({ notes, inventory_counts: {}, larval_growth_track: null })
      .eq('id', existing.id)
      .eq('user_id', userId);

    if (error) throw new Error(error.message);
    return;
  }

  const { error } = await client.from('beetles').insert({
    user_id: userId,
    species: BREEDING_SYNC_SPECIES,
    notes,
    inventory_counts: {},
    larval_growth_track: null,
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function deleteBreedingDataFromBeetleStore(
  client: SupabaseClient,
  userId: string
): Promise<void> {
  const { error } = await client
    .from('beetles')
    .delete()
    .eq('user_id', userId)
    .eq('species', BREEDING_SYNC_SPECIES);

  if (error) {
    throw new Error(error.message);
  }
}
