"use client";

import React from "react";
import type { MeetingAgendaEntry, MeetingAgendaItem, WorkspaceMember } from "@/types";
import { getMemberDisplayName } from "@/lib/assignee";

interface MeetingSidebarProps {
  items: MeetingAgendaItem[];
  entries: MeetingAgendaEntry[];
  members: WorkspaceMember[];
  currentUserId?: string;
}

export function MeetingSidebar({ items, entries, members, currentUserId }: MeetingSidebarProps) {
  const decisions = entries.filter((e) => e.isDecision || /#decision/i.test(e.body));
  const carryOver = items.filter((i) => i.status === "continued");
  const actionItems = items.filter(
    (i) => (i.status === "open" || i.status === "in_progress" || i.status === "continued") && i.ownerId,
  );

  return (
    <aside className="meetings-sidebar flex flex-col min-h-0 overflow-y-auto p-4 gap-4 text-sm">
      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-text-faint mb-2">
          Action items
        </h3>
        {actionItems.length === 0 ? (
          <p className="text-text-muted text-xs">Assign owners to topics to track actions.</p>
        ) : (
          <ul className="space-y-2">
            {actionItems.map((item) => (
              <li key={item.id} className="text-text-primary">
                <span className="font-medium">{item.title}</span>
                <span className="text-text-muted text-xs block">
                  {getMemberDisplayName(
                    members.find((m) => m.userId === item.ownerId) ?? {
                      userId: item.ownerId!,
                      workspaceId: "",
                      role: "member",
                      joinedAt: "",
                    },
                    currentUserId,
                  )}
                </span>
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
            Carry-over queue
          </h3>
          <ul className="space-y-2">
            {carryOver.map((item) => (
              <li key={item.id} className="text-amber-400/90 text-xs">
                {item.title}
              </li>
            ))}
          </ul>
        </section>
      )}
    </aside>
  );
}