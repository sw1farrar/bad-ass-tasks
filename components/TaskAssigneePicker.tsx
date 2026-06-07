"use client";

import { User } from "lucide-react";
import type { WorkspaceMember } from "@/types";
import { getMemberDisplayName, isSharedWorkspace } from "@/lib/assignee";

interface TaskAssigneePickerProps {
  members: WorkspaceMember[];
  currentUserId?: string;
  value: string | null;
  onChange: (userId: string | null) => void;
}

export function TaskAssigneePicker({
  members,
  currentUserId,
  value,
  onChange,
}: TaskAssigneePickerProps) {
  if (!isSharedWorkspace(members)) return null;

  return (
    <div>
      <div className="text-[#71717a] mb-2 flex items-center gap-2">
        <User className="h-4 w-4" /> Responsible
      </div>
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        className="w-full bg-[#111114] border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#c084fc]/50 focus:ring-1 focus:ring-[#c084fc]/30"
        aria-label="Assign task to a workspace member"
      >
        <option value="">Unassigned</option>
        {members.map((member) => (
          <option key={member.userId} value={member.userId}>
            {getMemberDisplayName(member, currentUserId)}
          </option>
        ))}
      </select>
      <p className="text-[10px] text-[#71717a] mt-1.5">
        Who should own this task in your shared workspace.
      </p>
    </div>
  );
}