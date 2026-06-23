import { describe, expect, it } from 'vitest';
import type { Beetle } from '@/types';
import {
  LARVAL_GROWTH_LONG_SHEET,
  LARVAL_GROWTH_PARTIAL_PIVOT,
  LARVAL_GROWTH_PIVOT_SHEET,
  LARVAL_GROWTH_WIDE_SHEET,
  TRACKING_NOTE_JUN_2025_GROWTH,
} from '@/test-fixtures/larvalGrowthPivotFixture';
import {
  beetleImportIdSortKey,
  beetlesWithGrowthData,
  detectBreederLarvaGrowthLayout,
  detectWideLarvaGrowthLayout,
  importGrowthEntriesFromSheets,
  isGrowthTrackingSheet,
  normalizeBeetleImportId,
  parseDateLoose,
  parseExcelSerialDate,
  parseFlexibleDate,
  remapGrowthEntriesToSavedBeetles,
  repairGrowthEntryBeetleIds,
} from './importGrowthSheet';
import type { RawSheetRow } from '@/types/rawSheetRow';

function sheetRows(fixture: { name: string; rows: string[][] }): RawSheetRow[] {
  return fixture.rows.map((cells, i) => ({
    source_row: i + 1,
    source_sheet: fixture.name,
    cells,
    raw_text: cells.filter(Boolean).join(' | '),
  }));
}

describe('normalizeBeetleImportId', () => {
  it('normalizes padded and underscored IDs', () => {
    expect(normalizeBeetleImportId('B-035')).toBe('B-35');
    expect(normalizeBeetleImportId('b_40')).toBe('B-40');
    expect(normalizeBeetleImportId('B-1')).toBe('B-1');
  });
});

describe('parseFlexibleDate', () => {
  it('parses UK day-first dates from breeder sheets', () => {
    expect(parseDateLoose('10/03/2025')).toBe('2025-03-10');
    expect(parseDateLoose('14/06/2025')).toBe('2025-06-14');
  });

  it('parses excel serial dates from Tracking Note Jun 2025', () => {
    expect(parseExcelSerialDate('45933')).toBe('2025-10-03');
    expect(parseFlexibleDate('45933')).toBe('2025-10-03');
    expect(parseFlexibleDate('14/06/2025')).toBe('2025-06-14');
  });
});

describe('detectBreederLarvaGrowthLayout', () => {
  it('detects Tracking Note Jun 2025 Larval Growth matrix', () => {
    const rows = sheetRows(TRACKING_NOTE_JUN_2025_GROWTH);
    expect(detectBreederLarvaGrowthLayout(rows)).not.toBeNull();
    expect(detectWideLarvaGrowthLayout(rows)).toBeNull();
    expect(isGrowthTrackingSheet('Larval Growth', rows)).toBe(true);
  });
});

describe('importGrowthEntriesFromSheets — Tracking Note Jun 2025', () => {
  it('imports B-1 with two weights and skips blank B-35+', () => {
    const result = importGrowthEntriesFromSheets(
      [{ name: TRACKING_NOTE_JUN_2025_GROWTH.name, rows: sheetRows(TRACKING_NOTE_JUN_2025_GROWTH) }],
      [],
      []
    );

    expect(result.newBeetles.map((b) => b.name)).toContain('B-1');
    expect(result.newBeetles.some((b) => b.name === 'B-35')).toBe(false);

    const b1 = result.growthEntries.filter((e) => e.beetleId === 'B-1');
    expect(b1).toHaveLength(2);
    expect(b1.map((e) => e.weight).sort()).toEqual([80, 87]);
    expect(b1.map((e) => e.date).sort()).toEqual(['2025-06-14', '2025-10-03']);

    expect(result.audit.importedBeetleIds).toEqual(['B-1', 'B-2', 'B-3', 'B-34']);
    expect(result.audit.missingBeetleIds).toEqual(['B-35', 'B-36']);
  });
});

