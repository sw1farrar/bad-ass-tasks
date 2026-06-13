import {
  formatArchiveTitle,
  normalizeArchiveDate,
  sanitizeArchiveInstitution,
  sanitizeArchiveSubject,
  type ArchiveTitleParts,
} from "@/lib/files/archiveTitle";
import {
  classifyDocument,
  sanitizeAiInstitution,
  sanitizeAiSubject,
  type ArchiveTitleContext,
} from "@/lib/files/archiveTitleRules";
import { combinedArchiveNamingText } from "@/lib/files/preprocessArchiveTitleContext";
import { validateArchiveTitleParts } from "@/lib/files/validateArchiveTitle";

export function resolveArchiveDocumentKind(ctx: ArchiveTitleContext): ReturnType<typeof classifyDocument> {
  const text = combinedArchiveNamingText(ctx);
  const kind = classifyDocument(text, ctx);
  if (kind !== "other") return kind;
  if (ctx.recordType === "receipt") return "receipt";
  return kind;
}

/** Last-line defense: sanitize, validate, and merge heuristic fields before returning. */
export function finalizeArchiveTitleParts(
  parts: ArchiveTitleParts,
  ctx: ArchiveTitleContext,
  heuristic: ArchiveTitleParts,
): ArchiveTitleParts {
  const text = combinedArchiveNamingText(ctx);
  const kind = resolveArchiveDocumentKind(ctx);

  let finalized: ArchiveTitleParts = {
    subject: sanitizeAiSubject(sanitizeArchiveSubject(parts.subject), kind, text, ctx),
    date: normalizeArchiveDate(parts.date) ?? heuristic.date,
    institution: sanitizeAiInstitution(
      sanitizeArchiveInstitution(parts.institution),
      kind,
      text,
      ctx,
    ),
  };

  let issues = validateArchiveTitleParts(finalized, ctx, kind);
  if (issues.length) {
    finalized = {
      subject: issues.some((i) => i.field === "subject") ? heuristic.subject : finalized.subject,
      date: issues.some((i) => i.field === "date") ? heuristic.date : finalized.date,
      institution: issues.some((i) => i.field === "institution")
        ? heuristic.institution
        : finalized.institution,
    };
    finalized = {
      subject: sanitizeAiSubject(finalized.subject, kind, text, ctx),
      date: finalized.date,
      institution: sanitizeAiInstitution(finalized.institution, kind, text, ctx),
    };
    issues = validateArchiveTitleParts(finalized, ctx, kind);
  }

  if (issues.length) {
    return {
      subject: sanitizeAiSubject(heuristic.subject, kind, text, ctx),
      date: heuristic.date,
      institution: sanitizeAiInstitution(heuristic.institution, kind, text, ctx),
    };
  }

  return finalized;
}

export function finalizeArchiveTitle(
  parts: ArchiveTitleParts,
  ctx: ArchiveTitleContext,
  heuristic: ArchiveTitleParts,
): { title: string; parts: ArchiveTitleParts } {
  const finalized = finalizeArchiveTitleParts(parts, ctx, heuristic);
  return { title: formatArchiveTitle(finalized), parts: finalized };
}