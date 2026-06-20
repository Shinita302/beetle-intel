import type { InterpretedRow } from '@/utils/importSpreadsheet';

export type ConfidenceLevel = 'high' | 'medium' | 'low';
export type ImportParseSource = 'deterministic' | 'llm' | 'user-edited';

/** User-editable population group from hybrid import pipeline. */
export interface EditableImportGroup {
  id: string;
  species: string;
  lineName: string;
  origin: string;
  generation: string;
  category: string;
  eggs: number;
  l1: number;
  l2: number;
  l3: number;
  prePupa: number;
  pupa: number;
  adult: number;
  notes: string;
  total: number;
  confidence: ConfidenceLevel;
  confidenceScore: number;
  validationWarnings: string[];
  parseSource: ImportParseSource;
  sourceSheet?: string;
  startRow: number;
  endRow: number;
  /** When false, group is excluded from final import. */
  included: boolean;
}

export interface ImportRowBlock {
  id: string;
  headerIndex: number;
  rowIndices: number[];
  sourceSheet?: string;
  startRow: number;
  endRow: number;
  noteRows: string[];
}

export interface ImportCorrectionRule {
  id: string;
  matchLineName?: string;
  matchSpecies?: string;
  field: 'species' | 'lineName' | 'origin' | 'generation';
  value: string;
  createdAt: string;
}

export interface HybridImportResult {
  groups: EditableImportGroup[];
  blocks: ImportRowBlock[];
  skippedNotes: string[];
  sheetsProcessed: string[];
  sheetsSkipped: string[];
  growthSheetsImported: string[];
  individualBeetleCount: number;
  growthEntryCount: number;
  usedLlmFallback: boolean;
  interpreted: InterpretedRow[];
}
