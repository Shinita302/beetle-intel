/** All localStorage keys used by BeetleIntel. */
export const STORAGE_KEYS = {
  beetles: 'beetle-intel-beetles',
  larvalRecords: 'beetle-intel-larval',
  pairings: 'beetle-intel-pairings',
  pestRisks: 'beetle-intel-pests',
  growthOverrides: 'beetle-intel-growth-overrides',
} as const;

export const ALL_STORAGE_KEYS = Object.values(STORAGE_KEYS);
