import type { LifecycleStage, ParsedNoteMetrics } from '../types/lifecycle';
import { LIFECYCLE_LABELS, LIFECYCLE_ORDER } from '../types/lifecycle';

const STAGE_KEYWORD_PATTERNS: { stage: LifecycleStage; patterns: RegExp[] }[] = [
  { stage: 'egg', patterns: [/\beggs?\b/i, /\boviposit/i, /\blaid\b/i] },
  {
    stage: 'L1',
    patterns: [/\bl\s*1\b/i, /\bl1\b/i, /\blarva\s*1\b/i, /\binstar\s*1\b/i, /\b1st\s+instar\b/i],
  },
  {
    stage: 'L2',
    patterns: [/\bl\s*2\b/i, /\bl2\b/i, /\blarva\s*2\b/i, /\binstar\s*2\b/i, /\b2nd\s+instar\b/i],
  },
  {
    stage: 'L3',
    patterns: [/\bl\s*3\b/i, /\bl3\b/i, /\blarva\s*3\b/i, /\binstar\s*3\b/i, /\b3rd\s+instar\b/i],
  },
  { stage: 'pupa', patterns: [/\bpupa(e)?\b/i, /\bpre[\s-]?pupa\b/i, /\bcocoon\b/i] },
  { stage: 'adult', patterns: [/\badults?\b/i, /\bemerg(ed|ence)?\b/i, /\beclosed\b/i] },
];

const WEIGHT_PATTERN = /(\d+(?:\.\d+)?)\s*(g|gram|grams|kg)\b/gi;
const SIZE_MM_PATTERN = /(\d+(?:\.\d+)?)\s*mm\b/gi;
const SIZE_CM_PATTERN = /(\d+(?:\.\d+)?)\s*cm\b/gi;
const COUNT_PATTERN = /(?:count|pcs?|pieces?|heads?)[:\s]*(\d+)/i;
const BARE_COUNT_PATTERN = /^(\d+)\s*(?:larvae|larva|pcs?|pieces?)?$/i;

const MONTH_NAMES =
  /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b/i;

function firstMatchNumber(text: string, pattern: RegExp, transform?: (n: number) => number): number | null {
  const flags = pattern.flags.includes('g') ? pattern : new RegExp(pattern.source, pattern.flags + 'g');
  const match = flags.exec(text);
  if (!match?.[1]) return null;
  const value = Number.parseFloat(match[1]);
  if (Number.isNaN(value)) return null;
  return transform ? transform(value) : value;
}

function allWeightMatches(text: string): number[] {
  const values: number[] = [];
  const pattern = new RegExp(WEIGHT_PATTERN.source, 'gi');
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    let value = Number.parseFloat(match[1]);
    if (Number.isNaN(value)) continue;
    const unit = (match[2] ?? 'g').toLowerCase();
    if (unit === 'kg') value *= 1000;
    values.push(value);
  }
  return values;
}

export function parseWeightGrams(text: string): number | null {
  const weights = allWeightMatches(text);
  return weights.length > 0 ? weights[weights.length - 1] : null;
}

export function parseSizeMm(text: string): number | null {
  const mm = firstMatchNumber(text, SIZE_MM_PATTERN);
  if (mm != null) return mm;
  const cm = firstMatchNumber(text, SIZE_CM_PATTERN);
  if (cm != null) return Math.round(cm * 10 * 10) / 10;
  return null;
}

export function parseCount(text: string): number | null {
  const labeled = firstMatchNumber(text, COUNT_PATTERN);
  if (labeled != null) return labeled;
  const bare = text.trim().match(BARE_COUNT_PATTERN);
  if (bare?.[1]) return Number.parseInt(bare[1], 10);
  return null;
}

export function parseDateFromText(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const iso = trimmed.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (iso) return iso[0];

  const slash = trimmed.match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\b/);
  if (slash) {
    let year = Number.parseInt(slash[3], 10);
    if (year < 100) year += 2000;
    const month = slash[1].padStart(2, '0');
    const day = slash[2].padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  if (MONTH_NAMES.test(trimmed)) {
    const withYear = trimmed.match(
      new RegExp(`${MONTH_NAMES.source}\\s+\\d{1,2}(?:,?\\s+(\\d{4}))?`, 'i')
    );
    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      if (!withYear?.[1] && parsed.getFullYear() < 1990) {
        parsed.setFullYear(new Date().getFullYear());
      }
      return parsed.toISOString().slice(0, 10);
    }
  }

  const generic = new Date(trimmed);
  if (!Number.isNaN(generic.getTime()) && trimmed.length >= 6) {
    return generic.toISOString().slice(0, 10);
  }

  return null;
}

export function detectStageKeyword(text: string): LifecycleStage | null {
  const lower = text.toLowerCase();
  for (const { stage, patterns } of STAGE_KEYWORD_PATTERNS) {
    if (patterns.some((pattern) => pattern.test(lower))) {
      return stage;
    }
  }
  return null;
}

