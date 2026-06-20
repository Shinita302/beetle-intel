import type { ImportRowBlock } from '@/types/hybridImport';
import { isSexCountLabel, isValidLineName } from './importFieldParsing';
import { inferSpeciesFromHeaderCells } from './importPopulationHeaderDetection';
import type { InterpretedRow } from './importSpreadsheet';
import { interpretedRowText } from './importSpreadsheet';
import { looksLikePopulationGroupHeader } from './importPopulationHeaderDetection';

function isBlockStarterRow(row: InterpretedRow): boolean {
  if (row.user_meaning === 'note' || row.user_meaning === 'empty') return false;

  const text = interpretedRowText(row);
  if (isSexCountLabel(text)) return false;

  if (row.user_meaning === 'group-header') return true;
  return looksLikePopulationGroupHeader(row.original_cells, text);
}

function rowHasStageData(row: InterpretedRow): boolean {
  const f = row.user_fields;
  return Boolean(f.count || f.weight || f.size || f.stage_status);
}

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

    if (isBlockStarterRow(row)) {
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

    if (meaning === 'note') {
      if (current) {
        current.noteRows.push(row.original_cells.filter(Boolean).join(' | ') || row.detection_notes);
      }
      continue;
    }

    if (meaning === 'stage-count' || (meaning === 'uncertain' && rowHasStageData(row))) {
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
      continue;
    }

    if (meaning === 'uncertain') {
      if (current) {
        current.noteRows.push(
          row.original_cells.filter(Boolean).join(' | ') || row.detection_notes || interpretedRowText(row)
        );
      }
      continue;
    }
  }

  flush();
  return coalesceHeaderOnlyBlocks(interpreted, blocks);
}

/** Merge header-only blocks with following stage/note rows that lost their parent due to mis-split. */
function coalesceHeaderOnlyBlocks(interpreted: InterpretedRow[], blocks: ImportRowBlock[]): ImportRowBlock[] {
  if (blocks.length <= 1) return blocks;

  const merged: ImportRowBlock[] = [];

  for (let i = 0; i < blocks.length; i++) {
    let block = blocks[i];

    while (i + 1 < blocks.length) {
      const rows = rowsForBlock(interpreted, block);
      const headerRow = rows.find((row) => row.user_meaning === 'group-header');
      const species = headerRow ? inferSpeciesFromHeaderCells(headerRow.original_cells) : '';
      const hasStageCounts = rows.some(
        (row) => row.user_meaning === 'stage-count' && Boolean(row.user_fields.count)
      );

      if (!headerRow || !species || !isValidLineName(species) || hasStageCounts) break;

      const next = blocks[i + 1];
      const nextRows = rowsForBlock(interpreted, next);
      const nextRealHeader = nextRows.find(
        (row) =>
          row.user_meaning === 'group-header' &&
          isValidLineName(inferSpeciesFromHeaderCells(row.original_cells))
      );

      if (nextRealHeader) break;

      block = {
        ...block,
        rowIndices: [...block.rowIndices, ...next.rowIndices],
        endRow: next.endRow,
        noteRows: [...block.noteRows, ...next.noteRows],
      };
      i += 1;
    }

    merged.push(block);
  }

  return merged;
}

export function rowsForBlock(interpreted: InterpretedRow[], block: ImportRowBlock): InterpretedRow[] {
  return block.rowIndices.map((index) => interpreted[index]).filter(Boolean);
}
