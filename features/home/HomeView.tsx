"use client";

import React, { useMemo } from "react";
import {
  ArrowUpRight,
  Bell,
  Check,
  Command,
  MessageCircle,
  Plus,
  Star,
  Zap,
} from "lucide-react";
import { isPast, isToday } from "date-fns";
import type { Notification } from "@/types";
import { formatRoleLabel } from "@/lib/roles";
import { buildAttentionItems, type HomeFocusItem } from "./lib/buildAttentionItems";
import { HomeDueTaskRow } from "./components/HomeDueTaskRow";

export interface WorkspacePulse {
  id: string;
  name: string;
  role?: string;
  dueToday: number;
  overdue: number;
  unreadNotifications: number;
  isCurrent: boolean;
  onlineCount?: number;
}

interface HomeViewProps {
  userDisplayName: string;
  workspaces: Array<{ id: string; name: string; role?: string }>;
  switchWorkspace: (workspaceId: string) => void;
  setView: (view: "today" | "tasks" | "notes" | "teams") => void;
  globalTodayFocus?: HomeFocusItem[];
  notifications?: Notification[];
  workspacePulse?: WorkspacePulse[];
  taskLoadingStates?: Record<string, boolean>;
  onQuickAddTask: () => void;
  onQuickAddNote: () => void;
  onOpenChat: () => void;
  onOpenCommandPalette: () => void;
  onCompleteFocusTask: (item: HomeFocusItem) => void | Promise<void>;
  onOpenFocusTask: (item: HomeFocusItem) => void | Promise<void>;
  onAcceptInvite: (inviteId: string) => void | Promise<void>;
  onDeclineInvite: (inviteId: string) => void | Promise<void>;
  onOpenNotification: (notification: Notification) => void;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function HomeView({
  userDisplayName,
  workspaces,
  switchWorkspace,
  setView,
  globalTodayFocus = [],
  notifications = [],
  workspacePulse = [],
  taskLoadingStates = {},
  onQuickAddTask,
  onQuickAddNote,
  onOpenChat,
  onOpenCommandPalette,
  onCompleteFocusTask,
  onOpenFocusTask,
  onAcceptInvite,
  onDeclineInvite,
  onOpenNotification,
}: HomeViewProps) {
  const pulseById = new Map(workspacePulse.map((p) => [p.id, p]));
  const dueTotal = globalTodayFocus.length;
  const overdueTotal = globalTodayFocus.filter(
    (f) => f.task.dueDate && isPast(new Date(f.task.dueDate)) && !isToday(new Date(f.task.dueDate))
  ).length;
  const unreadCount = notifications.filter((n) => !n.readAt).length;
  const pendingInvites = notifications.filter((n) => n.type === "invite" && !n.readAt).length;

  const attentionItems = useMemo(
    () => buildAttentionItems(globalTodayFocus, notifications),
    [globalTodayFocus, notifications]
  );

  const summaryParts: string[] = [];
  if (dueTotal > 0) summaryParts.push(`${dueTotal} due`);
  if (overdueTotal > 0) summaryParts.push(`${overdueTotal} overdue`);
  if (pendingInvites > 0) summaryParts.push(`${pendingInvites} invite${pendingInvites === 1 ? "" : "s"}`);
  if (unreadCount > 0 && pendingInvites === 0) summaryParts.push(`${unreadCount} unread`);
  if (workspaces.length > 0) summaryParts.push(`${workspaces.length} workspace${workspaces.length === 1 ? "" : "s"}`);

  const summary =
    summaryParts.length > 0
      ? summaryParts.join(" · ")
      : "You're clear across workspaces.";

  const quickActions = [
    { label: "Add task", icon: Plus, onClick: onQuickAddTask },
    { label: "New note", icon: Star, onClick: onQuickAddNote },
    { label: "Team chat", icon: MessageCircle, onClick: onOpenChat },
    { label: "Command", icon: Command, onClick: onOpenCommandPalette },
  ];

  return (
    <div className="max-w-5xl mx-auto pt-2 md:pt-4">
      <div className="mb-8">
        <div className="text-3xl md:text-4xl font-semibold tracking-tight">
          {getGreeting()}
          {userDisplayName ? `, ${userDisplayName}` : ""}
        </div>
        <p className="text-[#a1a1aa] mt-2 text-sm max-w-2xl">{summary}</p>
      </div>

      <div className="flex flex-wrap gap-2 mb-8">
        {quickActions.map((action) => (
          <button
            key={action.label}
            type="button"
            onClick={action.onClick}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2 text-xs font-medium text-[#e5e5e7] hover:border-[#c084fc]/40 hover:bg-[#c084fc]/10 transition"
          >
            <action.icon className="h-3.5 w-3.5 text-[#c084fc]" />
            {action.label}
          </button>
        ))}
      </div>

      {attentionItems.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="h-4 w-4 text-[#c084fc]" />
            <div className="text-sm text-[#e5e5e7] font-medium">Needs attention</div>
            <span className="text-[10px] text-[#71717a]">invites &amp; notifications</span>
          </div>
          <div className="space-y-2">
            {attentionItems.map((item) => (
              <div
                key={item.id}
                className={`glass rounded-xl px-4 py-3 border transition ${
                  item.urgency === "high"
                    ? "border-[#ff3366]/30 bg-[#ff3366]/[0.04]"
                    : "border-white/10"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={() => {
                      if (item.kind === "task") onOpenFocusTask(item.focusItem);
                      else if (item.kind === "notification") {
                        const notif = notifications.find((n) => n.id === item.notificationId);
                        if (notif) onOpenNotification(notif);
                      }
                    }}
                  >
                    <div className="font-medium text-sm truncate">{item.title}</div>
                    <div className="text-[11px] text-[#71717a] mt-0.5 truncate">{item.subtitle}</div>
                  </button>

                  {item.kind === "invite" && (
                    <div className="flex gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => onAcceptInvite(item.inviteId)}
                        className="px-2.5 py-1 text-[10px] rounded-lg bg-[#c084fc] text-black font-medium"
                      >
                        Accept
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeclineInvite(item.inviteId)}
                        className="px-2.5 py-1 text-[10px] rounded-lg border border-white/15 text-[#a1a1aa]"
                      >
                        Decline
                      </button>
                    </div>
                  )}

                  {item.kind === "task" && (
                    <button
                      type="button"
                      onClick={() => onCompleteFocusTask(item.focusItem)}
                      className="shrink-0 h-7 w-7 rounded-full border border-white/15 flex items-center justify-center text-[#71717a] hover:text-[#c084fc] hover:border-[#c084fc]/40 transition"
                      aria-label="Complete task"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                  )}

                  {item.kind === "notification" && (
                    <Bell className="h-4 w-4 text-[#71717a] shrink-0 mt-0.5" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {attentionItems.length === 0 && globalTodayFocus.length === 0 && (
        <div className="mb-8 glass rounded-2xl p-6 border border-white/10 text-center">
          <div className="text-lg font-medium text-[#f4f4f5]">You&apos;re all caught up</div>
          <p className="text-sm text-[#71717a] mt-1 mb-4">No due tasks, invites, or notifications right now.</p>
          <div className="flex flex-wrap justify-center gap-2">
            <button type="button" onClick={onQuickAddTask} className="btn btn-primary text-xs px-4 py-2">
              Add a task
            </button>
            <button type="button" onClick={() => setView("today")} className="btn btn-secondary text-xs px-4 py-2">
              View today
            </button>
          </div>
        </div>
      )}

      <div className="mb-8">
        <div className="text-sm text-[#71717a] mb-3 font-medium">Workspaces</div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {workspaces.map((ws) => {
            const pulse = pulseById.get(ws.id);
            const due = pulse?.dueToday ?? 0;
            const overdue = pulse?.overdue ?? 0;
            const unread = pulse?.unreadNotifications ?? 0;
            const online = pulse?.onlineCount;
            const isCurrent = pulse?.isCurrent ?? false;

            return (
              <div
                key={ws.id}
                className={`glass rounded-2xl p-4 border transition ${
                  isCurrent
                    ? "border-[#c084fc]/40 ring-1 ring-[#c084fc]/20"
                    : "border-white/10 hover:border-[#c084fc]/30"
                }`}
              >
                <button
                  type="button"
                  onClick={() => switchWorkspace(ws.id)}
                  className="w-full text-left"
                >
                  <div className="font-semibold flex items-center justify-between gap-2">
                    <span className="truncate">{ws.name}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-[#a1a1aa] font-mono shrink-0">
                      {formatRoleLabel(ws.role)}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-[#71717a] mt-2">
                    {due > 0 && <span className={overdue > 0 ? "text-[#ff3366]" : ""}>{due} due</span>}
                    {overdue > 0 && <span className="text-[#ff3366]">{overdue} overdue</span>}
                    {unread > 0 && <span>{unread} unread</span>}
                    {typeof online === "number" && online > 0 && (
                      <span className="text-[#34d399]">{online} online</span>
                    )}
                    {due === 0 && overdue === 0 && unread === 0 && (!online || online === 0) && (
                      <span>All clear</span>
                    )}
                  </div>
                  {isCurrent && (
                    <div className="text-[10px] text-[#c084fc] mt-2 font-medium">Current workspace</div>
                  )}
                </button>
                <div className="flex gap-2 mt-3 pt-3 border-t border-white/5">
                  <button
                    type="button"
                    onClick={() => {
                      switchWorkspace(ws.id);
                      setView("today");
                    }}
                    className="text-[10px] text-[#a1a1aa] hover:text-[#c084fc]"
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      switchWorkspace(ws.id);
                      setView("tasks");
                    }}
                    className="text-[10px] text-[#a1a1aa] hover:text-[#c084fc]"
                  >
                    Tasks
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      switchWorkspace(ws.id);
                      setView("teams");
                    }}
                    className="text-[10px] text-[#a1a1aa] hover:text-[#c084fc]"
                  >
                    Team
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {globalTodayFocus.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm text-[#71717a] font-medium">Due now</div>
            <button
              type="button"
              onClick={() => setView("today")}
              className="text-xs text-[#c084fc] flex items-center gap-1 hover:underline"
            >
              Today view <ArrowUpRight className="h-3 w-3" />
            </button>
          </div>
          <div className="space-y-2">
            {globalTodayFocus.slice(0, 8).map((item) => (
              <HomeDueTaskRow
                key={`${item.workspaceId}-${item.task.id}`}
                task={item.task}
                workspaceName={item.workspaceName}
                isOpLoading={!!taskLoadingStates[item.task.id]}
                onOpen={() => onOpenFocusTask(item)}
                onComplete={() => onCompleteFocusTask(item)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}