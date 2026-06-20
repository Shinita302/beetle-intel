import Papa from 'papaparse';
import type {
  Beetle,
  BeetleSex,
  BeetleStatus,
  GrowthEntry,
  GrowthStage,
  SpeciesInventory,
} from '../types';
import { emptySpeciesInventory, inventoryGroupId, inventoryGroupKey } from '../types';
import {
  cellHasSizeUnit,
  cellHasWeightUnit,
  metricsFromCombinedCell,
  parseStageCombinedCell,
  parseStageRowMetrics,
  parseGenerationFromStageLabel,
  PLAIN_NUMBERS_AS_COUNTS_WARNING,
} from './spreadsheetMetrics';
import {
  INVENTORY_COUNT_LABELS,
  inventoryCountTotal,
  isObservationNoteText,
  isValidLineName,
  parseGenerationFromCells,
  parseOriginFromCells,
  parseStrictGeneration,
  parseStrictOrigin,
  type InventoryCountKey,
} from './importFieldParsing';

interface DraftInventoryCounts {
  eggs: number;
  l1: number;
  l2: number;
  l3: number;
  prePupa: number;
  pupa: number;
  adult: number;
}

type ActiveGroupStage = InventoryCountKey | '';

const emptyInventoryCounts = (): DraftInventoryCounts => ({
  eggs: 0,
  l1: 0,
  l2: 0,
  l3: 0,
  prePupa: 0,
  pupa: 0,
  adult: 0,
});

function mergeDraftInventory(
  map: Map<string, SpeciesInventory>,
  group: { species: string; lineName?: string; generation?: string; origin?: string; notes?: string; sourceFile?: string; sourceSheet?: string; importedAt?: string },
  counts: DraftInventoryCounts
) {
  const species = group.species.trim();
  if (!species) return;
  const mapKey = inventoryGroupKey(species, group.lineName, group.generation);
  const row =
    map.get(mapKey) ??
    emptySpeciesInventory(species, inventoryGroupId(species, group.lineName, group.generation));
  row.lineName = group.lineName || row.lineName;
  row.generation = group.generation || row.generation;
  row.origin = group.origin || row.origin;
  if (group.notes) {
    row.notes = row.notes ? `${row.notes}; ${group.notes}` : group.notes;
  }
  if (group.sourceFile) row.sourceFile = group.sourceFile;
  if (group.sourceSheet) row.sourceSheet = group.sourceSheet;
  if (group.importedAt) row.importedAt = group.importedAt;
  row.eggs += counts.eggs;
  row.l1 += counts.l1;
  row.l2 += counts.l2;
  row.l3 += counts.l3;
  row.prePupa += counts.prePupa;
  row.pupa += counts.pupa;
  row.adult += counts.adult;
  row.updatedAt = new Date().toISOString().slice(0, 10);
  map.set(mapKey, row);
}

export type SpreadsheetStyle = 'header-table' | 'block-notes' | 'mixed';

export type RowMeaning =
  | 'group-header'
  | 'stage-count'
  | 'individual-beetle'
  | 'note'
  | 'empty'
  | 'uncertain';

export interface RawSheetRow {
  source_row: number;
  source_sheet?: string;
  cells: string[];
  raw_text: string;
}

export interface ParsedSpreadsheet {
  headers: string[];
  rows: RawSheetRow[];
  style: SpreadsheetStyle;
  /** All rows including empty ones, for exact original display */
  allRows: RawSheetRow[];
  /** Worksheets detected as larval growth time-series (e.g. DHH tab) */
  growthSheets: { name: string; rows: RawSheetRow[] }[];
  sheetNames: string[];
}

export interface RowFieldDraft {
  species_or_group: string;
  beetle_name: string;
  stage_status: string;
  sex: string;
  generation: string;
  count: string;
  weight: string;
  size: string;
  date: string;
  notes: string;
}

export interface InterpretedRow {
  source_row: number;
  source_sheet?: string;
  original_cells: string[];
  detected_meaning: RowMeaning;
  user_meaning: RowMeaning;
  confidence: number;
  needs_user_mapping: boolean;
  inherit_group: boolean;
  suggested_fields: RowFieldDraft;
  user_fields: RowFieldDraft;
  detection_notes: string;
}

export interface StructuredImportBuild {
  beetles: Beetle[];
  growthEntries: GrowthEntry[];
  speciesInventory: SpeciesInventory[];
  populationGroups: PopulationGroupPreview[];
  stageRecords: GeneratedStageRecord[];
  validationWarnings: string[];
  summary: ImportSummary;
}

export interface PopulationGroupPreview {
  species: string;
  lineName: string;
  generation: string;
  origin: string;
  category: string;
  eggs: number;
  l1: number;
  l2: number;
  l3: number;
  prePupa: number;
  pupa: number;
  adult: number;
  total: number;
  sourceSheet?: string;
}

export interface ImportSummary {
  sourceRows: number;
  importedBeetles: number;
  importedGrowthEntries: number;
  inventoryGroupsCreated: number;
  totalPopulation: number;
  importedSpecies: number;
  skippedRows: number;
  sheetsProcessed: string[];
  sheetsSkipped: string[];
  growthSheetsImported: string[];
}

export interface GeneratedStageRecord {
  source_row: number;
  species: string;
  stage: string;
  count: string;
  attachedToGroup: string;
}

export interface StageDetection {
  label: string;
  beetleStatus: BeetleStatus | '';
  instar: 'L1' | 'L2' | 'L3' | '';
  generation?: string;
}

export const DEFAULT_DEVELOPMENTAL_STAGE_KEYWORDS = [
  'egg',
  'eggs',
  'larva',
  'larvae',
  'pupa',
  'pupae',
  'adult',
  'adults',
  'juvenile',
  'juveniles',
  'nymph',
  'nymphs',
  'l1',
  'l2',
  'l3',
];

let userDefinedStageLabels: string[] = [];

/** Register additional stage terminology (normalized internally). */
export function registerUserDefinedStageLabels(labels: string[]): void {
  userDefinedStageLabels = labels.map((label) => normalize(label)).filter(Boolean);
}

const SPECIES_HINTS = [
  'hercules',
  'rainbow stag',
  'dynastes',
  'dorcus',
  'chalcosoma',
  'prosopocoilus',
  'allotopus',
  'lucanus',
  'megasoma',
  'titanus',
  'stag',
  'rhino',
];

const ROW_MEANING_LABELS: Record<RowMeaning, string> = {
  'group-header': 'Population group',
  'stage-count': 'Stage / count row',
  'individual-beetle': 'Individual beetle',
  note: 'Note row',
  empty: 'Empty / ignore',
  uncertain: 'Uncertain',
};

