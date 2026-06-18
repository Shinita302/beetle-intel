'use client';

import { Settings } from '@/features/Settings';
import { useBeetleApp } from '@/contexts/BeetleAppContext';

export default function SettingsPage() {
  const { beetles, growthEntries, pairings, pestRisks, clearAllData, restoreDemoData } = useBeetleApp();

  return (
    <Settings
      beetleCount={beetles.length}
      larvalCount={growthEntries.length}
      pairingCount={pairings.length}
      pestCount={pestRisks.length}
      onClearAll={clearAllData}
      onRestoreDemo={restoreDemoData}
    />
  );
}
