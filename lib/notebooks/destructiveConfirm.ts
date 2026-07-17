import { previewEntryBody } from "@/lib/notebooks/entryPreview";
import { agendaEntryPlainText } from "@/lib/meetings/agendaEntryBody";
import type {
  MeetingAgendaEntry,
  MeetingAgendaItem,
  NotebookCompetitor,
  NotebookCompetitorNote,
  NotebookCustomer,
  NotebookCustomerNote,
  NotebookInvestment,
  NotebookInvestmentNote,
  NotebookTask,
  NotebookTaskProgress,
} from "@/types";

export type PendingDestructiveDelete =
  | { kind: "task"; id: string }
  | { kind: "taskProgress"; id: string }
  | { kind: "investment"; id: string }
  | { kind: "investmentNote"; id: string }
  | { kind: "customer"; id: string }
  | { kind: "customerNote"; id: string }
  | { kind: "competitor"; id: string }
  | { kind: "competitorNote"; id: string }
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
  investments: NotebookInvestment[];
  investmentNotes: NotebookInvestmentNote[];
  customers: NotebookCustomer[];
  customerNotes: NotebookCustomerNote[];
  competitors: NotebookCompetitor[];
  competitorNotes: NotebookCompetitorNote[];
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
    case "investment": {
      const item = ctx.investments.find((i) => i.id === pending.id);
      const noteCount = ctx.investmentNotes.filter((n) => n.investmentId === pending.id).length;
      return {
        title: "Delete investment?",
        highlight: item?.title?.trim() || "Untitled investment",
        description:
          noteCount > 0
            ? `This investment and its ${plural(noteCount, "note")} will be permanently deleted. This cannot be undone.`
            : "This investment will be permanently deleted. This cannot be undone.",
        confirmText: "Delete investment",
      };
    }
    case "investmentNote": {
      const entry = ctx.investmentNotes.find((n) => n.id === pending.id);
      return {
        title: "Delete investment note?",
        highlight: entry ? previewEntryBody(entry.body) : "Investment note",
        description: "This note will be permanently removed. This cannot be undone.",
        confirmText: "Delete note",
      };
    }
    case "customer": {
      const customer = ctx.customers.find((c) => c.id === pending.id);
      const noteCount = ctx.customerNotes.filter((n) => n.customerId === pending.id).length;
      return {
        title: "Delete customer?",
        highlight: customer?.accountName?.trim() || "Customer",
        description:
          noteCount > 0
            ? `This customer and ${plural(noteCount, "note")} about them will be permanently deleted. This cannot be undone.`
            : "This customer will be permanently deleted. This cannot be undone.",
        confirmText: "Delete customer",
      };
    }
    case "customerNote": {
      const entry = ctx.customerNotes.find((n) => n.id === pending.id);
      return {
        title: "Delete customer note?",
        highlight: entry ? previewEntryBody(entry.body) : "Customer note",
        description: "This note will be permanently removed. This cannot be undone.",
        confirmText: "Delete note",
      };
    }
    case "competitor": {
      const competitor = ctx.competitors.find((c) => c.id === pending.id);
      const noteCount = ctx.competitorNotes.filter((n) => n.competitorId === pending.id).length;
      return {
        title: "Delete competitor?",
        highlight: competitor?.name?.trim() || "Competitor",
        description:
          noteCount > 0
            ? `This competitor and ${plural(noteCount, "note")} about them will be permanently deleted. This cannot be undone.`
            : "This competitor will be removed from the analysis. This cannot be undone.",
        confirmText: "Delete competitor",
      };
    }
    case "competitorNote": {
      const entry = ctx.competitorNotes.find((n) => n.id === pending.id);
      return {
        title: "Delete competitor note?",
        highlight: entry ? previewEntryBody(entry.body) : "Competitor note",
        description: "This note will be permanently removed. This cannot be undone.",
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
  investmentCount: number;
  investmentNoteCount: number;
  customerCount: number;
  customerNoteCount: number;
  competitorCount: number;
  competitorNoteCount: number;
}

export function formatNotebookDeleteDetails(summary: NotebookDeleteSummary): string | null {
  const parts: string[] = [];
  if (summary.noteCount > 0) parts.push(plural(summary.noteCount, "note"));
  if (summary.taskCount > 0) parts.push(plural(summary.taskCount, "task"));
  if (summary.taskProgressCount > 0) parts.push(plural(summary.taskProgressCount, "progress note", "progress notes"));
  if (summary.investmentCount > 0) parts.push(plural(summary.investmentCount, "investment"));
  if (summary.investmentNoteCount > 0) parts.push(plural(summary.investmentNoteCount, "investment note", "investment notes"));
  if (summary.customerCount > 0) parts.push(plural(summary.customerCount, "customer"));
  if (summary.customerNoteCount > 0) parts.push(plural(summary.customerNoteCount, "customer note", "customer notes"));
  if (summary.competitorCount > 0) parts.push(plural(summary.competitorCount, "competitor"));
  if (summary.competitorNoteCount > 0) {
    parts.push(plural(summary.competitorNoteCount, "competitor note", "competitor notes"));
  }

  if (parts.length === 0) return null;
  return `Includes ${parts.join(", ")}.`;
}