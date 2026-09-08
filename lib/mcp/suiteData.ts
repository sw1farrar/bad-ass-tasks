import "server-only";
import { geocodeAddress } from "@/lib/maps/geocode";
import { DEFAULT_NOTEBOOK_ENABLED_SECTIONS } from "@/lib/notebooks/notebookSections";
import { fromDbRole } from "@/lib/roles";
import type { HealthMetricType } from "@/types";
import {
  McpToolError,
  admin,
  clampLimit,
  getNote,
  listListItems,
  optionalUuid,
  requireId,
  requireWorkspaceMember,
  resolveWorkspace,
  updateNote,
} from "@/lib/mcp/data";

const LIST_COLORS = ["default", "purple", "pink", "green", "amber", "blue"] as const;
const MEETING_STATUSES = ["draft", "scheduled", "in_progress", "completed"] as const;
const AGENDA_STATUSES = ["open", "in_progress", "completed", "continued"] as const;
const FILE_RECORD_TYPES = ["note", "email", "document", "receipt", "other"] as const;
const FILE_REVIEW_STATUSES = ["pending_review", "filed"] as const;
const STORE_STATUSES = ["active", "inactive"] as const;
const HEALTH_METRICS: HealthMetricType[] = [
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
const HEALTH_UNITS: Record<HealthMetricType, string> = {
  weight: "lb",
  body_fat: "%",
  muscle_mass: "lb",
  waist: "in",
  blood_pressure_systolic: "mmHg",
  resting_hr: "bpm",
  sleep_hours: "hr",
  steps: "steps",
  active_minutes: "min",
  calories_burned: "kcal",
  stress: "/10",
};

function parseOne<T extends string>(
  value: string | undefined,
  allowed: readonly T[],
  label: string,
  fallback?: T,
): T {
  if (!value) {
    if (fallback !== undefined) return fallback;
    throw new McpToolError(`${label} is required.`);
  }
  if (!(allowed as readonly string[]).includes(value)) {
    throw new McpToolError(`${label} must be one of: ${allowed.join(", ")}`);
  }
  return value as T;
}

function requireText(value: string | undefined, label: string): string {
  const text = value?.trim() ?? "";
  if (!text) throw new McpToolError(`${label} is required.`);
  return text;
}

async function nextSortOrder(
  table: string,
  workspaceId: string,
  column = "sort_order",
): Promise<number> {
  const supabase = admin();
  const { data } = await (supabase.from(table) as any)
    .select(column)
    .eq("workspace_id", workspaceId)
    .order(column, { ascending: false })
    .limit(1);
  const current = Number((data?.[0] as Record<string, unknown> | undefined)?.[column] ?? -1000);
  return Number.isFinite(current) ? current + 1000 : 0;
}

export async function listMembers(userId: string, workspaceId?: string) {
  const workspace = await resolveWorkspace(userId, workspaceId);
  const supabase = admin();
  const { data: members, error } = await supabase
    .from("workspace_members")
    .select("user_id, role, joined_at")
    .eq("workspace_id", workspace.id);
  if (error) throw new McpToolError("Could not list members.");
  const rows = (members ?? []) as Array<{ user_id: string; role: string; joined_at?: string }>;
  const ids = rows.map((row) => row.user_id);
  const { data: profiles } = ids.length
    ? await supabase.from("profiles").select("id, full_name, username").in("id", ids)
    : { data: [] };
  const byId = new Map(
    ((profiles ?? []) as Array<{ id: string; full_name: string | null; username: string | null }>).map(
      (profile) => [profile.id, profile],
    ),
  );
  return {
    workspace: { id: workspace.id, name: workspace.name },
    members: rows.map((row) => {
      const profile = byId.get(row.user_id);
      return {
        user_id: row.user_id,
        role: fromDbRole(row.role),
        name: profile?.full_name ?? null,
        username: profile?.username ?? null,
        joined_at: row.joined_at ?? null,
      };
    }),
  };
}

export async function searchWorkspace(
  userId: string,
  input: { query: string; workspace_id?: string; limit?: number },
) {
  const q = requireText(input.query, "query");
  const workspace = await resolveWorkspace(userId, input.workspace_id);
  const limit = clampLimit(input.limit, 8, 20);
  const supabase = admin();
  const like = `%${q}%`;
  const [tasks, notes, lists, items, meetings, stores] = await Promise.all([
    supabase
      .from("tasks")
      .select("id, title, status, priority, due_date")
      .eq("workspace_id", workspace.id)
      .ilike("title", like)
      .limit(limit),
    supabase
      .from("notes")
      .select("id, title, notebook_id, record_type")
      .eq("workspace_id", workspace.id)
      .eq("is_archived", false)
      .ilike("title", like)
      .limit(limit),
    supabase
      .from("workspace_lists")
      .select("id, title, pinned")
      .eq("workspace_id", workspace.id)
      .eq("archived", false)
      .ilike("title", like)
      .limit(limit),
    supabase
      .from("list_items")
      .select("id, list_id, text, completed")
      .eq("workspace_id", workspace.id)
      .ilike("text", like)
      .limit(limit),
    supabase
      .from("meetings")
      .select("id, title, status, scheduled_at")
      .eq("workspace_id", workspace.id)
      .ilike("title", like)
      .limit(limit),
    supabase
      .from("map_stores")
      .select("id, name, city, status")
      .eq("workspace_id", workspace.id)
      .ilike("name", like)
      .limit(limit),
  ]);
  return {
    workspace: { id: workspace.id, name: workspace.name },
    query: q,
    tasks: tasks.data ?? [],
    notes: notes.data ?? [],
    lists: lists.data ?? [],
    list_items: items.data ?? [],
    meetings: meetings.error ? [] : (meetings.data ?? []),
    stores: stores.error ? [] : (stores.data ?? []),
  };
}

export async function listTaskFolders(userId: string, workspaceId?: string) {
  const workspace = await resolveWorkspace(userId, workspaceId);
  const supabase = admin();
  const { data, error } = await supabase
    .from("task_folders")
    .select("id, workspace_id, name, sort_order, created_at, updated_at")
    .eq("workspace_id", workspace.id)
    .order("sort_order", { ascending: true });
  if (error) throw new McpToolError("Could not list task folders.");
  return { workspace: { id: workspace.id, name: workspace.name }, folders: data ?? [] };
}

export async function createTaskFolder(
  userId: string,
  input: { name: string; workspace_id?: string },
) {
  const name = requireText(input.name, "name");
  const workspace = await resolveWorkspace(userId, input.workspace_id);
  const supabase = admin();
  const payload = {
    workspace_id: workspace.id,
    name,
    sort_order: await nextSortOrder("task_folders", workspace.id),
  };
  const { data, error } = await (supabase.from("task_folders") as any)
    .insert(payload)
    .select("*")
    .single();
  if (error || !data) throw new McpToolError("Could not create the folder.");
  return data;
}

export async function updateTaskFolder(
  userId: string,
  input: { folder_id: string; name?: string },
) {
  const id = requireId(input.folder_id, "folder_id");
  const supabase = admin();
  const { data: existing, error: lookupError } = await supabase
    .from("task_folders")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (lookupError) throw new McpToolError("Could not load that folder.");
  if (!existing) throw new McpToolError("Folder not found.");
  await requireWorkspaceMember(userId, String((existing as { workspace_id: string }).workspace_id));
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.name !== undefined) payload.name = requireText(input.name, "name");
  const { data, error } = await (supabase.from("task_folders") as any)
    .update(payload)
    .eq("id", id)
    .select("*")
    .single();
  if (error || !data) throw new McpToolError("Could not update the folder.");
  return data;
}

