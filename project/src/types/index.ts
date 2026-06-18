export type BeetleStatus = 'larva' | 'pupa' | 'adult' | 'dead' | 'sold';
export type BeetleSex = 'male' | 'female' | 'unknown';
export type GrowthStage = 'Egg' | 'L1' | 'L2' | 'L3' | 'Pre-Pupa' | 'Pupa' | 'Adult';
export type PestProblem = 'mites' | 'mold' | 'dryness' | 'over-wet' | 'smell' | 'unknown';
export type Severity = 'low' | 'medium' | 'high';
export type PestStatus = 'open' | 'resolved';
export type ContainerSizeUnit = 'cc' | 'mL' | 'L' | 'gallons';
export type OutbreakRiskLevel = 'low' | 'moderate' | 'high' | 'critical';

/** Individual beetle profile — one beetle only. */
export interface Beetle {
  id: string;
  name: string;
  species: string;
  sex: BeetleSex;
  status: BeetleStatus;
  generation: string;
  notes: string;
  source: string;
  bloodline: string;
  createdAt: string;
}

/** Collection-level population counts per species. */
export interface SpeciesInventory {
  id: string;
  species: string;
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

export const emptySpeciesInventory = (species: string, id = ''): SpeciesInventory => ({
  id,
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
  outbreakScore?: number;
  outbreakLevel?: OutbreakRiskLevel;
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
