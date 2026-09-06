import type { Task } from "@/types";

const key = (workspaceId: string) => `bat-import-review:${workspaceId}`;

/** Shared across Tasks and Settings so cancel/resume keeps edits. */
export const importReviewDrafts = new Map<string, Task>();

export type ImportReviewSession = {
  resumeTaskId: string | null;
  startCount: number;
};

export function readImportReviewSession(workspaceId: string): ImportReviewSession {
  if (typeof sessionStorage === "undefined" || !workspaceId) {
    return { resumeTaskId: null, startCount: 0 };
  }
  try {
    const raw = sessionStorage.getItem(key(workspaceId));
    if (!raw) return { resumeTaskId: null, startCount: 0 };
    const parsed = JSON.parse(raw) as Partial<ImportReviewSession>;
    return {
      resumeTaskId: typeof parsed.resumeTaskId === "string" ? parsed.resumeTaskId : null,
      startCount: typeof parsed.startCount === "number" && parsed.startCount > 0 ? parsed.startCount : 0,
    };
  } catch {
    return { resumeTaskId: null, startCount: 0 };
  }
}

export function writeImportReviewSession(
  workspaceId: string,
  next: ImportReviewSession,
): void {
  if (typeof sessionStorage === "undefined" || !workspaceId) return;
  try {
    sessionStorage.setItem(key(workspaceId), JSON.stringify(next));
  } catch {
    // quota / private mode
  }
}

export function clearImportReviewSession(workspaceId: string): void {
  if (typeof sessionStorage === "undefined" || !workspaceId) return;
  try {
    sessionStorage.removeItem(key(workspaceId));
  } catch {
    // ignore
  }
}

export function bumpImportReviewStartCount(workspaceId: string, remaining: number): number {
  const session = readImportReviewSession(workspaceId);
  const startCount = remaining <= 0 ? 0 : Math.max(session.startCount, remaining);
  if (remaining <= 0) {
    clearImportReviewSession(workspaceId);
    return 0;
  }
  writeImportReviewSession(workspaceId, { ...session, startCount });
  return startCount;
}
