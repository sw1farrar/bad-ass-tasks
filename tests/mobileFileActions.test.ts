import { describe, expect, it } from "vitest";
import {
  buildEmailShareUrl,
  buildTextShareUrl,
  isImagePreviewFile,
  toAbsolutePreviewUrl,
} from "@/lib/preview/mobileFileActions";

describe("mobileFileActions", () => {
  describe("isImagePreviewFile", () => {
    it("detects images by mime type", () => {
      expect(isImagePreviewFile("image/png", "doc.pdf")).toBe(true);
    });

    it("detects images by extension", () => {
      expect(isImagePreviewFile(undefined, "photo.jpeg")).toBe(true);
    });

    it("rejects non-images", () => {
      expect(isImagePreviewFile("application/pdf", "report.pdf")).toBe(false);
    });
  });

  describe("toAbsolutePreviewUrl", () => {
    it("resolves relative API urls", () => {
      const url = toAbsolutePreviewUrl("/api/notes/n1/attachments/a1");
      expect(url).toContain("/api/notes/n1/attachments/a1");
    });
  });

  describe("share url builders", () => {
    const ref = {
      url: "/api/notes/n1/attachments/a1",
      fileName: "scan.pdf",
    };

    it("builds mailto links", () => {
      expect(buildEmailShareUrl(ref)).toMatch(/^mailto:\?subject=/);
      expect(decodeURIComponent(buildEmailShareUrl(ref))).toContain("scan.pdf");
    });

    it("builds sms links", () => {
      expect(buildTextShareUrl(ref)).toMatch(/^sms:\?&body=/);
      expect(decodeURIComponent(buildTextShareUrl(ref))).toContain("scan.pdf");
    });
  });
});