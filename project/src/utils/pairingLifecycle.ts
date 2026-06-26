import type { Pairing } from '@/types';

export type PairingMilestoneKind = 'paired' | 'eggs' | 'hatched' | 'emerged';

export interface PairingMilestone {
  kind: PairingMilestoneKind;
  label: string;
  date: string;
  value?: number;
}

export interface PairingFormOutcomes {
  eggsProduced: number;
  hatched: number;
  emerged: number;
}

function milestoneDate(pairing: Pairing, recordedAt: string | undefined, fallback: string): string {
  return recordedAt || fallback;
}

/** Build breeding milestones in chronological order for display. */
export function buildPairingLifecycle(pairing: Pairing): PairingMilestone[] {
  const milestones: Array<PairingMilestone & { sortDate: string }> = [];

  if (pairing.pairingDate) {
    milestones.push({
      kind: 'paired',
      label: 'Paired',
      date: pairing.pairingDate,
      sortDate: pairing.pairingDate,
    });
  }

  if (pairing.eggsProduced > 0) {
    const date = milestoneDate(pairing, pairing.eggsRecordedAt, pairing.pairingDate || pairing.createdAt);
    milestones.push({
      kind: 'eggs',
      label: 'Eggs produced',
      date,
      value: pairing.eggsProduced,
      sortDate: date,
    });
  }

  if (pairing.hatched > 0) {
    const date = milestoneDate(
      pairing,
      pairing.hatchedRecordedAt,
      pairing.eggsRecordedAt || pairing.pairingDate || pairing.createdAt
    );
    milestones.push({
      kind: 'hatched',
      label: 'Hatched',
      date,
      value: pairing.hatched,
      sortDate: date,
    });
  }

  if (pairing.emerged > 0) {
    const date = milestoneDate(
      pairing,
      pairing.emergedRecordedAt,
      pairing.hatchedRecordedAt || pairing.eggsRecordedAt || pairing.pairingDate || pairing.createdAt
    );
    milestones.push({
      kind: 'emerged',
      label: 'Emerged',
      date,
      value: pairing.emerged,
      sortDate: date,
    });
  }

  return milestones
    .sort((a, b) => a.sortDate.localeCompare(b.sortDate) || a.kind.localeCompare(b.kind))
    .map(({ sortDate: _sortDate, ...milestone }) => milestone);
}

function stampMilestoneDate(
  previousValue: number,
  nextValue: number,
  previousDate: string | undefined,
  today: string
): string | undefined {
  if (nextValue <= 0) return undefined;
  if (previousValue > 0 && previousDate) return previousDate;
  return today;
}

/** Merge edited outcome values while preserving milestone dates and prior counts. */
export function mergePairingUpdate(
  previous: Pairing,
  update: {
    maleBeetleId: string;
    femaleBeetleId: string;
    pairingDate: string;
    eggsProduced: number;
    hatched: number;
    emerged: number;
  },
  today = new Date().toISOString().slice(0, 10)
): Pairing {
  return {
    ...previous,
    maleBeetleId: update.maleBeetleId,
    femaleBeetleId: update.femaleBeetleId,
    pairingDate: update.pairingDate,
    eggsProduced: update.eggsProduced,
    hatched: update.hatched,
    emerged: update.emerged,
    eggsRecordedAt: stampMilestoneDate(
      previous.eggsProduced,
      update.eggsProduced,
      previous.eggsRecordedAt,
      today
    ),
    hatchedRecordedAt: stampMilestoneDate(
      previous.hatched,
      update.hatched,
      previous.hatchedRecordedAt,
      today
    ),
    emergedRecordedAt: stampMilestoneDate(
      previous.emerged,
      update.emerged,
      previous.emergedRecordedAt,
      today
    ),
  };
}

export function createPairingRecord(
  id: string,
  input: {
    maleBeetleId: string;
    femaleBeetleId: string;
    pairingDate: string;
    eggsProduced?: number;
    hatched?: number;
    emerged?: number;
  },
  today = new Date().toISOString().slice(0, 10)
): Pairing {
  const eggsProduced = input.eggsProduced ?? 0;
  const hatched = input.hatched ?? 0;
  const emerged = input.emerged ?? 0;

  return {
    id,
    maleBeetleId: input.maleBeetleId,
    femaleBeetleId: input.femaleBeetleId,
    pairingDate: input.pairingDate,
    eggsProduced,
    hatched,
    emerged,
    eggsRecordedAt: eggsProduced > 0 ? today : undefined,
    hatchedRecordedAt: hatched > 0 ? today : undefined,
    emergedRecordedAt: emerged > 0 ? today : undefined,
    createdAt: today,
  };
}

export function formatOutcomeCell(value: number): string {
  return value > 0 ? String(value) : '—';
}