export async function deleteTaskFolder(userId: string, folderId: string) {
  const id = requireId(folderId, "folder_id");
  const supabase = admin();
  const { data: existing, error: lookupError } = await supabase
    .from("task_folders")
    .select("id, workspace_id, name")
    .eq("id", id)
    .maybeSingle();
  if (lookupError) throw new McpToolError("Could not load that folder.");
  if (!existing) throw new McpToolError("Folder not found.");
  const folder = existing as { id: string; workspace_id: string; name: string };
  await requireWorkspaceMember(userId, folder.workspace_id);
  const { error } = await supabase.from("task_folders").delete().eq("id", id);
  if (error) throw new McpToolError("Could not delete the folder.");
  return { deleted: true, id: folder.id, name: folder.name };
}

export async function deleteNote(userId: string, noteId: string) {
  const existing = await getNote(userId, noteId);
  const supabase = admin();
  const { error } = await supabase.from("notes").delete().eq("id", existing.id);
  if (error) throw new McpToolError("Could not delete the note.");
  return { deleted: true, id: existing.id, title: existing.title };
}

export async function archiveNote(userId: string, noteId: string, archived: boolean) {
  return updateNote(userId, { note_id: noteId, archived });
}

export async function listNotebooks(userId: string, workspaceId?: string) {
  const workspace = await resolveWorkspace(userId, workspaceId);
  const supabase = admin();
  const { data, error } = await supabase
    .from("notebooks")
    .select("id, workspace_id, name, sort_order, archived, created_at, updated_at")
    .eq("workspace_id", workspace.id)
    .eq("archived", false)
    .order("sort_order", { ascending: true });
  if (error) throw new McpToolError("Could not list notebooks.");
  return { workspace: { id: workspace.id, name: workspace.name }, notebooks: data ?? [] };
}

export async function createNotebook(
  userId: string,
  input: { name: string; workspace_id?: string },
) {
  const name = requireText(input.name, "name");
  const workspace = await resolveWorkspace(userId, input.workspace_id);
  const now = new Date().toISOString();
  const payload = {
    workspace_id: workspace.id,
    name,
    sort_order: await nextSortOrder("notebooks", workspace.id),
    enabled_sections: DEFAULT_NOTEBOOK_ENABLED_SECTIONS,
    archived: false,
    created_at: now,
    updated_at: now,
  };
  const supabase = admin();
  let { data, error } = await (supabase.from("notebooks") as any).insert(payload).select("*").single();
  if (error) {
    const fallback = {
      workspace_id: workspace.id,
      name,
      sort_order: payload.sort_order,
      created_at: now,
      updated_at: now,
    };
    const retry = await (supabase.from("notebooks") as any).insert(fallback).select("*").single();
    data = retry.data;
    error = retry.error;
  }
  if (error || !data) throw new McpToolError("Could not create the notebook.");
  return data;
}

