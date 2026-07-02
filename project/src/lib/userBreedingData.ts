import type { Json } from '@/types/database-json';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { GrowthEntry, Pairing, PestRisk, SpeciesInventory } from '@/types';
import type { DbUserBreedingData } from '@/types/database';
import {
  normalizeGrowthEntries,
  normalizePairings,
  normalizeSpeciesInventory,
} from '@/utils/migrateLegacyData';

export interface UserBreedingData {
  growthEntries: GrowthEntry[];
  speciesInventory: SpeciesInventory[];
  pairings: Pairing[];
  pestRisks: PestRisk[];
}

export const EMPTY_USER_BREEDING_DATA: UserBreedingData = {
  growthEntries: [],
  speciesInventory: [],
  pairings: [],
  pestRisks: [],
};

/** True when Supabase has not been migrated with user_breeding_data yet. */
export function isBreedingDataTableUnavailable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const message = (error.message ?? '').toLowerCase();
  return (
    error.code === '42P01' ||
    error.code === 'PGRST205' ||
    error.code === 'PGRST204' ||
    (message.includes('user_breeding_data') &&
      (message.includes('does not exist') ||
        message.includes('not found') ||
        message.includes('schema cache') ||
        message.includes('could not find')))
  );
}

export const BREEDING_DATA_MIGRATION_HINT =
  'Run supabase/migrations/002_user_breeding_data.sql in the Supabase SQL Editor to enable cross-browser sync.';

export function normalizeUserBreedingData(raw: Partial<UserBreedingData> | null | undefined): UserBreedingData {
  if (!raw) return { ...EMPTY_USER_BREEDING_DATA };
  return {
    growthEntries: normalizeGrowthEntries((raw.growthEntries ?? []) as unknown[]),
    speciesInventory: normalizeSpeciesInventory((raw.speciesInventory ?? []) as SpeciesInventory[]),
    pairings: normalizePairings((raw.pairings ?? []) as unknown[]),
    pestRisks: Array.isArray(raw.pestRisks) ? (raw.pestRisks as PestRisk[]) : [],
  };
}

export function hasBreedingData(data: UserBreedingData): boolean {
  return (
    data.growthEntries.length > 0 ||
    data.speciesInventory.length > 0 ||
    data.pairings.length > 0 ||
    data.pestRisks.length > 0
  );
}

function jsonArray(value: Json | null | undefined): unknown[] {
  return Array.isArray(value) ? value : [];
}

function rowToUserBreedingData(row: DbUserBreedingData): UserBreedingData {
  return {
    growthEntries: normalizeGrowthEntries(jsonArray(row.growth_entries)),
    speciesInventory: normalizeSpeciesInventory(jsonArray(row.species_inventory) as SpeciesInventory[]),
    pairings: normalizePairings(jsonArray(row.pairings)),
    pestRisks: jsonArray(row.pest_risks) as PestRisk[],
  };
}

export interface FetchUserBreedingDataResult {
  data: UserBreedingData;
  syncEnabled: boolean;
}

export async function fetchUserBreedingData(
  client: SupabaseClient,
  userId: string
): Promise<FetchUserBreedingDataResult> {
  const { data, error } = await client
    .from('user_breeding_data')
    .select('growth_entries, species_inventory, pairings, pest_risks')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    if (isBreedingDataTableUnavailable(error)) {
      return { data: { ...EMPTY_USER_BREEDING_DATA }, syncEnabled: false };
    }
    throw new Error(error.message);
  }

  if (!data) {
    return { data: { ...EMPTY_USER_BREEDING_DATA }, syncEnabled: true };
  }

  return { data: rowToUserBreedingData(data as DbUserBreedingData), syncEnabled: true };
}

export async function upsertUserBreedingData(
  client: SupabaseClient,
  userId: string,
  data: UserBreedingData
): Promise<void> {
  const normalized = normalizeUserBreedingData(data);
  const { error } = await client.from('user_breeding_data').upsert(
    {
      user_id: userId,
      growth_entries: normalized.growthEntries,
      species_inventory: normalized.speciesInventory,
      pairings: normalized.pairings,
      pest_risks: normalized.pestRisks,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  );

  if (error) {
    if (isBreedingDataTableUnavailable(error)) {
      throw new Error(BREEDING_DATA_MIGRATION_HINT);
    }
    throw new Error(error.message);
  }
}

export async function deleteUserBreedingData(client: SupabaseClient, userId: string): Promise<void> {
  const { error } = await client.from('user_breeding_data').delete().eq('user_id', userId);

  if (error) {
    if (isBreedingDataTableUnavailable(error)) {
      return;
    }
    throw new Error(error.message);
  }
}
