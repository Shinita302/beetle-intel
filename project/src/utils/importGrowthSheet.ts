import type { Beetle, GrowthEntry, GrowthStage } from '@/types';
import type { GrowthImportAudit } from '@/types/growthImport';
import type { RawSheetRow } from '@/types/rawSheetRow';
import { safeCellText } from './importFieldParsing';

export type { GrowthImportAudit, GrowthImportSkippedRow } from '@/types/growthImport';

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

/** Dates in columns, larva IDs in rows — breeder “Larval Growth” tab layout. */
interface WideLarvaGrowthLayout {
  headerRow: RawSheetRow;
  beetleIdColumnIndex: number;
  dateColumns: Array<{ index: number; date: string; header: string }>;
}

/** Dates in rows, larva IDs in columns — alternate pivot layout. */
interface PivotGrowthLayout {
  headerRow: RawSheetRow;
  dateColumnIndex: number;
  beetleColumns: Array<{ index: number; beetleId: string }>;
}

/**
 * Tracking Note Jun 2025 “Larval Growth” tab:
 * Sex | B-ID | Weight@date1 | Headwidth | Weight@date2
 * Header: DHH(L3)(TG) | 45933 (excel date) | Weight(g) | Headwidth(mm) | 14/06/2025
 */
interface BreederLarvaGrowthLayout {
  headerRow: RawSheetRow;
  beetleIdColumnIndex: number;
  sexColumnIndex?: number;
  batchLabel: string;
  stageLabel: GrowthStage;
  measurementColumns: Array<{ date: string; weightIndex: number; header: string }>;
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

/** Parse breeder date cells — ISO, DD/MM/YYYY, and natural language. */
export function parseDateLoose(raw: string): string {
  const text = safeCellText(raw);
  if (!text) return '';
  if (/^date$/i.test(text)) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;

  const dmy = text.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (dmy) {
    const day = parseInt(dmy[1], 10);
    const month = parseInt(dmy[2], 10);
    let year = parseInt(dmy[3], 10);
    if (year < 100) year += 2000;
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  const d = new Date(text);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

/** Excel serial date (e.g. 45933 → 2025-10-03) from breeder spreadsheets. */
export function parseExcelSerialDate(value: string): string {
  const n = Number(safeCellText(value));
  if (!Number.isFinite(n) || n < 20000 || n > 60000) return '';
  const utc = Date.UTC(1899, 11, 30) + Math.round(n) * 86400000;
  return new Date(utc).toISOString().slice(0, 10);
}

export function parseFlexibleDate(raw: string): string {
  const serial = parseExcelSerialDate(raw);
  if (serial) return serial;
  return parseDateLoose(raw);
}

function isMeasurementMetaCell(cell: string): boolean {
  return /weight|headwidth|head\s*width|size|length|\(g\)|\(mm\)|grams?/i.test(safeCellText(cell));
}

function parseStageFromBatchLabel(label: string): GrowthStage {
  const match = safeCellText(label).match(/\(\s*(L[123])\s*\)/i);
  if (match) return match[1].toUpperCase() as GrowthStage;
  return 'L3';
}

function inferSpeciesFromGrowthBatchLabel(label: string, sheetName: string): string {
  const text = safeCellText(label);
  if (/dhh/i.test(text)) return 'Dynastes Hercules Hercules';
  if (/dynastes/i.test(text) && /hercules/i.test(text)) return 'Dynastes Hercules Hercules';
  return inferSpeciesFromSheetName(sheetName) || sheetName.trim() || 'Unknown species';
}

function parseBreederGrowthHeaderMeasurements(
  headerCells: string[]
): Array<{ date: string; weightIndex: number; header: string }> {
  const measurements: Array<{ date: string; weightIndex: number; header: string }> = [];
  const usedWeightIndexes = new Set<number>();

  for (let i = 0; i < headerCells.length; i++) {
    const cell = headerCells[i];
    const date = parseFlexibleDate(cell);
    if (!date) continue;

    const next = headerCells[i + 1] ?? '';
    if (isMeasurementMetaCell(next) && /weight/i.test(next)) {
      const weightIndex = i + 1;
      if (!usedWeightIndexes.has(weightIndex)) {
        measurements.push({ date, weightIndex, header: cell });
        usedWeightIndexes.add(weightIndex);
      }
      continue;
    }

    if (!usedWeightIndexes.has(i)) {
      measurements.push({ date, weightIndex: i, header: cell });
      usedWeightIndexes.add(i);
    }
  }

  return measurements;
}

function isDateHeaderCell(cell: string): boolean {
  const text = safeCellText(cell);
  if (!text || /^date$/i.test(text)) return false;
  return Boolean(parseFlexibleDate(text));
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

function findBeetleIdColumnIndex(headerCells: string[], sampleDataRows: RawSheetRow[]): number {
  const labeled = headerCells.findIndex((c) => /^id$|beetle.?id|larva.?id/i.test(safeCellText(c)));
  if (labeled >= 0) return labeled;

  const counts = new Map<number, number>();
  for (const row of sampleDataRows) {
    row.cells.forEach((cell, index) => {
      if (looksLikeBeetleId(cell)) {
        counts.set(index, (counts.get(index) ?? 0) + 1);
      }
    });
  }

  let bestIndex = 0;
  let bestCount = 0;
  counts.forEach((count, index) => {
    if (count > bestCount) {
      bestCount = count;
      bestIndex = index;
    }
  });
  return bestCount > 0 ? bestIndex : 0;
}

/** Tracking Note layout: Sex | B-ID | Weight | Headwidth | Weight with excel/text dates in header. */
export function detectBreederLarvaGrowthLayout(rows: RawSheetRow[]): BreederLarvaGrowthLayout | null {
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (isEmptyRow(row.cells)) continue;

    const headerCells = row.cells.map((c) => safeCellText(c));
    const measurementColumns = parseBreederGrowthHeaderMeasurements(headerCells);
    if (measurementColumns.length < 1) continue;
    if (!headerCells.some((cell) => /weight/i.test(cell))) continue;

    const sampleData = rows.slice(i + 1, i + 12).filter((r) => !isEmptyRow(r.cells));
    const beetleIdColumnIndex = findBeetleIdColumnIndex(headerCells, sampleData);
    const beetleIdRows = sampleData.filter((r) =>
      looksLikeBeetleId(safeCellText(r.cells[beetleIdColumnIndex] ?? ''))
    ).length;
    if (beetleIdRows < 2) continue;

    const sexColumnIndex =
      sampleData.length > 0 && /^[mf]$/i.test(safeCellText(sampleData[0].cells[0] ?? '')) ? 0 : undefined;

    return {
      headerRow: row,
      beetleIdColumnIndex,
      sexColumnIndex,
      batchLabel: headerCells[0] ?? '',
      stageLabel: parseStageFromBatchLabel(headerCells[0] ?? ''),
      measurementColumns,
    };
  }

  return null;
}

/** Breeder layout: ID | 10/03/2025 | 14/06/2025 | … with B-1…B-N down rows. */
export function detectWideLarvaGrowthLayout(rows: RawSheetRow[]): WideLarvaGrowthLayout | null {
  let best: WideLarvaGrowthLayout | null = null;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (isEmptyRow(row.cells)) continue;

    const headerCells = row.cells.map((c) => safeCellText(c));
    const dateColumns = headerCells
      .map((cell, index) => ({ cell, index }))
      .filter(({ cell }) => isDateHeaderCell(cell))
      .map(({ cell, index }) => ({
        index,
        date: parseDateLoose(cell),
        header: cell,
      }))
      .filter((col) => Boolean(col.date));

    if (dateColumns.length < 1) continue;

    const sampleData = rows.slice(i + 1, i + 8).filter((r) => !isEmptyRow(r.cells));
    const beetleIdColumnIndex = findBeetleIdColumnIndex(headerCells, sampleData);
    const beetleIdRows = sampleData.filter((r) =>
      looksLikeBeetleId(safeCellText(r.cells[beetleIdColumnIndex] ?? ''))
    ).length;

    if (beetleIdRows < 1) continue;

    if (!best || dateColumns.length > best.dateColumns.length || beetleIdRows > 5) {
      best = { headerRow: row, beetleIdColumnIndex, dateColumns };
    }
  }

  return best;
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
      const firstNonBeetle = cells.findIndex(
        (c, i) => c && !looksLikeBeetleId(c) && !beetleColumns.some((b) => b.index === i)
      );
      dateColumnIndex = firstNonBeetle >= 0 ? firstNonBeetle : 0;
    }

    if (!best || beetleColumns.length > best.beetleColumns.length) {
      best = { headerRow: row, dateColumnIndex, beetleColumns };
    }
  }