export async function updateNotebook(
  userId: string,
  input: { notebook_id: string; name?: string; archived?: boolean },
) {
  const id = requireId(input.notebook_id, "notebook_id");
  const supabase = admin();
  const { data: existing, error: lookupError } = await supabase
    .from("notebooks")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (lookupError) throw new McpToolError("Could not load that notebook.");
  if (!existing) throw new McpToolError("Notebook not found.");
  await requireWorkspaceMember(userId, String((existing as { workspace_id: string }).workspace_id));
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.name !== undefined) payload.name = requireText(input.name, "name");
  if (input.archived !== undefined) payload.archived = input.archived;
  const { data, error } = await (supabase.from("notebooks") as any)
    .update(payload)
    .eq("id", id)
    .select("*")
    .single();
  if (error || !data) throw new McpToolError("Could not update the notebook.");
  return data;
}

export async function createList(
  userId: string,
  input: { title: string; workspace_id?: string; color?: string; pinned?: boolean },
) {
  const title = requireText(input.title, "title");
  const workspace = await resolveWorkspace(userId, input.workspace_id);
  const color = parseOne(input.color, LIST_COLORS, "color", "default");
  const supabase = admin();
  const payload = {
    workspace_id: workspace.id,
    title,
    color,
    pinned: input.pinned === true,
    archived: false,
    sort_order: await nextSortOrder("workspace_lists", workspace.id),
  };
  const { data, error } = await (supabase.from("workspace_lists") as any)
    .insert(payload)
    .select("id, workspace_id, title, color, pinned, archived, sort_order, updated_at")
    .single();
  if (error || !data) throw new McpToolError("Could not create the checklist.");
  return data;
}

export async function updateList(
  userId: string,
  input: {
    list_id: string;
    title?: string;
    color?: string;
    pinned?: boolean;
    archived?: boolean;
  },
) {
  const id = requireId(input.list_id, "list_id");
  const supabase = admin();
  const { data: existing, error: lookupError } = await supabase
    .from("workspace_lists")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (lookupError) throw new McpToolError("Could not load that checklist.");
  if (!existing) throw new McpToolError("List not found.");
  await requireWorkspaceMember(userId, String((existing as { workspace_id: string }).workspace_id));
  const payload: Record<string, unknown> = {};
  if (input.title !== undefined) payload.title = requireText(input.title, "title");
  if (input.color !== undefined) payload.color = parseOne(input.color, LIST_COLORS, "color");
  if (input.pinned !== undefined) payload.pinned = input.pinned;
  if (input.archived !== undefined) payload.archived = input.archived;
  if (Object.keys(payload).length === 0) return existing;
  const { data, error } = await (supabase.from("workspace_lists") as any)
    .update(payload)
    .eq("id", id)
    .select("id, workspace_id, title, color, pinned, archived, sort_order, updated_at")
    .single();
  if (error || !data) throw new McpToolError("Could not update the checklist.");
  return data;
}

export async function deleteList(userId: string, listId: string) {
  const list = await listListItems(userId, listId);
  const supabase = admin();
  await supabase.from("list_items").delete().eq("list_id", list.list.id);
  const { error } = await supabase.from("workspace_lists").delete().eq("id", list.list.id);
  if (error) throw new McpToolError("Could not delete the checklist.");
  return { deleted: true, id: list.list.id, title: list.list.title };
}

export async function updateListItem(
  userId: string,
  input: {
    item_id: string;
    text?: string;
    completed?: boolean;
    pending?: boolean;
    parent_item_id?: string | null;
  },
) {
  const id = requireId(input.item_id, "item_id");
  const supabase = admin();
  const { data: item, error: lookupError } = await supabase
    .from("list_items")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (lookupError) throw new McpToolError("Could not load that list item.");
  if (!item) throw new McpToolError("List item not found.");
  await requireWorkspaceMember(userId, String((item as { workspace_id: string }).workspace_id));
  const payload: Record<string, unknown> = {};
  if (input.text !== undefined) payload.text = requireText(input.text, "text");
  if (input.completed !== undefined) {
    payload.completed = input.completed;
    payload.completed_at = input.completed ? new Date().toISOString() : null;
  }
  if (input.pending !== undefined) payload.pending = input.pending;
  if (input.parent_item_id !== undefined) {
    payload.parent_item_id = optionalUuid(input.parent_item_id, "parent_item_id");
  }
  if (Object.keys(payload).length === 0) return item;
  let { data, error } = await (supabase.from("list_items") as any)
    .update(payload)
    .eq("id", id)
    .select("id, list_id, text, completed, pending, sort_order, parent_item_id")
    .single();
  if (error && (payload.pending !== undefined || payload.parent_item_id !== undefined)) {
    const fallback = { ...payload };
    delete fallback.pending;
    delete fallback.parent_item_id;
    const retry = await (supabase.from("list_items") as any)
      .update(fallback)
      .eq("id", id)
      .select("id, list_id, text, completed, sort_order")
      .single();
    data = retry.data;
    error = retry.error;
  }
  if (error || !data) throw new McpToolError("Could not update the list item.");
  return data;
}

