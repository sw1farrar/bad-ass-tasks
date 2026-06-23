"use client";

import { useEffect, useState } from "react";
import { Mail, KeyRound, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import {
  completeClientSignIn,
  completeClientSignInFromSession,
} from "@/lib/auth/completeClientSignIn";
import { stashDualAuthBootstrap, type DualAuthBootstrap } from "@/lib/auth/dualAuthClient";
import {
  clearResetEmail,
  consumeResetEmail,
  stashResetEmail,
} from "@/lib/auth/passwordResetClient";
import {
  clearRecoveryFlow,
  isRecoverySession,
  markRecoveryFlow,
  sessionHasRecoveryAuth,
} from "@/lib/auth/recoverySession";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { useTaskStore } from "@/store/useTaskStore";

export type AuthMode = "signin" | "signup" | "signup-verify" | "reset-request" | "reset-verify";

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

export interface AuthPanelProps {
  initialMode?: AuthMode;
  initialEmail?: string;
  onSuccess?: () => void;
  className?: string;
}

export function AuthPanel({ initialMode = "signin", initialEmail = "", onSuccess, className }: AuthPanelProps) {
  const { user, session } = useTaskStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [authError, setAuthError] = useState<string | null>(null);
  const [recoverySessionReady, setRecoverySessionReady] = useState(false);

  useEffect(() => {
    setMode(initialMode);
    if (initialMode !== "reset-verify") {
      setRecoverySessionReady(false);
    }
  }, [initialMode]);

  useEffect(() => {
    const rememberedEmail = consumeResetEmail();
    const seedEmail = initialEmail || rememberedEmail;
    if (seedEmail) {
      setEmail(seedEmail);
    }
  }, [initialEmail]);

  useEffect(() => {
    if (session && isRecoverySession(session)) {
      markRecoveryFlow();
      setRecoverySessionReady(true);
      setMode("reset-verify");
      if (user?.email) setEmail(user.email);
      return;
    }

    if (user && onSuccess) {
      onSuccess();
    }
  }, [user, session, onSuccess]);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;

    const supabase = getSupabaseClient();
    if (!supabase) return;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === "PASSWORD_RECOVERY") {
        markRecoveryFlow();
        setRecoverySessionReady(true);
        setMode("reset-verify");
        setAuthError(null);
        setOtpCode("");
        return;
      }

      if (event === "SIGNED_IN" && nextSession && !sessionHasRecoveryAuth(nextSession)) {
        clearRecoveryFlow();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const switchMode = (next: AuthMode) => {
    setMode(next);
    setAuthError(null);
    setOtpCode("");
    setNewPassword("");
    setRecoverySessionReady(false);
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

    let keepLoading = false;

    try {
      if (mode === "signin") {
        const response = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ email, password }),
        });
        const payload = (await response.json().catch(() => ({}))) as {
          error?: string;
          needsVerification?: boolean;
          dualAuth?: DualAuthBootstrap;
          session?: { access_token?: string; refresh_token?: string };
        };

        if (!response.ok) {
          if (payload.needsVerification) {
            setAuthError("Please verify your email before signing in.");
            toast.info("Verify your email", { description: "Enter the code we sent you to finish signing up." });
            switchMode("signup-verify");
          } else {
            const message = payload.error || "Sign in failed. Please check your credentials.";
            setAuthError(message);
            toast.error("Sign in failed", { description: message });
          }
        } else {
          const accessToken = payload.session?.access_token;
          const refreshToken = payload.session?.refresh_token;
          if (!accessToken || !refreshToken) {
            const message = "Sign in succeeded but the session could not be established. Please try again.";
            setAuthError(message);
            toast.error("Sign in incomplete", { description: message });
            return;
          }

          const signInResult = await completeClientSignIn({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (!signInResult.ok) {
            const message = signInResult.error || "Could not complete sign in. Please try again.";
            setAuthError(message);
            toast.error("Sign in incomplete", { description: message });
            return;
          }

          if (payload.dualAuth) {
            stashDualAuthBootstrap(payload.dualAuth);
          }

          const needsDualAuth =
            payload.dualAuth?.required === true && payload.dualAuth?.verified !== true;
          if (needsDualAuth) {
            toast.success("Signed in", {
              description: "Check your email for a verification code.",
            });
          }

          keepLoading = true;
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
      if (!keepLoading) {
        setLoading(false);
      }
    }
  };

  const requestPasswordResetCode = async (): Promise<boolean> => {
    if (!email) return false;

    if (!isSupabaseConfigured()) {
      toast.success("Demo: reset code sent (not real)");
      return true;
    }

    const response = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const payload = (await response.json().catch(() => ({}))) as { error?: string };

    if (!response.ok) {
      const message = payload.error || "Could not send reset code. Try again.";
      setAuthError(message);
      toast.error("Reset failed", { description: message });
      return false;
    }

    stashResetEmail(email);
    toast.success("Check your inbox", {
      description:
        "If an account exists, we sent a recovery code and one-click link. Check spam.",
    });
    return true;
  };

  const handleResetRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    setAuthError(null);

    try {
      const sent = await requestPasswordResetCode();
      if (sent) {
        switchMode("reset-verify");
      }
    } catch {
      setAuthError("Something went wrong. Please try again.");
      toast.error("Reset error");
    } finally {
      setLoading(false);
    }
  };

  const handleResendResetCode = async () => {
    if (!email) {
      setAuthError("Enter your email on the previous step first.");
      switchMode("reset-request");
      return;
    }

    setLoading(true);
    setAuthError(null);

    try {
      await requestPasswordResetCode();
    } catch {
      setAuthError("Something went wrong. Please try again.");
      toast.error("Resend error");
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
      onSuccess?.();
      return;
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
      setLoading(false);
      return;
    }

    let keepLoading = false;

    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token: otpCode.trim(),
        type: "signup",
      });

      if (error) {
        setAuthError(error.message || "Invalid or expired code. Request a new one.");
        toast.error("Invalid code", { description: error.message });
      } else {
        const signInResult = await completeClientSignInFromSession(data.session);
        if (!signInResult.ok) {
          const message = signInResult.error || "Email verified but sign-in could not finish. Please sign in.";
          setAuthError(message);
          toast.error("Sign in incomplete", { description: message });
          switchMode("signin");
          return;
        }

        toast.success("Welcome to Badazz Tasks");
        keepLoading = true;
      }
    } catch {
      setAuthError("Something went wrong. Please try again.");
      toast.error("Verification error");
    } finally {
      if (!keepLoading) {
        setLoading(false);
      }
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
    if (!newPassword) return;
    if (!recoverySessionReady && (!email || !otpCode)) return;

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

    let keepLoading = false;

    try {
      if (!recoverySessionReady && otpCode) {
        const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
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

        const recoverySignIn = await completeClientSignInFromSession(verifyData.session);
        if (!recoverySignIn.ok) {
          const message = recoverySignIn.error || "Recovery code accepted but sign-in could not finish.";
          setAuthError(message);
          toast.error("Sign in incomplete", { description: message });
          setLoading(false);
          return;
        }
      } else if (!recoverySessionReady) {
        setAuthError("Enter the recovery code from your email, or use the reset link we sent.");
        setLoading(false);
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) {
        setAuthError(updateError.message || "Could not update password.");
        toast.error("Update failed", { description: updateError.message });
      } else {
        const { data: sessionData } = await supabase.auth.getSession();
        const signInResult = await completeClientSignInFromSession(sessionData.session);
        if (!signInResult.ok) {
          const message = signInResult.error || "Password updated but sign-in could not finish. Please sign in.";
          setAuthError(message);
          toast.error("Sign in incomplete", { description: message });
          switchMode("signin");
          return;
        }

        clearResetEmail();
        clearRecoveryFlow();
        toast.success("Password updated — opening your workspace");
        keepLoading = true;
      }
    } catch {
      setAuthError("Something went wrong. Please try again.");
      toast.error("Reset error");
    } finally {
      if (!keepLoading) {
        setLoading(false);
      }
    }
  };

  const title =
    mode === "reset-request"
      ? "Reset password"
      : mode === "reset-verify"
        ? recoverySessionReady
          ? "Set a new password"
          : "Enter reset code"
        : mode === "signup-verify"
          ? "Verify your email"
          : "Welcome";

  const subtitle =
    mode === "reset-request"
      ? "We will email a recovery code and a one-click reset link"
      : mode === "reset-verify"
        ? recoverySessionReady
          ? "Choose a new password for your account"
          : "Enter the code from your email, or use the one-click reset link"
        : mode === "signup-verify"
          ? "Enter the verification code we sent to your inbox"
          : mode === "signin"
            ? "Sign in to your account"
            : "Create your account";

  const showGoogle = (mode === "signin" || mode === "signup") && isSupabaseConfigured();

  return (
    <div className={`glass modal-panel w-full max-w-md rounded-3xl p-6 md:p-8 relative ${className ?? ""}`}>
      {(mode === "reset-request" || mode === "reset-verify" || mode === "signup-verify") && (
        <button
          type="button"
          onClick={() =>
            switchMode(
              mode === "reset-verify" ? "reset-request" : mode === "signup-verify" ? "signup" : "signin",
            )
          }
          className="mb-4 text-text-muted hover:text-text-primary flex items-center gap-1 text-xs"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </button>
      )}

      <div className="text-center mb-6">
        <div className="mx-auto mb-4 h-12 w-12 rounded-2xl bg-gradient-to-br from-neon-purple to-neon-purple-dark flex items-center justify-center">
          {mode === "reset-verify" || mode === "signup-verify" ? (
            <KeyRound className="h-6 w-6 text-accent-on" />
          ) : (
            <Mail className="h-6 w-6 text-accent-on" />
          )}
        </div>
        <h1 className="text-3xl font-semibold tracking-tighter">{title}</h1>
        <p className="text-text-secondary mt-2 text-sm">{subtitle}</p>
      </div>

      {(mode === "signin" || mode === "signup") && (
        <div className="flex rounded-xl bg-surface-hover p-1 mb-6">
          <button
            type="button"
            onClick={() => switchMode("signin")}
            className={`flex-1 py-2 text-sm rounded-lg transition ${mode === "signin" ? "bg-surface-hover font-medium" : "text-text-secondary"}`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => switchMode("signup")}
            className={`flex-1 py-2 text-sm rounded-lg transition ${mode === "signup" ? "bg-surface-hover font-medium" : "text-text-secondary"}`}
          >
            Create Account
          </button>
        </div>
      )}

      {authError && (
        <div className="mb-4 rounded-xl border border-[var(--priority-p1)]/40 bg-bg-secondary px-3 py-2 text-xs text-[var(--priority-p1)]">
          {authError}
        </div>
      )}

      {showGoogle && (
        <>
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="auth-google-btn w-full flex items-center justify-center gap-2.5 py-3 rounded-2xl border border-border-glass bg-surface-overlay hover:bg-surface-hover text-sm font-medium transition disabled:opacity-60 mb-4"
          >
            <GoogleIcon />
            Continue with Google
          </button>
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px bg-surface-hover" />
            <span className="text-[11px] text-text-muted uppercase tracking-wider">or</span>
            <div className="flex-1 h-px bg-surface-hover" />
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
              onClick={() => {
                setAuthError(null);
                switchMode("reset-request");
              }}
              className="text-xs text-neon-purple hover:text-neon-purple-tint transition w-full text-right"
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
          <p className="text-[11px] text-text-muted text-center -mt-1">
            You will get a numeric code and a secure one-click link. Either one lets you set a new password.
          </p>
          <button
            type="submit"
            disabled={loading || !email}
            className="btn btn-primary w-full py-3 text-base disabled:opacity-60"
          >
            {loading ? "Sending…" : "Email me a reset link"}
          </button>
        </form>
      )}

      {mode === "signup-verify" && (
        <form onSubmit={handleSignupVerify} className="space-y-4">
          <p className="text-xs text-text-muted text-center -mt-2 mb-2">
            Sent to <span className="text-text-secondary">{email || "your email"}</span>
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
            className="text-xs text-text-secondary hover:text-text-primary w-full text-center disabled:opacity-60"
          >
            Didn&apos;t get it? Resend code
          </button>
        </form>
      )}

      {mode === "reset-verify" && (
        <form onSubmit={handleResetVerify} className="space-y-4">
          {!recoverySessionReady && (
            <>
              <p className="text-xs text-text-muted text-center -mt-2 mb-2">
                Sent to <span className="text-text-secondary">{email || "your email"}</span>
              </p>
              <p className="text-[11px] text-text-muted text-center -mt-1 mb-1">
                Check spam. You can also use the one-click reset link in the same email.
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
                placeholder="8-digit recovery code"
                className="input w-full px-4 py-3 rounded-2xl text-base text-center tracking-[0.35em] font-mono"
                required
                autoComplete="one-time-code"
              />
            </>
          )}
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
            disabled={loading || !newPassword || (!recoverySessionReady && !otpCode)}
            className="btn btn-primary w-full py-3 text-base disabled:opacity-60"
          >
            {loading ? "Updating..." : "Set new password"}
          </button>
          {!recoverySessionReady && (
            <button
              type="button"
              onClick={handleResendResetCode}
              disabled={loading}
              className="text-xs text-text-secondary hover:text-text-primary w-full text-center disabled:opacity-60"
            >
              Didn&apos;t get it? Resend code
            </button>
          )}
        </form>
      )}

      <p className="text-center text-xs text-text-muted mt-6">
        By continuing you agree to our (future) Terms &amp; Privacy.
      </p>

      {!isSupabaseConfigured() && (
        <div className="mt-4 text-[11px] text-center text-neon-pink">
          Currently in demo mode — real auth activates after you add Supabase keys.
        </div>
      )}
    </div>
  );
}