  return best;
}

/** True when a worksheet looks like larval growth tracking (wide, pivot, or long layout). */
export function isGrowthTrackingSheet(sheetName: string, rows: RawSheetRow[]): boolean {
  const nonEmpty = rows.filter((row) => !isEmptyRow(row.cells));
  if (nonEmpty.length === 0) return false;

  const name = sheetName.trim().toLowerCase();
  if (/inventory|stock|count|population|summary|readme/i.test(name)) return false;

  const hasBreederFormat = Boolean(detectBreederLarvaGrowthLayout(nonEmpty));
  const hasWideFormat = Boolean(detectWideLarvaGrowthLayout(nonEmpty));
  const hasLongFormat = Boolean(findGrowthHeaderRow(nonEmpty));
  const hasPivotFormat = Boolean(detectPivotGrowthLayout(nonEmpty));

  if (/growth|larval.?track|weight.?log|track.?log|measurement|larval.?growth/i.test(name)) {
    return hasBreederFormat || hasWideFormat || hasLongFormat || hasPivotFormat;
  }
  if (/^dhh$|hercules.?growth/i.test(name)) {
    return hasBreederFormat || hasWideFormat || hasLongFormat || hasPivotFormat;
  }

  return hasBreederFormat || hasWideFormat || hasLongFormat || hasPivotFormat;
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

function importWideLarvaGrowthSheet(
  sheet: { name: string; rows: RawSheetRow[] },
  layout: WideLarvaGrowthLayout,
  defaultSpecies: string,
  pendingBeetles: Beetle[],
  existingBeetles: Beetle[],
  existingGrowthEntries: GrowthEntry[],
  growthEntries: GrowthEntry[],
  audit: GrowthImportAudit,
  now: string
): void {
  const dataRows = sheet.rows.filter(
    (row) => row.source_row > layout.headerRow.source_row && !isEmptyRow(row.cells)
  );
  let entryIndex = existingGrowthEntries.length + growthEntries.length;
  const importedIds = new Set<string>();

  for (const row of dataRows) {
    const cells = row.cells.map((c) => safeCellText(c));
    const beetleIdRaw = cells[layout.beetleIdColumnIndex] ?? '';
    if (!beetleIdRaw || !looksLikeBeetleId(beetleIdRaw)) {
      if (cells.some(Boolean)) {
        audit.skippedRows.push({
          sourceRow: row.source_row,
          sourceSheet: sheet.name,
          reason: 'Row has no valid larva ID',
          rawText: row.raw_text,
        });
      }
      continue;
    }

    const normalizedId = normalizeBeetleImportId(beetleIdRaw);
    audit.expectedBeetleIds.push(normalizedId);

    let larvaImported = 0;
    for (const dateCol of layout.dateColumns) {
      const weight = parseWeightGrams(cells[dateCol.index] ?? '');
      if (weight <= 0) continue;

      audit.excelGrowthRecordCount += 1;
      const { beetle } = resolveBeetleForGrowthImportById(
        normalizedId,
        defaultSpecies,
        pendingBeetles,
        existingBeetles,
        now
      );

      entryIndex += 1;
      growthEntries.push({
        id: `GE-${String(entryIndex).padStart(3, '0')}`,
        beetleId: beetle.id,
        date: dateCol.date,
        stage: 'L1',
        weight,
        temperature: 0,
        humidity: 0,
        substrate: '',
        notes: `Imported from sheet "${sheet.name}" (${dateCol.header})`,
        createdAt: dateCol.date,
      });
      larvaImported += 1;
      audit.importedGrowthRecordCount += 1;
    }

    if (larvaImported > 0) {
      importedIds.add(normalizedId);
    }
  }

  audit.importedBeetleIds.push(
    ...[...importedIds].sort((a, b) => beetleImportIdSortKey(a) - beetleImportIdSortKey(b))
  );
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

  const dataRows = sheet.rows.filter(
    (row) => row.source_row > layout.headerRow.source_row && !isEmptyRow(row.cells)
  );
  let entryIndex = existingGrowthEntries.length + growthEntries.length;
  const importedIds = new Set<string>();

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
    if (!date) {
      audit.skippedRows.push({
        sourceRow: row.source_row,
        sourceSheet: sheet.name,
        reason: 'Unparseable date on pivot growth row',
        rawText: row.raw_text,
      });
      continue;
    }

    let rowImported = 0;
    for (const col of layout.beetleColumns) {
      const weight = parseWeightGrams(cells[col.index] ?? '');
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
      importedIds.add(col.beetleId);
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

  audit.importedBeetleIds.push(
    ...[...importedIds].sort((a, b) => beetleImportIdSortKey(a) - beetleImportIdSortKey(b))
  );
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
  const dataRows = sheet.rows.filter(
    (row) => row.source_row > headerRow.source_row && !isEmptyRow(row.cells)
  );
  let entryIndex = existingGrowthEntries.length + growthEntries.length;
  const importedIds = new Set<string>();

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
      audit.expectedBeetleIds.push(normalizedId);
      beetle = resolveBeetleForGrowthImportById(
        beetleIdRaw,
        species,
        pendingBeetles,
        existingBeetles,
        now
      ).beetle;
      importedIds.add(normalizedId);
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

  audit.importedBeetleIds.push(
    ...[...importedIds].sort((a, b) => beetleImportIdSortKey(a) - beetleImportIdSortKey(b))
  );
}

function importBreederLarvaGrowthSheet(
  sheet: { name: string; rows: RawSheetRow[] },
  layout: BreederLarvaGrowthLayout,
  defaultSpecies: string,
  pendingBeetles: Beetle[],
  existingBeetles: Beetle[],
  existingGrowthEntries: GrowthEntry[],
  growthEntries: GrowthEntry[],
  audit: GrowthImportAudit,
  now: string
): void {
  const species =
    inferSpeciesFromGrowthBatchLabel(layout.batchLabel, sheet.name) || defaultSpecies;
  const dataRows = sheet.rows.filter(
    (row) => row.source_row > layout.headerRow.source_row && !isEmptyRow(row.cells)
  );
  let entryIndex = existingGrowthEntries.length + growthEntries.length;
  const importedIds = new Set<string>();

  for (const row of dataRows) {
    const cells = row.cells.map((c) => safeCellText(c));
    const beetleIdRaw = cells[layout.beetleIdColumnIndex] ?? '';
    if (!beetleIdRaw || !looksLikeBeetleId(beetleIdRaw)) {
      if (cells.some(Boolean)) {
        audit.skippedRows.push({
          sourceRow: row.source_row,
          sourceSheet: sheet.name,
          reason: 'Row has no valid larva ID',
          rawText: row.raw_text,
        });
      }
      continue;
    }

    const normalizedId = normalizeBeetleImportId(beetleIdRaw);
    audit.expectedBeetleIds.push(normalizedId);

    const sexRaw =
      layout.sexColumnIndex !== undefined ? cells[layout.sexColumnIndex] ?? '' : '';
    const sexNote = /^m$/i.test(sexRaw) ? 'male' : /^f$/i.test(sexRaw) ? 'female' : '';

    let larvaImported = 0;
    for (const measurement of layout.measurementColumns) {
      const weight = parseWeightGrams(cells[measurement.weightIndex] ?? '');
      if (weight <= 0) continue;

      audit.excelGrowthRecordCount += 1;
      const { beetle } = resolveBeetleForGrowthImportById(
        normalizedId,
        species,
        pendingBeetles,
        existingBeetles,
        now
      );

      if (sexNote && beetle.sex === 'unknown') {
        beetle.sex = sexNote === 'male' ? 'male' : 'female';
      }

      entryIndex += 1;
      growthEntries.push({
        id: `GE-${String(entryIndex).padStart(3, '0')}`,
        beetleId: beetle.id,
        date: measurement.date,
        stage: layout.stageLabel,
        weight,
        temperature: 0,
        humidity: 0,
        substrate: '',
        notes: [
          layout.batchLabel ? `Batch: ${layout.batchLabel}` : '',
          sexNote ? `Sex: ${sexNote}` : '',
          `Imported from sheet "${sheet.name}" (${measurement.header})`,
        ]
          .filter(Boolean)
          .join('; '),
        createdAt: measurement.date,
      });
      larvaImported += 1;
      audit.importedGrowthRecordCount += 1;
    }

    if (larvaImported > 0) {
      importedIds.add(normalizedId);
    }
  }

  audit.importedBeetleIds.push(
    ...[...importedIds].sort((a, b) => beetleImportIdSortKey(a) - beetleImportIdSortKey(b))
  );
}

function pruneBeetlesWithoutGrowth(beetles: Beetle[], growthEntries: GrowthEntry[]): Beetle[] {
  const idsWithGrowth = new Set(
    growthEntries.map((entry) => normalizeBeetleImportId(entry.beetleId))
  );
  return beetles.filter((beetle) => idsWithGrowth.has(normalizeBeetleImportId(beetle.id)));
}

/** Import dated weight rows from growth worksheets (wide, pivot, or long layout). */
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

    const breederLayout = detectBreederLarvaGrowthLayout(nonEmpty);
    const wideLayout = breederLayout ? null : detectWideLarvaGrowthLayout(nonEmpty);
    const pivotLayout = detectPivotGrowthLayout(nonEmpty);
    const headerRow = findGrowthHeaderRow(nonEmpty);
    const longColumns = headerRow ? detectGrowthSheetColumns(headerRow.cells) : null;

    if (breederLayout) {
      importBreederLarvaGrowthSheet(
        sheet,
        breederLayout,
        defaultSpecies,
        newBeetles,
        [...existingBeetles, ...newBeetles],
        existingGrowthEntries,
        growthEntries,
        audit,
        now
      );
    } else if (wideLayout) {
      importWideLarvaGrowthSheet(
        sheet,
        wideLayout,
        defaultSpecies,
        newBeetles,
        [...existingBeetles, ...newBeetles],
        existingGrowthEntries,
        growthEntries,
        audit,
        now
      );
    } else if (pivotLayout && (!longColumns || pivotLayout.beetleColumns.length >= 2)) {
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
      audit.warnings.push(
        `Sheet "${sheet.name}": no recognizable growth layout (expected breeder Sex|B-ID|Weight matrix, ID+date columns, Date+B-N pivot, or Date+Weight rows)`
      );
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
      `Larvae with no weight data: ${audit.missingBeetleIds.slice(0, 12).join(', ')}${
        audit.missingBeetleIds.length > 12 ? ` (+${audit.missingBeetleIds.length - 12} more)` : ''
      }`
    );
  }

  return {
    growthEntries,
    newBeetles: pruneBeetlesWithoutGrowth(newBeetles, growthEntries),
    audit,
  };
}

