import { describe, expect, it } from 'vitest';
import type { Pairing } from '@/types';
import { buildPairingLifecycle, createPairingRecord, mergePairingUpdate } from './pairingLifecycle';

const basePairing: Pairing = {
  id: 'P-001',
  maleBeetleId: 'm1',
  femaleBeetleId: 'f1',
  pairingDate: '2026-01-10',
  eggsProduced: 0,
  hatched: 0,
  emerged: 0,
  createdAt: '2026-01-10',
};

describe('createPairingRecord', () => {
  it('creates a pairing with only beetles and date', () => {
    const pairing = createPairingRecord('P-002', {
      maleBeetleId: 'm1',
      femaleBeetleId: 'f1',
      pairingDate: '2026-02-01',
    });

    expect(pairing.eggsProduced).toBe(0);
    expect(pairing.eggsRecordedAt).toBeUndefined();
  });
});

describe('mergePairingUpdate', () => {
  it('preserves milestone dates when counts are unchanged', () => {
    const previous: Pairing = {
      ...basePairing,
      eggsProduced: 13,
      eggsRecordedAt: '2026-02-05',
    };

    const merged = mergePairingUpdate(
      previous,
      {
        maleBeetleId: 'm1',
        femaleBeetleId: 'f1',
        pairingDate: '2026-01-10',
        eggsProduced: 13,
        hatched: 0,
        emerged: 0,
      },
      '2026-03-01'
    );

    expect(merged.eggsRecordedAt).toBe('2026-02-05');
  });

  it('stamps a date when a new outcome is first recorded', () => {
    const merged = mergePairingUpdate(
      basePairing,
      {
        maleBeetleId: 'm1',
        femaleBeetleId: 'f1',
        pairingDate: '2026-01-10',
        eggsProduced: 13,
        hatched: 0,
        emerged: 0,
      },
      '2026-02-05'
    );

    expect(merged.eggsRecordedAt).toBe('2026-02-05');
  });
});

describe('buildPairingLifecycle', () => {
  it('orders milestones chronologically', () => {
    const pairing: Pairing = {
      ...basePairing,
      eggsProduced: 13,
      hatched: 12,
      emerged: 10,
      eggsRecordedAt: '2026-02-01',
      hatchedRecordedAt: '2026-03-01',
      emergedRecordedAt: '2026-04-01',
    };

    const lifecycle = buildPairingLifecycle(pairing);
    expect(lifecycle.map((item) => item.kind)).toEqual(['paired', 'eggs', 'hatched', 'emerged']);
    expect(lifecycle[1].value).toBe(13);
  });
});
