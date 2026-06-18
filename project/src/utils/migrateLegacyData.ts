import type { GrowthEntry, GrowthStage, Pairing, SpeciesInventory } from '@/types';
import { emptySpeciesInventory, speciesInventoryId } from '@/types';
import type { DbBeetle } from '@/types/database';
import { parseLegacyInventoryCounts } from '@/types/database';

export function normalizeGrowthEntry(raw: Record<string, unknown>): GrowthEntry {
  const stage =
    (raw.stage as GrowthStage | undefined) ??
    (raw.instarStage as GrowthStage | undefined) ??
    'L1';

  return {
    id: String(raw.id ?? ''),
    beetleId: String(raw.beetleId ?? ''),
    date: String(raw.date ?? raw.dateChecked ?? ''),
    stage,
    weight: Number(raw.weight) || 0,
    temperature: Number(raw.temperature) || 0,
    humidity: Number(raw.humidity) || 0,
    substrate: String(raw.substrate ?? raw.substrateType ?? ''),
    notes: String(raw.notes ?? ''),
    createdAt: String(raw.createdAt ?? ''),
  };
}

export function normalizeGrowthEntries(raw: unknown[]): GrowthEntry[] {
  return raw.map((item) => normalizeGrowthEntry(item as Record<string, unknown>));
}

export function normalizePairing(raw: Record<string, unknown>): Pairing {
  return {
    id: String(raw.id ?? ''),
    maleBeetleId: String(raw.maleBeetleId ?? ''),
    femaleBeetleId: String(raw.femaleBeetleId ?? ''),
    pairingDate: String(raw.pairingDate ?? ''),
    eggsProduced: Number(raw.eggsProduced ?? raw.totalEggsLaid ?? 0),
    hatched: Number(raw.hatched ?? raw.hatchedEggs ?? 0),
    emerged: Number(raw.emerged ?? raw.emergedAdults ?? 0),
    createdAt: String(raw.createdAt ?? ''),
  };
}

export function normalizePairings(raw: unknown[]): Pairing[] {
  return raw.map((item) => normalizePairing(item as Record<string, unknown>));
}

/** Merge rows by species name and assign stable unique ids. */
export function normalizeSpeciesInventory(rows: SpeciesInventory[]): SpeciesInventory[] {
  const map = new Map<string, SpeciesInventory>();

  for (const row of rows) {
    const species = row.species.trim();
    if (!species) continue;

    const key = species.toLowerCase();
    const current = map.get(key);

    if (!current) {
      map.set(key, {
        ...row,
        species,
        id: speciesInventoryId(species),
      });
      continue;
    }

    current.eggs += row.eggs;
    current.l1 += row.l1;
    current.l2 += row.l2;
    current.l3 += row.l3;
    current.prePupa += row.prePupa;
    current.pupa += row.pupa;
    current.adult += row.adult;
    if (row.updatedAt >= current.updatedAt) {
      current.updatedAt = row.updatedAt;
    }
  }

  return Array.from(map.values());
}

export function migrateDbRowsToSpeciesInventory(
  rows: DbBeetle[],
  existing: SpeciesInventory[]
): SpeciesInventory[] {
  const deduped = normalizeSpeciesInventory(existing);
  if (deduped.length > 0) return deduped;

  const bySpecies = new Map<string, SpeciesInventory>();

  for (const row of rows) {
    const counts = parseLegacyInventoryCounts(row.inventory_counts);
    const total = counts.egg + counts.l1 + counts.l2 + counts.l3 + counts.pupa + counts.adult;
    if (total === 0) continue;

    const species = row.species.trim();
    if (!species) continue;

    const current = bySpecies.get(species) ?? emptySpeciesInventory(species);
    current.eggs += counts.egg;
    current.l1 += counts.l1;
    current.l2 += counts.l2;
    current.l3 += counts.l3;
    current.pupa += counts.pupa;
    current.adult += counts.adult;
    current.updatedAt = new Date().toISOString().slice(0, 10);
    bySpecies.set(species, current);
  }

  return Array.from(bySpecies.values());
}

export function mergeSpeciesInventory(
  existing: SpeciesInventory[],
  incoming: SpeciesInventory[]
): SpeciesInventory[] {
  return normalizeSpeciesInventory([...existing, ...incoming]);
}
