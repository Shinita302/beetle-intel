import { describe, expect, it } from 'vitest';
import { parsePopulationBlocks } from './importPopulationBlockParser';
import { isStrictPopulationHeaderRow, isValidSpeciesFromHeader } from './importFieldParsing';
import {
  HERCULES_F4_BLOCK,
  LAMPRIMA_BLOCK,
  LAMPRIMA_SIMPLE_BLOCK,
  GIRAFFE_ADULT_BLOCK,
  CALCOSOMA_CB_BLOCK,
  MUSIMON_EGG_PUPA_BLOCK,
} from '@/test-fixtures/trackingNoteFixture';
import { TRACKING_NOTE_REAL_ROWS } from '@/test-fixtures/trackingNoteRealFixture';
import type { RawSheetRow } from './importSpreadsheet';

function mockRows(rows: string[][]): RawSheetRow[] {
  return rows.map((cells, i) => ({
    source_row: i + 1,
    source_sheet: 'Sheet1',
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

  it('parses real Tracking note 2026 May-Jun.xlsx layout (all 6 species)', () => {
    const result = parsePopulationBlocks(mockRows(TRACKING_NOTE_REAL_ROWS));
    expect(result.blocks).toHaveLength(6);
    expect(result.rejectedBlocks).toHaveLength(0);

    const bySpecies = Object.fromEntries(result.blocks.map((b) => [b.species, b]));

    expect(bySpecies['lamprima adolphinae'].eggs).toBe(17);
    expect(bySpecies['lamprima adolphinae'].adult).toBe(6);
    expect(bySpecies['lamprima adolphinae'].l3).toBe(16);
    expect(bySpecies['lamprima adolphinae'].males).toBe(3);
    expect(bySpecies['lamprima adolphinae'].females).toBe(3);

    expect(bySpecies['Hercules Hercules'].adult).toBe(1);
    expect(bySpecies['Hercules Hercules'].generation).toBe('F4');

    expect(bySpecies['Calcosoma.M'].adult).toBe(1);
    expect(bySpecies['Calcosoma.M'].origin).toBe('WD');

    expect(bySpecies['Giraffe.K'].adult).toBe(4);
    expect(bySpecies['Giraffe.K'].l3).toBe(8);

    expect(bySpecies['H.Perryi'].adult).toBe(2);
    expect(bySpecies['Musimon'].adult).toBe(1);
    expect(bySpecies['Musimon'].males).toBe(1);

    expect(result.blocks.some((b) => b.species === '3 females')).toBe(false);
  });

  it('parses lamprima block with wide stage rows and sex metadata', () => {
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
  });

  it('keeps sex breakdown rows in metadata for simple adult-count layout', () => {
    const result = parsePopulationBlocks(mockRows(LAMPRIMA_SIMPLE_BLOCK));
    expect(result.blocks).toHaveLength(1);
    expect(result.blocks[0].species).toBe('lamprima adolphinae');
    expect(result.blocks[0].adult).toBe(16);
    expect(result.blocks[0].males).toBe(3);
    expect(result.blocks[0].females).toBe(3);
  });

  it('imports all standard fixture blocks', () => {
    for (const fixture of [GIRAFFE_ADULT_BLOCK, CALCOSOMA_CB_BLOCK, MUSIMON_EGG_PUPA_BLOCK]) {
      const result = parsePopulationBlocks(mockRows(fixture));
      expect(result.blocks).toHaveLength(1);
      expect(result.rejectedBlocks).toHaveLength(0);
    }
  });
});
