"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Building2, Link2, Loader2, Search, Share2, Unlink, X } from "lucide-react";
import { toast } from "sonner";
import { BottomSheet } from "@/components/BottomSheet";
import { ConfirmationModal } from "@/components/ConfirmationModal";
import { getSearchResultDisplayName } from "@/lib/assignee";
import { useIsMobileViewport } from "@/lib/hooks/useIsMobileViewport";
import { useScrollLock } from "@/lib/hooks/useScrollLock";

import { useTaskStore } from "@/store/useTaskStore";
import type { ListShareTarget, WorkspaceList } from "@/types";

type SearchResult = {
  id: string;
  fullName?: string;
  username?: string;
  location?: string;
  email?: string;
  avatarUrl?: string;
};

interface ListShareModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  list: WorkspaceList | null;
  workspaceName: string;
}

export function ListShareModal({
  open,
  onOpenChange,
  list,
  workspaceName,
}: ListShareModalProps) {
  const isMobile = useIsMobileViewport();
  const searchPotentialTeammates = useTaskStore((s) => s.searchPotentialTeammates);
  const shareList = useTaskStore((s) => s.shareList);
  const shareListToWorkspace = useTaskStore((s) => s.shareListToWorkspace);
  const revokeListShare = useTaskStore((s) => s.revokeListShare);
  const revokeListShareGrant = useTaskStore((s) => s.revokeListShareGrant);
  const getListShareTargets = useTaskStore((s) => s.getListShareTargets);
  const currentWorkspaceId = useTaskStore((s) => s.currentWorkspace.id);
  const workspaces = useTaskStore((s) => s.workspaces);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [sharingUserId, setSharingUserId] = useState<string | null>(null);
  const [linkingWorkspaceId, setLinkingWorkspaceId] = useState<string | null>(null);
  const [unlinkingWorkspaceId, setUnlinkingWorkspaceId] = useState<string | null>(null);
  const [linkedTargets, setLinkedTargets] = useState<ListShareTarget[]>([]);
  const [loadingTargets, setLoadingTargets] = useState(false);
  const [pendingRevoke, setPendingRevoke] = useState<{ shareId: string; label: string } | null>(null);
  const [pendingUnlink, setPendingUnlink] = useState<{
    targetWorkspaceId: string;
    label: string;
  } | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useScrollLock(open && !isMobile);

  const loadLinkedTargets = useCallback(async () => {
    if (!list?.id) return;
    setLoadingTargets(true);
    try {
      const targets = await getListShareTargets(list.id);
      setLinkedTargets(targets);
    } catch {
      setLinkedTargets([]);
    } finally {
      setLoadingTargets(false);
    }
  }, [getListShareTargets, list?.id]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
      setIsSearching(false);
      setSharingUserId(null);
      setLinkingWorkspaceId(null);
      setUnlinkingWorkspaceId(null);
      setLinkedTargets([]);
    } else if (list?.id) {
      void loadLinkedTargets();
    }
  }, [open, list?.id, loadLinkedTargets]);

  const runSearch = useCallback(
    (q: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (!q.trim()) {
        setResults([]);
        setIsSearching(false);
        return;
      }
      setIsSearching(true);
      debounceRef.current = setTimeout(async () => {
        try {
          const found = await searchPotentialTeammates(q.trim(), currentWorkspaceId);
          setResults(found);
        } catch {
          setResults([]);
        } finally {
          setIsSearching(false);
        }
      }, 350);
    },
    [searchPotentialTeammates, currentWorkspaceId],
  );

  const handleShare = async (result: SearchResult) => {
    if (!list || sharingUserId) return;
    if (!result.email) {
      toast.error("Could not share — no email on file for this user.");
      return;
    }
    setSharingUserId(result.id);
    try {
      const shareId = await shareList(result.id, {
        userId: result.id,
        email: result.email,
        fullName: result.fullName,
        username: result.username,
      });
      if (shareId) {
        setQuery("");
        setResults([]);
      }
    } finally {
      setSharingUserId(null);
    }
  };

  const handleLinkWorkspace = async (targetWorkspaceId: string) => {
    if (!list || linkingWorkspaceId) return;
    setLinkingWorkspaceId(targetWorkspaceId);
    try {
      const shareId = await shareListToWorkspace(list.id, targetWorkspaceId);
      if (shareId) {
        await loadLinkedTargets();
      }
    } finally {
      setLinkingWorkspaceId(null);
    }
  };

  const handleUnlinkWorkspace = async (targetWorkspaceId: string) => {
    if (!list || unlinkingWorkspaceId) return;
    setUnlinkingWorkspaceId(targetWorkspaceId);
    try {
      const ok = await revokeListShareGrant(list.id, targetWorkspaceId);
      if (ok) {
        setLinkedTargets((prev) =>
          prev.filter((t) => t.targetWorkspaceId !== targetWorkspaceId),
        );
      }
    } finally {
      setUnlinkingWorkspaceId(null);
      setPendingUnlink(null);
    }
  };

  const listTitle = list?.title?.trim() || "Untitled list";
  const linkedWorkspaceIds = new Set(linkedTargets.map((t) => t.targetWorkspaceId));
  const otherWorkspaces = (workspaces || []).filter(
    (w) => w.id !== currentWorkspaceId && !linkedWorkspaceIds.has(w.id),
  );

  const workspaceSection = (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-text-primary font-medium">
        <Building2 className="h-4 w-4 text-neon-purple shrink-0" />
        <span>Your workspaces</span>
      </div>
      <p className="text-xs text-text-muted -mt-1">
        Link this list into another workspace you belong to. Changes stay synced live in both places.
      </p>

      {loadingTargets ? (
        <div className="flex items-center gap-2 text-sm text-text-secondary px-1">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading linked workspaces…
        </div>
      ) : null}

      {linkedTargets.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-text-muted uppercase tracking-wide">Linked</p>
          {linkedTargets.map((target) => {
            const isUnlinking = unlinkingWorkspaceId === target.targetWorkspaceId;
            return (
              <div
                key={target.shareId}
                className="flex items-center justify-between p-3 rounded-xl bg-surface-hover border border-border-glass"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-9 w-9 rounded-lg bg-neon-purple/15 flex items-center justify-center shrink-0">
                    <Link2 className="h-4 w-4 text-neon-purple" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium truncate">{target.targetWorkspaceName}</div>
                    <div className="text-xs text-text-muted">Live-synced</div>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={isUnlinking}
                  onClick={() =>
                    setPendingUnlink({
                      targetWorkspaceId: target.targetWorkspaceId,
                      label: target.targetWorkspaceName,
                    })
                  }
                  className="btn px-3 py-2 text-sm shrink-0 border border-border-glass hover:bg-surface-hover disabled:opacity-60"
                >
                  {isUnlinking ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Unlink className="h-3.5 w-3.5 inline mr-1.5" />
                      Unlink
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      ) : null}

      {otherWorkspaces.length > 0 ? (
        <div className="space-y-2">
          {linkedTargets.length > 0 ? (
            <p className="text-xs font-medium text-text-muted uppercase tracking-wide">Add to</p>
          ) : null}
          {otherWorkspaces.map((ws) => {
            const isLinking = linkingWorkspaceId === ws.id;
            return (
              <div
                key={ws.id}
                className="flex items-center justify-between p-3 rounded-xl bg-surface-hover border border-border-glass"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-9 w-9 rounded-lg bg-surface-active flex items-center justify-center shrink-0 text-sm font-semibold text-text-secondary">
                    {ws.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="font-medium truncate">{ws.name}</div>
                </div>
                <button
                  type="button"
                  disabled={isLinking}
                  onClick={() => void handleLinkWorkspace(ws.id)}
                  className="btn btn-primary px-4 py-2 text-sm shrink-0 disabled:opacity-60"
                >
                  {isLinking ? <Loader2 className="h-4 w-4 animate-spin" /> : "Link"}
                </button>
              </div>
            );
          })}
        </div>
      ) : !loadingTargets && linkedTargets.length === 0 ? (
        <p className="text-sm text-text-muted text-center py-2">
          You only belong to this workspace. Create or join another workspace to link lists across them.
        </p>
      ) : null}
    </div>
  );

  const peopleSection = (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-text-primary font-medium">
        <Share2 className="h-4 w-4 text-neon-purple shrink-0" />
        <span>Share with people</span>
      </div>
      <p className="text-xs text-text-muted -mt-1">
        Teammates can add this live-linked list to any workspace they belong to.
      </p>

      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => {
            const q = e.target.value;
            setQuery(q);
            runSearch(q);
          }}
          placeholder="Name, @username, or city"
          className="team-empty-search-input input w-full px-4 py-3 rounded-xl pr-11"
          autoFocus={!isMobile}
        />
        {query ? (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setResults([]);
              setIsSearching(false);
            }}
            className="team-empty-search-clear absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        ) : (
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted pointer-events-none" />
        )}
      </div>

      {isSearching ? (
        <div className="flex items-center gap-2 text-sm text-text-secondary px-1">
          <Loader2 className="h-4 w-4 animate-spin" /> Searching directory…
        </div>
      ) : null}

      {!isSearching && results.length > 0 ? (
        <div className="space-y-2 max-h-[32vh] overflow-y-auto">
          {results.map((result) => {
            const initial = (result.fullName || result.username || result.email || "?")
              .toString()[0]
              .toUpperCase();
            const displayName = getSearchResultDisplayName(result);
            const isSharing = sharingUserId === result.id;
            return (
              <div
                key={result.id}
                className="team-invite-result-row flex items-center justify-between p-3 rounded-xl bg-surface-hover border border-border-glass"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {result.avatarUrl ? (
                    <img
                      src={result.avatarUrl}
                      alt=""
                      className="h-10 w-10 rounded-full object-cover border border-border-glass"
                    />
                  ) : (
                    <div className="h-10 w-10 rounded-full bg-gradient-to-br from-neon-purple/80 to-neon-purple-dark/80 flex items-center justify-center text-accent-on font-bold shrink-0">
                      {initial}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="font-medium truncate">{displayName}</div>
                    {result.username ? (
                      <div className="text-xs text-neon-purple font-mono">@{result.username}</div>
                    ) : null}
                    {result.location ? (
                      <div className="text-xs text-text-muted truncate">{result.location}</div>
                    ) : null}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={isSharing}
                  onClick={() => void handleShare(result)}
                  className="btn btn-primary px-4 py-2 text-sm shrink-0 disabled:opacity-60"
                >
                  {isSharing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Share"}
                </button>
              </div>
            );
          })}
        </div>
      ) : null}

      {!isSearching && query.trim() && results.length === 0 ? (
        <p className="text-sm text-text-muted text-center py-2">No people found. Try a different search.</p>
      ) : null}
    </div>
  );

  const body = (
    <div className="text-sm space-y-6">
      <p className="text-text-secondary text-center text-sm">
        From <span className="text-text-primary font-medium">{workspaceName}</span>
      </p>

      {workspaceSection}

      <div className="border-t border-border-subtle" />

      {peopleSection}
    </div>
  );

  const confirmation = (
    <>
      <ConfirmationModal
        open={!!pendingRevoke}
        onOpenChange={(o) => !o && setPendingRevoke(null)}
        title="Revoke list share?"
        description="The recipient will no longer be able to accept this share link."
        highlight={pendingRevoke?.label}
        confirmText="Revoke"
        cancelText="Cancel"
        variant="destructive"
        onConfirm={async () => {
          if (pendingRevoke) {
            await revokeListShare(pendingRevoke.shareId);
            setPendingRevoke(null);
          }
        }}
      />
      <ConfirmationModal
        open={!!pendingUnlink}
        onOpenChange={(o) => !o && setPendingUnlink(null)}
        title="Unlink from workspace?"
        description="The list will be removed from that workspace. The original list is unchanged."
        highlight={pendingUnlink?.label}
        confirmText="Unlink"
        cancelText="Cancel"
        variant="destructive"
        onConfirm={async () => {
          if (pendingUnlink) {
            await handleUnlinkWorkspace(pendingUnlink.targetWorkspaceId);
          }
        }}
      />
    </>
  );

  if (isMobile) {
    return (
      <>
        <BottomSheet
          open={open}
          onClose={() => onOpenChange(false)}
          title={`Share “${listTitle}”`}
          mobileLayout="sheet"
        >
          {body}
        </BottomSheet>
        {confirmation}
      </>
    );
  }

  if (!open || typeof document === "undefined") return confirmation;

  return (
    <>
      {createPortal(
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="list-share-modal-title"
        >
          <button
            type="button"
            className="absolute inset-0 overlay-scrim backdrop-blur-sm"
            aria-label="Close"
            onClick={() => onOpenChange(false)}
          />
          <div className="modal-panel relative w-full max-w-lg rounded-2xl border border-border-glass bg-bg-secondary shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <Share2 className="h-5 w-5 text-neon-purple shrink-0" />
                <h2 id="list-share-modal-title" className="font-semibold truncate">
                  Share “{listTitle}”
                </h2>
              </div>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="p-2 rounded-lg hover:bg-surface-hover text-text-muted"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-5 overflow-y-auto">{body}</div>
          </div>
        </div>,
        document.body,
      )}
      {confirmation}
    </>
  );
}