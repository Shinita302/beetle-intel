'use client';

import { Inventory } from '@/features/Inventory';
import { useBeetleApp } from '@/contexts/BeetleAppContext';

export default function InventoryPage() {
  const { speciesInventory, updateSpeciesInventory, upsertSpeciesInventory } = useBeetleApp();

  return (
    <Inventory
      speciesInventory={speciesInventory}
      onUpdate={updateSpeciesInventory}
      onUpsert={upsertSpeciesInventory}
    />
  );
}
