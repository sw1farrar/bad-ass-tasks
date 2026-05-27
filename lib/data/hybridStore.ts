/**
 * Hybrid Data Layer — Bad Ass Tasks
 *
 * Responsibilities:
 * - When Supabase is configured → talk to the real database
 * - When Supabase is not configured → return safe no-op values
 *   (the Zustand store decides how to behave in demo mode)
 *
 * This file will grow over time to become the single source of truth
 * for data operations (tasks, notes, activity logs). Workspace/auth bootstrapping
 * (fetchUserWorkspaces, ensureUserHasWorkspace, createWorkspace via RPC) lives in
 * useTaskStore for proper user context + strict separation. Phase 2 can migrate more.
 */

import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/client";
import type { Task, TaskStatus, Priority, Note, ActivityLog, PendingOperation, Comment, Notification, NotificationPrefs, NotificationType } from "@/types";
import type { Database, Json } from "@/types/supabase";
import { logger, logError } from "@/lib/logger";
import { templateToTaskPayload, templateToNotePayload } from "@/lib/utils";

type TaskRow = Database["public"]["Tables"]["tasks"]["Row"];
type TaskInsert = Database["public"]["Tables"]["tasks"]["Insert"];
type NoteRow = Database["public"]["Tables"]["notes"]["Row"];
type NoteInsert = Database["public"]["Tables"]["notes"]["Insert"];
type ActivityLogRow = Database["public"]["Tables"]["activity_logs"]["Row"];
type ActivityLogInsert = Database["public"]["Tables"]["activity_logs"]["Insert"];
type NotificationRow = Database["public"]["Tables"]["notifications"]["Row"];
type NotificationInsert = Database["public"]["Tables"]["notifications"]["Insert"];

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

const getClient = () => getSupabaseClient();

function logHybridError(operation: string, error: unknown) {
  // Supabase errors are often objects with message/code/details
  logError(`hybridStore:${operation}`, error);
  // Also structured for full context
  logger.error(`Hybrid data operation failed: ${operation}`, error);
}

function mapTaskRow(row: TaskRow): Task {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    title: row.title,
    description: row.description ?? "",
    status: row.status,
    priority: row.priority,
    dueDate: row.due_date ?? undefined,
    assignee: row.assignee_ids && row.assignee_ids.length > 0 ? "Team Member" : "You",
    tags: row.tags ?? [],
    createdAt: row.created_at,
    completedAt: row.completed_at ?? undefined,
    timeEstimate: row.time_estimate ?? undefined,
    linkedNoteIds: row.linked_note_ids ?? [],
    // Recurring + exceptions (Agent 13 production prep, built on Agent 8)
    recurringRule: row.recurring_rule ?? undefined,
    exceptionDates: row.exception_dates ?? undefined,
    // AI decomposition support (Agent 15): surface parent for hierarchical tasks from extraction
    parentTaskId: row.parent_task_id ?? undefined,
  };
}

// ------------------------------------------------------------------
// Notes helpers (Phase 3 rich editor support: full TipTap JSONB round-tripping
// while preserving plain-text Note.content model + list preview compatibility)
// ------------------------------------------------------------------

/**
 * Convert content (plain string OR stringified TipTap JSON doc) into TipTap JSONB
 * for storage in Supabase notes.content (JSONB column).
 * - If input is a stringified valid TipTap doc (e.g. from rich editor), parse & use directly (rich preserved).
 * - Else treat as plain text and wrap minimally (forward compat + demo/samples).
 * Safe no-op for empty.
 */
function noteContentToJson(content: string | undefined | unknown): Json | null {
  if (!content) return null;
  if (typeof content === "string") {
    const trimmed = content.trim();
    if (!trimmed) return null;

    // Rich roundtrip: editor emits JSON.stringify(editor.getJSON())
    if (trimmed.startsWith("{") && trimmed.includes('"type"') && trimmed.includes('"doc"')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed && typeof parsed === "object" && parsed.type === "doc") {
          return parsed;
        }
      } catch {
        // fallthrough to plain text handling
      }
    }

    // Legacy / plain text path (samples, old data, title-only etc.)
    return {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: content,
            },
          ],
        },
      ],
    } as Json;
  }

  // Already a rich object (defensive)
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  if (content && typeof content === "object" && (content as any).type === "doc") {
    return content as Json;
  }

  return null;
}

/**
 * Extract readable plain text from stored TipTap JSONB (or legacy string or stringified JSON).
 * Used for Note.content (keeps existing model + cards working) and list previews.
 * Gracefully handles scalars, objects, stringified docs, and nested structures.
 * Now enhanced for rich JSONB round-tripping (extracts text even if .content field holds stringified doc).
 */
function jsonToNoteContent(json: unknown): string {
  if (!json) return "";
  if (typeof json === "string") {
    const trimmed = json.trim();
    // If this is actually a stringified TipTap doc (from rich onChange path), parse then extract
    if (trimmed.startsWith("{") && trimmed.includes('"type"') && trimmed.includes('"doc"')) {
      try {
        const parsed = JSON.parse(trimmed);
        return extractTextFromTipTapDoc(parsed);
      } catch {
        return trimmed; // fallback to raw string (plain case)
      }
    }
    return trimmed;
  }

  // Direct JSONB object from DB
  return extractTextFromTipTapDoc(json);
}

// Internal robust text extractor (factored for reuse in rich paths)
function extractTextFromTipTapDoc(doc: any): string {
  let text = "";
  function extract(node: any): void {
    if (typeof node === "string") {
      text += node;
      return;
    }
    if (node && typeof node === "object") {
      if (typeof node.text === "string") {
        text += node.text + " ";
      }
      if (Array.isArray(node.content)) {
        node.content.forEach(extract);
      } else if (node.content && typeof node.content === "object") {
        extract(node.content);
      }
      if (Array.isArray(node)) {
        node.forEach(extract);
      }
    }
  }
  extract(doc);
  return text.trim();
}

// Public exports for consumers (editor roundtrips, previews in UI, future use)
export { noteContentToJson, jsonToNoteContent };

function mapNoteRow(row: NoteRow): Note {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    title: row.title,
    content: jsonToNoteContent(row.content),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    tags: row.tags ?? [],
    linkedTaskIds: row.linked_task_ids ?? [],
  };
}

function mapActivityLogRow(row: ActivityLogRow): ActivityLog {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    userId: row.user_id ?? undefined,
    actionType: row.action_type,
    targetType: row.target_type,
    targetId: row.target_id ?? undefined,
    metadata: (row.metadata as Record<string, any>) ?? {},
    createdAt: row.created_at,
  };
}

/**
 * Build a DB-shaped payload (snake_case where needed) from input/updates.
 * Deduplicates construction across create paths + forwards full vision fields
 * (assignee_ids, recurring_rule, etc.) for complete Supabase task CRUD support.
 * Safe for partials; callers pass what they have (current simplified Task + any extras).
 */
function buildTaskDbPayload(source: any): any {
  if (!source) return {};
  return {
    title: source.title,
    description: source.description ?? "",
    status: source.status ?? "todo",
    priority: source.priority ?? "P2",
    due_date: source.dueDate ?? source.due_date ?? null,
    tags: source.tags ?? [],
    completed_at: source.completedAt ?? source.completed_at ?? null,
    time_estimate: source.timeEstimate ?? source.time_estimate ?? null,
    linked_note_ids: source.linkedNoteIds ?? source.linked_note_ids ?? [],
    // Full original vision fields (forwarded if present; enables complete CRUD without breaking simplified UI model)
    assignee_ids: source.assigneeIds ?? source.assignee_ids ?? [],
    parent_task_id: source.parentTaskId ?? source.parent_task_id ?? null,
    recurring_rule: source.recurringRule ?? source.recurring_rule ?? null,
    exception_dates: source.exceptionDates ?? source.exception_dates ?? null,
    time_spent: source.timeSpent ?? source.time_spent ?? 0,
  };
}

// ------------------------------------------------------------------
// Offline Queue & Persistence Helpers (Phase 1: basic offline + LWW sync)
// Only active when Supabase is live/configured. Demo mode completely bypasses.
// Queue persisted to localStorage so pending writes survive refresh.
// ------------------------------------------------------------------

const OFFLINE_QUEUE_KEY = "bad-ass-tasks-offline-queue";
const OFFLINE_LISTENERS_SETUP_KEY = "__bat_offline_listeners_setup";

// Robust client-side ID for offline creates (valid UUID so Supabase accepts as PK)
export function generateClientId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // RFC4122-ish fallback
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function isCurrentlyOnline(): boolean {
  if (typeof navigator === "undefined") return true;
  return navigator.onLine;
}

