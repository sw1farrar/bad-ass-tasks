import type { ReceiptLineItemInput } from "@/lib/files/receiptLineItems";

const FEE_ROW_RE =
  /^(?:subtotal|sales\s+tax|city\s+tax|state\s+tax|tax|shipping|delivery|handling|tip|gratuity|fee|discount|total|sale\s+total|order\s+total|amount\s+due|balance\s+due|payment|card|visa|master\s*card|mastercard|amex|discover|cash|grand\s+total|barcode)(?:\s*»)?$/i;

const FEE_LINE_RE =
  /\b(subtotal|city\s+tax|state\s+tax|sales\s+tax|sale\s+total|order\s+total|amount\s+due|balance\s+due|grand\s+total)\b/i;

const PAYMENT_LINE_RE =
  /^(?:master\s*card|visa|amex|american\s+express|discover|debit|credit|cash|apple\s+pay|google\s+pay)\b/i;

const RECEIPT_FOOTER_RE =
  /\b(product\s+support|return\s+policy|vendor\s+warranty|extended\s+warranty|customer\s+care|customer\s+support|sign\s+up\s+for\s+special\s+offers|thank\s+you\s+for\s+your\s+purchase)\b/i;

const SALE_SECTION_START_RE =
  /your\s+sale\s+information|(?:^|\n)\s*sku\s+description\s+quantity/i;

const SKU_LINE_RE = /^(\d{5,6})\s+(.+)$/;
const SN_CONTINUATION_RE = /^s\/n\s*:/i;
const META_CONTINUATION_RE = /^(?:symptoms|security|provided\s+info|cx\s)/i;

const MONEY_RE = /(?:\$|USD\s*)?\s*([\d,]+\.\d{2})\b/gi;
const MONEY_ONLY_RE = /^(?:\$|USD\s*)?[\d,]+\.\d{2}$/i;

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/** Preserve line breaks when stripping HTML for receipt parsing. */
function htmlToReceiptPlainText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/tr>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<\/h[1-6]>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function stripTags(html: string): string {
  return normalizeText(htmlToReceiptPlainText(html));
}

function parseMoney(value: string): number | null {
  const match = value.match(/(?:\$|USD\s*)?\s*([\d,]+\.\d{2})\b/i);
  if (!match) return null;
  const num = Number(match[1].replace(/,/g, ""));
  return Number.isFinite(num) && num > 0 ? Math.round(num * 100) / 100 : null;
}

function parseAllMoney(value: string): number[] {
  const amounts: number[] = [];
  for (const match of value.matchAll(MONEY_RE)) {
    const num = Number((match[1] ?? "").replace(/,/g, ""));
    if (Number.isFinite(num) && num > 0) {
      amounts.push(Math.round(num * 100) / 100);
    }
  }
  return amounts;
}

function isFeeDescription(value: string): boolean {
  const normalized = normalizeText(value).replace(/[:\s»]+$/g, "");
  if (!normalized) return true;
  if (FEE_ROW_RE.test(normalized)) return true;
  if (FEE_LINE_RE.test(normalized) && !/\b\d{5,6}\b/.test(normalized)) return true;
  if (PAYMENT_LINE_RE.test(normalized)) return true;
  return false;
}

function isValidItemName(name: string): boolean {
  const normalized = normalizeText(name);
  if (!normalized || normalized.length < 3) return false;
  if (isFeeDescription(normalized)) return false;
  if (RECEIPT_FOOTER_RE.test(normalized)) return false;
  if (/^s\/n\s*:[\w-]+$/i.test(normalized)) return false;
  if (/^\d{5,6}$/.test(normalized)) return false;
  return true;
}

function dedupeKey(item: ReceiptLineItemInput): string {
  const sku = item.itemName.match(/^(\d{5,6})\b/)?.[1];
  if (sku && item.pricePaid != null) {
    return `sku:${sku}|${item.pricePaid.toFixed(2)}`;
  }
  return [
    item.itemName.toLowerCase(),
    item.pricePaid != null ? item.pricePaid.toFixed(2) : "",
  ].join("|");
}

