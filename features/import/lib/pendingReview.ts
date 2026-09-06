export function isPendingImportReview(task: {
  importStatus?: string | null;
}): boolean {
  return task.importStatus === "pending_review";
}