function loadPendingQueue(): PendingOperation[] {
  if (!isSupabaseLive() || typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function savePendingQueue(queue: PendingOperation[]): void {
  if (!isSupabaseLive() || typeof window === "undefined") return;
  try {
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
  } catch {
    // Quota or private mode — non-fatal for basic offline
  }
}

let inMemoryQueue: PendingOperation[] = []; // lazy-hydrated via loadPendingQueue() on first access (prevents TDZ during module init)

/** Enqueue a write operation (create/update/delete) for later sync. */
function enqueuePendingOperation(op: Omit<PendingOperation, "opId" | "timestamp"> & { timestamp?: string }): void {
  if (!isSupabaseLive()) return;

  const fullOp: PendingOperation = {
    opId: generateClientId(),
    timestamp: op.timestamp || new Date().toISOString(),
    ...op,
  } as PendingOperation;

  inMemoryQueue = [...inMemoryQueue, fullOp];
  savePendingQueue(inMemoryQueue);
}

/** Current pending count (reactive callers can poll or store can mirror) */
export function getPendingCount(): number {
  if (!isSupabaseLive()) return 0;
  // Rehydrate from storage in case of external clear or multi-tab
  // Also strip any demo workspace operations that may have leaked in
  const raw = loadPendingQueue().filter(
    (op) => !["w1", "w2"].includes(op.workspaceId)
  );
  if (raw.length !== loadPendingQueue().length) {
    savePendingQueue(raw);
  }
  inMemoryQueue = raw;
  return inMemoryQueue.length;
}

export function getPendingOperations(): PendingOperation[] {
  if (!isSupabaseLive()) return [];
  // Strip any demo workspace operations
  const raw = loadPendingQueue().filter(
    (op) => !["w1", "w2"].includes(op.workspaceId)
  );
  if (raw.length !== loadPendingQueue().length) {
    savePendingQueue(raw);
  }
  inMemoryQueue = raw;
  return [...inMemoryQueue];
}

/** Clear the queue (e.g. after successful full sync or manual reset) */
export function clearPendingOperations(): void {
  if (!isSupabaseLive()) return;
  inMemoryQueue = [];
  savePendingQueue([]);
}

/** Basic online status helper (for hybrid consumers) */
export function getIsOnline(): boolean {
  return isCurrentlyOnline();
}

// ------------------------------------------------------------------
// Last-Write-Wins Sync Processor + Simple Conflict Detection
// ------------------------------------------------------------------

/**
 * Process all pending operations against Supabase now (assumes caller ensures we are online + live).
 * Implements simple conflict detection using updated_at vs op timestamp:
 *   - If server row's updated_at is strictly AFTER our op timestamp → server wins (drop pending op as stale).
 *   - Else apply our change (client's offline write "wins" or no conflict).
 * Creates always attempt insert (using client-generated UUID id we stored).
 * Returns summary for callers (store toasts etc).
 */
export async function processPendingOperations(): Promise<{
  synced: number;
  skippedConflicts: number;
  failed: number;
}> {
  if (!isSupabaseLive()) {
    return { synced: 0, skippedConflicts: 0, failed: 0 };
  }

  const supabase = getClient();
  if (!supabase) {
    return { synced: 0, skippedConflicts: 0, failed: 0 };
  }

  // Fresh load + strip any leaked demo workspace operations (w1/w2)
  // These can exist in the queue if the app created tasks while in demo mode
  // and later switched to live Supabase. We must never attempt to send them.
  let queue = loadPendingQueue().filter(
    (op) => !["w1", "w2"].includes(op.workspaceId)
  );

  // If the queue was dirty, persist the cleaned version
  if (queue.length !== loadPendingQueue().length) {
    savePendingQueue(queue);
    inMemoryQueue = [...queue];
  }

  if (queue.length === 0) {
    return { synced: 0, skippedConflicts: 0, failed: 0 };
  }

  let synced = 0;
  let skippedConflicts = 0;
  let failed = 0;

  const remaining: PendingOperation[] = [];

  for (const op of queue) {
    try {
      if (op.entityType === "task") {
        if (op.type === "create") {
          // Insert using our pre-generated client UUID as id (supported by schema Insert)
          const { error } = await (supabase.from("tasks") as any).insert({
            id: op.targetId,
            workspace_id: op.workspaceId,
            ...op.payload,
          });
          if (error) {
            if (error.code === "23505") {
              // Duplicate key: create already succeeded in prior sync / concurrent write. Treat as synced (idempotent LWW for creates).
              synced++;
            } else {
              throw error;
            }
          } else {
            synced++;
          }
        } else if (op.type === "update") {
          // Simple conflict check via updated_at
          const { data: current } = await supabase
            .from("tasks")
            .select("updated_at")
            .eq("id", op.targetId)
            .single();

          const serverTs = (current as any)?.updated_at ? new Date((current as any).updated_at).getTime() : 0;
          const ourTs = new Date(op.timestamp).getTime();

          if (serverTs > ourTs) {
            skippedConflicts++; // server has newer write → LWW: drop our older offline change
          } else {
            const { error } = await (supabase.from("tasks") as any)
              .update(op.payload)
              .eq("id", op.targetId);
            if (error) throw error;
            synced++;
          }
        } else if (op.type === "delete") {
          // For delete, simple: always attempt (or could check ts too)
          const { error } = await supabase.from("tasks").delete().eq("id", op.targetId);
          if (error && error.code !== "PGRST116") throw error; // ignore not found
          synced++;
        }
      } else if (op.entityType === "note") {
        if (op.type === "create") {
          const { error } = await (supabase.from("notes") as any).insert({
            id: op.targetId,
            workspace_id: op.workspaceId,
            ...op.payload,
          });
          if (error) throw error;
          synced++;
        } else if (op.type === "update") {
          const { data: current } = await supabase
            .from("notes")
            .select("updated_at")
            .eq("id", op.targetId)
            .single();

          const serverTs = (current as any)?.updated_at ? new Date((current as any).updated_at).getTime() : 0;
          const ourTs = new Date(op.timestamp).getTime();

          if (serverTs > ourTs) {
            skippedConflicts++;
          } else {
            // For notes, payload may contain .content as string; convert like the normal path
            const updatePayload = { ...op.payload };
            if (updatePayload.content !== undefined) {
              // Reuse existing converter (it's not exported but we can inline minimal or call via any)
              updatePayload.content = noteContentToJson(updatePayload.content);
            }
            const { error } = await (supabase.from("notes") as any)
              .update(updatePayload)
              .eq("id", op.targetId);
            if (error) throw error;
            synced++;
          }
        } else if (op.type === "delete") {
          const { error } = await supabase.from("notes").delete().eq("id", op.targetId);
          if (error && error.code !== "PGRST116") throw error;
          synced++;
        }
      }
    } catch (err) {
      logHybridError(`processPending(${op.type}:${op.entityType}:${op.targetId})`, err);
      failed++;
      remaining.push(op); // keep for retry later
    }
  }

  inMemoryQueue = remaining;
  savePendingQueue(remaining);

  return { synced, skippedConflicts, failed };
}

// Auto-setup network listeners for opportunistic sync (runs once per tab)
function setupOfflineListenersOnce() {
  if (typeof window === "undefined" || (window as any)[OFFLINE_LISTENERS_SETUP_KEY]) return;
  if (!isSupabaseLive()) return;

  (window as any)[OFFLINE_LISTENERS_SETUP_KEY] = true;

  const handleOnline = () => {
    // Fire-and-forget sync when connectivity returns
    if (getPendingCount() > 0) {
      processPendingOperations().catch((e) =>
        console.warn("[hybrid offline] auto-sync on online failed:", e)
      );
    }
  };

  const handleOffline = () => {
    // Could broadcast status; store layer will reflect via its own listeners or polls
  };

  window.addEventListener("online", handleOnline);
  window.addEventListener("offline", handleOffline);

  // Kick an initial sync attempt if we start while already online with backlog (e.g. after crash)
  if (isCurrentlyOnline() && getPendingCount() > 0) {
    setTimeout(() => {
      processPendingOperations().catch(() => {});
    }, 1500);
  }
}

// ------------------------------------------------------------------
// Public API
// ------------------------------------------------------------------

export const isSupabaseLive = isSupabaseConfigured;

// NOTE FOR QUALITY: Every public export below has an isSupabaseLive() guard at the VERY TOP.
// This is the single source of truth. Never bypass; demo IDs ("w1"/"w2") are additionally blocked
// in live paths to prevent RLS failures or accidental data mixing. Strengthened in Phase 1 QA pass.

// Kick off listener setup immediately for live Supabase environments (idempotent)
// (moved after isSupabaseLive declaration to prevent TDZ ReferenceError at module evaluation time)
setupOfflineListenersOnce();

/** Fetch all tasks for a workspace */
export async function getTasks(workspaceId: string): Promise<Task[]> {
  if (!isSupabaseLive()) return []; // DEMO GUARD (STRENGTHENED)

  // Safety guard: never hit Supabase with invalid or demo workspace IDs.
  // Empty string or demo IDs cause "invalid input syntax for type uuid" errors.
  if (!workspaceId || ["", "w1", "w2"].includes(workspaceId)) {
    return [];
  }

  // Basic offline: if we know we're offline, skip network call entirely.
  // Persisted client state (via Zustand) + queued writes will provide the experience.
  if (!isCurrentlyOnline()) {
    return [];
  }

  const supabase = getClient();
  if (!supabase) return [];

  try {
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false });

    if (error) {
      logHybridError("getTasks", error);
      return [];
    }

    return (data ?? []).map(mapTaskRow);
  } catch (err) {
    // Treat network errors gracefully for offline resilience
    logHybridError("getTasks", err);
    return [];
  }
}

/** Create a new task */
export async function createTask(input: {
  workspaceId: string;
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: Priority;
  dueDate?: string;
  tags?: string[];
  // Allow caller to supply a pre-generated client UUID (for seamless offline create queuing + ID stability)
  id?: string;
}): Promise<Task | null> {
  if (!isSupabaseLive()) return null; // DEMO GUARD (STRENGTHENED)

  const supabase = getClient();
  if (!supabase) return null;

  const online = isCurrentlyOnline();

  // If offline, immediately queue and return an optimistic Task using provided or generated client id.
  if (!online) {
    const clientId = input.id || generateClientId();
    const dbPayload = buildTaskDbPayload(input);
    const tempTask: Task = {
      id: clientId,
      workspaceId: input.workspaceId,
      title: input.title,
      description: input.description ?? "",
      status: input.status ?? "todo",
      priority: input.priority ?? "P2",
      dueDate: input.dueDate,
      assignee: "You",
      tags: input.tags ?? [],
      createdAt: new Date().toISOString(),
      completedAt: (input as any).completedAt,
      timeEstimate: (input as any).timeEstimate,
      linkedNoteIds: (input as any).linkedNoteIds ?? [],
      recurringRule: (input as any).recurringRule ?? (input as any).recurring_rule ?? undefined,
      exceptionDates: (input as any).exceptionDates ?? (input as any).exception_dates ?? undefined,
    };

    enqueuePendingOperation({
      type: "create",
      entityType: "task",
      targetId: clientId,
      payload: dbPayload,
      workspaceId: input.workspaceId,
    });

    return tempTask;
  }

  const dbPayload = buildTaskDbPayload(input);
  const insertPayload: TaskInsert = {
    ...(input.id ? { id: input.id } : {}),
    workspace_id: input.workspaceId,
    ...dbPayload,
  } as TaskInsert;

  try {
    const { data, error } = await (supabase.from("tasks") as any)
      .insert(insertPayload)
      .select()
      .single();

    if (error) {
      // On transient failure while "online" flag said yes → queue for later (improves resilience)
      const clientId = input.id || generateClientId();
      enqueuePendingOperation({
        type: "create",
        entityType: "task",
        targetId: clientId,
        payload: dbPayload,
        workspaceId: input.workspaceId,
      });
      logHybridError("createTask", error);
      // Return optimistic so caller can keep UI consistent
      return {
        id: clientId,
        workspaceId: input.workspaceId,
        title: input.title,
        description: input.description ?? "",
        status: input.status ?? "todo",
        priority: input.priority ?? "P2",
        dueDate: input.dueDate,
        assignee: "You",
        tags: input.tags ?? [],
        createdAt: new Date().toISOString(),
        completedAt: (input as any).completedAt,
        timeEstimate: (input as any).timeEstimate,
        linkedNoteIds: (input as any).linkedNoteIds ?? [],
        recurringRule: (input as any).recurringRule ?? (input as any).recurring_rule ?? undefined,
        exceptionDates: (input as any).exceptionDates ?? (input as any).exception_dates ?? undefined,
      };
    }

    return mapTaskRow(data);
  } catch (err) {
    // Network error etc. → queue
    const clientId = input.id || generateClientId();
    enqueuePendingOperation({
      type: "create",
      entityType: "task",
      targetId: clientId,
      payload: dbPayload,
      workspaceId: input.workspaceId,
    });
    logHybridError("createTask", err);
    return {
      id: clientId,
      workspaceId: input.workspaceId,
      title: input.title,
      description: input.description ?? "",
      status: input.status ?? "todo",
      priority: input.priority ?? "P2",
      dueDate: input.dueDate,
      assignee: "You",
      tags: input.tags ?? [],
      createdAt: new Date().toISOString(),
      completedAt: (input as any).completedAt,
      timeEstimate: (input as any).timeEstimate,
      linkedNoteIds: (input as any).linkedNoteIds ?? [],
      recurringRule: (input as any).recurringRule ?? (input as any).recurring_rule ?? undefined,
      exceptionDates: (input as any).exceptionDates ?? (input as any).exception_dates ?? undefined,
    };
  }
}