export function rowMeaningLabel(meaning: RowMeaning): string {
  return ROW_MEANING_LABELS[meaning];
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function isPureNumber(value: string): boolean {
  return /^\d+(\.\d+)?$/.test(value.trim());
}

function isEmptyRow(cells: string[]): boolean {
  return cells.every((c) => !c.trim());
}

function parseSex(raw: string): BeetleSex | '' {
  const v = normalize(raw);
  if (!v) return '';
  if (['m', 'male', '♂'].includes(v)) return 'male';
  if (['f', 'female', '♀'].includes(v)) return 'female';
  if (['u', 'unknown', 'unsexed', '?'].includes(v)) return 'unknown';
  return '';
}

function parseStage(raw: string): BeetleStatus | '' {
  const v = normalize(raw);
  if (!v) return '';
  if (v.includes('larva') || v === 'l1' || v === 'l2' || v === 'l3') return 'larva';
  if (v.includes('pupa')) return 'pupa';
  if (v.includes('adult')) return 'adult';
  if (v.includes('dead')) return 'dead';
  if (v.includes('sold')) return 'sold';
  return '';
}

function instarFromStageLabel(label: string): 'L1' | 'L2' | 'L3' {
  if (/\blarva\s*1\b|instar\s*1|^l1$/i.test(label)) return 'L1';
  if (/\blarva\s*2\b|instar\s*2|^l2$/i.test(label)) return 'L2';
  return 'L3';
}

export function detectDevelopmentalStage(text: string): StageDetection | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const lower = normalize(trimmed);

  for (const custom of userDefinedStageLabels) {
    if (lower === custom) {
      return {
        label: trimmed,
        beetleStatus: parseStage(trimmed) || 'larva',
        instar: instarFromStageLabel(trimmed),
      };
    }
  }

  if (/^l[123]$/i.test(trimmed)) {
    const instar = trimmed.toUpperCase() as 'L1' | 'L2' | 'L3';
    return { label: instar, beetleStatus: 'larva', instar };
  }

  const larvaMatch = trimmed.match(/^larva\s*(\d)$/i);
  if (larvaMatch) {
    const n = larvaMatch[1];
    const instar = n === '1' ? 'L1' : n === '2' ? 'L2' : 'L3';
    return { label: `Larva ${n}`, beetleStatus: 'larva', instar };
  }

  const instarMatch = trimmed.match(/^instar\s*(\d)$/i);
  if (instarMatch) {
    const n = instarMatch[1];
    const instar = n === '1' ? 'L1' : n === '2' ? 'L2' : 'L3';
    return { label: `Instar ${n}`, beetleStatus: 'larva', instar };
  }

  if (/^eggs?$/i.test(trimmed)) return { label: 'Egg', beetleStatus: 'larva', instar: '' };
  if (/^pre[-\s]?pupa(e)?$/i.test(trimmed)) return { label: 'Pre-Pupa', beetleStatus: 'pupa', instar: '' };
  if (/^larva(e)?$/i.test(trimmed)) return { label: 'Larva', beetleStatus: 'larva', instar: '' };
  if (/^pupa(e)?$/i.test(trimmed)) return { label: 'Pupa', beetleStatus: 'pupa', instar: '' };

  const adultGenMatch = trimmed.match(/^adults?\s*(?:\(\s*(?:CB)?(F\d+\+?)\s*\)|\s+(?:CB)?(F\d+\+?))$/i);
  if (adultGenMatch) {
    const generation = parseGenerationFromStageLabel(trimmed);
    return { label: trimmed, beetleStatus: 'adult', instar: '', generation };
  }

  if (/^adults?$/i.test(trimmed)) return { label: 'Adult', beetleStatus: 'adult', instar: '' };
  if (/^juveniles?$/i.test(trimmed)) return { label: 'Juvenile', beetleStatus: 'larva', instar: '' };
  if (/^nymphs?$/i.test(trimmed)) return { label: 'Nymph', beetleStatus: 'larva', instar: '' };

  const stageWithCount = trimmed.match(/^(.+?)\s+(\d+(?:\.\d+)?(?:\s*(?:g|mm|ml|cc|l|pcs?|pc))?)$/i);
  if (stageWithCount) {
    const stagePart = detectDevelopmentalStage(stageWithCount[1]);
    if (stagePart) return stagePart;
  }

  return null;
}

export function isDevelopmentalStageLabel(text: string): boolean {
  return detectDevelopmentalStage(text) !== null;
}

function isNumericOrMeasurement(value: string): boolean {
  return isPureNumber(value) || /^\d+(\.\d+)?\s*(g|mm|ml|cc|l|pcs?|pc)?$/i.test(value.trim());
}

function inventoryKeyFromStage(stage: StageDetection): keyof DraftInventoryCounts | null {
  if (stage.instar === 'L1') return 'l1';
  if (stage.instar === 'L2') return 'l2';
  if (stage.instar === 'L3') return 'l3';
  if (stage.label === 'Egg') return 'eggs';
  if (stage.label === 'Pre-Pupa') return 'prePupa';
  if (stage.label === 'Pupa') return 'pupa';
  if (stage.beetleStatus === 'adult' || /^adult/i.test(stage.label)) return 'adult';
  return null;
}

function metricsToFieldStrings(metrics: ReturnType<typeof parseStageRowMetrics>): {
  count: string;
  weight: string;
  size: string;
} {
  return {
    count: metrics.count != null ? String(metrics.count) : '',
    weight: metrics.weightGrams != null ? String(metrics.weightGrams) : '',
    size: metrics.sizeMm != null ? String(metrics.sizeMm) : '',
  };
}

function extractStageFromRow(cells: string[]): {
  stage: StageDetection;
  count: string;
  weight: string;
  size: string;
  parseWarnings: string[];
} | null {
  const nonEmpty = cells.filter((cell) => cell.trim());
  if (nonEmpty.length === 0) return null;

  for (const cell of nonEmpty) {
    const combined = parseStageCombinedCell(cell);
    if (combined) {
      const stage = detectDevelopmentalStage(combined.stagePart);
      if (stage) {
        const cellMetrics = metricsFromCombinedCell(cell);
        const otherTokens = nonEmpty
          .filter((value) => value !== cell && isNumericOrMeasurement(value))
          .map((value) => value.trim());
        const otherMetrics =
          otherTokens.length > 0
            ? parseStageRowMetrics(stage.label, otherTokens)
            : { count: null, weightGrams: null, sizeMm: null, warnings: [] };
        const merged = {
          count: cellMetrics.count ?? otherMetrics.count,
          weightGrams: cellMetrics.weightGrams ?? otherMetrics.weightGrams,
          sizeMm: cellMetrics.sizeMm ?? otherMetrics.sizeMm,
          warnings: [...cellMetrics.warnings, ...otherMetrics.warnings],
        };
        const fields = metricsToFieldStrings(merged);
        return { stage, ...fields, parseWarnings: merged.warnings };
      }
    }
  }

  for (const cell of nonEmpty) {
    const stage = detectDevelopmentalStage(cell);
    if (stage) {
      const tokens = nonEmpty
        .filter((value) => value !== cell && isNumericOrMeasurement(value))
        .map((value) => value.trim());
      const metrics = parseStageRowMetrics(stage.label, tokens);
      const fields = metricsToFieldStrings(metrics);
      return { stage, ...fields, parseWarnings: metrics.warnings };
    }
  }

  return null;
}

function resolveParentSpecies(fieldValue: string, currentGroup: string): string {
  if (fieldValue && !isDevelopmentalStageLabel(fieldValue)) return fieldValue;
  return currentGroup;
}

function shouldPromoteToActiveGroup(speciesOrGroup: string): boolean {
  return Boolean(speciesOrGroup.trim()) && !isDevelopmentalStageLabel(speciesOrGroup);
}

function sanitizeStageRowFields(fields: RowFieldDraft, activeGroup: string): RowFieldDraft {
  const next = { ...fields, beetle_name: '' };

  if (isDevelopmentalStageLabel(next.species_or_group)) {
    if (!next.stage_status) next.stage_status = next.species_or_group;
    next.species_or_group = activeGroup;
  } else if (!next.species_or_group && activeGroup) {
    next.species_or_group = activeGroup;
  }

  return next;
}

function validateGeneratedSpecies(species: string, context: string): string | null {
  if (!species) return null;
  if (isDevelopmentalStageLabel(species)) {
    return `Possible stage label incorrectly promoted to species (${context}): "${species}"`;
  }
  return null;
}

