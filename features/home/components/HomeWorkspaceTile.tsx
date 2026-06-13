"use client";

import React, { useMemo } from "react";
import { Lock, MessageCircle } from "lucide-react";
import type { Notification } from "@/types";
import { HomeWorkspaceNotificationDropdown } from "./HomeWorkspaceNotificationDropdown";
import { formatRoleLabel } from "@/lib/roles";
import { cn, triggerHaptic } from "@/lib/utils";
import type { Task, WorkspaceMember } from "@/types";
import type { HomeFocusItem } from "../lib/buildAttentionItems";
import { buildWorkspaceDueTasks } from "../lib/buildWorkspaceDueTasks";
import { groupWorkspaceDueTasks } from "../lib/groupWorkspaceDueTasks";
import type { WorkspacePulse } from "../HomeView";
import { HomeWorkspaceTileHeader } from "./HomeWorkspaceTileHeader";
import { HomeWorkspaceTaskPanel } from "./HomeWorkspaceTaskPanel";

interface HomeWorkspaceTileProps {
  workspace: { id: string; name: string; role?: string };
  pulse?: WorkspacePulse;
  storeTasks: Task[];
  globalOpenTaskFocus: HomeFocusItem[];
  globalTodayFocus: HomeFocusItem[];
  taskLoadingStates?: Record<string, boolean>;
  onActivate: (workspaceId: string) => void;
  onCompleteTask: (item: HomeFocusItem) => void | Promise<void>;
  onOpenTask: (item: HomeFocusItem) => void | Promise<void>;
  onNavigateDue?: (workspaceId: string) => void;
  onNavigateLists?: (workspaceId: string) => void;
  onNavigateReview?: (workspaceId: string) => void;
  members?: WorkspaceMember[];
  currentUserId?: string;
  showAssigneeSections?: boolean;
  notifications?: Notification[];
  notificationPanelOpen?: boolean;
  onNotificationPanelOpenChange?: (open: boolean) => void;
  onOpenNotification?: (notification: Notification) => void;
}

export function HomeWorkspaceTile({
  workspace,
  pulse,
  storeTasks,
  globalOpenTaskFocus,
  globalTodayFocus,
  taskLoadingStates,
  onActivate,
  onCompleteTask,
  onOpenTask,
  onNavigateDue,
  onNavigateLists,
  onNavigateReview,
  members = [],
  currentUserId,
  showAssigneeSections = false,
  notifications = [],
  notificationPanelOpen = false,
  onNotificationPanelOpenChange,
  onOpenNotification,
}: HomeWorkspaceTileProps) {
  const openTasks = pulse?.openTasks ?? 0;
  const dueToday = pulse?.dueToday ?? 0;
  const overdue = pulse?.overdue ?? 0;
  const unread = pulse?.unreadNotifications ?? 0;
  const unreadChat = pulse?.unreadChat ?? false;
  const isCurrent = pulse?.isCurrent ?? false;
  const listCount = pulse?.listCount ?? 0;
  const pendingReview = pulse?.pendingReviewCount ?? 0;
  const memberCount = pulse?.memberCount;
  const isPrivateWorkspace = typeof memberCount === "number" && memberCount === 1;

  const dueTasks = useMemo(
    () =>
      buildWorkspaceDueTasks(
        workspace.id,
        workspace.name,
        storeTasks,
        globalOpenTaskFocus,
        globalTodayFocus,
      ),
    [workspace.id, workspace.name, storeTasks, globalOpenTaskFocus, globalTodayFocus],
  );

  const taskGroups = useMemo(() => groupWorkspaceDueTasks(dueTasks), [dueTasks]);
  const workspaceMembers = useMemo(
    () => (isCurrent ? members : []),
    [isCurrent, members],
  );
  const activateWorkspace = () => {
    triggerHaptic("light");
    onActivate(workspace.id);
  };

  return (
    <div
      className={cn(
        "home-ws-card glass rounded-2xl px-2.5 py-2 md:p-5 border border-border-glass transition relative text-left cursor-pointer",
        "flex flex-col items-stretch h-full",
        "focus-within:outline-none focus-within:ring-2 focus-within:ring-neon-purple/40",
        isCurrent && "home-ws-card--current",
        notificationPanelOpen && "home-ws-card--notif-open",
      )}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("[data-no-activate]")) return;
        activateWorkspace();
      }}
      onKeyDown={(e) => {
        if ((e.target as HTMLElement).closest("[data-no-activate]")) return;
        if (e.key === "Enter" || e.key === " ") {
          if ((e.target as HTMLElement).closest("button")) return;
          e.preventDefault();
          activateWorkspace();
        }
      }}
      aria-label={
        isCurrent
          ? `${workspace.name} — current workspace`
          : `Activate ${workspace.name} workspace`
      }
      aria-current={isCurrent ? "true" : undefined}
    >
      <div className="absolute top-2 right-2 md:top-3 md:right-3 flex items-center gap-1 z-10">
        {isPrivateWorkspace && (
          <span
            className="inline-flex items-center justify-center shrink-0 h-5 w-5 rounded border border-border-glass bg-surface-overlay text-text-secondary"
            title="Private workspace"
            aria-label="Private workspace"
          >
            <Lock className="h-2.5 w-2.5" aria-hidden />
          </span>
        )}
        {onOpenNotification && onNotificationPanelOpenChange ? (
          <HomeWorkspaceNotificationDropdown
            workspaceId={workspace.id}
            workspaceName={workspace.name}
            notifications={notifications}
            unreadCount={unread}
            open={notificationPanelOpen}
            onOpenChange={onNotificationPanelOpenChange}
            onOpenNotification={onOpenNotification}
          />
        ) : null}
        {unreadChat && (
          <span
            className="inline-flex items-center gap-0.5 px-1.5 py-px rounded-full bg-[var(--priority-p0)] text-accent-on text-[9px] font-bold"
            title="Unread team messages in this workspace"
            aria-label="Unread team messages"
          >
            <MessageCircle className="h-2.5 w-2.5" aria-hidden />
          </span>
        )}
        {!isPrivateWorkspace && workspace.role && (
          <span className="text-[8px] uppercase tracking-wider px-1.5 py-px rounded bg-surface-hover text-text-muted font-semibold">
            {formatRoleLabel(workspace.role)}
          </span>
        )}
      </div>

      <HomeWorkspaceTileHeader
        name={workspace.name}
        openTasks={openTasks}
        overdue={overdue}
        dueToday={dueToday}
        listCount={listCount}
        pendingReviewCount={pendingReview}
        onTasksClick={onNavigateDue ? () => onNavigateDue(workspace.id) : undefined}
        onListsClick={onNavigateLists ? () => onNavigateLists(workspace.id) : undefined}
        onReviewClick={onNavigateReview ? () => onNavigateReview(workspace.id) : undefined}
      />

      <div className="home-ws-card__tasks-zone flex-1 flex flex-col min-h-0">
        <HomeWorkspaceTaskPanel
          groups={taskGroups}
          taskLoadingStates={taskLoadingStates}
          onCompleteTask={onCompleteTask}
          onOpenTask={onOpenTask}
          useAssigneeSections={showAssigneeSections && !isPrivateWorkspace}
          members={workspaceMembers}
          currentUserId={currentUserId}
        />
      </div>
    </div>
  );
}