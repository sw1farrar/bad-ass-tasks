import { createHmac, randomInt, randomUUID, timingSafeEqual, createHash } from "crypto";
import type { NextRequest, NextResponse } from "next/server";
import { isBrevoConfigured } from "@/lib/brevo";
import { isSupabaseAdminConfigured } from "@/lib/supabase/admin";

export const DUAL_AUTH_COOKIE_NAME = "bat_dual_auth";
export const DUAL_AUTH_REMEMBER_DAYS = 30;
export const DUAL_AUTH_CODE_TTL_MS = 10 * 60 * 1000;
export const DUAL_AUTH_SESSION_TTL_MS = 12 * 60 * 60 * 1000;
export const DUAL_AUTH_MAX_SENDS_PER_WINDOW = 3;
export const DUAL_AUTH_SEND_WINDOW_MS = 10 * 60 * 1000;

type DualAuthCookiePayload = {
  v: 1;
  uid: string;
  exp: number;
  remember: boolean;
  did: string;
};

function getDualAuthSecret(): string {
  const explicit = process.env.DUAL_AUTH_SECRET?.trim();
  if (explicit && explicit.length >= 16) return explicit;

  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (serviceRole && serviceRole.length > 20) {
    return createHash("sha256").update(`dual-auth:${serviceRole}`).digest("hex");
  }

  throw new Error("Dual auth secret is not configured. Set DUAL_AUTH_SECRET or SUPABASE_SERVICE_ROLE_KEY.");
}

export function isDualAuthConfigured(): boolean {
  try {
    getDualAuthSecret();
    return true;
  } catch {
    return false;
  }
}

/** Live dual-auth is enforced only when signing secret, admin API, and email delivery are all ready. */
export function isDualAuthEnforced(): boolean {
  return isDualAuthConfigured() && isSupabaseAdminConfigured() && isBrevoConfigured();
}

function signPayload(encodedPayload: string): string {
  return createHmac("sha256", getDualAuthSecret()).update(encodedPayload).digest("base64url");
}

function encodeCookiePayload(payload: DualAuthCookiePayload): string {
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = signPayload(encoded);
  return `${encoded}.${signature}`;
}

function decodeCookiePayload(raw: string): DualAuthCookiePayload | null {
  const [encoded, signature] = raw.split(".");
  if (!encoded || !signature) return null;

  const expected = signPayload(encoded);
  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as DualAuthCookiePayload;
    if (parsed?.v !== 1 || !parsed.uid || !parsed.did || typeof parsed.exp !== "number") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function maskEmail(email: string): string {
  const normalized = email.trim().toLowerCase();
  const [local, domain] = normalized.split("@");
  if (!local || !domain) return "your email";
  const visible = local.length <= 2 ? local[0] ?? "*" : `${local.slice(0, 2)}***`;
  return `${visible}@${domain}`;
}

export function generateDualAuthCode(): string {
  return String(randomInt(100000, 1000000));
}

export function hashDualAuthCode(userId: string, code: string): string {
  return createHmac("sha256", getDualAuthSecret()).update(`${userId}:${code.trim()}`).digest("hex");
}

export function readDualAuthCookie(request: NextRequest): DualAuthCookiePayload | null {
  const raw = request.cookies.get(DUAL_AUTH_COOKIE_NAME)?.value;
  if (!raw) return null;
  return decodeCookiePayload(raw);
}

/** Remembered devices stay trusted across sign-out until the 30-day window expires. */
export function shouldPreserveDualAuthCookieOnSignOut(request: NextRequest): boolean {
  const payload = readDualAuthCookie(request);
  return !!payload?.remember && payload.exp > Date.now();
}

export function isDualAuthSatisfied(request: NextRequest, userId: string): boolean {
  if (!isDualAuthEnforced()) return true;

  const payload = readDualAuthCookie(request);
  if (!payload || payload.uid !== userId) return false;
  if (payload.exp <= Date.now()) return false;

  return true;
}

export function setDualAuthCookie(
  response: NextResponse,
  userId: string,
  rememberDevice: boolean,
): void {
  const now = Date.now();
  const exp = rememberDevice
    ? now + DUAL_AUTH_REMEMBER_DAYS * 24 * 60 * 60 * 1000
    : now + DUAL_AUTH_SESSION_TTL_MS;

  const payload: DualAuthCookiePayload = {
    v: 1,
    uid: userId,
    exp,
    remember: rememberDevice,
    did: randomUUID(),
  };

  const secure = process.env.NODE_ENV === "production";
  response.cookies.set(DUAL_AUTH_COOKIE_NAME, encodeCookiePayload(payload), {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    ...(rememberDevice
      ? { maxAge: DUAL_AUTH_REMEMBER_DAYS * 24 * 60 * 60 }
      : {}),
  });
}

export function clearDualAuthCookie(response: NextResponse): void {
  response.cookies.set(DUAL_AUTH_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}