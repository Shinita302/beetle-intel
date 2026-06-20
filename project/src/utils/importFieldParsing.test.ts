import { describe, expect, it } from 'vitest';
import {
  isObservationNoteText,
  isValidLineName,
  parseStrictGeneration,
  parseStrictOrigin,
} from './importFieldParsing';

describe('importFieldParsing', () => {
  it('parses strict generation tokens only', () => {
    expect(parseStrictGeneration('F4')).toBe('F4');
    expect(parseStrictGeneration('F4+')).toBe('F4+');
    expect(parseStrictGeneration('CBF2')).toBe('CBF2');
    expect(parseStrictGeneration('adult(F4)')).toBe('F4');
    expect(parseStrictGeneration('Giraffe.K | headcount | adult | CB')).toBe('');
  });

  it('parses strict origin tokens only', () => {
    expect(parseStrictOrigin('CB')).toBe('CB');
    expect(parseStrictOrigin('WC')).toBe('WC');
    expect(parseStrictOrigin('WD')).toBe('WD');
    expect(parseStrictOrigin('CBF1')).toBe('CBF1');
    expect(parseStrictOrigin('Unknown Origin')).toBe('');
  });

  it('detects observation notes', () => {
    expect(isObservationNoteText('May 19th: 35mm female')).toBe(true);
    expect(isObservationNoteText('2026-05-19 | 35mm | female')).toBe(true);
    expect(isObservationNoteText('Giraffe.K')).toBe(false);
  });

  it('validates line names', () => {
    expect(isValidLineName('Giraffe.K')).toBe(true);
    expect(isValidLineName('May 19th: 35mm female')).toBe(false);
    expect(isValidLineName('headcount')).toBe(false);
    expect(isValidLineName('CB')).toBe(false);
  });
});
