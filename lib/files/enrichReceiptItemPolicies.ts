import { callXaiChat, getXaiUnavailableReason } from "@/lib/ai/xaiClient";
import type { ReceiptLineItemInput } from "@/lib/files/receiptLineItems";

const RECEIPT_POLICY_SYSTEM_PROMPT = `You research product warranties and store return policies for receipt line items.

Return STRICT JSON only:
{
  "items": [
    {
      "item_name": "exact item name from input",
      "warranty": "Manufacturer warranty terms — length, coverage, and how to claim. Use published policy knowledge for the brand/product category. If unknown, say 'Unknown — check manufacturer website'.",
      "return_policy": "Vendor return policy — window, condition, refund method. Prefer receipt text if provided; otherwise use the vendor's published retail return policy. If unknown, say 'Unknown — check vendor website'."
    }
  ]
}

Rules:
- One output row per input item; preserve item_name exactly.
- Be concise (1-2 sentences each for warranty and return_policy).
- Use real-world knowledge of major retailers and manufacturers (Best Buy, Micro Center, Amazon, Apple, LG, Samsung, etc.).
- Do not invent specific receipt-only terms unless plausible for that vendor.
- Plain English, no markdown.`;

type PolicyResponse = {
  items?: Array<{
    item_name?: string;
    warranty?: string;
    return_policy?: string;
  }>;
};

export type EnrichedReceiptLineItem = ReceiptLineItemInput & {
  warranty?: string | null;
  returnPolicy?: string | null;
};

function buildUserPrompt(
  vendor: string,
  transactionDate: string | null,
  items: ReceiptLineItemInput[],
  receiptContext?: string,
): string {
  return [
    `Vendor: ${vendor || "Unknown"}`,
    `Transaction date: ${transactionDate ?? "Unknown"}`,
    receiptContext ? `Receipt excerpt:\n${receiptContext.slice(0, 2000)}` : "",
    "",
    "Line items to research:",
    JSON.stringify(
      items.map((item) => ({
        item_name: item.itemName,
        item_category: item.itemCategory ?? null,
        price_paid: item.pricePaid ?? null,
      })),
      null,
      2,
    ),
  ]
    .filter(Boolean)
    .join("\n");
}

function parsePolicyResponse(
  raw: string,
  items: ReceiptLineItemInput[],
): EnrichedReceiptLineItem[] {
  try {
    const parsed = JSON.parse(raw) as PolicyResponse;
    const byName = new Map(
      (parsed.items ?? []).map((row) => [
        String(row.item_name ?? "").trim().toLowerCase(),
        row,
      ]),
    );

    return items.map((item) => {
      const match = byName.get(item.itemName.trim().toLowerCase());
      return {
        ...item,
        warranty: String(match?.warranty ?? "").trim() || null,
        returnPolicy: String(match?.return_policy ?? "").trim() || null,
      };
    });
  } catch {
    return items.map((item) => ({ ...item, warranty: null, returnPolicy: null }));
  }
}

/** Best-effort warranty + return policy enrichment via Grok. */
export async function enrichReceiptItemPolicies(
  vendor: string,
  transactionDate: string | null,
  items: ReceiptLineItemInput[],
  receiptContext?: string,
): Promise<EnrichedReceiptLineItem[]> {
  if (!items.length) return [];
  if (getXaiUnavailableReason()) {
    return items.map((item) => ({ ...item, warranty: null, returnPolicy: null }));
  }

  const result = await callXaiChat({
    systemPrompt: RECEIPT_POLICY_SYSTEM_PROMPT,
    userPrompt: buildUserPrompt(vendor, transactionDate, items, receiptContext),
    expectJson: true,
    temperature: 0.15,
    maxTokens: 1200,
  });

  if (!result.ok) {
    return items.map((item) => ({ ...item, warranty: null, returnPolicy: null }));
  }

  return parsePolicyResponse(result.content, items);
}