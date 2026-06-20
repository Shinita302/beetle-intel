import type { ImportRowBlock } from '@/types/hybridImport';
import type { RawSheetRow } from './importSpreadsheet';
import {
  inventoryCountTotal,
  isObservationNoteText,
  isSexCountLabel,
  isStrictPopulationHeaderRow,
  isValidSpeciesFromHeader,
  parseGenerationFromCells,
  parseOriginFromCells,
  parseStrictGeneration,
  type InventoryCountKey,
} from './importFieldParsing';
import { parseGenerationFromStageLabel, parseStageLabelToLifecycle } from './spreadsheetMetrics';

/** Parsed population block — built before UI/editing layers. */
export interface PopulationBlockDraft {
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
  males: number;
  females: number;
  metadataNotes: string[];
  sourceSheet?: string;
  headerRow: number;
  startRow: number;
  endRow: number;
  bodyRowCount: number;
  parseWarnings: string[];
}

export interface PopulationBlockParseResult {
  blocks: PopulationBlockDraft[];
  /** Rows that are not part of any population block. */
  skippedNotes: string[];
  /** Strict headers seen but produced no importable block. */
  rejectedBlocks: Array<{ sourceRow: number; sourceSheet?: string; species: string; reason: string }>;
}

function isEmptyRow(cells: string[]): boolean {
  return cells.every((c) => !String(c ?? '').trim());
}

function isPureNumber(value: string): boolean {
  return /^\d+(\.\d+)?$/.test(value.trim());
}

function parseNumeric(raw: string): number {
  const m = raw.trim().match(/(\d+(?:\.\d+)?)/);
  if (!m) return 0;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : 0;
}

function extractLeadingCount(text: string): number {
  const m = text.trim().match(/^(\d+)/);
  return m ? parseNumeric(m[1]) : 0;
}

function isAdultHeaderCell(value: string): boolean {
  const t = value.trim();
  return /^adults?$/i.test(t) || /^adult\s*\(\s*(?:CB|WD)?F\d+\+?\s*\)$/i.test(t);
}

function stageCellToKey(cell: string): InventoryCountKey | null {
  const lifecycle = parseStageLabelToLifecycle(cell.trim());
  if (lifecycle === 'egg') return 'eggs';
  if (lifecycle === 'L1') return 'l1';
  if (lifecycle === 'L2') return 'l2';
  if (lifecycle === 'L3') return 'l3';
  if (lifecycle === 'pupa') return 'pupa';
  if (lifecycle === 'adult') return 'adult';
  const lower = cell.trim().toLowerCase();
  if (lower === 'pre-pupa' || lower === 'prepupa') return 'prePupa';
  return null;
}

function parseEggsFromCell(cell: string): number {
  const m = cell.match(/eggs?\s*:?\s*(\d+)/i);
  return m ? parseNumeric(m[1]) : 0;
}

function emptyBlockDraft(): Omit<
  PopulationBlockDraft,
  'species' | 'lineName' | 'sourceSheet' | 'headerRow' | 'startRow' | 'endRow' | 'bodyRowCount'
> {
  return {
    origin: '',
    generation: '',
    category: 'headcount',
    eggs: 0,
    l1: 0,
    l2: 0,
    l3: 0,
    prePupa: 0,
    pupa: 0,
    adult: 0,
    males: 0,
    females: 0,
    metadataNotes: [],
    parseWarnings: [],
  };
}

function recordSexMetadata(block: PopulationBlockDraft, text: string): void {
  const t = text.trim();
  if (!isSexCountLabel(t)) return;
  const count = extractLeadingCount(t);
  if (/female/i.test(t)) block.females = Math.max(block.females, count);
  if (/male/i.test(t)) block.males = Math.max(block.males, count);
  if (!block.metadataNotes.includes(t)) block.metadataNotes.push(t);
}

