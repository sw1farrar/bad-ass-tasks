import type { User } from "@supabase/supabase-js";

type AuthUserLike = Pick<User, "identities" | "app_metadata"> | null | undefined;

export function userHasEmailPassword(user: AuthUserLike): boolean {
  if (!user) return false;
  if (user.identities?.some((identity) => identity.provider === "email")) {
    return true;
  }
  return user.app_metadata?.provider === "email";
}