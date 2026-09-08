import * as XLSX from "xlsx";
import { format } from "date-fns";
import { getRecurringLabel } from "@/lib/utils";
import type { Note, Task, TaskFolder, TaskCommentSummary } from "@/types";
import type { TasksStatusFilterMode } from "@/features/tasks/components/TasksStatusFilter";
import type { TasksRecurrenceFilterMode } from "@/features/tasks/components/TasksRecurrenceFilter";
import type { TasksHotListFilterMode, TasksStarredFilterMode } from "@/store/useTaskStore";
import { isHotListTask } from "@/lib/datetime";
import { getTaskPriorityLabel } from "@/features/tasks/lib/taskTableMeta";
import { getTaskLinkedFileNotes } from "@/features/tasks/lib/taskLinkedFiles";
import {
  normalizeFolderFilter,
  taskMatchesFolderFilter,
  type TasksFolderFilterMode,
} from "@/features/tasks/lib/folderFilter";

export type TasksExportFilters = {
  statusMode: TasksStatusFilterMode;
  recurrenceMode: TasksRecurrenceFilterMode;
  starred: TasksStarredFilterMode;
  hotList: TasksHotListFilterMode;
  folderFilter: TasksFolderFilterMode;
  search: string;
};

export function createDefaultTasksExportFilters(
  seed?: Partial<TasksExportFilters>,
): TasksExportFilters {
  return {
    statusMode: seed?.statusMode ?? "incomplete",
    recurrenceMode: seed?.recurrenceMode ?? "all",
    starred: seed?.starred ?? "all",
    hotList: seed?.hotList ?? "all",
    folderFilter: seed?.folderFilter ?? "all",
    search: seed?.search ?? "",
  };
}

export function filterTasksForExport(
  tasks: Task[],
  filters: TasksExportFilters,
): Task[] {
  let result = [...tasks];

  const q = filters.search.trim().toLowerCase();
  if (q) {
    result = result.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.description?.toLowerCase().includes(q),
    );
  }

  if (filters.statusMode === "completed") {
    result = result.filter((t) => t.status === "done");
  } else if (filters.statusMode === "incomplete") {
    result = result.filter((t) => t.status !== "done");
  }

  if (filters.recurrenceMode === "only") {
    result = result.filter((t) => !!t.recurringRule);
  } else if (filters.recurrenceMode === "none") {
    result = result.filter((t) => !t.recurringRule);
  }

  if (filters.starred === "only") {
    result = result.filter((t) => !!t.starred);
  }

  if (filters.hotList === "only") {
    result = result.filter((t) => isHotListTask(t));
  }

  const folderSelection = normalizeFolderFilter(filters.folderFilter);
  if (folderSelection.length > 0) {
    result = result.filter((t) => taskMatchesFolderFilter(t, folderSelection));
  }

  return result.sort((a, b) => {
    if (filters.statusMode === "completed") {
      const aDone = a.completedAt ? new Date(a.completedAt).getTime() : 0;
      const bDone = b.completedAt ? new Date(b.completedAt).getTime() : 0;
      return bDone - aDone;
    }
    if (a.status === "done" && b.status !== "done") return 1;
    if (b.status === "done" && a.status !== "done") return -1;
    if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
    if (a.dueDate) return -1;
    if (b.dueDate) return 1;
    return a.title.localeCompare(b.title);
  });
}

function folderName(folders: TaskFolder[], folderId?: string | null): string {
  if (!folderId) return "";
  return folders.find((f) => f.id === folderId)?.name ?? "";
}

function statusLabel(status: Task["status"]): string {
  if (status === "done") return "Completed";
  if (status === "doing") return "In progress";
  if (status === "backlog") return "Backlog";
  return "To do";
}

export type TasksExportRow = {
  Id: string;
  Title: string;
  Notes: string;
  Status: string;
  Priority: string;
  Important: string;
  Folder: string;
  Due: string;
  Created: string;
  Completed: string;
  Repeat: string;
  "Repeat rule": string;
  "Skipped dates": string;
  Assignee: string;
  "Assignee IDs": string;
  Tags: string;
  "Linked files": string;
  Comments: number;
  "Time estimate": string | number;
  "Parent task": string;
  Notebook: string;
};

