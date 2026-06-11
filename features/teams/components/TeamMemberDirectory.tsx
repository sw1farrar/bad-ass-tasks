"use client";

import React, { useMemo } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatRoleLabel } from "@/lib/roles";
import { getMemberDisplayName } from "@/lib/assignee";
import type { Task, WorkspaceMember } from "@/types";
import { computeMemberOpenTaskCounts } from "../lib/computeTeamStats";
import {
  formatMemberJoined,
  formatMemberLastActive,
  getMemberInitials,
} from "../lib/formatMemberPresence";

interface TeamMemberDirectoryProps {
  members: WorkspaceMember[];
  tasks: Task[];
  onlineUserIds: Set<string>;
  currentUserId?: string;
  isLoading?: boolean;
  renderMemberActions?: (member: WorkspaceMember, isSelf: boolean) => React.ReactNode;
}

export function TeamMemberDirectory({
  members,
  tasks,
  onlineUserIds,
  currentUserId,
  isLoading = false,
  renderMemberActions,
}: TeamMemberDirectoryProps) {
  const taskCounts = useMemo(
    () => computeMemberOpenTaskCounts(tasks, members),
    [tasks, members]
  );

  const sortedMembers = useMemo(() => {
    const roleOrder = { owner: 0, admin: 1, member: 2 };
    return [...members].sort((a, b) => {
      const ra = roleOrder[a.role as keyof typeof roleOrder] ?? 3;
      const rb = roleOrder[b.role as keyof typeof roleOrder] ?? 3;
      if (ra !== rb) return ra - rb;
      const aOnline = onlineUserIds.has(a.userId) ? 0 : 1;
      const bOnline = onlineUserIds.has(b.userId) ? 0 : 1;
      if (aOnline !== bOnline) return aOnline - bOnline;
      return getMemberDisplayName(a, currentUserId).localeCompare(
        getMemberDisplayName(b, currentUserId)
      );
    });
  }, [members, onlineUserIds, currentUserId]);

  const onlineCount = members.filter((m) => onlineUserIds.has(m.userId)).length;

  return (
    <div className="team-directory-panel glass rounded-2xl border border-border-glass overflow-hidden">
      <div className="team-directory-header px-5 py-3 border-b border-border-glass flex items-center justify-between bg-surface-hover">
        <div className="min-w-0">
          <div className="font-medium text-sm md:text-base">Team directory</div>
          <div className="text-[10px] text-text-muted mt-0.5">
            {members.length} member{members.length === 1 ? "" : "s"}
            {onlineCount > 0 && (
              <span className="text-neon-green ml-1.5">{onlineCount} online</span>
            )}
          </div>
        </div>
        {isLoading && <Loader2 className="h-4 w-4 animate-spin text-neon-purple shrink-0" />}
      </div>

      {members.length === 0 ? (
        <div className="p-6 md:p-8 text-center text-text-muted text-sm">No members</div>
      ) : (
        <div className="divide-y divide-border-glass">
          {sortedMembers.map((member) => {
            const isSelf = member.userId === currentUserId;
            const isOnline = onlineUserIds.has(member.userId);
            const displayName = getMemberDisplayName(member, currentUserId);
            const openTasks = taskCounts.get(member.userId) ?? 0;
            const lastActive = formatMemberLastActive(member.lastActiveAt);
            const joined = formatMemberJoined(member.joinedAt);
            const presenceLabel = isOnline ? "Online now" : lastActive;

            return (
              <div
                key={member.userId}
                className="team-directory-member flex hover:bg-surface-hover transition-colors"
              >
                <div className="team-directory-member__main">
                  <div className="relative shrink-0">
                    {member.avatarUrl ? (
                      <img
                        src={member.avatarUrl}
                        alt=""
                        className="h-10 w-10 rounded-full object-cover border border-border-glass"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-neon-purple/15 border border-neon-purple/25 flex items-center justify-center text-sm font-medium text-neon-purple">
                        {getMemberInitials(member, currentUserId)}
                      </div>
                    )}
                    {isOnline && (
                      <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-neon-green border-2 border-bg" />
                    )}
                  </div>

                  <div className="team-directory-member__identity flex-1 min-w-0">
                    <div className="team-directory-member__name-row">
                      <span className="font-medium text-text-primary truncate">{displayName}</span>
                      <span
                        className={cn(
                          "team-directory-role-badge text-[10px] px-1.5 py-0.5 rounded font-mono shrink-0 border",
                          member.role === "owner"
                            ? "bg-neon-purple/10 text-neon-purple border-neon-purple/30"
                            : member.role === "admin"
                              ? "bg-surface-hover text-text-secondary border-border-glass"
                              : "bg-surface-hover text-text-muted border-border-glass"
                        )}
                      >
                        {formatRoleLabel(member.role)}
                      </span>
                    </div>
                    <div className="team-directory-member__meta flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10px] text-text-muted">
                      {presenceLabel && (
                        <span className={isOnline ? "text-neon-green" : undefined}>{presenceLabel}</span>
                      )}
                      {joined && (
                        <>
                          {presenceLabel && <span aria-hidden>·</span>}
                          <span>{joined}</span>
                        </>
                      )}
                      {member.location && (
                        <>
                          <span aria-hidden>·</span>
                          <span className="truncate max-w-[10rem]">{member.location}</span>
                        </>
                      )}
                      {openTasks > 0 && (
                        <>
                          <span aria-hidden>·</span>
                          <span className="text-text-secondary">
                            {openTasks} open task{openTasks === 1 ? "" : "s"}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {renderMemberActions && (
                  <div className="team-directory-member__actions">
                    {renderMemberActions(member, isSelf) ?? (
                      <span className="team-directory-role-readonly text-xs px-2.5 py-1 rounded bg-surface-hover border border-border-glass font-mono text-text-secondary">
                        {formatRoleLabel(member.role)}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}