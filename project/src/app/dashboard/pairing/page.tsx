'use client';

import { PairingFertility } from '@/features/PairingFertility';
import { useBeetleApp } from '@/contexts/BeetleAppContext';

export default function PairingPage() {
  const { beetles, pairings, addPairing } = useBeetleApp();

  return <PairingFertility beetles={beetles} pairings={pairings} onAdd={addPairing} />;
}