function pushItem(
  items: ReceiptLineItemInput[],
  seen: Set<string>,
  description: string,
  amount: number | null,
  sku?: string,
) {
  let itemName = normalizeText(description);
  if (sku && !itemName.startsWith(sku)) {
    itemName = `${sku} ${itemName}`;
  }
  if (!isValidItemName(itemName)) return;
  if (amount != null && amount <= 0) return;

  const candidate: ReceiptLineItemInput = {
    itemName,
    itemCategory: null,
    pricePaid: amount,
    transactionDate: null,
    vendor: null,
  };
  const key = dedupeKey(candidate);
  if (seen.has(key)) return;
  seen.add(key);
  items.push(candidate);
}

function stripPricesAndQty(line: string): string {
  return normalizeText(
    line
      .replace(MONEY_RE, "")
      .replace(/\b\d+\s*$/g, "")
      .replace(/\s+\d+\s*$/g, "")
      .replace(/»/g, "")
      .trim(),
  );
}

function extractSaleSection(text: string): string {
  const startMatch = text.match(SALE_SECTION_START_RE);
  const startIndex = startMatch?.index ?? 0;
  let section = text.slice(startIndex);

  const endPatterns = [
    /\n\s*subtotal\b/i,
    /\n\s*product\s+support\b/i,
    /\n\s*barcode\b/i,
    /\n\s*thank\s+you\s+for\s+your\s+purchase\b/i,
  ];
  let endIndex = section.length;
  for (const pattern of endPatterns) {
    const match = section.match(pattern);
    if (match?.index != null && match.index > 0 && match.index < endIndex) {
      endIndex = match.index;
    }
  }
  return section.slice(0, endIndex);
}

type PendingSkuRow = {
  sku: string;
  description: string;
  price: number | null;
};

function flushPending(
  pending: PendingSkuRow | null,
  items: ReceiptLineItemInput[],
  seen: Set<string>,
  seenSkus: Set<string>,
) {
  if (!pending) return;
  if (seenSkus.has(pending.sku)) return;
  if (!pending.description && pending.price == null) return;

  const description = pending.description || `SKU ${pending.sku}`;
  pushItem(items, seen, description, pending.price, pending.sku);
  seenSkus.add(pending.sku);
}

/**
 * Columnar retail receipts (Micro Center, etc.): SKU + description + qty + prices.
 * Handles multi-line descriptions (S/N on next line) and collapsed plain text.
 */
export function extractRetailSkuReceiptRows(text: string): ReceiptLineItemInput[] {
  const items: ReceiptLineItemInput[] = [];
  const seen = new Set<string>();
  const seenSkus = new Set<string>();

  const section = extractSaleSection(text);
  const lines = section
    .split(/\n/)
    .map((line) => line.replace(/»/g, " ").replace(/\s+/g, " ").trim())
    .filter(Boolean);

  let pending: PendingSkuRow | null = null;
  let inHeader = true;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (inHeader) {
      if (/^sku\s+description/i.test(line)) {
        inHeader = false;
      }
      continue;
    }

    if (FEE_LINE_RE.test(line) || PAYMENT_LINE_RE.test(line) || RECEIPT_FOOTER_RE.test(line)) {
      break;
    }

    const skuMatch = line.match(SKU_LINE_RE);
    if (skuMatch) {
      flushPending(pending, items, seen, seenSkus);
      const sku = skuMatch[1];
      const rest = skuMatch[2];
      const amounts = parseAllMoney(rest);
      const price = amounts.length ? amounts[amounts.length - 1] : null;
      const description = stripPricesAndQty(rest);

      if (price != null && description) {
        pushItem(items, seen, description, price, sku);
        seenSkus.add(sku);
        pending = null;
      } else {
        pending = { sku, description, price: null };
      }
      continue;
    }

    if (pending) {
      const amounts = parseAllMoney(line);
      const price = amounts.length ? amounts[amounts.length - 1] : null;
      const snLine = SN_CONTINUATION_RE.test(line);
      const metaLine = META_CONTINUATION_RE.test(line);

      if (price != null) {
        if (!snLine && !metaLine) {
          const extra = stripPricesAndQty(line);
          if (extra) {
            pending.description = pending.description
              ? `${pending.description} ${extra}`
              : extra;
          }
        }
        pending.price = price;
        flushPending(pending, items, seen, seenSkus);
        pending = null;
        continue;
      }

      if (snLine || metaLine) {
        continue;
      }

      const extra = stripPricesAndQty(line);
      if (extra) {
        pending.description = pending.description
          ? `${pending.description} ${extra}`
          : extra;
      }
    }
  }

  flushPending(pending, items, seen, seenSkus);

  if (items.length >= 2) return items;

  // Collapsed single-line receipts: split on SKU boundaries.
  const collapsed = normalizeText(section);
  if (!/\b\d{5,6}\b/.test(collapsed)) return items;

  for (const match of collapsed.matchAll(
    /(?<!\d)(\d{5,6})\s+([\s\S]*?)(?=(?:\s(?<!\d)\d{5,6}\s+)|$)/g,
  )) {
    const sku = match[1];
    const body = match[2] ?? "";
    if (seenSkus.has(sku)) continue;

    const amounts = parseAllMoney(body);
    const price = amounts.length ? amounts[amounts.length - 1] : null;
    const description = stripPricesAndQty(
      body
        .replace(/\bs\/n\s*:\s*[\w-]+/gi, "")
        .replace(/\b(?:symptoms|security):[^$]+/gi, ""),
    );

    if (price != null && description) {
      pushItem(items, seen, description, price, sku);
      seenSkus.add(sku);
    }
  }

  return items;
}

