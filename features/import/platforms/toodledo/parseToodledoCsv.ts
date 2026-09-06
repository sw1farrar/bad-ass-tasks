import Papa from "papaparse";
import type { ImportKind, ToodledoImportPreview } from "@/features/import/types";
import { mapToodledoTask, type ToodledoCsvRow } from "./mapToodledoTask";

function detectKind(headers: string[], rows: ToodledoCsvRow[]): ImportKind {
  const hasCompletedHeader = headers.some((h) => h.trim().toUpperCase() === "COMPLETED");
  if (!hasCompletedHeader) return "current";
  const completedCount = rows.filter((r) => (r.COMPLETED ?? "").trim()).length;
  if (completedCount > 0 && completedCount >= rows.length * 0.5) return "completed";
  return "current";
}

export function parseToodledoCsv(
  csvText: string,
  _hint?: ImportKind,
): ToodledoImportPreview {
  const parsed = Papa.parse<ToodledoCsvRow>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.replace(/^\uFEFF/, "").trim().toUpperCase(),
  });

  const headers = parsed.meta.fields ?? [];
  const rawRows = (parsed.data ?? []).filter((row) => (row.TASK ?? "").trim());
  if (parsed.errors.some((err) => err.type === "Quotes")) {
    const first = parsed.errors.find((err) => err.type === "Quotes");
    throw new Error(first?.message ? `CSV parse error: ${first.message}` : "CSV parse error");
  }
  const detected = detectKind(headers, rawRows);
  // File shape always wins over a UI slot hint.
  const kind = detected;
  const tasks = rawRows
    .map((row) => mapToodledoTask(row, kind))
    .filter((t): t is NonNullable<typeof t> => !!t);

  const seen = new Map<string, number>();
  for (const task of tasks) {
    const n = (seen.get(task.fingerprint) ?? 0) + 1;
    seen.set(task.fingerprint, n);
    if (n > 1) {
      task.fingerprint = `${task.fingerprint}|${n}`;
    }
  }

  const folderSet = new Set<string>();
  const unmapped = new Set<string>();
  let recurringCount = 0;
  let notesCount = 0;
  for (const task of tasks) {
    if (task.folderName) folderSet.add(task.folderName);
    if (task.recurringRule) recurringCount += 1;
    if (task.description.trim()) notesCount += 1;
    if (task.unmappedRepeat) unmapped.add(task.unmappedRepeat);
  }

  return {
    kind,
    rowCount: tasks.length,
    recurringCount,
    notesCount,
    folderNames: [...folderSet].sort((a, b) => a.localeCompare(b)),
    unmappedRepeats: [...unmapped].sort((a, b) => a.localeCompare(b)),
    tasks,
  };
}
