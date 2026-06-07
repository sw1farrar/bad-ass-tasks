"use client";

import React from "react";
import { Check, Clock, Star, Users, Zap } from "lucide-react";
import { BottomSheet } from "@/components/BottomSheet";
import type { Notification } from "@/types";
import { formatRoleLabel } from "@/lib/roles";

export type AppView = "home" | "tasks" | "notes" | "teams";

export interface NotificationDetailModalProps {
  notification: Notification | null;
  onClose: () => void;
  onMarkRead?: (id: string) => void;
  onViewChange?: (view: AppView) => void;
  onOpenNote?: (noteId: string) => void;
}

type InviteMetadata = {
  workspace_name?: string;
  invited_by_name?: string;
  role?: string;
  note_id?: string;
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
    default:
      return null;
  }
}

export function NotificationDetailModal({
  notification,
  onClose,
  onMarkRead,
  onViewChange,
  onOpenNote,
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

    if (notification.type === "activity" && metadata?.note_id) {
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
    if (!notification.readAt) {
      onMarkRead?.(notification.id);
    }
    onClose();
  };

  return (
    <BottomSheet
      open
      onClose={onClose}
      title={notification.title}
      zIndex={300}
      mobileLayout="centered"
      backdropClassName="bg-black/[0.9] backdrop-blur-md"
      panelClassName="bg-[#111114] border-white/10"
      showDragHandle={false}
      enableDragDismiss={false}
    >
      <div className="p-5 text-sm">
        <div className="flex items-center gap-3 mb-4 text-[#c084fc]">
          <NotificationTypeIcon type={notification.type} />
          <span className="text-xs uppercase tracking-widest text-[#71717a]">Notification</span>
        </div>

        <div className="text-[#e5e5e7] whitespace-pre-wrap mb-4 leading-relaxed">
          {notification.message}
        </div>

        {hasMetadata && (
          <div className="mb-4 rounded-xl bg-black/30 border border-white/5 p-3 text-[11px] text-[#a1a1aa]">
            <div className="font-mono text-[10px] mb-1 opacity-60">DETAILS</div>
            {metadata.workspace_name && (
              <div>
                Workspace: <span className="text-white">{metadata.workspace_name}</span>
              </div>
            )}
            {metadata.invited_by_name && (
              <div>
                From: <span className="text-white">{metadata.invited_by_name}</span>
              </div>
            )}
            {metadata.role && (
              <div>
                Role: <span className="text-white">{formatRoleLabel(String(metadata.role))}</span>
              </div>
            )}
          </div>
        )}

        <div className="text-[10px] text-[#71717a] mb-5">
          {new Date(notification.createdAt).toLocaleString()}
        </div>

        <div className="flex flex-col-reverse sm:flex-row gap-2.5">
          <button
            type="button"
            onClick={handleDismiss}
            className="flex-1 min-h-[44px] rounded-xl border border-white/15 text-sm font-medium hover:bg-white/5 transition"
          >
            Dismiss
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
        </div>
      </div>
    </BottomSheet>
  );
}