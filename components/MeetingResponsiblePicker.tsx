"use client";

import React, { useEffect, useState } from "react";
import { User } from "lucide-react";
import type { WorkspaceMember } from "@/types";
import { getAgendaItemOwnerLabel } from "@/lib/meetings/agendaOwners";
import { getMemberDisplayName } from "@/lib/assignee";
import { cn } from "@/lib/utils";

interface MeetingResponsiblePickerProps {
  members: WorkspaceMember[];
  currentUserId?: string;
  ownerId?: string | null;
  ownerName?: string | null;
  onChange: (value: { ownerId: string | null; ownerName: string | null }) => void;
  compact?: boolean;
  disabled?: boolean;
}

export function MeetingResponsiblePicker({
  members,
  currentUserId,
  ownerId,
  ownerName,
  onChange,
  compact = false,
  disabled,
}: MeetingResponsiblePickerProps) {
  const resolved = getAgendaItemOwnerLabel({ ownerId, ownerName }, members, currentUserId);
  const [localValue, setLocalValue] = useState(resolved);

  useEffect(() => {
    setLocalValue(resolved);
  }, [ownerId, ownerName, resolved]);

  const memberOptions = members.map((m) => ({
    id: m.userId,
    label: getMemberDisplayName(m, currentUserId),
  }));

  const commit = (raw: string) => {
    const next = raw.trim();
    if (!next) {
      onChange({ ownerId: null, ownerName: null });
      return;
    }
    const matched = memberOptions.find((m) => m.label.toLowerCase() === next.toLowerCase());
    if (matched) onChange({ ownerId: matched.id, ownerName: null });
    else onChange({ ownerId: null, ownerName: next });
  };

  return (
    <div className={cn("min-w-0", compact ? "flex-1" : "w-full max-w-xs")}>
      <div
        className={cn(
          "text-text-muted flex items-center gap-2",
          compact ? "mb-1 text-xs" : "mb-1.5 text-xs",
        )}
      >
        <User className="h-3.5 w-3.5 shrink-0" />
        Who owns follow-up?
      </div>
      <input
        type="text"
        value={localValue}
        disabled={disabled}
        onChange={(e) => setLocalValue(e.target.value)}
        onBlur={() => commit(localValue)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit(localValue);
          }
        }}
        placeholder="Type a name…"
        autoComplete="off"
        className={cn(
          "input w-full px-3 text-sm focus:outline-none focus:border-neon-purple/50 focus:ring-1 focus:ring-neon-purple/30",
          compact ? "py-2" : "py-2.5",
        )}
        aria-label="Meeting topic responsible person"
      />
    </div>
  );
}