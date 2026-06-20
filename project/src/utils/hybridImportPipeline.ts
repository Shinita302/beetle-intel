import type {
  ConfidenceLevel,
  EditableImportGroup,
  HybridImportResult,
  ImportGroupAuditEntry,
  ImportRowBlock,
} from '@/types/hybridImport';
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
  inferSpeciesFromHeaderCells,
  looksLikePopulationGroupHeader,
} from './importPopulationHeaderDetection';
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

  const headerMentionsAdult = /adult/i.test(`${group.species} ${group.notes} ${group.category}`);
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
  blockId: string,
  warnings: string[],
  parseSource: EditableImportGroup['parseSource'] = 'deterministic'
): EditableImportGroup {
  const notes = block.noteRows.filter(Boolean).join('; ');
  const group: EditableImportGroup = {
    id: blockId,
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

function auditFromPreview(
  preview: PopulationGroupPreview,
  status: ImportGroupAuditEntry['status'],
  reason: string,
  sourceRow: number
): ImportGroupAuditEntry {
  return {
    species: preview.species,
    lineName: preview.lineName,
    eggs: preview.eggs,
    l1: preview.l1,
    l2: preview.l2,
    l3: preview.l3,
    prePupa: preview.prePupa,
    pupa: preview.pupa,
    adult: preview.adult,
    total: preview.total,
    status,
    reason,
    sourceRow,
    sourceSheet: preview.sourceSheet,
  };
}

function auditFromBlockFailure(
  block: ImportRowBlock,
  blockRows: ReturnType<typeof rowsForBlock>,
  reason: string
): ImportGroupAuditEntry {
  const headerRow = blockRows.find((row) => row.user_meaning === 'group-header') ?? blockRows[0];
  const species =
    inferSpeciesFromHeaderCells(headerRow?.original_cells ?? []) ||
    headerRow?.user_fields.species_or_group ||
    'Unknown';

  return {
    species,
    lineName: species,
    eggs: 0,
    l1: 0,
    l2: 0,
    l3: 0,
    prePupa: 0,
    pupa: 0,
    adult: 0,
    total: 0,
    status: 'skipped',
    reason,
    sourceRow: block.startRow,
    sourceSheet: block.sourceSheet,
  };
}

function parseBlockDeterministic(
  blockRows: ReturnType<typeof rowsForBlock>,
  block: ImportRowBlock,
  fileName: string
): { groups: EditableImportGroup[]; warnings: string[] } {
  if (blockRows.length === 0) {
    return { groups: [], warnings: ['Block has no rows'] };
  }

  const result = generateRecordsFromConfirmed({
    interpreted: blockRows,
    existingBeetles: [],
    existingGrowthEntries: [],
    sourceFileName: fileName,
    sheetNames: block.sourceSheet ? [block.sourceSheet] : [],
  });

  if (result.populationGroups.length === 0) {
    return { groups: [], warnings: result.validationWarnings };
  }

  const groups = result.populationGroups.map((preview, index) =>
    previewToEditableGroup(
      preview,
      block,
      result.populationGroups.length > 1 ? `${block.id}-${index}` : block.id,
      result.validationWarnings,
      'deterministic'
    )
  );

  return { groups, warnings: result.validationWarnings };
}

function buildDetectedHeaderAudit(
  interpreted: ReturnType<typeof interpretRawRows>,
  groupAudit: ImportGroupAuditEntry[]
): ImportGroupAuditEntry[] {
  const rejected: ImportGroupAuditEntry[] = [];
  const auditedRows = new Set(groupAudit.map((entry) => `${entry.sourceSheet ?? ''}:${entry.sourceRow}`));

  for (const row of interpreted) {
    if (!looksLikePopulationGroupHeader(row.original_cells, row.raw_text)) continue;

    const rowKey = `${row.source_sheet ?? ''}:${row.source_row}`;
    if (auditedRows.has(rowKey)) continue;

    const species = inferSpeciesFromHeaderCells(row.original_cells) || row.user_fields.species_or_group;

    rejected.push({
      species,
      lineName: species,
      eggs: 0,
      l1: 0,
      l2: 0,
      l3: 0,
      prePupa: 0,
      pupa: 0,
      adult: 0,
      total: 0,
      status: 'rejected',
      reason:
        row.user_meaning === 'group-header'
          ? 'Population header detected but produced no importable counts (check stage rows below header)'
          : `Row classified as "${row.user_meaning}" — not grouped into an importable block`,
      sourceRow: row.source_row,
      sourceSheet: row.source_sheet,
    });
  }

  return rejected;
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
  const groupAudit: ImportGroupAuditEntry[] = [];

  for (const block of blocks) {
    const blockRows = rowsForBlock(interpreted, block);
    const parsedBlock = parseBlockDeterministic(blockRows, block, fileName);

    if (parsedBlock.groups.length === 0) {
      const reason =
        parsedBlock.warnings.join('; ') ||
        'No valid population counts extracted from block (needs at least one Eggs/L1/L2/L3/Pre-pupa/Pupa/Adult count)';
      groupAudit.push(auditFromBlockFailure(block, blockRows, reason));
      continue;
    }

    for (const baseGroup of parsedBlock.groups) {
      let group = applyCorrectionRules(baseGroup, rules);
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
            id: baseGroup.id,
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

      const auditStatus: ImportGroupAuditEntry['status'] = group.total > 0 ? 'imported' : 'skipped';
      const auditReason =
        group.validationWarnings.length > 0
          ? group.validationWarnings.join('; ')
          : group.total > 0
            ? `Imported with ${group.total} total population (${group.parseSource} parser)`
            : 'No population counts extracted';

      groupAudit.push(
        auditFromPreview(
          {
            species: group.species,
            lineName: group.lineName,
            generation: group.generation,
            origin: group.origin,
            category: group.category,
            eggs: group.eggs,
            l1: group.l1,
            l2: group.l2,
            l3: group.l3,
            prePupa: group.prePupa,
            pupa: group.pupa,
            adult: group.adult,
            total: group.total,
            sourceSheet: group.sourceSheet,
          },
          auditStatus,
          auditReason,
          group.startRow
        )
      );

      groups.push(group);
    }
  }

  groupAudit.push(...buildDetectedHeaderAudit(interpreted, groupAudit));

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
    groupAudit,
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
