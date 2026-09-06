import "server-only";
import { createAdminSupabaseClient, isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { fromDbRole, type WorkspaceRole } from "@/lib/roles";
import { extractNoteSearchText } from "@/lib/notes/extractNoteSearchText";
import { buildSearchDocument } from "@/lib/files/buildSearchDocument";
import type { Priority, TaskStatus } from "@/types";

export class McpToolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "McpToolError";
  }
}

export type McpWorkspace = {
  id: string;
  name: string;
  slug: string;
  role: WorkspaceRole;
  createdAt: string;
};

export type McpWhoami = {
  userId: string;
  email: string | null;
  name: string | null;
  username: string | null;
};

const TASK_STATUSES: TaskStatus[] = ["backlog", "todo", "doing", "done"];
const PRIORITIES: Priority[] = ["P0", "P1", "P2", "P3"];

function admin() {
  if (!isSupabaseAdminConfigured()) {
    throw new McpToolError("Badazz Tasks is not connected to live data.");
  }
  return createAdminSupabaseClient();
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function clampLimit(limit: number | undefined, fallback = 25, max = 50): number {
  if (typeof limit !== "number" || !Number.isFinite(limit)) return fallback;
  return Math.min(max, Math.max(1, Math.floor(limit)));
}

function requireId(value: string | undefined, label: string): string {
  const id = value?.trim() ?? "";
  if (!isUuid(id)) {
    throw new McpToolError(`${label} must be a valid id.`);
  }
  return id;
}

function parseStatus(value: string | undefined, fallback: TaskStatus): TaskStatus {
  if (!value) return fallback;
  if (!TASK_STATUSES.includes(value as TaskStatus)) {
    throw new McpToolError(`status must be one of: ${TASK_STATUSES.join(", ")}`);
  }
  return value as TaskStatus;
}

function parsePriority(value: string | undefined, fallback: Priority): Priority {
  if (!value) return fallback;
  const normalized = value.toUpperCase() as Priority;
  if (!PRIORITIES.includes(normalized)) {
    throw new McpToolError(`priority must be one of: ${PRIORITIES.join(", ")}`);
  }
  return normalized;
}

function normalizeDueDate(value: string | undefined | null): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value.trim() === "") return null;
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    throw new McpToolError("due_date must be YYYY-MM-DD or an ISO date.");
  }
  return parsed.toISOString().slice(0, 10);
}

function normalizeTags(tags: string[] | undefined, extra?: string): string[] {
  const list = [...(tags ?? []), extra].filter((tag): tag is string => Boolean(tag?.trim()));
  return [...new Set(list.map((tag) => tag.trim()))];
}

function plainToTipTap(text: string) {
  const trimmed = text.trim();
  if (!trimmed) {
    return { type: "doc", content: [{ type: "paragraph" }] };
  }
  const paragraphs = trimmed.split(/\n{2,}/);
  return {
    type: "doc",
    content: paragraphs.map((paragraph) => ({
      type: "paragraph",
      content: paragraph
        .split("\n")
        .flatMap((line, index, lines) => {
          const node = { type: "text", text: line };
          if (index < lines.length - 1) {
            return [node, { type: "hardBreak" }];
          }
          return [node];
        }),
    })),
  };
}

function noteBodyToText(content: unknown): string {
  if (content == null) return "";
  if (typeof content === "string") {
    const trimmed = content.trim();
    if (!trimmed) return "";
    if (trimmed.startsWith("{")) {
      try {
        return extractNoteSearchText(JSON.parse(trimmed));
      } catch {
        return trimmed;
      }
    }
    return trimmed;
  }
  if (typeof content === "object") {
    return extractNoteSearchText(content);
  }
  return String(content);
}

export async function getWhoami(userId: string): Promise<McpWhoami> {
  const supabase = admin();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, full_name, username, access_paused")
    .eq("id", userId)
    .maybeSingle();
  if (error) {
    throw new McpToolError("Could not load your profile.");
  }
  if ((data as { access_paused?: boolean } | null)?.access_paused) {
    throw new McpToolError("This account is paused.");
  }
  return {
    userId,
    email: (data as { email?: string | null } | null)?.email ?? null,
    name: (data as { full_name?: string | null } | null)?.full_name ?? null,
    username: (data as { username?: string | null } | null)?.username ?? null,
  };
}

