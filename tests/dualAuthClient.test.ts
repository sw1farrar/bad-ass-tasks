import { describe, it, expect } from "vitest";
import { applyDualAuthBootstrap } from "@/lib/auth/dualAuthClient";

describe("dualAuthClient helpers", () => {
  it("maps bootstrap payload into status fields", () => {
    expect(
      applyDualAuthBootstrap({
        required: true,
        verified: false,
        enforced: true,
        email: "al***@example.com",
        hasActiveCode: true,
        retryAfterSeconds: 42,
      }),
    ).toEqual({
      required: true,
      verified: false,
      enforced: true,
      email: "al***@example.com",
      hasActiveCode: true,
      retryAfterSeconds: 42,
    });
  });

  it("defaults optional bootstrap fields", () => {
    expect(
      applyDualAuthBootstrap({
        required: false,
        verified: true,
        enforced: false,
        email: "you@example.com",
      }),
    ).toEqual({
      required: false,
      verified: true,
      enforced: false,
      email: "you@example.com",
      hasActiveCode: false,
      retryAfterSeconds: 0,
    });
  });
});