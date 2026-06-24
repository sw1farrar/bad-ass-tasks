"use client";

import React from "react";
import type { MeetingAgendaEntry, MeetingAgendaItem, WorkspaceMember } from "@/types";
import { getAgendaItemOwnerLabel, hasAgendaItemOwner } from "@/lib/meetings/agendaOwners";

interface MeetingSidebarProps {
  items: MeetingAgendaItem[];
  entries: MeetingAgendaEntry[];
  members: WorkspaceMember[];
  currentUserId?: string;
  onSelectItem?: (id: string) => void;
}

export function MeetingSidebar({
  items,
  entries,
  members,
  currentUserId,
  onSelectItem,
}: MeetingSidebarProps) {
  const decisions = entries.filter((e) => e.isDecision || /#decision/i.test(e.body));
  const carryOver = items.filter((i) => i.status === "continued");
  const actionItems = items.filter(
    (i) =>
      (i.status === "open" || i.status === "in_progress" || i.status === "continued") &&
      hasAgendaItemOwner(i),
  );

  return (
    <aside className="meetings-sidebar flex flex-col min-h-0 overflow-y-auto p-4 gap-4 text-sm">
      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-text-faint mb-2">
          Action items
        </h3>
        {actionItems.length === 0 ? (
          <p className="text-text-muted text-xs">Assign a responsible person to track actions.</p>
        ) : (
          <ul className="space-y-2">
            {actionItems.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => onSelectItem?.(item.id)}
                  className="w-full text-left rounded-lg px-2 py-1.5 -mx-2 hover:bg-surface-hover transition"
                >
                  <span className="font-medium text-text-primary">{item.title}</span>
                  <span className="text-text-muted text-xs block">
                    {getAgendaItemOwnerLabel(item, members, currentUserId)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {decisions.length > 0 && (
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-text-faint mb-2">
            Decisions
          </h3>
          <ul className="space-y-2">
            {decisions.map((d) => (
              <li key={d.id} className="text-text-secondary text-xs">
                {d.body.replace(/#decision/gi, "").trim()}
              </li>
            ))}
          </ul>
        </section>
      )}

      {carryOver.length > 0 && (
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-text-faint mb-2">
            Deferred topics
          </h3>
          <ul className="space-y-2">
            {carryOver.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => onSelectItem?.(item.id)}
                  className="w-full text-left text-amber-400/90 text-xs rounded-lg px-2 py-1 -mx-2 hover:bg-surface-hover"
                >
                  {item.title}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </aside>
  );
}