import type { Beetle, GrowthEntry, GrowthStage } from '@/types';
import { safeCellText } from './importFieldParsing';
import type { RawSheetRow } from './importSpreadsheet';

export interface GrowthImportSkippedRow {
  sourceRow: number;
  sourceSheet?: string;
  reason: string;
  rawText?: string;
}

export interface GrowthImportAudit {
  sheetsProcessed: string[];
  expectedBeetleIds: string[];
  importedBeetleIds: string[];
  missingBeetleIds: string[];
  excelGrowthRecordCount: number;
  importedGrowthRecordCount: number;
  skippedRows: GrowthImportSkippedRow[];
  warnings: string[];
}

export interface GrowthSheetImportResult {
  growthEntries: GrowthEntry[];
  newBeetles: Beetle[];
  audit: GrowthImportAudit;
}

interface GrowthSheetColumnMap {
  date?: number;
  weight?: number;
  stage?: number;
  notes?: number;
  species?: number;
  beetleId?: number;
}

interface PivotGrowthLayout {
  headerRow: RawSheetRow;
  dateColumnIndex: number;
  beetleColumns: Array<{ index: number; beetleId: string }>;
}

const EMPTY_AUDIT = (): GrowthImportAudit => ({
  sheetsProcessed: [],
  expectedBeetleIds: [],
  importedBeetleIds: [],
  missingBeetleIds: [],
  excelGrowthRecordCount: 0,
  importedGrowthRecordCount: 0,
  skippedRows: [],
  warnings: [],
});

export function looksLikeBeetleId(cell: string): boolean {
  const trimmed = safeCellText(cell);
  return /^B[-_]?\d+/i.test(trimmed) || /^[A-Z]{1,3}-\d+$/i.test(trimmed);
}

/** Normalize breeder larva IDs: B-035 → B-35, b_40 → B-40 */
export function normalizeBeetleImportId(raw: string): string {
  const trimmed = safeCellText(raw);
  const match = trimmed.match(/^([A-Za-z]+)[-_]?(\d+)$/i);
  if (!match) return trimmed;
  return `${match[1].toUpperCase()}-${parseInt(match[2], 10)}`;
}

export function beetleImportIdSortKey(id: string): number {
  const match = id.match(/(\d+)$/);
  return match ? parseInt(match[1], 10) : Number.MAX_SAFE_INTEGER;
}

function isEmptyRow(cells: string[]): boolean {
  return (cells ?? []).every((c) => !safeCellText(c));
}

function parseWeightGrams(raw: string): number {
  const text = safeCellText(raw);
  if (!text) return 0;
  const gramMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:g|gram|grams)\b/i);
  if (gramMatch) return parseFloat(gramMatch[1]);
  if (/^\d+(\.\d+)?$/.test(text)) return parseFloat(text);
  const loose = text.match(/(\d+(?:\.\d+)?)/);
  return loose ? parseFloat(loose[1]) : 0;
}

