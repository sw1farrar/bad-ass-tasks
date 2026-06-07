import { describe, it, expect } from "vitest";
import { decideDualAuthSend } from "@/lib/auth/dualAuthSendPolicy";

describe("decideDualAuthSend", () => {
  const now = Date.parse("2026-06-07T12:00:00.000Z");

  it("reuses an active code for auto-send within the idempotency window", () => {
    const decision = decideDualAuthSend({
      force: false,
      recentChallengeCreatedAt: "2026-06-07T11:59:30.000Z",
      sendsInWindow: 1,
      nowMs: now,
    });

    expect(decision).toEqual({ action: "already_sent", retryAfterSeconds: 30 });
  });

  it("blocks forced resend during the cooldown window", () => {
    const decision = decideDualAuthSend({
      force: true,
      recentChallengeCreatedAt: "2026-06-07T11:59:40.000Z",
      sendsInWindow: 1,
      nowMs: now,
    });

    expect(decision).toEqual({ action: "cooldown", retryAfterSeconds: 40 });
  });

  it("allows forced resend after cooldown even inside idempotency window", () => {
    const decision = decideDualAuthSend({
      force: true,
      recentChallengeCreatedAt: "2026-06-07T11:58:30.000Z",
      sendsInWindow: 1,
      nowMs: now,
    });

    expect(decision).toEqual({ action: "send" });
  });

  it("rate limits excessive sends in the rolling window", () => {
    const decision = decideDualAuthSend({
      force: true,
      recentChallengeCreatedAt: "2026-06-07T11:00:00.000Z",
      sendsInWindow: 3,
      nowMs: now,
    });

    expect(decision).toEqual({ action: "rate_limited" });
  });
});