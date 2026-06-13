import {
  stripInvisibleUnicode,
  type ArchiveTitleParts,
} from "@/lib/files/archiveTitle";
import {
  isJunkMerchantName,
  type ArchiveTitleContext,
} from "@/lib/files/archiveTitleRules";
import { finalizeArchiveTitle } from "@/lib/files/finalizeArchiveTitle";
import { suggestArchiveTitleHeuristic } from "@/lib/files/suggestArchiveTitleHeuristic";
import { validateArchiveTitleParts } from "@/lib/files/validateArchiveTitle";

const BOILERPLATE_SUBJECT_RE =
  /^(?:your\s+)?(?:receipt|order(?:\s+confirmation)?|purchase(?:\s+confirmation)?)$/i;

function normalizedBoilerplateSubject(subject: string): string {
  return stripInvisibleUnicode(subject).replace(/\s+/g, " ").trim().toLowerCase();
}

function isBoilerplateArchiveSubject(subject: string): boolean {
  const normalized = normalizedBoilerplateSubject(subject);
  if (!normalized) return false;
  if (BOILERPLATE_SUBJECT_RE.test(normalized) || normalized === "your receipt") {
    return true;
  }
  return /^(?:your)?(?:receipt|order|purchase)$/.test(normalized.replace(/\s+/g, ""));
}

function parseFormattedArchiveTitle(title: string): ArchiveTitleParts | null {
  const normalized = stripInvisibleUnicode(title).replace(/\s+/g, " ").trim();
  const match = normalized.match(/^(.+?)\s+(20\d{2}-\d{2}-\d{2})(?:\s+(.+))?$/i);
  if (!match) return null;
  return {
    subject: match[1].trim(),
    date: match[2],
    institution: (match[3] ?? "").trim(),
  };
}

export function isKnownBadArchiveTitle(title: string): boolean {
  const parsed = parseFormattedArchiveTitle(title);
  if (!parsed) return false;

  if (isBoilerplateArchiveSubject(parsed.subject)) {
    return true;
  }

  if (parsed.institution && isJunkMerchantName(parsed.institution)) {
    return true;
  }

  return false;
}

function cleanFormattedTitle(result: { title: string; parts: ArchiveTitleParts }): {
  title: string;
  parts: ArchiveTitleParts;
} {
  return {
    title: stripInvisibleUnicode(result.title).replace(/\s+/g, " ").trim(),
    parts: {
      subject: stripInvisibleUnicode(result.parts.subject).replace(/\s+/g, " ").trim(),
      date: result.parts.date.trim(),
      institution: stripInvisibleUnicode(result.parts.institution).replace(/\s+/g, " ").trim(),
    },
  };
}

export function guaranteeArchiveTitle(
  parts: ArchiveTitleParts,
  ctx: ArchiveTitleContext,
): { title: string; parts: ArchiveTitleParts } {
  const heuristic = suggestArchiveTitleHeuristic(ctx);
  const heuristicFinal = cleanFormattedTitle(
    finalizeArchiveTitle(heuristic.parts, ctx, heuristic.parts),
  );

  const finalized = cleanFormattedTitle(
    finalizeArchiveTitle(parts, ctx, heuristic.parts),
  );
  const issues = validateArchiveTitleParts(finalized.parts, ctx);

  if (issues.length === 0 && !isKnownBadArchiveTitle(finalized.title)) {
    return finalized;
  }

  if (!isKnownBadArchiveTitle(heuristicFinal.title)) {
    return heuristicFinal;
  }

  return heuristicFinal;
}