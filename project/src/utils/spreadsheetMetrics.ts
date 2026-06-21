import type { SpeciesInventoryStageKey } from '../types';
import type { LifecycleStage } from '../types/lifecycle';

export type StageValueKind = 'count' | 'weight' | 'size' | 'unknown';

export type ParseConfidence = 'high' | 'medium' | 'low';

export interface StageRowMetrics {
  count: number | null;
  weightGrams: number | null;
  sizeMm: number | null;
  warnings: string[];
}

export interface LarvalGrowthStageEntry {
  stage: LifecycleStage;
  date: string | null;
  weightGrams: number | null;
  sizeMm: number | null;
  notes: string;
}

export interface SpreadsheetGroupParseResult {
  species: string;
  inventoryCounts: Partial<Record<'egg' | 'L1' | 'L2' | 'L3' | 'pupa' | 'adult', number>>;
  larvalGrowthTrack: LarvalGrowthStageEntry[] | null;
  confidence: ParseConfidence;
  warnings: string[];
}

const WEIGHT_UNIT_RE = /\b(\d+(?:\.\d+)?)\s*(g|gram|grams|kg)\b/i;
const SIZE_MM_RE = /\b(\d+(?:\.\d+)?)\s*mm\b/i;
const SIZE_CM_RE = /\b(\d+(?:\.\d+)?)\s*cm\b/i;
const PLAIN_NUMBER_RE = /^(\d+(?:\.\d+)?)$/;

export const COUNT_VS_GROWTH_WARNING =
  'These numbers look like counts, not growth measurements. Please confirm.';

export const PLAIN_NUMBERS_AS_COUNTS_WARNING =
  'Plain numbers without units were classified as counts, not weights.';

export function cellHasWeightUnit(text: string): boolean {
  return WEIGHT_UNIT_RE.test(text.trim());
}

export function cellHasSizeUnit(text: string): boolean {
  const t = text.trim();
  return SIZE_MM_RE.test(t) || SIZE_CM_RE.test(t);
}

export function isPlainNumberToken(text: string): boolean {
  return PLAIN_NUMBER_RE.test(text.trim());
}

/** Classify a spreadsheet cell or token (e.g. "106", "8g", "12 mm"). */
export function classifySpreadsheetValue(text: string): StageValueKind {
  const trimmed = text.trim();
  if (!trimmed) return 'unknown';
  if (cellHasWeightUnit(trimmed)) return 'weight';
  if (cellHasSizeUnit(trimmed)) return 'size';
  if (isPlainNumberToken(trimmed)) return 'count';
  if (/^\d+(?:\.\d+)?$/.test(trimmed)) return 'count';
  return 'unknown';
}

function parseWeightFromText(text: string): number | null {
  const match = text.trim().match(WEIGHT_UNIT_RE);
  if (!match?.[1]) return null;
  const value = Number.parseFloat(match[1]);
  if (Number.isNaN(value)) return null;
  const unit = match[2].toLowerCase();
  if (unit === 'kg') return value * 1000;
  return value;
}

function parseSizeFromText(text: string): number | null {
  const mm = text.trim().match(SIZE_MM_RE);
  if (mm?.[1]) {
    const value = Number.parseFloat(mm[1]);
    return Number.isNaN(value) ? null : value;
  }
  const cm = text.trim().match(SIZE_CM_RE);
  if (cm?.[1]) {
    const value = Number.parseFloat(cm[1]);
    return Number.isNaN(value) ? null : Math.round(value * 10 * 10) / 10;
  }
  return null;
}

function parsePlainCount(text: string): number | null {
  const match = text.trim().match(PLAIN_NUMBER_RE);
  if (!match?.[1]) return null;
  const value = Number.parseFloat(match[1]);
  return Number.isNaN(value) ? null : Math.round(value);
}

/**
 * Parse numbers attached to a stage row (e.g. "L1 106", "L2 24g", "L3 52g 12mm").
 * Plain numbers → inventory count. Values with g/kg/mm/cm → growth measurements.
 */
