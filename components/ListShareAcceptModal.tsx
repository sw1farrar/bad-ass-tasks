"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowRight, ListChecks, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { BottomSheet } from "@/components/BottomSheet";
import { useIsMobileViewport } from "@/lib/hooks/useIsMobileViewport";
import { useScrollLock } from "@/lib/hooks/useScrollLock";
import type {
  ListSharePreviewClient,
  ListShareWorkspaceOption,
} from "@/lib/list-share/listShareAcceptTypes";

type ListShareAcceptModalProps = {
  open: boolean;
  shareId: string | null;
  onOpenChange: (open: boolean) => void;
  onAccepted?: (result: { listId: string; targetWorkspaceId: string }) => void | Promise<void>;
  onAccept: (shareId: string, targetWorkspaceId: string) => Promise<{ listId: string; targetWorkspaceId: string } | null>;
  onLoadWorkspaces: (
    shareId: string,
  ) => Promise<
    | { ok: true; workspaces: ListShareWorkspaceOption[] }
    | { ok: false; error: string }
  >;
};

function ListShareAcceptBody({
  shareId,
  onClose,
  onAccepted,
  onAccept,
  onLoadWorkspaces,
}: {
  shareId: string;
  onClose: () => void;
  onAccepted?: ListShareAcceptModalProps["onAccepted"];
  onAccept: ListShareAcceptModalProps["onAccept"];
  onLoadWorkspaces: ListShareAcceptModalProps["onLoadWorkspaces"];
}) {
  const [share, setShare] = useState<ListSharePreviewClient | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [workspaces, setWorkspaces] = useState<ListShareWorkspaceOption[]>([]);
  const [workspacesLoading, setWorkspacesLoading] = useState(false);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setShare(null);
    setWorkspaces([]);
    setSelectedWorkspaceId(null);

    (async () => {
      try {
        const response = await fetch(`/api/list-share/${shareId}`);
        const payload = (await response.json().catch(() => ({}))) as {
          share?: ListSharePreviewClient;
          error?: string;
        };

        if (!response.ok || !payload.share) {
          if (!cancelled) {
            setError(payload.error || "This share link is not valid.");
          }
          return;
        }

        if (!cancelled) {
          setShare(payload.share);
        }
      } catch {
        if (!cancelled) setError("Could not load this shared list.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [shareId]);

  useEffect(() => {
    if (!share?.isValid) return;

    let cancelled = false;
    setWorkspacesLoading(true);
    setError(null);

    (async () => {
      const result = await onLoadWorkspaces(shareId);
      if (cancelled) return;

      if (!result.ok) {
        setError(result.error);
        setWorkspaces([]);
        setSelectedWorkspaceId(null);
        setWorkspacesLoading(false);
        return;
      }

      setWorkspaces(result.workspaces);
      const firstAvailable = result.workspaces.find((workspace) => !workspace.alreadyLinked);
      setSelectedWorkspaceId(firstAvailable?.id ?? null);

      if (result.workspaces.length === 0) {
        setError("Create a workspace first, then come back to accept this shared list.");
      } else if (!firstAvailable) {
        setError("This list is already connected to all of your workspaces.");
      }

      setWorkspacesLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [share?.isValid, shareId, onLoadWorkspaces]);

  const handleAccept = async () => {
    if (!selectedWorkspaceId) {
      setError("Choose a workspace first.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const result = await onAccept(shareId, selectedWorkspaceId);
      if (!result) return;

      toast.success("List connected", { description: share?.listTitle });
      await onAccepted?.(result);
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not accept shared list.";
      setError(message);
      toast.error("Could not accept share", { description: message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col min-h-0">
      <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-3 border-b border-border-glass">
        <div className="min-w-0 flex items-start gap-3">
          <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-neon-purple to-neon-purple-dark flex items-center justify-center shrink-0">
            <ListChecks className="h-5 w-5 text-accent-on" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-semibold tracking-tight">Accept shared list</h2>
            <p className="text-xs text-text-muted mt-1 leading-relaxed">
              Choose which workspace should receive this live-linked list.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-hover transition shrink-0"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="px-4 py-4 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-text-muted">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading shared list…
          </div>
        ) : error && !share ? (
          <div className="rounded-xl border border-[var(--priority-p1)]/40 bg-bg-secondary px-3 py-3 text-sm text-[var(--priority-p1)]">
            {error}
          </div>
        ) : share ? (
          <>
            <div className="rounded-xl border border-border-glass bg-surface-hover/60 px-4 py-3">
              <p className="text-sm font-semibold">{share.listTitle}</p>
              <p className="text-xs text-text-secondary mt-1 leading-relaxed">
                <span className="text-text-primary font-medium">{share.sharerName}</span> shared this from{" "}
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

            {!share.isValid ? (
              <p className="text-sm text-[var(--priority-p1)] text-center">{share.invalidReason}</p>
            ) : (
              <>
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-widest text-text-muted">Destination workspace</p>
                  {workspacesLoading ? (
                    <div className="flex items-center justify-center gap-2 py-4 text-sm text-text-muted">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading workspaces…
                    </div>
                  ) : workspaces.length > 0 ? (
                    <div className="space-y-2 max-h-52 overflow-y-auto">
                      {workspaces.map((workspace) => (
                        <label
                          key={workspace.id}
                          className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition ${
                            workspace.alreadyLinked
                              ? "border-border-subtle opacity-50 cursor-not-allowed"
                              : selectedWorkspaceId === workspace.id
                                ? "border-neon-purple bg-neon-purple/10"
                                : "border-border-glass bg-surface-hover hover:bg-surface-hover/80"
                          }`}
                        >
                          <input
                            type="radio"
                            name="list-share-target-workspace"
                            value={workspace.id}
                            disabled={workspace.alreadyLinked}
                            checked={selectedWorkspaceId === workspace.id}
                            onChange={() => setSelectedWorkspaceId(workspace.id)}
                            className="accent-neon-purple"
                          />
                          <span className="flex-1 min-w-0">
                            <span className="font-medium block truncate">{workspace.name}</span>
                            {workspace.alreadyLinked ? (
                              <span className="text-xs text-text-muted">Already connected</span>
                            ) : null}
                          </span>
                        </label>
                      ))}
                    </div>
                  ) : null}
                </div>

                {error ? (
                  <div className="rounded-xl border border-[var(--priority-p1)]/40 bg-bg-secondary px-3 py-2 text-xs text-[var(--priority-p1)]">
                    {error}
                  </div>
                ) : null}

                <button
                  type="button"
                  onClick={() => void handleAccept()}
                  disabled={submitting || workspacesLoading || !selectedWorkspaceId || !share.isValid}
                  className="btn btn-primary w-full min-h-[44px] flex items-center justify-center gap-2 disabled:opacity-60"
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
              </>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}

export function ListShareAcceptModal({
  open,
  shareId,
  onOpenChange,
  onAccepted,
  onAccept,
  onLoadWorkspaces,
}: ListShareAcceptModalProps) {
  const isMobile = useIsMobileViewport();
  useScrollLock(open && isMobile);

  if (!open || !shareId) return null;

  const close = () => onOpenChange(false);

  const body = (
    <ListShareAcceptBody
      key={shareId}
      shareId={shareId}
      onClose={close}
      onAccepted={onAccepted}
      onAccept={onAccept}
      onLoadWorkspaces={onLoadWorkspaces}
    />
  );

  if (isMobile) {
    return (
      <BottomSheet open={open} onClose={close} ariaLabel="Accept shared list">
        {body}
      </BottomSheet>
    );
  }

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/55 backdrop-blur-[2px]"
        aria-label="Close accept shared list"
        onClick={close}
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-md glass modal-panel rounded-2xl border border-border-glass shadow-2xl overflow-hidden flex flex-col"
      >
        {body}
      </div>
    </div>,
    document.body,
  );
}
