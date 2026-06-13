// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ReceiptItemsSupabase = { from: (table: string) => any };
import type { EnrichedReceiptLineItem } from "@/lib/files/enrichReceiptItemPolicies";
import { buildReceiptDedupeKey } from "@/lib/files/receiptLineItems";

export type PersistReceiptItemsResult = {
  inserted: number;
  skipped: number;
};

function mapRow(
  workspaceId: string,
  noteId: string,
  item: EnrichedReceiptLineItem,
) {
  const key = buildReceiptDedupeKey({
    noteId,
    itemName: item.itemName,
    pricePaid: item.pricePaid,
    transactionDate: item.transactionDate,
  });

  return {
    workspace_id: workspaceId,
    note_id: noteId,
    transaction_date: item.transactionDate,
    vendor: (item.vendor ?? "").trim(),
    item_name: item.itemName,
    item_category: item.itemCategory,
    price_paid: item.pricePaid,
    warranty: item.warranty,
    return_policy: item.returnPolicy,
    dedupe_key: key,
    source: "ai" as const,
    updated_at: new Date().toISOString(),
  };
}

/** Insert new receipt line items; skip rows that already exist (dedupe_key). */
export async function persistReceiptLineItems(
  supabase: ReceiptItemsSupabase,
  workspaceId: string,
  noteId: string,
  items: EnrichedReceiptLineItem[],
): Promise<PersistReceiptItemsResult> {
  if (!items.length) return { inserted: 0, skipped: 0 };

  const rows = items.map((item) => mapRow(workspaceId, noteId, item));
  const keys = rows.map((row) => row.dedupe_key);

  const { data: existing } = await (supabase.from("workspace_receipt_items") as any)
    .select("dedupe_key")
    .eq("workspace_id", workspaceId)
    .in("dedupe_key", keys);

  const existingKeys = new Set(
    ((existing ?? []) as Array<{ dedupe_key: string }>).map((row) => row.dedupe_key),
  );

  const toInsert = rows.filter((row) => !existingKeys.has(row.dedupe_key));
  if (!toInsert.length) {
    return { inserted: 0, skipped: rows.length };
  }

  const { error } = await (supabase.from("workspace_receipt_items") as any).insert(toInsert);
  if (error?.code === "42P01") {
    return { inserted: 0, skipped: rows.length };
  }
  if (error) throw error;

  return {
    inserted: toInsert.length,
    skipped: rows.length - toInsert.length,
  };
}