function parseStrictHeaderRow(row: RawSheetRow): PopulationBlockDraft {
  const cells = row.cells.map((c) => String(c ?? '').trim());
  const textCells = cells.filter(Boolean);
  const species = textCells.find((c) => isValidSpeciesFromHeader(c)) ?? '';
  const adultCell = textCells.find((c) => isAdultHeaderCell(c)) ?? '';
  const generation =
    parseGenerationFromStageLabel(adultCell) ||
    parseStrictGeneration(adultCell) ||
    parseGenerationFromCells(textCells);

  const draft: PopulationBlockDraft = {
    ...emptyBlockDraft(),
    species,
    lineName: species,
    origin: parseOriginFromCells(textCells),
    generation,
    sourceSheet: row.source_sheet,
    headerRow: row.source_row,
    startRow: row.source_row,
    endRow: row.source_row,
    bodyRowCount: 0,
  };

  for (const cell of textCells) {
    draft.eggs = Math.max(draft.eggs, parseEggsFromCell(cell));
  }

  return draft;
}

function assignStageCount(block: PopulationBlockDraft, key: InventoryCountKey, value: number): void {
  if (value <= 0) return;
  block[key] = Math.max(block[key], value);
}

/** Parse one body row into stage counts and metadata — never changes species. */
function applyBodyRow(block: PopulationBlockDraft, row: RawSheetRow, headerAdultContext: boolean): void {
  const cells = row.cells.map((c) => String(c ?? '').trim());
  const rawText = row.raw_text.trim();
  block.endRow = row.source_row;
  block.bodyRowCount += 1;

  if (isEmptyRow(cells)) return;

  for (const cell of cells) {
    if (cell) recordSexMetadata(block, cell);
  }

  if (cells.filter(Boolean).length === 1) {
    const only = cells.find(Boolean) ?? '';
    if (isSexCountLabel(only)) return;
    if (isObservationNoteText(only)) {
      block.metadataNotes.push(only);
      return;
    }
    if (isPureNumber(only)) {
      if (headerAdultContext) assignStageCount(block, 'adult', parseNumeric(only));
      return;
    }
  }

  if (isObservationNoteText(rawText)) {
    block.metadataNotes.push(rawText);
    return;
  }

  const stageIndex = cells.findIndex((c) => c && stageCellToKey(c));
  if (stageIndex >= 0) {
    const stageKey = stageCellToKey(cells[stageIndex])!;
    const trailing = cells.slice(stageIndex + 1);
    const numericValues = trailing.filter((c) => c && isPureNumber(c)).map(parseNumeric);

    if (numericValues.length >= 1) {
      assignStageCount(block, stageKey, numericValues[0]);
    }
    if (numericValues.length >= 2 && headerAdultContext) {
      assignStageCount(block, 'adult', numericValues[1]);
    }
    return;
  }

  const adultIndex = cells.findIndex((c) => c && /^adults?(\s*\(|$)/i.test(c));
  if (adultIndex >= 0) {
    const num = cells.slice(adultIndex + 1).find((c) => c && isPureNumber(c));
    if (num) assignStageCount(block, 'adult', parseNumeric(num));
    const gen = parseGenerationFromStageLabel(cells[adultIndex]);
    if (gen) block.generation = gen;
    return;
  }

  const eggIndex = cells.findIndex((c) => /^eggs?$/i.test(c));
  if (eggIndex >= 0) {
    const num = cells.slice(eggIndex + 1).find((c) => c && isPureNumber(c));
    if (num) assignStageCount(block, 'eggs', parseNumeric(num));
    return;
  }

  const pupaIndex = cells.findIndex((c) => /^pupa(e)?$/i.test(c));
  if (pupaIndex >= 0) {
    const num = cells.slice(pupaIndex + 1).find((c) => c && isPureNumber(c));
    if (num) assignStageCount(block, 'pupa', parseNumeric(num));
    return;
  }

  const numericOnly = cells.filter((c) => c && isPureNumber(c));
  const nonMetaText = cells.filter((c) => c && !isPureNumber(c) && !isSexCountLabel(c));
  if (numericOnly.length > 0 && nonMetaText.length === 0) {
    if (headerAdultContext) assignStageCount(block, 'adult', parseNumeric(numericOnly[0]));
    return;
  }

  if (nonMetaText.length > 0) {
    block.metadataNotes.push(rawText);
  }
}

function blockHasPopulationCounts(block: PopulationBlockDraft): boolean {
  return inventoryCountTotal(block) > 0;
}

function finalizeBlock(block: PopulationBlockDraft): PopulationBlockDraft | null {
  if (!isValidSpeciesFromHeader(block.species)) {
    return null;
  }
  if (!blockHasPopulationCounts(block)) {
    block.parseWarnings.push('No stage counts found in block body');
    return null;
  }
  return block;
}

/** Segment raw sheet rows into population blocks (header + body rows). */
export function segmentPopulationBlocks(allRows: RawSheetRow[]): Array<{ header: RawSheetRow; body: RawSheetRow[] }> {
  const segments: Array<{ header: RawSheetRow; body: RawSheetRow[] }> = [];
  let current: { header: RawSheetRow; body: RawSheetRow[] } | null = null;

  for (const row of allRows) {
    if (isEmptyRow(row.cells)) continue;

    if (isStrictPopulationHeaderRow(row.cells.map((c) => String(c ?? '')))) {
      if (current) segments.push(current);
      current = { header: row, body: [] };
      continue;
    }

    if (current) {
      current.body.push(row);
    }
  }

  if (current) segments.push(current);
  return segments;
}

/** Block-first parser: species only from strict headers; body rows add counts/metadata. */
export function parsePopulationBlocks(allRows: RawSheetRow[]): PopulationBlockParseResult {
  const blocks: PopulationBlockDraft[] = [];
  const skippedNotes: string[] = [];
  const rejectedBlocks: PopulationBlockParseResult['rejectedBlocks'] = [];
  const consumedRows = new Set<number>();

  for (const segment of segmentPopulationBlocks(allRows)) {
    consumedRows.add(segment.header.source_row);
    const draft = parseStrictHeaderRow(segment.header);
    const headerAdultContext = segment.header.cells.some((c) => isAdultHeaderCell(String(c ?? '')));

    for (const bodyRow of segment.body) {
      consumedRows.add(bodyRow.source_row);
      applyBodyRow(draft, bodyRow, headerAdultContext);
    }

    const finalized = finalizeBlock(draft);
    if (finalized) {
      blocks.push(finalized);
    } else {
      rejectedBlocks.push({
        sourceRow: draft.headerRow,
        sourceSheet: draft.sourceSheet,
        species: draft.species,
        reason: draft.parseWarnings.join('; ') || 'Block has no valid population counts',
      });
    }
  }

  for (const row of allRows) {
    if (consumedRows.has(row.source_row)) continue;
    if (isEmptyRow(row.cells)) continue;
    const text = row.raw_text.trim();
    if (!text) continue;
    if (isStrictPopulationHeaderRow(row.cells.map((c) => String(c ?? '')))) continue;
    skippedNotes.push(text);
  }

  return { blocks, skippedNotes, rejectedBlocks };
}

export function populationBlockToImportRowBlock(draft: PopulationBlockDraft, index: number): ImportRowBlock {
  return {
    id: `block-${draft.headerRow}-${index}`,
    headerIndex: 0,
    rowIndices: [],
    sourceSheet: draft.sourceSheet,
    startRow: draft.startRow,
    endRow: draft.endRow,
    noteRows: draft.metadataNotes,
  };
}

export function blockDraftNotes(draft: PopulationBlockDraft): string {
  const parts = [...draft.metadataNotes];
  if (draft.males > 0) parts.push(`${draft.males} males`);
  if (draft.females > 0) parts.push(`${draft.females} females`);
  return parts.join('; ');
}
