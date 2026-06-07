import type { NextRequest } from "next/server";
import { isBrevoConfigured } from "@/lib/brevo/config";
import { isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { DUAL_AUTH_COOKIE_NAME } from "@/lib/auth/dualAuthConstants";

type DualAuthCookiePayload = {
  v: 1;
  uid: string;
  exp: number;
  remember: boolean;
  did: string;
};

let cachedSecret: string | null = null;

function isDualAuthSecretAvailable(): boolean {
  const explicit = process.env.DUAL_AUTH_SECRET?.trim();
  if (explicit && explicit.length >= 16) return true;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  return !!(serviceRole && serviceRole.length > 20);
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(str: string): Uint8Array {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  const binary = atob(padded + pad);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!;
  return diff === 0;
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function getDualAuthSecret(): Promise<string> {
  if (cachedSecret) return cachedSecret;

  const explicit = process.env.DUAL_AUTH_SECRET?.trim();
  if (explicit && explicit.length >= 16) {
    cachedSecret = explicit;
    return cachedSecret;
  }

  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (serviceRole && serviceRole.length > 20) {
    cachedSecret = await sha256Hex(`dual-auth:${serviceRole}`);
    return cachedSecret;
  }

  throw new Error("Dual auth secret is not configured. Set DUAL_AUTH_SECRET or SUPABASE_SERVICE_ROLE_KEY.");
}

async function signPayload(encodedPayload: string): Promise<string> {
  const secret = await getDualAuthSecret();
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(encodedPayload));
  return base64UrlEncode(new Uint8Array(signature));
}

async function decodeCookiePayload(raw: string): Promise<DualAuthCookiePayload | null> {
  const [encoded, signature] = raw.split(".");
  if (!encoded || !signature) return null;

  const expected = await signPayload(encoded);
  const sigBuf = base64UrlDecode(signature);
  const expBuf = base64UrlDecode(expected);
  if (!timingSafeEqual(sigBuf, expBuf)) return null;

  try {
    const json = new TextDecoder().decode(base64UrlDecode(encoded));
    const parsed = JSON.parse(json) as DualAuthCookiePayload;
    if (parsed?.v !== 1 || !parsed.uid || !parsed.did || typeof parsed.exp !== "number") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

async function readDualAuthCookie(request: NextRequest): Promise<DualAuthCookiePayload | null> {
  const raw = request.cookies.get(DUAL_AUTH_COOKIE_NAME)?.value;
  if (!raw) return null;
  return decodeCookiePayload(raw);
}

/** Live dual-auth is enforced only when signing secret, admin API, and email delivery are all ready. */
export function isDualAuthEnforced(): boolean {
  return isDualAuthSecretAvailable() && isSupabaseAdminConfigured() && isBrevoConfigured();
}

export async function isDualAuthSatisfied(request: NextRequest, userId: string): Promise<boolean> {
  if (!isDualAuthEnforced()) return true;

  const payload = await readDualAuthCookie(request);
  if (!payload || payload.uid !== userId) return false;
  if (payload.remember) return true;
  if (payload.exp <= Date.now()) return false;

  return true;
}