import { parseLegacyContainerSize } from '../constants/containerSize';
import type { LarvalRecord, ContainerSizeUnit } from '../types';

type LegacyLarvalRecord = Partial<LarvalRecord> & {
  containerSize?: string;
};

function normalizeUnit(unit: unknown): ContainerSizeUnit {
  if (unit === 'cc' || unit === 'mL' || unit === 'L' || unit === 'gallons') {
    return unit;
  }
  return 'mL';
}

export function normalizeLarvalRecord(raw: LegacyLarvalRecord): LarvalRecord {
  let containerSizeValue = raw.containerSizeValue ?? 0;
  let containerSizeUnit = normalizeUnit(raw.containerSizeUnit);

  if ((!containerSizeValue || !raw.containerSizeUnit) && raw.containerSize) {
    const parsed = parseLegacyContainerSize(raw.containerSize);
    containerSizeValue = parsed.value;
    containerSizeUnit = parsed.unit;
  }

  return {
    id: raw.id ?? '',
    bottleId: raw.bottleId ?? '',
    beetleId: raw.beetleId ?? '',
    dateChecked: raw.dateChecked ?? '',
    weight: raw.weight ?? 0,
    instarStage: raw.instarStage ?? 'L1',
    substrateType: raw.substrateType ?? 'Flake Soil',
    containerSizeValue,
    containerSizeUnit,
    temperature: raw.temperature ?? 0,
    humidity: raw.humidity ?? 0,
    notes: raw.notes ?? '',
    photoUrl: raw.photoUrl ?? '',
    nextCheckDate: raw.nextCheckDate ?? '',
    createdAt: raw.createdAt ?? '',
  };
}

export function normalizeLarvalRecords(records: LegacyLarvalRecord[]): LarvalRecord[] {
  return records.map(normalizeLarvalRecord);
}