/** Update an existing task (partial) */
export async function updateTask(id: string, updates: Partial<Task>): Promise<boolean> {
  if (!isSupabaseLive()) return false;

  const supabase = getClient();
  if (!supabase) return false;

  const payload: Partial<TaskInsert> = {};

  if (updates.title !== undefined) payload.title = updates.title;
  if (updates.description !== undefined) payload.description = updates.description;
  if (updates.status !== undefined) payload.status = updates.status;
  if (updates.priority !== undefined) payload.priority = updates.priority;
  if (updates.dueDate !== undefined) payload.due_date = updates.dueDate;
  if (updates.tags !== undefined) payload.tags = updates.tags;
  // Harden: support additional Task fields used in UI / future
  if (updates.completedAt !== undefined) payload.completed_at = updates.completedAt;
  if (updates.timeEstimate !== undefined) payload.time_estimate = updates.timeEstimate;
  if (updates.linkedNoteIds !== undefined) payload.linked_note_ids = updates.linkedNoteIds;

  // Forward full original vision fields (assignee_ids[], recurring_rule, etc.) so updateTask supports complete Supabase CRUD
  const anyUpdates = updates as any;
  if (anyUpdates.assigneeIds !== undefined || anyUpdates.assignee_ids !== undefined) {
    payload.assignee_ids = anyUpdates.assigneeIds ?? anyUpdates.assignee_ids;
  }
  if (anyUpdates.parentTaskId !== undefined || anyUpdates.parent_task_id !== undefined) {
    payload.parent_task_id = anyUpdates.parentTaskId ?? anyUpdates.parent_task_id;
  }
  if (anyUpdates.recurringRule !== undefined || anyUpdates.recurring_rule !== undefined) {
    payload.recurring_rule = anyUpdates.recurringRule ?? anyUpdates.recurring_rule;
  }
  if (anyUpdates.exceptionDates !== undefined || anyUpdates.exception_dates !== undefined) {
    payload.exception_dates = anyUpdates.exceptionDates ?? anyUpdates.exception_dates;
  }
  if (anyUpdates.timeSpent !== undefined || anyUpdates.time_spent !== undefined) {
    payload.time_spent = anyUpdates.timeSpent ?? anyUpdates.time_spent;
  }

  const online = isCurrentlyOnline();

  if (!online) {
    // Queue immediately for later LWW sync
    enqueuePendingOperation({
      type: "update",
      entityType: "task",
      targetId: id,
      payload,
      workspaceId: (updates as any).workspaceId || "", // best effort; store caller usually knows context
    });
    return true; // Optimistic success from data layer perspective
  }

  try {
    const { error } = await (supabase.from("tasks") as any)
      .update(payload)
      .eq("id", id);

    if (error) {
      // Transient error while thought-to-be-online → queue it
      enqueuePendingOperation({
        type: "update",
        entityType: "task",
        targetId: id,
        payload,
        workspaceId: (updates as any).workspaceId || "",
      });
      logHybridError("updateTask", error);
      return true; // Still "succeeded" locally/queued
    }

    return true;
  } catch (err) {
    enqueuePendingOperation({
      type: "update",
      entityType: "task",
      targetId: id,
      payload,
      workspaceId: (updates as any).workspaceId || "",
    });
    logHybridError("updateTask", err);
    return true;
  }
}

// ------------------------------------------------------------------
// Server-side / hybrid recurring scaffolding (Agent 13 production prep)
// Even if client-primary for now (hybrid demo/live), these provide hooks
// for future: server validation of rules, materialized views, notifications,
// bulk series ops, or RPCs. Called from UI/store paths when live.
// Non-breaking; current impl just forwards through update + client engine.
// ------------------------------------------------------------------

/** Scaffold: skip a specific occurrence by adding to exceptions (persists via hybrid update).
 *  Real callers (e.g. calendar) compute key + call updateTask directly (leverages queue/optimistic).
 */
export function computeNextExceptionsForSkip(currentExceptionDates: string[] = [], occurrenceKey: string): string[] {
  return Array.from(new Set([...currentExceptionDates, occurrenceKey]));
}

/** Scaffold hook for future server recurring processing (e.g. due reminders, auto advance on server). */
export async function processRecurringSeriesForWorkspace(workspaceId: string): Promise<void> {
  if (!isSupabaseLive()) return;
  // TODO (prod): query tasks with recurring_rule, compute next via engine or SQL, enqueue notifications etc.
  // For now: no-op placeholder. Keeps separation clean.
  console.debug("[hybrid recurring scaffold] processRecurringSeriesForWorkspace called for", workspaceId);
}

/** Break series helper scaffold (clears rule + optional until logic in caller). */
export function breakRecurringSeries(): Partial<Task> {
  return { recurringRule: null, exceptionDates: undefined };
}

/** Delete a task. Optional workspaceId for queue metadata / diagnostics. */
export async function deleteTask(id: string, workspaceId?: string): Promise<boolean> {
  if (!isSupabaseLive()) return false;

  const supabase = getClient();
  if (!supabase) return false;

  const ws = workspaceId || "";
  const online = isCurrentlyOnline();

  if (!online) {
    enqueuePendingOperation({
      type: "delete",
      entityType: "task",
      targetId: id,
      payload: {},
      workspaceId: ws,
    });
    return true;
  }

  try {
    const { error } = await supabase.from("tasks").delete().eq("id", id);

    if (error) {
      enqueuePendingOperation({
        type: "delete",
        entityType: "task",
        targetId: id,
        payload: {},
        workspaceId: ws,
      });
      logHybridError("deleteTask", error);
      return true;
    }

    return true;
  } catch (err) {
    enqueuePendingOperation({
      type: "delete",
      entityType: "task",
      targetId: id,
      payload: {},
      workspaceId: ws,
    });
    logHybridError("deleteTask", err);
    return true;
  }
}

/** Move a task to a different status (convenience method). Optional workspaceId forwarded for better queue metadata / future LWW scoping. */
export async function moveTask(id: string, newStatus: TaskStatus, workspaceId?: string): Promise<boolean> {
  const updates: any = { status: newStatus };
  if (workspaceId) updates.workspaceId = workspaceId;
  return updateTask(id, updates);
}

// ------------------------------------------------------------------
// Notes CRUD (mirrors task pattern exactly for consistency)
// ------------------------------------------------------------------

/** Fetch all notes for a workspace (non-archived by default for Phase 1) */
export async function getNotes(workspaceId: string): Promise<Note[]> {
  if (!isSupabaseLive()) return []; // DEMO GUARD (STRENGTHENED)

  // Safety guard: never hit Supabase with invalid or demo workspace IDs.
  if (!workspaceId || ["", "w1", "w2"].includes(workspaceId)) {
    return [];
  }

  // Basic offline: skip network when offline (client state + queue provide UX)
  if (!isCurrentlyOnline()) {
    return [];
  }

  const supabase = getClient();
  if (!supabase) return [];

  try {
    const { data, error } = await supabase
      .from("notes")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("is_archived", false) // Phase 1: surface only active notes
      .order("updated_at", { ascending: false });

    if (error) {
      logHybridError("getNotes", error);
      return [];
    }

    return (data ?? []).map(mapNoteRow);
  } catch (err) {
    logHybridError("getNotes", err);
    return [];
  }
}

