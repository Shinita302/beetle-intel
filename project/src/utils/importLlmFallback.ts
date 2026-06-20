import type { EditableImportGroup, ImportRowBlock } from '@/types/hybridImport';
import type { InterpretedRow } from './importSpreadsheet';
import {
  parseGenerationFromCells,
  parseOriginFromCells,
  parseStrictGeneration,
  parseStrictOrigin,
} from './importFieldParsing';

export interface LlmBlockParseResult {
  species: string;
  line_name: string;
  origin: string;
  generation: string;
  egg_count: number;
  l1_count: number;
  l2_count: number;
  l3_count: number;
  pre_pupa_count: number;
  pupa_count: number;
  adult_count: number;
  notes: string;
}

export function isLlmFallbackAvailable(): boolean {
  return typeof window !== 'undefined';
}

function blockToPromptRows(rows: InterpretedRow[]): string[][] {
  return rows.map((row) => row.original_cells);
}

function mapLlmResult(result: LlmBlockParseResult, block: ImportRowBlock): EditableImportGroup {
  const eggs = Number(result.egg_count) || 0;
  const l1 = Number(result.l1_count) || 0;
  const l2 = Number(result.l2_count) || 0;
  const l3 = Number(result.l3_count) || 0;
  const prePupa = Number(result.pre_pupa_count) || 0;
  const pupa = Number(result.pupa_count) || 0;
  const adult = Number(result.adult_count) || 0;
  const total = eggs + l1 + l2 + l3 + prePupa + pupa + adult;

  return {
    id: block.id,
    species: result.species || result.line_name,
    lineName: result.line_name || result.species,
    origin: parseStrictOrigin(result.origin),
    generation: parseStrictGeneration(result.generation),
    category: 'headcount',
    eggs,
    l1,
    l2,
    l3,
    prePupa,
    pupa,
    adult,
    notes: result.notes || block.noteRows.join('; '),
    total,
    confidence: 'medium',
    confidenceScore: 65,
    validationWarnings: [],
    parseSource: 'llm',
    sourceSheet: block.sourceSheet,
    startRow: block.startRow,
    endRow: block.endRow,
    included: true,
  };
}

/** Optional LLM fallback — uses /api/import/parse-block when OPENAI_API_KEY is configured. */
export async function parseBlockWithLlm(
  rows: InterpretedRow[],
  block: ImportRowBlock
): Promise<EditableImportGroup | null> {
  try {
    const response = await fetch('/api/import/parse-block', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows: blockToPromptRows(rows), notes: block.noteRows }),
    });

    if (response.status === 503) return null;
    if (!response.ok) return null;

    const data = (await response.json()) as LlmBlockParseResult;
    return mapLlmResult(data, block);
  } catch {
    return null;
  }
}

/** Deterministic-only rescue when LLM unavailable: re-parse cells directly. */
export function parseBlockCellsFallback(rows: InterpretedRow[]): Partial<EditableImportGroup> | null {
  const matrix = rows.map((row) => row.original_cells);
  const flat = matrix.flat().map((cell) => cell.trim()).filter(Boolean);
  if (flat.length === 0) return null;

  const lineName = flat.find((cell) => cell.includes('.') || /^[A-Z]/i.test(cell)) ?? '';
  return {
    lineName,
    species: lineName,
    origin: parseOriginFromCells(matrix[0] ?? []),
    generation: parseGenerationFromCells(flat),
  };
}
