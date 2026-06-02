/** Full beetle lifecycle in order. */
export type LifecycleStage = 'egg' | 'L1' | 'L2' | 'L3' | 'pupa' | 'adult';

export type StageTrackStatus = 'not_reached' | 'completed' | 'current' | 'ambiguous';

export const LIFECYCLE_ORDER: LifecycleStage[] = ['egg', 'L1', 'L2', 'L3', 'pupa', 'adult'];

export const LIFECYCLE_LABELS: Record<LifecycleStage, string> = {
  egg: 'Egg',
  L1: 'L1',
  L2: 'L2',
  L3: 'L3',
  pupa: 'Pupa',
  adult: 'Adult',
};

export interface ParsedNoteMetrics {
  rawText: string;
  species: string | null;
  explicitStage: LifecycleStage | null;
  weightGrams: number | null;
  sizeMm: number | null;
  count: number | null;
  date: string | null;
  inferredStage: LifecycleStage | null;
  confidence: number;
  needsConfirmation: boolean;
  likelyStageLabel: string | null;
}

export interface LifecycleStageSnapshot {
  stage: LifecycleStage;
  status: StageTrackStatus;
  weightGrams: number | null;
  sizeMm: number | null;
  count: number | null;
  notes: string;
  dateUpdated: string;
  inferred: boolean;
  confidence: number;
  likelyStageLabel: string | null;
  needsConfirmation: boolean;
  sourceText: string;
}

export interface BeetleGrowthTrack {
  beetleId: string;
  beetleName: string;
  species: string;
  stages: LifecycleStageSnapshot[];
}

/** Manual corrections keyed by `${beetleId}:${stage}` */
export type GrowthTrackOverrides = Record<
  string,
  {
    stage?: LifecycleStage;
    status?: StageTrackStatus;
    weightGrams?: number | null;
    sizeMm?: number | null;
    count?: number | null;
    notes?: string;
    dateUpdated?: string;
    needsConfirmation?: boolean;
    confirmed?: boolean;
  }
>;