function inventoryKeyFromLabel(label: string): InventoryCountKey | null {
  if (!label.trim()) return null;
  const stage = detectDevelopmentalStage(label);
  if (stage) return inventoryKeyFromStage(stage);
  const lower = label.trim().toLowerCase();
  if (lower === 'egg' || lower === 'eggs') return 'eggs';
  if (lower === 'pre-pupa' || lower === 'prepupa') return 'prePupa';
  if (lower === 'pupa' || lower === 'pupae') return 'pupa';
  if (/^adults?$/.test(lower)) return 'adult';
  return null;
}

function headerStageFromFields(fields: RowFieldDraft): ActiveGroupStage {
  return inventoryKeyFromLabel(fields.stage_status) ?? '';
}

function parseDateLoose(raw: string): string {
  const text = raw.trim();
  if (!text) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const d = new Date(text);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

function parseNumeric(raw: string): number {
  const m = raw.match(/-?\d+(\.\d+)?/);
  if (!m) return 0;
  return Number.parseFloat(m[0]) || 0;
}

function inferSpeciesFromText(text: string): string {
  const lower = normalize(text);
  const hint = SPECIES_HINTS.find((h) => lower.includes(h));
  if (hint) {
    return hint
      .split(' ')
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
      .join(' ');
  }
  const words = text.trim().split(/\s+/);
  if (words.length >= 2 && /^[A-Z]/.test(words[0])) {
    return words.slice(0, 2).join(' ');
  }
  if (words.length === 1 && words[0].length > 3 && !parseStage(words[0]) && !isDevelopmentalStageLabel(words[0]) && !isPureNumber(words[0])) {
    return words[0];
  }
  return '';
}

function looksLikeBeetleId(cell: string): boolean {
  const trimmed = cell.trim();
  return /^B[-_]?\d+/i.test(trimmed) || /^[A-Z]{1,3}-\d+$/i.test(trimmed);
}

function looksLikeName(cell: string): boolean {
  if (!cell.trim()) return false;
  if (isPureNumber(cell)) return false;
  if (parseStage(cell) || parseSex(cell) || isDevelopmentalStageLabel(cell)) return false;
  if (parseDateLoose(cell)) return false;
  if (/^\d+\s*(g|mm|ml|cc|l)\b/i.test(cell)) return false;
  return cell.trim().length >= 2;
}

function emptyFields(): RowFieldDraft {
  return {
    species_or_group: '',
    beetle_name: '',
    stage_status: '',
    sex: '',
    generation: '',
    count: '',
    weight: '',
    size: '',
    date: '',
    notes: '',
  };
}

function nextBeetleId(existingCount: number, index: number): string {
  return `B-${String(existingCount + index + 1).padStart(3, '0')}`;
}

function matrixToRows(matrix: string[][]): RawSheetRow[] {
  return matrix.map((cells, i) => {
    const safeCells = cells.map((cell) => String(cell ?? '').trim());
    return {
      source_row: i + 1,
      cells: safeCells,
      raw_text: safeCells.join(' | ').trim(),
    };
  });
}

const SHEET_SPECIES_ALIASES: Record<string, string> = {
  dhh: 'Dynastes Hercules Hercules',
};

/** Map worksheet tab names to species (e.g. "DHH" → Dynastes Hercules Hercules). */
export function inferSpeciesFromSheetName(sheetName: string): string {
  const trimmed = sheetName.trim();
  const key = trimmed.toLowerCase();
  if (SHEET_SPECIES_ALIASES[key]) return SHEET_SPECIES_ALIASES[key];
  if (/^dhh$/i.test(trimmed)) return 'Dynastes Hercules Hercules';
  if (/dynastes/i.test(trimmed) && /hercules/i.test(trimmed)) return trimmed;
  if (SPECIES_HINTS.some((hint) => key.includes(hint)) && trimmed.length > 2) {
    return trimmed;
  }
  return '';
}

interface GrowthSheetColumnMap {
  date?: number;
  weight?: number;
  stage?: number;
  notes?: number;
  species?: number;
}

function findGrowthHeaderRow(rows: RawSheetRow[]): RawSheetRow | null {
  for (const row of rows) {
    if (isEmptyRow(row.cells)) continue;
    if (detectGrowthSheetColumns(row.cells)) return row;
  }
  return null;
}

function detectGrowthSheetColumns(headerCells: string[]): GrowthSheetColumnMap | null {
  const map: GrowthSheetColumnMap = {};
  headerCells.forEach((cell, index) => {
    const h = normalize(cell);
    if (!h) return;
    if (/^date|checked|measured|when/.test(h)) map.date = index;
    if (/weight|mass|\(g\)|grams?/.test(h)) map.weight = index;
    if (/^stage|instar|larva/.test(h) || /^l[123]$/.test(h)) map.stage = index;
    if (/note|comment|substrate|remark/.test(h)) map.notes = index;
    if (/species|beetle.?name|^name$/.test(h)) map.species = index;
  });

  if (map.weight === undefined) return null;
  if (map.date !== undefined || map.stage !== undefined) return map;
  return null;
}

/** True when a worksheet looks like a dated weight log (not inventory counts). */
export function isGrowthTrackingSheet(sheetName: string, rows: RawSheetRow[]): boolean {
  const nonEmpty = rows.filter((row) => !isEmptyRow(row.cells));
  if (nonEmpty.length === 0) return false;

  const name = sheetName.trim().toLowerCase();
  if (/inventory|stock|count|population|summary|readme|notes?$/i.test(name)) return false;

  const hasGrowthColumns = Boolean(findGrowthHeaderRow(nonEmpty));
  if (/growth|larval.?track|weight.?log|track.?log|measurement/i.test(name) && hasGrowthColumns) {
    return true;
  }
  if (/^dhh$|hercules.?growth|larval.?growth/i.test(name) && hasGrowthColumns) {
    return true;
  }

  return hasGrowthColumns;
}

function growthStageFromCell(raw: string): GrowthStage {
  const detected = detectDevelopmentalStage(raw);
  if (detected?.instar) return detected.instar;
  if (detected?.label === 'Pupa') return 'Pupa';
  if (detected?.label === 'Egg') return 'Egg';
  if (/\bl1\b/i.test(raw)) return 'L1';
  if (/\bl2\b/i.test(raw)) return 'L2';
  if (/\bl3\b/i.test(raw)) return 'L3';
  return 'L1';
}

function resolveBeetleForGrowthImport(
  species: string,
  pendingBeetles: Beetle[],
  existingBeetles: Beetle[],
  now: string
): { beetle: Beetle; created: boolean } {
  const key = species.trim().toLowerCase();
  const pool = [...existingBeetles, ...pendingBeetles];

  const match = pool.find((b) => {
    const sp = b.species.toLowerCase();
    const nm = b.name.toLowerCase();
    return sp === key || sp.includes(key) || key.includes(sp) || nm === key;
  });

  if (match) return { beetle: match, created: false };

  const beetle: Beetle = {
    id: nextBeetleId(existingBeetles.length, pendingBeetles.length),
    name: species.split(/\s+/).slice(-1)[0] || species,
    species,
    sex: 'unknown',
    status: 'larva',
    generation: '',
    notes: 'Auto-created from growth worksheet import',
    source: 'growth-sheet-import',
    bloodline: '',
    createdAt: now,
  };
  pendingBeetles.push(beetle);
  return { beetle, created: true };
}

/** Import dated weight rows from growth worksheets (multi-tab workbooks). */
export function importGrowthEntriesFromSheets(
  sheets: { name: string; rows: RawSheetRow[] }[],
  existingBeetles: Beetle[],
  existingGrowthEntries: GrowthEntry[]
): { growthEntries: GrowthEntry[]; newBeetles: Beetle[] } {
  const growthEntries: GrowthEntry[] = [];
  const newBeetles: Beetle[] = [];
  const now = new Date().toISOString().slice(0, 10);
  let entryIndex = existingGrowthEntries.length;

  for (const sheet of sheets) {
    const nonEmpty = sheet.rows.filter((row) => !isEmptyRow(row.cells));
    const headerRow = findGrowthHeaderRow(nonEmpty);
    if (!headerRow) continue;

    const columns = detectGrowthSheetColumns(headerRow.cells);
    if (!columns || columns.weight === undefined) continue;

    const defaultSpecies =
      inferSpeciesFromSheetName(sheet.name) ||
      inferSpeciesFromText(sheet.name) ||
      sheet.name.trim();

    const dataRows = nonEmpty.filter((row) => row.source_row > headerRow.source_row);

    for (const row of dataRows) {
      const cells = row.cells;
      const weightRaw = columns.weight !== undefined ? cells[columns.weight] ?? '' : '';
      let weight = parseNumeric(weightRaw);
      if (weight <= 0 && weightRaw) {
        const gramMatch = weightRaw.match(/(\d+(?:\.\d+)?)\s*(?:g|gram)/i);
        if (gramMatch) weight = parseFloat(gramMatch[1]);
      }
      if (weight <= 0) continue;

      const dateRaw = columns.date !== undefined ? cells[columns.date] ?? '' : '';
      const date = dateRaw ? parseDateLoose(dateRaw) : now;
      const stageRaw = columns.stage !== undefined ? cells[columns.stage] ?? '' : '';
      const speciesRaw =
        columns.species !== undefined ? cells[columns.species] ?? '' : defaultSpecies;
      const species = speciesRaw.trim() || defaultSpecies;
      const notes = columns.notes !== undefined ? cells[columns.notes]?.trim() ?? '' : '';

      const { beetle } = resolveBeetleForGrowthImport(species, newBeetles, existingBeetles, now);

      entryIndex += 1;
      growthEntries.push({
        id: `GE-${String(entryIndex).padStart(3, '0')}`,
        beetleId: beetle.id,
        date,
        stage: stageRaw ? growthStageFromCell(stageRaw) : 'L1',
        weight: weight,
        temperature: 0,
        humidity: 0,
        substrate: '',
        notes: notes || `Imported from sheet "${sheet.name}"`,
        createdAt: date,
      });
    }
  }

  return { growthEntries, newBeetles };
}

export async function parseSpreadsheet(file: File): Promise<ParsedSpreadsheet> {
  const lower = file.name.toLowerCase();
  let allRows: RawSheetRow[] = [];
  const growthSheets: { name: string; rows: RawSheetRow[] }[] = [];
  const sheetNames: string[] = [];

  if (lower.endsWith('.csv')) {
    const text = await file.text();
    const parsed = Papa.parse<string[]>(text, {
      skipEmptyLines: false,
      dynamicTyping: false,
    });
    const matrix = (parsed.data as string[][]).map((row) => row.map((cell) => String(cell ?? '')));
    allRows = matrixToRows(matrix);
    sheetNames.push('Sheet1');
  } else if (lower.endsWith('.xlsx')) {
    const xlsx = await import('xlsx');
    const buffer = await file.arrayBuffer();
    const workbook = xlsx.read(buffer, { type: 'array' });
    let globalRow = 0;

    for (const sheetName of workbook.SheetNames) {
      sheetNames.push(sheetName);
      const matrix = xlsx.utils.sheet_to_json<string[]>(workbook.Sheets[sheetName], {
        header: 1,
        raw: false,
        blankrows: true,
        defval: '',
      });
      const sheetRows = matrixToRows(matrix).map((row) => ({
        ...row,
        source_sheet: sheetName,
        source_row: ++globalRow,
      }));

      const nonEmpty = sheetRows.filter((row) => !isEmptyRow(row.cells));
      if (isGrowthTrackingSheet(sheetName, nonEmpty)) {
        growthSheets.push({ name: sheetName, rows: sheetRows });
      } else {
        allRows.push(...sheetRows);
      }
    }

    if (allRows.length === 0 && growthSheets.length > 0) {
      throw new Error('Workbook contains only growth worksheets — add an inventory sheet or combine data.');
    }
  } else {
    throw new Error('Unsupported file type. Upload CSV or XLSX.');
  }

  const nonEmptyRows = allRows.filter((row) => !isEmptyRow(row.cells));
  const style = detectSpreadsheetStyle(nonEmptyRows);
  const headers = nonEmptyRows[0]?.cells ?? [];
  return { headers, rows: nonEmptyRows, style, allRows, growthSheets, sheetNames };
}

export function detectSpreadsheetStyle(rows: RawSheetRow[]): SpreadsheetStyle {
  if (rows.length === 0) return 'mixed';
  const first = rows[0].cells;
  const headerWords = ['name', 'species', 'sex', 'stage', 'generation', 'date', 'weight'];
  const headerSignal = first.filter((cell) => headerWords.some((w) => normalize(cell).includes(w))).length;
  const noteRows = rows.filter((row) => row.raw_text.length > 40 && row.cells.filter(Boolean).length <= 3).length;

  if (headerSignal >= 2) return 'header-table';
  if (noteRows > rows.length * 0.35) return 'block-notes';
  return 'mixed';
}

function extractNumbers(cells: string[]): string[] {
  return cells.filter((c) => isPureNumber(c) || /^\d+(\.\d+)?\s*(g|mm)?$/i.test(c.trim()));
}

function extractNonNumericText(cells: string[]): string[] {
  return cells.filter((c) => c.trim() && !isPureNumber(c));
}

function isAdultLabel(value: string): boolean {
  const detected = detectDevelopmentalStage(value);
  return detected?.beetleStatus === 'adult';
}

function isHeadcountCategory(value: string): boolean {
  return /headcount|population|inventory/i.test(value.trim());
}

/** Breeder inventory header: species/line + headcount or adult(F4) generation row */
function isPopulationGroupHeader(cells: string[], fullText: string): boolean {
  if (isObservationNoteText(fullText)) return false;

  const textCells = cells.map((c) => c.trim()).filter(Boolean);
  if (!/headcount/i.test(fullText)) {
    const hasHeadcountStructure =
      textCells.some((c) => isHeadcountCategory(c)) &&
      textCells.some((c) => isValidLineName(c) && !isMetaInventoryCell(c)) &&
      textCells.some((c) => isAdultLabel(c) || /^adults?$/i.test(c) || detectDevelopmentalStage(c));
    if (!hasHeadcountStructure) {
      return isGroupAnchorRow(cells, fullText);
    }
  }

  const lineName = textCells.find((c) => isValidLineName(c) && !isMetaInventoryCell(c));
  if (!lineName) return false;

  return /headcount/i.test(fullText) || textCells.some((c) => isAdultLabel(c) || /^adults?$/i.test(c));
}

function isMetaInventoryCell(value: string): boolean {
  const t = value.trim();
  return (
    isHeadcountCategory(t) ||
    Boolean(parseStrictOrigin(t)) ||
    isDevelopmentalStageLabel(t) ||
    /^unknown(\s+origin)?$/i.test(t)
  );
}

function sanitizeBeetleNameCandidate(value: string): string {
  const trimmed = value.trim();
  if (!trimmed || isPureNumber(trimmed) || isDevelopmentalStageLabel(trimmed)) return '';
  if (!isValidLineName(trimmed)) return '';

  const parsed = splitNameAndStageMarker(trimmed);
  if (parsed.stage && !parsed.name) return '';
  if (parsed.name) return parsed.name.trim();

  return trimmed;
}

function extractLeadingNameColumn(cells: string[]): string {
  for (const cell of cells) {
    const trimmed = cell.trim();
    if (!trimmed || isPureNumber(trimmed) || isNumericOrMeasurement(trimmed)) continue;
    if (isDevelopmentalStageLabel(trimmed)) continue;
    if (isMetaInventoryCell(trimmed)) continue;
    if (!isValidLineName(trimmed)) continue;
    return sanitizeBeetleNameCandidate(trimmed);
  }
  return '';
}

/** Beetle profile anchor: species/name + optional adult/pupa marker; may include counts */
function isGroupAnchorRow(cells: string[], fullText: string): boolean {
  const textCells = extractNonNumericText(cells);
  const nonStageCells = textCells.filter((cell) => !isDevelopmentalStageLabel(cell));

  const hasInstarStage = textCells.some((cell) => {
    const detected = detectDevelopmentalStage(cell);
    return Boolean(detected?.instar || /^l[123]$/i.test(cell.trim()));
  });
  if (hasInstarStage) return false;

  const leadingName = extractLeadingNameColumn(cells);
  const speciesName =
    nonStageCells.find((cell) => cell.trim().length > 1) || leadingName || inferSpeciesFromText(fullText);
  const hasStageMarker = textCells.some((cell) => isDevelopmentalStageLabel(cell));

  if (speciesName && hasStageMarker) return true;

  if (nonStageCells.length === 1) {
    const parsed = splitNameAndStageMarker(nonStageCells[0]);
    if (parsed.name && parsed.stage) return true;
  }

  if (speciesName && !hasStageMarker && textCells.length <= 2) return true;

  return false;
}

/** Developmental stage rows with optional numbers — never group headers */
function isStageCountRow(cells: string[]): boolean {
  const fullText = cells.filter((cell) => cell.trim()).join(' | ');
  if (isGroupAnchorRow(cells, fullText)) return false;

  if (extractStageFromRow(cells)) return true;

  const nonEmpty = cells.filter((cell) => cell.trim());
  const hasStage = nonEmpty.some((cell) => detectDevelopmentalStage(cell));
  if (!hasStage) return false;

  return nonEmpty.every((cell) => detectDevelopmentalStage(cell) || isNumericOrMeasurement(cell));
}

function interpretSingleRow(
  row: RawSheetRow,
  activeGroup: string,
  activeGroupStage: ActiveGroupStage = ''
): InterpretedRow {
  const cells = row.cells;
  const fields = emptyFields();
  const notes: string[] = [];
  let meaning: RowMeaning = 'uncertain';
  let confidence = 30;

  if (isEmptyRow(cells)) {
    return {
      source_row: row.source_row,
      source_sheet: row.source_sheet,
      original_cells: [...cells],
      detected_meaning: 'empty',
      user_meaning: 'empty',
      confidence: 100,
      needs_user_mapping: false,
      inherit_group: false,
      suggested_fields: fields,
      user_fields: { ...fields },
      detection_notes: 'Blank row',
    };
  }

  const fullText = row.raw_text;

  if (isObservationNoteText(fullText)) {
    return {
      source_row: row.source_row,
      source_sheet: row.source_sheet,
      original_cells: [...cells],
      detected_meaning: 'note',
      user_meaning: 'note',
      confidence: 92,
      needs_user_mapping: false,
      inherit_group: false,
      suggested_fields: { ...fields, notes: fullText },
      user_fields: { ...fields, notes: fullText },
      detection_notes: 'Date/size/sex observation — not a population group',
    };
  }

  const textCells = extractNonNumericText(cells);
  const numericCells = extractNumbers(cells);
  const stageRow = extractStageFromRow(cells);
  const speciesText =
    textCells.find((cell) => isValidLineName(cell) && !isMetaInventoryCell(cell)) || '';
  const sexFromText = parseSex(fullText);
  const dateMatch = fullText.match(/\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]\d{2,4}/)?.[0] ?? '';

  if (speciesText && !isDevelopmentalStageLabel(speciesText)) {
    fields.species_or_group = speciesText;
  } else if (activeGroup) {
    fields.species_or_group = activeGroup;
  }

  const generationFromCells = parseGenerationFromCells(cells);
  if (generationFromCells) {
    fields.generation = generationFromCells;
  }

  if (stageRow) {
    fields.stage_status = stageRow.stage.label;
    if (stageRow.count) fields.count = stageRow.count;
    if (stageRow.weight) fields.weight = stageRow.weight;
    if (stageRow.size) fields.size = stageRow.size;
    if (stageRow.parseWarnings.length > 0) {
      notes.push(...stageRow.parseWarnings);
    }
    if (stageRow.stage.generation && !fields.generation) {
      fields.generation = stageRow.stage.generation;
    }
  } else {
    const stageFromText = detectDevelopmentalStage(fullText);
    if (stageFromText) {
      fields.stage_status = stageFromText.label;
      if (stageFromText.generation && !fields.generation) {
        fields.generation = stageFromText.generation;
      }
    }
  }

  if (sexFromText) fields.sex = sexFromText;
  if (dateMatch) fields.date = parseDateLoose(dateMatch);

  // Priority 1: population group header (inventory/headcount — not individual beetles)
  if (isPopulationGroupHeader(cells, fullText)) {
    meaning = 'group-header';
    confidence = 90;
    const headerFields = parsePopulationHeaderFields(cells, fullText);
    fields.species_or_group = headerFields.lineName || headerFields.species || speciesText;
    fields.beetle_name = '';
    fields.generation = headerFields.generation;
    fields.notes = headerFields.category ? `Category: ${headerFields.category}` : '';
    if (headerFields.origin) {
      fields.notes = fields.notes
        ? `${fields.notes}; Origin: ${headerFields.origin}`
        : `Origin: ${headerFields.origin}`;
    }
    if (headerFields.headerAdultCount > 0) {
      fields.count = String(headerFields.headerAdultCount);
      fields.stage_status = headerFields.headerStageLabel || 'Adult';
    } else if (headerFields.headerStageLabel) {
      fields.stage_status = headerFields.headerStageLabel;
    }
    notes.push(
      'Population group header — stage counts (L1/L2/L3/Adult) attach to this group, not individual beetles'
    );
  }

  // Priority 2: developmental stage rows (L1/L2/L3, etc.) — never beetle names
  else if (isStageCountRow(cells)) {
    meaning = 'stage-count';
    fields.beetle_name = '';
    if (!stageRow && numericCells.length > 0) {
      const tokens = cells.filter((c) => isNumericOrMeasurement(c));
      const metrics = parseStageRowMetrics(fields.stage_status || 'stage', tokens);
      const mapped = metricsToFieldStrings(metrics);
      fields.count = mapped.count;
      fields.weight = mapped.weight;
      fields.size = mapped.size;
      if (metrics.warnings.length > 0) {
        notes.push(...metrics.warnings);
      }
    }
    fields.species_or_group = activeGroup || resolveParentSpecies(fields.species_or_group, activeGroup);
    confidence = numericCells.length > 0 || fields.count ? 86 : 72;
    notes.push(
      fields.count
        ? `Stage row "${fields.stage_status || 'unknown'}" → inventory count on parent beetle`
        : fields.weight
          ? `Stage row "${fields.stage_status || 'unknown'}" → growth weight (g) on profile`
          : `Stage row (${fields.stage_status || 'unknown'}) — assign counts if needed`
    );
  }

  // Priority 3: Numeric-only row — inherit adult/pupa/egg stage from group header when set
  else if (numericCells.length > 0 && textCells.length === 0) {
    meaning = 'stage-count';
    confidence = 72;
    fields.count = numericCells[0];
    fields.species_or_group = activeGroup || fields.species_or_group;
    if (!fields.stage_status && activeGroupStage) {
      fields.stage_status = INVENTORY_COUNT_LABELS[activeGroupStage];
    }
    notes.push(
      activeGroupStage
        ? `Numeric count inherited from group stage (${INVENTORY_COUNT_LABELS[activeGroupStage]})`
        : 'Numeric-only row treated as count/measurement'
    );
  }

  // Priority 4: Long note
  else if (fullText.length > 50 && cells.filter(Boolean).length <= 2) {
    meaning = 'note';
    confidence = 72;
    fields.notes = fullText;
    notes.push('Long free-text note');
  }

  // Priority 5: Individual beetle — only with explicit ID or clear one-beetle row
  else {
    const idCell = cells.find((cell) => looksLikeBeetleId(cell));
    const nameCandidate = textCells.find(
      (cell) =>
        looksLikeName(cell) &&
        !inferSpeciesFromText(cell) &&
        !isDevelopmentalStageLabel(cell) &&
        !isAdultLabel(cell)
    );
    if (idCell || (nameCandidate && (sexFromText || speciesText))) {
      meaning = 'individual-beetle';
      confidence = idCell ? 92 : 82;
      fields.beetle_name = nameCandidate || idCell || '';
      if (idCell && !fields.beetle_name) fields.beetle_name = idCell;
      notes.push(
        idCell
          ? 'Individual beetle row with explicit ID'
          : 'Name-like value with sex/species context'
      );
    } else if (
      textCells.length === 1 &&
      !isDevelopmentalStageLabel(textCells[0]) &&
      !speciesText &&
      !isAdultLabel(textCells[0])
    ) {
      meaning = 'note';
      confidence = 65;
      fields.notes = textCells[0];
      notes.push('Single text cell note');
    } else {
      meaning = 'uncertain';
      confidence = 45;
      fields.notes = fullText;
      notes.push('Could not infer confidently — please choose meaning');
    }
  }

  // Never assign pure numbers or stage labels as beetle names
  if (isPureNumber(fields.beetle_name) || isDevelopmentalStageLabel(fields.beetle_name)) {
    fields.beetle_name = '';
    if (fields.count === '' && isPureNumber(cells.find((cell) => isPureNumber(cell)) ?? '')) {
      fields.count = cells.find((cell) => isPureNumber(cell)) ?? '';
    }
    if (!fields.stage_status && isDevelopmentalStageLabel(cells.find((cell) => isDevelopmentalStageLabel(cell)) ?? '')) {
      const misplaced = cells.find((cell) => isDevelopmentalStageLabel(cell)) ?? '';
      fields.stage_status = detectDevelopmentalStage(misplaced)?.label ?? misplaced;
    }
    if (meaning === 'individual-beetle') {
      meaning = 'stage-count';
      confidence = Math.min(confidence, 55);
      notes.push('Value moved to count/stage (not a beetle name)');
    }
  }

  if (meaning === 'stage-count') {
    const sanitized = sanitizeStageRowFields(fields, activeGroup);
    Object.assign(fields, sanitized);
  }

  const needsUserMapping = confidence < 70;

  return {
    source_row: row.source_row,
    source_sheet: row.source_sheet,
    original_cells: [...cells],
    detected_meaning: meaning,
    user_meaning: meaning,
    confidence,
    needs_user_mapping: needsUserMapping,
    inherit_group: meaning === 'stage-count' && Boolean(activeGroup || fields.species_or_group),
    suggested_fields: { ...fields },
    user_fields: { ...fields },
    detection_notes: notes.join('. '),
  };
}


