import { describe, expect, it } from 'vitest';
import type { Beetle } from '@/types';
import {
  LARVAL_GROWTH_LONG_SHEET,
  LARVAL_GROWTH_PARTIAL_PIVOT,
  LARVAL_GROWTH_PIVOT_SHEET,
} from '@/test-fixtures/larvalGrowthPivotFixture';
import {
  beetleImportIdSortKey,
  importGrowthEntriesFromSheets,
  isGrowthTrackingSheet,
  normalizeBeetleImportId,
  remapGrowthEntriesToSavedBeetles,
} from './importGrowthSheet';
import type { RawSheetRow } from './importSpreadsheet';

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

describe('isGrowthTrackingSheet', () => {
  it('detects Larval Growth pivot worksheets', () => {
    const rows = sheetRows(LARVAL_GROWTH_PIVOT_SHEET);
    expect(isGrowthTrackingSheet('Larval Growth', rows)).toBe(true);
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
});
