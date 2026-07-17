import * as XLSX from "xlsx";
import { format } from "date-fns";
import { getRecurringLabel } from "@/lib/utils";
import type { Task, TaskFolder, TaskCommentSummary } from "@/types";
import type { TasksStatusFilterMode } from "@/features/tasks/components/TasksStatusFilter";
import type { TasksRecurrenceFilterMode } from "@/features/tasks/components/TasksRecurrenceFilter";
import type { TasksFolderFilterMode, TasksStarredFilterMode } from "@/store/useTaskStore";

export type TasksExportFilters = {
  statusMode: TasksStatusFilterMode;
  recurrenceMode: TasksRecurrenceFilterMode;
  starred: TasksStarredFilterMode;
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

  if (filters.folderFilter === "none") {
    result = result.filter((t) => !t.folderId);
  } else if (filters.folderFilter !== "all") {
    result = result.filter((t) => t.folderId === filters.folderFilter);
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
  Important: string;
  Title: string;
  Status: string;
  Folder: string;
  Due: string;
  Repeat: string;
  Notes: string;
  Comments: number;
  Assignee: string;
};

export function buildTasksExportRows(
  tasks: Task[],
  folders: TaskFolder[],
  commentSummaries: Record<string, TaskCommentSummary>,
  options?: { includeAssignee?: boolean },
): TasksExportRow[] {
  const includeAssignee = options?.includeAssignee ?? true;
  return tasks.map((task) => {
    const row: TasksExportRow = {
      Important: task.starred ? "Yes" : "",
      Title: task.title,
      Status: statusLabel(task.status),
      Folder: folderName(folders, task.folderId),
      Due: task.dueDate ? task.dueDate.slice(0, 10) : "",
      Repeat: task.recurringRule ? getRecurringLabel(task.recurringRule) : "",
      Notes: task.description?.trim() ?? "",
      Comments: commentSummaries[task.id]?.count ?? 0,
      Assignee: includeAssignee ? task.assignee || "Anyone" : "",
    };
    return row;
  });
}

export function downloadTasksExcel(
  rows: TasksExportRow[],
  options?: { workspaceName?: string; includeAssignee?: boolean },
): void {
  const includeAssignee = options?.includeAssignee ?? true;
  const sheetRows = rows.map((row) => {
    const out: Record<string, string | number> = {
      Important: row.Important,
      Title: row.Title,
      Status: row.Status,
      Folder: row.Folder,
      Due: row.Due,
      Repeat: row.Repeat,
      Notes: row.Notes,
      Comments: row.Comments,
    };
    if (includeAssignee) out.Assignee = row.Assignee;
    return out;
  });

  const worksheet = XLSX.utils.json_to_sheet(sheetRows);
  worksheet["!cols"] = [
    { wch: 10 },
    { wch: 40 },
    { wch: 12 },
    { wch: 18 },
    { wch: 12 },
    { wch: 18 },
    { wch: 40 },
    { wch: 10 },
    ...(includeAssignee ? [{ wch: 18 }] : []),
  ];

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
