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

export async function fetchUserBreedingData(
  client: SupabaseClient,
  userId: string
): Promise<UserBreedingData> {
  const { data, error } = await client
    .from('user_breeding_data')
    .select('growth_entries, species_inventory, pairings, pest_risks')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) return { ...EMPTY_USER_BREEDING_DATA };
  return rowToUserBreedingData(data as DbUserBreedingData);
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
    throw new Error(error.message);
  }
}

export async function deleteUserBreedingData(client: SupabaseClient, userId: string): Promise<void> {
  const { error } = await client.from('user_breeding_data').delete().eq('user_id', userId);

  if (error) {
    throw new Error(error.message);
  }
}