function parseDateLoose(raw: string): string {
  const text = safeCellText(raw);
  if (!text) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const d = new Date(text);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

function growthStageFromCell(raw: string): GrowthStage {
  const lower = safeCellText(raw).toLowerCase();
  if (lower === 'egg' || lower === 'eggs') return 'Egg';
  if (lower === 'pupa' || lower === 'pupae') return 'Pupa';
  if (lower === 'pre-pupa' || lower === 'prepupa') return 'Pre-Pupa';
  if (/\bl1\b/.test(lower)) return 'L1';
  if (/\bl2\b/.test(lower)) return 'L2';
  if (/\bl3\b/.test(lower) || lower === 'larva') return 'L3';
  if (/adult/.test(lower)) return 'Adult';
  return 'L1';
}

function inferSpeciesFromSheetName(sheetName: string): string {
  const trimmed = sheetName.trim();
  const key = trimmed.toLowerCase();
  if (key === 'dhh') return 'Dynastes Hercules Hercules';
  if (/dynastes/i.test(trimmed) && /hercules/i.test(trimmed)) return trimmed;
  if (/larval.?growth|growth/i.test(key)) return 'Dynastes Hercules Hercules';
  return '';
}

function detectGrowthSheetColumns(headerCells: string[]): GrowthSheetColumnMap | null {
  const map: GrowthSheetColumnMap = {};
  headerCells.forEach((cell, index) => {
    const h = safeCellText(cell).toLowerCase();
    if (!h) return;
    if (/^date|checked|measured|when/.test(h)) map.date = index;
    if (/weight|mass|\(g\)|grams?/.test(h)) map.weight = index;
    if (/^stage|instar|larva/.test(h) || /^l[123]$/.test(h)) map.stage = index;
    if (/note|comment|substrate|remark/.test(h)) map.notes = index;
    if (/species|beetle.?name/.test(h)) map.species = index;
    if (/beetle.?id|larva.?id|^id$/.test(h)) map.beetleId = index;
  });

  if (map.weight === undefined) return null;
  if (map.date !== undefined || map.stage !== undefined || map.beetleId !== undefined) return map;
  return null;
}

function findGrowthHeaderRow(rows: RawSheetRow[]): RawSheetRow | null {
  for (const row of rows) {
    if (isEmptyRow(row.cells)) continue;
    if (detectGrowthSheetColumns(row.cells)) return row;
  }
  return null;
}

export function detectPivotGrowthLayout(rows: RawSheetRow[]): PivotGrowthLayout | null {
  let best: PivotGrowthLayout | null = null;

  for (const row of rows) {
    const cells = row.cells.map((c) => safeCellText(c));
    const beetleColumns: Array<{ index: number; beetleId: string }> = [];
    cells.forEach((cell, index) => {
      if (looksLikeBeetleId(cell)) {
        beetleColumns.push({ index, beetleId: normalizeBeetleImportId(cell) });
      }
    });
    if (beetleColumns.length < 2) continue;

    const dateHeaderIdx = cells.findIndex((c) => /^date|checked|measured|when$/i.test(c));
    let dateColumnIndex = 0;
    if (dateHeaderIdx >= 0 && !looksLikeBeetleId(cells[dateHeaderIdx])) {
      dateColumnIndex = dateHeaderIdx;
    } else {
      const firstNonBeetle = cells.findIndex((c, i) => c && !looksLikeBeetleId(c) && !beetleColumns.some((b) => b.index === i));
      dateColumnIndex = firstNonBeetle >= 0 ? firstNonBeetle : 0;
    }

    if (!best || beetleColumns.length > best.beetleColumns.length) {
      best = { headerRow: row, dateColumnIndex, beetleColumns };
    }
  }

  return best;
}

/** True when a worksheet looks like larval growth tracking (long or pivot layout). */
export function isGrowthTrackingSheet(sheetName: string, rows: RawSheetRow[]): boolean {
  const nonEmpty = rows.filter((row) => !isEmptyRow(row.cells));
  if (nonEmpty.length === 0) return false;

  const name = sheetName.trim().toLowerCase();
  if (/inventory|stock|count|population|summary|readme/i.test(name)) return false;

  const hasLongFormat = Boolean(findGrowthHeaderRow(nonEmpty));
  const hasPivotFormat = Boolean(detectPivotGrowthLayout(nonEmpty));

  if (/growth|larval.?track|weight.?log|track.?log|measurement|larval.?growth/i.test(name)) {
    return hasLongFormat || hasPivotFormat;
  }
  if (/^dhh$|hercules.?growth/i.test(name)) {
    return hasLongFormat || hasPivotFormat;
  }

  return hasLongFormat || hasPivotFormat;
}

function resolveBeetleForGrowthImportById(
  beetleId: string,
  species: string,
  pendingBeetles: Beetle[],
  existingBeetles: Beetle[],
  now: string
): { beetle: Beetle; created: boolean } {
  const normalizedId = normalizeBeetleImportId(beetleId);
  const pool = [...existingBeetles, ...pendingBeetles];
  const match = pool.find(
    (b) =>
      normalizeBeetleImportId(b.name) === normalizedId ||
      normalizeBeetleImportId(b.id) === normalizedId
  );

  if (match) return { beetle: match, created: false };

  const beetle: Beetle = {
    id: normalizedId,
    name: normalizedId,
    species,
    sex: 'unknown',
    status: 'larva',
    generation: '',
    notes: 'Imported from larval growth worksheet',
    source: 'growth-sheet-import',
    bloodline: '',
    createdAt: now,
  };
  pendingBeetles.push(beetle);
  return { beetle, created: true };
}

function resolveBeetleForGrowthImportBySpecies(
  species: string,
  pendingBeetles: Beetle[],
  existingBeetles: Beetle[],
  now: string,
  nextTempId: () => string
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
    id: nextTempId(),
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

function mergeAudits(audits: GrowthImportAudit[]): GrowthImportAudit {
  const merged = EMPTY_AUDIT();
  const expected = new Set<string>();
  const imported = new Set<string>();

  for (const audit of audits) {
    merged.sheetsProcessed.push(...audit.sheetsProcessed);
    audit.expectedBeetleIds.forEach((id) => expected.add(id));
    audit.importedBeetleIds.forEach((id) => imported.add(id));
    merged.excelGrowthRecordCount += audit.excelGrowthRecordCount;
    merged.importedGrowthRecordCount += audit.importedGrowthRecordCount;
    merged.skippedRows.push(...audit.skippedRows);
    merged.warnings.push(...audit.warnings);
  }

  merged.expectedBeetleIds = [...expected].sort((a, b) => beetleImportIdSortKey(a) - beetleImportIdSortKey(b));
  merged.importedBeetleIds = [...imported].sort((a, b) => beetleImportIdSortKey(a) - beetleImportIdSortKey(b));
  merged.missingBeetleIds = merged.expectedBeetleIds.filter((id) => !imported.has(id));
  merged.warnings = [...new Set(merged.warnings)];
  return merged;
}

function importPivotGrowthSheet(
  sheet: { name: string; rows: RawSheetRow[] },
  layout: PivotGrowthLayout,
  defaultSpecies: string,
  pendingBeetles: Beetle[],
  existingBeetles: Beetle[],
  existingGrowthEntries: GrowthEntry[],
  growthEntries: GrowthEntry[],
  audit: GrowthImportAudit,
  now: string
): void {
  const expectedIds = layout.beetleColumns.map((c) => c.beetleId);
  audit.expectedBeetleIds.push(...expectedIds);

  for (const beetleId of expectedIds) {
    resolveBeetleForGrowthImportById(beetleId, defaultSpecies, pendingBeetles, existingBeetles, now);
  }

  const dataRows = sheet.rows.filter((row) => row.source_row > layout.headerRow.source_row && !isEmptyRow(row.cells));
  let entryIndex = existingGrowthEntries.length + growthEntries.length;

  for (const row of dataRows) {
    const cells = row.cells.map((c) => safeCellText(c));
    const dateRaw = cells[layout.dateColumnIndex] ?? '';
    if (!dateRaw) {
      audit.skippedRows.push({
        sourceRow: row.source_row,
        sourceSheet: sheet.name,
        reason: 'Missing date on pivot growth row',
        rawText: row.raw_text,
      });
      continue;
    }

    const date = parseDateLoose(dateRaw);
    let rowImported = 0;

    for (const col of layout.beetleColumns) {
      const weightRaw = cells[col.index] ?? '';
      const weight = parseWeightGrams(weightRaw);
      if (weight <= 0) continue;

      audit.excelGrowthRecordCount += 1;
      const { beetle } = resolveBeetleForGrowthImportById(
        col.beetleId,
        defaultSpecies,
        pendingBeetles,
        existingBeetles,
        now
      );

      entryIndex += 1;
      growthEntries.push({
        id: `GE-${String(entryIndex).padStart(3, '0')}`,
        beetleId: beetle.id,
        date,
        stage: 'L1',
        weight,
        temperature: 0,
        humidity: 0,
        substrate: '',
        notes: `Imported from sheet "${sheet.name}"`,
        createdAt: date,
      });
      rowImported += 1;
      audit.importedGrowthRecordCount += 1;
    }

    if (rowImported === 0) {
      audit.skippedRows.push({
        sourceRow: row.source_row,
        sourceSheet: sheet.name,
        reason: 'Pivot row has date but no parseable weights',
        rawText: row.raw_text,
      });
    }
  }

  audit.importedBeetleIds.push(...expectedIds);
}

function importLongGrowthSheet(
  sheet: { name: string; rows: RawSheetRow[] },
  headerRow: RawSheetRow,
  columns: GrowthSheetColumnMap,
  defaultSpecies: string,
  pendingBeetles: Beetle[],
  existingBeetles: Beetle[],
  existingGrowthEntries: GrowthEntry[],
  growthEntries: GrowthEntry[],
  audit: GrowthImportAudit,
  now: string,
  nextTempId: () => string
): void {
  const dataRows = sheet.rows.filter((row) => row.source_row > headerRow.source_row && !isEmptyRow(row.cells));
  let entryIndex = existingGrowthEntries.length + growthEntries.length;
  const seenBeetleIds = new Set<string>();

  for (const row of dataRows) {
    const cells = row.cells.map((c) => safeCellText(c));
    const weightRaw = columns.weight !== undefined ? cells[columns.weight] ?? '' : '';
    const weight = parseWeightGrams(weightRaw);

    if (weight <= 0) {
      audit.skippedRows.push({
        sourceRow: row.source_row,
        sourceSheet: sheet.name,
        reason: 'Missing or zero weight',
        rawText: row.raw_text,
      });
      continue;
    }

    audit.excelGrowthRecordCount += 1;

    const dateRaw = columns.date !== undefined ? cells[columns.date] ?? '' : '';
    const date = dateRaw ? parseDateLoose(dateRaw) : now;
    const stageRaw = columns.stage !== undefined ? cells[columns.stage] ?? '' : '';
    const speciesRaw = columns.species !== undefined ? cells[columns.species] ?? '' : defaultSpecies;
    const species = speciesRaw || defaultSpecies;
    const notes = columns.notes !== undefined ? cells[columns.notes] ?? '' : '';
    const beetleIdRaw = columns.beetleId !== undefined ? cells[columns.beetleId] ?? '' : '';

    let beetle: Beetle;
    if (beetleIdRaw && looksLikeBeetleId(beetleIdRaw)) {
      const normalizedId = normalizeBeetleImportId(beetleIdRaw);
      seenBeetleIds.add(normalizedId);
      audit.expectedBeetleIds.push(normalizedId);
      beetle = resolveBeetleForGrowthImportById(
        beetleIdRaw,
        species,
        pendingBeetles,
        existingBeetles,
        now
      ).beetle;
    } else {
      beetle = resolveBeetleForGrowthImportBySpecies(
        species,
        pendingBeetles,
        existingBeetles,
        now,
        nextTempId
      ).beetle;
    }

    entryIndex += 1;
    growthEntries.push({
      id: `GE-${String(entryIndex).padStart(3, '0')}`,
      beetleId: beetle.id,
      date,
      stage: stageRaw ? growthStageFromCell(stageRaw) : 'L1',
      weight,
      temperature: 0,
      humidity: 0,
      substrate: '',
      notes: notes || `Imported from sheet "${sheet.name}"`,
      createdAt: date,
    });
    audit.importedGrowthRecordCount += 1;
  }

  audit.importedBeetleIds.push(...[...seenBeetleIds].sort((a, b) => beetleImportIdSortKey(a) - beetleImportIdSortKey(b)));
}

/** Import dated weight rows from growth worksheets (long format or pivot B-1…B-N columns). */
export function importGrowthEntriesFromSheets(
  sheets: { name: string; rows: RawSheetRow[] }[],
  existingBeetles: Beetle[],
  existingGrowthEntries: GrowthEntry[]
): GrowthSheetImportResult {
  const growthEntries: GrowthEntry[] = [];
  const newBeetles: Beetle[] = [];
  const sheetAudits: GrowthImportAudit[] = [];
  const now = new Date().toISOString().slice(0, 10);
  let tempBeetleCounter = existingBeetles.length;

  const nextTempId = () => {
    tempBeetleCounter += 1;
    return `B-${String(tempBeetleCounter).padStart(3, '0')}`;
  };

  for (const sheet of sheets) {
    const audit = EMPTY_AUDIT();
    audit.sheetsProcessed.push(sheet.name);

    const nonEmpty = sheet.rows.filter((row) => !isEmptyRow(row.cells));
    const defaultSpecies = inferSpeciesFromSheetName(sheet.name) || sheet.name.trim() || 'Unknown species';

    const pivotLayout = detectPivotGrowthLayout(nonEmpty);
    const headerRow = findGrowthHeaderRow(nonEmpty);
    const longColumns = headerRow ? detectGrowthSheetColumns(headerRow.cells) : null;

    if (pivotLayout && (!longColumns || pivotLayout.beetleColumns.length >= 2)) {
      importPivotGrowthSheet(
        sheet,
        pivotLayout,
        defaultSpecies,
        newBeetles,
        [...existingBeetles, ...newBeetles],
        existingGrowthEntries,
        growthEntries,
        audit,
        now
      );
    } else if (headerRow && longColumns) {
      importLongGrowthSheet(
        sheet,
        headerRow,
        longColumns,
        defaultSpecies,
        newBeetles,
        [...existingBeetles, ...newBeetles],
        existingGrowthEntries,
        growthEntries,
        audit,
        now,
        nextTempId
      );
    } else {
      audit.warnings.push(`Sheet "${sheet.name}": no recognizable growth layout (expected Date+Weight or B-1…B-N pivot headers)`);
      sheetAudits.push(audit);
      continue;
    }

    audit.missingBeetleIds = [...new Set(audit.expectedBeetleIds)].filter(
      (id) => !audit.importedBeetleIds.includes(id)
    );
    sheetAudits.push(audit);
  }

  const audit = mergeAudits(sheetAudits);
  if (audit.missingBeetleIds.length > 0) {
    audit.warnings.push(
      `Missing larva IDs from worksheet: ${audit.missingBeetleIds.slice(0, 12).join(', ')}${
        audit.missingBeetleIds.length > 12 ? ` (+${audit.missingBeetleIds.length - 12} more)` : ''
      }`
    );
  }

  return { growthEntries, newBeetles, audit };
}

/** Remap growth entry beetleIds after Supabase assigns new UUIDs to imported beetles. */
export function remapGrowthEntriesToSavedBeetles(
  importedBeetles: Beetle[],
  savedBeetles: Beetle[],
  growthEntries: GrowthEntry[]
): GrowthEntry[] {
  const idMap = new Map<string, string>();

  for (let i = 0; i < importedBeetles.length; i++) {
    const original = importedBeetles[i];
    const saved = savedBeetles[i];
    if (!saved) continue;
    idMap.set(original.id, saved.id);
    if (original.name) {
      idMap.set(original.name, saved.id);
      idMap.set(normalizeBeetleImportId(original.name), saved.id);
    }
  }

  return growthEntries.map((entry) => ({
    ...entry,
    beetleId: idMap.get(entry.beetleId) ?? idMap.get(normalizeBeetleImportId(entry.beetleId)) ?? entry.beetleId,
  }));
}
