import { describe, expect, it } from "vitest";
import {
  buildReceiptPreviewCatalog,
  resolveReceiptNoteEmailPreview,
} from "@/lib/files/receiptPreview";
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

  it("resolves email preview from archived raw_html when no attachment exists", () => {
    const preview = resolveReceiptNoteEmailPreview({
      title: "Micro Center receipt",
      content: JSON.stringify({
        type: "doc",
        content: [{ type: "paragraph", content: [{ type: "text", text: "From: store" }] }],
      }),
      rawHtml: "<table><tr><td>Widget</td><td>$9.99</td></tr></table>",
      tags: ["from-email"],
      recordType: "email",
      emailPipelineVersion: 1,
      searchPlain: "Widget $9.99",
    });

    expect(preview?.title).toBe("Micro Center receipt");
    expect(preview?.bodyHtml).toContain("Widget");
  });

  it("falls back to search_plain when no email html is available", () => {
    const preview = resolveReceiptNoteEmailPreview({
      title: "Plain receipt",
      content: "",
      rawHtml: null,
      tags: [],
      recordType: "receipt",
      emailPipelineVersion: null,
      searchPlain: "Standing Desk $449.00",
    });

    expect(preview).toEqual({
      title: "Plain receipt",
      bodyHtml: "",
      css: "",
      plainTextFallback: "Standing Desk $449.00",
    });
  });
});