/** Step 1: interpret raw rows without creating beetle profiles */
export function interpretRawRows(parsed: ParsedSpreadsheet): InterpretedRow[] {
  let currentGroup = '';
  let currentSheet = '';
  let activeGroupStage: ActiveGroupStage = '';
  const interpreted: InterpretedRow[] = [];

  parsed.allRows.forEach((row) => {
    if (row.source_sheet && row.source_sheet !== currentSheet) {
      currentSheet = row.source_sheet;
      const fromSheet = inferSpeciesFromSheetName(currentSheet);
      if (fromSheet) currentGroup = fromSheet;
      activeGroupStage = '';
    }

    const item = interpretSingleRow(row, currentGroup, activeGroupStage);
    const meaning = item.user_meaning;
    const speciesField = item.user_fields.species_or_group;

    if (meaning === 'group-header') {
      if (shouldPromoteToActiveGroup(speciesField)) {
        currentGroup = speciesField;
      }
      activeGroupStage = headerStageFromFields(item.user_fields);
    }

    if (meaning === 'stage-count') {
      const explicitStage = inventoryKeyFromLabel(item.user_fields.stage_status);
      if (explicitStage && ['l1', 'l2', 'l3', 'eggs', 'pupa', 'prePupa'].includes(explicitStage)) {
        // Keep header adult context for later numeric-only rows.
      } else if (explicitStage === 'adult') {
        activeGroupStage = 'adult';
      }

      const sanitized = sanitizeStageRowFields(item.user_fields, currentGroup);
      item.user_fields = { ...sanitized };
      item.suggested_fields = { ...sanitizeStageRowFields(item.suggested_fields, currentGroup) };
      item.inherit_group = Boolean(currentGroup);
      if (currentGroup && !item.user_fields.species_or_group) {
        item.user_fields.species_or_group = currentGroup;
        item.suggested_fields.species_or_group = currentGroup;
      }
    }

    interpreted.push(item);
  });

  return interpreted;
}

