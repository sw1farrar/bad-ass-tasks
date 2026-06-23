export type LoginEventRow = {
  id: string;
  eventType: string;
  authMethod: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  metadata: Record<string, unknown>;
};

const LOGIN_EVENT_LABELS: Record<string, string> = {
  login_success: "Signed in",
  login_failed: "Sign-in failed",
  dual_auth_required: "Verification required",
  dual_auth_prompted: "Verification pending",
  dual_auth_sent: "Verification code sent",
  dual_auth_verified: "Verification completed",
  dual_auth_failed: "Verification failed",
  dual_auth_abandoned: "Verification abandoned",
  password_reset_requested: "Password reset requested",
  password_changed: "Password changed",
  logout: "Signed out",
};

const LOGIN_EVENT_REASON_LABELS: Record<string, string> = {
  invalid_credentials: "Wrong email or password",
  email_unverified: "Email not verified",
  rate_limited: "Too many attempts",
  invalid_request: "Invalid sign-in request",
  oauth_exchange_failed: "Google sign-in failed",
  invalid_or_expired_code: "Invalid or expired code",
  verification_not_completed: "Code never entered",
  cooldown: "Resend cooldown active",
  send_failed: "Could not send verification code",
};

export function formatLoginEventLabel(eventType: string): string {
  return LOGIN_EVENT_LABELS[eventType] ?? eventType.replaceAll("_", " ");
}

export function formatLoginEventDetail(event: LoginEventRow): string | null {
  if (event.eventType === "dual_auth_required") {
    return event.metadata?.hasActiveCode
      ? "Waiting for verification code"
      : "Additional verification needed";
  }

  if (event.eventType === "dual_auth_prompted") {
    return event.metadata?.alreadySent
      ? "Code was sent — not entered yet"
      : "Verification prompt shown — code not entered";
  }

  if (event.eventType === "dual_auth_sent") {
    if (event.metadata?.force) return "New verification code sent";
    return "Verification code emailed";
  }

  if (event.eventType === "dual_auth_abandoned") {
    return event.metadata?.hadActiveCode
      ? "Signed out before entering verification code"
      : "Signed out before completing verification";
  }

  if (event.eventType === "dual_auth_verified") {
    return event.metadata?.rememberDevice ? "Device trusted" : "One-time verification";
  }

  if (event.eventType === "login_success" && event.metadata?.via === "recovery_link") {
    return "Recovery link opened — choose a new password next";
  }

  if (event.eventType === "password_reset_requested") {
    return event.metadata?.sent ? "Reset email sent" : "Requested for unknown account";
  }

  if (event.eventType === "password_changed") {
    return event.metadata?.hadEmailPassword ? "Password updated from account menu" : "Password set from account menu";
  }

  if (event.eventType === "logout" && event.metadata?.preserveTrustedDevice) {
    return "Trusted device remembered for next sign-in";
  }

  if (event.eventType === "login_success" && event.metadata?.dualAuthPending) {
    return "Password accepted — verification still required";
  }

  const reason = event.metadata?.reason;
  if (typeof reason === "string") {
    return LOGIN_EVENT_REASON_LABELS[reason] ?? reason.replaceAll("_", " ");
  }

  return null;
}