/** Remap growth entry beetleIds after Supabase assigns new UUIDs to imported beetles. */
export function remapGrowthEntriesToSavedBeetles(
  importedBeetles: Beetle[],
  savedBeetles: Beetle[],
  growthEntries: GrowthEntry[]
): GrowthEntry[] {
  const idMap = new Map<string, string>();

  for (const original of importedBeetles) {
    const saved =
      savedBeetles.find((b) => b.name === original.name && b.species === original.species) ??
      savedBeetles.find(
        (b) => normalizeBeetleImportId(b.name) === normalizeBeetleImportId(original.name)
      ) ??
      savedBeetles.find((b) => b.name === original.name);

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

/** Link orphaned growth entries (B-1 temp ids) to saved beetle UUIDs by larva name. */
export function repairGrowthEntryBeetleIds(beetles: Beetle[], growthEntries: GrowthEntry[]): GrowthEntry[] {
  if (beetles.length === 0 || growthEntries.length === 0) return growthEntries;

  const beetleById = new Map(beetles.map((beetle) => [beetle.id, beetle]));
  const beetleByImportName = new Map(
    beetles.map((beetle) => [normalizeBeetleImportId(beetle.name), beetle])
  );

  return growthEntries.map((entry) => {
    if (beetleById.has(entry.beetleId)) return entry;
    const linked = beetleByImportName.get(normalizeBeetleImportId(entry.beetleId));
    if (!linked) return entry;
    return { ...entry, beetleId: linked.id };
  });
}

export function growthEntriesForBeetle(beetle: Beetle, growthEntries: GrowthEntry[]): GrowthEntry[] {
  const beetleKey = normalizeBeetleImportId(beetle.name);
  const idKey = normalizeBeetleImportId(beetle.id);
  return growthEntries.filter((entry) => {
    if (entry.beetleId === beetle.id) return true;
    const entryKey = normalizeBeetleImportId(entry.beetleId);
    return entryKey === beetleKey || entryKey === idKey;
  });
}

export function beetlesWithGrowthData(beetles: Beetle[], growthEntries: GrowthEntry[]): Beetle[] {
  const linkedIds = new Set<string>();
  for (const beetle of beetles) {
    if (growthEntriesForBeetle(beetle, growthEntries).length > 0) {
      linkedIds.add(beetle.id);
    }
  }
  return beetles.filter((beetle) => linkedIds.has(beetle.id));
}