export function parseStageRowMetrics(stageLabel: string, valueTokens: string[]): StageRowMetrics {
  const warnings: string[] = [];
  let count: number | null = null;
  let weightGrams: number | null = null;
  let sizeMm: number | null = null;
  let sawPlainCount = false;

  for (const token of valueTokens) {
    const trimmed = token.trim();
    if (!trimmed) continue;

    const kind = classifySpreadsheetValue(trimmed);
    if (kind === 'weight') {
      const w = parseWeightFromText(trimmed);
      if (w != null) weightGrams = w;
    } else if (kind === 'size') {
      const s = parseSizeFromText(trimmed);
      if (s != null) sizeMm = s;
    } else if (kind === 'count') {
      const c = parsePlainCount(trimmed);
      if (c != null) {
        count = count == null ? c : count;
        sawPlainCount = true;
      }
    }
  }

  if (sawPlainCount && weightGrams == null && sizeMm == null) {
    warnings.push(PLAIN_NUMBERS_AS_COUNTS_WARNING);
  } else if (sawPlainCount && (weightGrams != null || sizeMm != null)) {
    warnings.push(`Mixed count and measurements on ${stageLabel || 'stage'} row.`);
  }

  return { count, weightGrams, sizeMm, warnings };
}

/** Combined cell like "L1 106" or "L1 8g". */
export function parseStageCombinedCell(cell: string): {
  stagePart: string;
  valuePart: string;
  unit: string;
} | null {
  const match = cell.trim().match(/^(.+?)\s+(\d+(?:\.\d+)?)\s*(g|gram|grams|kg|mm|cm)?$/i);
  if (!match) return null;
  return {
    stagePart: match[1].trim(),
    valuePart: match[2],
    unit: (match[3] ?? '').toLowerCase(),
  };
}

export function metricsFromCombinedCell(cell: string): StageRowMetrics {
  const parsed = parseStageCombinedCell(cell);
  if (!parsed) {
    return { count: null, weightGrams: null, sizeMm: null, warnings: [] };
  }
  const token =
    parsed.unit === 'g' || parsed.unit === 'gram' || parsed.unit === 'grams' || parsed.unit === 'kg'
      ? `${parsed.valuePart}${parsed.unit}`
      : parsed.unit === 'mm' || parsed.unit === 'cm'
        ? `${parsed.valuePart}${parsed.unit}`
        : parsed.valuePart;
  return parseStageRowMetrics(parsed.stagePart, [token]);
}

export function hasGrowthMeasurements(metrics: StageRowMetrics): boolean {
  return metrics.weightGrams != null || metrics.sizeMm != null;
}

export function buildLarvalGrowthEntries(
  entries: { stage: LifecycleStage; metrics: StageRowMetrics; date?: string | null; notes?: string }[]
): LarvalGrowthStageEntry[] | null {
  const growth = entries
    .filter((e) => hasGrowthMeasurements(e.metrics))
    .map((e) => ({
      stage: e.stage,
      date: e.date ?? null,
      weightGrams: e.metrics.weightGrams,
      sizeMm: e.metrics.sizeMm,
      notes: e.notes ?? '',
    }));
  return growth.length > 0 ? growth : null;
}

