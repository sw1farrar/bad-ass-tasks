"use client";

import React from "react";
import {
  Bell,
  Check,
  CheckCheck,
  Clock,
  ListChecks,
  Mail,
  Star,
  Trash2,
  Users,
  X,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { safeFormatDistanceToNow } from "@/lib/datetime";
import type { Notification } from "@/types";

export interface NotificationsPanelProps {
  notifications: Notification[];
  visibleNotifications: Notification[];
  unreadCount: number;
  overflowCount?: number;
  isLoading?: boolean;
  onClose: () => void;
  onSelect: (notification: Notification) => void;
  onMarkAllRead?: () => void;
  onClearAll?: () => void;
  onDismiss?: (id: string) => void;
  onAcceptListShare?: (shareId: string, link?: string) => void;
  onDeclineListShare?: (shareId: string) => void;
  isUnread: (n: Notification) => boolean;
  className?: string;
}

function typeMeta(type: Notification["type"]): {
  label: string;
  icon: React.ReactNode;
  accent: string;
} {
  const iconClass = "h-3.5 w-3.5";
  switch (type) {
    case "invite":
      return {
        label: "Invite",
        icon: <Users className={iconClass} />,
        accent: "bg-sky-500/15 text-sky-300 border-sky-500/25",
      };
    case "mention":
      return {
        label: "Mention",
        icon: <Zap className={iconClass} />,
        accent: "bg-amber-500/15 text-amber-300 border-amber-500/25",
      };
    case "comment":
      return {
        label: "Comment",
        icon: <Star className={iconClass} />,
        accent: "bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/25",
      };
    case "task_assigned":
      return {
        label: "Assigned",
        icon: <Check className={iconClass} />,
        accent: "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
      };
    case "deadline":
      return {
        label: "Due",
        icon: <Clock className={iconClass} />,
        accent: "bg-rose-500/15 text-rose-300 border-rose-500/25",
      };
    case "list_share":
      return {
        label: "List share",
        icon: <ListChecks className={iconClass} />,
        accent: "bg-cyan-500/15 text-cyan-300 border-cyan-500/25",
      };
    case "inbound_file":
      return {
        label: "File",
        icon: <Mail className={iconClass} />,
        accent: "bg-indigo-500/15 text-indigo-300 border-indigo-500/25",
      };
    case "activity":
    default:
      return {
        label: "Activity",
        icon: <Zap className={iconClass} />,
        accent: "bg-neon-purple/15 text-neon-purple border-neon-purple/25",
      };
  }
}

function formatWhen(iso: string): string {
  const relative = safeFormatDistanceToNow(iso, "");
  if (relative) return relative;
  try {
    return new Date(iso).toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export function NotificationsPanel({
  notifications,
  visibleNotifications,
  unreadCount,
  overflowCount = 0,
  isLoading = false,
  onClose,
  onSelect,
  onMarkAllRead,
  onClearAll,
  onDismiss,
  onAcceptListShare,
  onDeclineListShare,
  isUnread,
  className,
}: NotificationsPanelProps) {
  const total = notifications.length;

  return (
    <div
      className={cn(
        "notifications-panel flex flex-col overflow-hidden bg-bg-secondary w-full h-full",
        "md:glass-strong md:rounded-2xl md:border md:border-border-glass md:shadow-2xl",
        className,
      )}
      role="dialog"
      aria-label="Notifications"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="notifications-panel__header shrink-0 border-b border-border-glass bg-bg">
        <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-neon-purple/25 bg-neon-purple/10 text-neon-purple">
                <Bell className="h-4 w-4" aria-hidden />
              </div>
              <div className="min-w-0">
                <h2 className="text-[15px] font-semibold tracking-tight text-text-primary leading-none">
                  Notifications
                </h2>
                <p className="mt-1 text-[11px] text-text-muted">
                  {unreadCount > 0
                    ? `${unreadCount} unread`
                    : total > 0
                      ? "You're all caught up"
                      : "Nothing waiting"}
                  {total > 0 ? ` · ${total} total` : null}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {unreadCount > 0 && onMarkAllRead ? (
              <button
                type="button"
                onClick={onMarkAllRead}
                className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-neon-purple hover:bg-neon-purple/10 transition"
                title="Mark all as read"
              >
                <CheckCheck className="h-3.5 w-3.5" aria-hidden />
                <span className="hidden sm:inline">Mark all read</span>
              </button>
            ) : null}
            {total > 0 && onClearAll ? (
              <button
                type="button"
                onClick={onClearAll}
                className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-text-muted hover:text-red-400 hover:bg-red-500/10 transition"
                title="Clear all notifications"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
                <span className="hidden sm:inline">Clear</span>
              </button>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-hover transition"
              aria-label="Close notifications"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Scrollable list */}
      <div className="notifications-panel__list min-h-0 flex-1 overflow-y-auto overscroll-contain p-2 md:p-2.5">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center gap-2 py-14 text-text-muted">
            <div className="h-8 w-8 rounded-full border-2 border-neon-purple/30 border-t-neon-purple animate-spin" />
            <p className="text-xs">Loading notifications…</p>
          </div>
        ) : total === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-border-glass bg-surface-hover text-neon-purple">
              <Bell className="h-5 w-5 opacity-80" aria-hidden />
            </div>
            <p className="text-sm font-medium text-text-primary">All clear</p>
            <p className="mt-1 max-w-[16rem] text-[12px] leading-relaxed text-text-muted">
              Mentions, comments, due tasks, and team activity will show up here.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-1.5" role="list">
            {visibleNotifications.map((n) => {
              const unread = isUnread(n);
              const meta = typeMeta(n.type);
              const when = formatWhen(n.createdAt);
              const workspaceName =
                (n.metadata?.workspace_name as string | undefined)?.trim() || "";

              return (
                <li key={n.id}>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => onSelect(n)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onSelect(n);
                      }
                    }}
                    className={cn(
                      "notifications-panel__item group relative flex gap-3 rounded-xl border px-3 py-3 cursor-pointer transition",
                      "border-border-glass bg-bg-panel/80 hover:bg-bg-tertiary hover:border-border-glass",
                      unread &&
                        "border-neon-purple/35 bg-neon-purple/[0.08] hover:bg-neon-purple/[0.12] shadow-[inset_0_0_0_1px_rgba(167,139,250,0.08)]",
                    )}
                  >
                    <div
                      className={cn(
                        "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border",
                        meta.accent,
                      )}
                      aria-hidden
                    >
                      {meta.icon}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex items-center gap-1.5 flex-wrap">
                          <span className="text-[13px] font-semibold text-text-primary leading-snug">
                            {n.title}
                          </span>
                          {unread ? (
                            <span className="inline-flex h-1.5 w-1.5 rounded-full bg-neon-purple shrink-0" title="Unread" />
                          ) : null}
                        </div>
                        {n.type !== "invite" && n.type !== "list_share" && onDismiss ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDismiss(n.id);
                            }}
                            className="opacity-0 group-hover:opacity-100 focus:opacity-100 -mr-1 -mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-md text-text-muted hover:text-text-primary hover:bg-surface-hover transition"
                            aria-label="Dismiss notification"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        ) : null}
                      </div>

                      <p className="mt-0.5 text-[12px] leading-relaxed text-text-secondary line-clamp-3">
                        {n.message}
                      </p>

                      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-text-muted">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 font-medium",
                            meta.accent,
                          )}
                        >
                          {meta.label}
                        </span>
                        {workspaceName ? (
                          <span className="truncate max-w-[10rem]">{workspaceName}</span>
                        ) : null}
                        {when ? (
                          <>
                            <span aria-hidden className="text-text-faint">
                              ·
                            </span>
                            <time dateTime={n.createdAt}>{when}</time>
                          </>
                        ) : null}
                      </div>

                      {n.type === "list_share" && unread && onAcceptListShare && onDeclineListShare ? (
                        <div className="mt-2.5 flex gap-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              const shareId = n.metadata?.list_share_id as string | undefined;
                              if (shareId) onAcceptListShare(shareId, n.link);
                            }}
                            className="rounded-lg bg-neon-purple/20 px-2.5 py-1 text-[11px] font-semibold text-neon-purple hover:bg-neon-purple/30 transition"
                          >
                            Accept
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              const shareId = n.metadata?.list_share_id as string | undefined;
                              if (shareId) onDeclineListShare(shareId);
                            }}
                            className="rounded-lg border border-border-glass px-2.5 py-1 text-[11px] font-medium text-text-secondary hover:bg-surface-hover transition"
                          >
                            Decline
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Footer */}
      {(total > 0 || overflowCount > 0) && (
        <div className="notifications-panel__footer shrink-0 border-t border-border-glass bg-bg px-4 py-2.5">
          <p className="text-center text-[11px] text-text-muted">
            {overflowCount > 0
              ? `+${overflowCount} more unread not shown`
              : `${visibleNotifications.length} shown${total > visibleNotifications.length ? ` of ${total}` : ""}`}
          </p>
        </div>
      )}
    </div>
  );
}
