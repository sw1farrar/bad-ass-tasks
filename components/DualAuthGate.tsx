"use client";

import { useCallback, useEffect, useState } from "react";
import { KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { isSupabaseConfigured } from "@/lib/supabase/client";

type DualAuthGateProps = {
  maskedEmail: string;
  onVerified: () => void;
  onSignOut: () => void;
};

export function DualAuthGate({ maskedEmail, onVerified, onSignOut }: DualAuthGateProps) {
  const [code, setCode] = useState("");
  const [rememberDevice, setRememberDevice] = useState(true);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [codeSent, setCodeSent] = useState(false);

  const sendCode = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setCodeSent(true);
      return;
    }

    setSending(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/dual-auth/send", { method: "POST" });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        alreadyVerified?: boolean;
      };

      if (payload.alreadyVerified) {
        onVerified();
        return;
      }

      if (!response.ok) {
        const message = payload.error || "Could not send verification code.";
        setError(message);
        toast.error("Could not send code", { description: message });
        return;
      }

      setCodeSent(true);
      toast.success("Code sent", { description: `Check ${maskedEmail} for your sign-in code.` });
    } catch {
      setError("Something went wrong. Please try again.");
      toast.error("Could not send code");
    } finally {
      setSending(false);
    }
  }, [maskedEmail, onVerified]);

  useEffect(() => {
    void sendCode();
  }, [sendCode]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code) return;

    setLoading(true);
    setError(null);

    if (!isSupabaseConfigured()) {
      setLoading(false);
      toast.success("Demo: dual authentication complete");
      onVerified();
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
        skipped?: boolean;
      };

      if (payload.alreadyVerified) {
        onVerified();
        return;
      }

      if (!response.ok) {
        const message = payload.error || "Invalid or expired code.";
        setError(message);
        toast.error("Verification failed", { description: message });
        return;
      }

      toast.success(
        rememberDevice
          ? "Device remembered for 30 days"
          : "Signed in securely",
      );
      onVerified();
    } catch {
      setError("Something went wrong. Please try again.");
      toast.error("Verification error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center bg-[#0a0a0f] p-4">
      <div className="glass w-full max-w-md rounded-3xl p-8 relative">
        <div className="text-center mb-6">
          <div className="mx-auto mb-4 h-12 w-12 rounded-2xl bg-gradient-to-br from-[#c084fc] to-[#a855f7] flex items-center justify-center">
            <KeyRound className="h-6 w-6 text-black" />
          </div>
          <h2 className="text-3xl font-semibold tracking-tighter">Verify your sign-in</h2>
          <p className="text-[#a1a1aa] mt-2 text-sm">
            For your security, enter the code we sent to{" "}
            <span className="text-[#f4f4f5]">{maskedEmail}</span>
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-[#ff9500]/40 bg-[#111114] px-3 py-2 text-xs text-[#ff9500]">
            {error}
          </div>
        )}

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
            onClick={() => void sendCode()}
            disabled={loading || sending}
            className="text-xs text-[#a1a1aa] hover:text-white w-full text-center disabled:opacity-60"
          >
            {sending ? (
              <span className="inline-flex items-center gap-1.5">
                <Loader2 className="h-3 w-3 animate-spin" />
                Sending code...
              </span>
            ) : codeSent ? (
              "Didn't get it? Resend code"
            ) : (
              "Send code"
            )}
          </button>
        </form>

        <button
          type="button"
          onClick={onSignOut}
          className="mt-6 text-xs text-[#71717a] hover:text-white w-full text-center"
        >
          Sign out and use a different account
        </button>
      </div>
    </div>
  );
}