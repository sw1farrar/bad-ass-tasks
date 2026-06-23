import { describe, it, expect } from "vitest";
import {
  formatLoginEventDetail,
  formatLoginEventLabel,
  type LoginEventRow,
} from "@/lib/auth/loginActivityShared";

function row(partial: Partial<LoginEventRow> & Pick<LoginEventRow, "eventType">): LoginEventRow {
  return {
    id: "1",
    authMethod: "password",
    ipAddress: "1.2.3.4",
    userAgent: null,
    createdAt: "2026-06-18T12:00:00.000Z",
    metadata: {},
    ...partial,
  };
}

describe("login activity formatting", () => {
  it("labels failed sign-in attempts", () => {
    expect(formatLoginEventLabel("login_failed")).toBe("Sign-in failed");
    expect(
      formatLoginEventDetail(
        row({
          eventType: "login_failed",
          metadata: { reason: "invalid_credentials" },
        }),
      ),
    ).toBe("Wrong email or password");
  });

  it("describes verification attempts without code entry", () => {
    expect(formatLoginEventLabel("dual_auth_prompted")).toBe("Verification pending");
    expect(
      formatLoginEventDetail(
        row({
          eventType: "dual_auth_prompted",
          metadata: { alreadySent: true, codeEntered: false },
        }),
      ),
    ).toBe("Code was sent — not entered yet");
  });

  it("describes sign-in that still needs verification", () => {
    expect(
      formatLoginEventDetail(
        row({
          eventType: "login_success",
          metadata: { dualAuthPending: true },
        }),
      ),
    ).toBe("Password accepted — verification still required");
  });

  it("describes sign-out that keeps a trusted device", () => {
    expect(
      formatLoginEventDetail(
        row({
          eventType: "logout",
          metadata: { preserveTrustedDevice: true },
        }),
      ),
    ).toBe("Trusted device remembered for next sign-in");
  });

  it("describes abandoned verification", () => {
    expect(
      formatLoginEventDetail(
        row({
          eventType: "dual_auth_abandoned",
          metadata: { hadActiveCode: true, reason: "verification_not_completed" },
        }),
      ),
    ).toBe("Signed out before entering verification code");
  });
});