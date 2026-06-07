import type { Task } from "@/types";

/** Static demo data for landing page previews — mirrors in-app sample tasks. */
export const LANDING_WORKSPACE = {
  name: "Acme Launch",
  role: "owner" as const,
};

export const LANDING_TASKS: Task[] = [
  {
    id: "lt1",
    title: "Ship investor deck v4",
    description: "Finalize traction metrics and competitive landscape.",
    status: "doing",
    priority: "P0",
    dueDate: new Date(Date.now() + 1000 * 3600 * 8).toISOString(),
    assignee: "You",
    tags: ["investors"],
    createdAt: new Date(Date.now() - 1000 * 3600 * 6).toISOString(),
    linkedNoteIds: [],
    workspaceId: "w1",
  },
  {
    id: "lt2",
    title: "Review Q3 financial model",
    description: "Burn rate and runway scenarios with Sarah.",
    status: "todo",
    priority: "P1",
    dueDate: new Date(Date.now() + 1000 * 3600 * 24).toISOString(),
    assignee: "Sarah",
    tags: ["finance"],
    createdAt: new Date(Date.now() - 1000 * 3600 * 20).toISOString(),
    linkedNoteIds: [],
    workspaceId: "w1",
  },
  {
    id: "lt3",
    title: "Polish landing page hero",
    description: "Real UI preview + Imagine imagery.",
    status: "doing",
    priority: "P1",
    dueDate: new Date(Date.now() + 1000 * 3600 * 5).toISOString(),
    assignee: "You",
    tags: ["marketing"],
    createdAt: new Date(Date.now() - 1000 * 3600 * 4).toISOString(),
    linkedNoteIds: [],
    workspaceId: "w1",
  },
  {
    id: "lt4",
    title: "Weekly team sync",
    description: "Recurring every Monday.",
    status: "todo",
    priority: "P2",
    dueDate: new Date(Date.now() + 1000 * 3600 * 48).toISOString(),
    assignee: "You",
    tags: ["recurring"],
    createdAt: new Date(Date.now() - 1000 * 3600 * 50).toISOString(),
    recurringRule: "FREQ=WEEKLY;BYDAY=MO",
    exceptionDates: [],
    linkedNoteIds: [],
    workspaceId: "w1",
  },
];

export const LANDING_MEMBERS = [
  { name: "You", role: "Owner", initials: "Y", online: true },
  { name: "Sarah", role: "Admin", initials: "S", online: true },
  { name: "Alex", role: "Member", initials: "A", online: false },
  { name: "Jordan", role: "Member", initials: "J", online: true },
] as const;