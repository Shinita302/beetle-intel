'use client';

import { Settings } from '@/features/Settings';
import { useBeetleApp } from '@/contexts/BeetleAppContext';

export default function SettingsPage() {
  const { beetles, larvalRecords, pairings, pestRisks, clearAllData, restoreDemoData } = useBeetleApp();

  return (
    <Settings
      beetleCount={beetles.length}
      larvalCount={larvalRecords.length}
      pairingCount={pairings.length}
      pestCount={pestRisks.length}
      onClearAll={clearAllData}
      onRestoreDemo={restoreDemoData}
    />
  );
}
