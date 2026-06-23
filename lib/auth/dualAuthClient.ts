export const DUAL_AUTH_BOOTSTRAP_KEY = "bat_dual_auth_bootstrap";
export const DUAL_AUTH_BOOTSTRAP_COOKIE = "bat_dual_auth_bootstrap";

export type DualAuthBootstrap = {
  required: boolean;
  verified: boolean;
  enforced: boolean;
  email: string;
  hasActiveCode?: boolean;
  retryAfterSeconds?: number;
};

type StoredDualAuthBootstrap = DualAuthBootstrap & { ts: number };

export type DualAuthStatusResponse = DualAuthBootstrap & {
  hasActiveCode?: boolean;
  retryAfterSeconds?: number;
  error?: string;
};

export function stashDualAuthBootstrap(status: DualAuthBootstrap): void {
  if (typeof window === "undefined") return;
  try {
    const stored: StoredDualAuthBootstrap = { ...status, ts: Date.now() };
    sessionStorage.setItem(DUAL_AUTH_BOOTSTRAP_KEY, JSON.stringify(stored));
  } catch {
    // Ignore quota / private-mode errors.
  }
}

function parseBootstrap(raw: string): DualAuthBootstrap | null {
  try {
    const parsed = JSON.parse(raw) as Partial<StoredDualAuthBootstrap>;
    if (
      typeof parsed.required !== "boolean" ||
      typeof parsed.verified !== "boolean" ||
      typeof parsed.enforced !== "boolean" ||
      typeof parsed.email !== "string"
    ) {
      return null;
    }
    return {
      required: parsed.required,
      verified: parsed.verified,
      enforced: parsed.enforced,
      email: parsed.email,
      hasActiveCode: parsed.hasActiveCode,
      retryAfterSeconds: parsed.retryAfterSeconds,
    };
  } catch {
    return null;
  }
}

export function consumeDualAuthBootstrap(maxAgeMs = 30_000): DualAuthBootstrap | null {
  if (typeof window === "undefined") return null;

  let bootstrap: DualAuthBootstrap | null = null;

  try {
    const raw = sessionStorage.getItem(DUAL_AUTH_BOOTSTRAP_KEY);
    sessionStorage.removeItem(DUAL_AUTH_BOOTSTRAP_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as StoredDualAuthBootstrap;
      if (Date.now() - (parsed.ts ?? 0) <= maxAgeMs) {
        bootstrap = parseBootstrap(raw);
      }
    }
  } catch {
    // Ignore parse errors.
  }

  if (bootstrap) return bootstrap;

  try {
    const match = document.cookie
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${DUAL_AUTH_BOOTSTRAP_COOKIE}=`));
    if (!match) return null;

    const value = decodeURIComponent(match.slice(DUAL_AUTH_BOOTSTRAP_COOKIE.length + 1));
    document.cookie = `${DUAL_AUTH_BOOTSTRAP_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
    return parseBootstrap(value);
  } catch {
    return null;
  }
}

export function applyDualAuthBootstrap(
  bootstrap: DualAuthBootstrap,
): Pick<DualAuthStatusResponse, "required" | "verified" | "enforced" | "email" | "hasActiveCode" | "retryAfterSeconds"> {
  return {
    required: bootstrap.required,
    verified: bootstrap.verified,
    enforced: bootstrap.enforced,
    email: bootstrap.email,
    hasActiveCode: bootstrap.hasActiveCode ?? false,
    retryAfterSeconds: bootstrap.retryAfterSeconds ?? 0,
  };
}

export async function fetchDualAuthStatus(): Promise<DualAuthStatusResponse> {
  const response = await fetch("/api/auth/dual-auth/status", {
    cache: "no-store",
    credentials: "include",
  });
  const payload = (await response.json().catch(() => ({}))) as DualAuthStatusResponse;
  if (!response.ok) {
    return { ...payload, error: payload.error ?? "Unauthorized" };
  }
  return payload;
}