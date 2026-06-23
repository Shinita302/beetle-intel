import type {
  ConfidenceLevel,
  EditableImportGroup,
  HybridImportResult,
  ImportGroupAuditEntry,
  ImportRowBlock,
} from '@/types/hybridImport';
import type { SpeciesInventory } from '@/types';
import { emptySpeciesInventory, inventoryGroupId } from '@/types';
import { applyCorrectionRules, loadCorrectionRules } from './importCorrectionMemory';
import {
  computeGroupTotal,
  sanitizeImportGroupFields,
  validateImportGroup,
} from './importGroupValidation';
import { inventoryCountTotal } from './importFieldParsing';
import {
  blockDraftNotes,
  parsePopulationBlocks,
  populationBlockToImportRowBlock,
  type PopulationBlockDraft,
} from './importPopulationBlockParser';
import {
  generateRecordsFromConfirmed,
  interpretRawRows,
  normalizeRawSheetRow,
  type ParsedSpreadsheet,
} from './importSpreadsheet';
import { parseBlockWithLlm, isLlmFallbackAvailable } from './importLlmFallback';
import { rowsForBlock } from './importBlockDetection';

function confidenceFromScore(score: number): ConfidenceLevel {
  if (score >= 80) return 'high';
  if (score >= 50) return 'medium';
  return 'low';
}

function scoreBlockGroup(group: EditableImportGroup): number {
  let score = 90;
  if (group.validationWarnings.length > 0) score -= 18 * group.validationWarnings.length;
  if (!group.origin) score -= 4;
  if (!group.lineName) score -= 25;
  if (group.total <= 0) score -= 40;
  if (group.parseSource === 'llm') score -= 5;
  return Math.max(0, Math.min(100, score));
}

function blockDraftToEditableGroup(
  draft: PopulationBlockDraft,
  block: ImportRowBlock,
  parseSource: EditableImportGroup['parseSource'] = 'deterministic'
): EditableImportGroup {
  const total = inventoryCountTotal(draft);
  const group: EditableImportGroup = {
    id: block.id,
    species: draft.species,
    lineName: draft.lineName,
    origin: draft.origin,
    generation: draft.generation,
    category: draft.category,
    eggs: draft.eggs,
    l1: draft.l1,
    l2: draft.l2,
    l3: draft.l3,
    prePupa: draft.prePupa,
    pupa: draft.pupa,
    adult: draft.adult,
    notes: blockDraftNotes(draft),
    total,
    confidence: 'high',
    confidenceScore: 90,
    validationWarnings: [...draft.parseWarnings],
    parseSource,
    sourceSheet: draft.sourceSheet,
    startRow: draft.startRow,
    endRow: draft.endRow,
    included: true,
  };
  return sanitizeImportGroupFields(group);
}

function auditFromDraft(
  draft: PopulationBlockDraft,
  status: ImportGroupAuditEntry['status'],
  reason: string
): ImportGroupAuditEntry {
  const total = inventoryCountTotal(draft);
  return {
    species: draft.species,
    lineName: draft.lineName,
    eggs: draft.eggs,
    l1: draft.l1,
    l2: draft.l2,
    l3: draft.l3,
    prePupa: draft.prePupa,
    pupa: draft.pupa,
    adult: draft.adult,
    total,
    status,
    reason,
    sourceRow: draft.headerRow,
    sourceSheet: draft.sourceSheet,
  };
}

