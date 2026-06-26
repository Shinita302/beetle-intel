'use client';

import { PairingFertility } from '@/features/PairingFertility';
import { useBeetleApp } from '@/contexts/BeetleAppContext';

export default function PairingPage() {
  const { beetles, pairings, addPairing, updatePairing } = useBeetleApp();

  return <PairingFertility beetles={beetles} pairings={pairings} onAdd={addPairing} onUpdate={updatePairing} />;
}