export async function listWorkspaces(userId: string): Promise<McpWorkspace[]> {
  const supabase = admin();
  const { data: members, error: memberError } = await supabase
    .from("workspace_members")
    .select("workspace_id, role")
    .eq("user_id", userId);
  if (memberError) {
    throw new McpToolError("Could not load workspaces.");
  }
  const rows = (members ?? []) as Array<{ workspace_id: string; role: string }>;
  if (rows.length === 0) return [];

  const { data: spaces, error: spaceError } = await supabase
    .from("workspaces")
    .select("id, name, slug, created_at")
    .in(
      "id",
      rows.map((row) => row.workspace_id),
    );
  if (spaceError) {
    throw new McpToolError("Could not load workspaces.");
  }

  const byId = new Map(
    ((spaces ?? []) as Array<{ id: string; name: string; slug: string; created_at: string }>).map(
      (space) => [space.id, space],
    ),
  );
  return rows
    .map((row) => {
      const space = byId.get(row.workspace_id);
      if (!space) return null;
      return {
        id: space.id,
        name: space.name,
        slug: space.slug,
        role: fromDbRole(row.role),
        createdAt: space.created_at,
      } satisfies McpWorkspace;
    })
    .filter((row): row is McpWorkspace => row !== null)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function resolveWorkspace(
  userId: string,
  workspaceId?: string | null,
): Promise<McpWorkspace> {
  const workspaces = await listWorkspaces(userId);
  if (workspaces.length === 0) {
    throw new McpToolError("You are not a member of any workspace.");
  }
  if (workspaceId?.trim()) {
    const id = requireId(workspaceId, "workspace_id");
    const match = workspaces.find((space) => space.id === id);
    if (!match) {
      throw new McpToolError("You do not have access to that workspace.");
    }
    return match;
  }
  const owned = workspaces.filter((space) => space.role === "owner");
  return (owned[0] ?? workspaces[0]) as McpWorkspace;
}

async function requireWorkspaceMember(userId: string, workspaceId: string): Promise<McpWorkspace> {
  return resolveWorkspace(userId, workspaceId);
}

function mapTask(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    workspace_id: String(row.workspace_id),
    title: String(row.title ?? ""),
    description: typeof row.description === "string" ? row.description : "",
    status: String(row.status ?? "todo"),
    priority: String(row.priority ?? "P2"),
    due_date: (row.due_date as string | null) ?? null,
    tags: Array.isArray(row.tags) ? row.tags : [],
    starred: Boolean(row.starred),
    created_at: row.created_at ? String(row.created_at) : "",
    updated_at: row.updated_at ? String(row.updated_at) : null,
    completed_at: row.completed_at ? String(row.completed_at) : null,
  };
}

export async function listTasks(
  userId: string,
  input: {
    workspace_id?: string;
    status?: string;
    query?: string;
    limit?: number;
  },
) {
  const workspace = await resolveWorkspace(userId, input.workspace_id);
  const supabase = admin();
  let query = supabase
    .from("tasks")
    .select(
      "id, workspace_id, title, description, status, priority, due_date, tags, created_at, updated_at, completed_at",
    )
    .eq("workspace_id", workspace.id)
    .order("created_at", { ascending: false })
    .limit(clampLimit(input.limit));

  if (input.status) {
    query = query.eq("status", parseStatus(input.status, "todo"));
  }
  if (input.query?.trim()) {
    query = query.ilike("title", `%${input.query.trim()}%`);
  }

  const { data, error } = await query;
  if (error) throw new McpToolError("Could not list tasks.");
  return {
    workspace: { id: workspace.id, name: workspace.name },
    tasks: (data ?? []).map((row) => mapTask(row as Record<string, unknown>)),
  };
}

export async function getTask(userId: string, taskId: string) {
  const id = requireId(taskId, "task_id");
  const supabase = admin();
  const { data, error } = await supabase.from("tasks").select("*").eq("id", id).maybeSingle();
  if (error) throw new McpToolError("Could not load that task.");
  if (!data) throw new McpToolError("Task not found.");
  const row = data as Record<string, unknown>;
  await requireWorkspaceMember(userId, String(row.workspace_id));
  return mapTask(row);
}

export async function createTask(
  userId: string,
  input: {
    title: string;
    workspace_id?: string;
    description?: string;
    status?: string;
    priority?: string;
    due_date?: string;
    tags?: string[];
  },
) {
  const title = input.title?.trim();
  if (!title) throw new McpToolError("title is required.");
  const workspace = await resolveWorkspace(userId, input.workspace_id);
  const supabase = admin();
  const payload = {
    workspace_id: workspace.id,
    title,
    description: input.description?.trim() || null,
    status: parseStatus(input.status, "todo"),
    priority: parsePriority(input.priority, "P2"),
    due_date: normalizeDueDate(input.due_date) ?? null,
    tags: normalizeTags(input.tags, "from-grok"),
    linked_note_ids: [] as string[],
    assignee_ids: [] as string[],
    created_by: userId,
  };
  const { data, error } = await (supabase.from("tasks") as any).insert(payload).select("*").single();
  if (error || !data) {
    throw new McpToolError("Could not create the task.");
  }
  return mapTask(data as Record<string, unknown>);
}