export async function deleteListItem(userId: string, itemId: string) {
  const id = requireId(itemId, "item_id");
  const supabase = admin();
  const { data: item, error: lookupError } = await supabase
    .from("list_items")
    .select("id, workspace_id, text")
    .eq("id", id)
    .maybeSingle();
  if (lookupError) throw new McpToolError("Could not load that list item.");
  if (!item) throw new McpToolError("List item not found.");
  const row = item as { id: string; workspace_id: string; text: string };
  await requireWorkspaceMember(userId, row.workspace_id);
  const { error } = await supabase.from("list_items").delete().eq("id", id);
  if (error) throw new McpToolError("Could not delete the list item.");
  return { deleted: true, id: row.id, text: row.text };
}

function mapMeeting(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    workspace_id: String(row.workspace_id),
    title: String(row.title ?? ""),
    description: (row.description as string | null) ?? null,
    status: String(row.status ?? "draft"),
    scheduled_at: (row.scheduled_at as string | null) ?? null,
    started_at: (row.started_at as string | null) ?? null,
    completed_at: (row.completed_at as string | null) ?? null,
    notebook_id: row.notebook_id ? String(row.notebook_id) : null,
    attendee_ids: Array.isArray(row.attendee_ids) ? row.attendee_ids : [],
    attendees: Array.isArray(row.attendees) ? row.attendees : [],
    archived: Boolean(row.archived),
    created_at: row.created_at ? String(row.created_at) : "",
    updated_at: row.updated_at ? String(row.updated_at) : "",
  };
}

export async function listMeetings(
  userId: string,
  input: { workspace_id?: string; status?: string; limit?: number },
) {
  const workspace = await resolveWorkspace(userId, input.workspace_id);
  const supabase = admin();
  let query = supabase
    .from("meetings")
    .select(
      "id, workspace_id, title, description, status, scheduled_at, started_at, completed_at, notebook_id, attendee_ids, attendees, archived, created_at, updated_at",
    )
    .eq("workspace_id", workspace.id)
    .order("updated_at", { ascending: false })
    .limit(clampLimit(input.limit));
  if (input.status) query = query.eq("status", parseOne(input.status, MEETING_STATUSES, "status"));
  const { data, error } = await query;
  if (error) throw new McpToolError("Could not list meetings.");
  return {
    workspace: { id: workspace.id, name: workspace.name },
    meetings: (data ?? []).map((row) => mapMeeting(row as Record<string, unknown>)),
  };
}

export async function getMeeting(userId: string, meetingId: string) {
  const id = requireId(meetingId, "meeting_id");
  const supabase = admin();
  const { data, error } = await supabase.from("meetings").select("*").eq("id", id).maybeSingle();
  if (error) throw new McpToolError("Could not load that meeting.");
  if (!data) throw new McpToolError("Meeting not found.");
  const row = data as Record<string, unknown>;
  await requireWorkspaceMember(userId, String(row.workspace_id));
  const { data: items } = await supabase
    .from("meeting_agenda_items")
    .select(
      "id, meeting_id, title, description, status, sort_order, owner_name, reviewed, linked_task_ids, completed_at",
    )
    .eq("meeting_id", id)
    .order("sort_order", { ascending: true });
  const itemIds = ((items ?? []) as Array<{ id: string }>).map((item) => item.id);
  const { data: entries } = itemIds.length
    ? await supabase
        .from("meeting_agenda_entries")
        .select("id, agenda_item_id, body, is_decision, created_at")
        .in("agenda_item_id", itemIds)
        .order("created_at", { ascending: true })
        .limit(50)
    : { data: [] };
  return {
    meeting: mapMeeting(row),
    agenda_items: items ?? [],
    notes: entries ?? [],
  };
}

export async function createMeeting(
  userId: string,
  input: {
    title: string;
    workspace_id?: string;
    description?: string;
    status?: string;
    scheduled_at?: string;
    attendees?: string[];
    notebook_id?: string | null;
  },
) {
  const title = requireText(input.title, "title");
  const workspace = await resolveWorkspace(userId, input.workspace_id);
  const now = new Date().toISOString();
  const payload: Record<string, unknown> = {
    workspace_id: workspace.id,
    title,
    description: input.description?.trim() || null,
    status: parseOne(input.status, MEETING_STATUSES, "status", "draft"),
    scheduled_at: input.scheduled_at?.trim() || null,
    attendee_ids: [],
    attendees: input.attendees ?? [],
    notebook_id: optionalUuid(input.notebook_id ?? undefined, "notebook_id") ?? null,
    sort_order: await nextSortOrder("meetings", workspace.id),
    created_at: now,
    updated_at: now,
  };
  const supabase = admin();
  let { data, error } = await (supabase.from("meetings") as any).insert(payload).select("*").single();
  if (error && "attendees" in payload) {
    const { attendees: _attendees, ...fallback } = payload;
    const retry = await (supabase.from("meetings") as any).insert(fallback).select("*").single();
    data = retry.data;
    error = retry.error;
  }
  if (error || !data) throw new McpToolError("Could not create the meeting.");
  return mapMeeting(data as Record<string, unknown>);
}

