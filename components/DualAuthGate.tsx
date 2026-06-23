"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { fetchDualAuthStatus, type DualAuthStatusResponse } from "@/lib/auth/dualAuthClient";
import { isSupabaseConfigured } from "@/lib/supabase/client";

type DualAuthGateProps = {
  maskedEmail: string;
  onVerified: () => void;
  onSignOut: () => void;
};

/** loading → sending (optional) → enter_code */
type GatePhase = "loading" | "sending" | "enter_code";

type SendCodeResult = {
  ok: boolean;
  alreadyVerified?: boolean;
  alreadySent?: boolean;
  retryAfterSeconds?: number;
  error?: string;
};

async function requestDualAuthCode(options?: { force?: boolean }): Promise<SendCodeResult> {
  const response = await fetch("/api/auth/dual-auth/send", {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "include",
    body: JSON.stringify(options?.force ? { force: true, confirm: true } : { confirm: true }),
  });

  const payload = (await response.json().catch(() => ({}))) as {
    error?: string;
    alreadyVerified?: boolean;
    alreadySent?: boolean;
    retryAfterSeconds?: number;
  };

  if (payload.alreadyVerified) {
    return { ok: true, alreadyVerified: true };
  }

  if (response.status === 503) {
    return { ok: true, alreadyVerified: true };
  }

  if (!response.ok) {
    return {
      ok: false,
      error: payload.error || "Could not send verification code.",
      retryAfterSeconds: payload.retryAfterSeconds,
    };
  }

  return {
    ok: true,
    alreadySent: payload.alreadySent,
    retryAfterSeconds: payload.retryAfterSeconds,
  };
}

