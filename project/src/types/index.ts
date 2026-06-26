export type BeetleStatus = 'larva' | 'pupa' | 'adult' | 'dead' | 'sold';
export type BeetleSex = 'male' | 'female' | 'unknown';
export type BeetleOrigin = 'CB' | 'WC';
export type GrowthStage = 'Egg' | 'L1' | 'L2' | 'L3' | 'Pre-Pupa' | 'Pupa' | 'Adult';
export type PestProblem = 'mites' | 'mold' | 'dryness' | 'over-wet' | 'smell' | 'unknown';
export type Severity = 'low' | 'medium' | 'high';
export type PestStatus = 'open' | 'resolved';
export type ContainerSizeUnit = 'cc' | 'mL' | 'L' | 'gallons';
export type PestRiskLevel = 'low' | 'moderate' | 'high';

/** Individual beetle profile — one beetle only. */
export interface Beetle {
  id: string;
  name: string;
  species: string;
  sex: BeetleSex;
  status: BeetleStatus;
  generation: string;
  origin: BeetleOrigin | '';
  sizeMm: number;
  color: string;
  notes: string;
  source: string;
  bloodline: string;
  createdAt: string;
}

/** Collection-level population counts per species/line (inventory group). */
export interface SpeciesInventory {
  id: string;
  species: string;
  /** Line or group label from spreadsheet (e.g. "Hercules Hercules"). */
  lineName?: string;
  generation?: string;
  origin?: string;
  notes?: string;
  sourceFile?: string;
  sourceSheet?: string;
  importedAt?: string;
  eggs: number;
  l1: number;
  l2: number;
  l3: number;
  prePupa: number;
  pupa: number;
  adult: number;
  updatedAt: string;
}

export type SpeciesInventoryStageKey = keyof Pick<
  SpeciesInventory,
  'eggs' | 'l1' | 'l2' | 'l3' | 'prePupa' | 'pupa' | 'adult'
>;

export function inventoryGroupKey(species: string, lineName?: string, generation?: string): string {
  return [species.trim(), lineName?.trim(), generation?.trim()]
    .filter(Boolean)
    .join('|')
    .toLowerCase();
}

/** Stable id for an inventory population group. */
export function inventoryGroupId(species: string, lineName?: string, generation?: string): string {
  const slug = inventoryGroupKey(species, lineName, generation)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug ? `INV-${slug}` : `INV-${Date.now()}`;
}

/** @deprecated Use inventoryGroupId */
export function speciesInventoryId(species: string): string {
  return inventoryGroupId(species);
}

export const emptySpeciesInventory = (species: string, id = ''): SpeciesInventory => ({
  id: id || speciesInventoryId(species),
  species,
  eggs: 0,
  l1: 0,
  l2: 0,
  l3: 0,
  prePupa: 0,
  pupa: 0,
  adult: 0,
  updatedAt: new Date().toISOString().slice(0, 10),
});

export function speciesInventoryTotal(row: SpeciesInventory): number {
  return row.eggs + row.l1 + row.l2 + row.l3 + row.prePupa + row.pupa + row.adult;
}

export function activeLarvaeCount(row: SpeciesInventory): number {
  return row.l1 + row.l2 + row.l3 + row.prePupa;
}

/** L1–L3 instar counts only (dashboard active larvae). */
export function instarLarvaeCount(row: SpeciesInventory): number {
  return row.l1 + row.l2 + row.l3;
}

export function totalPopulationInventory(rows: SpeciesInventory[]): number {
  return rows.reduce((sum, row) => sum + speciesInventoryTotal(row), 0);
}

export function totalActiveLarvaeInventory(rows: SpeciesInventory[]): number {
  return rows.reduce((sum, row) => sum + activeLarvaeCount(row), 0);
}

export function totalInstarLarvaeInventory(rows: SpeciesInventory[]): number {
  return rows.reduce((sum, row) => sum + instarLarvaeCount(row), 0);
}

export function totalAdultsInventory(rows: SpeciesInventory[]): number {
  return rows.reduce((sum, row) => sum + row.adult, 0);
}

/** Per-beetle growth log entry. */
export interface GrowthEntry {
  id: string;
  beetleId: string;
  date: string;
  stage: GrowthStage;
  weight: number;
  temperature: number;
  humidity: number;
  substrate: string;
  notes: string;
  createdAt: string;
}

/** Breeding pair record — lineage lives here, not on beetle profiles. */
export interface Pairing {
  id: string;
  maleBeetleId: string;
  femaleBeetleId: string;
  pairingDate: string;
  eggsProduced: number;
  hatched: number;
  emerged: number;
  createdAt: string;
}

export function pairingHatchRate(p: Pairing): number {
  return p.eggsProduced > 0 ? Math.round((p.hatched / p.eggsProduced) * 100) : 0;
}

export function pairingEmergeRate(p: Pairing): number {
  return p.hatched > 0 ? Math.round((p.emerged / p.hatched) * 100) : 0;
}

export function pairingFertilityScore(p: Pairing): number {
  return p.eggsProduced > 0 ? Math.round((p.emerged / p.eggsProduced) * 100) : 0;
}

export function beetleLabel(beetles: Beetle[], beetleId: string): string {
  const beetle = beetles.find((b) => b.id === beetleId);
  if (!beetle) return beetleId;
  if (beetle.name && beetle.name !== beetle.species) {
    return `${beetle.name} (${beetle.species || beetle.id})`;
  }
  return beetle.name || beetle.species || beetle.id;
}

/** Optional size/color suffix for beetle pickers and detail rows. */
export function beetleProfileDetails(beetle: Beetle): string {
  const parts: string[] = [];
  if (beetle.sizeMm > 0) {
    const rounded = Number.isInteger(beetle.sizeMm) ? String(beetle.sizeMm) : beetle.sizeMm.toFixed(1);
    parts.push(`${rounded} mm`);
  }
  if (beetle.color.trim()) {
    parts.push(beetle.color.trim());
  }
  return parts.join(' · ');
}

export interface PestRisk {
  id: string;
  bottleId: string;
  problemType: PestProblem;
  severity: Severity;
  dateNoticed: string;
  actionTaken: string;
  status: PestStatus;
  createdAt: string;
  substrateType?: string;
  temperature?: number;
  humidity?: number;
  foodType?: string;
  riskLevel?: PestRiskLevel;
  predictionSummary?: string;
}

export interface DashboardStats {
  totalBeetles: number;
  activeLarvae: number;
  avgHatchRate: number;
  avgFertilityScore: number;
}

/** @deprecated Use GrowthEntry */
export type LarvalRecord = GrowthEntry & {
  bottleId?: string;
  dateChecked?: string;
  instarStage?: GrowthStage;
  substrateType?: string;
  containerSizeValue?: number;
  containerSizeUnit?: ContainerSizeUnit;
  photoUrl?: string;
  nextCheckDate?: string;
};
