import { describe, expect, it } from "vitest";
import {
  assertAttachmentStoragePath,
  attachmentContentHeaders,
  normalizeMimeType,
} from "@/lib/notes/attachmentResponse";

describe("attachmentResponse", () => {
  it("serves safe images/pdf inline with nosniff", () => {
    const headers = attachmentContentHeaders("image/png", "photo.png");
    expect(headers["Content-Type"]).toBe("image/png");
    expect(headers["Content-Disposition"]).toMatch(/^inline;/);
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
    expect(headers["Cache-Control"]).toBe("private, no-store");
  });

  it("forces download for HTML / SVG (stored XSS)", () => {
    for (const mime of ["text/html", "image/svg+xml", "application/javascript"]) {
      const headers = attachmentContentHeaders(mime, "evil.html");
      expect(headers["Content-Type"]).toBe("application/octet-stream");
      expect(headers["Content-Disposition"]).toMatch(/^attachment;/);
    }
  });

  it("normalizes mime parameters", () => {
    expect(normalizeMimeType("image/jpeg; charset=binary")).toBe("image/jpeg");
  });

  it("rejects storage paths outside workspace prefix", () => {
    const ws = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
    expect(() => assertAttachmentStoragePath(`${ws}/n/a/file.pdf`, ws)).not.toThrow();
    expect(() =>
      assertAttachmentStoragePath("other-ws/n/a/file.pdf", ws),
    ).toThrow("attachment_path_mismatch");
    expect(() => assertAttachmentStoragePath(`${ws}/../escape`, ws)).toThrow(
      "attachment_path_mismatch",
    );
  });
});
