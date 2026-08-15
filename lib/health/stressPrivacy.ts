import type { HealthReading } from "@/types";

export function canSeeHealthReading(
  reading: HealthReading,
  currentUserId?: string | null,
): boolean {
  if (reading.metricType !== "stress") return true;
  return Boolean(currentUserId) && reading.userId === currentUserId;
}

export function filterVisibleHealthReadings(
  readings: HealthReading[],
  currentUserId?: string | null,
): HealthReading[] {
  return readings.filter((reading) => canSeeHealthReading(reading, currentUserId));
}
