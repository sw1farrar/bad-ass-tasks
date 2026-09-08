import {
  addListItem,
  completeTask,
  createNote,
  createTask,
  deleteTask,
  getNote,
  getTask,
  getWhoami,
  listListItems,
  listLists,
  listNotes,
  listTasks,
  listWorkspaces,
  setListItemCompleted,
  updateNote,
  updateTask,
} from "@/lib/mcp/data";
import {
  addAgendaNote,
  addAgendaItem,
  addNotebookTask,
  archiveNote,
  completeNotebookTask,
  createList,
  createMeeting,
  createNotebook,
  createStore,
  createTaskFolder,
  deleteHealthReading,
  deleteList,
  deleteListItem,
  deleteMeeting,
  deleteNote,
  deleteNotebookTask,
  deleteStore,
  deleteTaskFolder,
  listFiles,
  listHealthReadings,
  listMembers,
  listMeetings,
  listNotebooks,
  listNotebookTasks,
  listStores,
  listTaskFolders,
  listTerritories,
  logHealthReading,
  searchWorkspace,
  updateAgendaItem,
  updateList,
  updateListItem,
  updateMeeting,
  updateNotebook,
  updateStore,
  updateTaskFolder,
  getMeeting,
} from "@/lib/mcp/suiteData";

export type JsonSchema = {
  type: "object";
  properties: Record<string, Record<string, unknown>>;
  required?: string[];
  additionalProperties?: boolean;
};

export type McpToolDefinition = {
  name: string;
  description: string;
  inputSchema: JsonSchema;
  handler: (userId: string, args: Record<string, unknown>) => Promise<unknown>;
};

function str(args: Record<string, unknown>, key: string): string | undefined {
  const value = args[key];
  return typeof value === "string" ? value : undefined;
}

function bool(args: Record<string, unknown>, key: string): boolean | undefined {
  const value = args[key];
  return typeof value === "boolean" ? value : undefined;
}

function num(args: Record<string, unknown>, key: string): number | undefined {
  const value = args[key];
  return typeof value === "number" ? value : undefined;
}

function strs(args: Record<string, unknown>, key: string): string[] | undefined {
  const value = args[key];
  if (!Array.isArray(value)) return undefined;
  return value.filter((item): item is string => typeof item === "string");
}

const workspaceIdProp = {
  type: "string",
  description: "Workspace id. Omit to use your default (oldest owned) workspace.",
};

const statusEnum = ["backlog", "todo", "doing", "done"];
const priorityEnum = ["P0", "P1", "P2", "P3"];
const listColorEnum = ["default", "purple", "pink", "green", "amber", "blue"];
const meetingStatusEnum = ["draft", "scheduled", "in_progress", "completed"];
const agendaStatusEnum = ["open", "in_progress", "completed", "continued"];
const healthMetricEnum = [
  "weight",
  "body_fat",
  "muscle_mass",
  "waist",
  "blood_pressure_systolic",
  "resting_hr",
  "sleep_hours",
  "steps",
  "active_minutes",
  "calories_burned",
  "stress",
];

