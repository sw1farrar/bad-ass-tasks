"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Bell, Check, Clock, ListChecks, Star, Users, X, Zap } from "lucide-react";
import { toast } from "sonner";
import {
  getWorkspacePanelNotifications,
  isBellUnread,
} from "@/lib/notifications/notificationSelectors";
import { cn } from "@/lib/utils";
import { useTaskStore } from "@/store/useTaskStore";
import type { Notification } from "@/types";

interface HomeWorkspaceNotificationDropdownProps {
  workspaceId: string;
  workspaceName: string;
  notifications: Notification[];
  unreadCount: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenNotification: (notification: Notification) => void;
}

function NotificationTypeIcon({ type }: { type: Notification["type"] }) {
  const className = "h-3.5 w-3.5";
  switch (type) {
    case "mention":
    case "activity":
    case "inbound_file":
      return <Zap className={className} aria-hidden />;
    case "comment":
      return <Star className={className} aria-hidden />;
    case "invite":
      return <Users className={className} aria-hidden />;
    case "list_share":
      return <ListChecks className={className} aria-hidden />;
    case "task_assigned":
      return <Check className={className} aria-hidden />;
    case "deadline":
      return <Clock className={className} aria-hidden />;
    default:
      return <Bell className={className} aria-hidden />;
  }
}

export function HomeWorkspaceNotificationDropdown({
  workspaceId,
  workspaceName,
  notifications,
  unreadCount,
  open,
  onOpenChange,
  onOpenNotification,
}: HomeWorkspaceNotificationDropdownProps) {
  const badgeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({});

  const deleteNotification = useTaskStore((s) => s.deleteNotification);
  const fetchNotifications = useTaskStore((s) => s.fetchNotifications);
  const markNotifRead = useTaskStore((s) => s.markNotifRead);

  const panelNotifications = useMemo(
    () => getWorkspacePanelNotifications(notifications, workspaceId, 25),
    [notifications, workspaceId],
  );

  const updatePanelPosition = useCallback(() => {
    const badge = badgeRef.current;
    if (!badge) return;
    const rect = badge.getBoundingClientRect();
    const panelWidth = Math.min(288, window.innerWidth - 16);
    const left = Math.min(
      Math.max(8, rect.right - panelWidth),
      window.innerWidth - panelWidth - 8,
    );
    setPanelStyle({
      position: "fixed",
      top: rect.bottom + 6,
      left,
      width: panelWidth,
      zIndex: 260,
    });
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    updatePanelPosition();
    void fetchNotifications?.(false).catch(() => {});
    const onResize = () => updatePanelPosition();
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
    };
  }, [open, fetchNotifications, updatePanelPosition]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (badgeRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      onOpenChange(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onOpenChange(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onOpenChange]);

  const handleDismiss = async (id: string) => {
    const notif = notifications.find((n) => n.id === id);
    if (notif?.type === "invite") {
      toast.info("Use Accept or Decline on the invitation banner to respond.");
      return;
    }
    if (notif?.type === "list_share") {
      toast.info("Use Accept or Decline on the shared list banner to respond.");
      return;
    }
    await deleteNotification?.(id);
  };

  const toggleOpen = () => {
    onOpenChange(!open);
  };

  if (unreadCount <= 0 && panelNotifications.length === 0) {
    return null;
  }

  const panel = open && mounted ? (
    createPortal(
      <div
        ref={panelRef}
        className="home-ws-notif__panel glass-strong rounded-xl border border-border-glass shadow-2xl overflow-hidden"
        style={panelStyle}
        role="dialog"
        aria-label={`${workspaceName} notifications`}
        data-no-activate
        onClick={(e) => e.stopPropagation()}
      >
        <div className="home-ws-notif__header px-3 py-2 border-b border-border-glass flex items-center justify-between gap-2 bg-bg">
          <div className="min-w-0 text-xs font-semibold tracking-tight flex items-center gap-1.5">
            <Bell className="h-3.5 w-3.5 shrink-0 text-[var(--priority-p0)]" aria-hidden />
            <span className="truncate">{workspaceName}</span>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="shrink-0 p-1 rounded-md text-text-muted hover:text-text-primary hover:bg-surface-hover transition"
            aria-label="Close notifications"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="home-ws-notif__list max-h-[min(16rem,40vh)] overflow-y-auto p-1 text-sm">
          {panelNotifications.length === 0 ? (
            <div className="px-3 py-4 text-center text-[11px] text-text-muted">
              No notifications in this workspace.
            </div>
          ) : (
            panelNotifications.map((notification) => (
              <div
                key={notification.id}
                role="button"
                tabIndex={0}
                onClick={() => {
                  if (isBellUnread(notification)) {
                    void markNotifRead?.(notification.id);
                  }
                  onOpenNotification(notification);
                  onOpenChange(false);
                }}
                onKeyDown={(e) => {
                  if (e.key !== "Enter" && e.key !== " ") return;
                  e.preventDefault();
                  if (isBellUnread(notification)) {
                    void markNotifRead?.(notification.id);
                  }
                  onOpenNotification(notification);
                  onOpenChange(false);
                }}
                className={cn(
                  "home-ws-notif__item px-2.5 py-2 rounded-lg m-0.5 cursor-pointer border border-border-glass bg-bg-panel hover:bg-bg-tertiary flex gap-2 transition-colors",
                  isBellUnread(notification) && "bg-[var(--priority-p0)]/8 border-[var(--priority-p0)]/25",
                )}
              >
                <div className="mt-0.5 text-neon-purple/80 shrink-0">
                  <NotificationTypeIcon type={notification.type} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-[11px] truncate">{notification.title}</div>
                  <div className="text-[10px] text-text-secondary line-clamp-2">
                    {notification.message}
                  </div>
                  <div className="text-[9px] text-text-muted mt-0.5">
                    {new Date(notification.createdAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
                {isBellUnread(notification) ? (
                  <div
                    className="w-1.5 h-1.5 mt-1.5 rounded-full bg-[var(--priority-p0)] shrink-0"
                    aria-hidden
                  />
                ) : null}
                {notification.type !== "invite" && notification.type !== "list_share" ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleDismiss(notification.id);
                    }}
                    className="shrink-0 p-1 text-text-muted hover:text-text-primary rounded hover:bg-surface-hover self-start"
                    aria-label="Remove notification"
                  >
                    <X className="h-3 w-3" />
                  </button>
                ) : null}
              </div>
            ))
          )}
        </div>
      </div>,
      document.body,
    )
  ) : null;

  return (
    <div className="home-ws-notif relative" data-no-activate>
      <button
        ref={badgeRef}
        type="button"
        data-no-activate
        onClick={(e) => {
          e.stopPropagation();
          toggleOpen();
        }}
        className={cn(
          "home-ws-notif__toggle home-ws-vitals__icon-btn",
          open && "home-ws-notif__toggle--open",
        )}
        title={`${unreadCount} unread notification${unreadCount === 1 ? "" : "s"} in ${workspaceName}`}
        aria-label={`${unreadCount} unread notifications in ${workspaceName}`}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <span className="home-ws-notif__icon-wrap home-ws-vitals__icon-wrap">
          <Bell className="home-ws-notif__bell home-ws-vitals__icon" aria-hidden />
          <span
            className="nav-count-badge nav-count-badge--bottom nav-count-badge--overdue home-ws-notif__count"
            aria-hidden
          >
            <span className="nav-count-badge__pulse" aria-hidden />
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        </span>
      </button>
      {panel}
    </div>
  );
}