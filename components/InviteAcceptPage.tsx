"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Users, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/client";

type InvitePreview = {
  id: string;
  email: string | null;
  role: string;
  workspaceId: string;
  workspaceName: string;
  inviterName: string;
  isValid: boolean;
  invalidReason?: string;
};

interface InviteAcceptPageProps {
  inviteId: string;
}

export function InviteAcceptPage({ inviteId }: InviteAcceptPageProps) {
  const router = useRouter();
  const [invite, setInvite] = useState<InvitePreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSignedIn, setIsSignedIn] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const response = await fetch(`/api/invite/${inviteId}`);
        const payload = (await response.json().catch(() => ({}))) as {
          invite?: InvitePreview;
          error?: string;
        };

        if (!response.ok || !payload.invite) {
          if (!cancelled) setError(payload.error || "This invite link is not valid.");
          return;
        }

        if (!cancelled) {
          setInvite(payload.invite);
          if (payload.invite.email) setEmail(payload.invite.email);
        }
      } catch {
        if (!cancelled) setError("Could not load this invitation.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    if (isSupabaseConfigured()) {
      const supabase = getSupabaseClient();
      supabase?.auth.getUser().then(({ data }) => {
        if (!cancelled) setIsSignedIn(!!data.user);
      });
    }

    return () => {
      cancelled = true;
    };
  }, [inviteId]);

  const redirectToWorkspace = (workspaceId: string) => {
    router.push(`/?workspace=${workspaceId}`);
  };

  const handleJoinSignedIn = async () => {
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/invite/${inviteId}/join`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({}),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        workspaceId?: string;
        error?: string;
      };

      if (!response.ok || !payload.workspaceId) {
        const message = payload.error || "Could not join workspace.";
        setError(message);
        toast.error("Could not join", { description: message });
        return;
      }

      toast.success("Welcome to the team", { description: invite?.workspaceName });
      redirectToWorkspace(payload.workspaceId);
    } catch {
      setError("Something went wrong. Please try again.");
      toast.error("Join failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleJoinWithPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invite?.isValid) return;

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/invite/${inviteId}/join`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        workspaceId?: string;
        error?: string;
      };

      if (!response.ok || !payload.workspaceId) {
        const message = payload.error || "Could not join workspace.";
        setError(message);
        toast.error("Could not join", { description: message });
        return;
      }

      toast.success("You're in", { description: `Welcome to ${invite.workspaceName}` });
      redirectToWorkspace(payload.workspaceId);
    } catch {
      setError("Something went wrong. Please try again.");
      toast.error("Join failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-[#f4f4f5] overflow-y-auto">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(192,132,252,0.12),transparent)]" />

      <header className="relative max-w-lg mx-auto px-6 pt-8 pb-2 flex items-center justify-between">
        <div className="font-semibold tracking-tight text-lg">Badazz Tasks</div>
      </header>

      <main className="relative max-w-lg mx-auto px-6 py-10">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-[#c084fc]" />
            <p className="text-sm text-[#71717a]">Loading invitation…</p>
          </div>
        ) : error && !invite ? (
          <div className="rounded-2xl border border-white/[0.08] bg-[#111114] p-8 text-center">
            <h1 className="text-xl font-semibold mb-2">Invitation unavailable</h1>
            <p className="text-sm text-[#a1a1aa]">{error}</p>
          </div>
        ) : invite ? (
          <div className="rounded-2xl border border-white/[0.08] bg-[#111114]/90 shadow-2xl overflow-hidden">
            <div className="px-8 pt-8 pb-6 text-center border-b border-white/[0.06] bg-gradient-to-b from-[#c084fc]/10 to-transparent">
              <div className="mx-auto mb-4 h-12 w-12 rounded-2xl bg-gradient-to-br from-[#c084fc] to-[#a855f7] flex items-center justify-center">
                <Users className="h-6 w-6 text-[#0a0a0f]" />
              </div>
              <p className="text-sm text-[#c084fc] mb-2">You&apos;re invited</p>
              <h1 className="text-2xl font-semibold tracking-tight mb-2">
                Join {invite.workspaceName}
              </h1>
              <p className="text-sm text-[#a1a1aa] leading-relaxed">
                <span className="text-[#f4f4f5] font-medium">{invite.inviterName}</span> invited you as{" "}
                <span className="text-[#f4f4f5]">{invite.role}</span>.
              </p>
            </div>

            <div className="p-8">
              {!invite.isValid ? (
                <p className="text-sm text-[#ff9500] text-center">{invite.invalidReason}</p>
              ) : isSignedIn ? (
                <div className="space-y-4">
                  <p className="text-sm text-[#a1a1aa] text-center">
                    You&apos;re signed in. Accept the invitation to open this workspace.
                  </p>
                  {error && (
                    <div className="rounded-xl border border-[#ff9500]/40 bg-[#111114] px-3 py-2 text-xs text-[#ff9500]">
                      {error}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={handleJoinSignedIn}
                    disabled={submitting}
                    className="btn btn-primary w-full py-3.5 text-base flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Joining…
                      </>
                    ) : (
                      <>
                        Join workspace
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <form onSubmit={handleJoinWithPassword} className="space-y-4">
                  <p className="text-sm text-[#a1a1aa] text-center mb-2">
                    Set a password to create your account and join the workspace.
                  </p>

                  {error && (
                    <div className="rounded-xl border border-[#ff9500]/40 bg-[#111114] px-3 py-2 text-xs text-[#ff9500]">
                      {error}
                    </div>
                  )}

                  <input
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (error) setError(null);
                    }}
                    placeholder="you@email.com"
                    className="input w-full px-4 py-3 rounded-2xl text-base"
                    required
                    readOnly={!!invite.email}
                    autoComplete="email"
                  />

                  <input
                    type="password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (error) setError(null);
                    }}
                    placeholder="Create a password"
                    className="input w-full px-4 py-3 rounded-2xl text-base"
                    required
                    minLength={6}
                    autoComplete="new-password"
                  />

                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      if (error) setError(null);
                    }}
                    placeholder="Confirm password"
                    className="input w-full px-4 py-3 rounded-2xl text-base"
                    required
                    minLength={6}
                    autoComplete="new-password"
                  />

                  <button
                    type="submit"
                    disabled={submitting || !email || password.length < 6 || confirmPassword.length < 6}
                    className="btn btn-primary w-full py-3.5 text-base flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Joining…
                      </>
                    ) : (
                      <>
                        <Check className="h-4 w-4" />
                        Join workspace
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          </div>
        ) : null}

        <p className="text-center text-xs text-[#52525b] mt-8">Get shit done. Beautifully.</p>
      </main>
    </div>
  );
}