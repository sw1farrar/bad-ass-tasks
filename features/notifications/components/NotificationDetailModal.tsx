"use client";

import React from "react";
import { Check, Clock, Star, Users, X, Zap } from "lucide-react";
import type { Notification } from "@/types";

export type AppView = "home" | "today" | "tasks" | "notes" | "teams";

export interface NotificationDetailModalProps {
  notification: Notification | null;
  onClose: () => void;
  onMarkRead?: (id: string) => void;
  onViewChange?: (view: AppView) => void;
}

type InviteMetadata = {
  workspace_name?: string;
  invited_by_name?: string;
  role?: string;
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
}: NotificationDetailModalProps) {
  if (!notification) return null;

  const metadata = notification.metadata as InviteMetadata | undefined;
  const hasMetadata =
    metadata && Object.keys(metadata).length > 0;

  const handleLinkAction = () => {
    if (!notification.link) return;
    if (notification.type === "invite") {
      onViewChange?.("teams");
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
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="glass-strong w-full max-w-md rounded-3xl border border-white/10 p-6 text-sm shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="text-[#c084fc]">
              <NotificationTypeIcon type={notification.type} />
            </div>
            <div className="font-semibold text-lg tracking-tight">
              {notification.title}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#71717a] hover:text-white p-1"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="text-[#e5e5e7] whitespace-pre-wrap mb-4 leading-relaxed">
          {notification.message}
        </div>

        {hasMetadata && (
          <div className="mb-4 rounded-xl bg-black/30 border border-white/5 p-3 text-[11px] text-[#a1a1aa]">
            <div className="font-mono text-[10px] mb-1 opacity-60">DETAILS</div>
            {metadata.workspace_name && (
              <div>
                Workspace:{" "}
                <span className="text-white">{metadata.workspace_name}</span>
              </div>
            )}
            {metadata.invited_by_name && (
              <div>
                From:{" "}
                <span className="text-white">{metadata.invited_by_name}</span>
              </div>
            )}
            {metadata.role && (
              <div>
                Role: <span className="text-white">{metadata.role}</span>
              </div>
            )}
          </div>
        )}

        <div className="text-[10px] text-[#71717a] mb-5">
          {new Date(notification.createdAt).toLocaleString()}
        </div>

        <div className="flex gap-2">
          {notification.link && (
            <button
              onClick={handleLinkAction}
              className="btn btn-primary text-sm flex-1"
            >
              {notification.type === "invite" ? "View invites" : "Go to link"}
            </button>
          )}
          <button
            onClick={handleDismiss}
            className="flex-1 rounded-xl border border-white/15 py-2 text-sm hover:bg-white/5"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}