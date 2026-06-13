import {
  archiveDateFromIsoTimestamp,
  isLikelyArchiveTitle,
  normalizeArchiveDate,
  sanitizeArchiveInstitution,
  sanitizeArchiveSubject,
  stripInvisibleUnicode,
} from "@/lib/files/archiveTitle";

export type ArchiveTitleContext = {
  title?: string;
  searchPlain?: string | null;
  /** Archived inbound HTML — often richer than searchPlain. */
  emailHtml?: string | null;
  /** TipTap JSON string or plain note body. */
  noteContent?: string | null;
  /** Denormalized search blob (body + attachment text). */
  searchDocument?: string | null;
  memo?: string | null;
  recordType?: string;
  createdAt?: string;
  attachmentFileNames?: string[];
  attachmentTexts?: string[];
};

export type DocumentKind =
  | "tax_form"
  | "bank_statement"
  | "receipt"
  | "invoice"
  | "bill"
  | "pay_stub"
  | "insurance"
  | "contract"
  | "other";

/** Banks/card networks used as payment method — not the merchant on a receipt. */
export const PAYMENT_METHOD_INSTITUTIONS = new Set(
  [
    "Chase",
    "Bank of America",
    "Wells Fargo",
    "Citibank",
    "Capital One",
    "American Express",
    "Amex",
    "Discover",
    "Visa",
    "Mastercard",
    "MasterCard",
    "PayPal",
    "Venmo",
    "Apple Pay",
    "Google Pay",
    "Samsung Pay",
    "Zelle",
    "US Bank",
    "PNC",
    "TD Bank",
    "Ally Bank",
    "Synchrony",
    "Barclays",
  ].map((s) => s.toLowerCase()),
);

/** Issuers for statements/tax — valid institution when document is from them. */
export const FINANCIAL_INSTITUTIONS = [
  "Wells Fargo",
  "Chase",
  "Bank of America",
  "Citibank",
  "Capital One",
  "American Express",
  "Discover",
  "US Bank",
  "PNC",
  "TD Bank",
  "Ally Bank",
  "Fidelity",
  "Vanguard",
  "Charles Schwab",
  "IRS",
  "PayPal",
  "Venmo",
  "Amazon",
  "Apple",
  "Google",
  "Microsoft",
  "AT&T",
  "Verizon",
  "Comcast",
  "State Farm",
  "Geico",
  "Progressive",
  "Micro Center",
  "Best Buy",
  "Target",
  "Walmart",
  "Costco",
  "Home Depot",
  "Lowe's",
  "Staples",
  "Office Depot",
];

const TAX_FORM_PATTERNS: Array<{ pattern: RegExp; subject: string }> = [
  { pattern: /\b1098[\s-]?sa\b/i, subject: "1098-SA" },
  { pattern: /\b1098[\s-]?e\b/i, subject: "1098-E" },
  { pattern: /\b1098[\s-]?t\b/i, subject: "1098-T" },
  { pattern: /\b1099[\s-]?nec\b/i, subject: "1099-NEC" },
  { pattern: /\b1099[\s-]?int\b/i, subject: "1099-INT" },
  { pattern: /\b1099[\s-]?div\b/i, subject: "1099-DIV" },
  { pattern: /\bw-?2\b/i, subject: "W-2" },
  { pattern: /\bw-?9\b/i, subject: "W-9" },
];

export function combinedArchiveText(ctx: ArchiveTitleContext): string {
  return [
    ctx.title,
    ctx.memo,
    ctx.searchPlain,
    ...(ctx.attachmentFileNames ?? []),
    ...(ctx.attachmentTexts ?? []),
  ]
    .filter(Boolean)
    .join("\n")
    .replace(/\s+/g, " ")
    .trim();
}

