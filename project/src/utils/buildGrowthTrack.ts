import type { Beetle, LarvalRecord } from '../types';
import type {
  BeetleGrowthTrack,
  GrowthTrackOverrides,
  LifecycleStage,
  LifecycleStageSnapshot,
  StageTrackStatus,
} from '../types/lifecycle';
import { LIFECYCLE_ORDER, LIFECYCLE_LABELS } from '../types/lifecycle';
import { parseMessyNote, parseWeightGrams, parseCount } from './parseStageNotes';
import { cellHasWeightUnit, COUNT_VS_GROWTH_WARNING } from './spreadsheetMetrics';

function overrideKey(beetleId: string, stage: LifecycleStage): string {
  return `${beetleId}:${stage}`;
}

function emptySnapshot(stage: LifecycleStage): LifecycleStageSnapshot {
  return {
    stage,
    status: 'not_reached',
    weightGrams: null,
    sizeMm: null,
    count: null,
    notes: '',
    dateUpdated: '',
    inferred: false,
    confidence: 100,
    likelyStageLabel: null,
    needsConfirmation: false,
    sourceText: '',
  };
}

function hasSnapshotData(snapshot: LifecycleStageSnapshot): boolean {
  return Boolean(
    snapshot.weightGrams != null ||
      snapshot.sizeMm != null ||
      snapshot.count != null ||
      snapshot.notes.trim() ||
      snapshot.sourceText.trim()
  );
}

function mergeSnapshot(
  current: LifecycleStageSnapshot,
  patch: Partial<LifecycleStageSnapshot>
): LifecycleStageSnapshot {
  return {
    ...current,
    ...patch,
    weightGrams: patch.weightGrams !== undefined ? patch.weightGrams : current.weightGrams,
    sizeMm: patch.sizeMm !== undefined ? patch.sizeMm : current.sizeMm,
    count: patch.count !== undefined ? patch.count : current.count,
  };
}

function applyParsedToSnapshot(
  snapshot: LifecycleStageSnapshot,
  parsed: ReturnType<typeof parseMessyNote>,
  sourceText: string
): LifecycleStageSnapshot {
  const targetStage = parsed.inferredStage ?? snapshot.stage;
  if (targetStage !== snapshot.stage && parsed.confidence < 85) {
    return {
      ...snapshot,
      status: 'ambiguous',
      inferred: true,
      confidence: parsed.confidence,
      likelyStageLabel: parsed.likelyStageLabel ?? `Likely ${LIFECYCLE_LABELS[targetStage]}`,
      needsConfirmation: true,
      sourceText: sourceText || snapshot.sourceText,
      notes: snapshot.notes || parsed.rawText,
    };
  }

  return mergeSnapshot(snapshot, {
    weightGrams: parsed.weightGrams ?? snapshot.weightGrams,
    sizeMm: parsed.sizeMm ?? snapshot.sizeMm,
    count: parsed.count ?? snapshot.count,
    dateUpdated: parsed.date ?? snapshot.dateUpdated,
    notes: parsed.rawText || snapshot.notes,
    sourceText,
    inferred: !parsed.explicitStage && parsed.inferredStage === snapshot.stage,
    confidence: parsed.confidence || 100,
    likelyStageLabel: parsed.likelyStageLabel,
    needsConfirmation: parsed.needsConfirmation,
  });
}

function noteContextStage(key: string): LifecycleStage | undefined {
  if (key === 'egg') return 'egg';
  if (key === 'l1') return 'L1';
  if (key === 'l2') return 'L2';
  if (key === 'l3') return 'L3';
  if (key === 'pupa') return 'pupa';
  if (key === 'adult') return 'adult';
  return undefined;
}

function computeStatuses(stages: LifecycleStageSnapshot[], beetle: Beetle): void {
  let highestDataIndex = -1;
  stages.forEach((snapshot, index) => {
    if (hasSnapshotData(snapshot)) highestDataIndex = index;
  });

  stages.forEach((snapshot, index) => {
    if (snapshot.needsConfirmation || snapshot.status === 'ambiguous') {
      snapshot.status = 'ambiguous';
      return;
    }

    if (!hasSnapshotData(snapshot)) {
      snapshot.status = 'not_reached';
      return;
    }

    if (index < highestDataIndex) {
      snapshot.status = 'completed';
      return;
    }

    if (index === highestDataIndex) {
      if (beetle.status === 'adult' && snapshot.stage === 'adult') {
        snapshot.status = 'completed';
      } else if (beetle.status === 'adult' && snapshot.stage !== 'adult') {
        snapshot.status = 'completed';
      } else if (beetle.status === 'pupa' && snapshot.stage === 'pupa') {
        snapshot.status = 'current';
      } else {
        snapshot.status = 'current';
      }
      return;
    }

    snapshot.status = 'not_reached';
  });
}