function joinList(values?: string[] | null): string {
  return (values ?? []).filter(Boolean).join("; ");
}

function linkedFilesLabel(task: Task, notes: Note[]): string {
  const linked = getTaskLinkedFileNotes(task, notes);
  const foundIds = new Set(linked.map((n) => n.id));
  const titles = linked.map((n) => n.title?.trim() || n.id);
  const missing = (task.linkedNoteIds ?? []).filter((id) => !foundIds.has(id));
  return [...titles, ...missing].join("; ");
}

export function buildTasksExportRows(
  tasks: Task[],
  folders: TaskFolder[],
  commentSummaries: Record<string, TaskCommentSummary>,
  options?: { includeAssignee?: boolean; notes?: Note[] },
): TasksExportRow[] {
  const includeAssignee = options?.includeAssignee ?? true;
  const notes = options?.notes ?? [];
  return tasks.map((task) => {
    const row: TasksExportRow = {
      Id: task.id,
      Title: task.title,
      Notes: task.description?.trim() ?? "",
      Status: statusLabel(task.status),
      Priority: getTaskPriorityLabel(task.priority),
      Important: task.starred ? "Yes" : "",
      Folder: folderName(folders, task.folderId),
      Due: task.dueDate ? task.dueDate.slice(0, 10) : "",
      Created: task.createdAt || "",
      Completed: task.completedAt || "",
      Repeat: task.recurringRule ? getRecurringLabel(task.recurringRule) : "",
      "Repeat rule": task.recurringRule ?? "",
      "Skipped dates": joinList(task.exceptionDates),
      Assignee: includeAssignee ? task.assignee || "Anyone" : "",
      "Assignee IDs": includeAssignee ? joinList(task.assigneeIds) : "",
      Tags: joinList(task.tags),
      "Linked files": linkedFilesLabel(task, notes),
      Comments: commentSummaries[task.id]?.count ?? 0,
      "Time estimate": task.timeEstimate ?? "",
      "Parent task": task.parentTaskId ?? "",
      Notebook: task.notebookName ?? "",
    };
    return row;
  });
}

const EXPORT_COLUMNS: { key: keyof TasksExportRow; wch: number; assigneeOnly?: boolean }[] = [
  { key: "Id", wch: 18 },
  { key: "Title", wch: 40 },
  { key: "Notes", wch: 40 },
  { key: "Status", wch: 12 },
  { key: "Priority", wch: 10 },
  { key: "Important", wch: 10 },
  { key: "Folder", wch: 18 },
  { key: "Due", wch: 12 },
  { key: "Created", wch: 22 },
  { key: "Completed", wch: 22 },
  { key: "Repeat", wch: 22 },
  { key: "Repeat rule", wch: 28 },
  { key: "Skipped dates", wch: 22 },
  { key: "Assignee", wch: 18, assigneeOnly: true },
  { key: "Assignee IDs", wch: 22, assigneeOnly: true },
  { key: "Tags", wch: 20 },
  { key: "Linked files", wch: 28 },
  { key: "Comments", wch: 10 },
  { key: "Time estimate", wch: 14 },
  { key: "Parent task", wch: 18 },
  { key: "Notebook", wch: 18 },
];

export function downloadTasksExcel(
  rows: TasksExportRow[],
  options?: { workspaceName?: string; includeAssignee?: boolean },
): void {
  const includeAssignee = options?.includeAssignee ?? true;
  const columns = EXPORT_COLUMNS.filter((col) => includeAssignee || !col.assigneeOnly);
  const sheetRows = rows.map((row) => {
    const out: Record<string, string | number> = {};
    for (const col of columns) {
      out[col.key] = row[col.key];
    }
    return out;
  });

  const worksheet = XLSX.utils.json_to_sheet(sheetRows);
  worksheet["!cols"] = columns.map((col) => ({ wch: col.wch }));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Tasks");

  const stamp = format(new Date(), "yyyy-MM-dd");
  const workspaceSlug = (options?.workspaceName || "workspace")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  XLSX.writeFile(workbook, `tasks-${workspaceSlug || "workspace"}-${stamp}.xlsx`);
}
