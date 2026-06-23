import { describe, it, expect } from "vitest";
import { userHasEmailPassword } from "@/lib/auth/userAuthProviders";

describe("userHasEmailPassword", () => {
  it("returns true when an email identity exists", () => {
    expect(
      userHasEmailPassword({
        identities: [{ provider: "google" }, { provider: "email" }],
        app_metadata: { provider: "google" },
      } as never),
    ).toBe(true);
  });

  it("returns true when app metadata provider is email", () => {
    expect(
      userHasEmailPassword({
        identities: [],
        app_metadata: { provider: "email" },
      } as never),
    ).toBe(true);
  });

  it("returns false for google-only accounts", () => {
    expect(
      userHasEmailPassword({
        identities: [{ provider: "google" }],
        app_metadata: { provider: "google" },
      } as never),
    ).toBe(false);
  });
});