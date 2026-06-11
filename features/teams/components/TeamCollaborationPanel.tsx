"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Check,
  ChevronDown,
  Home,
  MessageCircle,
  User,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTaskStore } from "@/store/useTaskStore";
import type { ActivityLog, Task, WorkspaceMember } from "@/types";
import { isSharedWorkspace } from "@/lib/assignee";
import {
  buildAssigneeBreakdown,
  computeTeamWorkspaceStats,
} from "../lib/computeTeamStats";
import { buildTeamActivityFeed } from "../lib/formatTeamActivity";

interface TeamCollaborationPanelProps {
  tasks: Task[];
  members: WorkspaceMember[];
  recentActivity: ActivityLog[];
  currentUserId?: string;
  onlineCount: number;
  onOpenTasks: () => void;
  onOpenHome: () => void;
  onOpenChat: () => void;
}

export function TeamCollaborationPanel({
  tasks,
  members,
  recentActivity,
  currentUserId,
  onlineCount,
  onOpenTasks,
  onOpenHome,
  onOpenChat,
}: TeamCollaborationPanelProps) {
  const [activityExpanded, setActivityExpanded] = useState(false);
  const refreshRecentActivity = useTaskStore((s) => s.refreshRecentActivity);

  useEffect(() => {
    refreshRecentActivity?.().catch(() => {});
  }, [refreshRecentActivity]);

  const stats = useMemo(
    () => computeTeamWorkspaceStats(tasks, currentUserId, onlineCount),
    [tasks, currentUserId, onlineCount]
  );

  const assigneeBreakdown = useMemo(
    () => buildAssigneeBreakdown(tasks, members, currentUserId),
    [tasks, members, currentUserId]
  );

  const activityFeed = useMemo(
    () => buildTeamActivityFeed(recentActivity, members, 10),
    [recentActivity, members]
  );

  const showAssigneeSection =
    isSharedWorkspace(members) && assigneeBreakdown.length > 0;

  const owner = members.find((m) => m.role === "owner");

  return (
    <div className="team-collab-panel space-y-3 md:space-y-4">
      {/* Your slice */}
      <div className="team-collab-your-work glass rounded-2xl border border-neon-purple/20 p-4 md:p-5">
        <div className="flex items-center gap-2 text-sm font-medium text-text-primary mb-2 md:mb-3">
          <User className="h-4 w-4 text-neon-purple shrink-0" />
          <span className="truncate">Your work</span>
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm mb-3 md:mb-4">
          <span>
            <span className="text-xl md:text-2xl font-semibold tabular-nums text-text-primary">
              {stats.assignedToMe}
            </span>
            <span className="text-text-muted ml-1 text-xs md:text-sm">assigned</span>
          </span>
          {stats.myOverdue > 0 && (
            <span className="text-[var(--priority-p0)]">
              <span className="text-xl md:text-2xl font-semibold tabular-nums">{stats.myOverdue}</span>
              <span className="ml-1 text-xs md:text-sm">overdue</span>
            </span>
          )}
        </div>
        <div className="team-collab-actions flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onOpenTasks}
            className="team-collab-action-btn inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium text-text-primary transition"
          >
            <Check className="h-3.5 w-3.5 text-neon-purple" />
            My tasks
          </button>
          <button
            type="button"
            onClick={onOpenHome}
            className="team-collab-action-btn inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium text-text-primary transition"
          >
            <Home className="h-3.5 w-3.5 text-neon-purple" />
            Home
          </button>
          {isSharedWorkspace(members) && (
            <button
              type="button"
              onClick={onOpenChat}
              className="team-collab-action-btn inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium text-text-primary transition"
            >
              <MessageCircle className="h-3.5 w-3.5 text-neon-purple" />
              Team chat
            </button>
          )}
        </div>
      </div>

      {/* Workspace pulse */}
      <div className="team-collab-stats grid grid-cols-4 gap-2 md:gap-3">
        <div className="team-collab-stat glass rounded-xl md:rounded-2xl border border-border-glass p-3 md:p-4">
          <div className="team-collab-stat-label text-[10px] uppercase tracking-widest text-text-muted">Open</div>
          <div className="team-collab-stat-value text-xl md:text-2xl font-semibold tabular-nums mt-0.5 md:mt-1">{stats.openCount}</div>
        </div>
        <div className="team-collab-stat glass rounded-xl md:rounded-2xl border border-border-glass p-3 md:p-4">
          <div className="team-collab-stat-label text-[10px] uppercase tracking-widest text-text-muted">Today</div>
          <div className="team-collab-stat-value text-xl md:text-2xl font-semibold tabular-nums mt-0.5 md:mt-1 text-neon-purple">
            {stats.dueTodayCount}
          </div>
        </div>
        <div className="team-collab-stat glass rounded-xl md:rounded-2xl border border-border-glass p-3 md:p-4">
          <div className="team-collab-stat-label text-[10px] uppercase tracking-widest text-text-muted">Late</div>
          <div className="team-collab-stat-value text-xl md:text-2xl font-semibold tabular-nums mt-0.5 md:mt-1 text-[var(--priority-p0)]">
            {stats.overdueCount}
          </div>
        </div>
        <div className="team-collab-stat glass rounded-xl md:rounded-2xl border border-border-glass p-3 md:p-4">
          <div className="team-collab-stat-label text-[10px] uppercase tracking-widest text-text-muted">Online</div>
          <div className="team-collab-stat-value text-xl md:text-2xl font-semibold tabular-nums mt-0.5 md:mt-1 text-neon-green">
            {stats.onlineCount}
          </div>
        </div>
      </div>

      {/* Who's responsible */}
      {showAssigneeSection && (
        <div className="team-collab-assignees glass rounded-2xl border border-border-glass p-4 md:p-5">
          <div className="text-sm font-medium text-text-primary mb-2 md:mb-3">Who&apos;s responsible</div>
          <div className="flex flex-wrap gap-2">
            {assigneeBreakdown.map((item) => (
              <span
                key={item.label}
                className="team-collab-chip text-xs px-2.5 py-1 rounded-lg border text-text-secondary"
              >
                <span className="text-text-primary font-medium">{item.label}</span>
                <span className="text-neon-purple ml-1.5 tabular-nums">{item.count}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Workspace lead hint for members */}
      {owner && currentUserId !== owner.userId && (
        <div className="text-xs text-text-muted px-1">
          Workspace owner:{" "}
          <span className="text-text-secondary">
            {owner.fullName || (owner.username ? `@${owner.username}` : "Owner")}
          </span>
          {" · "}
          Invites and workspace name are managed by the owner.
        </div>
      )}

      {/* Recent activity — collapsed by default */}
      <div className="glass rounded-2xl border border-border-glass overflow-hidden">
        <button
          type="button"
          onClick={() => setActivityExpanded((open) => !open)}
          className={cn(
            "team-collab-section-header w-full px-5 py-3 bg-surface-hover flex items-center justify-between gap-2 text-left transition-colors hover:bg-surface-hover",
            activityExpanded && "border-b border-border-glass",
          )}
          aria-expanded={activityExpanded}
        >
          <div className="flex items-center gap-2 font-medium text-sm min-w-0">
            <Zap className="h-4 w-4 text-neon-purple shrink-0" />
            <span className="truncate">Recent activity</span>
            {activityFeed.length > 0 && (
              <span className="text-[10px] font-mono text-text-muted shrink-0">
                {activityFeed.length}
              </span>
            )}
          </div>
          <ChevronDown
            className={cn(
              "h-4 w-4 text-text-muted shrink-0 transition-transform",
              activityExpanded && "rotate-180",
            )}
            aria-hidden
          />
        </button>
        {activityExpanded &&
          (activityFeed.length === 0 ? (
            <div className="p-6 text-sm text-text-muted text-center">
              No recent activity yet. Completing tasks and editing notes will show up here.
            </div>
          ) : (
            <div className="divide-y divide-border-glass">
              {activityFeed.map((item) => (
                <div key={item.id} className="team-activity-item px-5 py-3.5">
                  <div className="text-sm text-text-primary">{item.headline}</div>
                  {item.detail && (
                    <div className="text-xs text-text-muted mt-0.5 truncate">{item.detail}</div>
                  )}
                  <div className="text-[10px] text-text-faint mt-1 font-mono">{item.timeLabel}</div>
                </div>
              ))}
            </div>
          ))}
      </div>
    </div>
  );
}