import type { Beetle, GrowthEntry } from '@/types';

export type StatTrend = { value: number; label: string };

function parseDate(dateStr: string): Date | null {
  const d = new Date(dateStr);
  return Number.isNaN(d.getTime()) ? null : d;
}

function monthRange(offsetMonths: number, ref = new Date()) {
  const start = new Date(ref.getFullYear(), ref.getMonth() + offsetMonths, 1);
  const end = new Date(ref.getFullYear(), ref.getMonth() + offsetMonths + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

function countInRange<T>(items: T[], getDate: (item: T) => string, start: Date, end: Date): number {
  return items.filter((item) => {
    const d = parseDate(getDate(item));
    return d !== null && d >= start && d <= end;
  }).length;
}

/** Month-over-month % change; null when there is no baseline to compare. */
export function calcMonthOverMonthTrend(current: number, previous: number): StatTrend | null {
  if (current === 0 && previous === 0) return null;
  if (previous === 0) return null;

  const pct = Math.round(((current - previous) / previous) * 100);
  return { value: pct, label: 'vs last month' };
}

/** New beetles added this month vs last month. */
export function beetleCountTrend(beetles: Beetle[]): StatTrend | null {
  if (beetles.length === 0) return null;

  const thisMonth = monthRange(0);
  const lastMonth = monthRange(-1);
  const current = countInRange(beetles, (b) => b.createdAt, thisMonth.start, thisMonth.end);
  const previous = countInRange(beetles, (b) => b.createdAt, lastMonth.start, lastMonth.end);

  return calcMonthOverMonthTrend(current, previous);
}

/** Growth log activity this month vs last month. */
export function larvalActivityTrend(beetles: Beetle[], growthEntries: GrowthEntry[]): StatTrend | null {
  const activeLarvae = beetles.filter((b) => b.status === 'larva').length;
  if (activeLarvae === 0 && growthEntries.length === 0) return null;

  const thisMonth = monthRange(0);
  const lastMonth = monthRange(-1);
  const entryDate = (e: GrowthEntry) => e.date || e.createdAt;
  const current = countInRange(growthEntries, entryDate, thisMonth.start, thisMonth.end);
  const previous = countInRange(growthEntries, entryDate, lastMonth.start, lastMonth.end);

  const trend = calcMonthOverMonthTrend(current, previous);
  if (!trend) return null;

  return { value: trend.value, label: 'growth logs' };
}
