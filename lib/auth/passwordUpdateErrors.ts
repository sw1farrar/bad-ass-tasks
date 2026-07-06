/** Map Supabase Auth password update errors to clear, actionable copy. */
export function formatPasswordUpdateError(message: string | undefined): string {
  const raw = (message ?? "").trim();
  if (!raw) return "Could not update password. Please try again.";

  if (/same|identical|different from|re-use|reuse|previous password/i.test(raw)) {
    return "Choose a password you have not used on this account before.";
  }

  if (/at least|too short|minimum|characters/i.test(raw)) {
    return raw;
  }

  if (/weak|common|breach|pwned/i.test(raw)) {
    return "That password is too easy to guess. Try a longer, unique password.";
  }

  if (/session|expired|invalid|token/i.test(raw)) {
    return "Your reset session expired. Request a new recovery code and try again.";
  }

  return raw;
}
