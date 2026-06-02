export const SUBSTRATE_CUSTOM = '__custom__';

export const SUBSTRATE_PRESET_OPTIONS = [
  { value: 'Flake Soil', label: 'Flake Soil' },
  { value: 'Kinshi + Flake', label: 'Kinshi + Flake' },
  { value: 'Kinshi Block', label: 'Kinshi Block' },
  { value: SUBSTRATE_CUSTOM, label: 'Custom' },
] as const;

const PRESET_VALUES = new Set<string>(
  SUBSTRATE_PRESET_OPTIONS.map((o) => o.value).filter((v) => v !== SUBSTRATE_CUSTOM)
);

export function resolveSubstrateType(selection: string, customValue: string): string {
  if (selection === SUBSTRATE_CUSTOM) {
    return customValue.trim();
  }
  return selection;
}

export function parseSubstrateType(stored: string): { selection: string; customValue: string } {
  if (!stored) {
    return { selection: 'Flake Soil', customValue: '' };
  }
  if (PRESET_VALUES.has(stored)) {
    return { selection: stored, customValue: '' };
  }
  return { selection: SUBSTRATE_CUSTOM, customValue: stored };
}
