import type { Beetle, Pairing } from '@/types';
import { beetleLabel, pairingFertilityScore } from '@/types';

export const ALL_SPECIES_FILTER = 'all';

export function pairingSpecies(beetles: Beetle[], pairing: Pairing): string | null {
  const male = beetles.find((b) => b.id === pairing.maleBeetleId);
  const female = beetles.find((b) => b.id === pairing.femaleBeetleId);
  return male?.species || female?.species || null;
}

/** Valid for hatch-rate analytics: eggs logged, hatch outcome recorded, counts consistent. */
export function isValidHatchRecord(pairing: Pairing): boolean {
  if (pairing.eggsProduced <= 0) return false;
  if (pairing.hatched == null) return false;
  if (pairing.hatched > pairing.eggsProduced) return false;

  const hatchRecorded =
    pairing.hatchedRecordedAt != null ||
    pairing.hatched > 0 ||
    pairing.emerged > 0;

  return hatchRecorded;
}

export function getBreedingSpeciesOptions(beetles: Beetle[], pairings: Pairing[]): string[] {
  const species = new Set<string>();
  for (const pairing of pairings) {
    const name = pairingSpecies(beetles, pairing);
    if (name) species.add(name);
  }
  return Array.from(species).sort((a, b) => a.localeCompare(b));
}

export function filterPairingsBySpecies(
  pairings: Pairing[],
  beetles: Beetle[],
  speciesFilter: string
): Pairing[] {
  if (speciesFilter === ALL_SPECIES_FILTER) return pairings;
  return pairings.filter((pairing) => pairingSpecies(beetles, pairing) === speciesFilter);
}

export function calcAvgHatchRate(pairings: Pairing[]): number | null {
  const valid = pairings.filter(isValidHatchRecord);
  if (valid.length === 0) return null;

  const totalEggs = valid.reduce((sum, pairing) => sum + pairing.eggsProduced, 0);
  const totalHatched = valid.reduce((sum, pairing) => sum + pairing.hatched, 0);
  if (totalEggs === 0) return null;

  return Math.round((totalHatched / totalEggs) * 100);
}

export interface TopPerformingSpecies {
  species: string;
  hatchRate: number;
}

export function calcTopPerformingSpecies(
  beetles: Beetle[],
  pairings: Pairing[]
): TopPerformingSpecies | null {
  const totals = new Map<string, { eggs: number; hatched: number }>();

  for (const pairing of pairings) {
    if (!isValidHatchRecord(pairing)) continue;
    const species = pairingSpecies(beetles, pairing);
    if (!species) continue;

    const current = totals.get(species) ?? { eggs: 0, hatched: 0 };
    current.eggs += pairing.eggsProduced;
    current.hatched += pairing.hatched;
    totals.set(species, current);
  }

  let best: TopPerformingSpecies | null = null;
  for (const [species, { eggs, hatched }] of totals) {
    if (eggs === 0) continue;
    const hatchRate = Math.round((hatched / eggs) * 100);
    if (
      !best ||
      hatchRate > best.hatchRate ||
      (hatchRate === best.hatchRate && species.localeCompare(best.species) < 0)
    ) {
      best = { species, hatchRate };
    }
  }

  return best;
}

export function getFertilityRanking(beetles: Beetle[], pairings: Pairing[]) {
  return pairings
    .map((pairing) => ({
      name: `${beetleLabel(beetles, pairing.maleBeetleId)} x ${beetleLabel(beetles, pairing.femaleBeetleId)}`,
      score: pairingFertilityScore(pairing),
    }))
    .sort((a, b) => b.score - a.score);
}
