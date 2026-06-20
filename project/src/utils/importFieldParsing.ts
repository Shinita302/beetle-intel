/** Strict generation tokens: F1–F4+, CBF1, WDF1, etc. */
const STRICT_GENERATION_RE = /^(?:CBF|WDF|F)(\d+\+?)$/i;

/** Strict origin tokens: CB, WC, WD, CBF1, WDF1, etc. */
const STRICT_ORIGIN_RE = /^(?:CB|WC|WD|CBF|WDF)(\d+\+?)?$/i;

export function parseStrictGeneration(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';

  const fromAdult = trimmed.match(/\(\s*(?:CB|WD)?(F\d+\+?)\s*\)/i);
  if (fromAdult?.[1]) {
    const prefix = /CB/i.test(trimmed) ? 'CB' : /WD/i.test(trimmed) ? 'WD' : '';
    return `${prefix}${fromAdult[1].toUpperCase()}`;
  }

  const token = trimmed.match(/\b((?:CB|WD)?F\d+\+?)\b/i)?.[1];
  if (token && STRICT_GENERATION_RE.test(token)) {
    return token.toUpperCase();
  }

  return '';
}

export function parseStrictOrigin(raw: string): string {
  const trimmed = raw.trim().toUpperCase();
  if (!trimmed) return '';
  if (STRICT_ORIGIN_RE.test(trimmed)) return trimmed;
  return '';
}

export function parseOriginFromCells(cells: string[]): string {
  for (const cell of cells) {
    const origin = parseStrictOrigin(cell);
    if (origin) return origin;
  }
  return '';
}

export function parseGenerationFromCells(cells: string[]): string {
  for (const cell of cells) {
    const gen = parseStrictGeneration(cell);
    if (gen) return gen;
  }
  return '';
}

const OBSERVATION_DATE_RE =
  /\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+\d{1,2}(?:st|nd|rd|th)?(?:[:\s,|]|$)/i;

const DAY_FIRST_DATE_RE =
  /\d{1,2}(?:st|nd|rd|th)?\s+(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)[a-z]*(?:\s+\d{4})?/i;

/** Sex breakdown sub-rows under a population header (e.g. "3 males", "1(Male)"). */
export function isSexCountLabel(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (/^\d+\s*(?:males?|females?)$/i.test(t)) return true;
  if (/^\d+\s+(?:male|female)s?$/i.test(t)) return true;
  if (/^\d+\s*[\(（]\s*(?:male|female)\s*[\)）]$/i.test(t)) return true;
  if (/^[\(（]\s*(?:male|female)\s*[\)）]$/i.test(t)) return true;
  return false;
}

/** Date/size/sex observation rows — not inventory groups. */
export function isObservationNoteText(text: string): boolean {
  const t = text.trim();
  if (!t) return false;

  if (isSexCountLabel(t)) return true;
  if (OBSERVATION_DATE_RE.test(t)) return true;
  if (DAY_FIRST_DATE_RE.test(t)) return true;
  if (/\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(t)) return true;
  if (/\d{1,2}[-/]\d{1,2}[-/]\d{2,4}/.test(t) && /\b(mm|male|female|♂|♀)\b/i.test(t)) return true;
  if (/\d+\s*mm/i.test(t) && /\b(male|female|♂|♀)\b/i.test(t)) return true;
  if (/:\s*\d+(?:\.\d+)?\s*mm/i.test(t)) return true;
  if (/^\d+\s*mm\b/i.test(t)) return true;

  return false;
}

export function isValidLineName(text: string): boolean {
  const t = text.trim();
  if (!t || t.length < 2) return false;
  if (t.includes('|')) return false;
  if (isObservationNoteText(t)) return false;
  if (isSexCountLabel(t)) return false;
  if (/^headcount$/i.test(t)) return false;
  if (/^unknown(\s+origin)?$/i.test(t)) return false;
  if (/^(CB|WC|WD|CBF\d+\+?|WDF\d+\+?)$/i.test(t)) return false;
  if (/^adult(\s*\(\s*(?:CB|WD)?F\d+\+?\s*\))?$/i.test(t)) return false;
  if (/^l[123]$/i.test(t)) return false;
  if (/^(egg|eggs|pupa|pupae|larva|larvae)$/i.test(t)) return false;
  return true;
}

/** Species/line names may only come from strict population header rows. */
export function isValidSpeciesFromHeader(text: string): boolean {
  const t = text.trim();
  if (!isValidLineName(t)) return false;
  if (/^\d/.test(t)) return false;
  if (/\b(male|female|♂|♀)\b/i.test(t)) return false;
  if (/\d+\s*mm\b/i.test(t) || /\d+\.?\d*\s*g\b/i.test(t)) return false;
  if (/^l[123]$/i.test(t)) return false;
  if (/^(egg|eggs|pupa|pupae|larva|larvae|adult|headcount)$/i.test(t)) return false;
  return true;
}

function isHeadcountCell(value: string): boolean {
  return /^headcount$/i.test(value.trim()) || /^(population|inventory)$/i.test(value.trim());
}

function isAdultHeaderCell(value: string): boolean {
  const t = value.trim();
  return /^adults?$/i.test(t) || /^adult\s*\(\s*(?:CB|WD)?F\d+\+?\s*\)$/i.test(t);
}

/** Strict breeder header: species + headcount + adult + origin on one row. */
export function isStrictPopulationHeaderRow(cells: string[]): boolean {
  const textCells = cells.map((c) => c.trim()).filter(Boolean);
  if (textCells.length === 0) return false;

  const species = textCells.find((c) => isValidSpeciesFromHeader(c));
  const hasHeadcount = textCells.some((c) => isHeadcountCell(c));
  const hasAdult = textCells.some((c) => isAdultHeaderCell(c));
  const origin = parseOriginFromCells(textCells);

  return Boolean(species && hasHeadcount && hasAdult && origin);
}

export type InventoryCountKey = 'eggs' | 'l1' | 'l2' | 'l3' | 'prePupa' | 'pupa' | 'adult';

export const INVENTORY_COUNT_LABELS: Record<InventoryCountKey, string> = {
  eggs: 'Egg',
  l1: 'L1',
  l2: 'L2',
  l3: 'L3',
  prePupa: 'Pre-Pupa',
  pupa: 'Pupa',
  adult: 'Adult',
};

export function inventoryCountTotal(counts: Record<InventoryCountKey, number>): number {
  return counts.eggs + counts.l1 + counts.l2 + counts.l3 + counts.prePupa + counts.pupa + counts.adult;
}
