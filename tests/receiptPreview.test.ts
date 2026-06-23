import { describe, expect, it } from "vitest";
import { buildReceiptPreviewCatalog } from "@/lib/files/receiptPreview";
import type { ReceiptLineItemRecord } from "@/lib/files/receiptLineItems";

function makeItem(
  overrides: Partial<ReceiptLineItemRecord> & Pick<ReceiptLineItemRecord, "id" | "noteId" | "itemName">,
): ReceiptLineItemRecord {
  return {
    workspaceId: "ws",
    vendor: null,
    itemCategory: null,
    pricePaid: null,
    transactionDate: null,
    source: "ai",
    createdAt: "",
    updatedAt: "",
    ...overrides,
  };
}

describe("receiptPreview", () => {
  it("builds a unique receipt catalog in ledger order", () => {
    const catalog = buildReceiptPreviewCatalog([
      makeItem({ id: "1", noteId: "note-a", itemName: "Monitor", vendor: "Micro Center" }),
      makeItem({ id: "2", noteId: "note-a", itemName: "Cable", vendor: "Micro Center" }),
      makeItem({ id: "3", noteId: "note-b", itemName: "Keyboard", vendor: "Amazon" }),
    ]);

    expect(catalog).toEqual([
      { noteId: "note-a", label: "Micro Center" },
      { noteId: "note-b", label: "Amazon" },
    ]);
  });

  it("falls back to item name when vendor is missing", () => {
    const catalog = buildReceiptPreviewCatalog([
      makeItem({ id: "1", noteId: "note-a", itemName: "Desk lamp" }),
    ]);

    expect(catalog).toEqual([{ noteId: "note-a", label: "Desk lamp" }]);
  });
});