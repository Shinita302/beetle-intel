import { describe, expect, it } from 'vitest';
import { detectInventoryBlocks } from './importBlockDetection';
import { validateImportGroup } from './importGroupValidation';
import {
  editableGroupsToSpeciesInventory,
  runHybridImportPipeline,
} from './hybridImportPipeline';
import { interpretRawRows, type ParsedSpreadsheet } from './importSpreadsheet';
import { totalPopulationInventory } from '@/types';
import {
  GIRAFFE_ADULT_BLOCK,
  GIRAFFE_WITH_OBSERVATION,
  HERCULES_F4_BLOCK,
  HPERRyi_ADULT_ONLY_BLOCK,
  LAMPRIMA_BLOCK,
  LAMPRIMA_SIMPLE_BLOCK,
  SIX_SPECIES_INVENTORY_ROWS,
  TRACKING_NOTE_GROWTH_SHEET,
  TRACKING_NOTE_INVENTORY_ROWS,
} from '@/test-fixtures/trackingNoteFixture';
import { TRACKING_NOTE_REAL_ROWS } from '@/test-fixtures/trackingNoteRealFixture';
import { LARVAL_GROWTH_WIDE_SHEET } from '@/test-fixtures/larvalGrowthPivotFixture';

function mockParsed(rows: string[][], sheet = 'Inventory'): ParsedSpreadsheet {
  const allRows = rows.map((cells, i) => ({
    source_row: i + 1,
    source_sheet: sheet,
    cells,
    raw_text: cells.filter(Boolean).join(' | '),
  }));
  return {
    headers: rows[0] ?? [],
    rows: allRows,
    allRows,
    style: 'block-notes',
    growthSheets: [],
    sheetNames: [sheet],
  };
}

