import { afterEach, describe, it, expect } from "vitest";
import {
  RECOVERY_FLOW_KEY,
  buildRecoveryCallbackUrl,
  buildTestAccessToken,
  clearRecoveryFlow,
  isRecoverySession,
  markRecoveryFlow,
  sessionHasRecoveryAuth,
} from "@/lib/auth/recoverySession";
import type { Session } from "@supabase/supabase-js";

function sessionWithAmr(amr: string[]): Session {
  return {
    access_token: buildTestAccessToken(amr),
    refresh_token: "refresh",
    expires_in: 3600,
    token_type: "bearer",
    user: {
      id: "user-1",
      recovery_sent_at: "2026-06-18T12:00:00Z",
    } as Session["user"],
  };
}

describe("recoverySession helpers", () => {
  afterEach(() => {
    clearRecoveryFlow();
    sessionStorage.clear();
  });

  it("detects recovery from session AMR, not stale recovery_sent_at", () => {
    expect(sessionHasRecoveryAuth(sessionWithAmr(["recovery"]))).toBe(true);
    expect(sessionHasRecoveryAuth(sessionWithAmr(["password"]))).toBe(false);
    expect(isRecoverySession(sessionWithAmr(["password"]))).toBe(false);
    expect(isRecoverySession(null)).toBe(false);
  });

  it("ignores a stale recovery marker when the session AMR is password", () => {
    markRecoveryFlow();
    expect(sessionStorage.getItem(RECOVERY_FLOW_KEY)).toBeTruthy();
    expect(isRecoverySession(sessionWithAmr(["password"]))).toBe(false);
  });

  it("honors a recovery flow marker only while AMR is not yet available", () => {
    markRecoveryFlow();
    const pendingSession: Session = {
      access_token: "not-a-jwt",
      refresh_token: "refresh",
      expires_in: 3600,
      token_type: "bearer",
      user: { id: "user-1" } as Session["user"],
    };
    expect(isRecoverySession(pendingSession)).toBe(true);
    clearRecoveryFlow();
    expect(isRecoverySession(pendingSession)).toBe(false);
  });

  it("builds callback URLs that exchange recovery codes before reset UI", () => {
    expect(buildRecoveryCallbackUrl("https://badazztasks.com/")).toBe(
      "https://badazztasks.com/auth/callback?next=%2Flogin%3Fmode%3Dreset-verify",
    );
  });
});