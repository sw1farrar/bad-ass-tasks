import {
  DUAL_AUTH_IDEMPOTENCY_MS,
  DUAL_AUTH_MAX_SENDS_PER_WINDOW,
  DUAL_AUTH_SEND_COOLDOWN_MS,
  computeDualAuthRetryAfterSeconds,
} from "@/lib/auth/dualAuth";

export type DualAuthSendDecision =
  | { action: "send" }
  | { action: "already_sent"; retryAfterSeconds: number }
  | { action: "cooldown"; retryAfterSeconds: number }
  | { action: "rate_limited" };

export function decideDualAuthSend(params: {
  force: boolean;
  recentChallengeCreatedAt: string | null;
  sendsInWindow: number;
  nowMs?: number;
}): DualAuthSendDecision {
  const nowMs = params.nowMs ?? Date.now();

  if (params.recentChallengeCreatedAt) {
    const createdMs = new Date(params.recentChallengeCreatedAt).getTime();
    const ageMs = Number.isNaN(createdMs) ? Number.POSITIVE_INFINITY : nowMs - createdMs;

    if (!params.force && ageMs < DUAL_AUTH_IDEMPOTENCY_MS) {
      return {
        action: "already_sent",
        retryAfterSeconds: computeDualAuthRetryAfterSeconds(
          params.recentChallengeCreatedAt,
          DUAL_AUTH_SEND_COOLDOWN_MS,
          nowMs,
        ),
      };
    }

    if (params.force && ageMs < DUAL_AUTH_SEND_COOLDOWN_MS) {
      return {
        action: "cooldown",
        retryAfterSeconds: computeDualAuthRetryAfterSeconds(
          params.recentChallengeCreatedAt,
          DUAL_AUTH_SEND_COOLDOWN_MS,
          nowMs,
        ),
      };
    }
  }

  if (params.sendsInWindow >= DUAL_AUTH_MAX_SENDS_PER_WINDOW) {
    return { action: "rate_limited" };
  }

  return { action: "send" };
}