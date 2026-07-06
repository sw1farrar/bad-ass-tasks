import { describe, expect, it } from "vitest";
import { formatPasswordUpdateError } from "@/lib/auth/passwordUpdateErrors";

describe("formatPasswordUpdateError", () => {
  it("maps same-password errors to actionable guidance", () => {
    expect(
      formatPasswordUpdateError("New password should be different from the old password."),
    ).toBe("Choose a password you have not used on this account before.");
  });

  it("passes through minimum-length errors", () => {
    expect(formatPasswordUpdateError("Password should be at least 6 characters.")).toBe(
      "Password should be at least 6 characters.",
    );
  });

  it("maps expired recovery sessions", () => {
    expect(formatPasswordUpdateError("Auth session missing!")).toBe(
      "Your reset session expired. Request a new recovery code and try again.",
    );
  });

  it("falls back when the provider sends no message", () => {
    expect(formatPasswordUpdateError(undefined)).toBe(
      "Could not update password. Please try again.",
    );
  });
});