/** Pull purchasable rows from HTML tables (order confirmation emails). */
export function extractReceiptRowsFromHtmlTables(html: string): ReceiptLineItemInput[] {
  const items: ReceiptLineItemInput[] = [];
  const seen = new Set<string>();

  const rowMatches = html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi);
  for (const rowMatch of rowMatches) {
    const rowHtml = rowMatch[1] ?? "";
    const cellMatches = [...rowHtml.matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)];
    if (cellMatches.length < 2) continue;

    const cells = cellMatches
      .map((match) => normalizeText(htmlToReceiptPlainText(match[1] ?? "")))
      .filter(Boolean);
    if (cells.length < 2) continue;

    let amount: number | null = null;
    let amountIndex = -1;
    for (let i = cells.length - 1; i >= 0; i--) {
      const parsed = parseMoney(cells[i]);
      if (parsed != null) {
        amount = parsed;
        amountIndex = i;
        break;
      }
    }
    if (amountIndex < 0) continue;

    const descriptionParts = cells.filter((_, index) => index !== amountIndex);
    const description = descriptionParts.join(" — ");
    pushItem(items, seen, description, amount);
  }

  return items;
}

/** Receipt layouts that use stacked div/spans instead of tables. */
export function extractReceiptRowsFromHtmlBlocks(html: string): ReceiptLineItemInput[] {
  const items: ReceiptLineItemInput[] = [];
  const seen = new Set<string>();

  const blockMatches = html.matchAll(
    /<(?:div|p|li|td)\b[^>]*>([\s\S]*?\$[\d,]+\.\d{2}[\s\S]*?)<\/(?:div|p|li|td)>/gi,
  );
  for (const blockMatch of blockMatches) {
    const text = normalizeText(htmlToReceiptPlainText(blockMatch[1] ?? ""));
    if (!text || isFeeDescription(text)) continue;

    const amounts = parseAllMoney(text);
    const amount = amounts.length ? amounts[amounts.length - 1] : null;
    if (amount == null) continue;

    const inline = text.match(/\b(.{3,120}?)\s+(?:\$|USD\s*)([\d,]+\.\d{2})\s*$/i);
    if (inline) {
      pushItem(items, seen, inline[1], parseMoney(`$${inline[2]}`));
      continue;
    }

    const withoutAmount = text.replace(MONEY_RE, "").trim();
    if (withoutAmount.length >= 3) {
      pushItem(items, seen, withoutAmount, amount);
    }
  }

  return items;
}

