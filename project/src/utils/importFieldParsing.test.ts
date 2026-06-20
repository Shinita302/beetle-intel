import { describe, expect, it } from 'vitest';
import {
  isObservationNoteText,
  isSexCountLabel,
  isStrictPopulationHeaderRow,
  isValidLineName,
  isValidSpeciesFromHeader,
} from './importFieldParsing';

describe('importFieldParsing', () => {
  it('detects sex breakdown sub-rows', () => {
    expect(isSexCountLabel('3 males')).toBe(true);
    expect(isSexCountLabel('3 females')).toBe(true);
    expect(isSexCountLabel('1(Male)')).toBe(true);
    expect(isSexCountLabel('lamprima adolphinae')).toBe(false);
  });

  it('rejects sex breakdown and date notes as line names', () => {
    expect(isValidLineName('3 females')).toBe(false);
    expect(isValidSpeciesFromHeader('3 females')).toBe(false);
    expect(isValidSpeciesFromHeader('Hercules Hercules')).toBe(true);
    expect(isObservationNoteText('28th December 2025: Male')).toBe(true);
  });

  it('requires strict header cells for population blocks', () => {
    expect(
      isStrictPopulationHeaderRow(['lamprima adolphinae', 'headcount', 'adult(F4+)', 'CB'])
    ).toBe(true);
    expect(isStrictPopulationHeaderRow(['3 females'])).toBe(false);
    expect(isStrictPopulationHeaderRow(['Calcosoma.M', 'CB'])).toBe(false);
  });
});