export const MCP_TOOLS: McpToolDefinition[] = [
  {
    name: "whoami",
    description: "Show the Badazz Tasks account Grok is acting as.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    handler: (userId) => getWhoami(userId),
  },
  {
    name: "list_workspaces",
    description: "List workspaces the signed-in user can access.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    handler: (userId) => listWorkspaces(userId),
  },
  {
    name: "list_members",
    description: "List people in a workspace (name, username, role). Use before assigning tasks.",
    inputSchema: {
      type: "object",
      properties: { workspace_id: workspaceIdProp },
      additionalProperties: false,
    },
    handler: (userId, args) => listMembers(userId, str(args, "workspace_id")),
  },
  {
    name: "search_workspace",
    description:
      "Search tasks, notes, checklists, list items, meetings, and stores by title/name in one call.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search text." },
        workspace_id: workspaceIdProp,
        limit: { type: "number", description: "Max hits per type (1-20, default 8)." },
      },
      required: ["query"],
      additionalProperties: false,
    },
    handler: (userId, args) =>
      searchWorkspace(userId, {
        query: str(args, "query") ?? "",
        workspace_id: str(args, "workspace_id"),
        limit: num(args, "limit"),
      }),
  },
  {
    name: "list_tasks",
    description: "List tasks in a workspace. Filter by status, folder, starred, or title search.",
    inputSchema: {
      type: "object",
      properties: {
        workspace_id: workspaceIdProp,
        status: { type: "string", enum: statusEnum, description: "Optional status filter." },
        query: { type: "string", description: "Case-insensitive title search." },
        folder_id: { type: "string", description: "Folder id, or empty for tasks with no folder." },
        starred: { type: "boolean", description: "If true, only starred tasks." },
        limit: { type: "number", description: "Max rows (1-50, default 25)." },
      },
      additionalProperties: false,
    },
    handler: (userId, args) =>
      listTasks(userId, {
        workspace_id: str(args, "workspace_id"),
        status: str(args, "status"),
        query: str(args, "query"),
        folder_id: str(args, "folder_id"),
        starred: bool(args, "starred"),
        limit: num(args, "limit"),
      }),
  },
  {
    name: "get_task",
    description: "Get one task by id.",
    inputSchema: {
      type: "object",
      properties: { task_id: { type: "string", description: "Task id." } },
      required: ["task_id"],
      additionalProperties: false,
    },
    handler: (userId, args) => getTask(userId, str(args, "task_id") ?? ""),
  },
  {
    name: "create_task",
    description: "Create a task in a workspace. Use this when the user asks to add or remember a to-do.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Task title." },
        workspace_id: workspaceIdProp,
        description: { type: "string" },
        status: { type: "string", enum: statusEnum },
        priority: { type: "string", enum: priorityEnum },
        due_date: { type: "string", description: "YYYY-MM-DD or ISO date." },
        tags: { type: "array", items: { type: "string" } },
        starred: { type: "boolean" },
        folder_id: { type: "string" },
        parent_task_id: { type: "string", description: "Parent task id for a subtask." },
        assignee_ids: { type: "array", items: { type: "string" }, description: "Workspace member user ids." },
        recurring_rule: { type: "string", description: "RRULE-ish string, e.g. FREQ=WEEKLY;BYDAY=MO." },
      },
      required: ["title"],
      additionalProperties: false,
    },
    handler: (userId, args) =>
      createTask(userId, {
        title: str(args, "title") ?? "",
        workspace_id: str(args, "workspace_id"),
        description: str(args, "description"),
        status: str(args, "status"),
        priority: str(args, "priority"),
        due_date: str(args, "due_date"),
        tags: strs(args, "tags"),
        starred: bool(args, "starred"),
        folder_id: str(args, "folder_id"),
        parent_task_id: str(args, "parent_task_id"),
        assignee_ids: strs(args, "assignee_ids"),
        recurring_rule: str(args, "recurring_rule"),
      }),
  },
  {
    name: "update_task",
    description:
      "Update a task's title, description, status, priority, due date, tags, starred flag, folder, parent, assignees, or recurrence.",
    inputSchema: {
      type: "object",
      properties: {
        task_id: { type: "string" },
        title: { type: "string" },
        description: { type: "string" },
        status: { type: "string", enum: statusEnum },
        priority: { type: "string", enum: priorityEnum },
        due_date: { type: "string", description: "YYYY-MM-DD, ISO date, or empty to clear." },
        tags: { type: "array", items: { type: "string" } },
        starred: { type: "boolean" },
        folder_id: { type: "string", description: "Folder id, or empty to clear." },
        parent_task_id: { type: "string", description: "Parent task id, or empty to clear." },
        assignee_ids: { type: "array", items: { type: "string" } },
        recurring_rule: { type: "string", description: "RRULE string, or empty to clear." },
        linked_note_ids: { type: "array", items: { type: "string" } },
      },
      required: ["task_id"],
      additionalProperties: false,
    },
    handler: (userId, args) =>
      updateTask(userId, {
        task_id: str(args, "task_id") ?? "",
        title: str(args, "title"),
        description: str(args, "description"),
        status: str(args, "status"),
        priority: str(args, "priority"),
        due_date: str(args, "due_date"),
        tags: strs(args, "tags"),
        starred: bool(args, "starred"),
        folder_id: str(args, "folder_id"),
        parent_task_id: str(args, "parent_task_id"),
        assignee_ids: strs(args, "assignee_ids"),
        recurring_rule: str(args, "recurring_rule"),
        linked_note_ids: strs(args, "linked_note_ids"),
      }),
  },
  {
    name: "complete_task",
    description: "Mark a task done.",
    inputSchema: {
      type: "object",
      properties: { task_id: { type: "string" } },
      required: ["task_id"],
      additionalProperties: false,
    },
    handler: (userId, args) => completeTask(userId, str(args, "task_id") ?? ""),
  },
  {
    name: "delete_task",
    description: "Permanently delete a task.",
    inputSchema: {
      type: "object",
      properties: { task_id: { type: "string" } },
      required: ["task_id"],
      additionalProperties: false,
    },
    handler: (userId, args) => deleteTask(userId, str(args, "task_id") ?? ""),
  },
  {
    name: "list_task_folders",
    description: "List task folders in a workspace.",
    inputSchema: {
      type: "object",
      properties: { workspace_id: workspaceIdProp },
      additionalProperties: false,
    },
    handler: (userId, args) => listTaskFolders(userId, str(args, "workspace_id")),
  },
  {
    name: "create_task_folder",
    description: "Create a task folder for grouping tasks.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        workspace_id: workspaceIdProp,
      },
      required: ["name"],
      additionalProperties: false,
    },
    handler: (userId, args) =>
      createTaskFolder(userId, {
        name: str(args, "name") ?? "",
        workspace_id: str(args, "workspace_id"),
      }),
  },
  {
    name: "update_task_folder",
    description: "Rename a task folder.",
    inputSchema: {
      type: "object",
      properties: {
        folder_id: { type: "string" },
        name: { type: "string" },
      },
      required: ["folder_id"],
      additionalProperties: false,
    },
    handler: (userId, args) =>
      updateTaskFolder(userId, {
        folder_id: str(args, "folder_id") ?? "",
        name: str(args, "name"),
      }),
  },
  {
    name: "delete_task_folder",
    description: "Delete a task folder. Tasks in it are unfiled, not deleted.",
    inputSchema: {
      type: "object",
      properties: { folder_id: { type: "string" } },
      required: ["folder_id"],
      additionalProperties: false,
    },
    handler: (userId, args) => deleteTaskFolder(userId, str(args, "folder_id") ?? ""),
  },
  {
    name: "list_notes",
    description: "List notes in a workspace (title and metadata, not full body).",
    inputSchema: {
      type: "object",
      properties: {
        workspace_id: workspaceIdProp,
        query: { type: "string", description: "Case-insensitive title search." },
        notebook_id: { type: "string", description: "Notebook id, or empty for Files notes." },
        include_archived: { type: "boolean" },
        limit: { type: "number" },
      },
      additionalProperties: false,
    },
    handler: (userId, args) =>
      listNotes(userId, {
        workspace_id: str(args, "workspace_id"),
        query: str(args, "query"),
        notebook_id: str(args, "notebook_id"),
        include_archived: bool(args, "include_archived"),
        limit: num(args, "limit"),
      }),
  },
  {
    name: "get_note",
    description: "Read a note's title and body.",
    inputSchema: {
      type: "object",
      properties: { note_id: { type: "string" } },
      required: ["note_id"],
      additionalProperties: false,
    },
    handler: (userId, args) => getNote(userId, str(args, "note_id") ?? ""),
  },
  {
    name: "create_note",
    description: "Create a note. Use this when the user asks to save writing, a memo, or meeting notes.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        content: { type: "string", description: "Plain-text body. Line breaks are preserved." },
        workspace_id: workspaceIdProp,
        tags: { type: "array", items: { type: "string" } },
        notebook_id: { type: "string", description: "Put the note in this notebook." },
      },
      required: ["title"],
      additionalProperties: false,
    },
    handler: (userId, args) =>
      createNote(userId, {
        title: str(args, "title") ?? "",
        content: str(args, "content"),
        workspace_id: str(args, "workspace_id"),
        tags: strs(args, "tags"),
        notebook_id: str(args, "notebook_id"),
      }),
  },
  {
    name: "update_note",
    description: "Update a note's title, body, tags, notebook, archive, or bookmark. Replacing content overwrites the body.",
    inputSchema: {
      type: "object",
      properties: {
        note_id: { type: "string" },
        title: { type: "string" },
        content: { type: "string" },
        tags: { type: "array", items: { type: "string" } },
        notebook_id: { type: "string", description: "Notebook id, or empty to move to Files." },
        archived: { type: "boolean" },
        bookmarked: { type: "boolean" },
      },
      required: ["note_id"],
      additionalProperties: false,
    },
    handler: (userId, args) =>
      updateNote(userId, {
        note_id: str(args, "note_id") ?? "",
        title: str(args, "title"),
        content: str(args, "content"),
        tags: strs(args, "tags"),
        notebook_id: str(args, "notebook_id"),
        archived: bool(args, "archived"),
        bookmarked: bool(args, "bookmarked"),
      }),
  },
  {
    name: "delete_note",
    description: "Permanently delete a note.",
    inputSchema: {
      type: "object",
      properties: { note_id: { type: "string" } },
      required: ["note_id"],
      additionalProperties: false,
    },
    handler: (userId, args) => deleteNote(userId, str(args, "note_id") ?? ""),
  },
  {
    name: "archive_note",
    description: "Archive a note so it leaves the active list.",
    inputSchema: {
      type: "object",
      properties: { note_id: { type: "string" } },
      required: ["note_id"],
      additionalProperties: false,
    },
    handler: (userId, args) => archiveNote(userId, str(args, "note_id") ?? "", true),
  },
  {
    name: "list_files",
    description: "List Files-library notes (receipts, emails, documents) not in a notebook.",
    inputSchema: {
      type: "object",
      properties: {
        workspace_id: workspaceIdProp,
        query: { type: "string" },
        record_type: { type: "string", enum: ["note", "email", "document", "receipt", "other"] },
        review_status: { type: "string", enum: ["pending_review", "filed"] },
        limit: { type: "number" },
      },
      additionalProperties: false,
    },
    handler: (userId, args) =>
      listFiles(userId, {
        workspace_id: str(args, "workspace_id"),
        query: str(args, "query"),
        record_type: str(args, "record_type"),
        review_status: str(args, "review_status"),
        limit: num(args, "limit"),
      }),
  },
  {
    name: "list_notebooks",
    description: "List notebooks in a workspace.",
    inputSchema: {
      type: "object",
      properties: { workspace_id: workspaceIdProp },
      additionalProperties: false,
    },
    handler: (userId, args) => listNotebooks(userId, str(args, "workspace_id")),
  },
  {
    name: "create_notebook",
    description: "Create a notebook.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        workspace_id: workspaceIdProp,
      },
      required: ["name"],
      additionalProperties: false,
    },
    handler: (userId, args) =>
      createNotebook(userId, {
        name: str(args, "name") ?? "",
        workspace_id: str(args, "workspace_id"),
      }),
  },
  {
    name: "update_notebook",
    description: "Rename or archive a notebook.",
    inputSchema: {
      type: "object",
      properties: {
        notebook_id: { type: "string" },
        name: { type: "string" },
        archived: { type: "boolean" },
      },
      required: ["notebook_id"],
      additionalProperties: false,
    },
    handler: (userId, args) =>
      updateNotebook(userId, {
        notebook_id: str(args, "notebook_id") ?? "",
        name: str(args, "name"),
        archived: bool(args, "archived"),
      }),
  },
  {
    name: "list_notebook_tasks",
    description: "List tasks inside a notebook.",
    inputSchema: {
      type: "object",
      properties: {
        notebook_id: { type: "string" },
        limit: { type: "number" },
      },
      required: ["notebook_id"],
      additionalProperties: false,
    },
    handler: (userId, args) =>
      listNotebookTasks(userId, {
        notebook_id: str(args, "notebook_id") ?? "",
        limit: num(args, "limit"),
      }),
  },
  {
    name: "add_notebook_task",
    description: "Add a task to a notebook.",
    inputSchema: {
      type: "object",
      properties: {
        notebook_id: { type: "string" },
        title: { type: "string" },
        show_on_workspace: { type: "boolean", description: "Also show on the workspace Tasks page." },
      },
      required: ["notebook_id", "title"],
      additionalProperties: false,
    },
    handler: (userId, args) =>
      addNotebookTask(userId, {
        notebook_id: str(args, "notebook_id") ?? "",
        title: str(args, "title") ?? "",
        show_on_workspace: bool(args, "show_on_workspace"),
      }),
  },
  {
    name: "complete_notebook_task",
    description: "Mark a notebook task complete or incomplete.",
    inputSchema: {
      type: "object",
      properties: {
        task_id: { type: "string" },
        completed: { type: "boolean", description: "Default true." },
      },
      required: ["task_id"],
      additionalProperties: false,
    },
    handler: (userId, args) =>
      completeNotebookTask(userId, str(args, "task_id") ?? "", bool(args, "completed") ?? true),
  },
  {
    name: "delete_notebook_task",
    description: "Delete a notebook task.",
    inputSchema: {
      type: "object",
      properties: { task_id: { type: "string" } },
      required: ["task_id"],
      additionalProperties: false,
    },
    handler: (userId, args) => deleteNotebookTask(userId, str(args, "task_id") ?? ""),
  },
  {
    name: "list_lists",
    description: "List checklists in a workspace.",
    inputSchema: {
      type: "object",
      properties: { workspace_id: workspaceIdProp },
      additionalProperties: false,
    },
    handler: (userId, args) => listLists(userId, str(args, "workspace_id")),
  },
  {
    name: "create_list",
    description: "Create a checklist.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        workspace_id: workspaceIdProp,
        color: { type: "string", enum: listColorEnum },
        pinned: { type: "boolean" },
      },
      required: ["title"],
      additionalProperties: false,
    },
    handler: (userId, args) =>
      createList(userId, {
        title: str(args, "title") ?? "",
        workspace_id: str(args, "workspace_id"),
        color: str(args, "color"),
        pinned: bool(args, "pinned"),
      }),
  },
  {
    name: "update_list",
    description: "Rename, recolor, pin, or archive a checklist.",
    inputSchema: {
      type: "object",
      properties: {
        list_id: { type: "string" },
        title: { type: "string" },
        color: { type: "string", enum: listColorEnum },
        pinned: { type: "boolean" },
        archived: { type: "boolean" },
      },
      required: ["list_id"],
      additionalProperties: false,
    },
    handler: (userId, args) =>
      updateList(userId, {
        list_id: str(args, "list_id") ?? "",
        title: str(args, "title"),
        color: str(args, "color"),
        pinned: bool(args, "pinned"),
        archived: bool(args, "archived"),
      }),
  },
  {
    name: "delete_list",
    description: "Permanently delete a checklist and its items.",
    inputSchema: {
      type: "object",
      properties: { list_id: { type: "string" } },
      required: ["list_id"],
      additionalProperties: false,
    },
    handler: (userId, args) => deleteList(userId, str(args, "list_id") ?? ""),
  },
  {
    name: "list_list_items",
    description: "List items on a checklist.",
    inputSchema: {
      type: "object",
      properties: { list_id: { type: "string" } },
      required: ["list_id"],
      additionalProperties: false,
    },
    handler: (userId, args) => listListItems(userId, str(args, "list_id") ?? ""),
  },
  {
    name: "add_list_item",
    description: "Add an item to a checklist.",
    inputSchema: {
      type: "object",
      properties: {
        list_id: { type: "string" },
        text: { type: "string" },
        parent_item_id: { type: "string", description: "Nest under this item." },
      },
      required: ["list_id", "text"],
      additionalProperties: false,
    },
    handler: (userId, args) =>
      addListItem(userId, {
        list_id: str(args, "list_id") ?? "",
        text: str(args, "text") ?? "",
        parent_item_id: str(args, "parent_item_id"),
      }),
  },
  {
    name: "update_list_item",
    description: "Change a checklist item's text, completed/pending state, or parent.",
    inputSchema: {
      type: "object",
      properties: {
        item_id: { type: "string" },
        text: { type: "string" },
        completed: { type: "boolean" },
        pending: { type: "boolean", description: "Park the item off the active list." },
        parent_item_id: { type: "string", description: "Parent item id, or empty to un-nest." },
      },
      required: ["item_id"],
      additionalProperties: false,
    },
    handler: (userId, args) =>
      updateListItem(userId, {
        item_id: str(args, "item_id") ?? "",
        text: str(args, "text"),
        completed: bool(args, "completed"),
        pending: bool(args, "pending"),
        parent_item_id: str(args, "parent_item_id"),
      }),
  },
  {
    name: "complete_list_item",
    description: "Mark a checklist item complete.",
    inputSchema: {
      type: "object",
      properties: { item_id: { type: "string" } },
      required: ["item_id"],
      additionalProperties: false,
    },
    handler: (userId, args) => setListItemCompleted(userId, str(args, "item_id") ?? "", true),
  },
  {
    name: "uncomplete_list_item",
    description: "Mark a checklist item incomplete.",
    inputSchema: {
      type: "object",
      properties: { item_id: { type: "string" } },
      required: ["item_id"],
      additionalProperties: false,
    },
    handler: (userId, args) => setListItemCompleted(userId, str(args, "item_id") ?? "", false),
  },
  {
    name: "delete_list_item",
    description: "Delete a checklist item.",
    inputSchema: {
      type: "object",
      properties: { item_id: { type: "string" } },
      required: ["item_id"],
      additionalProperties: false,
    },
    handler: (userId, args) => deleteListItem(userId, str(args, "item_id") ?? ""),
  },
  {
    name: "list_meetings",
    description: "List meetings in a workspace.",
    inputSchema: {
      type: "object",
      properties: {
        workspace_id: workspaceIdProp,
        status: { type: "string", enum: meetingStatusEnum },
        limit: { type: "number" },
      },
      additionalProperties: false,
    },
    handler: (userId, args) =>
      listMeetings(userId, {
        workspace_id: str(args, "workspace_id"),
        status: str(args, "status"),
        limit: num(args, "limit"),
      }),
  },
  {
    name: "get_meeting",
    description: "Get a meeting with its agenda items and notes.",
    inputSchema: {
      type: "object",
      properties: { meeting_id: { type: "string" } },
      required: ["meeting_id"],
      additionalProperties: false,
    },
    handler: (userId, args) => getMeeting(userId, str(args, "meeting_id") ?? ""),
  },
  {
    name: "create_meeting",
    description: "Create a meeting.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        workspace_id: workspaceIdProp,
        description: { type: "string" },
        status: { type: "string", enum: meetingStatusEnum },
        scheduled_at: { type: "string", description: "ISO datetime." },
        attendees: { type: "array", items: { type: "string" }, description: "Freeform attendee names." },
        notebook_id: { type: "string" },
      },
      required: ["title"],
      additionalProperties: false,
    },
    handler: (userId, args) =>
      createMeeting(userId, {
        title: str(args, "title") ?? "",
        workspace_id: str(args, "workspace_id"),
        description: str(args, "description"),
        status: str(args, "status"),
        scheduled_at: str(args, "scheduled_at"),
        attendees: strs(args, "attendees"),
        notebook_id: str(args, "notebook_id"),
      }),
  },
  {
    name: "update_meeting",
    description: "Update a meeting's title, schedule, status, attendees, or archive flag.",
    inputSchema: {
      type: "object",
      properties: {
        meeting_id: { type: "string" },
        title: { type: "string" },
        description: { type: "string" },
        status: { type: "string", enum: meetingStatusEnum },
        scheduled_at: { type: "string" },
        attendees: { type: "array", items: { type: "string" } },
        archived: { type: "boolean" },
      },
      required: ["meeting_id"],
      additionalProperties: false,
    },
    handler: (userId, args) =>
      updateMeeting(userId, {
        meeting_id: str(args, "meeting_id") ?? "",
        title: str(args, "title"),
        description: str(args, "description"),
        status: str(args, "status"),
        scheduled_at: str(args, "scheduled_at"),
        attendees: strs(args, "attendees"),
        archived: bool(args, "archived"),
      }),
  },
  {
    name: "delete_meeting",
    description: "Permanently delete a meeting.",
    inputSchema: {
      type: "object",
      properties: { meeting_id: { type: "string" } },
      required: ["meeting_id"],
      additionalProperties: false,
    },
    handler: (userId, args) => deleteMeeting(userId, str(args, "meeting_id") ?? ""),
  },
  {
    name: "add_agenda_item",
    description: "Add a topic to a meeting agenda.",
    inputSchema: {
      type: "object",
      properties: {
        meeting_id: { type: "string" },
        title: { type: "string" },
        description: { type: "string" },
        owner_name: { type: "string" },
      },
      required: ["meeting_id", "title"],
      additionalProperties: false,
    },
    handler: (userId, args) =>
      addAgendaItem(userId, {
        meeting_id: str(args, "meeting_id") ?? "",
        title: str(args, "title") ?? "",
        description: str(args, "description"),
        owner_name: str(args, "owner_name"),
      }),
  },
  {
    name: "update_agenda_item",
    description: "Update an agenda topic's title, status, owner, or reviewed flag.",
    inputSchema: {
      type: "object",
      properties: {
        item_id: { type: "string" },
        title: { type: "string" },
        description: { type: "string" },
        status: { type: "string", enum: agendaStatusEnum },
        owner_name: { type: "string" },
        reviewed: { type: "boolean" },
      },
      required: ["item_id"],
      additionalProperties: false,
    },
    handler: (userId, args) =>
      updateAgendaItem(userId, {
        item_id: str(args, "item_id") ?? "",
        title: str(args, "title"),
        description: str(args, "description"),
        status: str(args, "status"),
        owner_name: str(args, "owner_name"),
        reviewed: bool(args, "reviewed"),
      }),
  },
  {
    name: "add_agenda_note",
    description: "Add a note or decision under an agenda topic.",
    inputSchema: {
      type: "object",
      properties: {
        item_id: { type: "string" },
        body: { type: "string" },
        is_decision: { type: "boolean" },
      },
      required: ["item_id", "body"],
      additionalProperties: false,
    },
    handler: (userId, args) =>
      addAgendaNote(userId, {
        item_id: str(args, "item_id") ?? "",
        body: str(args, "body") ?? "",
        is_decision: bool(args, "is_decision"),
      }),
  },
  {
    name: "list_health_readings",
    description: "List the signed-in user's health readings.",
    inputSchema: {
      type: "object",
      properties: {
        workspace_id: workspaceIdProp,
        metric_type: { type: "string", enum: healthMetricEnum },
        limit: { type: "number" },
      },
      additionalProperties: false,
    },
    handler: (userId, args) =>
      listHealthReadings(userId, {
        workspace_id: str(args, "workspace_id"),
        metric_type: str(args, "metric_type"),
        limit: num(args, "limit"),
      }),
  },
  {
    name: "log_health_reading",
    description: "Log a health metric (weight, steps, sleep, stress, etc.) for the signed-in user.",
    inputSchema: {
      type: "object",
      properties: {
        metric_type: { type: "string", enum: healthMetricEnum },
        value: { type: "number" },
        workspace_id: workspaceIdProp,
        unit: { type: "string" },
        recorded_at: { type: "string", description: "ISO datetime. Defaults to now." },
        note: { type: "string" },
      },
      required: ["metric_type", "value"],
      additionalProperties: false,
    },
    handler: (userId, args) =>
      logHealthReading(userId, {
        metric_type: str(args, "metric_type") ?? "",
        value: num(args, "value") ?? Number.NaN,
        workspace_id: str(args, "workspace_id"),
        unit: str(args, "unit"),
        recorded_at: str(args, "recorded_at"),
        note: str(args, "note"),
      }),
  },
  {
    name: "delete_health_reading",
    description: "Delete one of the signed-in user's health readings.",
    inputSchema: {
      type: "object",
      properties: { reading_id: { type: "string" } },
      required: ["reading_id"],
      additionalProperties: false,
    },
    handler: (userId, args) => deleteHealthReading(userId, str(args, "reading_id") ?? ""),
  },
  {
    name: "list_stores",
    description: "List map stores in a workspace.",
    inputSchema: {
      type: "object",
      properties: {
        workspace_id: workspaceIdProp,
        query: { type: "string" },
        status: { type: "string", enum: ["active", "inactive"] },
        limit: { type: "number" },
      },
      additionalProperties: false,
    },
    handler: (userId, args) =>
      listStores(userId, {
        workspace_id: str(args, "workspace_id"),
        query: str(args, "query"),
        status: str(args, "status"),
        limit: num(args, "limit"),
      }),
  },
  {
    name: "create_store",
    description: "Add a store to the map. Geocodes the address when lat/lng are omitted.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        address: { type: "string" },
        workspace_id: workspaceIdProp,
        store_number: { type: "string" },
        city: { type: "string" },
        state: { type: "string" },
        postal_code: { type: "string" },
        country: { type: "string" },
        notes: { type: "string" },
        status: { type: "string", enum: ["active", "inactive"] },
        latitude: { type: "number" },
        longitude: { type: "number" },
      },
      required: ["name", "address"],
      additionalProperties: false,
    },
    handler: (userId, args) =>
      createStore(userId, {
        name: str(args, "name") ?? "",
        address: str(args, "address") ?? "",
        workspace_id: str(args, "workspace_id"),
        store_number: str(args, "store_number"),
        city: str(args, "city"),
        state: str(args, "state"),
        postal_code: str(args, "postal_code"),
        country: str(args, "country"),
        notes: str(args, "notes"),
        status: str(args, "status"),
        latitude: num(args, "latitude"),
        longitude: num(args, "longitude"),
      }),
  },
  {
    name: "update_store",
    description: "Update a map store's name, address, notes, or status.",
    inputSchema: {
      type: "object",
      properties: {
        store_id: { type: "string" },
        name: { type: "string" },
        address: { type: "string" },
        store_number: { type: "string" },
        city: { type: "string" },
        state: { type: "string" },
        postal_code: { type: "string" },
        country: { type: "string" },
        notes: { type: "string" },
        status: { type: "string", enum: ["active", "inactive"] },
        latitude: { type: "number" },
        longitude: { type: "number" },
      },
      required: ["store_id"],
      additionalProperties: false,
    },
    handler: (userId, args) =>
      updateStore(userId, {
        store_id: str(args, "store_id") ?? "",
        name: str(args, "name"),
        address: str(args, "address"),
        store_number: str(args, "store_number"),
        city: str(args, "city"),
        state: str(args, "state"),
        postal_code: str(args, "postal_code"),
        country: str(args, "country"),
        notes: str(args, "notes"),
        status: str(args, "status"),
        latitude: num(args, "latitude"),
        longitude: num(args, "longitude"),
      }),
  },
  {
    name: "delete_store",
    description: "Delete a map store.",
    inputSchema: {
      type: "object",
      properties: { store_id: { type: "string" } },
      required: ["store_id"],
      additionalProperties: false,
    },
    handler: (userId, args) => deleteStore(userId, str(args, "store_id") ?? ""),
  },
  {
    name: "list_territories",
    description: "List map territories (metadata only, not polygon geometry).",
    inputSchema: {
      type: "object",
      properties: {
        workspace_id: workspaceIdProp,
        status: { type: "string", enum: ["active", "draft", "archived"] },
        limit: { type: "number" },
      },
      additionalProperties: false,
    },
    handler: (userId, args) =>
      listTerritories(userId, {
        workspace_id: str(args, "workspace_id"),
        status: str(args, "status"),
        limit: num(args, "limit"),
      }),
  },
];

export function listMcpToolDescriptors() {
  return MCP_TOOLS.map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
  }));
}

export async function callMcpTool(
  userId: string,
  name: string,
  args: Record<string, unknown> | undefined,
): Promise<{ ok: true; result: unknown } | { ok: false; error: string }> {
  const tool = MCP_TOOLS.find((item) => item.name === name);
  if (!tool) {
    return { ok: false, error: `Unknown tool: ${name}` };
  }
  try {
    const result = await tool.handler(userId, args ?? {});
    return { ok: true, result };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Tool failed.";
    return { ok: false, error: message };
  }
}
