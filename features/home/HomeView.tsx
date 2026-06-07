"use client";

import React, { useMemo } from "react";
import {
  Bell,
  Check,
  ListChecks,
  MessageCircle,
  Zap,
} from "lucide-react";
import { getListColorStyle } from "@/store/listSlice";
import type { Notification } from "@/types";
import { formatRoleLabel } from "@/lib/roles";
import { cn, triggerHaptic } from "@/lib/utils";
import { buildAttentionItems, type HomeFocusItem } from "./lib/buildAttentionItems";
import { isHomeAllCaughtUp } from "./lib/isHomeAllCaughtUp";
import { sortUpcomingFocusItems } from "./lib/buildUpcomingFocus";
import { HomeDueTaskRow } from "./components/HomeDueTaskRow";
import { WorkspaceOpenTasksGraphic } from "./components/WorkspaceOpenTasksGraphic";
import "@/features/lists/lists-workspace.css";
import "./home-workspace.css";

export interface HomeListPreview {
  id: string;
  title: string;
  color: string;
  workspaceId: string;
  workspaceName: string;
  openCount: number;
  totalCount: number;
  preview: string[];
  pinned?: boolean;
}

export interface WorkspacePulse {
  id: string;
  name: string;
  role?: string;
  openTasks: number;
  dueToday: number;
  overdue: number;
  unreadNotifications: number;
  unreadChat?: boolean;
  isCurrent: boolean;
  onlineCount?: number;
  assigneeBreakdown?: Array<{ label: string; count: number }>;
  assignedToYou?: number;
  listCount?: number;
  openListItemsCount?: number;
  memberCount?: number;
}

