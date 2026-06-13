"use client";

import React, { useState } from "react";
import type { Notification, Task, WorkspaceMember } from "@/types";
import type { HomeFocusItem } from "./lib/buildAttentionItems";
import { HomeWorkspaceTile } from "./components/HomeWorkspaceTile";
import { useEqualHomeTileHeights } from "./hooks/useEqualHomeTileHeights";
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

interface HomeViewProps {
  userDisplayName: string;
  workspaces: Array<{ id: string; name: string; role?: string }>;
  switchWorkspace: (workspaceId: string) => void;
  tasks?: Task[];
  listPreviews?: HomeListPreview[];
  onOpenList?: (listId: string, workspaceId: string) => void;
  globalTodayFocus?: HomeFocusItem[];
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
  onNavigateDue?: (workspaceId: string) => void;
  onNavigateLists?: (workspaceId: string) => void;
  onNavigateReview?: (workspaceId: string) => void;
  showTaskAssignee?: boolean;
  members?: WorkspaceMember[];
  currentUserId?: string;
}

export function HomeView({
  workspaces,
  switchWorkspace,
  tasks = [],
  workspacePulse = [],
  globalTodayFocus = [],
  globalOpenTaskFocus = [],
  taskLoadingStates,
  onCompleteFocusTask,
  onOpenFocusTask,
  onNavigateDue,
  onNavigateLists,
  onNavigateReview,
  showTaskAssignee = false,
  members = [],
  currentUserId,
  notifications = [],
  onOpenNotification,
}: HomeViewProps) {
  const [openNotificationWorkspaceId, setOpenNotificationWorkspaceId] = useState<string | null>(
    null,
  );
  const pulseById = new Map(workspacePulse.map((p) => [p.id, p]));

  const { gridRef, tileMinHeight } = useEqualHomeTileHeights([
    workspaces,
    workspacePulse,
    tasks,
    globalTodayFocus,
    globalOpenTaskFocus,
    taskLoadingStates,
  ]);

  return (
    <div className="home-root min-h-0">
      <div className="home-workspace max-w-5xl mx-auto px-0 md:px-0">
        <section className="home-workspaces-section" aria-label="Workspaces">
          <div className="home-workspaces-section__scroll">
            <div
              ref={gridRef}
              className="home-workspaces-grid grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6"
            >
              {workspaces.map((ws) => (
                <HomeWorkspaceTile
                  key={ws.id}
                  workspace={ws}
                  pulse={pulseById.get(ws.id)}
                  storeTasks={tasks}
                  globalOpenTaskFocus={globalOpenTaskFocus}
                  globalTodayFocus={globalTodayFocus}
                  taskLoadingStates={taskLoadingStates}
                  tileMinHeight={tileMinHeight}
                  onActivate={switchWorkspace}
                  onCompleteTask={onCompleteFocusTask}
                  onOpenTask={onOpenFocusTask}
                  onNavigateDue={onNavigateDue}
                  onNavigateLists={onNavigateLists}
                  onNavigateReview={onNavigateReview}
                  showAssigneeSections={showTaskAssignee}
                  members={members}
                  currentUserId={currentUserId}
                  notifications={notifications}
                  notificationPanelOpen={openNotificationWorkspaceId === ws.id}
                  onNotificationPanelOpenChange={(open) =>
                    setOpenNotificationWorkspaceId(open ? ws.id : null)
                  }
                  onOpenNotification={onOpenNotification}
                />
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}