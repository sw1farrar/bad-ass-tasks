import { formatArchiveTitle, type ArchiveTitleParts } from "@/lib/files/archiveTitle";
import {
  extractArchiveDate,
  extractInstitutionForKind,
  extractSubjectForKind,
  type ArchiveTitleContext,
} from "@/lib/files/archiveTitleRules";
import { combinedArchiveNamingText } from "@/lib/files/preprocessArchiveTitleContext";
import { resolveArchiveDocumentKind } from "@/lib/files/finalizeArchiveTitle";

export type { ArchiveTitleContext };

export function suggestArchiveTitleHeuristic(ctx: ArchiveTitleContext): {
  title: string;
  parts: ArchiveTitleParts;
} {
  const text = combinedArchiveNamingText(ctx);
  const kind = resolveArchiveDocumentKind(ctx);
  const parts: ArchiveTitleParts = {
    subject: extractSubjectForKind(kind, text, ctx),
    date: extractArchiveDate(text, ctx),
    institution: extractInstitutionForKind(kind, text, ctx),
  };
  return { title: formatArchiveTitle(parts), parts };
}