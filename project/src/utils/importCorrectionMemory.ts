import type { EditableImportGroup, ImportCorrectionRule } from '@/types/hybridImport';

const CORRECTION_KEY_PREFIX = 'beetle-intel-import-corrections';

function storageKey(userId: string): string {
  return `${CORRECTION_KEY_PREFIX}:${userId}`;
}

export function loadCorrectionRules(userId: string): ImportCorrectionRule[] {
  if (typeof window === 'undefined' || !userId) return [];
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ImportCorrectionRule[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveCorrectionRules(userId: string, rules: ImportCorrectionRule[]): void {
  if (typeof window === 'undefined' || !userId) return;
  window.localStorage.setItem(storageKey(userId), JSON.stringify(rules.slice(-100)));
}

export function rememberCorrection(
  userId: string,
  group: Pick<EditableImportGroup, 'lineName' | 'species'>,
  field: ImportCorrectionRule['field'],
  value: string
): void {
  if (!userId || !value.trim()) return;

  const rules = loadCorrectionRules(userId).filter(
    (rule) =>
      !(
        rule.field === field &&
        rule.matchLineName?.toLowerCase() === group.lineName.toLowerCase() &&
        rule.matchSpecies?.toLowerCase() === group.species.toLowerCase()
      )
  );

  rules.push({
    id: `rule-${Date.now()}`,
    matchLineName: group.lineName || undefined,
    matchSpecies: group.species || undefined,
    field,
    value: value.trim(),
    createdAt: new Date().toISOString(),
  });

  saveCorrectionRules(userId, rules);
}

export function applyCorrectionRules(
  group: EditableImportGroup,
  rules: ImportCorrectionRule[]
): EditableImportGroup {
  const next = { ...group };
  const lineKey = group.lineName.trim().toLowerCase();
  const speciesKey = group.species.trim().toLowerCase();

  for (const rule of rules) {
    const lineMatch = rule.matchLineName?.toLowerCase();
    const speciesMatch = rule.matchSpecies?.toLowerCase();
    const matchesLine = lineMatch ? lineKey === lineMatch || lineKey.includes(lineMatch) : false;
    const matchesSpecies = speciesMatch ? speciesKey === speciesMatch : false;
    if (!matchesLine && !matchesSpecies) continue;

    if (rule.field === 'species') next.species = rule.value;
    if (rule.field === 'lineName') next.lineName = rule.value;
    if (rule.field === 'origin') next.origin = rule.value;
    if (rule.field === 'generation') next.generation = rule.value;
  }

  return next;
}