export async function updateMeeting(
  userId: string,
  input: {
    meeting_id: string;
    title?: string;
    description?: string;
    status?: string;
    scheduled_at?: string | null;
    attendees?: string[];
    archived?: boolean;
  },
) {
  const existing = await getMeeting(userId, input.meeting_id);
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.title !== undefined) payload.title = requireText(input.title, "title");
  if (input.description !== undefined) payload.description = input.description;
  if (input.status !== undefined) {
    payload.status = parseOne(input.status, MEETING_STATUSES, "status");
    if (payload.status === "completed") payload.completed_at = new Date().toISOString();
    if (payload.status === "in_progress" && !existing.meeting.started_at) {
      payload.started_at = new Date().toISOString();
    }
  }
  if (input.scheduled_at !== undefined) payload.scheduled_at = input.scheduled_at?.trim() || null;
  if (input.attendees !== undefined) payload.attendees = input.attendees;
  if (input.archived !== undefined) payload.archived = input.archived;
  const supabase = admin();
  const { data, error } = await (supabase.from("meetings") as any)
    .update(payload)
    .eq("id", existing.meeting.id)
    .select("*")
    .single();
  if (error || !data) throw new McpToolError("Could not update the meeting.");
  return mapMeeting(data as Record<string, unknown>);
}

export async function deleteMeeting(userId: string, meetingId: string) {
  const existing = await getMeeting(userId, meetingId);
  const supabase = admin();
  const { error } = await supabase.from("meetings").delete().eq("id", existing.meeting.id);
  if (error) throw new McpToolError("Could not delete the meeting.");
  return { deleted: true, id: existing.meeting.id, title: existing.meeting.title };
}

export async function addAgendaItem(
  userId: string,
  input: { meeting_id: string; title: string; description?: string; owner_name?: string },
) {
  const meeting = await getMeeting(userId, input.meeting_id);
  const title = requireText(input.title, "title");
  const now = new Date().toISOString();
  const maxOrder = meeting.agenda_items.reduce((max, item) => {
    const order = Number((item as { sort_order?: number }).sort_order ?? 0);
    return Math.max(max, order);
  }, -1000);
  const payload = {
    meeting_id: meeting.meeting.id,
    title,
    description: input.description?.trim() || null,
    owner_name: input.owner_name?.trim() || null,
    status: "open",
    sort_order: maxOrder + 1000,
    linked_task_ids: [],
    created_at: now,
    updated_at: now,
  };
  const supabase = admin();
  const { data, error } = await (supabase.from("meeting_agenda_items") as any)
    .insert(payload)
    .select("*")
    .single();
  if (error || !data) throw new McpToolError("Could not add the agenda item.");
  return data;
}

export async function updateAgendaItem(
  userId: string,
  input: {
    item_id: string;
    title?: string;
    description?: string;
    status?: string;
    owner_name?: string | null;
    reviewed?: boolean;
  },
) {
  const id = requireId(input.item_id, "item_id");
  const supabase = admin();
  const { data: item, error: lookupError } = await supabase
    .from("meeting_agenda_items")
    .select("id, meeting_id")
    .eq("id", id)
    .maybeSingle();
  if (lookupError) throw new McpToolError("Could not load that agenda item.");
  if (!item) throw new McpToolError("Agenda item not found.");
  await getMeeting(userId, String((item as { meeting_id: string }).meeting_id));
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.title !== undefined) payload.title = requireText(input.title, "title");
  if (input.description !== undefined) payload.description = input.description;
  if (input.status !== undefined) {
    payload.status = parseOne(input.status, AGENDA_STATUSES, "status");
    if (payload.status === "completed") payload.completed_at = new Date().toISOString();
  }
  if (input.owner_name !== undefined) payload.owner_name = input.owner_name?.trim() || null;
  if (input.reviewed !== undefined) payload.reviewed = input.reviewed;
  const { data, error } = await (supabase.from("meeting_agenda_items") as any)
    .update(payload)
    .eq("id", id)
    .select("*")
    .single();
  if (error || !data) throw new McpToolError("Could not update the agenda item.");
  return data;
}