interface HomeViewProps {
  userDisplayName: string;
  workspaces: Array<{ id: string; name: string; role?: string }>;
  switchWorkspace: (workspaceId: string) => void;
  setView: (view: "tasks" | "notes" | "lists" | "teams") => void;
  listPreviews?: HomeListPreview[];
  onOpenList?: (listId: string, workspaceId: string) => void;
  globalTodayFocus?: HomeFocusItem[];
  /** Overdue + today + tomorrow tasks across workspaces — Home due-date list. */
  globalOpenTaskFocus?: HomeFocusItem[];
  notifications?: Notification[];
  workspacePulse?: WorkspacePulse[];
  taskLoadingStates?: Record<string, boolean>;
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
  globalOpenTaskFocus = [],
  notifications = [],
  workspacePulse = [],
  taskLoadingStates = {},
  listPreviews = [],
  onOpenList,
  onCompleteFocusTask,
  onOpenFocusTask,
  onAcceptInvite,
  onDeclineInvite,
  onOpenNotification,
}: HomeViewProps) {
  const pulseById = new Map(workspacePulse.map((p) => [p.id, p]));
  const upcomingFocus = useMemo(
    () =>
      sortUpcomingFocusItems(
        globalTodayFocus.filter((f) => f.task.status !== "done"),
      ),
    [globalTodayFocus],
  );

  const dueAttentionFocus = useMemo(
    () => globalOpenTaskFocus.filter((f) => f.task.status !== "done"),
    [globalOpenTaskFocus],
  );

  const dueTotal = upcomingFocus.length;
  const overdueTotal = workspacePulse.reduce((sum, p) => sum + (p.overdue ?? 0), 0);
  const openTasksTotal = workspacePulse.reduce((sum, p) => sum + (p.openTasks ?? 0), 0);
  const unreadCount = notifications.filter((n) => !n.readAt).length;
  const pendingInvites = notifications.filter((n) => n.type === "invite" && !n.readAt).length;

  const attentionItems = useMemo(
    () => buildAttentionItems(globalTodayFocus, notifications),
    [globalTodayFocus, notifications]
  );

  const checklistItemsTotal = workspacePulse.reduce(
    (sum, p) => sum + (p.openListItemsCount ?? 0),
    0,
  );

  const summaryParts: string[] = [];
  if (openTasksTotal > 0) summaryParts.push(`${openTasksTotal} open`);
  if (dueTotal > 0) {
    summaryParts.push(`${dueTotal} due today or tomorrow`);
  }
  if (overdueTotal > 0) summaryParts.push(`${overdueTotal} overdue`);
  if (pendingInvites > 0) summaryParts.push(`${pendingInvites} invite${pendingInvites === 1 ? "" : "s"}`);
  if (checklistItemsTotal > 0) {
    summaryParts.push(
      `${checklistItemsTotal} checklist item${checklistItemsTotal === 1 ? "" : "s"}`,
    );
  }
  if (unreadCount > 0 && pendingInvites === 0) summaryParts.push(`${unreadCount} unread`);
  if (workspaces.length > 0) summaryParts.push(`${workspaces.length} workspace${workspaces.length === 1 ? "" : "s"}`);

  const summary =
    summaryParts.length > 0
      ? summaryParts.join(" · ")
      : "You're clear across workspaces.";

  const listsOpenTotal = listPreviews.reduce((sum, l) => sum + l.openCount, 0);

  const showAllCaughtUp = isHomeAllCaughtUp({
    attentionItemCount: attentionItems.length,
    upcomingFocusCount: upcomingFocus.length,
    openTasksTotal,
    overdueTotal,
    openChecklistItemsTotal: checklistItemsTotal,
  });

  return (
    <div className="max-w-5xl mx-auto pt-2 md:pt-4">
      <div className="mb-8">
        <div className="text-3xl md:text-4xl font-semibold tracking-tight">
          {getGreeting()}
          {userDisplayName ? `, ${userDisplayName}` : ""}
        </div>
        <p className="text-[#a1a1aa] mt-2 text-sm max-w-2xl">{summary}</p>
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

      {showAllCaughtUp && (
        <div className="mb-8 glass rounded-2xl px-6 py-4 border border-white/10 text-center">
          <div className="text-lg font-medium text-[#f4f4f5]">You&apos;re all caught up</div>
        </div>
      )}

      <div className="mb-8">
        <div className="text-sm text-[#71717a] mb-3 font-medium">Workspaces</div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {workspaces.map((ws) => {
            const pulse = pulseById.get(ws.id);
            const openTasks = pulse?.openTasks ?? 0;
            const due = pulse?.dueToday ?? 0;
            const overdue = pulse?.overdue ?? 0;
            const unread = pulse?.unreadNotifications ?? 0;
            const unreadChat = pulse?.unreadChat ?? false;
            const online = pulse?.onlineCount;
            const isCurrent = pulse?.isCurrent ?? false;
            const breakdown = pulse?.assigneeBreakdown ?? [];
            const assignedToYou = pulse?.assignedToYou ?? 0;
            const openListItems = pulse?.openListItemsCount ?? 0;
            const listCount = pulse?.listCount ?? 0;
            const memberCount = pulse?.memberCount;

            const activateWorkspace = () => {
              triggerHaptic("light");
              switchWorkspace(ws.id);
            };

            return (
              <div
                key={ws.id}
                tabIndex={0}
                onClick={activateWorkspace}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    activateWorkspace();
                  }
                }}
                aria-label={`Activate ${ws.name} workspace`}
                className={cn(
                  "glass rounded-2xl p-4 border transition relative cursor-pointer text-left",
                  "hover:border-[#c084fc]/35 hover:bg-white/[0.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c084fc]/50",
                  isCurrent
                    ? "border-[#c084fc]/40 ring-1 ring-[#c084fc]/20"
                    : "border-white/10",
                )}
              >
                <div className="flex items-start gap-3">
                    <WorkspaceOpenTasksGraphic
                      openTasks={openTasks}
                      overdue={overdue}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold flex items-start justify-between gap-2">
                        <span className="break-words min-w-0 flex-1 leading-snug pr-1">{ws.name}</span>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          {(unread > 0 || unreadChat) && (
                            <div className="flex items-center gap-1">
                              {unread > 0 && (
                                <span
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#c084fc] text-black text-[10px] font-bold shadow-[0_0_12px_rgba(192,132,252,0.35)]"
                                  title={`${unread} unread notification${unread === 1 ? "" : "s"} in this workspace`}
                                  aria-label={`${unread} unread notifications`}
                                >
                                  <Bell className="h-3 w-3" aria-hidden />
                                  {unread > 99 ? "99+" : unread}
                                </span>
                              )}
                              {unreadChat && (
                                <span
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#ff3366] text-white text-[10px] font-bold shadow-[0_0_12px_rgba(255,51,102,0.35)]"
                                  title="Unread team messages in this workspace"
                                  aria-label="Unread team messages"
                                >
                                  <MessageCircle className="h-3 w-3" aria-hidden />
                                  Chat
                                </span>
                              )}
                            </div>
                          )}
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-[#a1a1aa] font-mono">
                            {formatRoleLabel(ws.role)}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-[#71717a] mt-2">
                        {typeof memberCount === "number" && (
                          <span>
                            {memberCount} teammate{memberCount === 1 ? "" : "s"}
                          </span>
                        )}
                        {assignedToYou > 0 && (
                          <span className="text-[#c084fc]">{assignedToYou} due for you</span>
                        )}
                        {due > 0 && (
                          <span className={overdue > 0 ? "text-[#ff3366]" : ""}>{due} due</span>
                        )}
                        {overdue > 0 && <span className="text-[#ff3366]">{overdue} overdue</span>}
                        {typeof online === "number" && online > 0 && (
                          <span className="text-[#34d399]">{online} online</span>
                        )}
                        {openListItems > 0 && (
                          <span>
                            {openListItems} checklist item{openListItems === 1 ? "" : "s"}
                          </span>
                        )}
                        {listCount > 0 && openListItems === 0 && (
                          <span>{listCount} list{listCount === 1 ? "" : "s"}</span>
                        )}
                        {unreadChat && (
                          <span className="text-[#ff3366]">Unread messages</span>
                        )}
                        {openTasks === 0 &&
                          assignedToYou === 0 &&
                          due === 0 &&
                          overdue === 0 &&
                          unread === 0 &&
                          !unreadChat &&
                          openListItems === 0 &&
                          listCount === 0 &&
                          (!online || online === 0) && <span>All clear</span>}
                      </div>
                    </div>
                  </div>
                  {breakdown.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {breakdown.slice(0, 3).map((item) => (
                        <span
                          key={item.label}
                          className="text-[10px] px-1.5 py-0.5 rounded-md border border-white/10 bg-white/[0.03] text-[#a1a1aa]"
                          title={`${item.label}: ${item.count} open task${item.count === 1 ? "" : "s"}`}
                        >
                          {item.label}: {item.count}
                        </span>
                      ))}
                    </div>
                  )}
                  {isCurrent && (
                    <div className="text-[10px] text-[#c084fc] mt-2 font-medium">Current workspace</div>
                  )}
                <div className="flex gap-2 mt-3 pt-3 border-t border-white/5">
                  {(
                    [
                      { label: "Tasks", view: "tasks" as const },
                      { label: "Notes", view: "notes" as const },
                      { label: "Lists", view: "lists" as const },
                      { label: "Team", view: "teams" as const },
                    ] as const
                  ).map((shortcut) => (
                    <button
                      key={shortcut.label}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        triggerHaptic("light");
                        switchWorkspace(ws.id);
                        setView(shortcut.view);
                      }}
                      className="text-[10px] text-[#a1a1aa] hover:text-[#c084fc] transition"
                    >
                      {shortcut.label}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {dueAttentionFocus.length > 0 && (
        <div className="mb-8">
          <div className="mb-3">
            <div className="text-sm text-[#e5e5e7] font-medium">Overdue &amp; upcoming</div>
            <div className="text-[10px] text-[#71717a] mt-0.5">
              Past due, today &amp; tomorrow · by priority
            </div>
          </div>
          <div className="space-y-2">
            {dueAttentionFocus.slice(0, 8).map((item) => (
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

      {listPreviews.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <ListChecks className="h-4 w-4 text-[#c084fc]" />
            <div className="text-sm text-[#e5e5e7] font-medium">Open across workspaces</div>
            <span className="text-[10px] text-[#71717a]">
              {listsOpenTotal} left
            </span>
          </div>
          <div className="lists-home-preview">
            {listPreviews.slice(0, 6).map((list) => {
              const colorStyle = getListColorStyle(list.color);
              const doneCount = list.totalCount - list.openCount;
              const progress = list.totalCount > 0 ? (doneCount / list.totalCount) * 100 : 0;
              return (
                <button
                  key={`${list.workspaceId}-${list.id}`}
                  type="button"
                  onClick={() => onOpenList?.(list.id, list.workspaceId)}
                  className="list-home-chip"
                  style={{
                    background: colorStyle.bg,
                    borderColor: colorStyle.border,
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <span className="font-medium text-sm text-[#f4f4f5] truncate block">{list.title}</span>
                      <span className="text-[10px] text-[#71717a] truncate block mt-0.5">
                        {list.workspaceName}
                      </span>
                    </div>
                    {list.pinned && (
                      <span className="text-[9px] uppercase tracking-wider text-[#c084fc] shrink-0">Pinned</span>
                    )}
                  </div>
                  {list.totalCount > 0 && (
                    <>
                      <div className="mt-2 h-1 rounded-full bg-white/10 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[#c084fc]/80 transition-all"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <div className="text-[10px] text-[#71717a] mt-1.5">
                        {list.openCount === 0 ? "All done" : `${list.openCount} left`}
                        {list.preview.length > 0 && list.openCount > 0 && (
                          <span className="text-[#a1a1aa]"> · {list.preview[0]}</span>
                        )}
                      </div>
                    </>
                  )}
                  {list.totalCount === 0 && (
                    <div className="text-[10px] text-[#52525b] mt-1">Empty — tap to add items</div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}