'use client';

import { PestRiskPage } from '@/features/PestRisk';
import { useBeetleApp } from '@/contexts/BeetleAppContext';

export default function PestRiskRoutePage() {
  const { pestRisks, addPestRisk, updatePestRisk } = useBeetleApp();

  return <PestRiskPage pestRisks={pestRisks} onAdd={addPestRisk} onUpdate={updatePestRisk} />;
}