export async function addAgendaNote(
  userId: string,
  input: { item_id: string; body: string; is_decision?: boolean },
) {
  const id = requireId(input.item_id, "item_id");
  const body = requireText(input.body, "body");
  const supabase = admin();
  const { data: item, error: lookupError } = await supabase
    .from("meeting_agenda_items")
    .select("id, meeting_id")
    .eq("id", id)
    .maybeSingle();
  if (lookupError) throw new McpToolError("Could not load that agenda item.");
  if (!item) throw new McpToolError("Agenda item not found.");
  await getMeeting(userId, String((item as { meeting_id: string }).meeting_id));
  const payload = {
    agenda_item_id: id,
    body,
    author_id: userId,
    is_decision: input.is_decision === true,
    created_at: new Date().toISOString(),
  };
  const { data, error } = await (supabase.from("meeting_agenda_entries") as any)
    .insert(payload)
    .select("id, agenda_item_id, body, is_decision, created_at")
    .single();
  if (error || !data) throw new McpToolError("Could not add the agenda note.");
  return data;
}

export async function listHealthReadings(
  userId: string,
  input: { workspace_id?: string; metric_type?: string; limit?: number },
) {
  const workspace = await resolveWorkspace(userId, input.workspace_id);
  const supabase = admin();
  let query = supabase
    .from("health_readings")
    .select("id, workspace_id, user_id, metric_type, value, unit, recorded_at, note")
    .eq("workspace_id", workspace.id)
    .eq("user_id", userId)
    .order("recorded_at", { ascending: false })
    .limit(clampLimit(input.limit));
  if (input.metric_type) {
    query = query.eq("metric_type", parseOne(input.metric_type, HEALTH_METRICS, "metric_type"));
  }
  const { data, error } = await query;
  if (error) throw new McpToolError("Could not list health readings.");
  return { workspace: { id: workspace.id, name: workspace.name }, readings: data ?? [] };
}

export async function logHealthReading(
  userId: string,
  input: {
    metric_type: string;
    value: number;
    workspace_id?: string;
    unit?: string;
    recorded_at?: string;
    note?: string;
  },
) {
  const metric = parseOne(input.metric_type, HEALTH_METRICS, "metric_type");
  if (typeof input.value !== "number" || !Number.isFinite(input.value)) {
    throw new McpToolError("value must be a number.");
  }
  const workspace = await resolveWorkspace(userId, input.workspace_id);
  const payload = {
    workspace_id: workspace.id,
    user_id: userId,
    metric_type: metric,
    value: input.value,
    unit: input.unit?.trim() || HEALTH_UNITS[metric],
    recorded_at: input.recorded_at?.trim() || new Date().toISOString(),
    note: input.note?.trim() || null,
    metadata: { source: "grok" },
  };
  const supabase = admin();
  const { data, error } = await (supabase.from("health_readings") as any)
    .insert(payload)
    .select("id, workspace_id, user_id, metric_type, value, unit, recorded_at, note")
    .single();
  if (error || !data) throw new McpToolError("Could not log the health reading.");
  return data;
}

export async function deleteHealthReading(userId: string, readingId: string) {
  const id = requireId(readingId, "reading_id");
  const supabase = admin();
  const { data, error: lookupError } = await supabase
    .from("health_readings")
    .select("id, workspace_id, user_id, metric_type, value")
    .eq("id", id)
    .maybeSingle();
  if (lookupError) throw new McpToolError("Could not load that reading.");
  if (!data) throw new McpToolError("Health reading not found.");
  const row = data as {
    id: string;
    workspace_id: string;
    user_id: string;
    metric_type: string;
    value: number;
  };
  await requireWorkspaceMember(userId, row.workspace_id);
  if (row.user_id !== userId) throw new McpToolError("You can only delete your own health readings.");
  const { error } = await supabase.from("health_readings").delete().eq("id", id);
  if (error) throw new McpToolError("Could not delete the health reading.");
  return { deleted: true, id: row.id, metric_type: row.metric_type, value: row.value };
}

export async function listFiles(
  userId: string,
  input: {
    workspace_id?: string;
    query?: string;
    record_type?: string;
    review_status?: string;
    limit?: number;
  },
) {
  const workspace = await resolveWorkspace(userId, input.workspace_id);
  const supabase = admin();
  let query = supabase
    .from("notes")
    .select(
      "id, title, tags, record_type, review_status, bookmarked, created_at, updated_at, filed_at",
    )
    .eq("workspace_id", workspace.id)
    .is("notebook_id", null)
    .eq("is_archived", false)
    .order("updated_at", { ascending: false })
    .limit(clampLimit(input.limit));
  if (input.record_type) {
    query = query.eq("record_type", parseOne(input.record_type, FILE_RECORD_TYPES, "record_type"));
  }
  if (input.review_status) {
    query = query.eq(
      "review_status",
      parseOne(input.review_status, FILE_REVIEW_STATUSES, "review_status"),
    );
  }
  if (input.query?.trim()) query = query.ilike("title", `%${input.query.trim()}%`);
  const { data, error } = await query;
  if (error) throw new McpToolError("Could not list files.");
  return { workspace: { id: workspace.id, name: workspace.name }, files: data ?? [] };
}

const MAP_STORE_COLUMNS =
  "id, workspace_id, name, store_number, address, city, state, postal_code, country, latitude, longitude, mission_types, notes, status, created_at, updated_at";

