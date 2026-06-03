'use client';

import { Dashboard } from '@/features/Dashboard';
import { useBeetleApp } from '@/contexts/BeetleAppContext';

export default function DashboardPage() {
  const { beetles, larvalRecords, pairings, pestRisks, navigate } = useBeetleApp();

  return (
    <Dashboard
      beetles={beetles}
      larvalRecords={larvalRecords}
      pairings={pairings}
      pestRisks={pestRisks}
      onNavigate={navigate}
    />
  );
}
