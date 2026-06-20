import { describe, expect, it } from 'vitest';
import { parsePopulationBlocks } from './importPopulationBlockParser';
import { isStrictPopulationHeaderRow, isValidSpeciesFromHeader } from './importFieldParsing';
import {
  HERCULES_F4_BLOCK,
  LAMPRIMA_BLOCK,
  LAMPRIMA_SIMPLE_BLOCK,
} from '@/test-fixtures/trackingNoteFixture';
import type { RawSheetRow } from './importSpreadsheet';

function mockRows(rows: string[][]): RawSheetRow[] {
  return rows.map((cells, i) => ({
    source_row: i + 1,
    source_sheet: 'Inventory',
    cells,
    raw_text: cells.filter(Boolean).join(' | '),
  }));
}

describe('importPopulationBlockParser', () => {
  it('only starts blocks on strict header rows', () => {
    expect(isStrictPopulationHeaderRow(['lamprima adolphinae', 'headcount', 'adult(F4+)', 'CB'])).toBe(true);
    expect(isStrictPopulationHeaderRow(['3 females'])).toBe(false);
    expect(isStrictPopulationHeaderRow(['3 males'])).toBe(false);
    expect(isValidSpeciesFromHeader('3 females')).toBe(false);
  });

  it('parses lamprima block with stage rows and sex metadata', () => {
    const result = parsePopulationBlocks(mockRows(LAMPRIMA_BLOCK));
    expect(result.blocks).toHaveLength(1);

    const block = result.blocks[0];
    expect(block.species).toBe('lamprima adolphinae');
    expect(block.origin).toBe('CB');
    expect(block.generation).toBe('F4+');
    expect(block.eggs).toBe(17);
    expect(block.adult).toBe(6);
    expect(block.l3).toBe(16);
    expect(block.males).toBe(3);
    expect(block.females).toBe(3);
    expect(result.blocks.some((b) => b.species === '3 females')).toBe(false);
  });

  it('keeps sex breakdown rows in metadata for simple adult-count layout', () => {
    const result = parsePopulationBlocks(mockRows(LAMPRIMA_SIMPLE_BLOCK));
    expect(result.blocks).toHaveLength(1);
    expect(result.blocks[0].species).toBe('lamprima adolphinae');
    expect(result.blocks[0].adult).toBe(16);
    expect(result.blocks[0].males).toBe(3);
    expect(result.blocks[0].females).toBe(3);
  });

  it('attaches date observations to hercules block without creating species', () => {
    const result = parsePopulationBlocks(mockRows(HERCULES_F4_BLOCK));
    expect(result.blocks).toHaveLength(1);
    expect(result.blocks[0].species).toBe('Hercules Hercules');
    expect(result.blocks[0].l1).toBe(106);
    expect(result.blocks[0].adult).toBe(24);
    expect(result.blocks[0].metadataNotes.some((n) => n.includes('December'))).toBe(true);
  });
});
