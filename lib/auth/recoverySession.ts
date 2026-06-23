import type { Session } from "@supabase/supabase-js";

export const RECOVERY_FLOW_KEY = "bat_recovery_flow";
const RECOVERY_FLOW_MAX_AGE_MS = 60 * 60 * 1000;

type AmrClaim = string | { method?: string; timestamp?: number };

function decodeBase64Url(segment: string): string {
  const base64 = segment.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  if (typeof atob === "function") {
    return atob(padded);
  }
  return Buffer.from(padded, "base64").toString("utf8");
}

function getAmrMethods(accessToken: string): string[] {
  try {
    const parts = accessToken.split(".");
    if (parts.length < 2) return [];
    const parsed = JSON.parse(decodeBase64Url(parts[1])) as { amr?: AmrClaim[] };
    const amr = parsed.amr ?? [];
    return amr
      .map((entry) => (typeof entry === "string" ? entry : entry.method ?? ""))
      .filter((method) => method.length > 0);
  } catch {
    return [];
  }
}

/** True when the active session was created via password recovery (link or OTP). */
export function sessionHasRecoveryAuth(session: Session | null | undefined): boolean {
  if (!session?.access_token) return false;
  return getAmrMethods(session.access_token).includes("recovery");
}

export function markRecoveryFlow(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(RECOVERY_FLOW_KEY, String(Date.now()));
  } catch {
    // Ignore storage errors.
  }
}

export function clearRecoveryFlow(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(RECOVERY_FLOW_KEY);
  } catch {
    // Ignore storage errors.
  }
}

function hasRecoveryFlowMarker(maxAgeMs = RECOVERY_FLOW_MAX_AGE_MS): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = sessionStorage.getItem(RECOVERY_FLOW_KEY);
    if (!raw) return false;
    const ts = Number(raw);
    if (!Number.isFinite(ts)) return false;
    return Date.now() - ts <= maxAgeMs;
  } catch {
    return false;
  }
}

/**
 * True when the user must finish setting a new password before entering the app.
 * Uses session AMR (not user.recovery_sent_at, which stays set after any reset email).
 */
export function isRecoverySession(session: Session | null | undefined): boolean {
  if (!session?.access_token) return false;
  if (sessionHasRecoveryAuth(session)) return true;

  const methods = getAmrMethods(session.access_token);
  if (methods.length > 0) {
    return false;
  }

  return hasRecoveryFlowMarker();
}

export function buildRecoveryCallbackUrl(appBaseUrl: string): string {
  const base = appBaseUrl.replace(/\/$/, "");
  const next = encodeURIComponent("/login?mode=reset-verify");
  return `${base}/auth/callback?next=${next}`;
}

/** Build a minimal JWT payload for tests (signature segment is ignored). */
export function buildTestAccessToken(amr: string[]): string {
  const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ amr: amr.map((method) => ({ method, timestamp: 1 })) })).toString(
    "base64url",
  );
  return `${header}.${payload}.sig`;
}