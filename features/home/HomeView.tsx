"use client";

import React, { useMemo } from "react";
import {
  Bell,
  Check,
  Inbox,
  ListChecks,
  Lock,
  MessageCircle,
  Zap,
} from "lucide-react";
import { getListColorStyleForTheme } from "@/lib/lists/listColorStyles";
import { useTaskStore } from "@/store/useTaskStore";
import type { Notification } from "@/types";
import { formatRoleLabel } from "@/lib/roles";
import { cn, triggerHaptic } from "@/lib/utils";
import { buildAttentionItems, type HomeFocusItem } from "./lib/buildAttentionItems";
import { isHomeAllCaughtUp } from "./lib/isHomeAllCaughtUp";
import { sortUpcomingFocusItems } from "./lib/buildUpcomingFocus";
import { TasksTable } from "@/features/tasks/components/TasksTable";
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
  noteCount?: number;
  pendingReviewCount?: number;
  taskCount?: number;
  memberCount?: number;
}

function formatInventoryCount(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

interface HomeViewProps {
  userDisplayName: string;
  workspaces: Array<{ id: string; name: string; role?: string }>;
  switchWorkspace: (workspaceId: string) => void;
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
  pendingReviewTotal?: number;
  onOpenWorkspaceReview?: (workspaceId: string) => void;
  /** Match Tasks page: show assignee column when any relevant workspace is shared. */
  showTaskAssignee?: boolean;
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
  pendingReviewTotal = 0,
  onOpenWorkspaceReview,
  showTaskAssignee = false,
}: HomeViewProps) {
  const theme = useTaskStore((s) => s.theme);
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

  const dueAttentionTasks = useMemo(
    () => dueAttentionFocus.slice(0, 8).map((item) => item.task),
    [dueAttentionFocus],
  );

  const dueTaskWorkspaceNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of dueAttentionFocus) {
      map.set(item.task.id, item.workspaceName);
    }
    return map;
  }, [dueAttentionFocus]);

  const focusItemByTaskId = useMemo(() => {
    const map = new Map<string, HomeFocusItem>();
    for (const item of dueAttentionFocus) {
      map.set(item.task.id, item);
    }
    return map;
  }, [dueAttentionFocus]);

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
      `${checklistItemsTotal} list item${checklistItemsTotal === 1 ? "" : "s"}`,
    );
  }
  if (pendingReviewTotal > 0) {
    summaryParts.push(
      `${pendingReviewTotal} in Review`,
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
    <div className="home-root min-h-0">
      <div className="home-workspace max-w-5xl mx-auto pt-2 md:pt-6 px-0 md:px-1">
      <div className="mb-8">
        <div className="text-3xl md:text-4xl font-semibold tracking-tight">
          {getGreeting()}
          {userDisplayName ? `, ${userDisplayName}` : ""}
        </div>
        <p className="text-text-secondary mt-2 text-sm max-w-2xl">{summary}</p>
      </div>

      {attentionItems.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="h-4 w-4 text-neon-purple" />
            <div className="text-sm text-text-primary font-medium">Needs attention</div>
            <span className="text-[10px] text-text-muted">invites &amp; notifications</span>
          </div>
          <div className="space-y-2">
            {attentionItems.map((item) => (
              <div
                key={item.id}
                className={`glass rounded-xl px-4 py-3 border transition ${
                  item.urgency === "high"
                    ? "border-[var(--priority-p0)]/30 bg-[var(--priority-p0)]/[0.04]"
                    : "border-border-glass"
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
                    <div className="text-[11px] text-text-muted mt-0.5 truncate">{item.subtitle}</div>
                  </button>

                  {item.kind === "invite" && (
                    <div className="flex gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => onAcceptInvite(item.inviteId)}
                        className="px-2.5 py-1 text-[10px] rounded-lg bg-neon-purple text-[var(--on-accent)] font-medium"
                      >
                        Accept
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeclineInvite(item.inviteId)}
                        className="px-2.5 py-1 text-[10px] rounded-lg border border-border-glass text-text-secondary"
                      >
                        Decline
                      </button>
                    </div>
                  )}

                  {item.kind === "task" && (
                    <button
                      type="button"
                      onClick={() => onCompleteFocusTask(item.focusItem)}
                      className="shrink-0 h-7 w-7 rounded-full border border-border-glass flex items-center justify-center text-text-muted hover:text-neon-purple hover:border-neon-purple/40 transition"
                      aria-label="Complete task"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                  )}

                  {item.kind === "notification" && (
                    <Bell className="h-4 w-4 text-text-muted shrink-0 mt-0.5" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showAllCaughtUp && (
        <div className="mb-8 glass rounded-2xl px-6 py-4 border border-border-glass text-center">
          <div className="text-lg font-medium text-text-primary">You&apos;re all caught up</div>
        </div>
      )}

      <div className="home-workspaces-section mb-8">
        <div className="text-sm text-text-muted mb-3.5 font-medium">Workspaces</div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {workspaces.map((ws) => {
            const pulse = pulseById.get(ws.id);
            const openTasks = pulse?.openTasks ?? 0;
            const due = pulse?.dueToday ?? 0;
            const overdue = pulse?.overdue ?? 0;
            const unread = pulse?.unreadNotifications ?? 0;
            const unreadChat = pulse?.unreadChat ?? false;
            const isCurrent = pulse?.isCurrent ?? false;
            const breakdown = pulse?.assigneeBreakdown ?? [];
            const assignedToYou = pulse?.assignedToYou ?? 0;
            const listCount = pulse?.listCount ?? 0;
            const noteCount = pulse?.noteCount ?? 0;
            const pendingReview = pulse?.pendingReviewCount ?? 0;
            const taskCount = pulse?.taskCount ?? openTasks;
            const memberCount = pulse?.memberCount;
            const isPrivateWorkspace = typeof memberCount === "number" && memberCount === 1;
            const inventoryLabel = [
              formatInventoryCount(listCount, "list", "lists"),
              formatInventoryCount(noteCount, "file", "files"),
              formatInventoryCount(taskCount, "task", "tasks"),
            ].join(" · ");

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
                aria-label={
                  isCurrent
                    ? `${ws.name} — current workspace`
                    : `Activate ${ws.name} workspace`
                }
                aria-current={isCurrent ? "true" : undefined}
                className={cn(
                  "home-ws-card glass rounded-2xl p-4 md:p-5 border border-border-glass transition relative cursor-pointer text-left",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-purple/40",
                  isCurrent && "home-ws-card--current",
                )}
              >
                <div className="absolute top-3 right-3 hidden md:flex items-center gap-1 z-10">
                  {unread > 0 && (
                    <span
                      className="inline-flex items-center gap-0.5 px-1.5 py-px rounded-full bg-neon-purple text-[var(--on-accent)] text-[9px] font-bold"
                      title={`${unread} unread notification${unread === 1 ? "" : "s"} in this workspace`}
                      aria-label={`${unread} unread notifications`}
                    >
                      <Bell className="h-2.5 w-2.5" aria-hidden />
                      {unread > 99 ? "99+" : unread}
                    </span>
                  )}
                  {unreadChat && (
                    <span
                      className="inline-flex items-center gap-0.5 px-1.5 py-px rounded-full bg-[var(--priority-p0)] text-accent-on text-[9px] font-bold"
                      title="Unread team messages in this workspace"
                      aria-label="Unread team messages"
                    >
                      <MessageCircle className="h-2.5 w-2.5" aria-hidden />
                    </span>
                  )}
                  {!isPrivateWorkspace && ws.role && (
                    <span className="text-[8px] uppercase tracking-wider px-1.5 py-px rounded bg-surface-hover text-text-muted font-semibold">
                      {formatRoleLabel(ws.role)}
                    </span>
                  )}
                </div>

                <div className="md:hidden flex items-start gap-1.5 mb-2.5 min-w-0">
                  <div className="font-semibold leading-snug break-words min-w-0 flex-1 text-[15px]">
                    {ws.name}
                  </div>
                  <div className="flex items-center gap-1 shrink-0 pt-0.5">
                    {isPrivateWorkspace && (
                      <span
                        className="inline-flex items-center justify-center shrink-0 h-5 w-5 rounded border border-border-glass bg-surface-overlay text-text-secondary"
                        title="Private workspace"
                        aria-label="Private workspace"
                      >
                        <Lock className="h-2.5 w-2.5" aria-hidden />
                      </span>
                    )}
                    {unread > 0 && (
                      <span
                        className="inline-flex items-center gap-0.5 px-1.5 py-px rounded-full bg-neon-purple text-[var(--on-accent)] text-[9px] font-bold"
                        title={`${unread} unread notification${unread === 1 ? "" : "s"} in this workspace`}
                        aria-label={`${unread} unread notifications`}
                      >
                        <Bell className="h-2.5 w-2.5" aria-hidden />
                        {unread > 99 ? "99+" : unread}
                      </span>
                    )}
                    {unreadChat && (
                      <span
                        className="inline-flex items-center gap-0.5 px-1.5 py-px rounded-full bg-[var(--priority-p0)] text-accent-on text-[9px] font-bold"
                        title="Unread team messages in this workspace"
                        aria-label="Unread team messages"
                      >
                        <MessageCircle className="h-2.5 w-2.5" aria-hidden />
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-start gap-3 max-md:pr-0 md:pr-14">
                  <WorkspaceOpenTasksGraphic
                    openTasks={openTasks}
                    overdue={overdue}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="hidden md:block font-semibold leading-snug break-words pr-1">
                      {ws.name}
                    </div>
                    <div className="text-[11px] text-text-muted max-md:mt-0 md:mt-2 tabular-nums leading-snug">
                      {inventoryLabel}
                    </div>
                    {(overdue > 0 || due > 0 || assignedToYou > 0) && (
                      <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] mt-1.5">
                        {assignedToYou > 0 && (
                          <span
                            className={cn(
                              "text-neon-purple",
                              isPrivateWorkspace && "max-md:hidden",
                            )}
                          >
                            {assignedToYou} for you
                          </span>
                        )}
                        {due > 0 && (
                          <span className="text-neon-purple">
                            {due} due
                          </span>
                        )}
                        {overdue > 0 && <span className="text-neon-purple">{overdue} overdue</span>}
                      </div>
                    )}
                  </div>
                </div>

                {breakdown.length > 0 && (
                  <div
                    className={cn(
                      "mt-2 flex flex-wrap gap-1.5 min-w-0",
                      isPrivateWorkspace && "max-md:hidden",
                    )}
                  >
                    {breakdown.slice(0, 3).map((item) => (
                      <span
                        key={item.label}
                        className="text-[10px] px-1.5 py-0.5 rounded-md border border-border-glass bg-surface-overlay text-text-secondary"
                        title={`${item.label}: ${item.count} open task${item.count === 1 ? "" : "s"}`}
                      >
                        {item.label}: {item.count}
                      </span>
                    ))}
                  </div>
                )}
                {pendingReview > 0 && onOpenWorkspaceReview && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      triggerHaptic("light");
                      onOpenWorkspaceReview(ws.id);
                    }}
                    className="home-ws-review-btn mt-3 w-full flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-left transition min-h-[44px]"
                    aria-label={`Review ${pendingReview} file${pendingReview === 1 ? "" : "s"} in ${ws.name}`}
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      <span className="home-ws-review-btn__icon flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border">
                        <Inbox className="h-4 w-4" aria-hidden />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-xs font-semibold text-text-primary leading-tight">
                          Review {pendingReview} file{pendingReview === 1 ? "" : "s"}
                        </span>
                        <span className="block text-[10px] text-text-muted mt-0.5 leading-snug">
                          Tag, approve &amp; file
                        </span>
                      </span>
                    </span>
                    <span className="nav-count-badge shrink-0" aria-hidden>
                      {pendingReview > 99 ? "99+" : pendingReview}
                    </span>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {dueAttentionFocus.length > 0 && (
        <div className="home-due-section mb-8">
          <div className="home-due-section__card glass rounded-2xl border border-border-glass overflow-hidden">
            <div className="home-due-section__header px-4 md:px-5 pt-4 md:pt-5 pb-3 border-b border-border-glass/60">
              <div className="text-sm text-text-primary font-semibold tracking-tight">Overdue &amp; upcoming</div>
              <div className="text-xs text-text-secondary mt-1">
                All workspaces · past due, today &amp; tomorrow · by priority
              </div>
            </div>
            <div className="home-due-tasks tasks-root">
              <TasksTable
              tasks={dueAttentionTasks}
              taskLoadingStates={taskLoadingStates}
              showQuickAdd={false}
              showAssignee={showTaskAssignee}
              rowIdPrefix="home-task-row"
              emptyMessage="No overdue or upcoming tasks."
              getWorkspaceName={(task) => dueTaskWorkspaceNames.get(task.id)}
              onOpenTask={(task) => {
                const item = focusItemByTaskId.get(task.id);
                if (item) void onOpenFocusTask(item);
              }}
              onComplete={(id) => {
                const item = focusItemByTaskId.get(id);
                if (item) void onCompleteFocusTask(item);
              }}
              onSwipeComplete={(id) => {
                const item = focusItemByTaskId.get(id);
                if (item) void onCompleteFocusTask(item);
              }}
            />
            </div>
          </div>
        </div>
      )}

      {listPreviews.length > 0 && (
        <div className="home-lists-section mb-8">
          <div className="flex items-center gap-2 mb-3">
            <ListChecks className="h-4 w-4 text-neon-purple" />
            <div className="text-sm text-text-primary font-medium">Open across workspaces</div>
            <span className="text-[10px] text-text-muted">
              {listsOpenTotal} left
            </span>
          </div>
          <div className="lists-home-preview">
            {listPreviews.slice(0, 6).map((list) => {
              const colorStyle = getListColorStyleForTheme(list.color, theme);
              const doneCount = list.totalCount - list.openCount;
              const progress = list.totalCount > 0 ? (doneCount / list.totalCount) * 100 : 0;
              return (
                <button
                  key={`${list.workspaceId}-${list.id}`}
                  type="button"
                  onClick={() => onOpenList?.(list.id, list.workspaceId)}
                  className="list-home-chip"
                  data-list-color={list.color}
                  style={{
                    background: colorStyle.bg,
                    borderColor: colorStyle.border,
                    ["--list-chip-bg" as string]: colorStyle.bg,
                    ["--list-chip-border" as string]: colorStyle.border,
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <span className="font-medium text-sm text-text-primary truncate block">{list.title}</span>
                      <span className="text-[10px] text-text-muted truncate block mt-0.5">
                        {list.workspaceName}
                      </span>
                    </div>
                    {list.pinned && (
                      <span className="text-[9px] uppercase tracking-wider text-neon-purple shrink-0">Pinned</span>
                    )}
                  </div>
                  {list.totalCount > 0 && (
                    <>
                      <div className="mt-2 h-1 rounded-full bg-surface-hover overflow-hidden">
                        <div
                          className="h-full rounded-full bg-neon-purple/80 transition-all"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <div className="list-home-chip__meta text-[10px] text-text-muted mt-1.5">
                        {list.openCount === 0 ? (
                          <span className="list-home-chip__done">All done</span>
                        ) : (
                          <span className="list-home-chip__count">{list.openCount} left</span>
                        )}
                        {list.preview.length > 0 && list.openCount > 0 && (
                          <span className="text-text-secondary"> · {list.preview[0]}</span>
                        )}
                      </div>
                    </>
                  )}
                  {list.totalCount === 0 && (
                    <div className="text-[10px] text-text-faint mt-1">Empty — tap to add items</div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
      </div>
    </div>
  );
}