"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Users, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { formatRoleLabel } from "@/lib/roles";
import { sanitizeUsername, USERNAME_MIN_LENGTH, validateUsername } from "@/lib/profile/username";

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

type UsernameStatus = "idle" | "checking" | "available" | "taken" | "invalid";

interface InviteAcceptPageProps {
  inviteId: string;
}

export function InviteAcceptPage({ inviteId }: InviteAcceptPageProps) {
  const router = useRouter();
  const [invite, setInvite] = useState<InvitePreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [location, setLocation] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>("idle");
  const [usernameMessage, setUsernameMessage] = useState<string | null>(null);
  const usernameCheckRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  useEffect(() => {
    if (usernameCheckRef.current) {
      clearTimeout(usernameCheckRef.current);
      usernameCheckRef.current = null;
    }

    const normalized = sanitizeUsername(username);
    if (!normalized) {
      setUsernameStatus("idle");
      setUsernameMessage(null);
      return;
    }

    const validation = validateUsername(normalized);
    if (!validation.ok) {
      setUsernameStatus("invalid");
      setUsernameMessage(validation.error);
      return;
    }

    setUsernameStatus("checking");
    setUsernameMessage("Checking availability…");

    usernameCheckRef.current = setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/profile/check-username?username=${encodeURIComponent(normalized)}`,
        );
        const payload = (await response.json().catch(() => ({}))) as {
          available?: boolean;
          error?: string;
        };

        if (!response.ok || payload.available === undefined) {
          setUsernameStatus("invalid");
          setUsernameMessage(payload.error || "Could not check username.");
          return;
        }

        if (payload.available) {
          setUsernameStatus("available");
          setUsernameMessage(`@${normalized} is available`);
        } else {
          setUsernameStatus("taken");
          setUsernameMessage(payload.error || "That username is already taken.");
        }
      } catch {
        setUsernameStatus("invalid");
        setUsernameMessage("Could not check username.");
      }
    }, 400);

    return () => {
      if (usernameCheckRef.current) {
        clearTimeout(usernameCheckRef.current);
        usernameCheckRef.current = null;
      }
    };
  }, [username]);

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

  const canSubmitSignup =
    !!fullName.trim() &&
    !!location.trim() &&
    !!email &&
    password.length >= 6 &&
    confirmPassword.length >= 6 &&
    password === confirmPassword &&
    usernameStatus === "available";

  const handleJoinWithPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invite?.isValid) return;

    if (!fullName.trim()) {
      setError("Please enter your name.");
      return;
    }
    if (!location.trim()) {
      setError("Please enter where you're from.");
      return;
    }
    if (usernameStatus !== "available") {
      setError("Choose an available username before joining.");
      return;
    }
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
        body: JSON.stringify({
          email,
          password,
          fullName: fullName.trim(),
          username: sanitizeUsername(username),
          location: location.trim(),
        }),
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

  const usernameStatusClass =
    usernameStatus === "available"
      ? "text-neon-green"
      : usernameStatus === "checking"
        ? "text-text-secondary"
        : usernameStatus === "idle"
          ? "text-text-muted"
          : "text-[var(--priority-p1)]";

  return (
    <div className="invite-accept-page min-h-screen bg-bg text-text-primary overflow-y-auto">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(192,132,252,0.12),transparent)]" />

      <header className="relative max-w-lg mx-auto px-6 pt-8 pb-2 flex items-center justify-between">
        <div className="font-semibold tracking-tight text-lg">Badazz Tasks</div>
      </header>

      <main className="relative max-w-lg mx-auto px-6 py-10">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-neon-purple" />
            <p className="text-sm text-text-muted">Loading invitation…</p>
          </div>
        ) : error && !invite ? (
          <div className="rounded-2xl border border-border-glass bg-bg-secondary p-8 text-center">
            <h1 className="text-xl font-semibold mb-2">Invitation unavailable</h1>
            <p className="text-sm text-text-secondary">{error}</p>
          </div>
        ) : invite ? (
          <div className="invite-accept-page__card rounded-2xl border border-border-glass bg-bg-secondary/90 shadow-2xl overflow-hidden">
            <div className="invite-accept-page__header px-8 pt-8 pb-6 text-center border-b border-border-subtle bg-gradient-to-b from-neon-purple/10 to-transparent">
              <div className="mx-auto mb-4 h-12 w-12 rounded-2xl bg-gradient-to-br from-neon-purple to-neon-purple-dark flex items-center justify-center">
                <Users className="h-6 w-6 text-accent-on" />
              </div>
              <p className="text-sm text-neon-purple mb-2">You&apos;re invited</p>
              <h1 className="text-2xl font-semibold tracking-tight mb-2">
                Join {invite.workspaceName}
              </h1>
              <p className="text-sm text-text-secondary leading-relaxed">
                <span className="text-text-primary font-medium">{invite.inviterName}</span> invited you as{" "}
                <span className="text-text-primary">{formatRoleLabel(invite.role)}</span>.
              </p>
            </div>

            <div className="p-8">
              {!invite.isValid ? (
                <p className="text-sm text-[var(--priority-p1)] text-center">{invite.invalidReason}</p>
              ) : isSignedIn ? (
                <div className="space-y-4">
                  <p className="text-sm text-text-secondary text-center">
                    You&apos;re signed in. Accept the invitation to open this workspace.
                  </p>
                  {error && (
                    <div className="rounded-xl border border-[var(--priority-p1)]/40 bg-bg-secondary px-3 py-2 text-xs text-[var(--priority-p1)]">
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
                  <p className="text-sm text-text-secondary text-center mb-2">
                    Set up your profile and password to create your account and join the workspace.
                  </p>

                  {error && (
                    <div className="rounded-xl border border-[var(--priority-p1)]/40 bg-bg-secondary px-3 py-2 text-xs text-[var(--priority-p1)]">
                      {error}
                    </div>
                  )}

                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-text-muted mb-1.5">
                      Full name
                    </label>
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => {
                        setFullName(e.target.value);
                        if (error) setError(null);
                      }}
                      placeholder="Alex Rivera"
                      className="input w-full px-4 py-3 rounded-2xl text-base"
                      required
                      autoComplete="name"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-text-muted mb-1.5">
                      Username
                    </label>
                    <div className="flex items-center gap-1">
                      <span className="text-text-secondary px-2">@</span>
                      <input
                        type="text"
                        value={username}
                        onChange={(e) => {
                          setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""));
                          if (error) setError(null);
                        }}
                        placeholder="alexr"
                        className="input w-full px-4 py-3 rounded-2xl text-base"
                        required
                        minLength={USERNAME_MIN_LENGTH}
                        autoComplete="username"
                        spellCheck={false}
                      />
                    </div>
                    {usernameMessage && (
                      <p className={`mt-1.5 text-xs ${usernameStatusClass}`}>{usernameMessage}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-text-muted mb-1.5">
                      Where you&apos;re from
                    </label>
                    <input
                      type="text"
                      value={location}
                      onChange={(e) => {
                        setLocation(e.target.value);
                        if (error) setError(null);
                      }}
                      placeholder="Austin, TX"
                      className="input w-full px-4 py-3 rounded-2xl text-base"
                      required
                      autoComplete="address-level2"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-text-muted mb-1.5">
                      Email
                    </label>
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
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-text-muted mb-1.5">
                      Password
                    </label>
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
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-text-muted mb-1.5">
                      Confirm password
                    </label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value);
                        if (error) setError(null);
                      }}
                      placeholder="Re-enter your password"
                      className="input w-full px-4 py-3 rounded-2xl text-base"
                      required
                      minLength={6}
                      autoComplete="new-password"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submitting || !canSubmitSignup}
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

        <p className="text-center text-xs text-text-faint mt-8">Get shit done. Beautifully.</p>
      </main>
    </div>
  );
}