import {
  McpToolError,
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
    name: "list_tasks",
    description: "List tasks in a workspace. Filter by status or title search.",
    inputSchema: {
      type: "object",
      properties: {
        workspace_id: workspaceIdProp,
        status: {
          type: "string",
          enum: ["backlog", "todo", "doing", "done"],
          description: "Optional status filter.",
        },
        query: { type: "string", description: "Case-insensitive title search." },
        limit: { type: "number", description: "Max rows (1-50, default 25)." },
      },
      additionalProperties: false,
    },
    handler: (userId, args) =>
      listTasks(userId, {
        workspace_id: str(args, "workspace_id"),
        status: str(args, "status"),
        query: str(args, "query"),
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
        status: { type: "string", enum: ["backlog", "todo", "doing", "done"] },
        priority: { type: "string", enum: ["P0", "P1", "P2", "P3"] },
        due_date: { type: "string", description: "YYYY-MM-DD or ISO date." },
        tags: { type: "array", items: { type: "string" } },
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
      }),
  },
  {
    name: "update_task",
    description: "Update a task's title, description, status, priority, due date, tags, or starred flag.",
    inputSchema: {
      type: "object",
      properties: {
        task_id: { type: "string" },
        title: { type: "string" },
        description: { type: "string" },
        status: { type: "string", enum: ["backlog", "todo", "doing", "done"] },
        priority: { type: "string", enum: ["P0", "P1", "P2", "P3"] },
        due_date: { type: "string", description: "YYYY-MM-DD, ISO date, or empty to clear." },
        tags: { type: "array", items: { type: "string" } },
        starred: { type: "boolean" },
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
    name: "list_notes",
    description: "List notes in a workspace (title and metadata, not full body).",
    inputSchema: {
      type: "object",
      properties: {
        workspace_id: workspaceIdProp,
        query: { type: "string", description: "Case-insensitive title search." },
        limit: { type: "number" },
      },
      additionalProperties: false,
    },
    handler: (userId, args) =>
      listNotes(userId, {
        workspace_id: str(args, "workspace_id"),
        query: str(args, "query"),
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
      }),
  },
  {
    name: "update_note",
    description: "Update a note's title, body, or tags. Replacing content overwrites the body.",
    inputSchema: {
      type: "object",
      properties: {
        note_id: { type: "string" },
        title: { type: "string" },
        content: { type: "string" },
        tags: { type: "array", items: { type: "string" } },
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
      }),
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
      },
      required: ["list_id", "text"],
      additionalProperties: false,
    },
    handler: (userId, args) =>
      addListItem(userId, {
        list_id: str(args, "list_id") ?? "",
        text: str(args, "text") ?? "",
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
      error instanceof McpToolError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Tool failed.";
    return { ok: false, error: message };
  }
}