describe('hybrid import pipeline', () => {
  it('detects blocks from nearby rows', () => {
    const interpreted = interpretRawRows(mockParsed(GIRAFFE_WITH_OBSERVATION));
    const blocks = detectInventoryBlocks(interpreted);
    expect(blocks.length).toBeGreaterThanOrEqual(1);
  });

  it('maps Giraffe adult numeric row to adult_count via block parser', async () => {
    const parsed = mockParsed(GIRAFFE_ADULT_BLOCK);
    const result = await runHybridImportPipeline({
      parsed,
      fileName: 'Tracking note 2026 May-Jun.xlsx',
      useLlmFallback: false,
    });

    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].lineName).toBe('Giraffe.K');
    expect(result.groups[0].adult).toBe(4);
    expect(result.groups[0].l3).toBe(8);
    expect(result.groups[0].origin).toBe('CB');
    expect(result.individualBeetleCount).toBe(0);
  });

  it('parses Tracking note fixture with matching dashboard total', async () => {
    const growthRows = TRACKING_NOTE_GROWTH_SHEET.rows.map((cells, i) => ({
      source_row: i + 1,
      source_sheet: TRACKING_NOTE_GROWTH_SHEET.name,
      cells,
      raw_text: cells.join(' | '),
    }));

    const parsed: ParsedSpreadsheet = {
      ...mockParsed(TRACKING_NOTE_INVENTORY_ROWS),
      growthSheets: [{ name: TRACKING_NOTE_GROWTH_SHEET.name, rows: growthRows }],
      sheetNames: ['Inventory', TRACKING_NOTE_GROWTH_SHEET.name, 'Notes'],
    };

    const result = await runHybridImportPipeline({
      parsed,
      fileName: 'Tracking note 2026 May-Jun.xlsx',
      useLlmFallback: false,
    });

    expect(result.groups.length).toBeGreaterThanOrEqual(2);

    const inventory = editableGroupsToSpeciesInventory(result.groups, parsed.sheetNames[0]);
    const dashboardTotal = totalPopulationInventory(inventory);
    expect(dashboardTotal).toBe(4 + 8 + 1);
  });

  it('parses Hercules F4 block with generation', async () => {
    const result = await runHybridImportPipeline({
      parsed: mockParsed(HERCULES_F4_BLOCK),
      fileName: 'breeder.xlsx',
      useLlmFallback: false,
    });

    expect(result.groups[0].generation).toBe('F4');
    expect(result.groups[0].adult).toBe(1);
    expect(result.groups[0].confidence).not.toBe('low');
  });

  it('parses lamprima block-first with sex metadata never becoming species', async () => {
    const result = await runHybridImportPipeline({
      parsed: mockParsed(LAMPRIMA_BLOCK),
      fileName: 'Tracking note 2026 May-Jun.xlsx',
      useLlmFallback: false,
    });

    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].lineName).toBe('lamprima adolphinae');
    expect(result.groups[0].eggs).toBe(17);
    expect(result.groups[0].adult).toBe(6);
    expect(result.groups[0].l3).toBe(16);
    expect(result.groups[0].notes).toMatch(/3 males/);
    expect(result.groups[0].notes).toMatch(/3 females/);
    expect(result.groups.some((g) => g.lineName === '3 females')).toBe(false);
  });

  it('parses simple lamprima layout with adult-only numeric row', async () => {
    const result = await runHybridImportPipeline({
      parsed: mockParsed(LAMPRIMA_SIMPLE_BLOCK),
      fileName: 'Tracking note 2026 May-Jun.xlsx',
      useLlmFallback: false,
    });

    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].adult).toBe(16);
    expect(result.groups[0].lineName).toBe('lamprima adolphinae');
  });

  it('imports all six species from mixed-format inventory sheet', async () => {
    const result = await runHybridImportPipeline({
      parsed: mockParsed(SIX_SPECIES_INVENTORY_ROWS),
      fileName: 'Tracking note 2026 May-Jun.xlsx',
      useLlmFallback: false,
    });

    const lineNames = result.groups.map((g) => g.lineName);
    expect(lineNames).toContain('lamprima adolphinae');
    expect(lineNames).toContain('Hercules Hercules');
    expect(lineNames).toContain('Giraffe.K');
    expect(lineNames).toContain('Calcosoma.M');
    expect(lineNames).toContain('H.Perryi');
    expect(lineNames).toContain('Musimon');
    expect(result.groups.length).toBe(6);
    expect(result.groupAudit.filter((a) => a.status === 'imported').length).toBe(6);
  });

  it('imports real Tracking note workbook rows (6 species)', async () => {
    const result = await runHybridImportPipeline({
      parsed: mockParsed(TRACKING_NOTE_REAL_ROWS, 'Sheet1'),
      fileName: 'Tracking note 2026 May-Jun.xlsx',
      useLlmFallback: false,
    });

    expect(result.groups).toHaveLength(6);
    expect(result.groupAudit.filter((a) => a.status === 'rejected')).toHaveLength(0);

    const lamprima = result.groups.find((g) => g.lineName === 'lamprima adolphinae');
    expect(lamprima?.eggs).toBe(17);
    expect(lamprima?.adult).toBe(6);
    expect(lamprima?.l3).toBe(16);

    expect(result.groups.find((g) => g.lineName === 'Hercules Hercules')?.adult).toBe(1);
    expect(result.groups.find((g) => g.lineName === 'Giraffe.K')?.l3).toBe(8);
    expect(result.groups.find((g) => g.lineName === 'Musimon')?.adult).toBe(1);
  });

  it('includes adult-only groups in audit as imported', async () => {
    const result = await runHybridImportPipeline({
      parsed: mockParsed(HPERRyi_ADULT_ONLY_BLOCK),
      fileName: 'breeder.xlsx',
      useLlmFallback: false,
    });

    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].adult).toBe(2);
    expect(result.groupAudit[0].status).toBe('imported');
  });

  it('imports wide larval growth without changing inventory totals', async () => {
    const growthRows = LARVAL_GROWTH_WIDE_SHEET.rows.map((cells, i) => ({
      source_row: i + 1,
      source_sheet: LARVAL_GROWTH_WIDE_SHEET.name,
      cells,
      raw_text: cells.join(' | '),
    }));
    const parsed: ParsedSpreadsheet = {
      ...mockParsed(TRACKING_NOTE_REAL_ROWS, 'Sheet1'),
      growthSheets: [{ name: LARVAL_GROWTH_WIDE_SHEET.name, rows: growthRows }],
      sheetNames: ['Sheet1', LARVAL_GROWTH_WIDE_SHEET.name],
    };

    const result = await runHybridImportPipeline({
      parsed,
      fileName: 'Tracking note 2026 May-Jun.xlsx',
      useLlmFallback: false,
    });

    expect(result.groups).toHaveLength(6);
    expect(result.growthEntryCount).toBeGreaterThan(0);
    expect(result.growthAudit?.importedBeetleIds).toEqual(['B-1', 'B-2', 'B-3']);
    expect(result.growthAudit?.missingBeetleIds).toEqual(['B-35', 'B-36']);

    const inventory = editableGroupsToSpeciesInventory(result.groups, 'test.xlsx');
    expect(totalPopulationInventory(inventory)).toBeGreaterThan(0);
    expect(result.groups.find((g) => g.lineName === 'lamprima adolphinae')?.eggs).toBe(17);
  });
});