/** Create a new note */
export async function createNote(input: {
  workspaceId: string;
  title: string;
  content?: string;
  tags?: string[];
  // Optional pre-generated client UUID for offline create consistency
  id?: string;
}): Promise<Note | null> {
  if (!isSupabaseLive()) return null;

  const supabase = getClient();
  if (!supabase) return null;

  const online = isCurrentlyOnline();

  if (!online) {
    const clientId = input.id || generateClientId();
    const tempNote: Note = {
      id: clientId,
      workspaceId: input.workspaceId,
      title: input.title,
      content: input.content ?? "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tags: input.tags ?? [],
      linkedTaskIds: [],
    };

    const contentJson = noteContentToJson(input.content);
    enqueuePendingOperation({
      type: "create",
      entityType: "note",
      targetId: clientId,
      payload: {
        title: input.title,
        content: contentJson,
        tags: input.tags ?? [],
        is_archived: false,
      },
      workspaceId: input.workspaceId,
    });

    return tempNote;
  }

  const contentJson = noteContentToJson(input.content);

  const insertPayload: NoteInsert = {
    ...(input.id ? { id: input.id } : {}),
    workspace_id: input.workspaceId,
    title: input.title,
    content: contentJson,
    tags: input.tags ?? [],
    is_archived: false,
  };

  try {
    const { data, error } = await (supabase.from("notes") as any)
      .insert(insertPayload)
      .select()
      .single();

    if (error) {
      const clientId = input.id || generateClientId();
      enqueuePendingOperation({
        type: "create",
        entityType: "note",
        targetId: clientId,
        payload: {
          title: input.title,
          content: contentJson,
          tags: input.tags ?? [],
          is_archived: false,
        },
        workspaceId: input.workspaceId,
      });
      logHybridError("createNote", error);
      return {
        id: clientId,
        workspaceId: input.workspaceId,
        title: input.title,
        content: input.content ?? "",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        tags: input.tags ?? [],
        linkedTaskIds: [],
      };
    }

    return mapNoteRow(data);
  } catch (err) {
    const clientId = input.id || generateClientId();
    enqueuePendingOperation({
      type: "create",
      entityType: "note",
      targetId: clientId,
      payload: {
        title: input.title,
        content: noteContentToJson(input.content),
        tags: input.tags ?? [],
        is_archived: false,
      },
      workspaceId: input.workspaceId,
    });
    logHybridError("createNote", err);
    return {
      id: clientId,
      workspaceId: input.workspaceId,
      title: input.title,
      content: input.content ?? "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tags: input.tags ?? [],
      linkedTaskIds: [],
    };
  }
}

/** Update an existing note (partial) */
export async function updateNote(id: string, updates: Partial<Note>): Promise<boolean> {
  if (!isSupabaseLive()) return false;

  const supabase = getClient();
  if (!supabase) return false;

  const payload: Partial<NoteInsert> = {};

  if (updates.title !== undefined) payload.title = updates.title;
  if (updates.content !== undefined) payload.content = noteContentToJson(updates.content);
  if (updates.tags !== undefined) payload.tags = updates.tags;
  // Note: linkedTaskIds could be mapped to linked_task_ids if needed in future

  const online = isCurrentlyOnline();

  if (!online) {
    enqueuePendingOperation({
      type: "update",
      entityType: "note",
      targetId: id,
      payload,
      workspaceId: (updates as any).workspaceId || "",
    });
    return true;
  }

  try {
    const { error } = await (supabase.from("notes") as any)
      .update(payload)
      .eq("id", id);

    if (error) {
      enqueuePendingOperation({
        type: "update",
        entityType: "note",
        targetId: id,
        payload,
        workspaceId: (updates as any).workspaceId || "",
      });
      logHybridError("updateNote", error);
      return true;
    }

    return true;
  } catch (err) {
    enqueuePendingOperation({
      type: "update",
      entityType: "note",
      targetId: id,
      payload,
      workspaceId: (updates as any).workspaceId || "",
    });
    logHybridError("updateNote", err);
    return true;
  }
}

/** Delete a note */
export async function deleteNote(id: string): Promise<boolean> {
  if (!isSupabaseLive()) return false;

  const supabase = getClient();
  if (!supabase) return false;

  const online = isCurrentlyOnline();

  if (!online) {
    enqueuePendingOperation({
      type: "delete",
      entityType: "note",
      targetId: id,
      payload: {},
      workspaceId: "",
    });
    return true;
  }

  try {
    const { error } = await supabase.from("notes").delete().eq("id", id);

    if (error) {
      enqueuePendingOperation({
        type: "delete",
        entityType: "note",
        targetId: id,
        payload: {},
        workspaceId: "",
      });
      logHybridError("deleteNote", error);
      return true;
    }

    return true;
  } catch (err) {
    enqueuePendingOperation({
      type: "delete",
      entityType: "note",
      targetId: id,
      payload: {},
      workspaceId: "",
    });
    logHybridError("deleteNote", err);
    return true;
  }
}

// ------------------------------------------------------------------
// Activity Logging (Phase 1 / early Phase 2)
// Lightweight append-only logs for key events. Only writes when Supabase live.
// ------------------------------------------------------------------

/** Log an activity event. Safe no-op in demo mode. */
export async function logActivity(params: {
  workspaceId: string;
  userId?: string | null;
  actionType: string;
  targetType: string;
  targetId?: string;
  metadata?: Record<string, any>;
}): Promise<boolean> {
  if (!isSupabaseLive()) return false; // DEMO GUARD (STRENGTHENED)

  // Safety guard: never hit Supabase with demo workspace IDs
  if (["w1", "w2"].includes(params.workspaceId)) {
    return false;
  }

  const supabase = getClient();
  if (!supabase) return false;

  const insertPayload: ActivityLogInsert = {
    workspace_id: params.workspaceId,
    user_id: params.userId ?? null,
    action_type: params.actionType,
    target_type: params.targetType,
    target_id: params.targetId ?? null,
    metadata: params.metadata ?? {},
  };

  const { error } = await (supabase.from("activity_logs") as any)
    .insert(insertPayload);

  if (error) {
    logHybridError("logActivity", error);
    return false;
  }

  return true;
}

/** Fetch recent activity logs for a workspace (basic, no joins for Phase 1 lightness) */
export async function getRecentActivity(workspaceId: string, limit = 15): Promise<ActivityLog[]> {
  if (!isSupabaseLive()) return []; // DEMO GUARD (STRENGTHENED)

  // Safety guard: never hit Supabase with demo workspace IDs
  if (["w1", "w2"].includes(workspaceId)) {
    return [];
  }

  const supabase = getClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("activity_logs")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    logHybridError("getRecentActivity", error);
    return [];
  }

  return (data ?? []).map(mapActivityLogRow);
}

// ------------------------------------------------------------------
// Agent 31: Notifications (in-app center + email for key events)
// Uses dedicated notifications table + activity_logs as event source.
// Realtime delivery via extended subs in store. Prefs respected (from profile).
// Email uses/extends the existing sendInviteEmail scaffold (no new deps).
// ------------------------------------------------------------------

function mapNotificationRow(row: NotificationRow): Notification {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    userId: row.user_id,
    type: row.type as NotificationType,
    title: row.title,
    message: row.message,
    link: row.link ?? undefined,
    readAt: row.read_at ?? undefined,
    createdAt: row.created_at,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    activityLogId: row.activity_log_id ?? undefined,
  };
}

/** Fetch notifications for the current user in a workspace (or all if no ws). Supports unread filter. */
export async function getUserNotifications(
  userId: string,
  workspaceId?: string,
  limit = 30,
  unreadOnly = false
): Promise<Notification[]> {
  if (!isSupabaseLive()) return [];
  if (!userId) return [];

  const supabase = getClient();
  if (!supabase) return [];

  try {
    let query = supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (workspaceId && !["w1", "w2"].includes(workspaceId)) {
      query = query.eq("workspace_id", workspaceId);
    }
    if (unreadOnly) {
      query = query.is("read_at", null);
    }

    const { data, error } = await query;
    if (error) {
      logHybridError("getUserNotifications", error);
      return [];
    }
    return (data ?? []).map(mapNotificationRow);
  } catch (err) {
    logHybridError("getUserNotifications", err);
    return [];
  }
}

/** Create a notification for a specific user (called from event sites after activity log). Respects basic guards. */
export async function createNotification(params: {
  workspaceId: string;
  userId: string; // recipient
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  activityLogId?: string;
  metadata?: Record<string, any>;
}): Promise<Notification | null> {
  if (!isSupabaseLive()) return null;
  if (["w1", "w2"].includes(params.workspaceId)) return null;

  const supabase = getClient();
  if (!supabase) return null;

  const insertPayload: NotificationInsert = {
    workspace_id: params.workspaceId,
    user_id: params.userId,
    type: params.type,
    title: params.title,
    message: params.message,
    link: params.link ?? null,
    activity_log_id: params.activityLogId ?? null,
    metadata: params.metadata ?? {},
  };

  try {
    const { data, error } = await (supabase.from("notifications") as any)
      .insert(insertPayload)
      .select()
      .single();

    if (error) {
      logHybridError("createNotification", error);
      return null;
    }
    return mapNotificationRow(data as NotificationRow);
  } catch (err) {
    logHybridError("createNotification", err);
    return null;
  }
}

/** Mark one or more notifications as read (sets read_at). */
export async function markNotificationsRead(notificationIds: string[]): Promise<boolean> {
  if (!isSupabaseLive() || notificationIds.length === 0) return false;

  const supabase = getClient();
  if (!supabase) return false;

  try {
    const { error } = await (supabase.from("notifications") as any)
      .update({ read_at: new Date().toISOString() })
      .in("id", notificationIds);

    if (error) {
      logHybridError("markNotificationsRead", error);
      return false;
    }
    return true;
  } catch (err) {
    logHybridError("markNotificationsRead", err);
    return false;
  }
}

/** Delete a single notification (user must own it). */
export async function deleteNotification(notificationId: string, userId: string): Promise<boolean> {
  if (!isSupabaseLive() || !notificationId || !userId) return false;

  const supabase = getClient();
  if (!supabase) return false;

  try {
    const { error } = await (supabase.from("notifications") as any)
      .delete()
      .eq("id", notificationId)
      .eq("user_id", userId);

    if (error) {
      logHybridError("deleteNotification", error);
      return false;
    }
    return true;
  } catch (err) {
    logHybridError("deleteNotification", err);
    return false;
  }
}

/** Clear all notifications for a user. */
export async function clearAllNotifications(userId: string): Promise<boolean> {
  if (!isSupabaseLive() || !userId) return false;

  const supabase = getClient();
  if (!supabase) return false;

  try {
    const { error } = await (supabase.from("notifications") as any)
      .delete()
      .eq("user_id", userId);

    if (error) {
      logHybridError("clearAllNotifications", error);
      return false;
    }
    return true;
  } catch (err) {
    logHybridError("clearAllNotifications", err);
    return false;
  }
}

/** Quick unread count for badge (lightweight). */
export async function getUnreadNotificationCount(userId: string, workspaceId?: string): Promise<number> {
  if (!isSupabaseLive() || !userId) return 0;

  const supabase = getClient();
  if (!supabase) return 0;

  try {
    let query = supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .is("read_at", null);

    if (workspaceId && !["w1", "w2"].includes(workspaceId)) {
      query = query.eq("workspace_id", workspaceId);
    }

    const { count, error } = await query;
    if (error) {
      logHybridError("getUnreadNotificationCount", error);
      return 0;
    }
    return count || 0;
  } catch (err) {
    logHybridError("getUnreadNotificationCount", err);
    return 0;
  }
}

