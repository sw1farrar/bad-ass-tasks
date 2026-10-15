import { previewEntryBody } from "@/lib/notebooks/entryPreview";
import { agendaEntryPlainText } from "@/lib/meetings/agendaEntryBody";
import type {
  MeetingAgendaEntry,
  MeetingAgendaItem,
  NotebookTask,
  NotebookTaskProgress,
} from "@/types";

export type PendingDestructiveDelete =
  | { kind: "task"; id: string }
  | { kind: "taskProgress"; id: string }
  | { kind: "agendaItem"; id: string }
  | { kind: "agendaEntry"; id: string };

export interface DestructiveConfirmContent {
  title: string;
  highlight?: string;
  description: string;
  confirmText: string;
}

export interface DestructiveConfirmContext {
  tasks: NotebookTask[];
  taskProgress: NotebookTaskProgress[];
  agendaItems: MeetingAgendaItem[];
  agendaEntries: MeetingAgendaEntry[];
}

function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

export function buildDestructiveConfirmContent(
  pending: PendingDestructiveDelete | null,
  ctx: DestructiveConfirmContext,
): DestructiveConfirmContent | null {
  if (!pending) return null;

  switch (pending.kind) {
    case "task": {
      const task = ctx.tasks.find((t) => t.id === pending.id);
      const noteCount = ctx.taskProgress.filter((p) => p.taskId === pending.id).length;
      return {
        title: "Delete task?",
        highlight: task?.title?.trim() || "Untitled task",
        description:
          noteCount > 0
            ? `This task and its ${plural(noteCount, "progress note")} will be permanently deleted. This cannot be undone.`
            : "This task will be permanently deleted. This cannot be undone.",
        confirmText: "Delete task",
      };
    }
    case "taskProgress": {
      const entry = ctx.taskProgress.find((p) => p.id === pending.id);
      return {
        title: "Delete progress note?",
        highlight: entry ? previewEntryBody(entry.body) : "Progress note",
        description: "This progress note will be permanently removed. This cannot be undone.",
        confirmText: "Delete note",
      };
    }
    case "agendaItem": {
      const item = ctx.agendaItems.find((i) => i.id === pending.id);
      const noteCount = ctx.agendaEntries.filter((e) => e.agendaItemId === pending.id).length;
      return {
        title: "Delete agenda topic?",
        highlight: item?.title?.trim() || "Untitled topic",
        description:
          noteCount > 0
            ? `This topic and its ${plural(noteCount, "note")} will be permanently deleted. This cannot be undone.`
            : "This agenda topic will be permanently deleted. This cannot be undone.",
        confirmText: "Delete topic",
      };
    }
    case "agendaEntry": {
      const entry = ctx.agendaEntries.find((e) => e.id === pending.id);
      return {
        title: "Delete meeting note?",
        highlight: entry
          ? previewEntryBody(agendaEntryPlainText(entry.body))
          : "Meeting note",
        description: "This note will be permanently removed from the topic. This cannot be undone.",
        confirmText: "Delete note",
      };
    }
    default:
      return null;
  }
}

export interface NotebookDeleteSummary {
  noteCount: number;
  taskCount: number;
  taskProgressCount: number;
}

export function formatNotebookDeleteDetails(summary: NotebookDeleteSummary): string | null {
  const parts: string[] = [];
  if (summary.noteCount > 0) parts.push(plural(summary.noteCount, "note"));
  if (summary.taskCount > 0) parts.push(plural(summary.taskCount, "task"));
  if (summary.taskProgressCount > 0) parts.push(plural(summary.taskProgressCount, "progress note", "progress notes"));

  if (parts.length === 0) return null;
  return `Includes ${parts.join(", ")}.`;
}
