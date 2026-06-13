import type { ArchiveTitleParts } from "@/lib/files/archiveTitle";
import type { ArchiveTitleContext } from "@/lib/files/archiveTitleRules";
import { guaranteeArchiveTitle } from "@/lib/files/guaranteeArchiveTitle";
import { suggestArchiveTitleHeuristic } from "@/lib/files/suggestArchiveTitleHeuristic";
import { sanitizeArchiveTitleContext } from "@/lib/files/sanitizeArchiveTitleContext";

/** Client-safe naming (no server AI). Always runs finalization. */
export function suggestArchiveTitleLocal(rawCtx: ArchiveTitleContext): {
  title: string;
  parts: ArchiveTitleParts;
} {
  const ctx = sanitizeArchiveTitleContext(rawCtx);
  const heuristic = suggestArchiveTitleHeuristic(ctx);
  return guaranteeArchiveTitle(heuristic.parts, ctx);
}