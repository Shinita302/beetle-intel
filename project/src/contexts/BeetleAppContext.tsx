'use client';

import type { Beetle, GrowthEntry, Pairing, PestRisk, SpeciesInventory } from '@/types';
import type { DbBeetle } from '@/types/database';
import { dbBeetleToBeetle, dbBeetlesToBeetles } from '@/lib/beetleDbMapper';
import {
  deleteAllBeetlesForUser,
  insertBeetlesForUser,
  updateBeetleForUser,
} from '@/lib/beetles';
import {
  deleteUserBreedingData,
  hasBreedingData,
  normalizeUserBreedingData,
  upsertUserBreedingData,
  type UserBreedingData,
} from '@/lib/userBreedingData';
import { createClient } from '@/lib/supabase/client';
import { pageToPath } from '@/lib/dashboardRoutes';
import { clearAllAppDataFromStorage } from '@/utils/clearAppData';
import {
  migrateDbRowsToSpeciesInventory,
  mergeSpeciesInventory,
  normalizePairings,
  normalizeSpeciesInventory,
} from '@/utils/migrateLegacyData';
import { remapGrowthEntriesToSavedBeetles, repairGrowthEntryBeetleIds } from '@/utils/importGrowthSheet';
import { readLegacyLocalAppData } from '@/utils/readLegacyLocalAppData';
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
  useRef,
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
  addBeetle: (beetle: Beetle) => Promise<Beetle | null>;
  updateBeetle: (beetle: Beetle) => Promise<Beetle | null>;
  addGrowthEntry: (entry: GrowthEntry) => void;
  addGrowthEntries: (entries: GrowthEntry[]) => void;
  deleteGrowthEntry: (id: string) => void;
  updateGrowthEntry: (entry: GrowthEntry) => void;
  updateSpeciesInventory: (rows: SpeciesInventory[]) => void;
  upsertSpeciesInventory: (row: SpeciesInventory) => void;
  addPairing: (pairing: Pairing) => void;
  updatePairing: (pairing: Pairing) => void;
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
  initialBreedingData: UserBreedingData;
  children: ReactNode;
}

const SYNC_DEBOUNCE_MS = 800;

function mergeBreedingDataSets(remote: UserBreedingData, local: UserBreedingData): UserBreedingData {
  return {
    growthEntries:
      remote.growthEntries.length >= local.growthEntries.length
        ? remote.growthEntries
        : local.growthEntries,
    speciesInventory: mergeSpeciesInventory(remote.speciesInventory, local.speciesInventory),
    pairings: remote.pairings.length >= local.pairings.length ? remote.pairings : local.pairings,
    pestRisks: remote.pestRisks.length >= local.pestRisks.length ? remote.pestRisks : local.pestRisks,
  };
}