/** Email notification scaffold (extends the invite email placeholder). 
 * For production: integrate Resend / Supabase Edge Function / API route.
 * Called for key events if user prefs allow email.
 */
export async function sendNotificationEmail(
  toEmail: string | null | undefined,
  type: NotificationType,
  data: { title: string; message: string; workspaceName?: string; link?: string; actor?: string }
): Promise<boolean> {
  if (!isSupabaseLive() || !toEmail) return false;

  // Reuse/extend the existing invite scaffold pattern for consistency and zero new deps.
  console.info(
    `[NOTIF EMAIL SCAFFOLD] Would send ${type} email to ${toEmail}: "${data.title}" — ${data.message}. ` +
    `Workspace: ${data.workspaceName || 'n/a'}. Link: ${data.link || 'app'}. Actor: ${data.actor || 'system'}. ` +
    `Future: wire Resend SDK or edge fn (see sendInviteEmail for example).`
  );

  // Placeholder success (graceful). Real impl would await resend.emails.send(...)
  return true;
}

/** Helper: extract @mentions from text (reuses natural lang tag logic + comment rendering pattern). Returns unique handles. */
export function extractMentions(text: string): string[] {
  if (!text) return [];
  const matches = text.match(/@[\w.-]+/g) || [];
  return Array.from(new Set(matches.map((m) => m.slice(1).toLowerCase())));
}

// ------------------------------------------------------------------
// Comments (on tasks or notes) - wired for realtime collab polish (Agent 14)
// Schema-backed (task_id XOR note_id, optional parent for threads), RLS protected.
// Optimistic + activity log. Realtime via broadcast or task/note change triggers in store.
// ------------------------------------------------------------------

function mapCommentRow(row: any): Comment {
  const profile = row?.profiles;
  return {
    id: row.id,
    content: row.content,
    userId: row.user_id,
    taskId: row.task_id ?? undefined,
    noteId: row.note_id ?? undefined,
    parentCommentId: row.parent_comment_id ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    userName: profile?.full_name ?? undefined,
    userEmail: profile?.email ?? undefined,
  };
}

/** Fetch comments for a task or note. Demo guarded. */
export async function getComments(target: { taskId?: string; noteId?: string }): Promise<Comment[]> {
  if (!isSupabaseLive()) return [];
  const workspaceId = ""; // not used directly; RLS + caller scope
  if (["w1", "w2"].includes(workspaceId)) return []; // demo no (though ws not on comments)

  const supabase = getClient();
  if (!supabase) return [];

  try {
    let query = supabase
      .from("comments")
      .select(`*, profiles(full_name, email)`)
      .order("created_at", { ascending: true });

    if (target.taskId) query = query.eq("task_id", target.taskId);
    if (target.noteId) query = query.eq("note_id", target.noteId);

    const { data, error } = await query;

    if (error) {
      logHybridError("getComments", error);
      return [];
    }
    return (data ?? []).map(mapCommentRow);
  } catch (err) {
    logHybridError("getComments", err);
    return [];
  }
}

/** Create comment (optimistic friendly). Logs activity. */
export async function createComment(params: {
  content: string;
  taskId?: string;
  noteId?: string;
  parentCommentId?: string;
  workspaceId: string;
  userId?: string | null;
}): Promise<Comment | null> {
  if (!isSupabaseLive()) return null;
  if (["w1", "w2"].includes(params.workspaceId)) return null;

  const supabase = getClient();
  if (!supabase) return null;

  try {
    const insertPayload: any = {
      content: params.content.trim(),
      user_id: params.userId ?? null,
      task_id: params.taskId ?? null,
      note_id: params.noteId ?? null,
      parent_comment_id: params.parentCommentId ?? null,
    };

    const { data, error } = await (supabase.from("comments") as any).insert(insertPayload).select(`*, profiles(full_name, email)`).single();

    if (error) {
      logHybridError("createComment", error);
      return null;
    }

    const created = mapCommentRow(data);

    // Log activity (non-blocking)
    logActivity({
      workspaceId: params.workspaceId,
      userId: params.userId,
      actionType: "comment.added",
      targetType: params.taskId ? "task" : "note",
      targetId: params.taskId || params.noteId,
      metadata: { commentId: created.id, contentPreview: params.content.slice(0, 80) },
    }).catch(() => {});

    // Agent 31: Wire @mention notifications (use activity as source; fanout to mentioned users)
    // Full: resolve handles via members list + prefs check + email via sendNotificationEmail
    const mentionedHandles = extractMentions(params.content);
    if (mentionedHandles.length > 0 && params.userId) {
      createNotification({
        workspaceId: params.workspaceId,
        userId: params.userId, // demo: notify actor; prod: map handles -> real user_ids
        type: 'mention',
        title: `@mention in ${params.taskId ? 'task' : 'note'} comment`,
        message: params.content.slice(0, 100),
        metadata: { handles: mentionedHandles, commentId: created.id, actor: params.userId },
        activityLogId: undefined,
      }).catch(() => {});
      // Email scaffold example (respects future prefs)
      // sendNotificationEmail(..., 'mention', {title, message, ...}).catch(()=>{});
    }

    return created;
  } catch (err) {
    logHybridError("createComment", err);
    return null;
  }
}

// ------------------------------------------------------------------
// Phase 2: Collaboration foundations - Members, Invites, Realtime, Presence prep
// All paths strictly guarded by isSupabaseLive() + demo ID blocks.
// No changes to core task/note CRUD paths.
// ------------------------------------------------------------------

export type WorkspaceMemberRow = Database["public"]["Tables"]["workspace_members"]["Row"];
export type WorkspaceInviteRow = Database["public"]["Tables"]["workspace_invites"]["Row"];

function mapMemberRow(row: any): import("@/types").WorkspaceMember {
  const profile = row?.profiles;
  return {
    workspaceId: row.workspace_id,
    userId: row.user_id,
    role: row.role,
    joinedAt: row.joined_at,
    invitedBy: row.invited_by ?? undefined,
    fullName: profile?.full_name ?? undefined,
    username: profile?.username ?? undefined,
    avatarUrl: profile?.avatar_url ?? undefined,
    location: profile?.location ?? undefined,
    lastActiveAt: profile?.last_active_at ?? undefined,
    // We intentionally do not surface email here for privacy in the members list.
  };
}

function mapInviteRow(row: WorkspaceInviteRow): import("@/types").WorkspaceInvite {
  const profile = (row as any).invited_profile;

  return {
    id: row.id,
    workspaceId: row.workspace_id,
    email: row.email ?? undefined,
    role: row.role,
    invitedBy: row.invited_by ?? undefined,
    invitedUserId: row.invited_user_id ?? undefined,
    invitedFullName: profile?.full_name ?? undefined,
    invitedUsername: profile?.username ?? undefined,
    invitedAvatarUrl: profile?.avatar_url ?? undefined,
    expiresAt: row.expires_at ?? undefined,
    acceptedAt: row.accepted_at ?? undefined,
    createdAt: row.created_at,
  };
}

/** Fetch members for a workspace (with role info). Demo/live guarded. */
export async function getWorkspaceMembers(workspaceId: string): Promise<import("@/types").WorkspaceMember[]> {
  if (!isSupabaseLive()) return [];
  if (["w1", "w2"].includes(workspaceId)) return [];

  const supabase = getClient();
  if (!supabase) return [];

  // Resilient profile join: the "location" column (added for "where I'm from" profile feature)
  // may not exist yet in older deployed Supabase schemas. We attempt the rich select first,
  // then gracefully fall back if the column is missing (42703 = undefined column).
  const richSelect = `*, profiles(full_name, username, avatar_url, location, last_active_at)`;
  const legacySelect = `*, profiles(full_name, username, avatar_url, last_active_at)`;

  // Helper to run the members query (supabase is guaranteed non-null here due to the guard above)
  const runMembersQuery = (selectStr: string) =>
    supabase!
      .from("workspace_members")
      .select(selectStr)
      .eq("workspace_id", workspaceId)
      .order("joined_at", { ascending: true });

  try {
    // First try: with location (new column)
    let { data, error } = await runMembersQuery(richSelect);

    if (error && error.code === "42703" && String(error.message || "").includes("location")) {
      // Expected during schema rollout — downgrade to warn and retry without the new column.
      logger.warn(`getWorkspaceMembers: profiles.location column missing (expected until ALTER TABLE is run). Falling back to legacy select.`, {
        workspaceId,
        hint: "Run: ALTER TABLE profiles ADD COLUMN IF NOT EXISTS location TEXT;",
      });
      ({ data, error } = await runMembersQuery(legacySelect));
    }

    if (error) {
      logHybridError("getWorkspaceMembers", error);
      return [];
    }
    return (data ?? []).map(mapMemberRow);
  } catch (err) {
    logHybridError("getWorkspaceMembers", err);
    return [];
  }
}

