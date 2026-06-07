"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { KeyRound, Loader2, Mail, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { ConfirmationModal } from "@/components/ConfirmationModal";
import { isSupabaseConfigured } from "@/lib/supabase/client";

type DualAuthGateProps = {
  maskedEmail: string;
  onVerified: () => void;
  onSignOut: () => void;
};

type GatePhase = "loading" | "prompt" | "idle" | "enter_code";

type SendCodeResult = {
  ok: boolean;
  alreadySent?: boolean;
  retryAfterSeconds?: number;
  error?: string;
};

type DualAuthStatus = {
  verified?: boolean;
  hasActiveCode?: boolean;
  retryAfterSeconds?: number;
};

async function fetchDualAuthStatus(): Promise<DualAuthStatus> {
  const response = await fetch("/api/auth/dual-auth/status", { cache: "no-store" });
  const payload = (await response.json().catch(() => ({}))) as DualAuthStatus & { error?: string };
  if (!response.ok) return {};
  return payload;
}

async function requestDualAuthCode(options?: { force?: boolean }): Promise<SendCodeResult> {
  const response = await fetch("/api/auth/dual-auth/send", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(options?.force ? { force: true } : { confirm: true }),
  });

  const payload = (await response.json().catch(() => ({}))) as {
    error?: string;
    alreadyVerified?: boolean;
    alreadySent?: boolean;
    retryAfterSeconds?: number;
  };

  if (payload.alreadyVerified) {
    return { ok: true, alreadySent: true };
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
  const [promptOpen, setPromptOpen] = useState(false);
  const [code, setCode] = useState("");
  const [rememberDevice, setRememberDevice] = useState(true);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [codeSent, setCodeSent] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const onVerifiedRef = useRef(onVerified);
  const statusCheckedRef = useRef(false);

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

  const enterCodePhase = useCallback((retryAfterSeconds?: number) => {
    setCodeSent(true);
    setPhase("enter_code");
    setPromptOpen(false);
    if (retryAfterSeconds && retryAfterSeconds > 0) {
      setResendCooldown(retryAfterSeconds);
    }
  }, []);

  const applySendResult = useCallback(
    (result: SendCodeResult) => {
      if (!result.ok) {
        const message = result.error || "Could not send verification code.";
        setError(message);
        if (result.retryAfterSeconds) setResendCooldown(result.retryAfterSeconds);
        toast.error("Could not send code", { description: message });
        return false;
      }

      enterCodePhase(result.retryAfterSeconds ?? 60);

      if (result.alreadySent) {
        toast.message("Code already active", {
          description: `Use the verification code already sent to ${maskedEmail}.`,
        });
      } else {
        toast.success("Code sent", {
          description: `One email was sent to ${maskedEmail}.`,
        });
      }

      return true;
    },
    [enterCodePhase, maskedEmail],
  );

  useEffect(() => {
    if (statusCheckedRef.current) return;
    statusCheckedRef.current = true;

    if (!isSupabaseConfigured()) {
      setPhase("enter_code");
      setCodeSent(true);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const status = await fetchDualAuthStatus();
        if (cancelled) return;

        if (status.verified) {
          onVerifiedRef.current();
          return;
        }

        if (status.hasActiveCode) {
          enterCodePhase(status.retryAfterSeconds);
          return;
        }

        setPhase("prompt");
        setPromptOpen(true);
      } catch {
        if (!cancelled) {
          setPhase("prompt");
          setPromptOpen(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enterCodePhase]);

  const handleConfirmSend = async () => {
    if (!isSupabaseConfigured()) {
      enterCodePhase();
      return;
    }

    setSending(true);
    setError(null);
    try {
      const result = await requestDualAuthCode({ force: false });
      if (!applySendResult(result)) {
        setPhase("idle");
      }
    } catch {
      setError("Something went wrong. Please try again.");
      toast.error("Could not send code");
      setPhase("idle");
    } finally {
      setSending(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0 || sending) return;

    setSending(true);
    setError(null);
    try {
      const result = await requestDualAuthCode({ force: true });
      applySendResult(result);
    } catch {
      setError("Something went wrong. Please try again.");
      toast.error("Could not resend code");
    } finally {
      setSending(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code) return;

    setLoading(true);
    setError(null);

    if (!isSupabaseConfigured()) {
      setLoading(false);
      toast.success("Demo: dual authentication complete");
      onVerifiedRef.current();
      return;
    }

    try {
      const response = await fetch("/api/auth/dual-auth/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
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
        rememberDevice ? "Device remembered for 30 days" : "Signed in securely",
      );
      onVerifiedRef.current();
    } catch {
      setError("Something went wrong. Please try again.");
      toast.error("Verification error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <ConfirmationModal
        open={promptOpen}
        onOpenChange={(open) => {
          setPromptOpen(open);
          if (!open && !codeSent && phase === "prompt") {
            setPhase("idle");
          }
        }}
        title="Send verification code?"
        description={`We'll email one 6-digit code to ${maskedEmail} to finish signing in. No code is sent until you confirm.`}
        confirmText="Send code now"
        cancelText="Cancel"
        onConfirm={handleConfirmSend}
        isLoading={sending}
      />

      <div className="fixed inset-0 z-[250] flex items-center justify-center bg-[#0a0a0f] p-4">
        <div className="glass w-full max-w-md rounded-3xl p-8 relative">
          <div className="text-center mb-6">
            <div className="mx-auto mb-4 h-12 w-12 rounded-2xl bg-gradient-to-br from-[#c084fc] to-[#a855f7] flex items-center justify-center">
              <KeyRound className="h-6 w-6 text-black" />
            </div>
            <h2 className="text-3xl font-semibold tracking-tighter">Verify your sign-in</h2>
            <p className="text-[#a1a1aa] mt-2 text-sm">
              Extra security for <span className="text-[#f4f4f5]">{maskedEmail}</span>
            </p>
          </div>

          {phase === "loading" && (
            <div className="flex flex-col items-center gap-3 py-8 text-sm text-[#a1a1aa]">
              <Loader2 className="h-5 w-5 animate-spin text-[#c084fc]" />
              Checking verification status…
            </div>
          )}

          {phase === "idle" && (
            <div className="space-y-4 text-center">
              <p className="text-sm text-[#a1a1aa] leading-relaxed">
                A verification code is required before you can access your workspaces. We will send
                exactly one email when you confirm.
              </p>
              {error && (
                <div className="rounded-xl border border-[#ff9500]/40 bg-[#111114] px-3 py-2 text-xs text-[#ff9500]">
                  {error}
                </div>
              )}
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setPhase("prompt");
                  setPromptOpen(true);
                }}
                className="btn btn-primary w-full py-3 text-base inline-flex items-center justify-center gap-2"
              >
                <Mail className="h-4 w-4" />
                Send verification code
              </button>
            </div>
          )}

          {phase === "enter_code" && (
            <>
              {error && (
                <div className="mb-4 rounded-xl border border-[#ff9500]/40 bg-[#111114] px-3 py-2 text-xs text-[#ff9500]">
                  {error}
                </div>
              )}

              <p className="mb-4 text-sm text-[#a1a1aa] text-center">
                Enter the 6-digit code from your email.
              </p>

              <form onSubmit={handleVerify} className="space-y-4">
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value.replace(/\D/g, ""));
                    if (error) setError(null);
                  }}
                  placeholder="6-digit code"
                  className="input w-full px-4 py-3 rounded-2xl text-base text-center tracking-[0.35em] font-mono"
                  required
                  autoComplete="one-time-code"
                  autoFocus
                />

                <label className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rememberDevice}
                    onChange={(e) => setRememberDevice(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-white/20 bg-transparent accent-[#c084fc]"
                  />
                  <span className="text-sm text-[#a1a1aa] leading-snug">
                    <span className="flex items-center gap-1.5 text-[#f4f4f5] font-medium">
                      <ShieldCheck className="h-3.5 w-3.5 text-[#c084fc]" />
                      Remember this device for 30 days
                    </span>
                    Skip this step on this browser until 30 days after your last verification.
                  </span>
                </label>

                <button
                  type="submit"
                  disabled={loading || sending || !code || code.length < 6}
                  className="btn btn-primary w-full py-3 text-base disabled:opacity-60"
                >
                  {loading ? "Verifying..." : "Continue"}
                </button>

                <button
                  type="button"
                  onClick={() => void handleResend()}
                  disabled={loading || sending || resendCooldown > 0}
                  className="text-xs text-[#a1a1aa] hover:text-white w-full text-center disabled:opacity-60"
                >
                  {sending ? (
                    <span className="inline-flex items-center gap-1.5">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Sending code...
                    </span>
                  ) : resendCooldown > 0 ? (
                    `Resend available in ${resendCooldown}s`
                  ) : (
                    "Didn't get it? Resend code"
                  )}
                </button>
              </form>
            </>
          )}

          <button
            type="button"
            onClick={onSignOut}
            className="mt-6 text-xs text-[#71717a] hover:text-white w-full text-center"
          >
            Sign out and use a different account
          </button>
        </div>
      </div>
    </>
  );
}