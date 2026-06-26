import { describe, expect, it } from 'vitest';
import type { Beetle, Pairing } from '@/types';
import {
  ALL_SPECIES_FILTER,
  calcAvgHatchRate,
  calcTopPerformingSpecies,
  filterPairingsBySpecies,
  getBreedingSpeciesOptions,
  isValidHatchRecord,
} from './dashboardBreedingMetrics';

const beetles: Beetle[] = [
  {
    id: 'B-1',
    name: 'Alpha',
    species: 'Dynastes hercules hercules',
    sex: 'male',
    status: 'adult',
    generation: 'F4',
    origin: 'CB',
    sizeMm: 0,
    color: '',
    notes: '',
    source: '',
    bloodline: '',
    createdAt: '2025-01-01',
  },
  {
    id: 'B-2',
    name: 'Beta',
    species: 'Dynastes hercules hercules',
    sex: 'female',
    status: 'adult',
    generation: 'F4',
    origin: 'CB',
    sizeMm: 0,
    color: '',
    notes: '',
    source: '',
    bloodline: '',
    createdAt: '2025-01-01',
  },
  {
    id: 'B-3',
    name: 'Gamma',
    species: 'Lucanus cervus',
    sex: 'male',
    status: 'adult',
    generation: 'F2',
    origin: 'WC',
    sizeMm: 0,
    color: '',
    notes: '',
    source: '',
    bloodline: '',
    createdAt: '2025-01-01',
  },
  {
    id: 'B-4',
    name: 'Delta',
    species: 'Lucanus cervus',
    sex: 'female',
    status: 'adult',
    generation: 'F2',
    origin: 'WC',
    sizeMm: 0,
    color: '',
    notes: '',
    source: '',
    bloodline: '',
    createdAt: '2025-01-01',
  },
];

const pairings: Pairing[] = [
  {
    id: 'P-1',
    maleBeetleId: 'B-1',
    femaleBeetleId: 'B-2',
    pairingDate: '2025-10-01',
    eggsProduced: 50,
    hatched: 49,
    emerged: 40,
    eggsRecordedAt: '2025-10-08',
    hatchedRecordedAt: '2025-11-02',
    createdAt: '2025-10-01',
  },
  {
    id: 'P-2',
    maleBeetleId: 'B-3',
    femaleBeetleId: 'B-4',
    pairingDate: '2025-11-01',
    eggsProduced: 20,
    hatched: 10,
    emerged: 8,
    eggsRecordedAt: '2025-11-08',
    hatchedRecordedAt: '2025-12-01',
    createdAt: '2025-11-01',
  },
  {
    id: 'P-3',
    maleBeetleId: 'B-1',
    femaleBeetleId: 'B-2',
    pairingDate: '2026-01-01',
    eggsProduced: 10,
    hatched: 0,
    emerged: 0,
    eggsRecordedAt: '2026-01-08',
    createdAt: '2026-01-01',
  },
  {
    id: 'P-4',
    maleBeetleId: 'B-3',
    femaleBeetleId: 'B-4',
    pairingDate: '2026-02-01',
    eggsProduced: 0,
    hatched: 0,
    emerged: 0,
    createdAt: '2026-02-01',
  },
];

describe('dashboardBreedingMetrics', () => {
  it('identifies valid hatch records', () => {
    expect(isValidHatchRecord(pairings[0])).toBe(true);
    expect(isValidHatchRecord(pairings[2])).toBe(false);
    expect(isValidHatchRecord(pairings[3])).toBe(false);
  });

  it('calculates average hatch rate from valid records only', () => {
    expect(calcAvgHatchRate(pairings)).toBe(84);
    expect(calcAvgHatchRate([])).toBeNull();
  });

  it('returns null average hatch rate when no valid records exist', () => {
    expect(calcAvgHatchRate([pairings[2], pairings[3]])).toBeNull();
  });

  it('finds the top performing species', () => {
    expect(calcTopPerformingSpecies(beetles, pairings)).toEqual({
      species: 'Dynastes hercules hercules',
      hatchRate: 98,
    });
  });

  it('lists species from breeding records', () => {
    expect(getBreedingSpeciesOptions(beetles, pairings)).toEqual([
      'Dynastes hercules hercules',
      'Lucanus cervus',
    ]);
  });

  it('filters pairings by species', () => {
    const filtered = filterPairingsBySpecies(pairings, beetles, 'Lucanus cervus');
    expect(filtered.map((pairing) => pairing.id)).toEqual(['P-2', 'P-4']);
    expect(filterPairingsBySpecies(pairings, beetles, ALL_SPECIES_FILTER)).toHaveLength(4);
  });
});
