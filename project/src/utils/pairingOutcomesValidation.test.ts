import { describe, expect, it } from 'vitest';
import { isPairingOutcomesValid, validatePairingOutcomes } from './pairingOutcomesValidation';

describe('validatePairingOutcomes', () => {
  it('accepts valid outcome chains', () => {
    expect(validatePairingOutcomes({ eggsProduced: 13, hatched: 12, emerged: 10 })).toEqual({});
    expect(validatePairingOutcomes({ eggsProduced: 0, hatched: 0, emerged: 0 })).toEqual({});
  });

  it('rejects hatched greater than eggs produced', () => {
    const errors = validatePairingOutcomes({ eggsProduced: 13, hatched: 14, emerged: 0 });
    expect(errors.hatched).toMatch(/cannot be greater than Eggs Produced/i);
  });

  it('rejects emerged greater than hatched', () => {
    const errors = validatePairingOutcomes({ eggsProduced: 13, hatched: 12, emerged: 13 });
    expect(errors.emerged).toMatch(/cannot be greater than Hatched/i);
  });
});

describe('isPairingOutcomesValid', () => {
  it('returns false when outcomes are impossible', () => {
    expect(isPairingOutcomesValid({ eggsProduced: 13, hatched: 14, emerged: 0 })).toBe(false);
    expect(isPairingOutcomesValid({ eggsProduced: 13, hatched: 12, emerged: 13 })).toBe(false);
  });
});
