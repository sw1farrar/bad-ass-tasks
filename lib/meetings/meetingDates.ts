/** Local calendar date as YYYY-MM-DD (not UTC — avoids evening timezone shifts). */
export function localDateInputValue(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Parse a date-input value to an ISO timestamp at local noon. */
export function parseLocalDateInput(value: string): string | null {
  if (!value.trim()) return null;
  const parsed = new Date(`${value}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}
