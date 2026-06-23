'use client';

import type { Beetle, GrowthEntry, Pairing, PestRisk, SpeciesInventory } from '@/types';
import type { DbBeetle } from '@/types/database';
import { dbBeetleToBeetle, dbBeetlesToBeetles } from '@/lib/beetleDbMapper';
import {
  deleteAllBeetlesForUser,
  insertBeetlesForUser,
  updateBeetleForUser,
} from '@/lib/beetles';
import { createClient } from '@/lib/supabase/client';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { STORAGE_KEYS, userStorageKey } from '@/constants/storageKeys';
import { pageToPath } from '@/lib/dashboardRoutes';
import { clearAllAppDataFromStorage } from '@/utils/clearAppData';
import {
  migrateDbRowsToSpeciesInventory,
  mergeSpeciesInventory,
  normalizeGrowthEntries,
  normalizePairings,
  normalizeSpeciesInventory,
} from '@/utils/migrateLegacyData';
import { remapGrowthEntriesToSavedBeetles, repairGrowthEntryBeetleIds } from '@/utils/importGrowthSheet';
import {
  mockBeetles,
  mockGrowthEntries,
  mockPairings,
  mockPestRisks,
  mockSpeciesInventory,
} from '@/data/mockData';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';

interface BeetleAppContextValue {
  userId: string;
  userEmail: string | undefined;
  beetles: Beetle[];
  growthEntries: GrowthEntry[];
  speciesInventory: SpeciesInventory[];
  pairings: Pairing[];
  pestRisks: PestRisk[];
  dataError: string;
  busy: boolean;
  addBeetle: (beetle: Beetle) => Promise<void>;
  updateBeetle: (beetle: Beetle) => Promise<void>;
  addGrowthEntry: (entry: GrowthEntry) => void;
  addGrowthEntries: (entries: GrowthEntry[]) => void;
  updateSpeciesInventory: (rows: SpeciesInventory[]) => void;
  upsertSpeciesInventory: (row: SpeciesInventory) => void;
  addPairing: (pairing: Pairing) => void;
  addPestRisk: (risk: PestRisk) => void;
  updatePestRisk: (risk: PestRisk) => void;
  importData: (payload: {
    beetles: Beetle[];
    growthEntries: GrowthEntry[];
    speciesInventory?: SpeciesInventory[];
  }) => Promise<void>;
  clearAllData: () => Promise<void>;
  restoreDemoData: () => Promise<void>;
  navigate: (page: string) => void;
}

const BeetleAppContext = createContext<BeetleAppContextValue | null>(null);

interface BeetleAppProviderProps {
  userId: string;
  userEmail: string | undefined;
  initialDbBeetles: DbBeetle[];
  children: ReactNode;
}

function readLegacyGrowthEntries(userId: string): GrowthEntry[] {
  if (typeof window === 'undefined') return [];
  const growthKey = userStorageKey(STORAGE_KEYS.growthEntries, userId);
  const stored = window.localStorage.getItem(growthKey);
  if (stored) {
    try {
      return normalizeGrowthEntries(JSON.parse(stored));
    } catch {
      return [];
    }
  }

  const legacyKey = userStorageKey(STORAGE_KEYS.larvalRecords, userId);
  const legacy = window.localStorage.getItem(legacyKey);
  if (!legacy) return [];
  try {
    return normalizeGrowthEntries(JSON.parse(legacy));
  } catch {
    return [];
  }
}

function readLegacyPairings(userId: string): Pairing[] {
  if (typeof window === 'undefined') return [];
  const key = userStorageKey(STORAGE_KEYS.pairings, userId);
  const stored = window.localStorage.getItem(key);
  if (!stored) return [];
  try {
    return normalizePairings(JSON.parse(stored));
  } catch {
    return [];
  }
}

