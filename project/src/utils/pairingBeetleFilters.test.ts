import { describe, expect, it } from 'vitest';
import type { Beetle } from '@/types';
import {
  filterFemalesForPairing,
  filterMalesForPairing,
  reconcilePairingBeetleSelection,
} from './pairingBeetleFilters';

const beetles: Beetle[] = [
  {
    id: 'm1',
    name: 'Titan',
    species: 'Dorcus titanus',
    sex: 'male',
    status: 'adult',
    generation: 'F2',
    origin: 'CB',
    sizeMm: 0,
    color: '',
    notes: '',
    source: '',
    bloodline: '',
    createdAt: '2025-01-01',
  },
  {
    id: 'm2',
    name: 'Hercules',
    species: 'Megasoma elephas',
    sex: 'male',
    status: 'adult',
    generation: 'F1',
    origin: 'CB',
    sizeMm: 0,
    color: '',
    notes: '',
    source: '',
    bloodline: '',
    createdAt: '2025-01-01',
  },
  {
    id: 'f1',
    name: 'Valkyrie',
    species: 'Dorcus titanus',
    sex: 'female',
    status: 'adult',
    generation: 'F2',
    origin: 'CB',
    sizeMm: 0,
    color: '',
    notes: '',
    source: '',
    bloodline: '',
    createdAt: '2025-01-01',
  },
  {
    id: 'f2',
    name: 'Nova',
    species: 'Megasoma elephas',
    sex: 'female',
    status: 'adult',
    generation: 'F3',
    origin: 'CB',
    sizeMm: 0,
    color: '',
    notes: '',
    source: '',
    bloodline: '',
    createdAt: '2025-01-01',
  },
];

describe('filterFemalesForPairing', () => {
  it('returns all females when no male is selected', () => {
    expect(filterFemalesForPairing(beetles, '').map((b) => b.id)).toEqual(['f1', 'f2']);
  });

  it('filters females to the selected male species', () => {
    expect(filterFemalesForPairing(beetles, 'm1').map((b) => b.id)).toEqual(['f1']);
  });
});

describe('filterMalesForPairing', () => {
  it('returns all males when no female is selected', () => {
    expect(filterMalesForPairing(beetles, '').map((b) => b.id)).toEqual(['m1', 'm2']);
  });

  it('filters males to the selected female species', () => {
    expect(filterMalesForPairing(beetles, 'f2').map((b) => b.id)).toEqual(['m2']);
  });
});

describe('reconcilePairingBeetleSelection', () => {
  it('clears the female when a new male species conflicts', () => {
    const next = reconcilePairingBeetleSelection(
      { maleBeetleId: 'm1', femaleBeetleId: 'f1' },
      beetles,
      'maleBeetleId',
      'm2'
    );
    expect(next).toEqual({ maleBeetleId: 'm2', femaleBeetleId: '' });
  });

  it('clears the male when a new female species conflicts', () => {
    const next = reconcilePairingBeetleSelection(
      { maleBeetleId: 'm1', femaleBeetleId: 'f1' },
      beetles,
      'femaleBeetleId',
      'f2'
    );
    expect(next).toEqual({ maleBeetleId: '', femaleBeetleId: 'f2' });
  });
});
