import Papa from 'papaparse';
import type {
  Beetle,
  BeetleSex,
  BeetleStatus,
  GrowthEntry,
  GrowthStage,
  SpeciesInventory,
} from '../types';
import { emptySpeciesInventory } from '../types';
import {
  cellHasSizeUnit,
  cellHasWeightUnit,
  metricsFromCombinedCell,
  parseStageCombinedCell,
  parseStageRowMetrics,
  PLAIN_NUMBERS_AS_COUNTS_WARNING,
} from './spreadsheetMetrics';
import { inventoryKeyForLifecycle } from './spreadsheetMetrics';
import type { LifecycleStage } from '../types/lifecycle';

interface DraftStageNotes {
  egg: string;
  l1: string;
  l2: string;
  l3: string;
  pupa: string;
  adult: string;
}

interface DraftInstarWeights {
  l1: number;
  l2: number;
  l3: number;
}

interface DraftInventoryCounts {
  eggs: number;
  l1: number;
  l2: number;
  l3: number;
  prePupa: number;
  pupa: number;
  adult: number;
}

const emptyStageNotes = (): DraftStageNotes => ({
  egg: '',
  l1: '',
  l2: '',
  l3: '',
  pupa: '',
  adult: '',
});

const emptyInstarWeights = (): DraftInstarWeights => ({ l1: 0, l2: 0, l3: 0 });

const emptyInventoryCounts = (): DraftInventoryCounts => ({
  eggs: 0,
  l1: 0,
  l2: 0,
  l3: 0,
  prePupa: 0,
  pupa: 0,
  adult: 0,
});

function combineStageNotes(notes: DraftStageNotes): string {
  return Object.values(notes)
    .map((value) => value.trim())
    .filter(Boolean)
    .join(' · ');
}

function mergeDraftInventory(
  map: Map<string, SpeciesInventory>,
  species: string,
  counts: DraftInventoryCounts
) {
  const key = species.trim();
  if (!key) return;
  const row = map.get(key.toLowerCase()) ?? emptySpeciesInventory(key, `INV-${key.slice(0, 8)}`);
  row.eggs += counts.eggs;
  row.l1 += counts.l1;
  row.l2 += counts.l2;
  row.l3 += counts.l3;
  row.prePupa += counts.prePupa;
  row.pupa += counts.pupa;
  row.adult += counts.adult;
  row.updatedAt = new Date().toISOString().slice(0, 10);
  map.set(key.toLowerCase(), row);
}

function instarToGrowthStage(instar: keyof DraftInstarWeights): GrowthStage {
  if (instar === 'l1') return 'L1';
  if (instar === 'l2') return 'L2';
  return 'L3';
}

function pushDraftGrowthEntries(
  entries: GrowthEntry[],
  beetleId: string,
  weights: DraftInstarWeights,
  notes: DraftStageNotes,
  date: string
) {
  (['l1', 'l2', 'l3'] as const).forEach((instar) => {
    const weight = weights[instar];
    if (weight <= 0) return;
    entries.push({
      id: `GE-${String(entries.length + 1).padStart(3, '0')}`,
      beetleId,
      date,
      stage: instarToGrowthStage(instar),
      weight,
      temperature: 0,
      humidity: 0,
      substrate: '',
      notes: notes[instar] ?? '',
      createdAt: date,
    });
  });
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
  cells: string[];
  raw_text: string;
}

export interface ParsedSpreadsheet {
  headers: string[];
  rows: RawSheetRow[];
  style: SpreadsheetStyle;
  /** All rows including empty ones, for exact original display */
  allRows: RawSheetRow[];
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
  stageRecords: GeneratedStageRecord[];
  validationWarnings: string[];
  summary: {
    sourceRows: number;
    importedBeetles: number;
    importedGrowthEntries: number;
    importedSpecies: number;
    skippedRows: number;
  };
}

export interface GeneratedStageRecord {
  source_row: number;
  species: string;
  stage: string;
  count: string;
  attachedToBeetle: string;
}

