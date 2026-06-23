import { getSupabaseClient } from "@/lib/supabase/client";
import { useTaskStore } from "@/store/useTaskStore";

export type ClientSessionTokens = {
  access_token: string;
  refresh_token: string;
};

export async function completeClientSignIn(
  tokens: ClientSessionTokens,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { ok: false, error: "Supabase is not configured." };
  }

  const { data, error } = await supabase.auth.setSession({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
  });

  if (error || !data.session) {
    return { ok: false, error: error?.message ?? "Could not establish session." };
  }

  const store = useTaskStore.getState();
  if (store.user?.id !== data.session.user.id) {
    store.syncAuthFromSession(data.session);
  }

  return { ok: true };
}

export async function completeClientSignInFromSession(
  session: { access_token: string; refresh_token: string } | null | undefined,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!session?.access_token || !session.refresh_token) {
    return { ok: false, error: "Session tokens are missing." };
  }

  return completeClientSignIn({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  });
}