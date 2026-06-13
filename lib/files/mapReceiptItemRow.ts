import type { ReceiptLineItemRecord } from "@/lib/files/receiptLineItems";

export function mapReceiptItemRow(row: Record<string, unknown>): ReceiptLineItemRecord {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    noteId: String(row.note_id),
    transactionDate:
      typeof row.transaction_date === "string" ? row.transaction_date.slice(0, 10) : null,
    vendor: String(row.vendor ?? ""),
    itemName: String(row.item_name ?? ""),
    itemCategory: typeof row.item_category === "string" ? row.item_category : null,
    pricePaid:
      row.price_paid != null && row.price_paid !== ""
        ? Number(row.price_paid)
        : null,
    warranty: typeof row.warranty === "string" ? row.warranty : null,
    returnPolicy: typeof row.return_policy === "string" ? row.return_policy : null,
    source: row.source === "manual" ? "manual" : "ai",
    createdAt: String(row.created_at ?? new Date().toISOString()),
    updatedAt: String(row.updated_at ?? new Date().toISOString()),
  };
}