export interface StageDetection {
  label: string;
  beetleStatus: BeetleStatus | '';
  instar: 'L1' | 'L2' | 'L3' | '';
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
  'group-header': 'Group header',
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
  if (/^larva(e)?$/i.test(trimmed)) return { label: 'Larva', beetleStatus: 'larva', instar: '' };
  if (/^pupa(e)?$/i.test(trimmed)) return { label: 'Pupa', beetleStatus: 'pupa', instar: '' };
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

function stageDetectionToLifecycle(stage: StageDetection): LifecycleStage | null {
  if (stage.instar === 'L1') return 'L1';
  if (stage.instar === 'L2') return 'L2';
  if (stage.instar === 'L3') return 'L3';
  if (stage.label === 'Egg') return 'egg';
  if (stage.label === 'Pupa') return 'pupa';
  if (stage.beetleStatus === 'adult' || stage.label === 'Adult') return 'adult';
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

function parseGeneration(raw: string): string {
  const match = raw.match(/\b(CB)?F\d+\+?\b/i);
  return match ? match[0].toUpperCase() : raw.trim();
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

export async function parseSpreadsheet(file: File): Promise<ParsedSpreadsheet> {
  const lower = file.name.toLowerCase();
  let matrix: string[][] = [];

  if (lower.endsWith('.csv')) {
    const text = await file.text();
    const parsed = Papa.parse<string[]>(text, {
      skipEmptyLines: false,
      dynamicTyping: false,
    });
    matrix = (parsed.data as string[][]).map((row) => row.map((cell) => String(cell ?? '')));
  } else if (lower.endsWith('.xlsx')) {
    const xlsx = await import('xlsx');
    const buffer = await file.arrayBuffer();
    const workbook = xlsx.read(buffer, { type: 'array' });
    const firstSheet = workbook.SheetNames[0];
    if (!firstSheet) throw new Error('Spreadsheet has no sheets.');
    matrix = xlsx.utils.sheet_to_json<string[]>(workbook.Sheets[firstSheet], {
      header: 1,
      raw: false,
      blankrows: true,
      defval: '',
    });
  } else {
    throw new Error('Unsupported file type. Upload CSV or XLSX.');
  }

  const allRows = matrixToRows(matrix);
  const nonEmptyRows = allRows.filter((row) => !isEmptyRow(row.cells));
  const style = detectSpreadsheetStyle(nonEmptyRows);
  const headers = nonEmptyRows[0]?.cells ?? [];
  return { headers, rows: nonEmptyRows, style, allRows };
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
  return detectDevelopmentalStage(value)?.label === 'Adult';
}

function sanitizeBeetleNameCandidate(value: string): string {
  const trimmed = value.trim();
  if (!trimmed || isPureNumber(trimmed) || isDevelopmentalStageLabel(trimmed)) return '';

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

function interpretSingleRow(row: RawSheetRow, activeGroup: string): InterpretedRow {
  const cells = row.cells;
  const fields = emptyFields();
  const notes: string[] = [];
  let meaning: RowMeaning = 'uncertain';
  let confidence = 30;

  if (isEmptyRow(cells)) {
    return {
      source_row: row.source_row,
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
  const textCells = extractNonNumericText(cells);
  const numericCells = extractNumbers(cells);
  const stageRow = extractStageFromRow(cells);
  const speciesText =
    inferSpeciesFromText(fullText) ||
    textCells.find((cell) => inferSpeciesFromText(cell) && !isDevelopmentalStageLabel(cell)) ||
    '';
  const sexFromText = parseSex(fullText);
  const genMatch = fullText.match(/\b(CB)?F\d+\+?\b/i)?.[0] ?? '';
  const dateMatch = fullText.match(/\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]\d{2,4}/)?.[0] ?? '';

  if (speciesText && !isDevelopmentalStageLabel(speciesText)) {
    fields.species_or_group = speciesText;
  } else if (activeGroup) {
    fields.species_or_group = activeGroup;
  }

  if (stageRow) {
    fields.stage_status = stageRow.stage.label;
    if (stageRow.count) fields.count = stageRow.count;
    if (stageRow.weight) fields.weight = stageRow.weight;
    if (stageRow.size) fields.size = stageRow.size;
    if (stageRow.parseWarnings.length > 0) {
      notes.push(...stageRow.parseWarnings);
    }
  } else {
    const stageFromText = detectDevelopmentalStage(fullText);
    if (stageFromText) {
      fields.stage_status = stageFromText.label;
    }
  }

  if (sexFromText) fields.sex = sexFromText;
  if (genMatch) fields.generation = parseGeneration(genMatch);
  if (dateMatch) fields.date = parseDateLoose(dateMatch);

  // Priority 1: group header / profile anchor (before stage rows)
  if (isGroupAnchorRow(cells, fullText)) {
    meaning = 'group-header';
    confidence = 88;
    const headerFields = parseGroupHeaderFields(cells, fullText);
    const leadingName = sanitizeBeetleNameCandidate(extractLeadingNameColumn(cells));
    fields.beetle_name = sanitizeBeetleNameCandidate(headerFields.beetleName) || leadingName;
    fields.species_or_group = headerFields.species || fields.beetle_name || speciesText;
    fields.stage_status =
      headerFields.profileStatus === 'adult'
        ? 'Adult'
        : headerFields.profileStatus === 'pupa'
          ? 'Pupa'
          : headerFields.profileStatus === 'larva'
            ? 'Larva'
            : '';
    if (!fields.stage_status && textCells.some((cell) => isAdultLabel(cell))) {
      fields.stage_status = 'Adult';
    }
    const numericCellsOnHeader = extractNumbers(cells);
    if (numericCellsOnHeader[0] && fields.stage_status === 'Adult') {
      fields.count = numericCellsOnHeader[0];
      if (numericCellsOnHeader[1]) fields.weight = numericCellsOnHeader[1];
    }
    notes.push('Beetle profile header — name only here; L1/L2/L3/Adult counts go to stage notes below');
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

  // Priority 3: Numeric-only row
  else if (numericCells.length > 0 && textCells.length === 0) {
    meaning = 'stage-count';
    confidence = 62;
    fields.count = numericCells.join(', ');
    fields.species_or_group = activeGroup || fields.species_or_group;
    notes.push('Numeric-only row treated as count/measurement');
  }

  // Priority 4: Long note
  else if (fullText.length > 50 && cells.filter(Boolean).length <= 2) {
    meaning = 'note';
    confidence = 72;
    fields.notes = fullText;
    notes.push('Long free-text note');
  }

  // Priority 5: Individual beetle
  else {
    const nameCandidate = textCells.find(
      (cell) =>
        looksLikeName(cell) &&
        !inferSpeciesFromText(cell) &&
        !isDevelopmentalStageLabel(cell) &&
        !isAdultLabel(cell)
    );
    if (nameCandidate && (sexFromText || speciesText)) {
      meaning = 'individual-beetle';
      confidence = 82;
      fields.beetle_name = nameCandidate;
      notes.push('Name-like value with sex/species context');
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
  const interpreted: InterpretedRow[] = [];

  parsed.allRows.forEach((row) => {
    const leadingName = extractLeadingNameColumn(row.cells);
    if (leadingName && !isDevelopmentalStageLabel(leadingName)) {
      currentGroup = leadingName;
    }

    const item = interpretSingleRow(row, currentGroup);
    const meaning = item.user_meaning;
    const speciesField = item.user_fields.species_or_group;

    if (meaning === 'group-header' && shouldPromoteToActiveGroup(speciesField)) {
      currentGroup = speciesField;
    } else if (meaning === 'group-header' && shouldPromoteToActiveGroup(item.user_fields.beetle_name)) {
      currentGroup = item.user_fields.beetle_name;
    }

    if (meaning === 'stage-count') {
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

function parseGroupHeaderFields(cells: string[], fullText: string): {
  beetleName: string;
  species: string;
  profileStatus: BeetleStatus;
} {
  const textCells = extractNonNumericText(cells);
  const nonStageCells = textCells.filter((cell) => !isDevelopmentalStageLabel(cell));
  const stageCells = textCells.filter((cell) => isDevelopmentalStageLabel(cell));

  let beetleName = '';
  let profileStatus: BeetleStatus = 'larva';

  if (nonStageCells[0]) {
    const parsed = splitNameAndStageMarker(nonStageCells[0]);
    beetleName = parsed.name || nonStageCells[0];
    if (parsed.stage?.beetleStatus) profileStatus = parsed.stage.beetleStatus as BeetleStatus;
  } else if (textCells[0]) {
    const parsed = splitNameAndStageMarker(textCells[0]);
    beetleName = parsed.name;
    if (parsed.stage?.beetleStatus) profileStatus = parsed.stage.beetleStatus as BeetleStatus;
  }

  if (stageCells[0]) {
    const stage = detectDevelopmentalStage(stageCells[0]);
    if (stage?.beetleStatus) profileStatus = stage.beetleStatus as BeetleStatus;
  }

  if (!beetleName && textCells[0]) {
    const parsed = splitNameAndStageMarker(textCells[0]);
    if (parsed.name) beetleName = parsed.name;
  }

  const species =
    inferSpeciesFromText(beetleName) ||
    inferSpeciesFromText(fullText) ||
    (beetleName && !isDevelopmentalStageLabel(beetleName) ? beetleName : '');

  return {
    beetleName: sanitizeBeetleNameCandidate(beetleName),
    species: species.trim(),
    profileStatus,
  };
}

function stageNoteKeyFromDetection(stage: StageDetection): keyof DraftStageNotes | null {
  if (stage.instar === 'L1') return 'l1';
  if (stage.instar === 'L2') return 'l2';
  if (stage.instar === 'L3') return 'l3';
  if (stage.beetleStatus === 'adult' || stage.label === 'Adult') return 'adult';
  if (stage.label === 'Pupa') return 'l3';
  if (stage.label === 'Egg' || stage.label === 'Larva') return 'l1';
  return null;
}

/** Count / extra text only — gram weight is stored on instarWeights. */
function buildInstarNoteContent(fields: RowFieldDraft): string {
  const parts: string[] = [];
  if (fields.count) parts.push(`Count: ${fields.count}`);
  if (fields.size) parts.push(`Size: ${fields.size} mm`);
  const extra = fields.notes?.trim();
  if (extra && !isDevelopmentalStageLabel(extra) && extra !== fields.stage_status) {
    parts.push(extra);
  }
  return parts.join(', ');
}

function buildAdultStageNoteContent(fields: RowFieldDraft): string {
  const parts: string[] = [];
  if (fields.count) parts.push(`Count: ${fields.count}`);
  if (fields.weight) parts.push(`Weight: ${fields.weight} g`);
  if (fields.size) parts.push(`Size: ${fields.size} mm`);
  const extra = fields.notes?.trim();
  if (extra && !isDevelopmentalStageLabel(extra) && extra !== fields.stage_status) {
    parts.push(extra);
  }
  return parts.join(', ');
}

function appendStageNote(existing: string, addition: string): string {
  if (!addition) return existing;
  if (!existing) return addition;
  return `${existing}; ${addition}`;
}

interface GroupBeetleDraft {
  sourceRow: number;
  name: string;
  species: string;
  status: BeetleStatus;
  sex: BeetleSex;
  generation: string;
  bloodline: string;
  stageNotes: DraftStageNotes;
  instarWeights: DraftInstarWeights;
  inventoryCounts: DraftInventoryCounts;
  adultWeightImport: number;
  adultSizeImport: number;
}

function createGroupDraft(row: InterpretedRow, cells: string[]): GroupBeetleDraft | null {
  const fullText = row.original_cells.join(' | ').trim();
  const header = parseGroupHeaderFields(cells, fullText);
  const name = sanitizeBeetleNameCandidate(row.user_fields.beetle_name || header.beetleName);

  if (!name) {
    return null;
  }

  const profileStatus = header.profileStatus;

  return {
    sourceRow: row.source_row,
    name,
    species: resolveParentSpecies(row.user_fields.species_or_group, header.species || name),
    status: profileStatus,
    sex: parseSex(row.user_fields.sex) || 'unknown',
    generation: row.user_fields.generation,
    bloodline: '',
    stageNotes: emptyStageNotes(),
    instarWeights: emptyInstarWeights(),
    inventoryCounts: emptyInventoryCounts(),
    adultWeightImport: 0,
    adultSizeImport: 0,
  };
}

function finalizeGroupDraft(
  draft: GroupBeetleDraft,
  beetleIndex: number,
  existingBeetleCount: number,
  now: string
): Beetle {
  return {
    id: nextBeetleId(existingBeetleCount, beetleIndex),
    name: draft.name,
    species: draft.species,
    sex: draft.sex,
    source: `import-row-${draft.sourceRow}`,
    generation: draft.generation,
    notes: combineStageNotes(draft.stageNotes),
    bloodline: draft.bloodline,
    status: draft.status,
    createdAt: now,
  };
}

function applyStageRowToDraft(
  draft: GroupBeetleDraft,
  row: InterpretedRow,
  stageRecords: GeneratedStageRecord[],
  validationWarnings: string[]
): void {
  const f = row.user_fields;
  const stageLabel = f.stage_status || '';
  const stage = detectDevelopmentalStage(stageLabel);
  const noteKey = stage ? stageNoteKeyFromDetection(stage) : null;
  const weightGrams = parseNumeric(f.weight);
  const countVal = parseNumeric(f.count);
  const lifecycle = stage ? stageDetectionToLifecycle(stage) : null;
  const inventoryKey = lifecycle ? inventoryKeyForLifecycle(lifecycle) : null;

  if (inventoryKey && countVal > 0) {
    draft.inventoryCounts[inventoryKey] = countVal;
  }

  if (countVal > 0 && weightGrams === 0 && !f.weight) {
    const rowText = row.original_cells.join(' ');
    if (!cellHasWeightUnit(rowText) && !cellHasSizeUnit(rowText)) {
      validationWarnings.push(
        `${PLAIN_NUMBERS_AS_COUNTS_WARNING} (${stageLabel || 'stage'} row ${row.source_row})`
      );
    }
  }

  if (noteKey === 'l1' || noteKey === 'l2' || noteKey === 'l3') {
    if (weightGrams > 0) {
      draft.instarWeights[noteKey] = weightGrams;
    }
    const noteContent = buildInstarNoteContent(f);
    if (noteContent) {
      draft.stageNotes[noteKey] = appendStageNote(draft.stageNotes[noteKey], noteContent);
    }
  } else if (noteKey === 'adult') {
    if (weightGrams > 0) {
      draft.adultWeightImport = weightGrams;
    }
    const sizeVal = parseNumeric(f.size);
    if (sizeVal > 0) {
      draft.adultSizeImport = sizeVal;
    }
    const noteContent = buildAdultStageNoteContent(f);
    if (noteContent) {
      draft.stageNotes.adult = appendStageNote(draft.stageNotes.adult, noteContent);
    }
  } else if (stageLabel) {
    const noteContent = buildInstarNoteContent(f);
    if (noteContent) {
      draft.stageNotes.adult = appendStageNote(draft.stageNotes.adult, `${stageLabel}: ${noteContent}`);
    }
  }

  stageRecords.push({
    source_row: row.source_row,
    species: draft.species,
    stage: stageLabel || 'Unknown',
    count: f.count,
    attachedToBeetle: draft.name,
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
    if (leading) return leading;
    const name = sanitizeBeetleNameCandidate(row.user_fields.beetle_name || '');
    if (name) return name;
    const species = sanitizeBeetleNameCandidate(row.user_fields.species_or_group || '');
    if (species) return species;
  }
  return currentGroup;
}

function openGroupDraftFromContext(
  row: InterpretedRow,
  cells: string[],
  interpreted: InterpretedRow[],
  rowIndex: number,
  currentGroup: string
): GroupBeetleDraft | null {
  const name = sanitizeBeetleNameCandidate(
    row.user_fields.beetle_name ||
      findBlockSpeciesName(interpreted, rowIndex, currentGroup) ||
      extractLeadingNameColumn(cells)
  );

  if (!name) {
    return null;
  }

  const header = parseGroupHeaderFields(cells, row.original_cells.join(' | ').trim());

  return {
    sourceRow: row.source_row,
    name,
    species: resolveParentSpecies(row.user_fields.species_or_group, header.species || name),
    status: 'larva',
    sex: parseSex(row.user_fields.sex) || 'unknown',
    generation: row.user_fields.generation,
    bloodline: '',
    stageNotes: emptyStageNotes(),
    instarWeights: emptyInstarWeights(),
    inventoryCounts: emptyInventoryCounts(),
    adultWeightImport: 0,
    adultSizeImport: 0,
  };
}

/** Step 2: generate beetle profiles only from user-confirmed rows */
export function generateRecordsFromConfirmed(params: {
  interpreted: InterpretedRow[];
  existingBeetles: Beetle[];
  existingGrowthEntries: GrowthEntry[];
}): StructuredImportBuild {
  const { interpreted, existingBeetles, existingGrowthEntries } = params;
  const beetles: Beetle[] = [];
  const growthEntries: GrowthEntry[] = [];
  const speciesInventoryMap = new Map<string, SpeciesInventory>();
  const stageRecords: GeneratedStageRecord[] = [];
  const validationWarnings: string[] = [];
  const now = new Date().toISOString().slice(0, 10);
  let currentGroup = '';
  let skippedRows = 0;
  let groupDraft: GroupBeetleDraft | null = null;

  const flushGroupDraft = () => {
    if (!groupDraft) return;

    const nameWarning = validateGeneratedSpecies(groupDraft.name, `row ${groupDraft.sourceRow} beetle name`);
    if (nameWarning) {
      validationWarnings.push(nameWarning);
      groupDraft = null;
      return;
    }

    const speciesWarning = validateGeneratedSpecies(groupDraft.species, `row ${groupDraft.sourceRow}`);
    if (speciesWarning) validationWarnings.push(speciesWarning);

    const beetle = finalizeGroupDraft(groupDraft, beetles.length, existingBeetles.length, now);
    beetles.push(beetle);
    mergeDraftInventory(speciesInventoryMap, beetle.species, groupDraft.inventoryCounts);
    pushDraftGrowthEntries(
      growthEntries,
      beetle.id,
      groupDraft.instarWeights,
      groupDraft.stageNotes,
      now
    );
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
      flushGroupDraft();

      const draft = createGroupDraft(row, cells);
      if (draft) {
        groupDraft = draft;
        if (shouldPromoteToActiveGroup(draft.species)) {
          currentGroup = draft.species;
        } else if (shouldPromoteToActiveGroup(draft.name)) {
          currentGroup = draft.name;
        }

        if (f.count || f.weight) {
          applyStageRowToDraft(groupDraft, { ...row, user_fields: f }, stageRecords, validationWarnings);
        }
      } else {
        const warning = validateGeneratedSpecies(f.species_or_group, `row ${row.source_row} group header`);
        if (warning) validationWarnings.push(warning);
        validationWarnings.push(
          `Row ${row.source_row}: could not derive a beetle name from group header — stage labels cannot be beetle names.`
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
          const opened = openGroupDraftFromContext(row, cells, interpreted, rowIndex, currentGroup);
          if (opened) {
            groupDraft = opened;
            if (shouldPromoteToActiveGroup(opened.name)) currentGroup = opened.name;
          }
        }

        if (!groupDraft) {
          validationWarnings.push(
            `Row ${row.source_row}: stage row "${stageLabel || 'unknown'}" has no parent group header — add a name row (e.g. "Hercules adult") or put the beetle name in the first column.`
          );
          skippedRows += 1;
          return;
        }

        applyStageRowToDraft(groupDraft, { ...row, user_fields: f }, stageRecords, validationWarnings);
        skippedRows += 1;
      } else {
        skippedRows += 1;
      }
      return;
    }

    if (meaning === 'individual-beetle') {
      flushGroupDraft();

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
        createdAt: now,
      });

      const rowText = row.original_cells.join(' ');
      const growthWeight =
        cellHasWeightUnit(rowText) || cellHasWeightUnit(f.weight) ? parseNumeric(f.weight) : 0;

      if (growthWeight > 0) {
        growthEntries.push({
          id: `GE-${String(existingGrowthEntries.length + growthEntries.length + 1).padStart(3, '0')}`,
          beetleId,
          date: f.date || now,
          stage: instarFromStageLabel(stageLabel) as GrowthStage,
          weight: growthWeight,
          temperature: 0,
          humidity: 0,
          substrate: 'Flake Soil',
          notes: f.notes,
          createdAt: now,
        });
      }
      return;
    }

    skippedRows += 1;
  });

  flushGroupDraft();

  return {
    beetles,
    growthEntries,
    speciesInventory: Array.from(speciesInventoryMap.values()),
    stageRecords,
    validationWarnings: [...new Set(validationWarnings)],
    summary: {
      sourceRows: interpreted.length,
      importedBeetles: beetles.length,
      importedGrowthEntries: growthEntries.length,
      importedSpecies: speciesInventoryMap.size,
      skippedRows,
    },
  };
}

export const ROW_MEANING_OPTIONS: { value: RowMeaning; label: string }[] = [
  { value: 'group-header', label: 'Group header' },
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
