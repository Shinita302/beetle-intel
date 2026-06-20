import type { EditableImportGroup } from '@/types/hybridImport';
import {
  inventoryCountTotal,
  isObservationNoteText,
  isValidSpeciesFromHeader,
  parseStrictGeneration,
  parseStrictOrigin,
} from './importFieldParsing';

export function computeGroupTotal(group: Pick<
  EditableImportGroup,
  'eggs' | 'l1' | 'l2' | 'l3' | 'prePupa' | 'pupa' | 'adult'
>): number {
  return inventoryCountTotal(group);
}

/** Validate a population group before import. */
export function validateImportGroup(group: EditableImportGroup): string[] {
  const warnings: string[] = [];
  const line = group.lineName.trim() || group.species.trim();

  if (!line) {
    warnings.push('Missing species/line name');
  } else if (!isValidSpeciesFromHeader(line)) {
    warnings.push(`Species/line "${line}" looks invalid`);
  }

  if (isObservationNoteText(group.species) || isObservationNoteText(group.lineName)) {
    warnings.push('Species looks like a date/note row — should not be a population group');
  }

  const total = computeGroupTotal(group);
  if (total <= 0) {
    warnings.push('No population counts — at least one stage count is required');
  }

  if (group.total !== total) {
    warnings.push(`Total mismatch: displayed ${group.total} but stages sum to ${total}`);
  }

  if (group.generation && !parseStrictGeneration(group.generation)) {
    warnings.push(`Generation "${group.generation}" is not valid (use F1–F4+, CBF1, etc.)`);
  }

  if (group.origin && !parseStrictOrigin(group.origin)) {
    warnings.push(`Origin "${group.origin}" is not valid (use CB, WC, WD, CBF1, etc.)`);
  }

  const instarOnly = group.l1 + group.l2 + group.l3;
  if (instarOnly > 0 && group.adult === 0 && /adult/i.test(group.notes)) {
    warnings.push('Header mentions adult but adult_count is 0 — check stage mapping');
  }

  return warnings;
}

export function sanitizeImportGroupFields(group: EditableImportGroup): EditableImportGroup {
  const next = { ...group };
  next.generation = parseStrictGeneration(next.generation);
  next.origin = parseStrictOrigin(next.origin);
  next.species = next.lineName || next.species;
  next.total = computeGroupTotal(next);
  return next;
}
