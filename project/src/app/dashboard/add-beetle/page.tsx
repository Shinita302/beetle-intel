'use client';

import { AddBeetle } from '@/features/AddBeetle';
import { useBeetleApp } from '@/contexts/BeetleAppContext';

export default function AddBeetlePage() {
  const { beetles, addBeetle, updateBeetle } = useBeetleApp();

  return <AddBeetle beetles={beetles} onAdd={addBeetle} onUpdate={updateBeetle} />;
}
