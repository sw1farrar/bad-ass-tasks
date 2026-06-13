import { isLikelyArchiveTitle } from "@/lib/files/archiveTitle";
import type { ArchiveTitleContext } from "@/lib/files/archiveTitleRules";

const BOILERPLATE_SUBJECT_RE =
  /^(?:(?:re|fw|fwd):\s*)?(?:your\s+)?(?:receipt|order(?:\s+confirmation)?|purchase(?:\s+confirmation)?)$/i;

export function isBoilerplateEmailSubject(value: string | undefined | null): boolean {
  const trimmed = value?.trim();
  if (!trimmed) return false;
  return BOILERPLATE_SUBJECT_RE.test(trimmed);
}

function stripPollutedArchiveTitlePrefix(value: string): string {
  const trimmed = value.trim();
  if (!trimmed || !isLikelyArchiveTitle(trimmed)) return trimmed;
  const withoutDate = trimmed.replace(
    /^(?:(?:re|fw|fwd):\s*)?(?:your\s+)?(?:receipt|order(?:\s+confirmation)?|purchase(?:\s+confirmation)?)\s+20\d{2}-\d{2}-\d{2}(?:\s+.+)?$/i,
    "",
  );
  return withoutDate.trim();
}

/** Recover the original inbound email subject when note.title was polluted. */
export function resolveInboundEmailSubject(ctx: ArchiveTitleContext): string | undefined {
  const rawTitle = ctx.title?.trim();
  if (rawTitle && !isLikelyArchiveTitle(rawTitle)) {
    return rawTitle;
  }

  const plain = ctx.searchPlain?.trim();
  if (plain) {
    let candidate = plain;
    if (rawTitle && plain.toLowerCase().startsWith(rawTitle.toLowerCase())) {
      candidate = plain.slice(rawTitle.length).trim();
    }
    candidate = stripPollutedArchiveTitlePrefix(candidate);
    const firstLine = candidate.split(/\n/)[0]?.trim() ?? candidate;
    const firstSentence = firstLine.split(/(?<=[.!?])\s+/)[0]?.trim() ?? firstLine;
    if (
      firstSentence &&
      firstSentence.length >= 3 &&
      firstSentence.length <= 160 &&
      !isLikelyArchiveTitle(firstSentence)
    ) {
      return firstSentence;
    }
  }

  if (rawTitle && isBoilerplateEmailSubject(rawTitle)) {
    return rawTitle;
  }

  if (rawTitle && isLikelyArchiveTitle(rawTitle)) {
    return undefined;
  }

  return rawTitle;
}

/** Strip polluted archive titles from naming context before heuristic/AI runs. */
export function sanitizeArchiveTitleContext(ctx: ArchiveTitleContext): ArchiveTitleContext {
  const inboundSubject = resolveInboundEmailSubject(ctx);
  let searchPlain = ctx.searchPlain;

  if (
    inboundSubject &&
    typeof searchPlain === "string" &&
    searchPlain.toLowerCase().startsWith(inboundSubject.toLowerCase())
  ) {
    const rest = searchPlain.slice(inboundSubject.length).trim();
    if (rest) searchPlain = rest;
  }

  if (ctx.title && isLikelyArchiveTitle(ctx.title) && typeof searchPlain === "string") {
    const withoutArchivePrefix = searchPlain.replace(ctx.title, "").trim();
    if (withoutArchivePrefix) searchPlain = withoutArchivePrefix;
  }

  return {
    ...ctx,
    title: inboundSubject,
    searchPlain,
    searchDocument: undefined,
  };
}