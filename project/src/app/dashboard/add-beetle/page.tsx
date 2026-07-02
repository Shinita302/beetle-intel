'use client';

import { AddBeetle } from '@/features/AddBeetle';
import { useBeetleApp } from '@/contexts/BeetleAppContext';
import type { Beetle } from '@/types';
import {
  buildGrowthEntryFromBodyMetric,
  shouldRecordBodyMetricGrowth,
} from '@/utils/growthFromBodyMetric';

export default function AddBeetlePage() {
  const { beetles, growthEntries, addBeetle, updateBeetle, addGrowthEntry } = useBeetleApp();

  const recordBodyMetricGrowth = (beetle: Beetle, previous: Beetle | null) => {
    if (!shouldRecordBodyMetricGrowth(previous, beetle)) return;
    const entry = buildGrowthEntryFromBodyMetric(beetle, growthEntries.length);
    if (entry) addGrowthEntry(entry);
  };

  const handleAdd = async (beetle: Beetle) => {
    const saved = await addBeetle(beetle);
    if (saved) recordBodyMetricGrowth(saved, null);
  };

  const handleUpdate = async (beetle: Beetle) => {
    const previous = beetles.find((b) => b.id === beetle.id) ?? null;
    const saved = await updateBeetle(beetle);
    if (saved) recordBodyMetricGrowth(saved, previous);
  };

  return <AddBeetle beetles={beetles} onAdd={handleAdd} onUpdate={handleUpdate} />;
}
