export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 24;

export function sanitizeUsername(raw: string): string {
  return raw.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
}

export function validateUsername(username: string): { ok: true } | { ok: false; error: string } {
  if (!username) {
    return { ok: false, error: "Username is required." };
  }
  if (username.length < USERNAME_MIN_LENGTH) {
    return { ok: false, error: `Username must be at least ${USERNAME_MIN_LENGTH} characters.` };
  }
  if (username.length > USERNAME_MAX_LENGTH) {
    return { ok: false, error: `Username must be at most ${USERNAME_MAX_LENGTH} characters.` };
  }
  if (!/^[a-z][a-z0-9_]*$/.test(username)) {
    return {
      ok: false,
      error: "Username must start with a letter and use only letters, numbers, or underscores.",
    };
  }
  return { ok: true };
}