function splitNameAndStageMarker(text: string): { name: string; stage: StageDetection | null } {
  const trimmed = text.trim();
  if (!trimmed) return { name: '', stage: null };

  const trailing = trimmed.match(/^(.+?)\s+(adult|larva|pupa|egg|juvenile|nymph)s?$/i);
  if (trailing) {
    const stage = detectDevelopmentalStage(trailing[2]);
    if (stage) {
      return { name: trailing[1].trim(), stage };
    }
  }

  const wholeStage = detectDevelopmentalStage(trimmed);
  if (wholeStage) {
    return { name: '', stage: wholeStage };
  }

  return { name: trimmed, stage: null };
}

function parsePopulationHeaderFields(cells: string[], _fullText: string): {
  species: string;
  lineName: string;
  generation: string;
  origin: string;
  category: string;
  headerAdultCount: number;
  headerStageLabel: string;
} {
  const textCells = cells.map((c) => c.trim()).filter(Boolean);
  const category = textCells.find((c) => isHeadcountCategory(c)) ?? '';
  const origin = parseOriginFromCells(textCells);

  const adultCell =
    textCells.find((c) => isAdultLabel(c) || /^adults?$/i.test(c)) ?? '';
  const generation = adultCell
    ? parseGenerationFromStageLabel(adultCell) || parseStrictGeneration(adultCell)
    : parseGenerationFromCells(textCells);

  const lineName = textCells.find((c) => isValidLineName(c) && !isMetaInventoryCell(c)) ?? '';
  const species = lineName;

  const numericCells = extractNumbers(cells);
  const headerAdultCount =
    adultCell && numericCells.length > 0 ? parseNumeric(numericCells[numericCells.length - 1]) : 0;

  return {
    species,
    lineName,
    generation,
    origin,
    category,
    headerAdultCount,
    headerStageLabel: adultCell ? detectDevelopmentalStage(adultCell)?.label ?? 'Adult' : '',
  };
}

