import type { Beetle } from '@/types';

export function pairingSpeciesKey(species: string): string {
  return species.trim().toLowerCase();
}

export function beetlesShareSpecies(a: Beetle, b: Beetle): boolean {
  return pairingSpeciesKey(a.species) === pairingSpeciesKey(b.species);
}

export function findBeetleById(beetles: Beetle[], beetleId: string): Beetle | undefined {
  if (!beetleId) return undefined;
  return beetles.find((beetle) => beetle.id === beetleId);
}

/** Males eligible for pairing — all males, or same species as the selected female. */
export function filterMalesForPairing(beetles: Beetle[], femaleBeetleId: string): Beetle[] {
  const males = beetles.filter((beetle) => beetle.sex === 'male');
  if (!femaleBeetleId) return males;

  const female = findBeetleById(beetles, femaleBeetleId);
  if (!female) return males;

  const speciesKey = pairingSpeciesKey(female.species);
  return males.filter((beetle) => pairingSpeciesKey(beetle.species) === speciesKey);
}

/** Females eligible for pairing — all females, or same species as the selected male. */
export function filterFemalesForPairing(beetles: Beetle[], maleBeetleId: string): Beetle[] {
  const females = beetles.filter((beetle) => beetle.sex === 'female');
  if (!maleBeetleId) return females;

  const male = findBeetleById(beetles, maleBeetleId);
  if (!male) return females;

  const speciesKey = pairingSpeciesKey(male.species);
  return females.filter((beetle) => pairingSpeciesKey(beetle.species) === speciesKey);
}

export interface PairingBeetleSelection {
  maleBeetleId: string;
  femaleBeetleId: string;
}

/** Update a pairing selection and clear the opposite sex when species no longer match. */
export function reconcilePairingBeetleSelection(
  selection: PairingBeetleSelection,
  beetles: Beetle[],
  changedKey: keyof PairingBeetleSelection,
  newValue: string
): PairingBeetleSelection {
  const next: PairingBeetleSelection = { ...selection, [changedKey]: newValue };

  const male = findBeetleById(beetles, next.maleBeetleId);
  const female = findBeetleById(beetles, next.femaleBeetleId);

  if (male && female && !beetlesShareSpecies(male, female)) {
    if (changedKey === 'maleBeetleId') {
      next.femaleBeetleId = '';
    } else {
      next.maleBeetleId = '';
    }
  }

  return next;
}
