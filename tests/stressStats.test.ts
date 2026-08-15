import { describe, expect, it } from "vitest";
import type { HealthReading } from "@/types";
import { clampStressScore, parseStressDrivers } from "@/lib/health/stressLabels";
import {
  currentAndPriorWindowAverages,
  dailyStressMeans,
  filterDailyToRange,
  localDateKey,
  rollingStressAverage,
  shiftLocalDateKey,
} from "@/lib/health/stressStats";
import { filterVisibleHealthReadings } from "@/lib/health/stressPrivacy";

function reading(partial: Partial<HealthReading> & { recordedAt: string; value: number }): HealthReading {
  return {
    id: partial.id ?? `r-${partial.recordedAt}-${partial.value}`,
    workspaceId: "ws-1",
    userId: partial.userId ?? "me",
    metricType: partial.metricType ?? "stress",
    value: partial.value,
    unit: "score",
    recordedAt: partial.recordedAt,
    note: partial.note ?? null,
    metadata: partial.metadata,
    createdAt: partial.recordedAt,
  };
}

describe("stressStats", () => {
  it("clamps scores to 1–10", () => {
    expect(clampStressScore(0)).toBe(1);
    expect(clampStressScore(11)).toBe(10);
    expect(clampStressScore(6.4)).toBe(6);
    expect(clampStressScore(6.6)).toBe(7);
  });

  it("averages multiple logs on the same local day", () => {
    const day = "2026-08-10T14:00:00";
    const later = "2026-08-10T20:00:00";
    const means = dailyStressMeans([
      reading({ recordedAt: day, value: 4 }),
      reading({ recordedAt: later, value: 8 }),
    ]);
    expect(means).toHaveLength(1);
    expect(means[0]?.date).toBe(localDateKey(day));
    expect(means[0]?.value).toBe(6);
  });

  it("omits missing days from the rolling window instead of treating them as 0", () => {
    const mon = "2026-08-10T09:00:00";
    const wed = "2026-08-12T09:00:00";
    const daily = dailyStressMeans([
      reading({ recordedAt: mon, value: 4 }),
      reading({ recordedAt: wed, value: 8 }),
    ]);
    const rolling = rollingStressAverage(daily, 7);
    expect(rolling).toHaveLength(2);
    expect(rolling[0]?.rolling).toBe(4);
    expect(rolling[1]?.rolling).toBe(6);
    expect(rolling[1]?.raw).toBe(8);
  });

  it("filters the chart range without inventing empty days", () => {
    const daily = dailyStressMeans([
      reading({ recordedAt: "2026-07-01T09:00:00", value: 9 }),
      reading({ recordedAt: "2026-08-12T09:00:00", value: 3 }),
    ]);
    const ranged = filterDailyToRange(daily, 7, localDateKey("2026-08-12T12:00:00"));
    expect(ranged.map((p) => p.value)).toEqual([3]);
  });

  it("compares the current 7-day window to the prior 7 days", () => {
    const end = "2026-08-14";
    const current = [0, 1, 2].map((offset) =>
      reading({
        recordedAt: `${shiftLocalDateKey(end, -offset)}T12:00:00`,
        value: 8,
      }),
    );
    const prior = [7, 8, 9].map((offset) =>
      reading({
        recordedAt: `${shiftLocalDateKey(end, -offset)}T12:00:00`,
        value: 4,
      }),
    );
    const daily = dailyStressMeans([...current, ...prior]);
    const { current: now, prior: before, delta } = currentAndPriorWindowAverages(daily, 7, end);
    expect(now).toBe(8);
    expect(before).toBe(4);
    expect(delta).toBe(4);
  });

  it("parses only known driver chips", () => {
    expect(parseStressDrivers({ drivers: ["work", "nope", "sleep"] })).toEqual(["work", "sleep"]);
    expect(parseStressDrivers({})).toEqual([]);
  });

  it("hides other members' stress readings", () => {
    const mine = reading({ userId: "me", recordedAt: "2026-08-12T09:00:00", value: 5 });
    const theirs = reading({ userId: "them", recordedAt: "2026-08-12T09:00:00", value: 9 });
    const weight = reading({
      userId: "them",
      metricType: "weight",
      recordedAt: "2026-08-12T09:00:00",
      value: 180,
    });
    const visible = filterVisibleHealthReadings([mine, theirs, weight], "me");
    expect(visible.map((r) => r.id)).toEqual([mine.id, weight.id]);
    expect(filterVisibleHealthReadings([theirs], null)).toEqual([]);
  });
});