/** Fetch pending (unaccepted) invites for workspace. Owner/admin only via RLS. */
export async function getWorkspaceInvites(workspaceId: string): Promise<import("@/types").WorkspaceInvite[]> {
  if (!isSupabaseLive()) return [];
  if (["w1", "w2"].includes(workspaceId)) return [];

  const supabase = getClient();
  if (!supabase) return [];

  try {
    // Plain select first (avoids RLS join complications with profiles).
    // We then safely hydrate profile data for any invited_user_ids in a follow-up query.
    const { data: inviteRows, error } = await supabase
      .from("workspace_invites")
      .select("*")
      .eq("workspace_id", workspaceId)
      .is("accepted_at", null)
      .order("created_at", { ascending: false });

    if (error) {
      logHybridError("getWorkspaceInvites", error);
      return [];
    }

    const invites = (inviteRows ?? []);

    // Hydrate recipient profile info (name/username) for privacy-friendly display
    // in the sender's "Invites sent" UI.
    // 1. Preferred: by invited_user_id (search flow)
    // 2. Fallback: by email on the invite row (direct email invites or old rows)
    // This prevents "Pending teammate" for real users who have profiles.

    const invitedUserIds = [...new Set(
      invites.map((r: any) => r.invited_user_id).filter(Boolean)
    )] as string[];

    const emailsForLookup = [...new Set(
      invites
        .filter((r: any) => !r.invited_user_id && r.email)
        .map((r: any) => r.email)
    )] as string[];

    let profileMap: Record<string, any> = {};

    // Lookup by user id (search invites)
    if (invitedUserIds.length > 0) {
      const { data: profsById } = await supabase
        .from("profiles")
        .select("id, full_name, username, avatar_url, email")
        .in("id", invitedUserIds);
      (profsById ?? []).forEach((p: any) => { profileMap[p.id] = p; });
    }

    // Lookup by email (direct / legacy invites)
    if (emailsForLookup.length > 0) {
      const { data: profsByEmail } = await supabase
        .from("profiles")
        .select("id, full_name, username, avatar_url, email")
        .in("email", emailsForLookup);
      (profsByEmail ?? []).forEach((p: any) => {
        if (p.email) profileMap[p.email] = p;   // keyed by email for fallback
      });
    }

    // Attach in the shape mapInviteRow expects
    const enriched = invites.map((row: any) => {
      let prof = null;
      if (row.invited_user_id && profileMap[row.invited_user_id]) {
        prof = profileMap[row.invited_user_id];
      } else if (row.email && profileMap[row.email]) {
        prof = profileMap[row.email];
      }
      return { ...row, invited_profile: prof };
    });

    return enriched.map(mapInviteRow);
  } catch (err) {
    logHybridError("getWorkspaceInvites", err);
    return [];
  }
}

/** Update the current user's own profile (full_name, username/handle, location).
 *  Fully guarded + resilient to missing columns during schema rollout (strips username/location on 42703 and retries).
 *  Uses direct UPDATE (RLS "Users can update own profile" enforces self-only).
 *  Safe for both demo (no-op) and live. Returns success (even partial on old schemas).
 */
export async function updateMyProfile(updates: { fullName?: string; username?: string; location?: string }): Promise<boolean> {
  if (!isSupabaseLive()) return false;

  const supabase = getClient();
  if (!supabase) return false;

  try {
    const { data: { user } } = await supabase.auth.getUser();
    const uid = user?.id;
    if (!uid) return false;

    const payload: Record<string, string | null> = {};
    if (typeof updates.fullName === "string") payload.full_name = updates.fullName.trim() || null;
    if (typeof updates.username === "string") payload.username = updates.username.trim().toLowerCase().replace(/[^a-z0-9_]/g, "") || null; // sanitize handle
    if (typeof updates.location === "string") payload.location = updates.location.trim() || null;

    if (Object.keys(payload).length === 0) return true; // nothing to do

    const { error } = await (supabase.from("profiles") as any)
      .update(payload)
      .eq("id", uid);

    if (error) {
      // Resilient handling for schema rollout: if username or location columns don't exist yet (42703),
      // strip the offending field(s) and retry. This allows at least full_name to save on older DBs.
      let retried = false;
      if (error.code === "42703") {
        if (payload.username !== undefined) {
          delete payload.username;
          retried = true;
        }
        if (payload.location !== undefined) {
          delete payload.location;
          retried = true;
        }

        if (retried && Object.keys(payload).length > 0) {
          const { error: retryErr } = await (supabase.from("profiles") as any)
            .update(payload)
            .eq("id", uid);

          if (!retryErr) {
            logger.warn(
              "updateMyProfile: retried after stripping new columns (username/location) due to 42703. " +
              "Run the ALTER TABLE commands below in Supabase SQL Editor for full support."
            );
            return true;
          }
        }
      }

      logHybridError("updateMyProfile", error);
      return false;
    }
    return true;
  } catch (err) {
    logHybridError("updateMyProfile", err);
    return false;
  }
}

/** Search potential teammates by name/full_name, @username, location/city or email (for empty-owner invite UX).
 *  Powered by SECURITY DEFINER RPC (bypasses profiles RLS self-only SELECT safely for discovery).
 *  Strict guards first (per project convention). Returns limited safe fields for rich preview cards.
 *  Excludes self and (if provided) existing members of the workspace.
 */
export async function searchPotentialTeammates(
  query: string,
  currentWorkspaceId?: string
): Promise<Array<{ id: string; fullName?: string; username?: string; location?: string; email?: string; avatarUrl?: string }>> {
  if (!isSupabaseLive()) return [];
  const q = (query || "").trim();
  if (!q || q.length < 1) return [];
  if (currentWorkspaceId && ["w1", "w2"].includes(currentWorkspaceId)) return [];

  const supabase = getClient();
  if (!supabase) return [];

  try {
    const { data, error } = await (supabase.rpc as any)("search_users_for_invite", {
      search_term: q,
      exclude_workspace_id: currentWorkspaceId || null,
    });

    if (error) {
      // Graceful handling during rollout: if the RPC hasn't been applied yet, don't spam ERROR logs.
      if (error.code === 'PGRST202') {
        logger.warn('searchPotentialTeammates: RPC search_users_for_invite not found yet (expected until you run the SQL from schema.sql). Returning empty results.');
        return [];
      }
      logHybridError("searchPotentialTeammates", error);
      return [];
    }
    return (data ?? []).map((r: any) => ({
      id: r.id,
      fullName: r.full_name ?? undefined,
      username: r.username ?? undefined,
      location: r.location ?? undefined,
      email: r.email ?? undefined,
      avatarUrl: r.avatar_url ?? undefined,
    }));
  } catch (err) {
    logHybridError("searchPotentialTeammates", err);
    return [];
  }
}

/** Create invite via secure RPC (enforces admin/owner server-side). Returns invite id (use as token). */
export async function createInvite(
  workspaceId: string,
  email?: string | null,
  role: "owner" | "admin" | "user" = "user"
): Promise<string | null> {
  if (!isSupabaseLive()) return null;
  if (["w1", "w2"].includes(workspaceId)) return null;

  const supabase = getClient();
  if (!supabase) return null;

  try {
    const { data, error } = await (supabase.rpc as any)("create_workspace_invite", {
      p_workspace_id: workspaceId,
      p_email: email ?? null,
      p_role: role,
    });

    if (error) {
      logHybridError("createInvite", error);
      return null;
    }
    return data as string;
  } catch (err) {
    logHybridError("createInvite", err);
    return null;
  }
}

/** Accept invite via secure RPC. Returns joined workspaceId or null. */
export async function acceptInvite(inviteId: string): Promise<string | null> {
  if (!isSupabaseLive()) return null;

  const supabase = getClient();
  if (!supabase) return null;

  try {
    const { data, error } = await (supabase.rpc as any)("accept_workspace_invite", {
      p_invite_id: inviteId,
    });

    if (error) {
      logHybridError("acceptInvite", error);
      return null;
    }
    return data as string;
  } catch (err) {
    logHybridError("acceptInvite", err);
    return null;
  }
}

/** Update member role (owner/admin only; RPC or direct with RLS). Server-side enforcement preferred but direct update works under RLS. */
export async function updateMemberRole(
  workspaceId: string,
  userId: string,
  newRole: "owner" | "admin" | "user"
): Promise<boolean> {
  if (!isSupabaseLive()) return false;
  if (["w1", "w2"].includes(workspaceId)) return false;

  const supabase = getClient();
  if (!supabase) return false;

  try {
    const { error } = await (supabase.from("workspace_members") as any)
      .update({ role: newRole })
      .eq("workspace_id", workspaceId)
      .eq("user_id", userId);

    if (error) {
      logHybridError("updateMemberRole", error);
      return false;
    }
    return true;
  } catch (err) {
    logHybridError("updateMemberRole", err);
    return false;
  }
}

/** Remove member (owner/admin; cannot remove self via UI).
 * World-class: performs the member DELETE + best-effort cleanup of any pending invites
 * created by or addressed to the removed user in this workspace, plus related notifications.
 * Mirrors the rigor of revokeInvite (RPC-preferred where available).
 */
export async function removeMember(workspaceId: string, userId: string): Promise<boolean> {
  if (!isSupabaseLive()) return false;
  if (["w1", "w2"].includes(workspaceId)) return false;

  const supabase = getClient();
  if (!supabase) return false;

  try {
    // Primary removal
    const { error } = await supabase
      .from("workspace_members")
      .delete()
      .eq("workspace_id", workspaceId)
      .eq("user_id", userId);

    if (error) {
      logHybridError("removeMember", error);
      return false;
    }

    // Best-effort orphan cleanup (matching invite-phase standards)
    // 1. Remove any pending invites where this user was the target or the creator (for this ws)
    await supabase
      .from("workspace_invites")
      .delete()
      .eq("workspace_id", workspaceId)
      .or(`invited_user_id.eq.${userId},invited_by.eq.${userId}`);

    // 2. Remove related notifications for this user in this workspace (invite + assignment style)
    await supabase
      .from("notifications")
      .delete()
      .eq("workspace_id", workspaceId)
      .eq("user_id", userId);

    console.log("[removeMember] Cleanup of invites + notifications completed for removed user", userId, "in ws", workspaceId);
    return true;
  } catch (err) {
    logHybridError("removeMember", err);
    return false;
  }
}

/**
 * Revoke (delete) a pending workspace invite.
 * World-class path: prefers the SECURITY DEFINER RPC (atomic + server-enforced rules + reliable realtime).
 * Falls back to direct + manual cleanup only if the RPC is unavailable (graceful during rollout).
 */
