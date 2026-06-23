import { describe, expect, it } from "vitest";
import {
  buildReceiptDedupeKey,
  defaultReceiptLedgerSortDirection,
  filterReceiptLineItems,
  parseReceiptLineItemsFromAnalysis,
  receiptLedgerSortToDbColumn,
  resolveReceiptLedgerSort,
  type ReceiptLineItemRecord,
} from "@/lib/files/receiptLineItems";

describe("receiptLineItems", () => {
  it("parses line_items from receipt analysis", () => {
    const items = parseReceiptLineItemsFromAnalysis(
      {
        document_type: "receipt",
        vendor_or_issuer: "Micro Center",
        document_date: "2026-06-07",
        line_items: [
          { item_name: "LG 27IN 4K MONITOR", item_category: "Computer Monitor", price_paid: 329.99 },
          { item_name: "USB-C Cable", item_category: "Cable", price_paid: 12.99 },
          { description: "Sales Tax", amount: 24.5 },
        ],
      },
      {},
    );

    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      itemName: "LG 27IN 4K MONITOR",
      itemCategory: "Computer Monitor",
      pricePaid: 329.99,
      vendor: "Micro Center",
      transactionDate: "2026-06-07",
    });
  });

  it("falls back to single receipt_line_item when line_items missing", () => {
    const items = parseReceiptLineItemsFromAnalysis(
      {
        document_type: "receipt",
        receipt_line_item: "27 inch monitor",
        item_category: "Computer Monitor",
        vendor_or_issuer: "Best Buy",
        document_date: "2026-01-15",
      },
      {},
    );

    expect(items).toHaveLength(1);
    expect(items[0].itemName).toBe("27 inch monitor");
  });

  it("returns empty for non-receipt documents", () => {
    expect(
      parseReceiptLineItemsFromAnalysis({ document_type: "invoice", line_items: [{}] }, {}),
    ).toEqual([]);
  });

  it("builds stable dedupe keys", () => {
    const a = buildReceiptDedupeKey({
      noteId: "note-1",
      itemName: "Monitor",
      pricePaid: 100,
      transactionDate: "2026-01-01",
    });
    const b = buildReceiptDedupeKey({
      noteId: "note-1",
      itemName: "monitor",
      pricePaid: 100,
      transactionDate: "2026-01-01",
    });
    expect(a).toBe(b);
  });

  it("filters by vendor and query", () => {
    const rows: ReceiptLineItemRecord[] = [
      {
        id: "1",
        workspaceId: "ws",
        noteId: "n1",
        vendor: "Micro Center",
        itemName: "Monitor",
        itemCategory: "Computer Monitor",
        pricePaid: 300,
        transactionDate: "2026-06-01",
        source: "ai",
        createdAt: "",
        updatedAt: "",
      },
      {
        id: "2",
        workspaceId: "ws",
        noteId: "n2",
        vendor: "Amazon",
        itemName: "Keyboard",
        itemCategory: "Keyboard",
        pricePaid: 80,
        transactionDate: "2026-05-01",
        source: "ai",
        createdAt: "",
        updatedAt: "",
      },
    ];

    expect(filterReceiptLineItems(rows, { vendor: "Amazon" })).toHaveLength(1);
    expect(filterReceiptLineItems(rows, { query: "monitor" })).toHaveLength(1);
  });

  it("resolves receipt ledger sort params with safe defaults", () => {
    expect(resolveReceiptLedgerSort(null, null)).toEqual({
      column: "transactionDate",
      direction: "desc",
    });
    expect(resolveReceiptLedgerSort("vendor", "asc")).toEqual({
      column: "vendor",
      direction: "asc",
    });
    expect(resolveReceiptLedgerSort("not_a_column", "sideways")).toEqual({
      column: "transactionDate",
      direction: "desc",
    });
  });

  it("maps receipt ledger sort columns to database fields", () => {
    expect(receiptLedgerSortToDbColumn("itemName")).toBe("item_name");
    expect(receiptLedgerSortToDbColumn("returnPolicy")).toBe("return_policy");
  });

  it("picks sensible default directions for new sort columns", () => {
    expect(defaultReceiptLedgerSortDirection("transactionDate")).toBe("desc");
    expect(defaultReceiptLedgerSortDirection("pricePaid")).toBe("desc");
    expect(defaultReceiptLedgerSortDirection("vendor")).toBe("asc");
  });
});