interface InventoryGroupDraft {
  sourceRow: number;
  sourceSheet?: string;
  species: string;
  lineName: string;
  generation: string;
  origin: string;
  category: string;
  notes: string;
  inventoryCounts: DraftInventoryCounts;
}

function createInventoryGroupDraft(row: InterpretedRow, cells: string[]): InventoryGroupDraft | null {
  const fullText = row.original_cells.join(' | ').trim();
  const header = parsePopulationHeaderFields(cells, fullText);
  const species =
    resolveParentSpecies(row.user_fields.species_or_group, '') ||
    header.species ||
    header.lineName;

  if (!species && !header.lineName) {
    return null;
  }

  const lineName = header.lineName || row.user_fields.species_or_group || species;
  const notesParts = [row.user_fields.notes?.trim(), header.category ? `Category: ${header.category}` : '']
    .filter(Boolean)
    .join('; ');

  const draft: InventoryGroupDraft = {
    sourceRow: row.source_row,
    sourceSheet: row.source_sheet,
    species: species || lineName,
    lineName,
    generation: parseStrictGeneration(row.user_fields.generation || header.generation),
    origin: parseStrictOrigin(header.origin),
    category: header.category,
    notes: notesParts,
    inventoryCounts: emptyInventoryCounts(),
  };

  if (header.headerAdultCount > 0) {
    draft.inventoryCounts.adult = header.headerAdultCount;
  }

  return draft;
}

