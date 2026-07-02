import { STORAGE_KEYS, userStorageKey } from '@/constants/storageKeys';
import type { PestRisk } from '@/types';
import type { UserBreedingData } from '@/lib/userBreedingData';
import {
  normalizeGrowthEntries,
  normalizePairings,
  normalizeSpeciesInventory,
} from '@/utils/migrateLegacyData';

function readJsonArray<T>(key: string, normalize: (rows: unknown[]) => T[]): T[] {
  if (typeof window === 'undefined') return [];
  const stored = window.localStorage.getItem(key);
  if (!stored) return [];
  try {
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? normalize(parsed) : [];
  } catch {
    return [];
  }
}

/** Read breeding data stored only in this browser's localStorage (pre-Supabase sync). */
export function readLegacyLocalAppData(userId: string): UserBreedingData {
  const growthKey = userStorageKey(STORAGE_KEYS.growthEntries, userId);
  let growthEntries = readJsonArray(growthKey, normalizeGrowthEntries);
  if (growthEntries.length === 0) {
    growthEntries = readJsonArray(
      userStorageKey(STORAGE_KEYS.larvalRecords, userId),
      normalizeGrowthEntries
    );
  }

  return {
    growthEntries,
    speciesInventory: readJsonArray(
      userStorageKey(STORAGE_KEYS.speciesInventory, userId),
      normalizeSpeciesInventory
    ),
    pairings: readJsonArray(userStorageKey(STORAGE_KEYS.pairings, userId), normalizePairings),
    pestRisks: readJsonArray(userStorageKey(STORAGE_KEYS.pestRisks, userId), (rows) => rows as PestRisk[]),
  };
}
