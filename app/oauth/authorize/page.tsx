import Link from "next/link";
import { redirect } from "next/navigation";
import { BrandLogo } from "@/components/BrandLogo";
import { GROK_CLIENT_ID } from "@/lib/mcp/config";
import { OAuthError, parseAuthorizationRequest } from "@/lib/mcp/oauth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Connect Grok — Badazz Tasks",
  robots: { index: false, follow: false },
};

function loginRedirect(requestPath: string) {
  const next = `/login?next=${encodeURIComponent(requestPath)}`;
  redirect(next);
}

function ErrorCard({ title, message }: { title: string; message: string }) {
  return (
    <div className="min-h-screen min-h-[100dvh] bg-bg text-text-primary flex flex-col">
      <header className="flex shrink-0 items-center justify-between px-6 pt-[max(1.25rem,env(safe-area-inset-top))] pb-4 sm:px-10">
        <Link href="/" className="flex items-center gap-2.5 text-text-primary hover:opacity-90 transition">
          <BrandLogo size="md" />
          <span className="text-[15px] font-semibold tracking-tight sm:text-base">Badazz Tasks</span>
        </Link>
      </header>
      <main className="flex flex-1 items-center justify-center px-4 pb-[max(2rem,env(safe-area-inset-bottom))]">
        <div className="w-full max-w-md rounded-2xl border border-border bg-bg-card p-8 shadow-[var(--card-shadow)]">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neon-purple">Grok connector</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-3 text-sm leading-6 text-text-secondary">{message}</p>
        </div>
      </main>
    </div>
  );
}

export default async function AuthorizeGrokPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const values = new URLSearchParams();
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "string") values.set(key, value);
    else if (Array.isArray(value) && value[0]) values.set(key, value[0]);
  }

  let request;
  try {
    request = parseAuthorizationRequest(values);
  } catch (error) {
    const code = error instanceof OAuthError ? error.message : "invalid_request";
    return (
      <ErrorCard
        title="This Grok login request is invalid"
        message={`OAuth error: ${code}. Remove the connector on grok.com/connectors and add it again using https://badazztasks.com/api/mcp.`}
      />
    );
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const authorizePath = `/oauth/authorize?${values.toString()}`;
  if (!user) {
    loginRedirect(authorizePath);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("email, full_name, access_paused")
    .eq("id", user!.id)
    .maybeSingle();

  if ((profile as { access_paused?: boolean } | null)?.access_paused) {
    return (
      <ErrorCard
        title="Account paused"
        message="This Badazz Tasks account cannot authorize Grok right now."
      />
    );
  }

  const email =
    (profile as { email?: string | null } | null)?.email || user!.email || "your account";
  const name = (profile as { full_name?: string | null } | null)?.full_name;

  return (
    <div className="min-h-screen min-h-[100dvh] bg-bg text-text-primary flex flex-col">
      <header className="flex shrink-0 items-center justify-between px-6 pt-[max(1.25rem,env(safe-area-inset-top))] pb-4 sm:px-10">
        <Link href="/" className="flex items-center gap-2.5 text-text-primary hover:opacity-90 transition">
          <BrandLogo size="md" />
          <span className="text-[15px] font-semibold tracking-tight sm:text-base">Badazz Tasks</span>
        </Link>
      </header>
      <main className="flex flex-1 items-center justify-center px-4 pb-[max(2rem,env(safe-area-inset-bottom))]">
        <form
          method="post"
          action="/oauth/authorize/complete"
          className="w-full max-w-md rounded-2xl border border-border bg-bg-card p-8 shadow-[var(--card-shadow)]"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neon-purple">Grok connector</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Allow Grok to use your tasks?</h1>
          <p className="mt-3 text-sm leading-6 text-text-secondary">
            {name ? `${name} (${email})` : email} — Grok will be able to list, create, update, complete, and
            delete tasks, notes, and checklist items in your workspaces, the same way you can in the app.
          </p>
          <div className="mt-5 space-y-2 rounded-xl border border-border bg-bg-secondary p-4 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-text-muted">Client</span>
              <span className="font-medium">{GROK_CLIENT_ID}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-text-muted">Access</span>
              <span className="text-right font-medium">Read and write your data</span>
            </div>
          </div>
          <input type="hidden" name="client_id" value={request.client_id} />
          <input type="hidden" name="redirect_uri" value={request.redirect_uri} />
          <input type="hidden" name="response_type" value="code" />
          <input type="hidden" name="scope" value={request.scope} />
          <input type="hidden" name="state" value={request.state} />
          <input type="hidden" name="code_challenge" value={request.code_challenge} />
          <input type="hidden" name="code_challenge_method" value="S256" />
          <div className="mt-6 grid gap-3">
            <button
              type="submit"
              name="decision"
              value="allow"
              className="min-h-[44px] rounded-xl bg-neon-purple px-4 text-sm font-semibold text-accent-on transition hover:bg-neon-purple-dark"
            >
              Authorize Grok
            </button>
            <button
              type="submit"
              name="decision"
              value="deny"
              className="min-h-[44px] rounded-xl border border-border bg-transparent px-4 text-sm font-medium text-text-secondary transition hover:text-text-primary"
            >
              Deny
            </button>
          </div>
          <p className="mt-4 text-center text-xs text-text-muted">
            You can remove this connector later at grok.com/connectors.
          </p>
        </form>
      </main>
    </div>
  );
}