function inventoryGroupPreviewFromDraft(draft: InventoryGroupDraft): PopulationGroupPreview {
  const counts = draft.inventoryCounts;
  const total =
    counts.eggs + counts.l1 + counts.l2 + counts.l3 + counts.prePupa + counts.pupa + counts.adult;
  return {
    species: draft.species,
    lineName: draft.lineName,
    generation: draft.generation,
    origin: draft.origin,
    category: draft.category,
    eggs: counts.eggs,
    l1: counts.l1,
    l2: counts.l2,
    l3: counts.l3,
    prePupa: counts.prePupa,
    pupa: counts.pupa,
    adult: counts.adult,
    total,
    sourceSheet: draft.sourceSheet,
  };
}

function sanitizeInventoryGroupDraft(draft: InventoryGroupDraft): void {
  draft.generation = parseStrictGeneration(draft.generation);
  draft.origin = parseStrictOrigin(draft.origin);
  if (isValidLineName(draft.lineName)) {
    draft.species = draft.lineName;
  }
}

function isValidInventoryGroupDraft(draft: InventoryGroupDraft): boolean {
  if (!isValidLineName(draft.lineName) && !isValidLineName(draft.species)) return false;
  if (isObservationNoteText(draft.lineName) || isObservationNoteText(draft.species)) return false;
  return inventoryCountTotal(draft.inventoryCounts) > 0;
}

function applyStageRowToInventoryDraft(
  draft: InventoryGroupDraft,
  row: InterpretedRow,
  stageRecords: GeneratedStageRecord[],
  validationWarnings: string[],
  fallbackStage: ActiveGroupStage = ''
): void {
  const f = row.user_fields;
  let stageLabel = f.stage_status || '';
  const stage = detectDevelopmentalStage(stageLabel);
  const countVal = parseNumeric(f.count);
  let inventoryKey = stage ? inventoryKeyFromStage(stage) : inventoryKeyFromLabel(stageLabel);

  if (!inventoryKey && fallbackStage && countVal > 0) {
    inventoryKey = fallbackStage;
    stageLabel = stageLabel || INVENTORY_COUNT_LABELS[fallbackStage];
  }

  if (inventoryKey && countVal > 0) {
    draft.inventoryCounts[inventoryKey] = countVal;
  }

  if (countVal > 0 && !f.weight) {
    const rowText = row.original_cells.join(' ');
    if (!cellHasWeightUnit(rowText) && !cellHasSizeUnit(rowText)) {
      validationWarnings.push(
        `${PLAIN_NUMBERS_AS_COUNTS_WARNING} (${stageLabel || 'stage'} row ${row.source_row})`
      );
    }
  }

  if (stage?.generation && !draft.generation) {
    draft.generation = parseStrictGeneration(stage.generation);
  }

  stageRecords.push({
    source_row: row.source_row,
    species: draft.species,
    stage: stageLabel || 'Unknown',
    count: f.count,
    attachedToGroup: draft.lineName || draft.species,
  });
}

function findBlockSpeciesName(
  interpreted: InterpretedRow[],
  startIndex: number,
  currentGroup: string
): string {
  for (let i = startIndex; i < Math.min(startIndex + 5, interpreted.length); i++) {
    const row = interpreted[i];
    const leading = extractLeadingNameColumn(row.original_cells);
    if (leading && isValidLineName(leading)) return leading;
    const name = sanitizeBeetleNameCandidate(row.user_fields.beetle_name || '');
    if (name && isValidLineName(name)) return name;
    const species = sanitizeBeetleNameCandidate(row.user_fields.species_or_group || '');
    if (species && isValidLineName(species)) return species;
  }
  return isValidLineName(currentGroup) ? currentGroup : '';
}

function openInventoryGroupFromContext(
  row: InterpretedRow,
  cells: string[],
  interpreted: InterpretedRow[],
  rowIndex: number,
  currentGroup: string
): InventoryGroupDraft | null {
  const lineNameCandidate =
    sanitizeBeetleNameCandidate(row.user_fields.species_or_group) ||
    findBlockSpeciesName(interpreted, rowIndex, currentGroup) ||
    extractLeadingNameColumn(cells);

  if (!lineNameCandidate || !isValidLineName(lineNameCandidate)) {
    return null;
  }

  const lineName = lineNameCandidate;

  const header = parsePopulationHeaderFields(cells, row.original_cells.join(' | ').trim());

  return {
    sourceRow: row.source_row,
    sourceSheet: row.source_sheet,
    species: resolveParentSpecies(row.user_fields.species_or_group, header.species || lineName),
    lineName,
    generation: parseStrictGeneration(row.user_fields.generation || header.generation),
    origin: parseStrictOrigin(header.origin),
    category: header.category,
    notes: '',
    inventoryCounts: emptyInventoryCounts(),
  };
}