export function BeetleAppProvider({
  userId,
  userEmail,
  initialDbBeetles,
  initialBreedingData,
  children,
}: BeetleAppProviderProps) {
  const router = useRouter();
  const normalizedInitial = useMemo(
    () => normalizeUserBreedingData(initialBreedingData),
    [initialBreedingData]
  );

  const [beetles, setBeetles] = useState<Beetle[]>(() => dbBeetlesToBeetles(initialDbBeetles));
  const [dataError, setDataError] = useState('');
  const [busy, setBusy] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const skipSyncRef = useRef(true);
  const migratedLocalRef = useRef(false);

  const [growthEntries, setGrowthEntries] = useState(normalizedInitial.growthEntries);
  const [speciesInventory, setSpeciesInventory] = useState(normalizedInitial.speciesInventory);
  const [pairings, setPairings] = useState(normalizedInitial.pairings);
  const [pestRisks, setPestRisks] = useState(normalizedInitial.pestRisks);

  useEffect(() => {
    let cancelled = false;

    async function hydrateFromLocalStorage() {
      if (migratedLocalRef.current) return;

      const local = readLegacyLocalAppData(userId);

      if (hasBreedingData(normalizedInitial)) {
        if (hasBreedingData(local)) {
          const merged = mergeBreedingDataSets(normalizedInitial, local);
          migratedLocalRef.current = true;
          skipSyncRef.current = true;
          setGrowthEntries(merged.growthEntries);
          setSpeciesInventory(merged.speciesInventory);
          setPairings(merged.pairings);
          setPestRisks(merged.pestRisks);
          try {
            const supabase = createClient();
            await upsertUserBreedingData(supabase, userId, merged);
            clearAllAppDataFromStorage(userId);
            router.refresh();
          } catch (err) {
            if (!cancelled) {
              setDataError(
                err instanceof Error
                  ? err.message
                  : 'Could not merge local data with your account.'
              );
            }
          } finally {
            if (!cancelled) {
              skipSyncRef.current = false;
              setHydrated(true);
            }
          }
          return;
        }
        setHydrated(true);
        return;
      }

      if (!hasBreedingData(local)) {
        setSpeciesInventory((prev) => migrateDbRowsToSpeciesInventory(initialDbBeetles, prev));
        setHydrated(true);
        return;
      }

      migratedLocalRef.current = true;
      skipSyncRef.current = true;

      const inventory = mergeSpeciesInventory(
        migrateDbRowsToSpeciesInventory(initialDbBeetles, local.speciesInventory),
        local.speciesInventory
      );

      setGrowthEntries(local.growthEntries);
      setSpeciesInventory(inventory);
      setPairings(normalizePairings(local.pairings as unknown[]));
      setPestRisks(local.pestRisks);

      try {
        const supabase = createClient();
        await upsertUserBreedingData(supabase, userId, {
          growthEntries: local.growthEntries,
          speciesInventory: inventory,
          pairings: local.pairings,
          pestRisks: local.pestRisks,
        });
        clearAllAppDataFromStorage(userId);
        router.refresh();
      } catch (err) {
        if (!cancelled) {
          setDataError(
            err instanceof Error
              ? err.message
              : 'Could not upload local data to your account. Data remains on this device only.'
          );
        }
      } finally {
        if (!cancelled) {
          skipSyncRef.current = false;
          setHydrated(true);
        }
      }
    }

    hydrateFromLocalStorage();

    return () => {
      cancelled = true;
    };
  }, [userId, normalizedInitial, initialDbBeetles, router]);

  useEffect(() => {
    if (!hydrated) return;
    if (speciesInventory.length === 0 && initialDbBeetles.length > 0) {
      setSpeciesInventory((prev) => migrateDbRowsToSpeciesInventory(initialDbBeetles, prev));
    }
  }, [hydrated, speciesInventory.length, initialDbBeetles]);

  useEffect(() => {
    if (beetles.length === 0 || growthEntries.length === 0) return;
    const repaired = repairGrowthEntryBeetleIds(beetles, growthEntries);
    const changed = repaired.some((entry, index) => entry.beetleId !== growthEntries[index]?.beetleId);
    if (changed) setGrowthEntries(repaired);
  }, [beetles, growthEntries]);

  useEffect(() => {
    if (!hydrated) return;

    const timer = window.setTimeout(async () => {
      if (skipSyncRef.current) {
        skipSyncRef.current = false;
        return;
      }

      try {
        const supabase = createClient();
        await upsertUserBreedingData(supabase, userId, {
          growthEntries,
          speciesInventory,
          pairings,
          pestRisks,
        });
        setDataError((prev) => (prev.includes('upload local data') ? prev : ''));
      } catch (err) {
        setDataError(
          err instanceof Error ? err.message : 'Could not save breeding data to your account.'
        );
      }
    }, SYNC_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [growthEntries, speciesInventory, pairings, pestRisks, userId, hydrated]);

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

  const syncBreedingDataNow = useCallback(
    async (data: UserBreedingData) => {
      const supabase = createClient();
      skipSyncRef.current = true;
      await upsertUserBreedingData(supabase, userId, data);
      skipSyncRef.current = false;
    },
    [userId]
  );

  const addBeetle = useCallback(
    async (beetle: Beetle): Promise<Beetle | null> => {
      let saved: Beetle | null = null;
      await run(async () => {
        const supabase = createClient();
        const rows = await insertBeetlesForUser(supabase, userId, [beetle]);
        saved = dbBeetleToBeetle(rows[0]);
        setBeetles((prev) => [saved!, ...prev]);
      });
      return saved;
    },
    [run, userId]
  );

  const updateBeetle = useCallback(
    async (beetle: Beetle): Promise<Beetle | null> => {
      let saved: Beetle | null = null;
      await run(async () => {
        const supabase = createClient();
        const row = await updateBeetleForUser(supabase, userId, beetle);
        saved = dbBeetleToBeetle(row);
        setBeetles((prev) => prev.map((b) => (b.id === saved!.id ? saved! : b)));
      });
      return saved;
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

        let nextGrowth = growthEntries;
        if (growthEntriesToStore.length > 0) {
          const linkedNew = repairGrowthEntryBeetleIds(beetlesForLinking, growthEntriesToStore);
          nextGrowth = repairGrowthEntryBeetleIds(beetlesForLinking, [...linkedNew, ...growthEntries]);
          setGrowthEntries(nextGrowth);
        }

        let nextInventory = speciesInventory;
        if (payload.speciesInventory && payload.speciesInventory.length > 0) {
          nextInventory = mergeSpeciesInventory(speciesInventory, payload.speciesInventory);
          setSpeciesInventory(nextInventory);
        }

        await syncBreedingDataNow({
          growthEntries: nextGrowth,
          speciesInventory: nextInventory,
          pairings,
          pestRisks,
        });

        router.push('/dashboard');
      });
    },
    [run, userId, beetles, growthEntries, speciesInventory, pairings, pestRisks, syncBreedingDataNow, router]
  );

  const clearAllData = useCallback(async () => {
    await run(async () => {
      const supabase = createClient();
      await deleteUserBreedingData(supabase, userId);
      await deleteAllBeetlesForUser(supabase, userId);
      skipSyncRef.current = true;
      setBeetles([]);
      setGrowthEntries([]);
      setSpeciesInventory([]);
      setPairings([]);
      setPestRisks([]);
      clearAllAppDataFromStorage(userId);
      skipSyncRef.current = false;
    });
  }, [run, userId]);

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
      await syncBreedingDataNow({
        growthEntries: mockGrowthEntries,
        speciesInventory: mockSpeciesInventory,
        pairings: mockPairings,
        pestRisks: mockPestRisks,
      });
    });
  }, [run, userId, syncBreedingDataNow]);

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
      deleteGrowthEntry: (id) => setGrowthEntries((prev) => prev.filter((entry) => entry.id !== id)),
      updateGrowthEntry: (entry) =>
        setGrowthEntries((prev) => prev.map((item) => (item.id === entry.id ? entry : item))),
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
      updatePairing: (pairing) =>
        setPairings((prev) => prev.map((item) => (item.id === pairing.id ? pairing : item))),
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
