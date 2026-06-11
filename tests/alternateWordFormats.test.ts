import { describe, expect, it } from "vitest";
import {
  extractAlternateWordText,
  extractHtmlPlainText,
  extractRtfPlainText,
  extractWordXmlPlainText,
  isHtmlWordDocument,
  isRtfDocument,
  isWordXmlDocument,
} from "@/lib/preview/alternateWordFormats";

describe("alternateWordFormats", () => {
  it("detects RTF payloads", () => {
    const rtf = Buffer.from("{\\rtf1\\ansi Hello\\par World}");
    expect(isRtfDocument(rtf)).toBe(true);
    expect(extractRtfPlainText(rtf.toString("latin1"))).toContain("Hello");
    expect(extractRtfPlainText(rtf.toString("latin1"))).toContain("World");
  });

  it("detects and extracts HTML Word exports", () => {
    const html = Buffer.from(
      '<html xmlns:o="urn:schemas-microsoft-com:office:office"><body><p>Hello</p><p>World</p></body></html>',
    );
    expect(isHtmlWordDocument(html)).toBe(true);
    expect(extractHtmlPlainText(html.toString("utf8"))).toContain("Hello");
    expect(extractHtmlPlainText(html.toString("utf8"))).toContain("World");
  });

  it("detects and extracts Word 2003 XML", () => {
    const xml = Buffer.from(
      '<?xml version="1.0"?><w:wordDocument xmlns:w="http://schemas.microsoft.com/office/word/2003/wordml"><w:body><w:p><w:r><w:t>Line one</w:t></w:r></w:p><w:p><w:r><w:t>Line two</w:t></w:r></w:p></w:body></w:wordDocument>',
    );
    expect(isWordXmlDocument(xml)).toBe(true);
    expect(extractWordXmlPlainText(xml.toString("utf8"))).toBe("Line one\n\nLine two");
  });

  it("extractAlternateWordText routes by format", () => {
    const rtf = Buffer.from("{\\rtf1\\ansi Budget\\par Report}");
    expect(extractAlternateWordText(rtf)).toContain("Budget");
    expect(extractAlternateWordText(Buffer.from([0x00, 0x11, 0x22]))).toBe("");
  });

  it("prefers HTML extraction over Word XML heuristics for HTML .doc exports", () => {
    const html = Buffer.from(
      '\uFEFF<!DOCTYPE html><html xmlns:w="urn:schemas-microsoft-com:office:word"><head><!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View></w:WordDocument></xml><![endif]--></head><body><p>Medication Care Plan</p></body></html>',
    );
    expect(isWordXmlDocument(html)).toBe(false);
    expect(isHtmlWordDocument(html)).toBe(true);
    expect(extractAlternateWordText(html)).toContain("Medication Care Plan");
  });
});