/** Step 2: generate inventory groups and individual beetles from user-confirmed rows */
export function generateRecordsFromConfirmed(params: {
  interpreted: InterpretedRow[];
  existingBeetles: Beetle[];
  existingGrowthEntries: GrowthEntry[];
  growthSheets?: { name: string; rows: RawSheetRow[] }[];
  sourceFileName?: string;
  sheetNames?: string[];
}): StructuredImportBuild {
  const {
    interpreted,
    existingBeetles,
    existingGrowthEntries,
    growthSheets = [],
    sourceFileName = '',
    sheetNames = [],
  } = params;
  const beetles: Beetle[] = [];
  const growthEntries: GrowthEntry[] = [];
  const speciesInventoryMap = new Map<string, SpeciesInventory>();
  const populationGroups: PopulationGroupPreview[] = [];
  const stageRecords: GeneratedStageRecord[] = [];
  const validationWarnings: string[] = [];
  const now = new Date().toISOString();
  let currentGroup = '';
  let skippedRows = 0;
  let activeGroupStage: ActiveGroupStage = '';
  let groupDraft: InventoryGroupDraft | null = null;

  const flushInventoryGroupDraft = () => {
    if (!groupDraft) return;

    sanitizeInventoryGroupDraft(groupDraft);

    if (!isValidInventoryGroupDraft(groupDraft)) {
      validationWarnings.push(
        `Row ${groupDraft.sourceRow}: skipped invalid population group "${groupDraft.lineName || groupDraft.species}" (needs valid species and at least one stage count).`
      );
      groupDraft = null;
      return;
    }

    const speciesWarning = validateGeneratedSpecies(groupDraft.species, `row ${groupDraft.sourceRow}`);
    if (speciesWarning) validationWarnings.push(speciesWarning);

    mergeDraftInventory(
      speciesInventoryMap,
      {
        species: groupDraft.species,
        lineName: groupDraft.lineName,
        generation: groupDraft.generation,
        origin: groupDraft.origin,
        notes: groupDraft.notes,
        sourceFile: sourceFileName,
        sourceSheet: groupDraft.sourceSheet,
        importedAt: now,
      },
      groupDraft.inventoryCounts
    );
    populationGroups.push(inventoryGroupPreviewFromDraft(groupDraft));
    groupDraft = null;
  };

  interpreted.forEach((row, rowIndex) => {
    const meaning = row.user_meaning;
    const f = { ...row.user_fields };
    const cells = row.original_cells;

    if (meaning === 'empty' || meaning === 'note') {
      skippedRows += 1;
      return;
    }

    if (meaning === 'group-header') {
      flushInventoryGroupDraft();
      activeGroupStage = '';

      const draft = createInventoryGroupDraft(row, cells);
      if (draft) {
        groupDraft = draft;
        activeGroupStage = headerStageFromFields(f);
        if (shouldPromoteToActiveGroup(draft.lineName)) {
          currentGroup = draft.lineName;
        } else if (shouldPromoteToActiveGroup(draft.species)) {
          currentGroup = draft.species;
        }

        if (f.count || f.weight || f.stage_status) {
          applyStageRowToInventoryDraft(
            groupDraft,
            { ...row, user_fields: f },
            stageRecords,
            validationWarnings,
            activeGroupStage
          );
        }
      } else {
        const warning = validateGeneratedSpecies(f.species_or_group, `row ${row.source_row} group header`);
        if (warning) validationWarnings.push(warning);
        validationWarnings.push(
          `Row ${row.source_row}: could not derive a population group from header — check species/line name.`
        );
        skippedRows += 1;
      }
      return;
    }

    if (meaning === 'stage-count' || meaning === 'uncertain') {
      const sanitized = sanitizeStageRowFields(f, currentGroup);
      Object.assign(f, sanitized);

      const stageLabel = f.stage_status || f.notes || '';
      const hasStageData = Boolean(f.count || f.weight || f.size || stageLabel);

      if (meaning === 'stage-count' && hasStageData) {
        if (!groupDraft) {
          const opened = openInventoryGroupFromContext(row, cells, interpreted, rowIndex, currentGroup);
          if (opened) {
            groupDraft = opened;
            if (shouldPromoteToActiveGroup(opened.lineName)) currentGroup = opened.lineName;
          }
        }

        if (!groupDraft) {
          validationWarnings.push(
            `Row ${row.source_row}: stage row "${stageLabel || 'unknown'}" has no parent population group — add a header row (e.g. "Hercules Hercules | headcount | adult(F4)").`
          );
          skippedRows += 1;
          return;
        }

        applyStageRowToInventoryDraft(
          groupDraft,
          { ...row, user_fields: f },
          stageRecords,
          validationWarnings,
          activeGroupStage
        );
      } else {
        skippedRows += 1;
      }
      return;
    }

    if (meaning === 'individual-beetle') {
      flushInventoryGroupDraft();

      const species = resolveParentSpecies(f.species_or_group, row.inherit_group ? currentGroup : '');
      if (shouldPromoteToActiveGroup(f.species_or_group)) {
        currentGroup = f.species_or_group;
      }

      const name = f.beetle_name.trim();
      if (!name || isPureNumber(name) || isDevelopmentalStageLabel(name)) {
        skippedRows += 1;
        return;
      }

      const speciesWarning = validateGeneratedSpecies(species, `row ${row.source_row}`);
      if (speciesWarning) validationWarnings.push(speciesWarning);

      const stageLabel = f.stage_status || '';
      const stage = (detectDevelopmentalStage(stageLabel)?.beetleStatus || parseStage(stageLabel) || 'adult') as BeetleStatus;
      const sex = parseSex(f.sex) || 'unknown';
      const beetleId = nextBeetleId(existingBeetles.length, beetles.length);

      beetles.push({
        id: beetleId,
        name,
        species,
        sex,
        source: `import-row-${row.source_row}`,
        generation: f.generation,
        notes: f.notes?.trim() ?? '',
        bloodline: '',
        status: stage,
        createdAt: now.slice(0, 10),
      });

      const rowText = row.original_cells.join(' ');
      const growthWeight =
        cellHasWeightUnit(rowText) || cellHasWeightUnit(f.weight) ? parseNumeric(f.weight) : 0;

      if (growthWeight > 0) {
        growthEntries.push({
          id: `GE-${String(existingGrowthEntries.length + growthEntries.length + 1).padStart(3, '0')}`,
          beetleId,
          date: f.date || now.slice(0, 10),
          stage: instarFromStageLabel(stageLabel) as GrowthStage,
          weight: growthWeight,
          temperature: 0,
          humidity: 0,
          substrate: 'Flake Soil',
          notes: f.notes,
          createdAt: now.slice(0, 10),
        });
      }
      return;
    }

    skippedRows += 1;
  });

  flushInventoryGroupDraft();

  if (growthSheets.length > 0) {
    const sheetImport = importGrowthEntriesFromSheets(
      growthSheets,
      [...existingBeetles, ...beetles],
      [...existingGrowthEntries, ...growthEntries]
    );
    beetles.push(...sheetImport.newBeetles);
    growthEntries.push(...sheetImport.growthEntries);
  }

  const speciesInventory = Array.from(speciesInventoryMap.values());
  const inventorySheetNames = new Set(
    interpreted.map((r) => r.source_sheet).filter(Boolean) as string[]
  );
  const growthSheetNames = new Set(growthSheets.map((s) => s.name));
  const sheetsProcessed = sheetNames.filter((n) => inventorySheetNames.has(n) || growthSheetNames.has(n));
  const sheetsSkipped = sheetNames.filter((n) => !sheetsProcessed.includes(n));

  return {
    beetles,
    growthEntries,
    speciesInventory,
    populationGroups,
    stageRecords,
    validationWarnings: [...new Set(validationWarnings)],
    summary: {
      sourceRows: interpreted.length,
      importedBeetles: beetles.length,
      importedGrowthEntries: growthEntries.length,
      inventoryGroupsCreated: populationGroups.length,
      totalPopulation: speciesInventory.reduce(
        (sum, row) =>
          sum + row.eggs + row.l1 + row.l2 + row.l3 + row.prePupa + row.pupa + row.adult,
        0
      ),
      importedSpecies: speciesInventory.length,
      skippedRows,
      sheetsProcessed,
      sheetsSkipped,
      growthSheetsImported: growthSheets.map((s) => s.name),
    },
  };
}

export const ROW_MEANING_OPTIONS: { value: RowMeaning; label: string }[] = [
  { value: 'group-header', label: 'Population group' },
  { value: 'stage-count', label: 'Stage / count row' },
  { value: 'individual-beetle', label: 'Individual beetle' },
  { value: 'note', label: 'Note row' },
  { value: 'empty', label: 'Empty / ignore' },
  { value: 'uncertain', label: 'Uncertain — needs mapping' },
];

export const FIELD_KEYS: (keyof RowFieldDraft)[] = [
  'species_or_group',
  'beetle_name',
  'stage_status',
  'sex',
  'generation',
  'count',
  'weight',
  'size',
  'date',
  'notes',
];