export function classifyDocument(text: string, ctx: ArchiveTitleContext): DocumentKind {
  const lower = text.toLowerCase();
  const title = ctx.title?.trim() ?? "";
  const scan = `${title}\n${text}`;

  for (const { pattern } of TAX_FORM_PATTERNS) {
    if (pattern.test(scan)) return "tax_form";
  }

  if (/\bbank statement\b/i.test(scan) || /\bchecking account statement\b/i.test(scan)) {
    return "bank_statement";
  }

  if (
    /\b(order confirmation|purchase confirmation|your order|order receipt|sales receipt|payment receipt|order details|order summary)\b/i.test(
      scan,
    ) ||
    /\breceipt\b/i.test(scan) ||
    /\bthank you for (?:your )?(?:purchase|order|shopping)\b/i.test(scan) ||
    /\b(?:item|product|sku)\s*(?:#|:)/i.test(scan) ||
    ctx.recordType === "receipt"
  ) {
    return "receipt";
  }

  if (/\bpay\s*stub\b/i.test(text)) return "pay_stub";
  if (/\binsurance\b/i.test(text) && /\b(policy|premium|claim)\b/i.test(text)) return "insurance";
  if (/\bcontract\b/i.test(text) || /\bagreement\b/i.test(text)) return "contract";
  if (/\binvoice\b/i.test(text)) return "invoice";
  if (/\bbill\b/i.test(text) || /\bamount due\b/i.test(text)) return "bill";

  if (/\bstatement\b/i.test(text) && /\b(account|balance|deposit|withdrawal)\b/i.test(lower)) {
    return "bank_statement";
  }

  return "other";
}

function domainToBrand(domain: string): string | null {
  const host = domain.toLowerCase().replace(/^www\./, "");
  const base = host.split(".")[0];
  if (!base || base.length < 3) return null;

  const known: Record<string, string> = {
    microcenter: "Micro Center",
    bestbuy: "Best Buy",
    homedepot: "Home Depot",
    lowes: "Lowe's",
    officedepot: "Office Depot",
    newegg: "Newegg",
    bhphoto: "B&H Photo",
    amazon: "Amazon",
    walmart: "Walmart",
    target: "Target",
    costco: "Costco",
    apple: "Apple",
    microsoft: "Microsoft",
    google: "Google",
    staples: "Staples",
  };

  if (known[base]) return known[base];

  if (base.includes("-")) {
    return base
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  }

  if (/[a-z][A-Z]/.test(base)) return base;

  const spaced = base.replace(/([a-z])([A-Z])/g, "$1 $2");
  if (spaced !== base) return spaced;

  return base.charAt(0).toUpperCase() + base.slice(1);
}

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

const JUNK_MERCHANT_TOKENS = new Set([
  "us",
  "we",
  "me",
  "them",
  "him",
  "her",
  "team",
  "store",
  "shop",
  "customer",
  "customers",
  "online",
  "support",
  "sales",
  "info",
  "noreply",
  "receipt",
  "order",
  "purchase",
]);

export function isJunkMerchantName(name: string): boolean {
  const normalized = stripInvisibleUnicode(name)
    .replace(/[!.,;:?]+$/g, "")
    .trim()
    .toLowerCase();
  if (!normalized || normalized.length < 3) return true;
  if (PRONOUN_INSTITUTIONS.has(normalized)) return true;
  if (JUNK_MERCHANT_TOKENS.has(normalized)) return true;
  if (/^(us|we|me|the|your|our)$/i.test(normalized)) return true;
  return false;
}

export function isPaymentMethodInstitution(name: string): boolean {
  const normalized = name.trim().toLowerCase();
  if (!normalized) return false;
  if (PAYMENT_METHOD_INSTITUTIONS.has(normalized)) return true;
  return [...PAYMENT_METHOD_INSTITUTIONS].some(
    (p) => normalized.includes(p) || p.includes(normalized),
  );
}

/** Collapse "Micro Center Tustin 1100 E Edinger Ave" → "Micro Center". */
export function compactMerchantName(raw: string): string {
  const trimmed = stripInvisibleUnicode(raw).replace(/\s+/g, " ").trim();
  if (!trimmed) return "";

  const sortedBrands = [...FINANCIAL_INSTITUTIONS].sort((a, b) => b.length - a.length);
  for (const brand of sortedBrands) {
    if (trimmed.toLowerCase().includes(brand.toLowerCase())) {
      return brand;
    }
  }

  let compact = trimmed
    .replace(
      /\b\d{1,6}\s+(?:[NSEW]\.?\s+)?[\w\s.]{1,30}\s+(?:Ave|Avenue|St|Street|Rd|Road|Blvd|Boulevard|Dr|Drive|Way|Ln|Lane)\b\.?/gi,
      "",
    )
    .replace(/\s+/g, " ")
    .trim();

  compact = compact
    .replace(/\s+[A-Z][a-z]+(?:\s+[A-Z]{2})?(?:\s+\d{5}(?:-\d{4})?)?$/, "")
    .trim();

  const words = compact.split(/\s+/);
  if (words.length > 4) {
    compact = words.slice(0, 3).join(" ");
  }

  return compact || trimmed.split(/\s+/).slice(0, 2).join(" ");
}

function cleanMerchantName(raw: string): string {
  return sanitizeArchiveInstitution(
    compactMerchantName(raw)
      .replace(/\b(inc|llc|ltd|corp)\.?$/i, "")
      .replace(/[®™]/g, "")
      .replace(/[.,;:!?]+$/g, "")
      .trim(),
  );
}

function normalizeReceiptProduct(raw: string): string | null {
  let cleaned = raw
    .replace(/\b(qty|quantity|each|total|subtotal|tax|shipping|sku)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  if (cleaned.length < 4) return null;
  if (/^(chase|visa|mastercard|amex|paypal|payment)$/i.test(cleaned)) return null;

  const words = cleaned.split(" ");
  if (words.length >= 6) {
    const half = Math.floor(words.length / 2);
    const firstHalf = words.slice(0, half).join(" ");
    const secondHalf = words.slice(half).join(" ");
    if (firstHalf.toLowerCase() === secondHalf.toLowerCase()) {
      cleaned = firstHalf;
    }
  }

  cleaned = cleaned.split(/\s{2,}|\s+\$/)[0]?.trim() ?? cleaned;
  if (cleaned.length > 60) {
    cleaned = cleaned.slice(0, 60).replace(/\s+\S*$/, "").trim();
  }

  return sanitizeArchiveSubject(cleaned.toLowerCase());
}

const FEE_LINE_RE =
  /\b(subtotal|sales tax|tax|shipping|delivery|handling|tip|gratuity|fee|total|amount due|balance due|order total)\b/i;

function lineItemAmount(line: string): number {
  const match = line.match(/(?:\$|USD\s*)?([\d,]+\.\d{2})\b/i);
  return match ? Number(match[1].replace(/,/g, "")) : 0;
}

function lineItemDescription(line: string): string {
  return line
    .replace(/(?:\$|USD\s*)[\d,]+\.\d{2}\b/gi, "")
    .replace(/(?:\$|USD\s*)[\d,]+\.\d{2}$/i, "")
    .trim();
}

/** Highest-priced purchasable line item from receipt-like text. */
export function extractTopReceiptLineItem(text: string): string | null {
  const candidates: Array<{ description: string; amount: number }> = [];

  const push = (description: string, amount: number) => {
    const normalized = normalizeReceiptProduct(description);
    if (!normalized || amount <= 0) return;
    candidates.push({ description: normalized, amount });
  };

  const lines = text.split(/\n/).map((line) => line.trim()).filter(Boolean);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const amountOnLine = lineItemAmount(line);
    const descOnLine = lineItemDescription(line);

    if (amountOnLine > 0 && descOnLine.length >= 4 && !FEE_LINE_RE.test(descOnLine)) {
      push(descOnLine, amountOnLine);
      continue;
    }

    const next = lines[i + 1];
    if (next && descOnLine.length >= 4 && !FEE_LINE_RE.test(descOnLine)) {
      const nextAmount = lineItemAmount(next);
      if (nextAmount > 0 && /^[\d$.,\sUSDusd]+$/.test(next)) {
        push(descOnLine, nextAmount);
      }
    }
  }

  const inlinePatterns = [
    /\b([A-Za-z][A-Za-z0-9\s\-\/.'"]{4,70})\s*(?:\$|USD\s*)([\d,]+\.\d{2})\b/gi,
    /\b([A-Za-z][A-Za-z0-9\s\-\/.'"]{4,70})\s+\$\s*([\d,]+\.?\d{0,2})\b/g,
  ];
  for (const pattern of inlinePatterns) {
    for (const match of text.matchAll(pattern)) {
      const desc = match[1]?.trim() ?? "";
      const amount = Number((match[2] ?? "").replace(/,/g, ""));
      if (!FEE_LINE_RE.test(desc)) push(desc, amount);
    }
  }

  const labelPatterns = [
    /\bdescription\s*:\s*([^$\n]{4,80})/i,
    /\bitem\s*:\s*([^$\n]{4,80})/i,
    /\bproduct\s*:\s*([^$\n]{4,80})/i,
    /\b\d+\s*x\s+([A-Za-z0-9][^$\n]{4,80})/i,
    /\bpurchased\s*:\s*([^$\n.]{4,80})/i,
    /\bfor\s+your\s+purchase\s+of\s+([^$\n.]{4,80})/i,
  ];
  for (const pattern of labelPatterns) {
    const match = text.match(pattern);
    const candidate = normalizeReceiptProduct(match?.[1]?.trim() ?? "");
    if (candidate) push(candidate, 1);
  }

  if (!candidates.length) return null;

  candidates.sort((a, b) => b.amount - a.amount);
  return candidates[0].description;
}

export function extractReceiptProduct(text: string): string | null {
  return extractTopReceiptLineItem(text);
}

export function extractSubjectForKind(
  kind: DocumentKind,
  text: string,
  ctx: ArchiveTitleContext,
): string {
  if (kind === "tax_form") {
    for (const { pattern, subject } of TAX_FORM_PATTERNS) {
      if (pattern.test(text)) return subject;
    }
    return "tax form";
  }

  if (kind === "bank_statement") return "bank statement";
  if (kind === "pay_stub") return "pay stub";
  if (kind === "insurance") return "insurance document";
  if (kind === "contract") return "contract";
  if (kind === "invoice") return "invoice";
  if (kind === "bill") return "bill";

  if (kind === "receipt") {
    const product = extractReceiptProduct(text);
    if (product) return `${product} receipt`;

    const title = ctx.title?.trim() ?? "";
    const titleProduct = title.match(
      /^(?:re|fw|fwd):\s*(?:your\s+)?(.+?)\s+(?:order|receipt|purchase)\b/i,
    );
    if (titleProduct?.[1]) {
      return `${sanitizeArchiveSubject(titleProduct[1].toLowerCase())} receipt`;
    }

    return "purchase receipt";
  }

  const title = ctx.title?.trim();
  if (
    title &&
    !isLikelyArchiveTitle(title) &&
    !/^email from\b/i.test(title) &&
    !/^untitled$/i.test(title)
  ) {
    const cleaned = title
      .replace(/^(re|fw|fwd):\s*/i, "")
      .replace(/\.(pdf|png|jpe?g|docx?|xlsx?)$/i, "")
      .trim();
    const lowered = cleaned.toLowerCase();
    const titleIsBoilerplate =
      /^(?:your\s+)?(?:receipt|order(?:\s+confirmation)?|purchase(?:\s+confirmation)?)$/i.test(
        lowered,
      );
    if (!titleIsBoilerplate && cleaned.length >= 3 && cleaned.length <= 80) {
      return sanitizeArchiveSubject(lowered);
    }
  }

  if (ctx.recordType === "email") return "email";
  return "document";
}

export function extractMerchantInstitution(text: string, ctx: ArchiveTitleContext): string {
  const candidates: Array<{ name: string; score: number }> = [];

  const push = (name: string | null | undefined, score: number) => {
    const cleaned = name ? cleanMerchantName(name) : "";
    if (!cleaned || cleaned.length < 2) return;
    if (PRONOUN_INSTITUTIONS.has(cleaned.toLowerCase())) return;
    if (isJunkMerchantName(cleaned)) return;
    if (isPaymentMethodInstitution(cleaned)) return;
    candidates.push({ name: cleaned, score });
  };

  const title = ctx.title?.trim() ?? "";
  const titleMerchant = title.match(
    /^(?:re|fw|fwd):\s*(?:your\s+)?([A-Za-z0-9][A-Za-z0-9\s&'.-]{2,40}?)\s+(?:order|receipt|purchase|shipment)/i,
  );
  if (titleMerchant?.[1]) push(titleMerchant[1], 100);

  const thankYou = text.match(
    /thank you for (?:your )?(?:purchase|order|shopping|business) (?:at|from)\s+([A-Za-z][^.!\n<]{2,40})/i,
  );
  if (thankYou?.[1]) push(thankYou[1], 95);

  for (const emailMatch of text.matchAll(/\b([a-z0-9._%+-]*@([a-z0-9.-]+\.[a-z]{2,}))\b/gi)) {
    const domain = emailMatch[2];
    if (domain) push(domainToBrand(domain), 88);
  }

  const soldBy = text.match(/\b(?:sold by|merchant|store|retailer|vendor)\s*[:\s]+\s*([^.\n<]{3,50})/i);
  if (soldBy?.[1]) push(soldBy[1], 90);

  const fromHeader = text.match(/\bfrom:\s*([^<\n]{3,80})/i);
  if (fromHeader?.[1]) {
    const chunk = fromHeader[1].split(/[<(]/)[0]?.trim();
    if (chunk && !chunk.includes("@")) {
      push(chunk, 85);
    }
    const domain = fromHeader[1].match(/@([a-z0-9.-]+\.[a-z]{2,})/i)?.[1];
    if (domain) push(domainToBrand(domain), 80);
  }

  for (const name of FINANCIAL_INSTITUTIONS) {
    if (text.toLowerCase().includes(name.toLowerCase())) {
      const score = name === "Chase" ? 10 : 50;
      if (!isPaymentMethodInstitution(name) || score >= 50) {
        push(name, score);
      }
    }
  }

  const statementFrom = text.match(
    /\b(?:bank )?statement\s+(?:for|from)\s+([A-Z][A-Za-z0-9&.\s'-]{2,40})/i,
  );
  if (statementFrom?.[1]) push(statementFrom[1], 70);

  candidates.sort((a, b) => b.score - a.score);
  return candidates[0]?.name ?? "";
}

export function extractInstitutionForKind(
  kind: DocumentKind,
  text: string,
  ctx: ArchiveTitleContext,
): string {
  if (kind === "bank_statement" || kind === "tax_form") {
    for (const name of FINANCIAL_INSTITUTIONS) {
      if (
        ["Chase", "Wells Fargo", "Bank of America", "Citibank", "Capital One", "IRS", "Fidelity", "Vanguard", "Charles Schwab"].includes(
          name,
        ) &&
        text.toLowerCase().includes(name.toLowerCase())
      ) {
        return name;
      }
    }
    const statementFrom = text.match(
      /\b(?:bank )?statement\s+(?:for|from)\s+([A-Z][A-Za-z0-9&.\s'-]{2,40})/i,
    );
    if (statementFrom?.[1]) return cleanMerchantName(statementFrom[1]);
  }

  if (kind === "receipt" || kind === "invoice" || kind === "bill") {
    return extractMerchantInstitution(text, ctx);
  }

  return extractMerchantInstitution(text, ctx);
}

export function sanitizeAiInstitution(
  institution: string,
  kind: DocumentKind,
  text: string,
  ctx: ArchiveTitleContext,
): string {
  const cleaned = sanitizeArchiveInstitution(institution);
  if (!cleaned) return "";

  if (PRONOUN_INSTITUTIONS.has(cleaned.toLowerCase())) {
    const merchant = extractMerchantInstitution(text, ctx);
    if (merchant) return merchant;
    return "";
  }

  if (isJunkMerchantName(cleaned)) {
    const merchant = extractMerchantInstitution(text, ctx);
    return merchant && !isJunkMerchantName(merchant) ? merchant : "";
  }

  if (kind === "receipt" && isPaymentMethodInstitution(cleaned)) {
    const merchant = extractMerchantInstitution(text, ctx);
    if (merchant) return merchant;
    return "";
  }

  return cleaned;
}

const BOILERPLATE_SUBJECT_VALUES = new Set([
  "your receipt",
  "receipt",
  "purchase receipt",
  "order receipt",
  "your order",
  "order confirmation",
  "purchase confirmation",
  "your purchase",
]);

export function sanitizeAiSubject(
  subject: string,
  kind: DocumentKind,
  text: string,
  ctx: ArchiveTitleContext,
): string {
  const cleaned = sanitizeArchiveSubject(subject);
  if (!cleaned) return extractSubjectForKind(kind, text, ctx);

  const lowered = cleaned.toLowerCase();
  if (
    BOILERPLATE_SUBJECT_VALUES.has(lowered) ||
    /^your\s+(receipt|order|purchase)\b/i.test(cleaned)
  ) {
    return extractSubjectForKind("receipt", text, ctx);
  }

  if (kind === "receipt") {
    const bare = cleaned.replace(/\s+receipt$/i, "").trim();
    const boilerplateBare = new Set([
      "receipt",
      "purchase",
      "order",
      "your",
      "you",
      "purchase receipt",
      "order receipt",
      "your receipt",
      "your order",
      "your purchase",
    ]);
    if (
      !bare ||
      boilerplateBare.has(bare) ||
      /^your\s+(receipt|order|purchase)$/i.test(cleaned)
    ) {
      return extractSubjectForKind("receipt", text, ctx);
    }
    if (!/\breceipt$/i.test(cleaned)) {
      return `${bare} receipt`;
    }
  }

  if (kind === "bank_statement" && !/bank statement/i.test(cleaned)) {
    return "bank statement";
  }

  return cleaned;
}

function monthEndDate(year: number, month: number): string | null {
  if (month < 1 || month > 12) return null;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
}

export function extractArchiveDate(text: string, ctx: ArchiveTitleContext): string {
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
    const end = monthEndDate(year, month);
    if (end) return end;
  }

  const receiptDate = text.match(
    /\b(?:order date|purchase date|transaction date|date)\s*[:\s]+\s*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}-\d{2}-\d{2})/i,
  );
  if (receiptDate?.[1]) {
    const normalized = normalizeArchiveDate(receiptDate[1]);
    if (normalized) return normalized;
  }

  for (const candidate of text.match(/\b(20\d{2}-\d{2}-\d{2})\b/g) ?? []) {
    const normalized = normalizeArchiveDate(candidate);
    if (normalized) return normalized;
  }

  for (const candidate of text.match(/\b(\d{1,2}[/-]\d{1,2}[/-]20\d{2})\b/g) ?? []) {
    const normalized = normalizeArchiveDate(candidate);
    if (normalized) return normalized;
  }

  const uploaded = archiveDateFromIsoTimestamp(ctx.createdAt);
  return uploaded ?? archiveDateFromIsoTimestamp(new Date().toISOString())!;
}