export function buildGrowthTrack(
  beetle: Beetle,
  larvalRecords: LarvalRecord[],
  overrides: GrowthTrackOverrides = {}
): BeetleGrowthTrack {
  const stageMap = new Map<LifecycleStage, LifecycleStageSnapshot>();
  LIFECYCLE_ORDER.forEach((stage) => stageMap.set(stage, emptySnapshot(stage)));

  const knownWeights: Partial<Record<LifecycleStage, number>> = {};

  const noteSources: { key: keyof typeof beetle.stageNotes; text: string }[] = [
    { key: 'egg', text: beetle.stageNotes.egg ?? '' },
    { key: 'l1', text: beetle.stageNotes.l1 },
    { key: 'l2', text: beetle.stageNotes.l2 },
    { key: 'l3', text: beetle.stageNotes.l3 },
    { key: 'pupa', text: beetle.stageNotes.pupa ?? '' },
    { key: 'adult', text: beetle.stageNotes.adult },
  ];

  for (const { key, text } of noteSources) {
    const contextStage = noteContextStage(key);
    if (!contextStage || !text.trim()) continue;

    const parsed = parseMessyNote(text, {
      contextStage,
      fallbackSpecies: beetle.species || beetle.name,
      knownWeights,
    });

    const snap = stageMap.get(contextStage)!;
    const plainNumberOnly =
      parsed.count != null &&
      parsed.weightGrams == null &&
      parsed.sizeMm == null &&
      !cellHasWeightUnit(text) &&
      !/\d\s*mm\b/i.test(text);

    const applied = applyParsedToSnapshot(snap, {
      ...parsed,
      weightGrams: plainNumberOnly ? null : parsed.weightGrams,
      count: plainNumberOnly ? null : parsed.count,
      sizeMm: plainNumberOnly ? null : parsed.sizeMm,
      inferredStage: contextStage,
      needsConfirmation:
        plainNumberOnly ||
        (parsed.needsConfirmation && !parsed.explicitStage),
      likelyStageLabel: plainNumberOnly
        ? COUNT_VS_GROWTH_WARNING
        : parsed.needsConfirmation && parsed.inferredStage && parsed.inferredStage !== contextStage
          ? `Likely ${LIFECYCLE_LABELS[parsed.inferredStage]} (saved under ${LIFECYCLE_LABELS[contextStage]})`
          : parsed.likelyStageLabel,
    }, text);
    stageMap.set(contextStage, applied);

    if (parsed.weightGrams != null && !plainNumberOnly) {
      knownWeights[contextStage] = parsed.weightGrams;
    }
  }

  if (beetle.instarWeights.l1 > 0) {
    const snap = stageMap.get('L1')!;
    stageMap.set(
      'L1',
      mergeSnapshot(snap, {
        weightGrams: beetle.instarWeights.l1,
        sourceText: snap.sourceText || `Profile weight: ${beetle.instarWeights.l1}g`,
      })
    );
    knownWeights.L1 = beetle.instarWeights.l1;
  }
  if (beetle.instarWeights.l2 > 0) {
    const snap = stageMap.get('L2')!;
    stageMap.set(
      'L2',
      mergeSnapshot(snap, {
        weightGrams: beetle.instarWeights.l2,
        sourceText: snap.sourceText || `Profile weight: ${beetle.instarWeights.l2}g`,
      })
    );
    knownWeights.L2 = beetle.instarWeights.l2;
  }
  if (beetle.instarWeights.l3 > 0) {
    const snap = stageMap.get('L3')!;
    stageMap.set(
      'L3',
      mergeSnapshot(snap, {
        weightGrams: beetle.instarWeights.l3,
        sourceText: snap.sourceText || `Profile weight: ${beetle.instarWeights.l3}g`,
      })
    );
    knownWeights.L3 = beetle.instarWeights.l3;
  }

  if (beetle.status === 'adult') {
    const adultSnap = stageMap.get('adult')!;
    stageMap.set(
      'adult',
      mergeSnapshot(adultSnap, {
        weightGrams: beetle.adultWeight > 0 ? beetle.adultWeight : adultSnap.weightGrams,
        sizeMm: beetle.adultSize > 0 ? beetle.adultSize : adultSnap.sizeMm,
        dateUpdated: beetle.emergenceDate || adultSnap.dateUpdated,
      })
    );
  }

  const beetleRecords = larvalRecords
    .filter((record) => record.beetleId === beetle.id)
    .sort((a, b) => a.dateChecked.localeCompare(b.dateChecked));

  for (const record of beetleRecords) {
    const stage: LifecycleStage = record.instarStage;
    const snap = stageMap.get(stage)!;
    const weightFromNotes = parseWeightGrams(record.notes);
    const countFromNotes = parseCount(record.notes);
    stageMap.set(
      stage,
      mergeSnapshot(snap, {
        weightGrams: record.weight > 0 ? record.weight : weightFromNotes ?? snap.weightGrams,
        count: countFromNotes ?? snap.count,
        dateUpdated: record.dateChecked || snap.dateUpdated,
        notes: record.notes || snap.notes,
        sourceText: snap.sourceText || `Growth log ${record.id}`,
        inferred: false,
        confidence: 100,
        needsConfirmation: false,
        likelyStageLabel: null,
      })
    );
    if (record.weight > 0) knownWeights[stage] = record.weight;
  }

  const stages = LIFECYCLE_ORDER.map((stage) => {
    let snap = stageMap.get(stage)!;
    const override = overrides[overrideKey(beetle.id, stage)];
    if (override) {
      if (override.confirmed) {
        snap = mergeSnapshot(snap, {
          weightGrams: override.weightGrams ?? snap.weightGrams,
          sizeMm: override.sizeMm ?? snap.sizeMm,
          count: override.count ?? snap.count,
          notes: override.notes ?? snap.notes,
          dateUpdated: override.dateUpdated ?? snap.dateUpdated,
          needsConfirmation: false,
          likelyStageLabel: null,
          confidence: 100,
          status: override.status ?? snap.status,
          inferred: false,
        });
      } else if (override.stage && override.stage !== stage) {
        snap = mergeSnapshot(snap, {
          status: 'ambiguous',
          needsConfirmation: true,
          likelyStageLabel: `Likely ${LIFECYCLE_LABELS[override.stage]}`,
        });
      } else {
        snap = mergeSnapshot(snap, {
          weightGrams: override.weightGrams ?? snap.weightGrams,
          sizeMm: override.sizeMm ?? snap.sizeMm,
          count: override.count ?? snap.count,
          notes: override.notes ?? snap.notes,
          dateUpdated: override.dateUpdated ?? snap.dateUpdated,
          needsConfirmation: override.needsConfirmation ?? snap.needsConfirmation,
        });
      }
    }
    return snap;
  });

  computeStatuses(stages, beetle);

  return {
    beetleId: beetle.id,
    beetleName: beetle.name,
    species: beetle.species || beetle.name,
    stages,
  };
}

