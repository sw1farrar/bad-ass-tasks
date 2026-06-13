import {
  archiveDateFromIsoTimestamp,
  stripInvisibleUnicode,
  type ArchiveTitleParts,
} from "@/lib/files/archiveTitle";
import {
  classifyDocument,
  extractArchiveDate,
  isJunkMerchantName,
  isPaymentMethodInstitution,
  type ArchiveTitleContext,
  type DocumentKind,
} from "@/lib/files/archiveTitleRules";
import { combinedArchiveNamingText } from "@/lib/files/preprocessArchiveTitleContext";

export type ValidationIssue = {
  field: "subject" | "date" | "institution";
  message: string;
};

const BOILERPLATE_SUBJECTS = new Set([
  "your receipt",
  "receipt",
  "purchase receipt",
  "order receipt",
  "your order",
  "order confirmation",
  "purchase confirmation",
  "your purchase",
  "order",
  "purchase",
]);

const PRONOUN_INSTITUTIONS = new Set([
  "your",
  "you",
  "the",
  "our",
  "my",
  "a",
  "an",
  "this",
  "that",
]);

function extractDocumentDateWithoutUploadFallback(
  text: string,
  ctx: ArchiveTitleContext,
): string | null {
  const periodMonthYear = text.match(
    /\b(?:for|period|statement|month of)\s+(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{4})\b/i,
  );
  if (periodMonthYear) {
    const months: Record<string, number> = {
      january: 1,
      february: 2,
      march: 3,
      april: 4,
      may: 5,
      june: 6,
      july: 7,
      august: 8,
      september: 9,
      october: 10,
      november: 11,
      december: 12,
    };
    const month = months[periodMonthYear[1].toLowerCase()];
    const year = Number(periodMonthYear[2]);
    if (month >= 1 && month <= 12) {
      const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
      return `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    }
  }

  const labeled = text.match(
    /\b(?:order date|purchase date|transaction date|invoice date|date)\s*[:\s]+\s*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}-\d{2}-\d{2})/i,
  );
  if (labeled?.[1]) {
    const fromRules = extractArchiveDate(labeled[0], ctx);
    if (fromRules) return fromRules;
  }

  const isoMatches = text.match(/\b(20\d{2}-\d{2}-\d{2})\b/g) ?? [];
  for (const candidate of isoMatches) {
    const normalized = extractArchiveDate(candidate, ctx);
    if (normalized) return normalized;
  }

  const slashMatches = text.match(/\b(\d{1,2}[/-]\d{1,2}[/-]20\d{2})\b/g) ?? [];
  for (const candidate of slashMatches) {
    const normalized = extractArchiveDate(candidate, ctx);
    if (normalized) return normalized;
  }

  return null;
}

export function validateArchiveTitleParts(
  parts: ArchiveTitleParts,
  ctx: ArchiveTitleContext,
  kind?: DocumentKind,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const text = combinedArchiveNamingText(ctx);
  const resolvedKind = kind ?? classifyDocument(text, ctx);

  const subjectLower = stripInvisibleUnicode(parts.subject).toLowerCase().trim();
  const subjectCollapsed = subjectLower.replace(/\s+/g, "");
  if (
    BOILERPLATE_SUBJECTS.has(subjectLower) ||
    /^your\s+(receipt|order|purchase)\b/i.test(parts.subject) ||
    /^(?:your)?(?:receipt|order|purchase)$/.test(subjectCollapsed)
  ) {
    issues.push({
      field: "subject",
      message:
        "Subject anchors on email boilerplate. For receipts, name the highest-priced line item plus ' receipt'.",
    });
  }

  if (resolvedKind === "receipt") {
    const bare = subjectLower.replace(/\s+receipt$/, "").trim();
    if (!bare || ["your", "purchase", "order", "receipt"].includes(bare)) {
      issues.push({
        field: "subject",
        message:
          "Receipt subject must describe the highest-priced purchased item, then end with ' receipt'.",
      });
    }
    if (!/\breceipt$/i.test(parts.subject) && bare.length > 0) {
      issues.push({
        field: "subject",
        message: "Receipt subjects should end with ' receipt'.",
      });
    }
  }

  const institutionLower = stripInvisibleUnicode(parts.institution).toLowerCase().trim();
  if (institutionLower && isJunkMerchantName(institutionLower)) {
    issues.push({
      field: "institution",
      message:
        'Institution must be the seller or issuer (e.g. "Micro Center"), not generic email copy like "Us!".',
    });
  }

  if (institutionLower && PRONOUN_INSTITUTIONS.has(institutionLower)) {
    issues.push({
      field: "institution",
      message:
        'Institution must be the seller or issuer (e.g. "Micro Center"), not a pronoun from the email subject.',
    });
  }

  if (resolvedKind === "receipt" && parts.institution && isPaymentMethodInstitution(parts.institution)) {
    issues.push({
      field: "institution",
      message: "On receipts, institution must be the merchant — not the payment card or bank.",
    });
  }

  const uploadDate = archiveDateFromIsoTimestamp(ctx.createdAt);
  const documentDate = extractDocumentDateWithoutUploadFallback(text, ctx);
  if (uploadDate && documentDate && parts.date === uploadDate && documentDate !== uploadDate) {
    issues.push({
      field: "date",
      message: `A document date (${documentDate}) exists in the content; do not use the upload date (${uploadDate}).`,
    });
  }

  return issues;
}

export function buildArchiveTitleRetryPrompt(
  issues: ValidationIssue[],
  previousOutput: ArchiveTitleParts,
): string {
  const lines = [
    "Your previous answer failed validation. Fix ONLY the output fields using the evidence already provided.",
    "",
    "Previous output:",
    JSON.stringify(previousOutput),
    "",
    "Validation failures:",
    ...issues.map((i) => `- ${i.field}: ${i.message}`),
    "",
    "Return the same JSON shape (analysis + output). Correct the mistakes in output.",
  ];
  return lines.join("\n");
}