import type { ConfidenceLevel, EditableImportGroup, HybridImportResult, ImportRowBlock } from '@/types/hybridImport';
import type { SpeciesInventory } from '@/types';
import { emptySpeciesInventory, inventoryGroupId } from '@/types';
import { detectInventoryBlocks, rowsForBlock } from './importBlockDetection';
import { applyCorrectionRules, loadCorrectionRules } from './importCorrectionMemory';
import {
  computeGroupTotal,
  sanitizeImportGroupFields,
  validateImportGroup,
} from './importGroupValidation';
import {
  generateRecordsFromConfirmed,
  interpretRawRows,
  type ParsedSpreadsheet,
  type PopulationGroupPreview,
} from './importSpreadsheet';
import { parseBlockWithLlm, isLlmFallbackAvailable } from './importLlmFallback';

function confidenceFromScore(score: number): ConfidenceLevel {
  if (score >= 80) return 'high';
  if (score >= 50) return 'medium';
  return 'low';
}

function scoreBlockGroup(group: EditableImportGroup, block: ImportRowBlock): number {
  let score = 88;

  if (block.headerIndex < 0) score -= 28;
  if (group.validationWarnings.length > 0) score -= 18 * group.validationWarnings.length;
  if (!group.origin) score -= 4;
  if (!group.lineName) score -= 20;

  const headerMentionsAdult = block.rowIndices.some((index) => {
    const text = group.species + group.notes;
    return /adult/i.test(text);
  });
  if (headerMentionsAdult && group.adult === 0 && group.total > 0) {
    score -= 22;
  }

  if (group.total <= 0) score -= 40;
  if (group.parseSource === 'llm') score -= 5;

  return Math.max(0, Math.min(100, score));
}

function previewToEditableGroup(
  preview: PopulationGroupPreview,
  block: ImportRowBlock,
  warnings: string[],
  parseSource: EditableImportGroup['parseSource'] = 'deterministic'
): EditableImportGroup {
  const notes = block.noteRows.filter(Boolean).join('; ');
  const group: EditableImportGroup = {
    id: block.id,
    species: preview.species,
    lineName: preview.lineName,
    origin: preview.origin,
    generation: preview.generation,
    category: preview.category,
    eggs: preview.eggs,
    l1: preview.l1,
    l2: preview.l2,
    l3: preview.l3,
    prePupa: preview.prePupa,
    pupa: preview.pupa,
    adult: preview.adult,
    notes,
    total: preview.total,
    confidence: 'medium',
    confidenceScore: 70,
    validationWarnings: warnings,
    parseSource,
    sourceSheet: preview.sourceSheet ?? block.sourceSheet,
    startRow: block.startRow,
    endRow: block.endRow,
    included: true,
  };
  return sanitizeImportGroupFields(group);
}

function parseBlockDeterministic(
  blockRows: ReturnType<typeof rowsForBlock>,
  block: ImportRowBlock,
  fileName: string
): EditableImportGroup | null {
  if (blockRows.length === 0) return null;

  const result = generateRecordsFromConfirmed({
    interpreted: blockRows,
    existingBeetles: [],
    existingGrowthEntries: [],
    sourceFileName: fileName,
    sheetNames: block.sourceSheet ? [block.sourceSheet] : [],
  });

  if (result.populationGroups.length === 0) return null;

  const preview = result.populationGroups[0];
  return previewToEditableGroup(preview, block, result.validationWarnings, 'deterministic');
}

