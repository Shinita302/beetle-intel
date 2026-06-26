import { describe, expect, it } from 'vitest';
import {
  beetleGenerationError,
  beetleOriginError,
  normalizeBeetleGeneration,
} from './beetleProfileValidation';

describe('normalizeBeetleGeneration', () => {
  it('normalizes case-insensitive F-generation values', () => {
    expect(normalizeBeetleGeneration('f20')).toBe('F20');
    expect(normalizeBeetleGeneration('F1')).toBe('F1');
    expect(normalizeBeetleGeneration('F100')).toBe('F100');
  });

  it('returns empty string for blank input', () => {
    expect(normalizeBeetleGeneration('')).toBe('');
    expect(normalizeBeetleGeneration('   ')).toBe('');
  });
});

describe('beetleGenerationError', () => {
  it('accepts valid generation values', () => {
    expect(beetleGenerationError('F1')).toBeUndefined();
    expect(beetleGenerationError('f20')).toBeUndefined();
    expect(beetleGenerationError('')).toBeUndefined();
  });

  it('rejects CB and WC in generation', () => {
    expect(beetleGenerationError('CB')).toMatch(/Origin field/i);
    expect(beetleGenerationError('wc')).toMatch(/Origin field/i);
  });

  it('rejects invalid generation formats', () => {
    expect(beetleGenerationError('F4+')).toBeDefined();
    expect(beetleGenerationError('CBF1')).toBeDefined();
    expect(beetleGenerationError('generation 2')).toBeDefined();
  });
});

describe('beetleOriginError', () => {
  it('requires a valid origin', () => {
    expect(beetleOriginError('')).toMatch(/required/i);
    expect(beetleOriginError('CB')).toBeUndefined();
    expect(beetleOriginError('WC')).toBeUndefined();
    expect(beetleOriginError('WD')).toBeDefined();
  });
});