export function inferSpeciesFromNote(text: string, fallbackSpecies: string): string | null {
  const binomial = text.match(/\b([A-Z][a-z]+(?:\s+[a-z]+)+)\b/);
  if (binomial?.[1] && !detectStageKeyword(binomial[1])) {
    return binomial[1];
  }
  const firstLine = text.split(/[\n|]/)[0]?.trim();
  if (
    firstLine &&
    firstLine.length >= 2 &&
    firstLine.length <= 40 &&
    !detectStageKeyword(firstLine) &&
    !/^\d/.test(firstLine) &&
    !/\d\s*g\b/i.test(firstLine)
  ) {
    return firstLine;
  }
  return fallbackSpecies || null;
}

function stageIndex(stage: LifecycleStage): number {
  return LIFECYCLE_ORDER.indexOf(stage);
}

/** Rough weight-based guess when stage is not explicit (conservative). */
export function inferStageFromWeight(
  weightGrams: number,
  knownWeights: Partial<Record<LifecycleStage, number>>
): { stage: LifecycleStage | null; confidence: number; label: string | null } {
  const l1 = knownWeights.L1 ?? 0;
  const l2 = knownWeights.L2 ?? 0;
  const l3 = knownWeights.L3 ?? 0;

  if (l1 > 0 && weightGrams > l1 && weightGrams <= l1 * 2.8 && (!l2 || weightGrams > l2 * 0.85)) {
    return { stage: 'L2', confidence: 72, label: 'Likely L2' };
  }
  if (l2 > 0 && weightGrams > l2 && weightGrams <= l2 * 2.5 && (!l3 || weightGrams > l3 * 0.85)) {
    return { stage: 'L3', confidence: 72, label: 'Likely L3' };
  }
  if (l3 > 0 && weightGrams > l3) {
    return { stage: 'pupa', confidence: 55, label: 'Likely Pupa' };
  }
  if (!l1 && weightGrams > 0 && weightGrams < 18) {
    return { stage: 'L1', confidence: 48, label: 'Likely L1' };
  }
  if (!l1 && !l2 && weightGrams >= 18 && weightGrams < 45) {
    return { stage: 'L2', confidence: 45, label: 'Likely L2' };
  }
  if (!l3 && weightGrams >= 45 && weightGrams < 120) {
    return { stage: 'L3', confidence: 45, label: 'Likely L3' };
  }

  return { stage: null, confidence: 0, label: null };
}

export function parseMessyNote(
  text: string,
  options: {
    contextStage?: LifecycleStage;
    fallbackSpecies?: string;
    knownWeights?: Partial<Record<LifecycleStage, number>>;
  } = {}
): ParsedNoteMetrics {
  const rawText = text.trim();
  const empty: ParsedNoteMetrics = {
    rawText,
    species: null,
    explicitStage: null,
    weightGrams: null,
    sizeMm: null,
    count: null,
    date: null,
    inferredStage: null,
    confidence: 0,
    needsConfirmation: false,
    likelyStageLabel: null,
  };

  if (!rawText) return empty;

  const explicitStage = detectStageKeyword(rawText);
  const weightGrams = parseWeightGrams(rawText);
  const sizeMm = parseSizeMm(rawText);
  let count = parseCount(rawText);
  if (count == null && weightGrams == null && options.contextStage) {
    const bare = rawText.match(/^(\d+(?:\.\d+)?)$/);
    if (bare) {
      count = Number.parseFloat(bare[1]);
      if (Number.isNaN(count)) count = null;
      else count = Math.round(count);
    }
  }
  const date = parseDateFromText(rawText);
  const species = inferSpeciesFromNote(rawText, options.fallbackSpecies ?? '');

  let inferredStage: LifecycleStage | null = options.contextStage ?? explicitStage;
  let confidence = explicitStage || options.contextStage ? 88 : 0;
  let needsConfirmation = false;
  let likelyStageLabel: string | null = null;

  if (!inferredStage && weightGrams != null) {
    const guess = inferStageFromWeight(weightGrams, options.knownWeights ?? {});
    if (guess.stage) {
      inferredStage = guess.stage;
      confidence = guess.confidence;
      likelyStageLabel = guess.label;
      needsConfirmation = confidence < 70;
    } else {
      needsConfirmation = true;
      likelyStageLabel = 'Unknown stage';
      confidence = 25;
    }
  }

  if (inferredStage && !explicitStage && !options.contextStage) {
    needsConfirmation = confidence < 70;
    if (!likelyStageLabel) {
      likelyStageLabel = `Likely ${LIFECYCLE_LABELS[inferredStage]}`;
    }
  }

  if (explicitStage) {
    inferredStage = explicitStage;
    confidence = 92;
    needsConfirmation = false;
    likelyStageLabel = null;
  }

  if (options.contextStage) {
    inferredStage = options.contextStage;
    confidence = Math.max(confidence, 85);
    needsConfirmation = false;
    likelyStageLabel = null;
  }

  return {
    rawText,
    species,
    explicitStage,
    weightGrams,
    sizeMm,
    count,
    date,
    inferredStage,
    confidence,
    needsConfirmation,
    likelyStageLabel,
  };
}

export function lifecycleStageToInstar(stage: LifecycleStage): 'L1' | 'L2' | 'L3' | null {
  if (stage === 'L1' || stage === 'L2' || stage === 'L3') return stage;
  return null;
}

export function compareLifecycleStages(a: LifecycleStage, b: LifecycleStage): number {
  return stageIndex(a) - stageIndex(b);
}
