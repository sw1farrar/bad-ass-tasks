import { describe, expect, it } from "vitest";
import {
  isListShareRecipient,
  listShareRecipientMismatchMessage,
} from "@/lib/list-share/listShareRecipientAuth";

describe("listShareRecipientAuth", () => {
  it("accepts the invited user id", () => {
    expect(
      isListShareRecipient(
        { invitedUserId: "user-a", recipientEmail: "rachel@example.com" },
        { id: "user-a", email: "other@example.com" },
      ),
    ).toBe(true);
  });

  it("accepts a matching recipient email when user ids differ", () => {
    expect(
      isListShareRecipient(
        { invitedUserId: "user-a", recipientEmail: "Rachel@Example.com" },
        { id: "user-b", email: "rachel@example.com" },
      ),
    ).toBe(true);
  });

  it("rejects when neither user id nor email match", () => {
    expect(
      isListShareRecipient(
        { invitedUserId: "user-a", recipientEmail: "rachel@example.com" },
        { id: "user-b", email: "steve@example.com" },
      ),
    ).toBe(false);
  });

  it("returns an email-specific mismatch message when recipient email exists", () => {
    expect(
      listShareRecipientMismatchMessage({ recipientEmail: "rachel@example.com" }),
    ).toContain("email address");
  });
});