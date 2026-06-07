import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  DUAL_AUTH_COOKIE_NAME,
  DUAL_AUTH_REMEMBER_MAX_AGE_SEC,
  DUAL_AUTH_SEND_COOLDOWN_MS,
  computeDualAuthRetryAfterSeconds,
  generateDualAuthCode,
  hashDualAuthCode,
  isDualAuthEnforced,
  isDualAuthSatisfied,
  maskEmail,
  setDualAuthCookie,
  shouldPreserveDualAuthCookieOnSignOut,
} from "@/lib/auth/dualAuth";
import { isDualAuthSatisfied as isDualAuthSatisfiedEdge } from "@/lib/auth/dualAuthEdge";
import { NextRequest, NextResponse } from "next/server";

describe("dual auth helpers", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      DUAL_AUTH_SECRET: "test-dual-auth-secret-value",
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "service-role-key-long-enough-for-admin",
      BREVO_API_KEY: "xkeysib-real-key",
      BREVO_SENDER_EMAIL: "alert@badazztasks.com",
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("masks email addresses for display", () => {
    expect(maskEmail("alex@example.com")).toBe("al***@example.com");
    expect(maskEmail("a@example.com")).toBe("a@example.com");
  });

  it("generates 6-digit numeric codes", () => {
    const code = generateDualAuthCode();
    expect(code).toMatch(/^\d{6}$/);
  });

  it("hashes codes deterministically per user", () => {
    const first = hashDualAuthCode("user-1", "123456");
    const second = hashDualAuthCode("user-1", "123456");
    const otherUser = hashDualAuthCode("user-2", "123456");
    expect(first).toBe(second);
    expect(first).not.toBe(otherUser);
  });

  it("accepts a valid trusted-device cookie for the same user", async () => {
    const response = NextResponse.next();
    setDualAuthCookie(response, "user-123", true);

    const cookie = response.cookies.get(DUAL_AUTH_COOKIE_NAME);
    expect(cookie?.value).toBeTruthy();

    const request = new NextRequest("http://localhost:3000/", {
      headers: {
        cookie: `${DUAL_AUTH_COOKIE_NAME}=${cookie?.value}`,
      },
    });

    expect(isDualAuthSatisfied(request, "user-123")).toBe(true);
    expect(isDualAuthSatisfied(request, "other-user")).toBe(false);
    expect(await isDualAuthSatisfiedEdge(request, "user-123")).toBe(true);
    expect(await isDualAuthSatisfiedEdge(request, "other-user")).toBe(false);
  });

  it("uses a long-lived remember cookie for trusted devices", () => {
    const response = NextResponse.next();
    setDualAuthCookie(response, "user-123", true);
    const cookie = response.cookies.get(DUAL_AUTH_COOKIE_NAME);
    expect(cookie?.maxAge).toBe(DUAL_AUTH_REMEMBER_MAX_AGE_SEC);
  });

  it("requires admin + brevo before dual auth is enforced", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "";
    process.env.BREVO_API_KEY = "";
    process.env.BREVO_SENDER_EMAIL = "";
    expect(isDualAuthEnforced()).toBe(false);

    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key-long-enough-for-admin";
    process.env.BREVO_API_KEY = "xkeysib-real-key";
    process.env.BREVO_SENDER_EMAIL = "alert@badazztasks.com";
    expect(isDualAuthEnforced()).toBe(true);
  });

  it("preserves remembered-device cookies on sign-out", () => {
    const response = NextResponse.next();
    setDualAuthCookie(response, "user-123", true);
    const cookie = response.cookies.get(DUAL_AUTH_COOKIE_NAME);

    const request = new NextRequest("http://localhost:3000/", {
      headers: {
        cookie: `${DUAL_AUTH_COOKIE_NAME}=${cookie?.value}`,
      },
    });

    expect(shouldPreserveDualAuthCookieOnSignOut(request)).toBe(true);
  });

  it("computes resend cooldown from the last challenge timestamp", () => {
    const now = Date.parse("2026-06-07T12:01:00.000Z");
    expect(
      computeDualAuthRetryAfterSeconds("2026-06-07T12:00:30.000Z", DUAL_AUTH_SEND_COOLDOWN_MS, now),
    ).toBe(30);
    expect(
      computeDualAuthRetryAfterSeconds("2026-06-07T11:59:00.000Z", DUAL_AUTH_SEND_COOLDOWN_MS, now),
    ).toBe(0);
  });

  it("clears session-only dual auth cookies on sign-out", () => {
    const response = NextResponse.next();
    setDualAuthCookie(response, "user-123", false);
    const cookie = response.cookies.get(DUAL_AUTH_COOKIE_NAME);

    const request = new NextRequest("http://localhost:3000/", {
      headers: {
        cookie: `${DUAL_AUTH_COOKIE_NAME}=${cookie?.value}`,
      },
    });

    expect(shouldPreserveDualAuthCookieOnSignOut(request)).toBe(false);
  });
});