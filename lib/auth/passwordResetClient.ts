export const RESET_EMAIL_STORAGE_KEY = "bat_reset_email";

export function stashResetEmail(email: string): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(RESET_EMAIL_STORAGE_KEY, email.trim().toLowerCase());
  } catch {
    // Ignore storage errors.
  }
}

export function consumeResetEmail(): string {
  if (typeof window === "undefined") return "";
  try {
    return sessionStorage.getItem(RESET_EMAIL_STORAGE_KEY)?.trim().toLowerCase() ?? "";
  } catch {
    return "";
  }
}

export function clearResetEmail(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(RESET_EMAIL_STORAGE_KEY);
  } catch {
    // Ignore storage errors.
  }
}