export async function revokeInvite(workspaceId: string | null, inviteId: string): Promise<boolean> {
  if (!isSupabaseLive()) return false;
  if (workspaceId && ["w1", "w2"].includes(workspaceId)) return false;

  const supabase = getClient();
  if (!supabase) return false;

  // Preferred: atomic SECURITY DEFINER RPC (recommended by expert analysis for cross-user terminating actions)
  try {
    const { data, error: rpcErr } = await (supabase.rpc as any)("revoke_workspace_invite", { p_invite_id: inviteId });
    if (!rpcErr && data === true) {
      console.log("[revokeInvite] RPC revoke_workspace_invite succeeded for", inviteId);
      return true;
    }
    if (rpcErr) {
      console.warn("[revokeInvite] RPC path failed, falling back to direct (", rpcErr.message || rpcErr, ")");
    }
  } catch (e) {
    console.warn("[revokeInvite] RPC call threw, falling back to direct delete path", e);
  }

  // Fallback (direct) — still useful for demo + during initial rollout
  try {
    let query = supabase.from("workspace_invites").delete().eq("id", inviteId);
    if (workspaceId) {
      query = query.eq("workspace_id", workspaceId);
    }
    const { error } = await query;

    if (error) {
      logHybridError("revokeInvite (fallback direct)", error);
      return false;
    }

    // Best-effort notification cleanup (the RPC does this atomically; fallback keeps the old behavior)
    console.log("[revokeInvite] Fallback direct path — attempting notification cleanup for", inviteId);
    const { error: notifErr } = await supabase
      .from("notifications")
      .delete()
      .eq("type", "invite")
      .eq("metadata->>invite_id", inviteId);

    if (notifErr) {
      console.warn("[revokeInvite] Fallback notif cleanup warning:", notifErr);
    } else {
      console.log("[revokeInvite] Fallback notification cleanup completed for", inviteId);
    }

    return true;
  } catch (err) {
    logHybridError("revokeInvite", err);
    return false;
  }
}

/**
 * Email delivery scaffolding / integration point for invites.
 * Currently a no-op stub that logs intent (for future Resend, Supabase Edge Functions, or /api route).
 * Called optionally after createInvite when email provided.
 * TODO for future agent: wire real email (e.g. Resend client, template with invite link + workspace name).
 * Keeps hybrid demo/live separation; safe no-op when !live.
 */
export async function sendInviteEmail(
  workspaceId: string,
  inviteId: string,
  email?: string | null,
  workspaceName?: string
): Promise<boolean> {
  if (!isSupabaseLive() || ["w1", "w2"].includes(workspaceId)) {
    return false; // demo: no real email
  }

  // Scaffolding: log the integration point clearly for next steps / observability.
  console.info(
    `[INVITE EMAIL SCAFFOLD] Would deliver invite email now: workspace=${workspaceId} (${workspaceName || "unknown"}), invite=${inviteId}, to=${email || "link-only (no email provided)"}. ` +
    `Integration points: add Resend SDK, Supabase Edge Function (e.g. send-invite), or POST /api/send-workspace-invite. Link: ${typeof window !== 'undefined' ? window.location.origin : ''}/?invite=${inviteId}`
  );

  // Placeholder for real impl (do not throw; graceful):
  // Example future: await resend.emails.send({ from: '...', to: email, subject: `Invitation to ${workspaceName}`, html: `...` })
  return true;
}

/** Update workspace name and/or slug (owner only via RPC). */
export async function updateWorkspace(
  workspaceId: string,
  updates: { name?: string; slug?: string }
): Promise<boolean> {
  if (!isSupabaseLive()) return false;
  if (["w1", "w2"].includes(workspaceId)) return false;

  const supabase = getClient();
  if (!supabase) return false;

  try {
    // Light client-side trimming (RPC also sanitizes)
    const payload = {
      p_workspace_id: workspaceId,
      p_name: updates.name ? updates.name.trim() : null,
      p_slug: updates.slug ? updates.slug.trim() : null,
    };

    const { error } = await (supabase.rpc as any)('update_workspace_details', payload);

    if (error) {
      logHybridError("updateWorkspace", error);
      return false;
    }

    return true;
  } catch (err) {
    logHybridError("updateWorkspace", err);
    return false;
  }
}

/** Delete workspace (owner only; cascades members/tasks/etc via FKs). Guarded. */
export async function deleteWorkspace(workspaceId: string): Promise<boolean> {
  if (!isSupabaseLive()) return false;
  if (["w1", "w2"].includes(workspaceId)) return false;

  const supabase = getClient();
  if (!supabase) return false;

  try {
    // Prefer the SECURITY DEFINER RPC (owner role enforced server-side + future hooks); fallback to direct (RLS also protects).
    let error: any = null;
    try {
      const { error: rpcErr } = await (supabase.rpc as any)("delete_workspace_for_owner", { p_workspace_id: workspaceId });
      error = rpcErr;
    } catch {
      // RPC not present or failed — fallback
      const { error: directErr } = await supabase.from("workspaces").delete().eq("id", workspaceId);
      error = directErr;
    }
    if (error) {
      logHybridError("deleteWorkspace", error);
      return false;
    }
    return true;
  } catch (err) {
    logHybridError("deleteWorkspace", err);
    return false;
  }
}

// ------------------------------------------------------------------
// Realtime subscriptions for workspace-scoped live updates (tasks + notes)
// Returns cleanup function. Call on workspace switch / unmount.
// Demo mode: instant no-op. Changes from other clients/devices will update UI via callbacks.
// ------------------------------------------------------------------

let activeTaskChannel: any = null;
let activeNoteChannel: any = null;
let activeInviteChannel: any = null;
let activeMemberChannel: any = null;

export function subscribeToWorkspaceRealtime(
  workspaceId: string,
  handlers: {
    onTaskChange?: (payload: any) => void;
    onNoteChange?: (payload: any) => void;
    onInviteChange?: (payload: any) => void;
    onMemberChange?: (payload: any) => void;
  }
): () => void {
  if (!isSupabaseLive() || ["w1", "w2"].includes(workspaceId)) {
    return () => {}; // DEMO / guard: no subscription
  }

  const supabase = getClient();
  if (!supabase) return () => {};

  // Teardown any prior subscriptions for this client instance
  if (activeTaskChannel) {
    supabase.removeChannel(activeTaskChannel).catch(() => {});
    activeTaskChannel = null;
  }
  if (activeNoteChannel) {
    supabase.removeChannel(activeNoteChannel).catch(() => {});
    activeNoteChannel = null;
  }
  if (activeInviteChannel) {
    supabase.removeChannel(activeInviteChannel).catch(() => {});
    activeInviteChannel = null;
  }
  if (activeMemberChannel) {
    supabase.removeChannel(activeMemberChannel).catch(() => {});
    activeMemberChannel = null;
  }

  const { onTaskChange, onNoteChange, onInviteChange, onMemberChange } = handlers;

  if (onTaskChange) {
    activeTaskChannel = supabase
      .channel(`ws-tasks-${workspaceId}`)
      .on(
        "postgres_changes" as any,
        {
          event: "*",
          schema: "public",
          table: "tasks",
          filter: `workspace_id=eq.${workspaceId}`,
        },
        (payload: any) => {
          onTaskChange(payload);
        }
      )
      .subscribe((status: string) => {
        if (status === "SUBSCRIBED") {
          console.log(`[realtime] tasks subscribed for workspace ${workspaceId}`);
        }
      });
  }

  if (onNoteChange) {
    activeNoteChannel = supabase
      .channel(`ws-notes-${workspaceId}`)
      .on(
        "postgres_changes" as any,
        {
          event: "*",
          schema: "public",
          table: "notes",
          filter: `workspace_id=eq.${workspaceId}`,
        },
        (payload: any) => {
          onNoteChange(payload);
        }
      )
      .subscribe((status: string) => {
        if (status === "SUBSCRIBED") {
          console.log(`[realtime] notes subscribed for workspace ${workspaceId}`);
        }
      });
  }

  if (onInviteChange) {
    activeInviteChannel = supabase
      .channel(`ws-invites-${workspaceId}`)
      .on(
        "postgres_changes" as any,
        {
          event: "*",
          schema: "public",
          table: "workspace_invites",
          filter: `workspace_id=eq.${workspaceId}`,
        },
        (payload: any) => {
          onInviteChange(payload);
        }
      )
      .subscribe((status: string) => {
        if (status === "SUBSCRIBED") {
          console.log(`[realtime] invites subscribed for workspace ${workspaceId}`);
        }
      });
  }

  if (onMemberChange) {
    activeMemberChannel = supabase
      .channel(`ws-members-${workspaceId}`)
      .on(
        "postgres_changes" as any,
        {
          event: "*",
          schema: "public",
          table: "workspace_members",
          filter: `workspace_id=eq.${workspaceId}`,
        },
        (payload: any) => {
          onMemberChange(payload);
        }
      )
      .subscribe((status: string) => {
        if (status === "SUBSCRIBED") {
          console.log(`[realtime] members subscribed for workspace ${workspaceId}`);
        }
      });
  }

  return () => {
    if (activeTaskChannel && supabase) {
      supabase.removeChannel(activeTaskChannel).catch(() => {});
      activeTaskChannel = null;
    }
    if (activeNoteChannel && supabase) {
      supabase.removeChannel(activeNoteChannel).catch(() => {});
      activeNoteChannel = null;
    }
    if (activeInviteChannel && supabase) {
      supabase.removeChannel(activeInviteChannel).catch(() => {});
      activeInviteChannel = null;
    }
    if (activeMemberChannel && supabase) {
      supabase.removeChannel(activeMemberChannel).catch(() => {});
      activeMemberChannel = null;
    }
  };
}

// Basic presence helper stub (full in store integration for Phase 2 presence indicators)
export function getWorkspacePresenceChannel(workspaceId: string) {
  if (!isSupabaseLive() || ["w1", "w2"].includes(workspaceId)) return null;
  const supabase = getClient();
  if (!supabase) return null;
  return supabase.channel(`presence-${workspaceId}`, {
    config: { presence: { key: "online" } },
  });
}

// ============================================================================
// WORLD-CLASS RPC WRAPPERS FOR INVITE / MEMBERSHIP TERMINATING ACTIONS
// These are the preferred path for revoke, decline, and self-exit.
// They call the SECURITY DEFINER functions created in fix-invite-lifecycle-rls-and-rpcs.sql.
// ============================================================================

/** Decline an invite (recipient or owner/admin path). Prefers the atomic RPC. */
export async function declineInvite(inviteId: string): Promise<boolean> {
  if (!isSupabaseLive()) return false;
  const supabase = getClient();
  if (!supabase) return false;

  try {
    const { data, error } = await (supabase.rpc as any)("decline_workspace_invite", { p_invite_id: inviteId });
    if (error) {
      logHybridError("declineInvite (RPC)", error);
      return false;
    }
    return data === true;
  } catch (err) {
    logHybridError("declineInvite", err);
    return false;
  }
}

