/** Unfiled tasks (no folderId). */
export const TASKS_FOLDER_UNFILED = "none" as const;

/**
 * Folder filter selection.
 * - `"all"` or `[]` — no folder restriction
 * - `"none"` / token `"none"` — unfiled tasks
 * - folder id string(s) — match those folders
 * - multi-select uses a non-empty string[] (OR match)
 *
 * Legacy single values (`"none"` | folderId) are still accepted and normalized.
 */
export type TasksFolderFilterMode = "all" | "none" | string | string[];

/** Normalize any stored value to a multi-select token list. Empty = all folders. */
export function normalizeFolderFilter(
  filter: TasksFolderFilterMode | undefined | null,
): string[] {
  if (filter == null || filter === "all") return [];
  if (Array.isArray(filter)) {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const token of filter) {
      if (!token || token === "all" || seen.has(token)) continue;
      seen.add(token);
      out.push(token);
    }
    return out;
  }
  if (filter === "none") return [TASKS_FOLDER_UNFILED];
  return [filter];
}

export function isFolderFilterActive(
  filter: TasksFolderFilterMode | undefined | null,
): boolean {
  return normalizeFolderFilter(filter).length > 0;
}

/** Value to persist when selection is empty or cleared. */
export function folderFilterForStore(selected: string[]): "all" | string[] {
  return selected.length === 0 ? "all" : selected;
}

export function taskMatchesFolderFilter(
  task: { folderId?: string | null },
  selected: string[],
): boolean {
  if (selected.length === 0) return true;
  const isUnfiled = !task.folderId;
  return selected.some((token) => {
    if (token === TASKS_FOLDER_UNFILED) return isUnfiled;
    return task.folderId === token;
  });
}

/** Notebook workspace rows behave like unfiled for folder filtering. */
export function includeNotebookRowsForFolderFilter(selected: string[]): boolean {
  return selected.length === 0 || selected.includes(TASKS_FOLDER_UNFILED);
}

export function toggleFolderFilterToken(
  current: string[],
  token: string,
): string[] {
  if (current.includes(token)) {
    return current.filter((t) => t !== token);
  }
  return [...current, token];
}

export function folderFilterSummary(
  selected: string[],
  folders: Array<{ id: string; name: string }>,
): string {
  if (selected.length === 0) return "All folders";
  if (selected.length === 1) {
    const token = selected[0];
    if (token === TASKS_FOLDER_UNFILED) return "Unfiled";
    return folders.find((f) => f.id === token)?.name ?? "1 folder";
  }
  return `${selected.length} folders`;
}
