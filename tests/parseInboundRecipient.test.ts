import { describe, it, expect } from "vitest";
import { parseInboundRecipientLocalPart } from "@/lib/brevo/parseInboundRecipient";
import type { BrevoInboundEmailItem } from "@/lib/brevo/inboundTypes";

describe("parseInboundRecipientLocalPart", () => {
  const item: BrevoInboundEmailItem = {
    Recipients: ["n-abc12345-deadbeef@inbound.badazztasks.com"],
    To: [{ Address: "n-abc12345-deadbeef@inbound.badazztasks.com" }],
    Subject: "Test",
  };

  it("parses local part from Recipients", () => {
    expect(parseInboundRecipientLocalPart(item, "inbound.badazztasks.com")).toBe(
      "n-abc12345-deadbeef",
    );
  });

  it("returns null for non-inbound addresses", () => {
    expect(
      parseInboundRecipientLocalPart(
        { Recipients: ["test@gmail.com"] },
        "inbound.badazztasks.com",
      ),
    ).toBeNull();
  });
});