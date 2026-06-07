"use client";

import { useEffect, useState } from "react";
import { X, Mail, KeyRound, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { useTaskStore } from "@/store/useTaskStore";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

type AuthMode = "signin" | "signup" | "signup-verify" | "reset-request" | "reset-verify";

function GoogleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

export function AuthModal({ isOpen, onClose, onSuccess }: AuthModalProps) {
  const { user } = useTaskStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<AuthMode>("signin");
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && user) {
      onClose();
      onSuccess?.();
    }
  }, [user, isOpen, onClose, onSuccess]);

  useEffect(() => {
    if (!isOpen) {
      setAuthError(null);
      setEmail("");
      setPassword("");
      setOtpCode("");
      setNewPassword("");
      setLoading(false);
      setMode("signin");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  if (user) {
    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={onClose}>
        <div
          className="glass w-full max-w-md rounded-3xl p-8 relative text-center"
          onClick={(e) => e.stopPropagation()}
        >
          <button onClick={onClose} aria-label="Close sign in modal" className="absolute top-5 right-5 text-[#71717a] hover:text-white">
            <X className="h-5 w-5" />
          </button>
          <h2 className="text-2xl font-semibold tracking-tight mb-2">You&apos;re already signed in</h2>
          <p className="text-[#a1a1aa]">{user.email}</p>
        </div>
      </div>
    );
  }

  const switchMode = (next: AuthMode) => {
    setMode(next);
    setAuthError(null);
    setOtpCode("");
    setNewPassword("");
    if (next === "signin" || next === "signup") setPassword("");
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setAuthError(null);

    if (!isSupabaseConfigured()) {
      setLoading(false);
      toast.info("Google sign-in requires a live Supabase connection.");
      return;
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
      setLoading(false);
      return;
    }

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) {
        setAuthError(error.message || "Google sign-in failed.");
        toast.error("Google sign-in failed", { description: error.message });
        setLoading(false);
      }
    } catch {
      setAuthError("Something went wrong. Please try again.");
      toast.error("Google sign-in error");
      setLoading(false);
    }
  };

  const handleEmailPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setLoading(true);
    setAuthError(null);

    if (!isSupabaseConfigured()) {
      setTimeout(() => {
        setLoading(false);
        if (mode === "signup") {
          toast.success("Demo: verification code sent");
          switchMode("signup-verify");
        } else {
          toast.success("Demo sign in successful");
          onClose();
          onSuccess?.();
        }
      }, 600);
      return;
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
      setLoading(false);
      return;
    }

    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          const needsVerify = /not confirmed|confirm your email/i.test(error.message || "");
          if (needsVerify) {
            setAuthError("Please verify your email before signing in.");
            toast.info("Verify your email", { description: "Enter the code we sent you to finish signing up." });
            switchMode("signup-verify");
          } else {
            setAuthError(error.message || "Sign in failed. Please check your credentials.");
            toast.error("Sign in failed", { description: error.message });
          }
        } else {
          toast.success("Signed in successfully");
        }
      } else if (mode === "signup") {
        const response = await fetch("/api/auth/signup", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        const payload = (await response.json().catch(() => ({}))) as { error?: string };

        if (!response.ok) {
          const message = payload.error || "Sign up failed. Please try again.";
          setAuthError(message);
          toast.error("Sign up failed", { description: message });
        } else {
          toast.success("Check your inbox", { description: "We sent a verification code to your email." });
          switchMode("signup-verify");
        }
      }
    } catch {
      setAuthError("Something went wrong. Please try again.");
      toast.error("Authentication error");
    } finally {
      setLoading(false);
    }
  };

  const handleResetRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    setAuthError(null);

    if (!isSupabaseConfigured()) {
      setLoading(false);
      toast.success("Demo: reset code sent (not real)");
      switchMode("reset-verify");
      return;
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
      setLoading(false);
      return;
    }

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      });

      if (error) {
        setAuthError(error.message || "Could not send reset code. Try again.");
        toast.error("Reset failed", { description: error.message });
      } else {
        toast.success("Check your inbox", { description: "We sent a reset code if an account exists for that address." });
        switchMode("reset-verify");
      }
    } catch {
      setAuthError("Something went wrong. Please try again.");
      toast.error("Reset error");
    } finally {
      setLoading(false);
    }
  };

  const handleSignupVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !otpCode) return;

    setLoading(true);
    setAuthError(null);

    if (!isSupabaseConfigured()) {
      setLoading(false);
      toast.success("Demo: email verified");
      onClose();
      onSuccess?.();
      return;
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
      setLoading(false);
      return;
    }

    try {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: otpCode.trim(),
        type: "signup",
      });

      if (error) {
        setAuthError(error.message || "Invalid or expired code. Request a new one.");
        toast.error("Invalid code", { description: error.message });
      } else {
        toast.success("Email verified — welcome to Badazz Tasks");
      }
    } catch {
      setAuthError("Something went wrong. Please try again.");
      toast.error("Verification error");
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (!email || !password) {
      setAuthError("Enter your email and password on the sign-up form first.");
      switchMode("signup");
      return;
    }

    setLoading(true);
    setAuthError(null);

    if (!isSupabaseConfigured()) {
      setLoading(false);
      toast.success("Demo: verification code resent");
      return;
    }

    try {
      const response = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        const message = payload.error || "Could not resend code.";
        setAuthError(message);
        toast.error("Resend failed", { description: message });
      } else {
        toast.success("Code sent", { description: "Check your inbox for a new verification code." });
      }
    } catch {
      setAuthError("Something went wrong. Please try again.");
      toast.error("Resend error");
    } finally {
      setLoading(false);
    }
  };

  const handleResetVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !otpCode || !newPassword) return;

    setLoading(true);
    setAuthError(null);

    if (!isSupabaseConfigured()) {
      setLoading(false);
      toast.success("Demo: password updated");
      switchMode("signin");
      return;
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
      setLoading(false);
      return;
    }

    try {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email,
        token: otpCode.trim(),
        type: "recovery",
      });

      if (verifyError) {
        setAuthError(verifyError.message || "Invalid or expired code. Request a new one.");
        toast.error("Invalid code", { description: verifyError.message });
        setLoading(false);
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) {
        setAuthError(updateError.message || "Could not update password.");
        toast.error("Update failed", { description: updateError.message });
      } else {
        toast.success("Password updated — you are signed in");
        switchMode("signin");
      }
    } catch {
      setAuthError("Something went wrong. Please try again.");
      toast.error("Reset error");
    } finally {
      setLoading(false);
    }
  };

  const title =
    mode === "reset-request"
      ? "Reset password"
      : mode === "reset-verify"
        ? "Enter reset code"
        : mode === "signup-verify"
          ? "Verify your email"
          : "Welcome";

  const subtitle =
    mode === "reset-request"
      ? "Enter your email and we will send a reset code"
      : mode === "reset-verify"
        ? "Enter the code from your inbox and choose a new password"
        : mode === "signup-verify"
          ? "Enter the verification code we sent to your inbox"
          : mode === "signin"
            ? "Sign in to your account"
            : "Create your account";

  const showGoogle = (mode === "signin" || mode === "signup") && isSupabaseConfigured();

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end md:items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={onClose}
      style={{
        paddingTop: "max(1rem, env(safe-area-inset-top))",
        paddingBottom: "max(1rem, env(safe-area-inset-bottom))",
      }}
    >
      <div
        className="glass w-full max-w-md md:max-w-lg rounded-t-3xl md:rounded-3xl p-6 md:p-8 relative max-h-[85dvh] md:max-h-[80vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
        style={{ paddingTop: "max(1.5rem, env(safe-area-inset-top))" }}
      >
        <button onClick={onClose} aria-label="Close sign in modal" className="absolute top-5 right-5 text-[#71717a] hover:text-white">
          <X className="h-5 w-5" />
        </button>

        {(mode === "reset-request" || mode === "reset-verify" || mode === "signup-verify") && (
          <button
            type="button"
            onClick={() =>
              switchMode(
                mode === "reset-verify" ? "reset-request" : mode === "signup-verify" ? "signup" : "signin",
              )
            }
            className="absolute top-5 left-5 text-[#71717a] hover:text-white flex items-center gap-1 text-xs"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </button>
        )}

        <div className="text-center mb-6">
          <div className="mx-auto mb-4 h-12 w-12 rounded-2xl bg-gradient-to-br from-[#c084fc] to-[#a855f7] flex items-center justify-center">
            {mode === "reset-verify" || mode === "signup-verify" ? (
              <KeyRound className="h-6 w-6 text-black" />
            ) : (
              <Mail className="h-6 w-6 text-black" />
            )}
          </div>
          <h2 className="text-3xl font-semibold tracking-tighter">{title}</h2>
          <p className="text-[#a1a1aa] mt-2 text-sm">{subtitle}</p>
        </div>

        {(mode === "signin" || mode === "signup") && (
          <div className="flex rounded-xl bg-white/5 p-1 mb-6">
            <button
              type="button"
              onClick={() => switchMode("signin")}
              className={`flex-1 py-2 text-sm rounded-lg transition ${mode === "signin" ? "bg-white/10 font-medium" : "text-[#a1a1aa]"}`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => switchMode("signup")}
              className={`flex-1 py-2 text-sm rounded-lg transition ${mode === "signup" ? "bg-white/10 font-medium" : "text-[#a1a1aa]"}`}
            >
              Create Account
            </button>
          </div>
        )}

        {authError && (
          <div className="mb-4 rounded-xl border border-[#ff9500]/40 bg-[#111114] px-3 py-2 text-xs text-[#ff9500]">
            {authError}
          </div>
        )}

        {showGoogle && (
          <>
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2.5 py-3 rounded-2xl border border-white/15 bg-white/[0.04] hover:bg-white/[0.08] text-sm font-medium transition disabled:opacity-60 mb-4"
            >
              <GoogleIcon />
              Continue with Google
            </button>
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 h-px bg-white/10" />
              <span className="text-[11px] text-[#71717a] uppercase tracking-wider">or</span>
              <div className="flex-1 h-px bg-white/10" />
            </div>
          </>
        )}

        {(mode === "signin" || mode === "signup") && (
          <form onSubmit={handleEmailPassword} className="space-y-4">
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (authError) setAuthError(null);
              }}
              placeholder="you@email.com"
              className="input w-full px-4 py-3 rounded-2xl text-base"
              required
              autoComplete="email"
            />

            <input
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (authError) setAuthError(null);
              }}
              placeholder="Password"
              className="input w-full px-4 py-3 rounded-2xl text-base"
              required
              minLength={6}
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
            />

            {mode === "signin" && (
              <button
                type="button"
                onClick={() => switchMode("reset-request")}
                className="text-xs text-[#c084fc] hover:text-[#e9d5ff] transition w-full text-right"
              >
                Forgot password?
              </button>
            )}

            <button
              type="submit"
              disabled={loading || !email || !password}
              className="btn btn-primary w-full py-3 text-base disabled:opacity-60"
            >
              {loading
                ? mode === "signin"
                  ? "Signing in..."
                  : "Creating account..."
                : mode === "signin"
                  ? "Sign In"
                  : "Create Account"}
            </button>
          </form>
        )}

        {mode === "reset-request" && (
          <form onSubmit={handleResetRequest} className="space-y-4">
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (authError) setAuthError(null);
              }}
              placeholder="you@email.com"
              className="input w-full px-4 py-3 rounded-2xl text-base"
              required
              autoComplete="email"
            />
            <button
              type="submit"
              disabled={loading || !email}
              className="btn btn-primary w-full py-3 text-base disabled:opacity-60"
            >
              {loading ? "Sending…" : "Send reset code"}
            </button>
          </form>
        )}

        {mode === "signup-verify" && (
          <form onSubmit={handleSignupVerify} className="space-y-4">
            <p className="text-xs text-[#71717a] text-center -mt-2 mb-2">
              Sent to <span className="text-[#a1a1aa]">{email || "your email"}</span>
            </p>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={8}
              value={otpCode}
              onChange={(e) => {
                setOtpCode(e.target.value.replace(/\D/g, ""));
                if (authError) setAuthError(null);
              }}
              placeholder="Verification code"
              className="input w-full px-4 py-3 rounded-2xl text-base text-center tracking-[0.35em] font-mono"
              required
              autoComplete="one-time-code"
            />
            <button
              type="submit"
              disabled={loading || !otpCode}
              className="btn btn-primary w-full py-3 text-base disabled:opacity-60"
            >
              {loading ? "Verifying..." : "Verify email"}
            </button>
            <button
              type="button"
              onClick={handleResendVerification}
              disabled={loading}
              className="text-xs text-[#a1a1aa] hover:text-white w-full text-center disabled:opacity-60"
            >
              Didn&apos;t get it? Resend code
            </button>
          </form>
        )}

        {mode === "reset-verify" && (
          <form onSubmit={handleResetVerify} className="space-y-4">
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={8}
              value={otpCode}
              onChange={(e) => {
                setOtpCode(e.target.value.replace(/\D/g, ""));
                if (authError) setAuthError(null);
              }}
              placeholder="Reset code"
              className="input w-full px-4 py-3 rounded-2xl text-base text-center tracking-[0.35em] font-mono"
              required
              autoComplete="one-time-code"
            />
            <input
              type="password"
              value={newPassword}
              onChange={(e) => {
                setNewPassword(e.target.value);
                if (authError) setAuthError(null);
              }}
              placeholder="New password (min 6 characters)"
              className="input w-full px-4 py-3 rounded-2xl text-base"
              required
              minLength={6}
              autoComplete="new-password"
            />
            <button
              type="submit"
              disabled={loading || !otpCode || !newPassword}
              className="btn btn-primary w-full py-3 text-base disabled:opacity-60"
            >
              {loading ? "Updating..." : "Set new password"}
            </button>
            <button
              type="button"
              onClick={() => switchMode("reset-request")}
              className="text-xs text-[#a1a1aa] hover:text-white w-full text-center"
            >
              Didn&apos;t get it? Resend code
            </button>
          </form>
        )}

        <p className="text-center text-xs text-[#71717a] mt-6">
          By continuing you agree to our (future) Terms &amp; Privacy.
        </p>

        {!isSupabaseConfigured() && (
          <div className="mt-4 text-[11px] text-center text-[#ff00aa]">
            Currently in demo mode — real auth activates after you add Supabase keys.
          </div>
        )}
      </div>
    </div>
  );
}