/** Parsed archive title parts for the filing naming convention. */
export type ArchiveTitleParts = {
  /** Document subject, e.g. "bank statement", "1098-SA", "computer monitor receipt". */
  subject: string;
  /** YYYY-MM-DD */
  date: string;
  /** Issuer / institution, e.g. "Wells Fargo". Empty when unknown. */
  institution: string;
};

const ARCHIVE_TITLE_RE = /^(.+?)\s+(20\d{2}-\d{2}-\d{2})(?:\s+(.+))?$/i;

/** Remove zero-width and other invisible Unicode often copied from HTML emails. */
export function stripInvisibleUnicode(value: string): string {
  return value
    .replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF\u00AD]/g, "")
    .replace(/\u00a0/g, " ");
}

export function isLikelyArchiveTitle(value: string | undefined | null): boolean {
  const trimmed = stripInvisibleUnicode(value ?? "").trim();
  if (!trimmed) return false;
  return ARCHIVE_TITLE_RE.test(trimmed);
}

export function formatArchiveTitle(parts: ArchiveTitleParts): string {
  const subject = stripInvisibleUnicode(parts.subject).trim();
  const date = parts.date.trim();
  const institution = stripInvisibleUnicode(parts.institution).trim();
  return stripInvisibleUnicode(
    [subject, date, institution].filter(Boolean).join(" "),
  )
    .replace(/\s+/g, " ")
    .trim();
}

/** Normalize and validate YYYY-MM-DD; returns null if invalid. */
export function normalizeArchiveDate(value: string | undefined | null): string | null {
  if (!value?.trim()) return null;
  const trimmed = value.trim();
  const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const [, y, m, d] = iso;
    const month = Number(m);
    const day = Number(d);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) return `${y}-${m}-${d}`;
  }
  const compact = trimmed.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (compact) {
    const [, y, m, d] = compact;
    return normalizeArchiveDate(`${y}-${m}-${d}`);
  }
  const slash = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (slash) {
    const [, a, b, y] = slash;
    const month = Number(a);
    const day = Number(b);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${y}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }
  return null;
}

export function archiveDateFromIsoTimestamp(iso: string | undefined | null): string | null {
  if (!iso?.trim()) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function sanitizeArchiveSubject(value: string): string {
  return stripInvisibleUnicode(value)
    .replace(/\s+/g, " ")
    .replace(/[_]+/g, " ")
    .trim()
    .slice(0, 120);
}

export function sanitizeArchiveInstitution(value: string): string {
  const trimmed = stripInvisibleUnicode(value).replace(/\s+/g, " ").trim().slice(0, 80);
  if (!trimmed) return "";
  return trimmed
    .split(" ")
    .map((word) => {
      const upper = word.toUpperCase();
      if (/^\d{4}-SA$/.test(upper)) return upper;
      if (/^1098/.test(upper)) return upper;
      if (word.length <= 3 && word === word.toUpperCase()) return word;
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}