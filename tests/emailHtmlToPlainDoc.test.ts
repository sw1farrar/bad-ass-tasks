import { describe, it, expect } from "vitest";
import {
  emailHtmlToEditableDoc,
  isSimpleEmailHtml,
} from "@/lib/notes/emailHtmlToPlainDoc";

describe("emailHtmlToPlainDoc", () => {
  it("detects complex email HTML with tables", () => {
    expect(isSimpleEmailHtml("<table><tr><td>x</td></tr></table>")).toBe(false);
  });

  it("allows simple paragraph-only HTML", () => {
    expect(isSimpleEmailHtml("<p>Hello<br>world</p>")).toBe(true);
  });

  it("converts simple HTML to editable paragraphs", () => {
    const doc = emailHtmlToEditableDoc("<p>Line one</p><p>Line two</p>") as {
      content: Array<{ content: Array<{ text: string }> }>;
    };
    expect(doc.content).toHaveLength(2);
    expect(doc.content[0].content[0].text).toContain("Line one");
  });
});