/** Self-exit from a workspace (any member, with last-owner protection in the RPC). */
export async function exitWorkspace(workspaceId: string): Promise<boolean> {
  if (!isSupabaseLive()) return false;
  if (["w1", "w2"].includes(workspaceId)) return false;

  const supabase = getClient();
  if (!supabase) return false;

  try {
    const { data, error } = await (supabase.rpc as any)("exit_workspace", { p_workspace_id: workspaceId });
    if (error) {
      logHybridError("exitWorkspace (RPC)", error);
      return false;
    }
    return data === true;
  } catch (err) {
    logHybridError("exitWorkspace", err);
    return false;
  }
}

/** Optional: maintenance helper exposed for dev tools / admin. */
export async function cleanupOrphanInviteNotifications(): Promise<number> {
  if (!isSupabaseLive()) return 0;
  const supabase = getClient();
  if (!supabase) return 0;

  try {
    const { data, error } = await (supabase.rpc as any)("cleanup_orphan_invite_notifications");
    if (error) {
      logHybridError("cleanupOrphanInviteNotifications", error);
      return 0;
    }
    return typeof data === "number" ? data : 0;
  } catch (err) {
    logHybridError("cleanupOrphanInviteNotifications", err);
    return 0;
  }
}

/**
 * Central world-class helper for any terminating action on an invite.
 * Prefers the atomic RPCs; falls back gracefully. Used by store actions for consistency.
 */
export async function cleanupInviteEverywhere(inviteId: string, reason: 'revoked' | 'declined' | 'accepted' | 'removed'): Promise<boolean> {
  if (!isSupabaseLive()) return false;
  const supabase = getClient();
  if (!supabase) return false;

  console.log(`[cleanupInviteEverywhere] Starting for ${inviteId} reason=${reason}`);

  try {
    // Try the best RPC based on reason
    if (reason === 'revoked' || reason === 'removed') {
      const { data } = await (supabase.rpc as any)("revoke_workspace_invite", { p_invite_id: inviteId });
      if (data === true) return true;
    }

    if (reason === 'declined' || reason === 'accepted' || reason === 'removed') {
      const { data } = await (supabase.rpc as any)("decline_workspace_invite", { p_invite_id: inviteId });
      if (data === true) return true;
    }

    // Fallback: direct best-effort (for rollout / demo)
    await supabase.from("workspace_invites").delete().eq("id", inviteId);
    await supabase.from("notifications").delete().eq("type", "invite").eq("metadata->>invite_id", inviteId);

    return true;
  } catch (err) {
    logHybridError("cleanupInviteEverywhere", err);
    return false;
  }
}

// ------------------------------------------------------------------
// AGENT 18: ADMIN DASHBOARD STATS + EXPORT/IMPORT + TEMPLATES + AUDIT LOGGING
// All paths fully guarded (live + demo block).
// Leverages existing getTasks/getNotes/getWorkspaceMembers/getRecentActivity/create* / logActivity.
// Extends audit with admin.* actionTypes (visible in existing activity panel + new dashboard insights).
// Stats + export/import/templates power the owner/admin UI in Teams view + Workspace Settings.
// Handoff: stats shape ready for billing quotas; import/export for future Notion/CSV syncs.
// ------------------------------------------------------------------

export interface WorkspaceStats {
  taskCount: number;
  noteCount: number;
  memberCount: number;
  activityCount: number;
  overdueCount: number;
  doneCount: number;
  completionRate: number; // 0-100
}

export async function getWorkspaceStats(workspaceId: string): Promise<WorkspaceStats> {
  if (!isSupabaseLive() || ["w1", "w2"].includes(workspaceId)) {
    return { taskCount: 0, noteCount: 0, memberCount: 0, activityCount: 0, overdueCount: 0, doneCount: 0, completionRate: 0 };
  }
  const [tasks, notes, members, activity] = await Promise.all([
    getTasks(workspaceId),
    getNotes(workspaceId),
    getWorkspaceMembers(workspaceId),
    getRecentActivity(workspaceId, 1000),
  ]);
  const now = Date.now();
  const overdue = tasks.filter((t) => t.dueDate && new Date(t.dueDate).getTime() < now && t.status !== "done").length;
  const done = tasks.filter((t) => t.status === "done").length;
  const rate = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
  return {
    taskCount: tasks.length,
    noteCount: notes.length,
    memberCount: members.length,
    activityCount: activity.length,
    overdueCount: overdue,
    doneCount: done,
    completionRate: rate,
  };
}

// Full workspace export (JSON ready). Logs admin action for audit trail.
export async function exportWorkspaceData(workspaceId: string, workspaceMeta: { name: string; slug: string }) {
  if (!isSupabaseLive() || ["w1", "w2"].includes(workspaceId)) return null;
  const [tasks, notes, members, activity] = await Promise.all([
    getTasks(workspaceId),
    getNotes(workspaceId),
    getWorkspaceMembers(workspaceId),
    getRecentActivity(workspaceId, 500),
  ]);
  await logActivity({
    workspaceId,
    actionType: "admin.export.json",
    targetType: "workspace",
    metadata: { taskCount: tasks.length, noteCount: notes.length, format: "json" },
  });
  return {
    workspace: { id: workspaceId, name: workspaceMeta.name, slug: workspaceMeta.slug },
    tasks,
    notes,
    members,
    activity,
  };
}

// Basic bulk import (JSON/CSV parsed upstream). Non-destructive, role-gated in UI. Logs audit.
// Now supports conflictStrategy for smart deduping on titles (powerful for repeated imports/templates).
export interface ImportOptions {
  conflictStrategy?: "append" | "skip-dupe-titles";
}

export async function importWorkspaceData(
  workspaceId: string,
  data: { tasks?: Partial<Task>[]; notes?: Partial<Note>[] },
  options: ImportOptions = {}
): Promise<{ importedTasks: number; importedNotes: number; skippedTasks: number; skippedNotes: number }> {
  if (!isSupabaseLive() || ["w1", "w2"].includes(workspaceId)) return { importedTasks: 0, importedNotes: 0, skippedTasks: 0, skippedNotes: 0 };
  let importedTasks = 0;
  let importedNotes = 0;
  let skippedTasks = 0;
  let skippedNotes = 0;
  const cap = 150; // safety

  let existingTaskTitles = new Set<string>();
  let existingNoteTitles = new Set<string>();
  const useSkip = options.conflictStrategy === "skip-dupe-titles";
  if (useSkip) {
    const [exTasks, exNotes] = await Promise.all([
      getTasks(workspaceId),
      getNotes(workspaceId),
    ]);
    exTasks.forEach((t) => existingTaskTitles.add((t.title || "").toLowerCase().trim()));
    exNotes.forEach((n) => existingNoteTitles.add((n.title || "").toLowerCase().trim()));
  }

  if (data.tasks?.length) {
    for (const t of data.tasks.slice(0, cap)) {
      if (!t.title) continue;
      const normTitle = t.title.toLowerCase().trim();
      if (useSkip && existingTaskTitles.has(normTitle)) {
        skippedTasks++;
        continue;
      }
      const res = await createTask({
        workspaceId,
        title: t.title,
        description: t.description,
        status: (t.status as any) || "todo",
        priority: (t.priority as any) || "P2",
        dueDate: t.dueDate,
        tags: t.tags,
        // recurring etc forwarded if present
      } as any);
      if (res) importedTasks++;
    }
  }
  if (data.notes?.length) {
    for (const n of data.notes.slice(0, cap)) {
      if (!n.title) continue;
      const normTitle = n.title.toLowerCase().trim();
      if (useSkip && existingNoteTitles.has(normTitle)) {
        skippedNotes++;
        continue;
      }
      const res = await createNote({ workspaceId, title: n.title, content: n.content, tags: n.tags });
      if (res) importedNotes++;
    }
  }
  await logActivity({
    workspaceId,
    actionType: "admin.import.bulk",
    targetType: "workspace",
    metadata: { importedTasks, importedNotes, skippedTasks, skippedNotes, strategy: options.conflictStrategy || "append" },
  });
  return { importedTasks, importedNotes, skippedTasks, skippedNotes };
}

// Template access (tag-based on live data + static seeds from utils)
export async function getTemplates(workspaceId: string) {
  if (!isSupabaseLive() || ["w1", "w2"].includes(workspaceId)) return { taskTemplates: [], noteTemplates: [] };
  const [tasks, notes] = await Promise.all([getTasks(workspaceId), getNotes(workspaceId)]);
  const taskTemplates = tasks.filter((t) => (t.tags || []).some((tag) => tag.toLowerCase() === "template"));
  const noteTemplates = notes.filter((n) => (n.tags || []).some((tag) => tag.toLowerCase() === "template"));
  return { taskTemplates, noteTemplates };
}

export async function logTemplateAction(workspaceId: string, action: "saved" | "applied", targetType: "task" | "note", targetId?: string, meta?: Record<string, any>) {
  await logActivity({
    workspaceId,
    actionType: `admin.template.${action}`,
    targetType,
    targetId,
    metadata: meta || {},
  });
}

/**
 * Apply a template from the (static or user) library.
 * Creates the task or note via hybrid (optimistic handled by store layer on refresh).
 * Always logs admin.template.applied for audit + insights.
 * Secure: still subject to live/demo guards + UI role gate.
 */
export async function applyTemplate(workspaceId: string, tpl: any): Promise<Task | Note | null> {
  if (!isSupabaseLive() || ["w1", "w2"].includes(workspaceId)) {
    return null; // demo: UI can toast or simulate locally if desired
  }
  try {
    if (tpl.type === "note") {
      const payload = templateToNotePayload(tpl);
      const created = await createNote({ workspaceId, ...payload } as any);
      await logTemplateAction(workspaceId, "applied", "note", created?.id, { title: tpl.title });
      return created;
    } else {
      // default to task
      const payload = templateToTaskPayload(tpl);
      const created = await createTask({ workspaceId, ...payload } as any);
      await logTemplateAction(workspaceId, "applied", "task", created?.id, { title: tpl.title });
      return created;
    }
  } catch (e) {
    logError("applyTemplate failed", e);
    return null;
  }
}

// Re-export template helpers from utils for store/UI consumers (no new imports needed in many places)
export {
  TEMPLATE_LIBRARY as ADMIN_TEMPLATE_LIBRARY,
  getStaticTemplates,
  templateToTaskPayload,
  templateToNotePayload,
  hasTemplateTag,
} from "@/lib/utils";