export function BeetleAppProvider({ userId, userEmail, initialDbBeetles, children }: BeetleAppProviderProps) {
  const router = useRouter();
  const [beetles, setBeetles] = useState<Beetle[]>(() => dbBeetlesToBeetles(initialDbBeetles));
  const [dataError, setDataError] = useState('');
  const [busy, setBusy] = useState(false);

  const [growthEntries, setGrowthEntries] = useLocalStorage<GrowthEntry[]>(
    userStorageKey(STORAGE_KEYS.growthEntries, userId),
    []
  );
  const [speciesInventory, setSpeciesInventory] = useLocalStorage<SpeciesInventory[]>(
    userStorageKey(STORAGE_KEYS.speciesInventory, userId),
    []
  );
  const [pairings, setPairings] = useLocalStorage<Pairing[]>(
    userStorageKey(STORAGE_KEYS.pairings, userId),
    []
  );
  const [pestRisks, setPestRisks] = useLocalStorage<PestRisk[]>(
    userStorageKey(STORAGE_KEYS.pestRisks, userId),
    []
  );

  useEffect(() => {
    if (growthEntries.length === 0) {
      const migrated = readLegacyGrowthEntries(userId);
      if (migrated.length > 0) {
        setGrowthEntries(migrated);
      }
    }
    if (pairings.length > 0) {
      setPairings((prev) => normalizePairings(prev as unknown[]));
    } else {
      const migrated = readLegacyPairings(userId);
      if (migrated.length > 0) {
        setPairings(migrated);
      }
    }
    setSpeciesInventory((prev) => migrateDbRowsToSpeciesInventory(initialDbBeetles, prev));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    if (beetles.length === 0 || growthEntries.length === 0) return;
    const repaired = repairGrowthEntryBeetleIds(beetles, growthEntries);
    const changed = repaired.some((entry, index) => entry.beetleId !== growthEntries[index]?.beetleId);
    if (changed) setGrowthEntries(repaired);
  }, [beetles, growthEntries, setGrowthEntries]);

  const run = useCallback(async (fn: () => Promise<void>) => {
    setDataError('');
    setBusy(true);
    try {
      await fn();
      router.refresh();
    } catch (err) {
      setDataError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }, [router]);

  const addBeetle = useCallback(
    async (beetle: Beetle) => {
      await run(async () => {
        const supabase = createClient();
        const rows = await insertBeetlesForUser(supabase, userId, [beetle]);
        const saved = dbBeetleToBeetle(rows[0]);
        setBeetles((prev) => [saved, ...prev]);
      });
    },
    [run, userId]
  );

  const updateBeetle = useCallback(
    async (beetle: Beetle) => {
      await run(async () => {
        const supabase = createClient();
        const row = await updateBeetleForUser(supabase, userId, beetle);
        const saved = dbBeetleToBeetle(row);
        setBeetles((prev) => prev.map((b) => (b.id === saved.id ? saved : b)));
      });
    },
    [run, userId]
  );

  const importData = useCallback(
    async (payload: {
      beetles: Beetle[];
      growthEntries: GrowthEntry[];
      speciesInventory?: SpeciesInventory[];
    }) => {
      await run(async () => {
        const supabase = createClient();
        let growthEntriesToStore = payload.growthEntries;
        let savedBeetles: Beetle[] = [];

        if (payload.beetles.length > 0) {
          const rows = await insertBeetlesForUser(supabase, userId, payload.beetles);
          savedBeetles = dbBeetlesToBeetles(rows);
          setBeetles((prev) => [...savedBeetles, ...prev]);
          if (growthEntriesToStore.length > 0) {
            growthEntriesToStore = remapGrowthEntriesToSavedBeetles(
              payload.beetles,
              savedBeetles,
              growthEntriesToStore
            );
          }
        }

        const beetlesForLinking = savedBeetles.length > 0 ? [...savedBeetles, ...beetles] : beetles;

        if (growthEntriesToStore.length > 0) {
          const linkedNew = repairGrowthEntryBeetleIds(beetlesForLinking, growthEntriesToStore);
          setGrowthEntries((prev) => {
            const merged = [...linkedNew, ...prev];
            return repairGrowthEntryBeetleIds(beetlesForLinking, merged);
          });
        }

        if (payload.speciesInventory && payload.speciesInventory.length > 0) {
          setSpeciesInventory((prev) => mergeSpeciesInventory(prev, payload.speciesInventory!));
        }
        router.push('/dashboard');
      });
    },
    [run, userId, beetles, setGrowthEntries, setSpeciesInventory, router]
  );

  const clearAllData = useCallback(async () => {
    await run(async () => {
      const supabase = createClient();
      await deleteAllBeetlesForUser(supabase, userId);
      setBeetles([]);
      setGrowthEntries([]);
      setSpeciesInventory([]);
      setPairings([]);
      setPestRisks([]);
      clearAllAppDataFromStorage(userId);
    });
  }, [run, userId, setGrowthEntries, setSpeciesInventory, setPairings, setPestRisks]);

  const restoreDemoData = useCallback(async () => {
    await run(async () => {
      const supabase = createClient();
      await deleteAllBeetlesForUser(supabase, userId);
      const rows = await insertBeetlesForUser(supabase, userId, mockBeetles);
      setBeetles(dbBeetlesToBeetles(rows));
      setGrowthEntries(mockGrowthEntries);
      setSpeciesInventory(mockSpeciesInventory);
      setPairings(mockPairings);
      setPestRisks(mockPestRisks);
    });
  }, [run, userId, setGrowthEntries, setSpeciesInventory, setPairings, setPestRisks]);

  const value = useMemo<BeetleAppContextValue>(
    () => ({
      userId,
      userEmail,
      beetles,
      growthEntries,
      speciesInventory,
      pairings,
      pestRisks,
      dataError,
      busy,
      addBeetle,
      updateBeetle,
      addGrowthEntry: (entry) => setGrowthEntries((prev) => [entry, ...prev]),
      addGrowthEntries: (entries) => setGrowthEntries((prev) => [...entries, ...prev]),
      updateSpeciesInventory: (rows) => setSpeciesInventory(normalizeSpeciesInventory(rows)),
      upsertSpeciesInventory: (row) =>
        setSpeciesInventory((prev) => {
          const species = row.species.trim();
          if (!species) return prev;
          const normalized = { ...row, species };
          const index = prev.findIndex((r) => r.species.trim().toLowerCase() === species.toLowerCase());
          if (index === -1) {
            return normalizeSpeciesInventory([normalized, ...prev]);
          }
          const next = [...prev];
          next[index] = { ...next[index], ...normalized, id: next[index].id };
          return normalizeSpeciesInventory(next);
        }),
      addPairing: (pairing) => setPairings((prev) => [pairing, ...prev]),
      addPestRisk: (risk) => setPestRisks((prev) => [risk, ...prev]),
      updatePestRisk: (risk) =>
        setPestRisks((prev) => prev.map((r) => (r.id === risk.id ? risk : r))),
      importData,
      clearAllData,
      restoreDemoData,
      navigate: (page) => router.push(pageToPath(page)),
    }),
    [
      userId,
      userEmail,
      beetles,
      growthEntries,
      speciesInventory,
      pairings,
      pestRisks,
      dataError,
      busy,
      addBeetle,
      updateBeetle,
      setGrowthEntries,
      setSpeciesInventory,
      setPairings,
      setPestRisks,
      importData,
      clearAllData,
      restoreDemoData,
      router,
    ]
  );

  return <BeetleAppContext.Provider value={value}>{children}</BeetleAppContext.Provider>;
}

export function useBeetleApp(): BeetleAppContextValue {
  const ctx = useContext(BeetleAppContext);
  if (!ctx) {
    throw new Error('useBeetleApp must be used within BeetleAppProvider');
  }
  return ctx;
}
