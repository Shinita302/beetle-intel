export interface PairingOutcomes {
  eggsProduced: number;
  hatched: number;
  emerged: number;
}

export type PairingOutcomesField = keyof PairingOutcomes;

export type PairingOutcomesErrors = Partial<Record<PairingOutcomesField, string>>;

function isNonNegativeWholeNumber(value: number): boolean {
  return Number.isFinite(value) && Number.isInteger(value) && value >= 0;
}

export function validatePairingOutcomes(outcomes: PairingOutcomes): PairingOutcomesErrors {
  const errors: PairingOutcomesErrors = {};
  const { eggsProduced, hatched, emerged } = outcomes;

  if (!isNonNegativeWholeNumber(eggsProduced)) {
    errors.eggsProduced = 'Eggs Produced must be a non-negative whole number.';
  }
  if (!isNonNegativeWholeNumber(hatched)) {
    errors.hatched = 'Hatched must be a non-negative whole number.';
  }
  if (!isNonNegativeWholeNumber(emerged)) {
    errors.emerged = 'Emerged must be a non-negative whole number.';
  }

  if (!errors.eggsProduced && !errors.hatched && hatched > eggsProduced) {
    errors.hatched = 'Hatched cannot be greater than Eggs Produced.';
  }
  if (!errors.hatched && !errors.emerged && emerged > hatched) {
    errors.emerged = 'Emerged cannot be greater than Hatched.';
  }

  return errors;
}

export function isPairingOutcomesValid(outcomes: PairingOutcomes): boolean {
  return Object.keys(validatePairingOutcomes(outcomes)).length === 0;
}
