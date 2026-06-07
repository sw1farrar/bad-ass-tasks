import {
  DUAL_AUTH_SEND_COOLDOWN_MS,
  computeDualAuthRetryAfterSeconds,
} from "@/lib/auth/dualAuth";

export type ActiveDualAuthChallenge = {
  id: string;
  created_at: string;
};

export type AtomicDualAuthChallengeResult =
  | { action: "send" }
  | { action: "already_sent"; retryAfterSeconds: number }
  | { action: "cooldown"; retryAfterSeconds: number }
  | { action: "rate_limited" };

type AdminClient = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        is: (column: string, value: null) => {
          gt: (column: string, value: string) => {
            order: (
              column: string,
              options: { ascending: boolean },
            ) => {
              limit: (count: number) => {
                maybeSingle: () => Promise<{
                  data: ActiveDualAuthChallenge | null;
                  error: { message?: string } | null;
                }>;
              };
            };
          };
        };
      };
    };
  };
  rpc: (
    fn: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message?: string } | null }>;
};

export async function fetchActiveDualAuthChallenge(
  admin: AdminClient,
  userId: string,
): Promise<ActiveDualAuthChallenge | null> {
  const nowIso = new Date().toISOString();
  const { data, error } = await admin
    .from("dual_auth_challenges")
    .select("id, created_at")
    .eq("user_id", userId)
    .is("consumed_at", null)
    .gt("expires_at", nowIso)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export function retryAfterForActiveChallenge(
  challenge: ActiveDualAuthChallenge | null,
  nowMs: number = Date.now(),
): number {
  if (!challenge?.created_at) return 0;
  return computeDualAuthRetryAfterSeconds(challenge.created_at, DUAL_AUTH_SEND_COOLDOWN_MS, nowMs);
}

export async function createDualAuthChallengeAtomic(
  admin: AdminClient,
  params: {
    userId: string;
    codeHash: string;
    expiresAt: string;
    force: boolean;
  },
): Promise<AtomicDualAuthChallengeResult> {
  const { data, error } = await admin.rpc("create_dual_auth_challenge_atomic", {
    p_user_id: params.userId,
    p_code_hash: params.codeHash,
    p_expires_at: params.expiresAt,
    p_force: params.force,
  });

  if (error) throw error;

  const payload = (data ?? {}) as {
    action?: string;
    retry_after_seconds?: number;
  };

  switch (payload.action) {
    case "already_sent":
      return {
        action: "already_sent",
        retryAfterSeconds: Math.max(0, payload.retry_after_seconds ?? 0),
      };
    case "cooldown":
      return {
        action: "cooldown",
        retryAfterSeconds: Math.max(0, payload.retry_after_seconds ?? 0),
      };
    case "rate_limited":
      return { action: "rate_limited" };
    case "send":
    default:
      return { action: "send" };
  }
}