export async function listStores(
  userId: string,
  input: { workspace_id?: string; query?: string; status?: string; limit?: number },
) {
  const workspace = await resolveWorkspace(userId, input.workspace_id);
  const supabase = admin();
  let query = supabase
    .from("map_stores")
    .select(MAP_STORE_COLUMNS)
    .eq("workspace_id", workspace.id)
    .order("name", { ascending: true })
    .limit(clampLimit(input.limit, 25, 50));
  if (input.status) query = query.eq("status", parseOne(input.status, STORE_STATUSES, "status"));
  if (input.query?.trim()) query = query.ilike("name", `%${input.query.trim()}%`);
  const { data, error } = await query;
  if (error) throw new McpToolError("Could not list stores.");
  return { workspace: { id: workspace.id, name: workspace.name }, stores: data ?? [] };
}

async function maybeGeocode(input: {
  address?: string;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  country?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}) {
  if (input.latitude != null && input.longitude != null) {
    return { latitude: input.latitude, longitude: input.longitude };
  }
  const address = [input.address, input.city, input.state, input.postal_code, input.country]
    .filter(Boolean)
    .join(", ");
  if (!address) return { latitude: null, longitude: null };
  try {
    const geo = await geocodeAddress(address);
    return geo
      ? { latitude: geo.latitude, longitude: geo.longitude }
      : { latitude: null, longitude: null };
  } catch {
    return { latitude: null, longitude: null };
  }
}

export async function createStore(
  userId: string,
  input: {
    name: string;
    address: string;
    workspace_id?: string;
    store_number?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    country?: string;
    notes?: string;
    status?: string;
    latitude?: number;
    longitude?: number;
  },
) {
  const name = requireText(input.name, "name");
  const address = requireText(input.address, "address");
  const workspace = await resolveWorkspace(userId, input.workspace_id);
  const geo = await maybeGeocode({
    address,
    city: input.city,
    state: input.state,
    postal_code: input.postal_code,
    country: input.country,
    latitude: input.latitude,
    longitude: input.longitude,
  });
  const payload = {
    workspace_id: workspace.id,
    name,
    address,
    store_number: input.store_number?.trim() || null,
    city: input.city?.trim() || null,
    state: input.state?.trim() || null,
    postal_code: input.postal_code?.trim() || null,
    country: input.country?.trim() || null,
    notes: input.notes?.trim() || null,
    status: parseOne(input.status, STORE_STATUSES, "status", "active"),
    mission_types: [] as string[],
    latitude: geo.latitude,
    longitude: geo.longitude,
    created_by: userId,
    updated_by: userId,
  };
  const supabase = admin();
  const { data, error } = await (supabase.from("map_stores") as any)
    .insert(payload)
    .select(MAP_STORE_COLUMNS)
    .single();
  if (error || !data) throw new McpToolError("Could not create the store.");
  return data;
}

export async function updateStore(
  userId: string,
  input: {
    store_id: string;
    name?: string;
    address?: string;
    store_number?: string | null;
    city?: string | null;
    state?: string | null;
    postal_code?: string | null;
    country?: string | null;
    notes?: string | null;
    status?: string;
    latitude?: number | null;
    longitude?: number | null;
  },
) {
  const id = requireId(input.store_id, "store_id");
  const supabase = admin();
  const { data: existing, error: lookupError } = await supabase
    .from("map_stores")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (lookupError) throw new McpToolError("Could not load that store.");
  if (!existing) throw new McpToolError("Store not found.");
  const row = existing as Record<string, unknown>;
  await requireWorkspaceMember(userId, String(row.workspace_id));
  const payload: Record<string, unknown> = { updated_by: userId, updated_at: new Date().toISOString() };
  if (input.name !== undefined) payload.name = requireText(input.name, "name");
  if (input.address !== undefined) payload.address = requireText(input.address, "address");
  if (input.store_number !== undefined) payload.store_number = input.store_number?.trim() || null;
  if (input.city !== undefined) payload.city = input.city?.trim() || null;
  if (input.state !== undefined) payload.state = input.state?.trim() || null;
  if (input.postal_code !== undefined) payload.postal_code = input.postal_code?.trim() || null;
  if (input.country !== undefined) payload.country = input.country?.trim() || null;
  if (input.notes !== undefined) payload.notes = input.notes?.trim() || null;
  if (input.status !== undefined) payload.status = parseOne(input.status, STORE_STATUSES, "status");
  if (input.latitude !== undefined) payload.latitude = input.latitude;
  if (input.longitude !== undefined) payload.longitude = input.longitude;
  const { data, error } = await (supabase.from("map_stores") as any)
    .update(payload)
    .eq("id", id)
    .select(MAP_STORE_COLUMNS)
    .single();
  if (error || !data) throw new McpToolError("Could not update the store.");
  return data;
}

export async function deleteStore(userId: string, storeId: string) {
  const id = requireId(storeId, "store_id");
  const supabase = admin();
  const { data: existing, error: lookupError } = await supabase
    .from("map_stores")
    .select("id, workspace_id, name")
    .eq("id", id)
    .maybeSingle();
  if (lookupError) throw new McpToolError("Could not load that store.");
  if (!existing) throw new McpToolError("Store not found.");
  const row = existing as { id: string; workspace_id: string; name: string };
  await requireWorkspaceMember(userId, row.workspace_id);
  const { error } = await supabase.from("map_stores").delete().eq("id", id);
  if (error) throw new McpToolError("Could not delete the store.");
  return { deleted: true, id: row.id, name: row.name };
}