export function DualAuthGate({ maskedEmail, onVerified, onSignOut }: DualAuthGateProps) {
  const [phase, setPhase] = useState<GatePhase>("loading");
  const [code, setCode] = useState("");
  const [rememberDevice, setRememberDevice] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [codeDeliveryHint, setCodeDeliveryHint] = useState<"sent" | "existing" | "pending">("pending");

  const onVerifiedRef = useRef(onVerified);
  const initGenerationRef = useRef(0);

  useEffect(() => {
    onVerifiedRef.current = onVerified;
  }, [onVerified]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = window.setInterval(() => {
      setResendCooldown((value) => (value > 1 ? value - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendCooldown]);

  const showCodeEntry = useCallback(
    (retryAfterSeconds?: number, delivery: "sent" | "existing" | "pending" = "sent") => {
    setPhase("enter_code");
    setCodeDeliveryHint(delivery);
      if (retryAfterSeconds && retryAfterSeconds > 0) {
        setResendCooldown(retryAfterSeconds);
      }
    },
    [],
  );

  const sendCode = useCallback(
    async (options?: { force?: boolean; silent?: boolean }) => {
      if (!isSupabaseConfigured()) {
        showCodeEntry(undefined, "sent");
        return { ok: true as const };
      }

      if (!options?.silent) {
        setPhase("sending");
      }
      setError(null);

      try {
        const result = await requestDualAuthCode({ force: options?.force });
        if (result.alreadyVerified) {
          onVerifiedRef.current();
          return result;
        }

        if (!result.ok) {
          const message = result.error || "Could not send verification code.";
          setError(message);
          if (result.retryAfterSeconds) setResendCooldown(result.retryAfterSeconds);
          showCodeEntry(result.retryAfterSeconds, "pending");
          if (!options?.silent) {
            toast.error("Could not send code", { description: message });
          }
          return result;
        }

        showCodeEntry(result.retryAfterSeconds ?? 60, result.alreadySent ? "existing" : "sent");

        if (!options?.silent) {
          if (result.alreadySent) {
            toast.message("Code already sent", {
              description: `Use the code already emailed to ${maskedEmail}.`,
            });
          } else {
            toast.success("Code sent", { description: `Check ${maskedEmail} for your 6-digit code.` });
          }
        }

        return result;
      } catch {
        const message = "Something went wrong. Please try again.";
        setError(message);
        showCodeEntry(undefined, "pending");
        if (!options?.silent) toast.error("Could not send code");
        return { ok: false as const, error: message };
      }
    },
    [maskedEmail, showCodeEntry],
  );

  useEffect(() => {
    const generation = ++initGenerationRef.current;

    if (!isSupabaseConfigured()) {
      setPhase("enter_code");
      setCodeDeliveryHint("sent");
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const status: DualAuthStatusResponse = await fetchDualAuthStatus();
        if (cancelled || generation !== initGenerationRef.current) return;

        if (!status.required || status.verified) {
          onVerifiedRef.current();
          return;
        }

        if (status.hasActiveCode) {
          showCodeEntry(status.retryAfterSeconds, "existing");
          return;
        }

        await sendCode({ silent: true });
      } catch {
        if (!cancelled && generation === initGenerationRef.current) {
          setError("Could not start verification. Tap resend below.");
          setPhase("enter_code");
          setCodeDeliveryHint("pending");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sendCode, showCodeEntry]);

  const handleResend = async () => {
    if (resendCooldown > 0 || resending) return;
    setResending(true);
    try {
      await sendCode({ force: true });
    } finally {
      setResending(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code || code.length < 6) return;

    setVerifying(true);
    setError(null);

    if (!isSupabaseConfigured()) {
      setVerifying(false);
      toast.success("Demo: dual authentication complete");
      onVerifiedRef.current();
      return;
    }

    try {
      const response = await fetch("/api/auth/dual-auth/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ code: code.trim(), rememberDevice }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        alreadyVerified?: boolean;
      };

      if (payload.alreadyVerified) {
        onVerifiedRef.current();
        return;
      }

      if (!response.ok) {
        const message = payload.error || "Invalid or expired code.";
        setError(message);
        toast.error("Verification failed", { description: message });
        return;
      }

      toast.success(
        rememberDevice ? "This device is trusted" : "Signed in securely",
      );
      onVerifiedRef.current();
    } catch {
      setError("Something went wrong. Please try again.");
      toast.error("Verification error");
    } finally {
      setVerifying(false);
    }
  };

  const statusLine =
    phase === "sending"
      ? `Sending a code to ${maskedEmail}…`
      : codeDeliveryHint === "existing"
        ? `Enter the code we already sent to ${maskedEmail}.`
        : codeDeliveryHint === "sent"
          ? `Enter the 6-digit code sent to ${maskedEmail}.`
          : `Enter your 6-digit code for ${maskedEmail}.`;

  const busy = verifying || resending || phase === "sending";

  return (
    <div
      className="fixed inset-0 z-[250] flex items-end md:items-center justify-center bg-bg p-4"
      style={{
        paddingTop: "max(1rem, env(safe-area-inset-top))",
        paddingBottom: "max(1rem, env(safe-area-inset-bottom))",
      }}
    >
      <div className="dual-auth-gate glass modal-panel w-full max-w-md rounded-t-3xl md:rounded-3xl p-6 md:p-8 relative">
        <div className="flex justify-center pt-1 pb-3 md:hidden">
          <div className="confirmation-modal__drag-handle h-1 w-10 rounded-full" aria-hidden />
        </div>

        <div className="text-center mb-6">
          <div className="dual-auth-gate__icon mx-auto mb-4 h-12 w-12 rounded-2xl bg-gradient-to-br from-neon-purple to-neon-purple-dark flex items-center justify-center">
            <KeyRound className="h-6 w-6 text-on-accent" />
          </div>
          <h2 className="text-2xl md:text-3xl font-semibold tracking-tighter">Verify it&apos;s you</h2>
          <p className="text-text-secondary mt-2 text-sm leading-relaxed">{statusLine}</p>
        </div>

        {phase === "loading" && (
          <div className="flex flex-col items-center gap-3 py-6 text-sm text-text-secondary">
            <Loader2 className="h-5 w-5 animate-spin text-neon-purple" />
            Preparing verification…
          </div>
        )}

        {(phase === "sending" || phase === "enter_code") && (
          <form onSubmit={handleVerify} className="space-y-4">
            {error && (
              <div className="rounded-xl border border-[var(--priority-p1)]/40 bg-bg-secondary px-3 py-2 text-xs text-[var(--priority-p1)]">
                {error}
              </div>
            )}

            <label className="sr-only" htmlFor="dual-auth-code">
              6-digit verification code
            </label>
            <input
              id="dual-auth-code"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={code}
              onChange={(e) => {
                setCode(e.target.value.replace(/\D/g, ""));
                if (error) setError(null);
              }}
              placeholder="000000"
              className="input w-full px-4 py-3.5 rounded-2xl text-lg text-center tracking-[0.4em] font-mono"
              required
              autoComplete="one-time-code"
              autoFocus={phase === "enter_code"}
              disabled={phase === "sending"}
              aria-describedby="dual-auth-code-hint"
            />
            <p id="dual-auth-code-hint" className="text-center text-xs text-text-muted">
              Codes expire in 10 minutes.
            </p>

            <label className="flex items-start gap-3 rounded-2xl border border-border-glass bg-surface-overlay px-4 py-3 cursor-pointer">
              <input
                type="checkbox"
                checked={rememberDevice}
                onChange={(e) => setRememberDevice(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-border-glass bg-transparent accent-neon-purple"
              />
              <span className="text-sm text-text-secondary leading-snug">
                <span className="flex items-center gap-1.5 text-text-primary font-medium">
                  <ShieldCheck className="h-3.5 w-3.5 text-neon-purple" />
                  Trust this device
                </span>
                Skip verification on this browser until you clear site data or use another device.
              </span>
            </label>

            <button
              type="submit"
              disabled={busy || !code || code.length < 6}
              className="btn btn-primary w-full py-3.5 text-base disabled:opacity-60 min-h-[48px]"
            >
              {verifying ? "Verifying…" : "Continue"}
            </button>

            <button
              type="button"
              onClick={() => void handleResend()}
              disabled={busy || resendCooldown > 0}
              className="text-sm text-text-secondary hover:text-text-primary w-full text-center min-h-[44px] disabled:opacity-60"
            >
              {resending || phase === "sending" ? (
                <span className="inline-flex items-center justify-center gap-1.5">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Sending code…
                </span>
              ) : resendCooldown > 0 ? (
                `Resend code in ${resendCooldown}s`
              ) : codeDeliveryHint === "pending" ? (
                "Send verification code"
              ) : (
                "Didn't get it? Resend code"
              )}
            </button>
          </form>
        )}

        <button
          type="button"
          onClick={onSignOut}
          className="mt-6 text-xs text-text-muted hover:text-text-primary w-full text-center min-h-[44px]"
        >
          Sign out and use a different account
        </button>
      </div>
    </div>
  );
}