/** Preview shape for import validation / tests (Hercules L1 106 … sample). */
export function parseSpreadsheetGroupBlock(
  species: string,
  stageRows: { stageLabel: string; cell: string }[]
): SpreadsheetGroupParseResult {
  const inventoryCounts: SpreadsheetGroupParseResult['inventoryCounts'] = {};
  const growthEntries: { stage: LifecycleStage; metrics: StageRowMetrics }[] = [];
  const warnings: string[] = [];
  let sawPlainOnly = false;
  let sawGrowth = false;

  for (const { cell } of stageRows) {
    const combined = parseStageCombinedCell(cell);
    const metrics = metricsFromCombinedCell(cell);
    const stage = stageLabelToLifecycle(combined?.stagePart ?? cell.split(/\s+/)[0] ?? '');
    if (!stage) continue;

    warnings.push(...metrics.warnings);

    if (metrics.count != null) {
      inventoryCounts[stage] = metrics.count;
      if (!cellHasWeightUnit(cell) && !cellHasSizeUnit(cell)) {
        sawPlainOnly = true;
      }
    }
    if (hasGrowthMeasurements(metrics)) {
      sawGrowth = true;
      growthEntries.push({ stage, metrics });
    }
  }

  if (sawPlainOnly && !sawGrowth) {
    warnings.push(PLAIN_NUMBERS_AS_COUNTS_WARNING);
  }

  return {
    species,
    inventoryCounts,
    larvalGrowthTrack: buildLarvalGrowthEntries(growthEntries),
    confidence: sawPlainOnly && !sawGrowth ? 'high' : sawPlainOnly && sawGrowth ? 'medium' : 'high',
    warnings: [...new Set(warnings)],
  };
}

export function formatSpreadsheetGroupJson(result: SpreadsheetGroupParseResult): {
  species: string;
  inventory_counts: Partial<Record<'egg' | 'L1' | 'L2' | 'L3' | 'pupa' | 'adult', number>>;
  larval_growth_track: LarvalGrowthStageEntry[] | null;
  confidence: ParseConfidence;
  warning: string | null;
} {
  const warning =
    result.warnings.find((w) => w.includes('Plain numbers')) ??
    result.warnings[0] ??
    null;
  return {
    species: result.species,
    inventory_counts: result.inventoryCounts,
    larval_growth_track: result.larvalGrowthTrack,
    confidence: result.confidence,
    warning,
  };
}

function stageLabelToLifecycle(label: string): 'egg' | 'L1' | 'L2' | 'L3' | 'pupa' | 'adult' | null {
  return parseStageLabelToLifecycle(label);
}

/** Map spreadsheet stage labels to lifecycle stages (supports adult(F4), pre-pupa, etc.). */
export function parseStageLabelToLifecycle(
  label: string
): 'egg' | 'L1' | 'L2' | 'L3' | 'pupa' | 'adult' | null {
  const t = String(label ?? '').trim().toLowerCase();
  if (t === 'l1' || t === 'l 1' || t === 'larva 1' || t === 'instar 1') return 'L1';
  if (t === 'l2' || t === 'l 2' || t === 'larva 2' || t === 'instar 2') return 'L2';
  if (t === 'l3' || t === 'l 3' || t === 'larva 3' || t === 'instar 3' || t === 'larva' || t === 'larvae')
    return 'L3';
  if (t === 'egg' || t === 'eggs') return 'egg';
  if (t === 'pupa' || t === 'pupae') return 'pupa';
  if (t === 'pre-pupa' || t === 'pre pupa' || t === 'prepupa') return 'pupa';
  if (/^adults?$/.test(t)) return 'adult';
  if (/^adult\s*\(\s*(?:cb)?f\d+\+?\s*\)$/.test(t)) return 'adult';
  if (/^adult\s+(?:cb)?f\d+\+?$/.test(t)) return 'adult';
  return null;
}

/** Extract generation from labels like adult(F4) or adult(F4+). */
export function parseGenerationFromStageLabel(label: string): string {
  const match = String(label ?? '').trim().match(/(?:\(\s*(?:CB)?(F\d+\+?)\s*\)|\b(CB)?(F\d+\+?)\b)/i);
  if (!match) return '';
  const gen = (match[1] || match[3] || '').toUpperCase();
  const cb = match[2] ? 'CB' : '';
  return cb && gen ? `${cb}${gen}` : gen;
}

export function inventoryKeyForLifecycle(
  stage: LifecycleStage
): SpeciesInventoryStageKey | null {
  if (stage === 'egg') return 'eggs';
  if (stage === 'L1') return 'l1';
  if (stage === 'L2') return 'l2';
  if (stage === 'L3') return 'l3';
  if (stage === 'pupa') return 'pupa';
  if (stage === 'adult') return 'adult';
  return null;
}
