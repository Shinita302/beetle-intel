import type { ImportRowBlock } from '@/types/hybridImport';
import type { InterpretedRow } from './importSpreadsheet';

/** Group nearby inventory rows into population blocks (not row-by-row). */
export function detectInventoryBlocks(interpreted: InterpretedRow[]): ImportRowBlock[] {
  const blocks: ImportRowBlock[] = [];
  let current: ImportRowBlock | null = null;

  const flush = () => {
    if (current && current.rowIndices.length > 0) {
      blocks.push(current);
    }
    current = null;
  };

  for (let i = 0; i < interpreted.length; i++) {
    const row = interpreted[i];
    const meaning = row.user_meaning;

    if (meaning === 'empty') {
      flush();
      continue;
    }

    if (meaning === 'note') {
      if (current) {
        current.noteRows.push(row.original_cells.filter(Boolean).join(' | ') || row.detection_notes);
      }
      continue;
    }

    if (meaning === 'group-header') {
      flush();
      current = {
        id: `block-${row.source_row}`,
        headerIndex: i,
        rowIndices: [i],
        sourceSheet: row.source_sheet,
        startRow: row.source_row,
        endRow: row.source_row,
        noteRows: [],
      };
      continue;
    }

    if (meaning === 'stage-count') {
      if (!current) {
        current = {
          id: `block-${row.source_row}`,
          headerIndex: -1,
          rowIndices: [i],
          sourceSheet: row.source_sheet,
          startRow: row.source_row,
          endRow: row.source_row,
          noteRows: [],
        };
      } else {
        current.rowIndices.push(i);
        current.endRow = row.source_row;
      }
      continue;
    }

    if (meaning === 'individual-beetle') {
      flush();
    }
  }

  flush();
  return blocks;
}

export function rowsForBlock(interpreted: InterpretedRow[], block: ImportRowBlock): InterpretedRow[] {
  return block.rowIndices.map((index) => interpreted[index]).filter(Boolean);
}
