'use client';

import { LarvalGrowth } from '@/features/LarvalGrowth';
import { useBeetleApp } from '@/contexts/BeetleAppContext';

export default function LarvalGrowthPage() {
  const { beetles, growthEntries, addGrowthEntry } = useBeetleApp();

  return (
    <LarvalGrowth
      beetles={beetles}
      growthEntries={growthEntries}
      onAdd={addGrowthEntry}
    />
  );
}
