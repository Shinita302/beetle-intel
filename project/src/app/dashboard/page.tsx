'use client';

import { Dashboard } from '@/features/Dashboard';
import { useBeetleApp } from '@/contexts/BeetleAppContext';

export default function DashboardPage() {
  const { beetles, growthEntries, speciesInventory, pairings, pestRisks, navigate } = useBeetleApp();

  return (
    <Dashboard
      beetles={beetles}
      growthEntries={growthEntries}
      speciesInventory={speciesInventory}
      pairings={pairings}
      pestRisks={pestRisks}
      onNavigate={navigate}
    />
  );
}
