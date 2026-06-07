export const DUAL_AUTH_COOKIE_NAME = "bat_dual_auth";
/** Persistent trusted-device cookie (until user clears site data). */
export const DUAL_AUTH_REMEMBER_MAX_AGE_SEC = 10 * 365 * 24 * 60 * 60;
export const DUAL_AUTH_CODE_TTL_MS = 10 * 60 * 1000;
export const DUAL_AUTH_SESSION_TTL_MS = 12 * 60 * 60 * 1000;
export const DUAL_AUTH_MAX_SENDS_PER_WINDOW = 3;
export const DUAL_AUTH_SEND_WINDOW_MS = 10 * 60 * 1000;
/** Minimum gap before a new code may be emailed (resend button + second device). */
export const DUAL_AUTH_SEND_COOLDOWN_MS = 60 * 1000;
/** Auto-send is idempotent within this window — reuses the active code, no duplicate email. */
export const DUAL_AUTH_IDEMPOTENCY_MS = 2 * 60 * 1000;

export function computeDualAuthRetryAfterSeconds(
  lastSentAtIso: string,
  cooldownMs: number = DUAL_AUTH_SEND_COOLDOWN_MS,
  nowMs: number = Date.now(),
): number {
  const elapsed = nowMs - new Date(lastSentAtIso).getTime();
  if (Number.isNaN(elapsed) || elapsed >= cooldownMs) return 0;
  return Math.ceil((cooldownMs - elapsed) / 1000);
}