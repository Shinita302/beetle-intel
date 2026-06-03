'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import type { Beetle, LarvalRecord, Pairing, PestRisk } from '@/types';
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
import { mockBeetles, mockLarvalRecords, mockPairings, mockPestRisks } from '@/data/mockData';

interface BeetleAppContextValue {
  userId: string;
  userEmail: string | undefined;
  beetles: Beetle[];
  larvalRecords: LarvalRecord[];
  pairings: Pairing[];
  pestRisks: PestRisk[];
  dataError: string;
  busy: boolean;
  addBeetle: (beetle: Beetle) => Promise<void>;
  updateBeetle: (beetle: Beetle) => Promise<void>;
  addLarvalRecord: (record: LarvalRecord) => void;
  addLarvalRecords: (records: LarvalRecord[]) => void;
  addPairing: (pairing: Pairing) => void;
  addPestRisk: (risk: PestRisk) => void;
  updatePestRisk: (risk: PestRisk) => void;
  importData: (payload: { beetles: Beetle[]; larvalRecords: LarvalRecord[] }) => Promise<void>;
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

export function BeetleAppProvider({ userId, userEmail, initialDbBeetles, children }: BeetleAppProviderProps) {
  const router = useRouter();
  const [beetles, setBeetles] = useState<Beetle[]>(() => dbBeetlesToBeetles(initialDbBeetles));
  const [dataError, setDataError] = useState('');
  const [busy, setBusy] = useState(false);

  const [larvalRecords, setLarvalRecords] = useLocalStorage<LarvalRecord[]>(
    userStorageKey(STORAGE_KEYS.larvalRecords, userId),
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
    async (payload: { beetles: Beetle[]; larvalRecords: LarvalRecord[] }) => {
      await run(async () => {
        const supabase = createClient();
        if (payload.beetles.length > 0) {
          const rows = await insertBeetlesForUser(supabase, userId, payload.beetles);
          setBeetles((prev) => [...dbBeetlesToBeetles(rows), ...prev]);
        }
        if (payload.larvalRecords.length > 0) {
          setLarvalRecords((prev) => [...payload.larvalRecords, ...prev]);
        }
        router.push('/dashboard');
      });
    },
    [run, userId, setLarvalRecords, router]
  );

  const clearAllData = useCallback(async () => {
    await run(async () => {
      const supabase = createClient();
      await deleteAllBeetlesForUser(supabase, userId);
      setBeetles([]);
      setLarvalRecords([]);
      setPairings([]);
      setPestRisks([]);
      clearAllAppDataFromStorage();
    });
  }, [run, userId, setLarvalRecords, setPairings, setPestRisks]);

  const restoreDemoData = useCallback(async () => {
    await run(async () => {
      const supabase = createClient();
      await deleteAllBeetlesForUser(supabase, userId);
      const rows = await insertBeetlesForUser(supabase, userId, mockBeetles);
      setBeetles(dbBeetlesToBeetles(rows));
      setLarvalRecords(mockLarvalRecords);
      setPairings(mockPairings);
      setPestRisks(mockPestRisks);
    });
  }, [run, userId, setLarvalRecords, setPairings, setPestRisks]);

  const value = useMemo<BeetleAppContextValue>(
    () => ({
      userId,
      userEmail,
      beetles,
      larvalRecords,
      pairings,
      pestRisks,
      dataError,
      busy,
      addBeetle,
      updateBeetle,
      addLarvalRecord: (record) => setLarvalRecords((prev) => [record, ...prev]),
      addLarvalRecords: (records) => setLarvalRecords((prev) => [...records, ...prev]),
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
      larvalRecords,
      pairings,
      pestRisks,
      dataError,
      busy,
      addBeetle,
      updateBeetle,
      setLarvalRecords,
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
