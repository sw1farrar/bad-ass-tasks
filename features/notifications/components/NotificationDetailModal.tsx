"use client";

import React from "react";
import { Check, Clock, ListChecks, Mail, Star, Users, Zap } from "lucide-react";
import { BottomSheet } from "@/components/BottomSheet";
import type { Notification } from "@/types";
import { formatRoleLabel } from "@/lib/roles";

export type AppView = "home" | "tasks" | "notes" | "teams";

export interface NotificationDetailModalProps {
  notification: Notification | null;
  onClose: () => void;
  onMarkRead?: (id: string) => void;
  onDismiss?: (id: string) => void;
  onViewChange?: (view: AppView) => void;
  onOpenNote?: (noteId: string) => void;
  onAcceptListShare?: (shareId: string) => void | Promise<void>;
  onDeclineListShare?: (shareId: string) => void | Promise<void>;
}

type InviteMetadata = {
  workspace_name?: string;
  invited_by_name?: string;
  role?: string;
  note_id?: string;
  list_share_id?: string;
  list_title?: string;
  source_workspace_name?: string;
  shared_by_name?: string;
};

function NotificationTypeIcon({ type }: { type: Notification["type"] }) {
  const className = "h-5 w-5";
  switch (type) {
    case "invite":
      return <Users className={className} />;
    case "mention":
      return <Zap className={className} />;
    case "comment":
      return <Star className={className} />;
    case "task_assigned":
      return <Check className={className} />;
    case "deadline":
      return <Clock className={className} />;
    case "activity":
      return <Zap className={className} />;
    case "inbound_file":
      return <Mail className={className} />;
    case "list_share":
      return <ListChecks className={className} />;
    default:
      return null;
  }
}

export function NotificationDetailModal({
  notification,
  onClose,
  onMarkRead,
  onDismiss,
  onViewChange,
  onOpenNote,
  onAcceptListShare,
  onDeclineListShare,
}: NotificationDetailModalProps) {
  if (!notification) return null;

  const metadata = notification.metadata as InviteMetadata | undefined;
  const hasMetadata = metadata && Object.keys(metadata).length > 0;

  const handleLinkAction = () => {
    if (notification.type === "invite") {
      onViewChange?.("teams");
      onClose();
      return;
    }

    if (
      (notification.type === "activity" || notification.type === "inbound_file") &&
      metadata?.note_id
    ) {
      onViewChange?.("notes");
      onOpenNote?.(metadata.note_id);
      onClose();
      return;
    }

    if (!notification.link) return;
    if (notification.link.startsWith("?")) {
      const url = new URL(window.location.href);
      const params = new URLSearchParams(notification.link.replace(/^\?/, ""));
      params.forEach((value, key) => url.searchParams.set(key, value));
      window.history.replaceState({}, "", url.toString());
      const view = url.searchParams.get("view");
      if (view === "home" || view === "tasks" || view === "notes" || view === "teams") {
        onViewChange?.(view);
      }
    } else {
      window.location.hash = notification.link;
    }
    onClose();
  };

  const handleDismiss = () => {
    if (notification.type === "invite" || notification.type === "list_share") {
      onClose();
      return;
    }
    if (onDismiss) {
      onDismiss(notification.id);
    } else if (!notification.readAt) {
      onMarkRead?.(notification.id);
    }
    onClose();
  };

  const shareId = metadata?.list_share_id;
  const isPendingListShare = notification.type === "list_share" && !notification.readAt && !!shareId;

  return (
    <BottomSheet
      open
      onClose={onClose}
      title={notification.title}
      zIndex={300}
      mobileLayout="sheet"
      panelClassName="notification-detail-modal bg-bg-secondary border-border-glass"
      showDragHandle
      enableDragDismiss
      dragMode="handle"
    >
      <div className="p-5 text-sm">
        <div className="flex items-center gap-3 mb-4 text-neon-purple">
          <NotificationTypeIcon type={notification.type} />
          <span className="text-xs uppercase tracking-widest text-text-muted">Notification</span>
        </div>

        <div className="text-text-primary whitespace-pre-wrap mb-4 leading-relaxed">
          {notification.message}
        </div>

        {hasMetadata && (
          <div className="mb-4 rounded-xl bg-surface-elevated border border-border-glass/60 p-3 text-[11px] text-text-secondary">
            <div className="font-mono text-[10px] mb-1 opacity-60">DETAILS</div>
            {metadata.workspace_name && (
              <div>
                Workspace: <span className="text-text-primary">{metadata.workspace_name}</span>
              </div>
            )}
            {metadata.invited_by_name && (
              <div>
                From: <span className="text-text-primary">{metadata.invited_by_name}</span>
              </div>
            )}
            {metadata.role && (
              <div>
                Role: <span className="text-text-primary">{formatRoleLabel(String(metadata.role))}</span>
              </div>
            )}
            {metadata.list_title && (
              <div>
                List: <span className="text-text-primary">{metadata.list_title}</span>
              </div>
            )}
            {metadata.source_workspace_name && (
              <div>
                From workspace:{" "}
                <span className="text-text-primary">{metadata.source_workspace_name}</span>
              </div>
            )}
            {metadata.shared_by_name && (
              <div>
                Shared by: <span className="text-text-primary">{metadata.shared_by_name}</span>
              </div>
            )}
          </div>
        )}

        <div className="text-[10px] text-text-muted mb-5">
          {new Date(notification.createdAt).toLocaleString()}
        </div>

        <div className="flex flex-col-reverse sm:flex-row gap-2.5">
          {isPendingListShare ? (
            <>
              <button
                type="button"
                onClick={() => {
                  if (shareId) onDeclineListShare?.(shareId);
                  onClose();
                }}
                className="flex-1 min-h-[44px] rounded-xl border border-border-glass text-sm font-medium hover:bg-surface-hover transition"
              >
                Decline
              </button>
              <button
                type="button"
                onClick={() => {
                  if (shareId) onAcceptListShare?.(shareId);
                  onClose();
                }}
                className="btn btn-primary text-sm flex-1 min-h-[44px]"
              >
                Choose workspace
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={handleDismiss}
                className="flex-1 min-h-[44px] rounded-xl border border-border-glass text-sm font-medium hover:bg-surface-hover transition"
              >
                {notification.type === "invite" || notification.type === "list_share"
                  ? "Close"
                  : "Dismiss"}
              </button>
              {notification.link && (
                <button
                  type="button"
                  onClick={handleLinkAction}
                  className="btn btn-primary text-sm flex-1 min-h-[44px]"
                >
                {notification.type === "invite" ? "View invites" : "Go to link"}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </BottomSheet>
  );
}