export async function runHybridImportPipeline(params: {
  parsed: ParsedSpreadsheet;
  fileName: string;
  userId?: string;
  useLlmFallback?: boolean;
}): Promise<HybridImportResult> {
  const { parsed, fileName, userId, useLlmFallback = true } = params;
  const interpreted = interpretRawRows(parsed);
  const blocks = detectInventoryBlocks(interpreted);
  const rules = userId ? loadCorrectionRules(userId) : [];

  const skippedNotes = interpreted
    .filter((row) => row.user_meaning === 'note')
    .map((row) => row.original_cells.filter(Boolean).join(' | ') || row.detection_notes);

  let usedLlmFallback = false;
  const groups: EditableImportGroup[] = [];

  for (const block of blocks) {
    const blockRows = rowsForBlock(interpreted, block);
    let group = parseBlockDeterministic(blockRows, block, fileName);
    if (!group) continue;

    group = applyCorrectionRules(group, rules);
    group = sanitizeImportGroupFields(group);
    group.validationWarnings = validateImportGroup(group);
    group.confidenceScore = scoreBlockGroup(group, block);
    group.confidence = confidenceFromScore(group.confidenceScore);

    const shouldTryLlm =
      useLlmFallback &&
      isLlmFallbackAvailable() &&
      (group.confidence === 'low' || group.validationWarnings.length > 0);

    if (shouldTryLlm) {
      const llmGroup = await parseBlockWithLlm(blockRows, block);
      if (llmGroup) {
        group = sanitizeImportGroupFields({
          ...llmGroup,
          id: block.id,
          sourceSheet: block.sourceSheet,
          startRow: block.startRow,
          endRow: block.endRow,
          included: true,
          parseSource: 'llm',
        });
        group.validationWarnings = validateImportGroup(group);
        group.confidenceScore = Math.max(group.confidenceScore, scoreBlockGroup(group, block));
        group.confidence = confidenceFromScore(group.confidenceScore);
        usedLlmFallback = true;
      }
    }

    groups.push(group);
  }

  const beetleResult = generateRecordsFromConfirmed({
    interpreted: interpreted.filter((row) => row.user_meaning === 'individual-beetle'),
    existingBeetles: [],
    existingGrowthEntries: [],
    growthSheets: parsed.growthSheets,
    sourceFileName: fileName,
    sheetNames: parsed.sheetNames,
  });

  const inventorySheetNames = new Set(
    interpreted.map((r) => r.source_sheet).filter(Boolean) as string[]
  );
  const growthSheetNames = new Set(parsed.growthSheets.map((s) => s.name));
  const sheetsProcessed = parsed.sheetNames.filter(
    (n) => inventorySheetNames.has(n) || growthSheetNames.has(n)
  );
  const sheetsSkipped = parsed.sheetNames.filter((n) => !sheetsProcessed.includes(n));

  return {
    groups,
    blocks,
    skippedNotes,
    sheetsProcessed,
    sheetsSkipped,
    growthSheetsImported: parsed.growthSheets.map((s) => s.name),
    individualBeetleCount: beetleResult.beetles.length,
    growthEntryCount: beetleResult.growthEntries.length,
    usedLlmFallback,
    interpreted,
  };
}

export function editableGroupsToSpeciesInventory(
  groups: EditableImportGroup[],
  sourceFile: string
): SpeciesInventory[] {
  const now = new Date().toISOString();
  return groups
    .filter((group) => group.included)
    .map((group) => {
      const sanitized = sanitizeImportGroupFields(group);
      const row = emptySpeciesInventory(
        sanitized.lineName || sanitized.species,
        inventoryGroupId(sanitized.species, sanitized.lineName, sanitized.generation)
      );
      row.lineName = sanitized.lineName;
      row.generation = sanitized.generation;
      row.origin = sanitized.origin;
      row.notes = [sanitized.notes, sanitized.category ? `Category: ${sanitized.category}` : '']
        .filter(Boolean)
        .join('; ');
      row.sourceFile = sourceFile;
      row.sourceSheet = sanitized.sourceSheet;
      row.importedAt = now;
      row.eggs = sanitized.eggs;
      row.l1 = sanitized.l1;
      row.l2 = sanitized.l2;
      row.l3 = sanitized.l3;
      row.prePupa = sanitized.prePupa;
      row.pupa = sanitized.pupa;
      row.adult = sanitized.adult;
      row.updatedAt = now.slice(0, 10);
      return row;
    });
}

export function recalculateGroupTotal(group: EditableImportGroup): EditableImportGroup {
  const next = sanitizeImportGroupFields({ ...group, total: computeGroupTotal(group) });
  next.validationWarnings = validateImportGroup(next);
  if (next.validationWarnings.length === 0 && next.total > 0) {
    next.confidenceScore = Math.max(next.confidenceScore, 82);
  }
  next.confidence =
    next.confidenceScore >= 80 ? 'high' : next.confidenceScore >= 50 ? 'medium' : 'low';
  return next;
}
