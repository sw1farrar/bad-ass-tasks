import { describe, it, expect } from "vitest";
import { retryAfterForActiveChallenge } from "@/lib/auth/dualAuthChallenges";

describe("dualAuthChallenges helpers", () => {
  it("computes resend cooldown from the active challenge timestamp", () => {
    const now = Date.parse("2026-06-07T12:01:00.000Z");
    expect(
      retryAfterForActiveChallenge(
        { id: "c1", created_at: "2026-06-07T12:00:40.000Z" },
        now,
      ),
    ).toBe(40);
    expect(retryAfterForActiveChallenge(null, now)).toBe(0);
  });
});