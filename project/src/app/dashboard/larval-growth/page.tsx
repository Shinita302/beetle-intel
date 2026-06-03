'use client';

import { LarvalGrowth } from '@/features/LarvalGrowth';
import { useBeetleApp } from '@/contexts/BeetleAppContext';

export default function LarvalGrowthPage() {
  const { beetles, larvalRecords, addLarvalRecord, addLarvalRecords } = useBeetleApp();

  return (
    <LarvalGrowth
      beetles={beetles}
      larvalRecords={larvalRecords}
      onAdd={addLarvalRecord}
      onAddMany={addLarvalRecords}
    />
  );
}
