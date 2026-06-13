import { describe, expect, it } from "vitest";
import { SMART_DOCUMENT_NAME_SYSTEM_PROMPT } from "@/lib/files/smartDocumentNamePrompt";

describe("SMART_DOCUMENT_NAME_SYSTEM_PROMPT", () => {
  it("covers major document types with distinct subject rules", () => {
    const prompt = SMART_DOCUMENT_NAME_SYSTEM_PROMPT;

    expect(prompt).toContain("tax_form");
    expect(prompt).toContain("bank_statement");
    expect(prompt).toContain("credit_card_statement");
    expect(prompt).toContain("1098-SA");
    expect(prompt).toContain("1094-C");
    expect(prompt).toContain("Classify before you name");
    expect(prompt).toContain("form type IS the subject");
    expect(prompt).toContain("Bank Statement");
    expect(prompt).toContain("Pay Stub");
    expect(prompt).toContain("Electric Bill");
    expect(prompt).toContain("correspondence");
    expect(prompt).toContain("Attached document image");
  });

  it("asks for a detailed filing memo alongside the filename", () => {
    expect(SMART_DOCUMENT_NAME_SYSTEM_PROMPT).toContain('"memo"');
    expect(SMART_DOCUMENT_NAME_SYSTEM_PROMPT).toContain("searchable detail");
  });

  it("asks for workspace filing tags only from the provided list", () => {
    expect(SMART_DOCUMENT_NAME_SYSTEM_PROMPT).toContain('"tags"');
    expect(SMART_DOCUMENT_NAME_SYSTEM_PROMPT).toContain("WORKSPACE FILING TAGS");
    expect(SMART_DOCUMENT_NAME_SYSTEM_PROMPT).toContain("never invent new tags");
  });

  it("keeps receipt item interpretation guidance", () => {
    expect(SMART_DOCUMENT_NAME_SYSTEM_PROMPT).toContain("Computer Monitor");
    expect(SMART_DOCUMENT_NAME_SYSTEM_PROMPT).toContain("item_category");
  });

  it("documents multi-image receipt merging rules", () => {
    expect(SMART_DOCUMENT_NAME_SYSTEM_PROMPT).toContain("Multiple images");
    expect(SMART_DOCUMENT_NAME_SYSTEM_PROMPT).toContain("Merge evidence across images");
    expect(SMART_DOCUMENT_NAME_SYSTEM_PROMPT).toContain("gather line_items from ALL images");
  });
});