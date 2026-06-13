export type ReceiptLineItemInput = {
  itemName: string;
  itemCategory?: string | null;
  pricePaid?: number | null;
  transactionDate?: string | null;
  vendor?: string | null;
};

export type ReceiptLineItemRecord = ReceiptLineItemInput & {
  id: string;
  workspaceId: string;
  noteId: string;
  warranty?: string | null;
  returnPolicy?: string | null;
  source: "ai" | "manual";
  createdAt: string;
  updatedAt: string;
};

type RawLineItem = {
  item_name?: string;
  description?: string;
  item_category?: string;
  category?: string;
  price_paid?: number | string;
  amount?: number | string;
  quantity?: number | string;
};

const FEE_ROW_RE =
  /^(?:subtotal|total|tax|sales\s+tax|shipping|delivery|tip|gratuity|discount|change|balance|amount\s+due|payment|card|visa|mastercard|amex|cash)$/i;

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function parseMoney(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value * 100) / 100;
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/[^0-9.-]/g, "");
  if (!cleaned) return null;
  const num = Number(cleaned);
  return Number.isFinite(num) ? Math.round(num * 100) / 100 : null;
}

function parseIsoDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  return trimmed;
}

function stableDedupeDigest(payload: string): string {
  let h1 = 2166136261;
  let h2 = 16777619;
  for (let i = 0; i < payload.length; i++) {
    const code = payload.charCodeAt(i);
    h1 ^= code;
    h1 = Math.imul(h1, 16777619);
    h2 = (Math.imul(h2, 33) + code) >>> 0;
  }
  return `${(h1 >>> 0).toString(16)}${h2.toString(16)}`.padStart(40, "0").slice(0, 40);
}

export function buildReceiptDedupeKey(input: {
  noteId: string;
  itemName: string;
  pricePaid?: number | null;
  transactionDate?: string | null;
}): string {
  const payload = [
    input.noteId,
    normalizeText(input.itemName).toLowerCase(),
    input.pricePaid != null ? input.pricePaid.toFixed(2) : "",
    input.transactionDate ?? "",
  ].join("|");
  return stableDedupeDigest(payload);
}

function mapRawLineItem(
  raw: RawLineItem,
  defaults: { vendor?: string | null; transactionDate?: string | null },
): ReceiptLineItemInput | null {
  const itemName = normalizeText(String(raw.item_name ?? raw.description ?? ""));
  if (!itemName || itemName.length < 2) return null;
  if (FEE_ROW_RE.test(itemName)) return null;

  const pricePaid = parseMoney(raw.price_paid ?? raw.amount);
  if (pricePaid != null && pricePaid <= 0) return null;

  const category = normalizeText(String(raw.item_category ?? raw.category ?? "")) || null;

  return {
    itemName,
    itemCategory: category,
    pricePaid,
    transactionDate: defaults.transactionDate ?? null,
    vendor: defaults.vendor ?? null,
  };
}

export function parseReceiptLineItemsFromAnalysis(
  analysis: Record<string, unknown> | undefined,
  defaults: { vendor?: string | null; transactionDate?: string | null },
): ReceiptLineItemInput[] {
  if (!analysis || analysis.document_type !== "receipt") return [];

  const transactionDate =
    parseIsoDate(analysis.document_date) ?? defaults.transactionDate ?? null;
  const vendor =
    normalizeText(String(analysis.vendor_or_issuer ?? defaults.vendor ?? "")) || null;

  const mergedDefaults = { vendor, transactionDate };
  const seen = new Set<string>();
  const items: ReceiptLineItemInput[] = [];

  const push = (candidate: ReceiptLineItemInput | null) => {
    if (!candidate) return;
    const key = buildReceiptDedupeKey({
      noteId: "preview",
      itemName: candidate.itemName,
      pricePaid: candidate.pricePaid,
      transactionDate: candidate.transactionDate,
    });
    if (seen.has(key)) return;
    seen.add(key);
    items.push(candidate);
  };

  const lineItems = analysis.line_items;
  if (Array.isArray(lineItems)) {
    for (const raw of lineItems) {
      if (!raw || typeof raw !== "object") continue;
      push(mapRawLineItem(raw as RawLineItem, mergedDefaults));
    }
  }

  if (items.length === 0) {
    const singleName = normalizeText(String(analysis.receipt_line_item ?? ""));
    const singleCategory = normalizeText(String(analysis.item_category ?? "")) || null;
    if (singleName) {
      push({
        itemName: singleName,
        itemCategory: singleCategory,
        pricePaid: null,
        transactionDate,
        vendor,
      });
    }
  }

  return items;
}

export function filterReceiptLineItems(
  items: ReceiptLineItemRecord[],
  filters: {
    query?: string;
    vendor?: string;
    category?: string;
    dateFrom?: string;
    dateTo?: string;
  },
): ReceiptLineItemRecord[] {
  const q = filters.query?.trim().toLowerCase();
  const vendor = filters.vendor?.trim().toLowerCase();
  const category = filters.category?.trim().toLowerCase();

  return items.filter((item) => {
    if (vendor && (item.vendor ?? "").toLowerCase() !== vendor) return false;
    if (category && (item.itemCategory ?? "").toLowerCase() !== category) return false;
    if (filters.dateFrom && item.transactionDate && item.transactionDate < filters.dateFrom) {
      return false;
    }
    if (filters.dateTo && item.transactionDate && item.transactionDate > filters.dateTo) {
      return false;
    }
    if (q) {
      const haystack = [
        item.itemName,
        item.itemCategory,
        item.vendor,
        item.warranty,
        item.returnPolicy,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}

export function collectReceiptFilterOptions(items: ReceiptLineItemRecord[]): {
  vendors: string[];
  categories: string[];
} {
  const vendors = new Set<string>();
  const categories = new Set<string>();
  for (const item of items) {
    if (item.vendor?.trim()) vendors.add(item.vendor.trim());
    if (item.itemCategory?.trim()) categories.add(item.itemCategory.trim());
  }
  return {
    vendors: [...vendors].sort((a, b) => a.localeCompare(b)),
    categories: [...categories].sort((a, b) => a.localeCompare(b)),
  };
}