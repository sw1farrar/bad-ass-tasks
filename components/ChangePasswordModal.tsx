"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { Lock, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api/apiFetch";
import { userHasEmailPassword } from "@/lib/auth/userAuthProviders";
import { useIsMobileViewport } from "@/lib/hooks/useIsMobileViewport";
import { useScrollLock } from "@/lib/hooks/useScrollLock";
import { BottomSheet } from "@/components/BottomSheet";
import type { User } from "@supabase/supabase-js";

const MODAL_Z = 1000;

type ChangePasswordModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  enabled?: boolean;
  user?: User | null;
};

function ChangePasswordBody({
  enabled,
  hasEmailPassword,
  userEmail,
  onClose,
  formKey,
}: {
  enabled: boolean;
  hasEmailPassword: boolean;
  userEmail?: string | null;
  onClose: () => void;
  formKey: string;
}) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const passwordsMatch = newPassword === confirmPassword;
  const canSubmit =
    enabled &&
    !submitting &&
    newPassword.length >= 6 &&
    confirmPassword.length >= 6 &&
    passwordsMatch &&
    (!hasEmailPassword || currentPassword.length >= 6);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    setError(null);

    try {
      const response = await apiFetch("/api/auth/change-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          currentPassword: hasEmailPassword ? currentPassword : undefined,
          newPassword,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        const message = payload.error || "Could not update password.";
        setError(message);
        toast.error("Password not updated", { description: message });
        return;
      }

      toast.success(hasEmailPassword ? "Password updated" : "Password set");
      onClose();
    } catch {
      const message = "Something went wrong. Please try again.";
      setError(message);
      toast.error("Password not updated", { description: message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEmailResetLink = async () => {
    if (!userEmail || !enabled || sendingReset) return;

    setSendingReset(true);
    setError(null);

    try {
      const response = await apiFetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: userEmail }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        const message = payload.error || "Could not send reset email.";
        setError(message);
        toast.error("Reset email not sent", { description: message });
        return;
      }

      toast.success("Reset email sent", {
        description: "Check your inbox for a code or one-click link to set a new password.",
      });
    } catch {
      const message = "Something went wrong. Please try again.";
      setError(message);
      toast.error("Reset email not sent", { description: message });
    } finally {
      setSendingReset(false);
    }
  };

  return (
    <div className="flex flex-col min-h-0">
      <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-3 border-b border-border-glass">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-neon-purple shrink-0" />
            <h2 className="text-base font-semibold tracking-tight">
              {hasEmailPassword ? "Change password" : "Set a password"}
            </h2>
          </div>
          <p className="text-xs text-text-muted mt-1 leading-relaxed">
            {hasEmailPassword
              ? "Enter your current password, then choose a new one."
              : "Add a password so you can also sign in with email."}
            {userEmail ? (
              <>
                {" "}
                Account: <span className="text-text-secondary">{userEmail}</span>
              </>
            ) : null}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-hover transition shrink-0"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {!enabled ? (
        <div className="px-4 py-8 text-sm text-text-muted text-center">
          Password changes are available when you&apos;re connected to the live app.
        </div>
      ) : (
        <form key={formKey} onSubmit={(event) => void handleSubmit(event)} className="px-4 py-4 space-y-4">
          {error ? (
            <div className="rounded-xl border border-[var(--priority-p1)]/40 bg-bg-secondary px-3 py-2 text-xs text-[var(--priority-p1)]">
              {error}
            </div>
          ) : null}

          {hasEmailPassword ? (
            <div>
              <label
                htmlFor="change-password-current"
                className="block text-[10px] uppercase tracking-widest text-text-muted mb-1.5"
              >
                Current password
              </label>
              <input
                id="change-password-current"
                type="password"
                value={currentPassword}
                onChange={(event) => {
                  setCurrentPassword(event.target.value);
                  if (error) setError(null);
                }}
                className="input w-full px-3 py-2.5 text-sm rounded-xl min-h-[44px]"
                autoComplete="current-password"
                required
                minLength={6}
              />
            </div>
          ) : null}

          <div>
            <label
              htmlFor="change-password-new"
              className="block text-[10px] uppercase tracking-widest text-text-muted mb-1.5"
            >
              New password
            </label>
            <input
              id="change-password-new"
              type="password"
              value={newPassword}
              onChange={(event) => {
                setNewPassword(event.target.value);
                if (error) setError(null);
              }}
              className="input w-full px-3 py-2.5 text-sm rounded-xl min-h-[44px]"
              autoComplete="new-password"
              required
              minLength={6}
              placeholder="At least 6 characters"
            />
          </div>

          <div>
            <label
              htmlFor="change-password-confirm"
              className="block text-[10px] uppercase tracking-widest text-text-muted mb-1.5"
            >
              Confirm new password
            </label>
            <input
              id="change-password-confirm"
              type="password"
              value={confirmPassword}
              onChange={(event) => {
                setConfirmPassword(event.target.value);
                if (error) setError(null);
              }}
              className="input w-full px-3 py-2.5 text-sm rounded-xl min-h-[44px]"
              autoComplete="new-password"
              required
              minLength={6}
            />
            {confirmPassword.length > 0 && !passwordsMatch ? (
              <p className="mt-1.5 text-xs text-[var(--priority-p1)]">Passwords do not match.</p>
            ) : null}
          </div>

          <button
            type="submit"
            disabled={!canSubmit || sendingReset}
            className="btn btn-primary w-full min-h-[44px] disabled:opacity-60"
          >
            {submitting ? (
              <span className="inline-flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving…
              </span>
            ) : hasEmailPassword ? (
              "Update password"
            ) : (
              "Set password"
            )}
          </button>

          {hasEmailPassword && userEmail ? (
            <button
              type="button"
              onClick={() => void handleEmailResetLink()}
              disabled={submitting || sendingReset}
              className="text-sm text-text-secondary hover:text-neon-purple w-full text-center min-h-[44px] disabled:opacity-60"
            >
              {sendingReset ? "Sending reset email…" : "Forgot your current password?"}
            </button>
          ) : null}
        </form>
      )}
    </div>
  );
}

export function ChangePasswordModal({
  open,
  onOpenChange,
  enabled = true,
  user,
}: ChangePasswordModalProps) {
  const isMobile = useIsMobileViewport();
  useScrollLock(open && isMobile);

  const close = () => onOpenChange(false);
  const hasEmailPassword = userHasEmailPassword(user);

  if (!open) return null;

  const body = (
    <ChangePasswordBody
      key={open ? `open-${user?.id ?? "anon"}` : "closed"}
      enabled={enabled}
      hasEmailPassword={hasEmailPassword}
      userEmail={user?.email}
      onClose={close}
      formKey={open ? `form-${user?.id ?? "anon"}` : "closed"}
    />
  );

  if (isMobile) {
    return (
      <BottomSheet open={open} onClose={close} ariaLabel="Change password">
        {body}
      </BottomSheet>
    );
  }

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4" style={{ zIndex: MODAL_Z }}>
      <button
        type="button"
        className="absolute inset-0 bg-black/55 backdrop-blur-[2px]"
        aria-label="Close change password"
        onClick={close}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="change-password-title"
        className="relative w-full max-w-md glass modal-panel rounded-2xl border border-border-glass shadow-2xl overflow-hidden flex flex-col"
      >
        {body}
      </div>
    </div>,
    document.body,
  );
}