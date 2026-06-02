export type BeetleStatus = 'larva' | 'pupa' | 'adult' | 'dead' | 'sold';
export type BeetleSex = 'male' | 'female' | 'unknown';
export type InstarStage = 'L1' | 'L2' | 'L3';
export type PestProblem = 'mites' | 'mold' | 'dryness' | 'over-wet' | 'smell' | 'unknown';
export type Severity = 'low' | 'medium' | 'high';
export type PestStatus = 'open' | 'resolved';
export type ContainerSizeUnit = 'cc' | 'mL' | 'L' | 'gallons';
export type OutbreakRiskLevel = 'low' | 'moderate' | 'high' | 'critical';

export interface BeetleStageNotes {
  egg: string;
  l1: string;
  l2: string;
  l3: string;
  pupa: string;
  adult: string;
}

export const emptyStageNotes = (): BeetleStageNotes => ({
  egg: '',
  l1: '',
  l2: '',
  l3: '',
  pupa: '',
  adult: '',
});

/** Gram weight recorded at each larval instar (L1 / L2 / L3). */
export interface BeetleInstarWeights {
  l1: number;
  l2: number;
  l3: number;
}

export const emptyInstarWeights = (): BeetleInstarWeights => ({
  l1: 0,
  l2: 0,
  l3: 0,
});

/** Head-count / inventory by life stage (from spreadsheet stage rows). */
export interface BeetleInventoryCounts {
  egg: number;
  l1: number;
  l2: number;
  l3: number;
  pupa: number;
  adult: number;
}

export const emptyInventoryCounts = (): BeetleInventoryCounts => ({
  egg: 0,
  l1: 0,
  l2: 0,
  l3: 0,
  pupa: 0,
  adult: 0,
});

export function hasAnyInventoryCounts(counts: BeetleInventoryCounts): boolean {
  return (
    counts.egg > 0 ||
    counts.l1 > 0 ||
    counts.l2 > 0 ||
    counts.l3 > 0 ||
    counts.pupa > 0 ||
    counts.adult > 0
  );
}

/** Latest instar weight for summaries (L3 → L2 → L1). */
export function latestInstarWeight(weights: BeetleInstarWeights): number {
  if (weights.l3 > 0) return weights.l3;
  if (weights.l2 > 0) return weights.l2;
  if (weights.l1 > 0) return weights.l1;
  return 0;
}

export interface Beetle {
  id: string;
  name: string;
  species: string;
  sex: BeetleSex;
  source: string;
  generation: string;
  emergenceDate: string;
  /** Summary: latest L3/L2/L1 weight (kept for charts and legacy data). */
  larvalWeight: number;
  instarWeights: BeetleInstarWeights;
  /** Inventory / head counts per stage (plain numbers from spreadsheets). */
  inventoryCounts: BeetleInventoryCounts;
  adultSize: number;
  adultWeight: number;
  bloodline: string;
  stageNotes: BeetleStageNotes;
  fatherParent: string;
  motherParent: string;
  status: BeetleStatus;
  isBigHitter: boolean;
  createdAt: string;
}

export interface LarvalRecord {
  id: string;
  bottleId: string;
  beetleId: string;
  dateChecked: string;
  weight: number;
  instarStage: InstarStage;
  substrateType: string;
  containerSizeValue: number;
  containerSizeUnit: ContainerSizeUnit;
  temperature: number;
  humidity: number;
  notes: string;
  photoUrl: string;
  nextCheckDate: string;
  createdAt: string;
}

export interface Pairing {
  id: string;
  maleBeetleId: string;
  maleBeetleName: string;
  femaleBeetleId: string;
  femaleBeetleName: string;
  pairingDate: string;
  eggLayingSetupDate: string;
  totalEggsLaid: number;
  hatchedEggs: number;
  pupatedLarvae: number;
  emergedAdults: number;
  notes: string;
  createdAt: string;
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
  /** Premium prediction inputs (for future AI integration) */
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
