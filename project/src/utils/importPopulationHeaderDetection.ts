import {
  isObservationNoteText,
  isSexCountLabel,
  isValidLineName,
  parseStrictOrigin,
} from './importFieldParsing';
import { parseStageLabelToLifecycle } from './spreadsheetMetrics';

function isPureNumber(value: string): boolean {
  return /^\d+(\.\d+)?$/.test(value.trim());
}

function isHeadcountCategory(value: string): boolean {
  return /headcount|population|inventory/i.test(value.trim());
}

function isAdultLabel(value: string): boolean {
  return parseStageLabelToLifecycle(value) === 'adult';
}

function isDevelopmentalStageLabel(value: string): boolean {
  return Boolean(parseStageLabelToLifecycle(value.trim()));
}

function isMetaInventoryCell(value: string): boolean {
  const t = value.trim();
  return (
    isHeadcountCategory(t) ||
    Boolean(parseStrictOrigin(t)) ||
    isDevelopmentalStageLabel(t) ||
    /^unknown(\s+origin)?$/i.test(t)
  );
}

function extractNonNumericText(cells: string[]): string[] {
  return cells.filter((c) => c.trim() && !isPureNumber(c));
}

function extractLeadingNameColumn(cells: string[]): string {
  for (const cell of cells) {
    const trimmed = cell.trim();
    if (!trimmed || isPureNumber(trimmed)) continue;
    if (isDevelopmentalStageLabel(trimmed)) continue;
    if (isMetaInventoryCell(trimmed)) continue;
    if (!isValidLineName(trimmed)) continue;
    return trimmed;
  }
  return '';
}

function hasInventoryMetaCell(textCells: string[]): boolean {
  return textCells.some(
    (c) =>
      isHeadcountCategory(c) ||
      isAdultLabel(c) ||
      /^adults?$/i.test(c) ||
      Boolean(parseStrictOrigin(c)) ||
      Boolean(parseStageLabelToLifecycle(c))
  );
}

/** Species/line anchor without stage instar rows (L1/L2/L3 data rows). */
function isGroupAnchorRow(cells: string[]): boolean {
  const textCells = extractNonNumericText(cells);
  const nonStageCells = textCells.filter((cell) => !isDevelopmentalStageLabel(cell));

  const hasInstarStage = textCells.some((cell) => {
    const lifecycle = parseStageLabelToLifecycle(cell);
    return lifecycle === 'L1' || lifecycle === 'L2' || lifecycle === 'L3' || /^l[123]$/i.test(cell.trim());
  });
  if (hasInstarStage) return false;

  const leadingName = extractLeadingNameColumn(cells);
  const speciesName = nonStageCells.find((cell) => cell.trim().length > 1) || leadingName;
  const hasStageMarker = textCells.some((cell) => isDevelopmentalStageLabel(cell));

  if (speciesName && hasStageMarker) return true;
  if (speciesName && hasInventoryMetaCell(textCells)) return true;

  if (nonStageCells.length === 1) {
    const parsed = splitNameAndStageMarker(nonStageCells[0]);
    if (parsed.name && parsed.stage) return true;
  }

  return false;
}

function splitNameAndStageMarker(text: string): { name: string; stage: ReturnType<typeof parseStageLabelToLifecycle> } {
  const trimmed = text.trim();
  if (!trimmed) return { name: '', stage: null };

  const trailing = trimmed.match(/^(.+?)\s+(adult|larva|pupa|egg|juvenile|nymph)s?$/i);
  if (trailing) {
    const stage = parseStageLabelToLifecycle(trailing[2]);
    if (stage) return { name: trailing[1].trim(), stage };
  }

  const wholeStage = parseStageLabelToLifecycle(trimmed);
  if (wholeStage) return { name: '', stage: wholeStage };

  return { name: trimmed, stage: null };
}

/** Horizontal inventory row: species in first column + numeric stage counts on same row. */
function isHorizontalInventoryRow(cells: string[]): boolean {
  const lineName = extractLeadingNameColumn(cells);
  if (!lineName) return false;

  const numericCells = cells.filter((c) => isPureNumber(c));
  if (numericCells.length === 0) return false;

  const textCells = extractNonNumericText(cells);
  const nonMeta = textCells.filter((c) => !isMetaInventoryCell(c) && c !== lineName);
  const hasExplicitStages = textCells.some((c) => isDevelopmentalStageLabel(c));

  if (hasExplicitStages) return true;
  return nonMeta.length <= 2 && numericCells.length >= 1;
}

/**
 * True when a spreadsheet row starts a breeder population inventory group.
 * Exported for block detection and row promotion.
 */
export function looksLikePopulationGroupHeader(cells: string[], fullText: string): boolean {
  if (isObservationNoteText(fullText)) return false;
  if (isSexCountLabel(fullText.trim())) return false;

  const textCells = cells.map((c) => c.trim()).filter(Boolean);
  if (textCells.length === 0) return false;

  if (textCells.length === 1 && isSexCountLabel(textCells[0])) return false;

  if (isHorizontalInventoryRow(cells)) return true;

  if (!/headcount/i.test(fullText)) {
    const hasHeadcountStructure =
      textCells.some((c) => isHeadcountCategory(c)) &&
      textCells.some((c) => isValidLineName(c) && !isMetaInventoryCell(c)) &&
      textCells.some((c) => isAdultLabel(c) || /^adults?$/i.test(c) || parseStageLabelToLifecycle(c));
    if (!hasHeadcountStructure) {
      return isGroupAnchorRow(cells);
    }
  }

  const lineName = textCells.find((c) => isValidLineName(c) && !isMetaInventoryCell(c));
  if (!lineName) return false;

  return (
    /headcount/i.test(fullText) ||
    textCells.some((c) => isAdultLabel(c) || /^adults?$/i.test(c)) ||
    hasInventoryMetaCell(textCells)
  );
}

export function inferSpeciesFromHeaderCells(cells: string[]): string {
  const textCells = cells.map((c) => c.trim()).filter(Boolean);
  return (
    textCells.find((c) => isValidLineName(c) && !isMetaInventoryCell(c)) ||
    extractLeadingNameColumn(cells) ||
    ''
  );
}