export async function listTerritories(
  userId: string,
  input: { workspace_id?: string; status?: string; limit?: number },
) {
  const workspace = await resolveWorkspace(userId, input.workspace_id);
  const supabase = admin();
  let query = supabase
    .from("map_territories")
    .select(
      "id, workspace_id, name, territory_type, color, notes, status, assigned_person, created_at, updated_at",
    )
    .eq("workspace_id", workspace.id)
    .order("name", { ascending: true })
    .limit(clampLimit(input.limit, 25, 50));
  if (input.status) {
    query = query.eq("status", parseOne(input.status, ["active", "draft", "archived"] as const, "status"));
  }
  const { data, error } = await query;
  if (error) throw new McpToolError("Could not list territories.");
  return { workspace: { id: workspace.id, name: workspace.name }, territories: data ?? [] };
}

export async function listNotebookTasks(
  userId: string,
  input: { notebook_id: string; limit?: number },
) {
  const notebookId = requireId(input.notebook_id, "notebook_id");
  const supabase = admin();
  const { data: notebook, error: lookupError } = await supabase
    .from("notebooks")
    .select("id, workspace_id, name")
    .eq("id", notebookId)
    .maybeSingle();
  if (lookupError) throw new McpToolError("Could not load that notebook.");
  if (!notebook) throw new McpToolError("Notebook not found.");
  const nb = notebook as { id: string; workspace_id: string; name: string };
  await requireWorkspaceMember(userId, nb.workspace_id);
  const { data, error } = await supabase
    .from("notebook_tasks")
    .select(
      "id, notebook_id, workspace_id, title, completed, sort_order, show_on_workspace, completed_at, created_at",
    )
    .eq("notebook_id", notebookId)
    .order("sort_order", { ascending: true })
    .limit(clampLimit(input.limit, 50, 100));
  if (error) throw new McpToolError("Could not list notebook tasks.");
  return { notebook: { id: nb.id, name: nb.name }, tasks: data ?? [] };
}

export async function addNotebookTask(
  userId: string,
  input: { notebook_id: string; title: string; show_on_workspace?: boolean },
) {
  const existing = await listNotebookTasks(userId, { notebook_id: input.notebook_id });
  const title = requireText(input.title, "title");
  const now = new Date().toISOString();
  const maxOrder = existing.tasks.reduce((max, task) => {
    const order = Number((task as { sort_order?: number }).sort_order ?? 0);
    return Math.max(max, order);
  }, -1000);
  const supabase = admin();
  const notebook = await supabase
    .from("notebooks")
    .select("workspace_id")
    .eq("id", existing.notebook.id)
    .maybeSingle();
  const workspaceId = String((notebook.data as { workspace_id: string } | null)?.workspace_id ?? "");
  const payload = {
    notebook_id: existing.notebook.id,
    workspace_id: workspaceId,
    title,
    completed: false,
    sort_order: maxOrder + 1000,
    show_on_workspace: input.show_on_workspace === true,
    created_at: now,
    updated_at: now,
  };
  const { data, error } = await (supabase.from("notebook_tasks") as any)
    .insert(payload)
    .select("*")
    .single();
  if (error || !data) throw new McpToolError("Could not add the notebook task.");
  return data;
}

export async function completeNotebookTask(userId: string, taskId: string, completed: boolean) {
  const id = requireId(taskId, "task_id");
  const supabase = admin();
  const { data: task, error: lookupError } = await supabase
    .from("notebook_tasks")
    .select("id, workspace_id, title, completed")
    .eq("id", id)
    .maybeSingle();
  if (lookupError) throw new McpToolError("Could not load that notebook task.");
  if (!task) throw new McpToolError("Notebook task not found.");
  await requireWorkspaceMember(userId, String((task as { workspace_id: string }).workspace_id));
  const { data, error } = await (supabase.from("notebook_tasks") as any)
    .update({
      completed,
      completed_at: completed ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single();
  if (error || !data) throw new McpToolError("Could not update the notebook task.");
  return data;
}

export async function deleteNotebookTask(userId: string, taskId: string) {
  const id = requireId(taskId, "task_id");
  const supabase = admin();
  const { data: task, error: lookupError } = await supabase
    .from("notebook_tasks")
    .select("id, workspace_id, title")
    .eq("id", id)
    .maybeSingle();
  if (lookupError) throw new McpToolError("Could not load that notebook task.");
  if (!task) throw new McpToolError("Notebook task not found.");
  const row = task as { id: string; workspace_id: string; title: string };
  await requireWorkspaceMember(userId, row.workspace_id);
  const { error } = await supabase.from("notebook_tasks").delete().eq("id", id);
  if (error) throw new McpToolError("Could not delete the notebook task.");
  return { deleted: true, id: row.id, title: row.title };
}