export async function updateTask(
  userId: string,
  input: {
    task_id: string;
    title?: string;
    description?: string;
    status?: string;
    priority?: string;
    due_date?: string | null;
    tags?: string[];
    starred?: boolean;
  },
) {
  const existing = await getTask(userId, input.task_id);
  const payload: Record<string, unknown> = {};
  if (input.title !== undefined) {
    const title = input.title.trim();
    if (!title) throw new McpToolError("title cannot be empty.");
    payload.title = title;
  }
  if (input.description !== undefined) payload.description = input.description;
  if (input.status !== undefined) {
    payload.status = parseStatus(input.status, existing.status as TaskStatus);
    if (payload.status === "done" && existing.status !== "done") {
      payload.completed_at = new Date().toISOString();
    }
    if (payload.status !== "done") payload.completed_at = null;
  }
  if (input.priority !== undefined) payload.priority = parsePriority(input.priority, "P2");
  if (input.due_date !== undefined) payload.due_date = normalizeDueDate(input.due_date);
  if (input.tags !== undefined) payload.tags = normalizeTags(input.tags);
  if (input.starred !== undefined) payload.starred = input.starred;

  if (Object.keys(payload).length === 0) return existing;

  const supabase = admin();
  const { data, error } = await (supabase.from("tasks") as any)
    .update(payload)
    .eq("id", existing.id)
    .select("*")
    .single();
  if (error || !data) throw new McpToolError("Could not update the task.");
  return mapTask(data as Record<string, unknown>);
}

export async function completeTask(userId: string, taskId: string) {
  return updateTask(userId, { task_id: taskId, status: "done" });
}

export async function deleteTask(userId: string, taskId: string) {
  const existing = await getTask(userId, taskId);
  const supabase = admin();
  const { error } = await supabase.from("tasks").delete().eq("id", existing.id);
  if (error) throw new McpToolError("Could not delete the task.");
  return { deleted: true, id: existing.id, title: existing.title };
}

function mapNote(row: Record<string, unknown>, includeBody: boolean) {
  const content = includeBody ? noteBodyToText(row.content) : undefined;
  return {
    id: String(row.id),
    workspace_id: String(row.workspace_id),
    title: String(row.title ?? ""),
    tags: Array.isArray(row.tags) ? row.tags : [],
    updated_at: row.updated_at ? String(row.updated_at) : "",
    created_at: row.created_at ? String(row.created_at) : "",
    notebook_id: row.notebook_id ? String(row.notebook_id) : null,
    ...(includeBody ? { content: content?.slice(0, 8000) ?? "" } : {}),
  };
}

export async function listNotes(
  userId: string,
  input: { workspace_id?: string; query?: string; limit?: number },
) {
  const workspace = await resolveWorkspace(userId, input.workspace_id);
  const supabase = admin();
  let query = supabase
    .from("notes")
    .select("id, workspace_id, title, tags, created_at, updated_at, notebook_id, is_archived")
    .eq("workspace_id", workspace.id)
    .eq("is_archived", false)
    .order("updated_at", { ascending: false })
    .limit(clampLimit(input.limit));
  if (input.query?.trim()) {
    query = query.ilike("title", `%${input.query.trim()}%`);
  }
  const { data, error } = await query;
  if (error) throw new McpToolError("Could not list notes.");
  return {
    workspace: { id: workspace.id, name: workspace.name },
    notes: (data ?? []).map((row) => mapNote(row as Record<string, unknown>, false)),
  };
}

export async function getNote(userId: string, noteId: string) {
  const id = requireId(noteId, "note_id");
  const supabase = admin();
  const { data, error } = await supabase.from("notes").select("*").eq("id", id).maybeSingle();
  if (error) throw new McpToolError("Could not load that note.");
  if (!data) throw new McpToolError("Note not found.");
  const row = data as Record<string, unknown>;
  await requireWorkspaceMember(userId, String(row.workspace_id));
  return mapNote(row, true);
}

