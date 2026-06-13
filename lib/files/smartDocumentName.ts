import { stripInvisibleUnicode } from "@/lib/files/archiveTitle";
import { isJunkMerchantName } from "@/lib/files/archiveTitleRules";

import type { ReceiptLineItemInput } from "@/lib/files/receiptLineItems";

export type SmartDocumentNameResult = {
  filename: string;
  memo: string;
  tags: string[];
  reasoning: string;
  source: "ai";
  receiptLineItems?: ReceiptLineItemInput[];
  isReceipt?: boolean;
};

/** Light cleanup for AI-generated filing memos. */
export function sanitizeSmartMemo(value: string): string {
  return stripInvisibleUnicode(value)
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500);
}

/** Split on filename segment separators only — not hyphens inside ISO dates. */
export function splitSmartFilenameSegments(filename: string): string[] {
  return stripInvisibleUnicode(filename)
    .split(/\s+-\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

const BOILERPLATE_LEAD_RE =
  /^(?:your\s+)?(?:receipt|order(?:\s+confirmation)?|purchase(?:\s+confirmation)?)$/i;

const GENERIC_ITEM_LEADS = new Set([
  "purchase",
  "item",
  "product",
  "order",
  "merchandise",
  "document",
  "receipt",
]);

/** Literal first segments that are correct for non-receipt document types. */
const LITERAL_SUBJECT_LEADS = new Set([
  "bank statement",
  "credit card statement",
  "invoice",
  "pay stub",
  "contract",
]);

/** IRS / tax form identifiers — first segment when document_type is tax_form. */
const TAX_FORM_LEAD_RE =
  /^(?:\d{4}(?:-[A-Z]{1,3})?|W-\d[A-Z]?|1040|5498(?:-[A-Z]{1,3})?|Schedule\s+[A-Z0-9]+)$/i;

function normalizeLeadSegment(segment: string): string {
  return stripInvisibleUnicode(segment).replace(/\s+/g, " ").trim().toLowerCase();
}

export function isTaxFormLeadSegment(segment: string): boolean {
  const trimmed = stripInvisibleUnicode(segment).replace(/\s+/g, " ").trim();
  if (!trimmed) return false;
  if (TAX_FORM_LEAD_RE.test(trimmed)) return true;
  // "1098 SA" before model normalizes to hyphenated form
  return /^109\d(?:\s+[A-Z]{1,3})?$/i.test(trimmed) || /^W\s*2/i.test(trimmed);
}

export function isLiteralSubjectLead(segment: string): boolean {
  return LITERAL_SUBJECT_LEADS.has(normalizeLeadSegment(segment));
}

function isTypedBillOrInsuranceLead(segment: string): boolean {
  const normalized = normalizeLeadSegment(segment);
  if (normalized === "bill" || normalized === "statement") return false;
  return /\bbill$/i.test(segment) || /\binsurance$/i.test(segment);
}

function isValidNonReceiptLead(segment: string): boolean {
  return (
    isLiteralSubjectLead(segment) ||
    isTaxFormLeadSegment(segment) ||
    isTypedBillOrInsuranceLead(segment)
  );
}

const ISO_DATE_RE = /20\d{2}-\d{2}-\d{2}/g;

/** Hyphenated tokens that must not be split into filename segments (tax form IDs, etc.). */
const HYPHENATED_TOKEN_RE =
  /\b(?:\d{4}-[A-Z]{1,3}|W-\d[A-Z]?|5498-[A-Z]{1,3}|Schedule\s+[A-Z0-9]+)\b/gi;

function protectTokens(value: string): { text: string; tokens: string[] } {
  const tokens: string[] = [];
  const stash = (match: string) => {
    const token = `__PROTECTED_${tokens.length}__`;
    tokens.push(match);
    return token;
  };

  let text = value.replace(ISO_DATE_RE, stash);
  text = text.replace(HYPHENATED_TOKEN_RE, stash);
  return { text, tokens };
}

function restoreTokens(value: string, tokens: string[]): string {
  let restored = value;
  tokens.forEach((token, index) => {
    restored = restored.replace(`__PROTECTED_${index}__`, token);
  });
  return restored;
}

/** Light cleanup: safe characters only, normalized separators. Does not rewrite content. */
export function sanitizeSmartFilename(value: string): string {
  const stripped = stripInvisibleUnicode(value)
    .replace(/\s*[—–]\s*/g, " - ")
    .replace(/[^\w\s\-]/g, " ")
    .replace(/_/g, "_")
    .replace(/\s+/g, " ")
    .trim();

  const { text: protectedText, tokens } = protectTokens(stripped);
  const normalized = restoreTokens(
    protectedText
      .replace(/\s*-\s*/g, " - ")
      .replace(/(?:\s*-\s*){2,}/g, " - ")
      .trim(),
    tokens,
  );

  return normalized.slice(0, 160);
}

export function isBoilerplateLeadSegment(segment: string): boolean {
  const normalized = stripInvisibleUnicode(segment).replace(/\s+/g, " ").trim().toLowerCase();
  if (!normalized) return true;
  if (BOILERPLATE_LEAD_RE.test(normalized)) return true;
  return /^(?:your)?(?:receipt|order|purchase)$/.test(normalized.replace(/\s+/g, ""));
}

/** Why a filename failed sanity checks — used to guide AI retry, not to rewrite locally. */
export function getSmartFilenameRejectionReason(filename: string): string | null {
  const cleaned = sanitizeSmartFilename(filename);
  if (!cleaned || cleaned.length < 3) {
    return "Filename was empty or too short.";
  }

  const segments = splitSmartFilenameSegments(cleaned);
  if (!segments.length) {
    return "Filename had no recognizable segments.";
  }

  const lead = segments[0];
  if (isBoilerplateLeadSegment(lead)) {
    return `First segment "${lead}" is email subject boilerplate. Use the actual product or document description from the body.`;
  }

  const taxFormLead = /^tax\s+(document|form)$/i.test(lead);
  if (taxFormLead) {
    return `First segment "${lead}" is too generic for a tax document. Use the specific form type as the subject (e.g. 1098-SA, W-2, 1099-NEC).`;
  }

  const normalizedLead = normalizeLeadSegment(lead);
  if (normalizedLead === "statement" || normalizedLead === "bill") {
    return `First segment "${lead}" is too vague. Use Bank Statement, Credit Card Statement, Electric Bill, Medical Bill, etc.`;
  }

  if (!isValidNonReceiptLead(lead) && GENERIC_ITEM_LEADS.has(normalizedLead)) {
    return `First segment "${lead}" is too generic. For receipts use an interpreted item (e.g. Computer Monitor). For tax forms use the form type (e.g. 1098-SA). For statements use Bank Statement or Credit Card Statement.`;
  }

  const tail = segments[segments.length - 1] ?? "";
  if (segments.length >= 2 && tail && isJunkMerchantName(tail)) {
    return `Last segment "${tail}" is not a real vendor — find the store brand from the receipt body (e.g. Micro Center), not email copy like "Us" or "Your".`;
  }
  if (segments.length >= 2 && /^(your|you|us|we)$/i.test(tail.replace(/[!.,]+$/g, ""))) {
    return `Last segment "${tail}" is a pronoun from marketing copy, not a merchant name.`;
  }
  if (tail.length > 35 && /\d{1,5}\s+\w+/.test(tail)) {
    return `Last segment "${tail}" looks like a street address. Use the store brand only (e.g. Micro Center), not the full location.`;
  }
  if (/^your receipt\b/i.test(cleaned)) {
    return "Filename anchors on the email subject instead of document content.";
  }

  return null;
}

export function isKnownBadSmartFilename(filename: string): boolean {
  return getSmartFilenameRejectionReason(filename) !== null;
}