export function growthTrackToLarvalRecords(
  track: BeetleGrowthTrack,
  existingCount: number,
  bottlePrefix = 'AUTO'
): LarvalRecord[] {
  const now = new Date().toISOString().slice(0, 10);
  const records: LarvalRecord[] = [];
  let index = 0;

  for (const snapshot of track.stages) {
    if (snapshot.stage !== 'L1' && snapshot.stage !== 'L2' && snapshot.stage !== 'L3') continue;
    if (!snapshot.weightGrams || snapshot.weightGrams <= 0) continue;
    if (snapshot.needsConfirmation && snapshot.status === 'ambiguous') continue;

    const id = `LR-${String(existingCount + index + 1).padStart(3, '0')}`;
    index += 1;
    records.push({
      id,
      bottleId: `${bottlePrefix}-${track.beetleId}-${snapshot.stage}`,
      beetleId: track.beetleId,
      dateChecked: snapshot.dateUpdated || now,
      weight: snapshot.weightGrams,
      instarStage: snapshot.stage,
      substrateType: 'Flake Soil',
      containerSizeValue: 500,
      containerSizeUnit: 'mL',
      temperature: 0,
      humidity: 0,
      notes: [snapshot.notes, snapshot.count != null ? `Count: ${snapshot.count}` : ''].filter(Boolean).join(' | '),
      photoUrl: '',
      nextCheckDate: '',
      createdAt: now,
    });
  }

  return records;
}

export function formatStageStatus(status: StageTrackStatus): string {
  switch (status) {
    case 'not_reached':
      return 'Not reached';
    case 'completed':
      return 'Completed';
    case 'current':
      return 'Current';
    case 'ambiguous':
      return 'Needs confirmation';
    default:
      return status;
  }
}