/** Plain-text / markdown receipt lines after HTML stripping. */
export function extractReceiptRowsFromPlainText(text: string): ReceiptLineItemInput[] {
  const retail = extractRetailSkuReceiptRows(text);
  if (retail.length >= 2) return retail;

  const items: ReceiptLineItemInput[] = [];
  const seen = new Set<string>();
  const lines = text
    .split(/\n/)
    .map((line) => normalizeText(line))
    .filter(Boolean);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (isFeeDescription(line)) continue;

    const amounts = parseAllMoney(line);
    const trailingPrice = amounts.length ? amounts[amounts.length - 1] : null;

    const inline = line.match(/^(.{3,120}?)\s+(?:\$|USD\s*)([\d,]+\.\d{2})$/i);
    if (inline) {
      pushItem(items, seen, inline[1], parseMoney(`$${inline[2]}`));
      continue;
    }

    if (trailingPrice != null && /[A-Za-z]{3,}/.test(line)) {
      const name = stripPricesAndQty(line);
      if (name) pushItem(items, seen, name, trailingPrice);
      continue;
    }

    if (MONEY_ONLY_RE.test(line) && i > 0) {
      const prev = lines[i - 1];
      if (prev && !isFeeDescription(prev) && !MONEY_ONLY_RE.test(prev)) {
        pushItem(items, seen, prev, parseMoney(line));
      }
    }
  }

  for (const item of retail) {
    const key = dedupeKey(item);
    if (!seen.has(key)) {
      seen.add(key);
      items.push(item);
    }
  }

  return items;
}

/** Format extracted rows for the AI prompt. */
export function formatEmailReceiptLinesForPrompt(items: ReceiptLineItemInput[]): string {
  return items
    .map((item) => {
      const price =
        item.pricePaid != null
          ? ` $${item.pricePaid.toFixed(2)}`
          : "";
      return `- ${item.itemName}${price}`;
    })
    .join("\n");
}

function scoreReceiptItem(item: ReceiptLineItemInput): number {
  let score = 0;
  if (item.pricePaid != null && item.pricePaid > 0) score += 2;
  if (/^\d{5,6}\b/.test(item.itemName)) score += 3;
  if (/^s\/n\s*:/i.test(item.itemName)) score -= 5;
  if (isFeeDescription(item.itemName)) score -= 10;
  if (item.itemName.length >= 8) score += 1;
  return score;
}

function pickBestReceiptItems(items: ReceiptLineItemInput[]): ReceiptLineItemInput[] {
  const positive = items.filter((item) => scoreReceiptItem(item) > 0);
  if (positive.length >= 2) return positive;
  return items.filter((item) => isValidItemName(item.itemName));
}

/**
 * Extract purchasable line items from an inbound receipt email body (HTML or plain).
 * Used when the receipt lives in the email itself rather than an image attachment.
 */
export function extractReceiptLineItemsFromEmailHtml(html: string): ReceiptLineItemInput[] {
  const trimmed = html.trim();
  if (!trimmed) return [];

  const merged = new Map<string, ReceiptLineItemInput>();

  const addAll = (rows: ReceiptLineItemInput[]) => {
    for (const row of rows) {
      if (!isValidItemName(row.itemName)) continue;
      merged.set(dedupeKey(row), row);
    }
  };

  addAll(extractReceiptRowsFromHtmlTables(trimmed));
  addAll(extractReceiptRowsFromHtmlBlocks(trimmed));

  const plain = htmlToReceiptPlainText(trimmed);
  addAll(extractRetailSkuReceiptRows(plain));
  addAll(extractReceiptRowsFromPlainText(plain));

  return pickBestReceiptItems([...merged.values()]).slice(0, 50);
}

/** Extract from plain text bodies (search_plain, markdown) when HTML is unavailable. */
export function extractReceiptLineItemsFromPlainBody(text: string): ReceiptLineItemInput[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const merged = new Map<string, ReceiptLineItemInput>();
  const addAll = (rows: ReceiptLineItemInput[]) => {
    for (const row of rows) {
      if (!isValidItemName(row.itemName)) continue;
      merged.set(dedupeKey(row), row);
    }
  };

  addAll(extractRetailSkuReceiptRows(trimmed));
  addAll(extractReceiptRowsFromPlainText(trimmed));

  return pickBestReceiptItems([...merged.values()]).slice(0, 50);
}