export async function createNote(
  userId: string,
  input: { title: string; content?: string; workspace_id?: string; tags?: string[] },
) {
  const title = input.title?.trim();
  if (!title) throw new McpToolError("title is required.");
  const workspace = await resolveWorkspace(userId, input.workspace_id);
  const contentText = input.content?.trim() ?? "";
  const contentJson = plainToTipTap(contentText);
  const tags = normalizeTags(input.tags, "from-grok");
  const searchPlain = [title, contentText].filter(Boolean).join(" ");
  const supabase = admin();
  const payload: Record<string, unknown> = {
    workspace_id: workspace.id,
    title,
    content: contentJson,
    tags,
    is_archived: false,
    created_by: userId,
    review_status: "filed",
    record_type: "note",
    filed_at: new Date().toISOString(),
    search_plain: searchPlain,
    search_document: buildSearchDocument({ title, content: contentText, tags }),
  };
  let { data, error } = await (supabase.from("notes") as any).insert(payload).select("*").single();
  if (error) {
    const fallback = {
      workspace_id: workspace.id,
      title,
      content: contentJson,
      tags,
      is_archived: false,
      created_by: userId,
    };
    const retry = await (supabase.from("notes") as any).insert(fallback).select("*").single();
    data = retry.data;
    error = retry.error;
  }
  if (error || !data) throw new McpToolError("Could not create the note.");
  return mapNote(data as Record<string, unknown>, true);
}

export async function updateNote(
  userId: string,
  input: { note_id: string; title?: string; content?: string; tags?: string[] },
) {
  const existing = await getNote(userId, input.note_id);
  const payload: Record<string, unknown> = {};
  if (input.title !== undefined) {
    const title = input.title.trim();
    if (!title) throw new McpToolError("title cannot be empty.");
    payload.title = title;
  }
  if (input.content !== undefined) {
    payload.content = plainToTipTap(input.content);
    payload.search_plain = [payload.title ?? existing.title, input.content].join(" ");
  }
  if (input.tags !== undefined) payload.tags = normalizeTags(input.tags);
  if (Object.keys(payload).length === 0) return existing;

  const supabase = admin();
  const { data, error } = await (supabase.from("notes") as any)
    .update(payload)
    .eq("id", existing.id)
    .select("*")
    .single();
  if (error || !data) throw new McpToolError("Could not update the note.");
  return mapNote(data as Record<string, unknown>, true);
}

export async function listLists(userId: string, workspaceId?: string) {
  const workspace = await resolveWorkspace(userId, workspaceId);
  const supabase = admin();
  const { data, error } = await supabase
    .from("workspace_lists")
    .select("id, workspace_id, title, archived, pinned, updated_at")
    .eq("workspace_id", workspace.id)
    .eq("archived", false)
    .order("sort_order", { ascending: true });
  if (error) throw new McpToolError("Could not list checklists.");
  return {
    workspace: { id: workspace.id, name: workspace.name },
    lists: data ?? [],
  };
}

export async function listListItems(userId: string, listId: string) {
  const id = requireId(listId, "list_id");
  const supabase = admin();
  const { data: list, error: listError } = await supabase
    .from("workspace_lists")
    .select("id, workspace_id, title")
    .eq("id", id)
    .maybeSingle();
  if (listError) throw new McpToolError("Could not load that list.");
  if (!list) throw new McpToolError("List not found.");
  const workspace = await requireWorkspaceMember(userId, String((list as { workspace_id: string }).workspace_id));
  const { data, error } = await supabase
    .from("list_items")
    .select("id, list_id, text, completed, sort_order, parent_item_id")
    .eq("list_id", id)
    .eq("workspace_id", workspace.id)
    .order("sort_order", { ascending: true });
  if (error) throw new McpToolError("Could not load list items.");
  return {
    list: { id: (list as { id: string }).id, title: (list as { title: string }).title, workspace_id: workspace.id },
    items: data ?? [],
  };
}

export async function addListItem(
  userId: string,
  input: { list_id: string; text: string },
) {
  const text = input.text?.trim();
  if (!text) throw new McpToolError("text is required.");
  const list = await listListItems(userId, input.list_id);
  const supabase = admin();
  const nextOrder = list.items.length;
  const { data, error } = await (supabase.from("list_items") as any)
    .insert({
      list_id: list.list.id,
      workspace_id: list.list.workspace_id,
      text,
      sort_order: nextOrder,
      completed: false,
    })
    .select("id, list_id, text, completed, sort_order")
    .single();
  if (error || !data) throw new McpToolError("Could not add the list item.");
  return data;
}

export async function setListItemCompleted(userId: string, itemId: string, completed: boolean) {
  const id = requireId(itemId, "item_id");
  const supabase = admin();
  const { data: item, error: lookupError } = await supabase
    .from("list_items")
    .select("id, workspace_id, text, completed")
    .eq("id", id)
    .maybeSingle();
  if (lookupError) throw new McpToolError("Could not load that list item.");
  if (!item) throw new McpToolError("List item not found.");
  await requireWorkspaceMember(userId, String((item as { workspace_id: string }).workspace_id));
  const { data, error } = await (supabase.from("list_items") as any)
    .update({
      completed,
      completed_at: completed ? new Date().toISOString() : null,
    })
    .eq("id", id)
    .select("id, list_id, text, completed")
    .single();
  if (error || !data) throw new McpToolError("Could not update the list item.");
  return data;
}