export async function runHybridImportPipeline(params: {
  parsed: ParsedSpreadsheet;
  fileName: string;
  userId?: string;
  useLlmFallback?: boolean;
}): Promise<HybridImportResult> {
  const { parsed, fileName, userId, useLlmFallback = true } = params;
  const normalizedParsed: ParsedSpreadsheet = {
    ...parsed,
    allRows: parsed.allRows.map(normalizeRawSheetRow),
    rows: parsed.rows.map(normalizeRawSheetRow),
    growthSheets: parsed.growthSheets.map((sheet) => ({
      ...sheet,
      rows: sheet.rows.map(normalizeRawSheetRow),
    })),
  };
  const blockParse = parsePopulationBlocks(normalizedParsed.allRows);
  const interpreted = interpretRawRows(normalizedParsed);
  const rules = userId ? loadCorrectionRules(userId) : [];

  let usedLlmFallback = false;
  const groups: EditableImportGroup[] = [];
  const groupAudit: ImportGroupAuditEntry[] = [];
  const blocks: ImportRowBlock[] = blockParse.blocks.map(populationBlockToImportRowBlock);

  for (let i = 0; i < blockParse.blocks.length; i++) {
    const draft = blockParse.blocks[i];
    const block = blocks[i];
    let group = blockDraftToEditableGroup(draft, block);
    group = applyCorrectionRules(group, rules);
    group = sanitizeImportGroupFields(group);
    group.validationWarnings = validateImportGroup(group);
    group.confidenceScore = scoreBlockGroup(group);
    group.confidence = confidenceFromScore(group.confidenceScore);

    const shouldTryLlm =
      useLlmFallback &&
      isLlmFallbackAvailable() &&
      (group.confidence === 'low' || group.validationWarnings.length > 0);

    if (shouldTryLlm) {
      const blockRows = rowsForBlock(interpreted, block);
      const llmGroup = await parseBlockWithLlm(blockRows, block);
      if (llmGroup) {
        group = sanitizeImportGroupFields({
          ...llmGroup,
          id: block.id,
          species: draft.species,
          lineName: draft.lineName,
          sourceSheet: draft.sourceSheet,
          startRow: draft.startRow,
          endRow: draft.endRow,
          notes: blockDraftNotes(draft),
          included: true,
          parseSource: 'llm',
        });
        group.validationWarnings = validateImportGroup(group);
        group.confidenceScore = Math.max(group.confidenceScore, scoreBlockGroup(group));
        group.confidence = confidenceFromScore(group.confidenceScore);
        usedLlmFallback = true;
      }
    }

    const auditReason =
      group.validationWarnings.length > 0
        ? group.validationWarnings.join('; ')
        : `Imported ${group.total} population from block (rows ${draft.startRow}-${draft.endRow})`;

    groupAudit.push(auditFromDraft(draft, group.total > 0 ? 'imported' : 'skipped', auditReason));
    groups.push(group);
  }

  for (const rejected of blockParse.rejectedBlocks) {
    groupAudit.push({
      species: rejected.species,
      lineName: rejected.species,
      eggs: 0,
      l1: 0,
      l2: 0,
      l3: 0,
      prePupa: 0,
      pupa: 0,
      adult: 0,
      total: 0,
      status: 'rejected',
      reason: rejected.reason,
      sourceRow: rejected.sourceRow,
      sourceSheet: rejected.sourceSheet,
    });
  }

  const beetleResult = generateRecordsFromConfirmed({
    interpreted: interpreted.filter((row) => row.user_meaning === 'individual-beetle'),
    existingBeetles: [],
    existingGrowthEntries: [],
    growthSheets: normalizedParsed.growthSheets,
    sourceFileName: fileName,
    sheetNames: parsed.sheetNames,
  });

  const inventorySheetNames = new Set(
    normalizedParsed.allRows.map((r) => r.source_sheet).filter(Boolean) as string[]
  );
  const growthSheetNames = new Set(normalizedParsed.growthSheets.map((s) => s.name));
  const sheetsProcessed = normalizedParsed.sheetNames.filter(
    (n) => inventorySheetNames.has(n) || growthSheetNames.has(n)
  );
  const sheetsSkipped = normalizedParsed.sheetNames.filter((n) => !sheetsProcessed.includes(n));

  return {
    groups,
    blocks,
    skippedNotes: blockParse.skippedNotes,
    groupAudit,
    sheetsProcessed,
    sheetsSkipped,
    growthSheetsImported: normalizedParsed.growthSheets.map((s) => s.name),
    growthAudit: beetleResult.growthAudit,
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
