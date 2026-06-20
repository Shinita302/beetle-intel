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
  TRACKING_NOTE_GROWTH_SHEET,
  TRACKING_NOTE_INVENTORY_ROWS,
} from '@/test-fixtures/trackingNoteFixture';

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
    expect(blocks).toHaveLength(1);
    expect(blocks[0].noteRows.some((n) => n.includes('May 19th'))).toBe(true);
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
    expect(result.groups[0].adult).toBe(12);
    expect(result.groups[0].l1).toBe(45);
    expect(result.groups[0].origin).toBe('CB');
    expect(result.groups[0].generation).toBe('');
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
    expect(result.skippedNotes.some((n) => n.includes('May 19th'))).toBe(true);

    const inventory = editableGroupsToSpeciesInventory(result.groups, parsed.sheetNames[0]);
    const dashboardTotal = totalPopulationInventory(inventory);
    expect(dashboardTotal).toBe(12 + 45 + 30 + 251);
    expect(result.groups.every((g) => validateImportGroup(g).length === 0 || g.adult >= 0)).toBe(true);
  });

  it('parses Hercules F4 block with generation', async () => {
    const result = await runHybridImportPipeline({
      parsed: mockParsed(HERCULES_F4_BLOCK),
      fileName: 'breeder.xlsx',
      useLlmFallback: false,
    });

    expect(result.groups[0].generation).toBe('F4');
    expect(result.groups[0].adult).toBe(24);
    expect(result.groups[0].confidence).not.toBe('low');
  });
});