describe('isGrowthTrackingSheet', () => {
  it('detects Larval Growth wide worksheets', () => {
    const rows = sheetRows(LARVAL_GROWTH_WIDE_SHEET);
    expect(isGrowthTrackingSheet('Larval Growth', rows)).toBe(true);
    expect(detectWideLarvaGrowthLayout(rows)?.dateColumns).toHaveLength(2);
  });

  it('detects Larval Growth pivot worksheets', () => {
    const rows = sheetRows(LARVAL_GROWTH_PIVOT_SHEET);
    expect(isGrowthTrackingSheet('Larval Growth', rows)).toBe(true);
  });
});

describe('importGrowthEntriesFromSheets — wide layout (breeder sheet)', () => {
  it('imports B-1 with both measurement dates and skips blank B-35+', () => {
    const result = importGrowthEntriesFromSheets(
      [{ name: LARVAL_GROWTH_WIDE_SHEET.name, rows: sheetRows(LARVAL_GROWTH_WIDE_SHEET) }],
      [],
      []
    );

    expect(result.newBeetles.map((b) => b.name).sort((a, b) => beetleImportIdSortKey(a) - beetleImportIdSortKey(b))).toEqual([
      'B-1',
      'B-2',
      'B-3',
    ]);
    expect(result.newBeetles.some((b) => b.name === 'B-35')).toBe(false);

    const b1Entries = result.growthEntries.filter((e) => e.beetleId === 'B-1');
    expect(b1Entries).toHaveLength(2);
    expect(b1Entries.map((e) => e.date).sort()).toEqual(['2025-03-10', '2025-06-14']);
    expect(b1Entries.map((e) => e.weight).sort()).toEqual([10, 25]);

    expect(result.audit.importedBeetleIds).toEqual(['B-1', 'B-2', 'B-3']);
    expect(result.audit.missingBeetleIds).toEqual(['B-35', 'B-36']);
  });
});

describe('importGrowthEntriesFromSheets — pivot layout', () => {
  it('imports all B-1…B-5 larvae with historical weights', () => {
    const result = importGrowthEntriesFromSheets(
      [{ name: LARVAL_GROWTH_PIVOT_SHEET.name, rows: sheetRows(LARVAL_GROWTH_PIVOT_SHEET) }],
      [],
      []
    );

    expect(result.newBeetles.map((b) => b.name).sort((a, b) => beetleImportIdSortKey(a) - beetleImportIdSortKey(b))).toEqual([
      'B-1',
      'B-2',
      'B-3',
      'B-4',
      'B-5',
    ]);
    expect(result.audit.missingBeetleIds).toEqual([]);
    expect(result.audit.excelGrowthRecordCount).toBe(13);
    expect(result.audit.importedGrowthRecordCount).toBe(13);

    const b4Entries = result.growthEntries.filter((e) => e.beetleId === 'B-4');
    expect(b4Entries).toHaveLength(2);
    expect(b4Entries.map((e) => e.weight).sort()).toEqual([20, 38]);
  });

  it('imports B-35 through B-40 from partial pivot block', () => {
    const result = importGrowthEntriesFromSheets(
      [{ name: LARVAL_GROWTH_PARTIAL_PIVOT.name, rows: sheetRows(LARVAL_GROWTH_PARTIAL_PIVOT) }],
      [],
      []
    );

    expect(result.newBeetles).toHaveLength(6);
    expect(result.audit.expectedBeetleIds).toEqual(['B-35', 'B-36', 'B-37', 'B-38', 'B-39', 'B-40']);
    expect(result.audit.missingBeetleIds).toEqual([]);
    expect(result.growthEntries.filter((e) => e.beetleId === 'B-40')).toHaveLength(2);
  });
});

