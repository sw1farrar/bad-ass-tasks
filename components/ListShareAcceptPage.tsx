"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, ListChecks, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { sanitizeUsername, USERNAME_MIN_LENGTH, validateUsername } from "@/lib/profile/username";

type ListSharePreview = {
  id: string;
  listId: string;
  listTitle: string;
  openItemCount: number;
  sourceWorkspaceName: string;
  sharerName: string;
  recipientEmail: string | null;
  isValid: boolean;
  invalidReason?: string;
};

type WorkspaceOption = {
  id: string;
  name: string;
  alreadyLinked: boolean;
};

type UsernameStatus = "idle" | "checking" | "available" | "taken" | "invalid";

interface ListShareAcceptPageProps {
  shareId: string;
}

export function ListShareAcceptPage({ shareId }: ListShareAcceptPageProps) {
  const router = useRouter();
  const [share, setShare] = useState<ListSharePreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [workspaces, setWorkspaces] = useState<WorkspaceOption[]>([]);
  const [workspacesLoading, setWorkspacesLoading] = useState(false);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [location, setLocation] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>("idle");
  const [usernameMessage, setUsernameMessage] = useState<string | null>(null);
  const usernameCheckRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const response = await fetch(`/api/list-share/${shareId}`);
        const payload = (await response.json().catch(() => ({}))) as {
          share?: ListSharePreview;
          error?: string;
        };

        if (!response.ok || !payload.share) {
          if (!cancelled) setError(payload.error || "This share link is not valid.");
          return;
        }

        if (!cancelled) {
          setShare(payload.share);
          if (payload.share.recipientEmail) setEmail(payload.share.recipientEmail);
        }
      } catch {
        if (!cancelled) setError("Could not load this shared list.");
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
  }, [shareId]);

  useEffect(() => {
    if (!isSignedIn || !share?.isValid) return;

    let cancelled = false;
    setWorkspacesLoading(true);

    (async () => {
      try {
        const response = await fetch(`/api/list-share/${shareId}/workspaces`, {
          credentials: "include",
        });
        const payload = (await response.json().catch(() => ({}))) as {
          workspaces?: WorkspaceOption[];
          error?: string;
        };
        if (!cancelled && response.ok && payload.workspaces) {
          setWorkspaces(payload.workspaces);
          const firstAvailable = payload.workspaces.find((w) => !w.alreadyLinked);
          if (firstAvailable) setSelectedWorkspaceId(firstAvailable.id);
        }
      } catch {
        if (!cancelled) setError("Could not load your workspaces.");
      } finally {
        if (!cancelled) setWorkspacesLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isSignedIn, share?.isValid, shareId]);

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

  const redirectToList = (targetWorkspaceId: string, listId: string) => {
    router.push(`/?workspace=${targetWorkspaceId}&view=lists&highlightList=${listId}`);
  };

  const acceptShare = async (body: Record<string, unknown>) => {
    const response = await fetch(`/api/list-share/${shareId}/accept`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });
    const payload = (await response.json().catch(() => ({}))) as {
      listId?: string;
      targetWorkspaceId?: string;
      error?: string;
    };

    if (!response.ok || !payload.listId || !payload.targetWorkspaceId) {
      const message = payload.error || "Could not add list to workspace.";
      setError(message);
      toast.error("Could not accept share", { description: message });
      return null;
    }

    toast.success("List connected", { description: share?.listTitle });
    redirectToList(payload.targetWorkspaceId, payload.listId);
    return payload;
  };

  const handleAcceptSignedIn = async () => {
    if (!selectedWorkspaceId) {
      setError("Choose a workspace first.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await acceptShare({ targetWorkspaceId: selectedWorkspaceId });
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
    usernameStatus === "available" &&
    !!selectedWorkspaceId;

  const handleSignupAndAccept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!share?.isValid || !selectedWorkspaceId) return;

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await acceptShare({
        targetWorkspaceId: selectedWorkspaceId,
        email,
        password,
        fullName: fullName.trim(),
        username: sanitizeUsername(username),
        location: location.trim(),
      });
    } finally {
      setSubmitting(false);
    }
  };

  const workspacePicker = (
    <div className="space-y-2">
      <p className="text-sm text-text-secondary text-center">
        Choose which of your workspaces should receive this live-linked list.
      </p>
      {workspacesLoading ? (
        <div className="flex items-center justify-center gap-2 py-4 text-sm text-text-muted">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading workspaces…
        </div>
      ) : workspaces.length === 0 ? (
        <p className="text-sm text-text-muted text-center py-4">
          You need a workspace first.{" "}
          <Link href={`/login?next=/list-share/${shareId}`} className="text-neon-purple underline">
            Sign in
          </Link>{" "}
          and create one from the app.
        </p>
      ) : (
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {workspaces.map((ws) => (
            <label
              key={ws.id}
              className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition ${
                ws.alreadyLinked
                  ? "border-border-subtle opacity-50 cursor-not-allowed"
                  : selectedWorkspaceId === ws.id
                    ? "border-neon-purple bg-neon-purple/10"
                    : "border-border-glass bg-surface-hover hover:bg-surface-hover/80"
              }`}
            >
              <input
                type="radio"
                name="target-workspace"
                value={ws.id}
                disabled={ws.alreadyLinked}
                checked={selectedWorkspaceId === ws.id}
                onChange={() => setSelectedWorkspaceId(ws.id)}
                className="accent-neon-purple"
              />
              <span className="flex-1 min-w-0">
                <span className="font-medium block truncate">{ws.name}</span>
                {ws.alreadyLinked ? (
                  <span className="text-xs text-text-muted">Already connected</span>
                ) : null}
              </span>
            </label>
          ))}
        </div>
      )}
    </div>
  );

  const signInHref = `/login?next=${encodeURIComponent(`/list-share/${shareId}`)}`;

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
            <p className="text-sm text-text-muted">Loading shared list…</p>
          </div>
        ) : error && !share ? (
          <div className="rounded-2xl border border-border-glass bg-bg-secondary p-8 text-center">
            <h1 className="text-xl font-semibold mb-2">Share unavailable</h1>
            <p className="text-sm text-text-secondary">{error}</p>
          </div>
        ) : share ? (
          <div className="invite-accept-page__card rounded-2xl border border-border-glass bg-bg-secondary/90 shadow-2xl overflow-hidden">
            <div className="invite-accept-page__header px-8 pt-8 pb-6 text-center border-b border-border-subtle bg-gradient-to-b from-neon-purple/10 to-transparent">
              <div className="mx-auto mb-4 h-12 w-12 rounded-2xl bg-gradient-to-br from-neon-purple to-neon-purple-dark flex items-center justify-center">
                <ListChecks className="h-6 w-6 text-accent-on" />
              </div>
              <p className="text-sm text-neon-purple mb-2">Shared list</p>
              <h1 className="text-2xl font-semibold tracking-tight mb-2">{share.listTitle}</h1>
              <p className="text-sm text-text-secondary leading-relaxed">
                <span className="text-text-primary font-medium">{share.sharerName}</span> shared this
                list from{" "}
                <span className="text-text-primary font-medium">{share.sourceWorkspaceName}</span>
                {share.openItemCount > 0 ? (
                  <>
                    {" "}
                    · <span className="text-text-primary">{share.openItemCount} open items</span>
                  </>
                ) : null}
                .
              </p>
            </div>

            <div className="p-8">
              {!share.isValid ? (
                <p className="text-sm text-[var(--priority-p1)] text-center">{share.invalidReason}</p>
              ) : isSignedIn ? (
                <div className="space-y-4">
                  {workspacePicker}
                  {error ? (
                    <div className="rounded-xl border border-[var(--priority-p1)]/40 bg-bg-secondary px-3 py-2 text-xs text-[var(--priority-p1)]">
                      {error}
                    </div>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => void handleAcceptSignedIn()}
                    disabled={submitting || !selectedWorkspaceId || workspacesLoading}
                    className="btn btn-primary w-full py-3.5 text-base flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Connecting…
                      </>
                    ) : (
                      <>
                        Add to workspace
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <form onSubmit={(e) => void handleSignupAndAccept(e)} className="space-y-4">
                  <p className="text-sm text-text-secondary text-center mb-2">
                    Set up your profile to accept this shared list.{" "}
                    <Link href={signInHref} className="text-neon-purple underline">
                      Sign in
                    </Link>{" "}
                    if you already have an account.
                  </p>

                  {workspacePicker}

                  {error ? (
                    <div className="rounded-xl border border-[var(--priority-p1)]/40 bg-bg-secondary px-3 py-2 text-xs text-[var(--priority-p1)]">
                      {error}
                    </div>
                  ) : null}

                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-text-muted mb-1.5">
                      Full name
                    </label>
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
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
                        onChange={(e) =>
                          setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))
                        }
                        className="input w-full px-4 py-3 rounded-2xl text-base"
                        required
                        minLength={USERNAME_MIN_LENGTH}
                        autoComplete="username"
                      />
                    </div>
                    {usernameMessage ? (
                      <p className="mt-1.5 text-xs text-text-muted">{usernameMessage}</p>
                    ) : null}
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-text-muted mb-1.5">
                      Where you&apos;re from
                    </label>
                    <input
                      type="text"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      className="input w-full px-4 py-3 rounded-2xl text-base"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-text-muted mb-1.5">
                      Email
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="input w-full px-4 py-3 rounded-2xl text-base"
                      required
                      readOnly={!!share.recipientEmail}
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
                      onChange={(e) => setPassword(e.target.value)}
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
                      onChange={(e) => setConfirmPassword(e.target.value)}
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
                        Connecting…
                      </>
                    ) : (
                      <>
                        <Check className="h-4 w-4" />
                        Add to workspace
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