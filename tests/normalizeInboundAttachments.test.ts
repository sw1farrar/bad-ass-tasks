import { describe, it, expect } from "vitest";
import {
  listInboundAttachments,
  normalizeInboundAttachment,
} from "@/lib/brevo/normalizeInboundAttachments";
import type { BrevoInboundEmailItem } from "@/lib/brevo/inboundTypes";

describe("normalizeInboundAttachments", () => {
  it("accepts PascalCase Brevo attachment fields", () => {
    expect(
      normalizeInboundAttachment({
        Name: "invoice.pdf",
        ContentType: "application/pdf",
        ContentLength: 1200,
        ContentID: "f_abc",
        DownloadToken: "token-1",
      }),
    ).toEqual({
      Name: "invoice.pdf",
      ContentType: "application/pdf",
      ContentLength: 1200,
      ContentID: "f_abc",
      DownloadToken: "token-1",
    });
  });

  it("accepts lowercase attachment fields", () => {
    expect(
      normalizeInboundAttachment({
        name: "photo.jpg",
        contentType: "image/jpeg",
        downloadToken: "token-2",
      }),
    ).toEqual({
      Name: "photo.jpg",
      ContentType: "image/jpeg",
      ContentID: undefined,
      ContentLength: undefined,
      DownloadToken: "token-2",
    });
  });

  it("rejects attachments missing name or download token", () => {
    expect(normalizeInboundAttachment({ Name: "x.pdf" })).toBeNull();
    expect(normalizeInboundAttachment({ DownloadToken: "tok" })).toBeNull();
    expect(normalizeInboundAttachment(null)).toBeNull();
  });

  it("lists only valid attachments from inbound email items", () => {
    const item = {
      Attachments: [
        { Name: "good.pdf", DownloadToken: "a" },
        { name: "also-good.png", downloadToken: "b" },
        { Name: "missing-token.pdf" },
      ],
    } as BrevoInboundEmailItem;

    expect(listInboundAttachments(item)).toEqual([
      { Name: "good.pdf", DownloadToken: "a" },
      { Name: "also-good.png", ContentType: undefined, ContentID: undefined, ContentLength: undefined, DownloadToken: "b" },
    ]);
  });
});