describe('importGrowthEntriesFromSheets — long format with beetle ID', () => {
  it('creates per-larva beetles and multiple measurements', () => {
    const result = importGrowthEntriesFromSheets(
      [{ name: LARVAL_GROWTH_LONG_SHEET.name, rows: sheetRows(LARVAL_GROWTH_LONG_SHEET) }],
      [],
      []
    );

    expect(result.newBeetles.map((b) => b.name).sort()).toEqual(['B-1', 'B-40']);
    expect(result.growthEntries.filter((e) => e.beetleId === 'B-40')).toHaveLength(2);
    expect(result.growthEntries.filter((e) => e.beetleId === 'B-1')).toHaveLength(2);
  });
});

describe('remapGrowthEntriesToSavedBeetles', () => {
  it('rewires growth entry beetleIds after Supabase UUID assignment', () => {
    const imported: Beetle[] = [
      {
        id: 'B-40',
        name: 'B-40',
        species: 'Dynastes Hercules Hercules',
        sex: 'unknown',
        status: 'larva',
        generation: '',
        notes: '',
        source: 'growth-sheet-import',
        bloodline: '',
        createdAt: '2025-06-01',
      },
    ];
    const saved: Beetle[] = [
      {
        ...imported[0],
        id: 'uuid-abc-123',
      },
    ];
    const remapped = remapGrowthEntriesToSavedBeetles(imported, saved, [
      {
        id: 'GE-001',
        beetleId: 'B-40',
        date: '2025-06-01',
        stage: 'L3',
        weight: 35,
        temperature: 0,
        humidity: 0,
        substrate: '',
        notes: '',
        createdAt: '2025-06-01',
      },
    ]);

    expect(remapped[0].beetleId).toBe('uuid-abc-123');
  });

  it('remaps by larva name when Supabase row order differs from import order', () => {
    const imported: Beetle[] = [
      {
        id: 'B-2',
        name: 'B-2',
        species: 'Dynastes Hercules Hercules',
        sex: 'unknown',
        status: 'larva',
        generation: '',
        notes: '',
        source: 'growth-sheet-import',
        bloodline: '',
        createdAt: '2025-06-01',
      },
      {
        id: 'B-1',
        name: 'B-1',
        species: 'Dynastes Hercules Hercules',
        sex: 'unknown',
        status: 'larva',
        generation: '',
        notes: '',
        source: 'growth-sheet-import',
        bloodline: '',
        createdAt: '2025-06-01',
      },
    ];
    const saved: Beetle[] = [
      { ...imported[1], id: 'uuid-b1' },
      { ...imported[0], id: 'uuid-b2' },
    ];
    const remapped = remapGrowthEntriesToSavedBeetles(imported, saved, [
      {
        id: 'GE-001',
        beetleId: 'B-1',
        date: '2025-03-10',
        stage: 'L3',
        weight: 10,
        temperature: 0,
        humidity: 0,
        substrate: '',
        notes: '',
        createdAt: '2025-03-10',
      },
    ]);

    expect(remapped[0].beetleId).toBe('uuid-b1');
  });

  it('repairs orphaned B-1 growth entry ids to beetle UUIDs', () => {
    const beetles: Beetle[] = [
      {
        id: 'uuid-b1',
        name: 'B-1',
        species: 'Dynastes Hercules Hercules',
        sex: 'unknown',
        status: 'larva',
        generation: '',
        notes: '',
        source: 'growth-sheet-import',
        bloodline: '',
        createdAt: '2025-06-01',
      },
    ];
    const repaired = repairGrowthEntryBeetleIds(beetles, [
      {
        id: 'GE-001',
        beetleId: 'B-1',
        date: '2025-03-10',
        stage: 'L3',
        weight: 10,
        temperature: 0,
        humidity: 0,
        substrate: '',
        notes: '',
        createdAt: '2025-03-10',
      },
    ]);
    expect(repaired[0].beetleId).toBe('uuid-b1');
    expect(beetlesWithGrowthData(beetles, repaired)).toHaveLength(1);
  });
});
