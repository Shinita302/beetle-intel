'use client';

import { useRouter } from 'next/navigation';
import { Settings } from '@/features/Settings';
import { useBeetleApp } from '@/contexts/BeetleAppContext';
import { deleteAccount } from '@/lib/account';
import { clearAllAppDataFromStorage } from '@/utils/clearAppData';

export default function SettingsPage() {
  const router = useRouter();
  const { userId, userEmail, beetles, growthEntries, pairings, pestRisks, clearAllData, restoreDemoData } =
    useBeetleApp();

  const handleDeleteAccount = async () => {
    await deleteAccount();
    clearAllAppDataFromStorage(userId);
    router.push('/login');
    router.refresh();
  };

  return (
    <Settings
      userEmail={userEmail}
      beetleCount={beetles.length}
      larvalCount={growthEntries.length}
      pairingCount={pairings.length}
      pestCount={pestRisks.length}
      onClearAll={clearAllData}
      onRestoreDemo={restoreDemoData}
      onDeleteAccount={handleDeleteAccount}
    />
  );
}
