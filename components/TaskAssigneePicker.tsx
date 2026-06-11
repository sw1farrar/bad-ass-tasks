"use client";

import { User } from "lucide-react";
import type { WorkspaceMember } from "@/types";
import { getMemberDisplayName, isSharedWorkspace } from "@/lib/assignee";
import { cn } from "@/lib/utils";

interface TaskAssigneePickerProps {
  members: WorkspaceMember[];
  currentUserId?: string;
  value: string | null;
  onChange: (userId: string | null) => void;
  /** Hides helper copy and tightens spacing for mobile sheets */
  compact?: boolean;
}

export function TaskAssigneePicker({
  members,
  currentUserId,
  value,
  onChange,
  compact = false,
}: TaskAssigneePickerProps) {
  if (!isSharedWorkspace(members)) return null;

  return (
    <div>
      <div className={cn("text-text-muted flex items-center gap-2", compact ? "mb-1.5 text-xs" : "mb-2")}>
        <User className="h-4 w-4" /> {compact ? "Assignee" : "Responsible"}
      </div>
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        className={cn(
          "input w-full px-3 text-sm focus:outline-none focus:border-neon-purple/50 focus:ring-1 focus:ring-neon-purple/30",
          compact ? "py-2" : "py-2.5",
        )}
        aria-label="Assign task to a workspace member"
      >
        <option value="">Unassigned</option>
        {members.map((member) => (
          <option key={member.userId} value={member.userId}>
            {getMemberDisplayName(member, currentUserId)}
          </option>
        ))}
      </select>
      {!compact && (
        <p className="text-[10px] text-text-muted mt-1.5">
          Who should own this task in your shared workspace.
        </p>
      )}
    </div>
  );
}