/** All localStorage keys used by BeetleIntel. */
export const STORAGE_KEYS = {
  beetles: 'beetle-intel-beetles',
  growthEntries: 'beetle-intel-growth-entries',
  /** @deprecated migrated to growthEntries */
  larvalRecords: 'beetle-intel-larval',
  speciesInventory: 'beetle-intel-species-inventory',
  pairings: 'beetle-intel-pairings',
  pestRisks: 'beetle-intel-pests',
} as const;

export const ALL_STORAGE_KEYS = Object.values(STORAGE_KEYS);

export function userStorageKey(baseKey: string, userId: string): string {
  return `${baseKey}:${userId}`;
}
