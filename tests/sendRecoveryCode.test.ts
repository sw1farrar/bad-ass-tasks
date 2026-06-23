import { describe, it, expect, vi, beforeEach } from "vitest";

const generateLink = vi.fn();
const sendPasswordResetEmail = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  isSupabaseAdminConfigured: () => true,
  createAdminSupabaseClient: () => ({
    auth: { admin: { generateLink } },
  }),
}));

vi.mock("@/lib/brevo", () => ({
  isBrevoConfigured: () => true,
  getBrevoConfig: () => ({ appBaseUrl: "https://badazztasks.com" }),
  sendPasswordResetEmail: (...args: unknown[]) => sendPasswordResetEmail(...args),
}));

import { sendRecoveryCode } from "@/lib/auth/sendRecoveryCode";

describe("sendRecoveryCode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends a Brevo email when Supabase returns a recovery OTP", async () => {
    generateLink.mockResolvedValue({
      data: { properties: { email_otp: "123456" } },
      error: null,
    });
    sendPasswordResetEmail.mockResolvedValue({ ok: true, messageId: "msg-1" });

    const result = await sendRecoveryCode("user@example.com");

    expect(result).toEqual({ ok: true, sent: true, messageId: "msg-1" });
    expect(generateLink).toHaveBeenCalledWith({
      type: "recovery",
      email: "user@example.com",
      options: {
        redirectTo: "https://badazztasks.com/auth/callback?next=%2Flogin%3Fmode%3Dreset-verify",
      },
    });
    expect(sendPasswordResetEmail).toHaveBeenCalledWith({
      to: "user@example.com",
      code: "123456",
    });
  });

  it("returns ok without sending when the user does not exist", async () => {
    generateLink.mockResolvedValue({
      data: null,
      error: { message: "User with this email not found" },
    });

    const result = await sendRecoveryCode("missing@example.com");

    expect(result).toEqual({ ok: true, sent: false });
    expect(sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it("surfaces email delivery failures", async () => {
    generateLink.mockResolvedValue({
      data: { properties: { email_otp: "123456" } },
      error: null,
    });
    sendPasswordResetEmail.mockResolvedValue({ ok: false, reason: "smtp down" });

    const result = await sendRecoveryCode("user@example.com");

    expect(result).toEqual({
      ok: false,
      reason: "Reset code could not be sent. Try again in a few minutes.",
      status: 502,
    });
  });
});