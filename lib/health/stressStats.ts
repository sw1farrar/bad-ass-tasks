import type { HealthReading } from "@/types";
import {
  clampStressScore,
  STRESS_ROLLING_WINDOW_DAYS,
} from "@/lib/health/stressLabels";

export type StressDailyPoint = {
  date: string;
  value: number;
};

export type StressRollingPoint = {
  date: string;
  raw: number;
  rolling: number;
};

export function localDateKey(input: string | Date): string {
  const d = typeof input === "string" ? new Date(input) : input;
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function shiftLocalDateKey(key: string, days: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(y, (m ?? 1) - 1, d ?? 1);
  date.setDate(date.getDate() + days);
  return localDateKey(date);
}

export function todayLocalDateKey(): string {
  return localDateKey(new Date());
}

export function stressReadings(readings: HealthReading[]): HealthReading[] {
  return readings.filter((r) => r.metricType === "stress");
}

/** Daily mean of stress logs. Missing days are omitted (never treated as 0). */
export function dailyStressMeans(readings: HealthReading[]): StressDailyPoint[] {
  const buckets = new Map<string, number[]>();
  for (const reading of stressReadings(readings)) {
    const key = localDateKey(reading.recordedAt);
    if (!key) continue;
    const list = buckets.get(key) ?? [];
    list.push(clampStressScore(reading.value));
    buckets.set(key, list);
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, values]) => ({
      date,
      value: values.reduce((sum, v) => sum + v, 0) / values.length,
    }));
}

export function filterDailyToRange(
  daily: StressDailyPoint[],
  rangeDays: number,
  endKey = todayLocalDateKey(),
): StressDailyPoint[] {
  const startKey = shiftLocalDateKey(endKey, -(rangeDays - 1));
  return daily.filter((p) => p.date >= startKey && p.date <= endKey);
}

/**
 * Rolling average of daily means. Window uses only days that have logs —
 * a skipped weekend does not pull the average toward 0.
 */
export function rollingStressAverage(
  daily: StressDailyPoint[],
  window = STRESS_ROLLING_WINDOW_DAYS,
): StressRollingPoint[] {
  return daily.map((point, index) => {
    const start = Math.max(0, index - (window - 1));
    const slice = daily.slice(start, index + 1);
    const rolling = slice.reduce((sum, p) => sum + p.value, 0) / slice.length;
    return { date: point.date, raw: point.value, rolling };
  });
}

export function meanInDateWindow(
  daily: StressDailyPoint[],
  startKey: string,
  endKey: string,
): number | null {
  const slice = daily.filter((p) => p.date >= startKey && p.date <= endKey);
  if (slice.length === 0) return null;
  return slice.reduce((sum, p) => sum + p.value, 0) / slice.length;
}

export function currentAndPriorWindowAverages(
  daily: StressDailyPoint[],
  window = STRESS_ROLLING_WINDOW_DAYS,
  endKey = todayLocalDateKey(),
): { current: number | null; prior: number | null; delta: number | null } {
  const currentStart = shiftLocalDateKey(endKey, -(window - 1));
  const priorEnd = shiftLocalDateKey(currentStart, -1);
  const priorStart = shiftLocalDateKey(priorEnd, -(window - 1));
  const current = meanInDateWindow(daily, currentStart, endKey);
  const prior = meanInDateWindow(daily, priorStart, priorEnd);
  return {
    current,
    prior,
    delta: current != null && prior != null ? current - prior : null,
  };
}
