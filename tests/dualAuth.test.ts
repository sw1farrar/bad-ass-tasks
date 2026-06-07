import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  DUAL_AUTH_COOKIE_NAME,
  DUAL_AUTH_REMEMBER_DAYS,
  generateDualAuthCode,
  hashDualAuthCode,
  isDualAuthEnforced,
  isDualAuthSatisfied,
  maskEmail,
  setDualAuthCookie,
  shouldPreserveDualAuthCookieOnSignOut,
} from "@/lib/auth/dualAuth";
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

  it("accepts a valid trusted-device cookie for the same user", () => {
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
  });

  it("uses a 30-day remember window for trusted devices", () => {
    const response = NextResponse.next();
    setDualAuthCookie(response, "user-123", true);
    const cookie = response.cookies.get(DUAL_AUTH_COOKIE_NAME);
    expect(cookie?.maxAge).toBe(DUAL_AUTH_REMEMBER_DAYS * 24 * 60 * 60);
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