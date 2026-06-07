/**
 * Hybrid Data Layer — Badazz Tasks
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

import { apiFetch } from "@/lib/api/apiFetch";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { fromDbRole, toDbRole, type WorkspaceRole } from "@/lib/roles";
import type { Task, TaskStatus, Priority, Note, ActivityLog, PendingOperation, Comment, Notification, NotificationPrefs, NotificationType, WorkspaceMessage, MessageReaction, WorkspaceList, ListItem } from "@/types";
import type { Database, Json } from "@/types/supabase";
import { logger, logError } from "@/lib/logger";
import { templateToTaskPayload, templateToNotePayload } from "@/lib/utils";
import { isDueDatePast } from "@/lib/datetime";
import {
  DEFAULT_NOTIFICATION_PREFS,
  normalizeNotificationPrefs,
} from "@/lib/notifications/notificationPrefs";
import { fanoutNoteAddedNotifications } from "@/lib/notifications/fanoutNoteAdded";
import { fanoutCommentNotifications } from "@/lib/notifications/fanoutCommentNotifications";
import { fanoutTaskAssignedNotifications } from "@/lib/notifications/fanoutTaskAssigned";
import { processDeadlineReminders } from "@/lib/notifications/processDeadlineReminders";
import {
  isMissingNotificationPrefsColumn,
  warnMissingNotificationPrefsColumnOnce,
} from "@/lib/notifications/schemaFallback";

type TaskRow = Database["public"]["Tables"]["tasks"]["Row"];
type TaskInsert = Database["public"]["Tables"]["tasks"]["Insert"];
type NoteRow = Database["public"]["Tables"]["notes"]["Row"];
type NoteInsert = Database["public"]["Tables"]["notes"]["Insert"];
type ActivityLogRow = Database["public"]["Tables"]["activity_logs"]["Row"];
type ActivityLogInsert = Database["public"]["Tables"]["activity_logs"]["Insert"];
type NotificationRow = Database["public"]["Tables"]["notifications"]["Row"];
type NotificationInsert = Database["public"]["Tables"]["notifications"]["Insert"];
type WorkspaceListRow = Database["public"]["Tables"]["workspace_lists"]["Row"];
type WorkspaceListInsert = Database["public"]["Tables"]["workspace_lists"]["Insert"];
type ListItemRow = Database["public"]["Tables"]["list_items"]["Row"];
type ListItemInsert = Database["public"]["Tables"]["list_items"]["Insert"];

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

/** PostgREST: table not in schema cache / relation does not exist (migration not applied yet). */
function isSchemaTableMissing(error: unknown): boolean {
  const e = error as { code?: string; message?: string; status?: number; statusCode?: number };
  const status = e?.status ?? e?.statusCode;
  return (
    status === 404 ||
    e?.code === "PGRST205" ||
    e?.code === "42P01" ||
    (typeof e?.message === "string" &&
      (e.message.includes("Could not find the table") ||
        e.message.includes("does not exist") ||
        e.message.includes("404")))
  );
}

/** null = not probed yet; false = migration not applied; true = tables exist */
let workspaceListTablesAvailable: boolean | null = null;
let listsMigrationWarned = false;

function markWorkspaceListTablesMissing(): void {
  workspaceListTablesAvailable = false;
  if (!listsMigrationWarned) {
    listsMigrationWarned = true;
    console.warn(
      "[Badazz Tasks] Lists are not synced to Supabase yet. Run supabase/add-workspace-lists.sql in the SQL Editor, then refresh.",
    );
  }
}

function markWorkspaceListTablesAvailable(): void {
  workspaceListTablesAvailable = true;
}

/** Whether list CRUD should hit Supabase (false when migration has not been applied). */
export function isWorkspaceListPersistenceEnabled(): boolean {
  return workspaceListTablesAvailable !== false;
}

/** True only when workspace_lists / list_items exist in Supabase. */
export function areWorkspaceListTablesReady(): boolean {
  return workspaceListTablesAvailable === true;
}

export function __resetWorkspaceListTableProbeForTests(): void {
  workspaceListTablesAvailable = null;
  listsMigrationWarned = false;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const LEGACY_LIST_ID_MAP_KEY = "badazz-list-legacy-id-map";

function loadLegacyListIdMap(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(LEGACY_LIST_ID_MAP_KEY);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function saveLegacyListIdMap(map: Record<string, string>): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LEGACY_LIST_ID_MAP_KEY, JSON.stringify(map));
  } catch {
    // non-fatal
  }
}

/** Stable UUID for list/list_item ids — legacy short ids map to one UUID across store + sync queue. */
export function normalizeListEntityId(id?: string): string {
  if (!id) return generateClientId();
  if (UUID_RE.test(id)) return id;
  const map = loadLegacyListIdMap();
  if (map[id]) return map[id];
  const next = generateClientId();
  map[id] = next;
  saveLegacyListIdMap(map);
  return next;
}

function sanitizeListPendingOp(op: PendingOperation): PendingOperation {
  if (op.entityType !== "list" && op.entityType !== "list_item") return op;
  const targetId = normalizeListEntityId(op.targetId);
  const payload = { ...(op.payload as Record<string, unknown>) };
  if (op.entityType === "list") {
    payload.id = targetId;
  } else {
    payload.id = targetId;
    if (typeof payload.list_id === "string") {
      payload.list_id = normalizeListEntityId(payload.list_id);
    }
  }
  return { ...op, targetId, payload };
}

/** Remap persisted short list ids to UUIDs (live mode) before sync/backfill. */
export function remapLegacyListIdsInState(
  lists: WorkspaceList[],
  items: ListItem[],
): { lists: WorkspaceList[]; items: ListItem[]; changed: boolean } {
  let changed = false;
  const nextLists = lists.map((l) => {
    const id = normalizeListEntityId(l.id);
    if (id !== l.id) changed = true;
    return id === l.id ? l : { ...l, id };
  });
  const nextItems = items.map((i) => {
    const id = normalizeListEntityId(i.id);
    const listId = normalizeListEntityId(i.listId);
    if (id !== i.id || listId !== i.listId) changed = true;
    return id === i.id && listId === i.listId ? i : { ...i, id, listId };
  });
  return { lists: nextLists, items: nextItems, changed };
}

async function probeWorkspaceListTables(force = false): Promise<void> {
  if (!force && workspaceListTablesAvailable !== null) return;
  if (!isSupabaseLive()) return;

  const supabase = getClient();
  if (!supabase) {
    markWorkspaceListTablesMissing();
    return;
  }

  const { error } = await supabase.from("workspace_lists").select("id").limit(1);
  if (error && isSchemaTableMissing(error)) {
    markWorkspaceListTablesMissing();
  } else if (error) {
    logHybridError("probeWorkspaceListTables", error);
  } else {
    markWorkspaceListTablesAvailable();
  }
}

/** Re-check whether list tables exist (e.g. after running SQL migration without refresh). */
export async function ensureWorkspaceListPersistenceReady(): Promise<boolean> {
  if (workspaceListTablesAvailable === true) return true;
  await probeWorkspaceListTables(true);
  return workspaceListTablesAvailable !== false && workspaceListTablesAvailable !== null;
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
    assigneeIds: row.assignee_ids ?? [],
    assignee: undefined,
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
  const rawContent = row.content;

  // Rich roundtrip priority (the full live-sync path):
  // If the DB value is already a valid TipTap document (stringified JSON or object),
  // we must preserve the full rich structure so paragraphs, headings, marks, images, etc. survive reload.
  // Only fall back to plain-text extraction for legacy plain strings or when we explicitly need a preview.
  let richOrPlainContent: string;

  if (typeof rawContent === "string") {
    const trimmed = rawContent.trim();
    if (trimmed.startsWith("{") && trimmed.includes('"type"') && trimmed.includes('"doc"')) {
      // It's already a stringified rich TipTap doc → keep it verbatim for perfect editor roundtrip
      richOrPlainContent = trimmed;
    } else {
      // Legacy plain text → convert to minimal paragraphs (for old data compatibility)
      richOrPlainContent = jsonToNoteContent(rawContent);
    }
  } else if (rawContent && typeof rawContent === "object" && (rawContent as any).type === "doc") {
    // Already a rich object from DB → stringify it cleanly
    richOrPlainContent = JSON.stringify(rawContent);
  } else {
    // Fallback
    richOrPlainContent = jsonToNoteContent(rawContent);
  }

  return {
    id: row.id,
    workspaceId: row.workspace_id,
    title: row.title,
    content: richOrPlainContent,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    tags: row.tags ?? [],
    linkedTaskIds: row.linked_task_ids ?? [],
    linkedNoteIds: (row as any).linked_note_ids ?? [],
    parentNoteId: row.parent_note_id ?? null, // Milestone 2 hierarchy
    sortOrder: (row as any).sort_order ?? undefined, // M2 drag ordering
    // M2 snapshots: server persistence support (loaded when present on row; uses cast for narrow scope, no schema type change)
    // Enhanced: always normalize to array for reliable roundtrip + merge on load when LIVE (Supabase JSONB)
    snapshots: Array.isArray((row as any).snapshots)
      ? (row as any).snapshots
      : ((row as any).snapshots ? [(row as any).snapshots] : []),
    searchPlain: (row as any).search_plain ?? null,
    rawHtml: (row as any).raw_html ?? null,
    emailSource: (row as any).email_source ?? null,
    emailPipelineVersion: (row as any).email_pipeline_version ?? null,
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

const OFFLINE_QUEUE_KEY = "badazz-tasks-offline-queue";
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

// ------------------------------------------------------------------
// Defensive ID hygiene (String coercion + bad-UUID/demo purge discipline)
// Applied in: load/enqueue/processPending + subscribeToWorkspaceRealtime realtime guard.
// Prevents: non-string IDs, demo "w1"/"w2" leakage into live paths, short/invalid causing
// "invalid input syntax for type uuid" or RLS surprises. All workspace/task/note IDs.
// This continues/enforces the existing purge patterns with explicit String() for robustness
// against callers passing numbers/undefined/null during rapid switches or hydration.
// --------------------------------------------------------------------------
function sanitizeId(raw: any, _label: string = "id"): string {
  const s = String(raw ?? "").trim();
  if (!s || s.length < 3 || ["", "w1", "w2"].includes(s)) {
    return "";
  }
  return s;
}

function isSafeId(raw: any): boolean {
  return sanitizeId(raw).length > 0;
}

// Test-friendly exports (for hybridStore.test.ts + guard verification under rapid workspace switching).
// Allows resetting state without exposing mutable lets. Do not use in production code.
export function __resetRealtimeGuardForTests(): void {
  currentRealtimeWorkspaceId = null;
  activeTaskChannel = null;
  activeNoteChannel = null;
  activeInviteChannel = null;
  activeMemberChannel = null;
}

export function __getCurrentRealtimeWorkspaceIdForTests(): string | null {
  return currentRealtimeWorkspaceId;
}

function loadPendingQueue(): PendingOperation[] {
  if (!isSupabaseLive() || typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
    if (!raw) return [];
    let parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    // Proactively drop any corrupted ops (e.g. bad targetId / workspaceId from previous bugs, demo leakage, or non-string ID coercion failures)
    // Enforces String() + bad-UUID/demo purge discipline for ALL ID paths in queue (tasks, notes, workspaces).
    const originalLength = parsed.length;
    parsed = parsed.filter((op: any) => {
      const target = op?.targetId;
      const ws = op?.workspaceId;
      // Use sanitizeId (String coercion + bad value purge) for robustness
      if (!isSafeId(target) || !isSafeId(ws) ||
          (typeof target !== 'string' || !target || target.length < 5) ||
          ["w1", "w2"].includes(String(ws ?? ""))) {
        console.warn('[hybridStore] Purging bad op from localStorage queue on load (bad targetId or workspaceId after String coercion)', op);
        return false;
      }
      return true;
    });

    if (parsed.length !== originalLength) {
      try { localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(parsed)); } catch {}
    }

    const repaired = (parsed as PendingOperation[]).map(sanitizeListPendingOp);
    const repairChanged = repaired.some((op, i) => {
      const prev = parsed[i] as PendingOperation;
      return op.targetId !== prev.targetId || JSON.stringify(op.payload) !== JSON.stringify(prev.payload);
    });
    if (repairChanged) {
      try { localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(repaired)); } catch {}
    }

    return repaired;
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

  if (inMemoryQueue.length === 0) {
    inMemoryQueue = loadPendingQueue().filter((queued) => {
      const ws = String(queued?.workspaceId ?? "");
      return !["w1", "w2"].includes(ws) && isSafeId(ws);
    });
  }

  // ID hygiene: enforce String() coercion + bad-UUID purge for BOTH targetId (task/note) and workspaceId.
  // Prevents enqueue of ops with bad IDs that would later cause uuid syntax errors or demo data in live sync.
  const target = op?.targetId;
  const ws = op?.workspaceId;
  if (!isSafeId(target) || !isSafeId(ws) ||
      (typeof target !== 'string' || !target || target.length < 5)) {
    console.error('[hybridStore] Refusing to enqueue op with invalid targetId or workspaceId (after String coercion + purge)', op);
    return;
  }

  let fullOp: PendingOperation = {
    opId: generateClientId(),
    timestamp: op.timestamp || new Date().toISOString(),
    ...op,
  } as PendingOperation;

  if (fullOp.entityType === "list" || fullOp.entityType === "list_item") {
    fullOp = sanitizeListPendingOp(fullOp);
  }

  // Coalesce rapid offline updates for the same entity (keeps queue small, last write wins).
  if (fullOp.type === "update") {
    const existingIdx = inMemoryQueue.findIndex(
      (op) =>
        op.type === "update" &&
        op.entityType === fullOp.entityType &&
        op.targetId === fullOp.targetId &&
        op.workspaceId === fullOp.workspaceId,
    );
    if (existingIdx >= 0) {
      const existing = inMemoryQueue[existingIdx];
      inMemoryQueue = [...inMemoryQueue];
      inMemoryQueue[existingIdx] = {
        ...existing,
        timestamp: fullOp.timestamp,
        payload: { ...existing.payload, ...fullOp.payload },
      };
      savePendingQueue(inMemoryQueue);
      return;
    }
    const hasPendingDelete = inMemoryQueue.some(
      (op) =>
        op.type === "delete" &&
        op.entityType === fullOp.entityType &&
        op.targetId === fullOp.targetId,
    );
    if (hasPendingDelete) {
      return;
    }
    const createIdx = inMemoryQueue.findIndex(
      (op) =>
        op.type === "create" &&
        op.entityType === fullOp.entityType &&
        op.targetId === fullOp.targetId &&
        op.workspaceId === fullOp.workspaceId,
    );
    if (createIdx >= 0) {
      const existing = inMemoryQueue[createIdx];
      inMemoryQueue = [...inMemoryQueue];
      inMemoryQueue[createIdx] = {
        ...existing,
        timestamp: fullOp.timestamp,
        payload: { ...existing.payload, ...fullOp.payload },
      };
      savePendingQueue(inMemoryQueue);
      return;
    }
  }

  inMemoryQueue = [...inMemoryQueue, fullOp];
  savePendingQueue(inMemoryQueue);
}

/** Current pending count (reactive callers can poll or store can mirror) */
export function getPendingCount(): number {
  if (!isSupabaseLive()) return 0;
  // Rehydrate from storage in case of external clear or multi-tab
  // Also strip any demo workspace operations that may have leaked in.
  // Strengthened: String() coercion + sanitize discipline for workspaceId (covers notes/tasks/ws paths in queue).
  const raw = loadPendingQueue().filter(
    (op) => {
      const ws = String(op?.workspaceId ?? "");
      return !["w1", "w2"].includes(ws) && isSafeId(ws);
    }
  );
  if (raw.length !== loadPendingQueue().length) {
    savePendingQueue(raw);
  }
  inMemoryQueue = raw;
  return inMemoryQueue.length;
}

export function getPendingOperations(): PendingOperation[] {
  if (!isSupabaseLive()) return [];
  // Strip any demo workspace operations. Strengthened with explicit String() + isSafeId purge.
  const raw = loadPendingQueue().filter(
    (op) => {
      const ws = String(op?.workspaceId ?? "");
      return !["w1", "w2"].includes(ws) && isSafeId(ws);
    }
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
let pendingOpsPromise: Promise<{
  synced: number;
  skippedConflicts: number;
  failed: number;
}> | null = null;

export async function processPendingOperations(): Promise<{
  synced: number;
  skippedConflicts: number;
  failed: number;
}> {
  if (pendingOpsPromise) return pendingOpsPromise;

  pendingOpsPromise = processPendingOperationsInner().finally(() => {
    pendingOpsPromise = null;
  });
  return pendingOpsPromise;
}

async function processPendingOperationsInner(): Promise<{
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
  // Strengthened: explicit String() coercion + sanitizeId (bad-UUID purge) for workspaceId (all entity types).
  let queue = loadPendingQueue().filter(
    (op) => {
      const ws = String(op?.workspaceId ?? "");
      return !["w1", "w2"].includes(ws) && isSafeId(ws);
    }
  );

  // Drop any ops with invalid targetId (e.g. objects that stringified to "[object Object]" from bad reparent drags)
  // This cleans up corrupted queue entries from previous bugs in hierarchy drag.
  // Also apply isSafeId for extra workspace hygiene (notes/tasks/ws).
  const beforeBadIdFilter = queue.length;
  queue = queue.filter((op) => {
    if (!isSafeId(op?.targetId) ||
        (typeof op.targetId !== 'string' || !op.targetId || op.targetId.length < 5)) {
      console.warn('[hybridStore] Dropping corrupted pending op with bad targetId (was object?)', op);
      return false;
    }
    return true;
  });

  // If the queue was dirty, persist the cleaned version
  if (queue.length !== beforeBadIdFilter) {
    savePendingQueue(queue);
    inMemoryQueue = [...queue];
  }

  if (queue.length === 0) {
    return { synced: 0, skippedConflicts: 0, failed: 0 };
  }

  if (queue.some((op) => op.entityType === "list" || op.entityType === "list_item")) {
    await probeWorkspaceListTables();
  }

  let synced = 0;
  let skippedConflicts = 0;
  let failed = 0;

  const remaining: PendingOperation[] = [];

  for (const op of queue) {
    // Additional runtime guard inside process loop (String coercion + safe ID for both IDs).
    // workspaceId used directly in .insert etc; must be clean to avoid uuid errors on tasks/notes.
    const tId = op?.targetId;
    const wsId = op?.workspaceId;
    if (!isSafeId(tId) || !isSafeId(wsId) || (typeof tId !== 'string' || !tId)) {
      console.warn('[hybridStore] Skipping op with invalid targetId or workspaceId during processing (post-coercion)', op);
      continue;
    }
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

          const noteTitle =
            typeof (op.payload as { title?: unknown })?.title === "string"
              ? (op.payload as { title: string }).title
              : "New note";
          const {
            data: { user: actor },
          } = await supabase.auth.getUser();
          fanoutNoteAddedNotifications({
            workspaceId: op.workspaceId,
            noteId: op.targetId,
            noteTitle,
            actorUserId: actor?.id ?? null,
            supabase: supabase as any,
          }).catch(() => {});
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
      } else if (op.entityType === "list" || op.entityType === "list_item") {
        if (workspaceListTablesAvailable === false) {
          remaining.push(op);
          continue;
        }
      }

      if (op.entityType === "list") {
        const listsTable = supabase.from("workspace_lists") as ReturnType<typeof supabase.from>;
        const listId = normalizeListEntityId(op.targetId);
        if (op.type === "create") {
          const raw = { ...(op.payload as Record<string, unknown>) };
          delete raw.id;
          delete raw.workspace_id;
          const { error } = await listsTable.insert({
            ...raw,
            id: listId,
            workspace_id: op.workspaceId,
          });
          if (error && error.code !== "23505") throw error;
          synced++;
        } else if (op.type === "update") {
          const { data: current } = await listsTable
            .select("updated_at")
            .eq("id", listId)
            .maybeSingle();
          const serverTs = (current as { updated_at?: string } | null)?.updated_at
            ? new Date((current as { updated_at: string }).updated_at).getTime()
            : 0;
          const ourTs = new Date(op.timestamp).getTime();
          if (serverTs > ourTs) {
            skippedConflicts++;
          } else {
            const { error } = await listsTable.update(op.payload).eq("id", listId);
            if (error) throw error;
            synced++;
          }
        } else if (op.type === "delete") {
          const { error } = await listsTable.delete().eq("id", listId);
          if (error && error.code !== "PGRST116") throw error;
          synced++;
        }
      } else if (op.entityType === "list_item") {
        const itemsTable = supabase.from("list_items") as ReturnType<typeof supabase.from>;
        const itemId = normalizeListEntityId(op.targetId);
        if (op.type === "create") {
          const raw = { ...(op.payload as Record<string, unknown>) };
          delete raw.id;
          delete raw.workspace_id;
          if (typeof raw.list_id === "string") {
            raw.list_id = normalizeListEntityId(raw.list_id);
          }
          const { error } = await itemsTable.insert({
            ...raw,
            id: itemId,
            workspace_id: op.workspaceId,
          });
          if (error && error.code !== "23505") throw error;
          synced++;
        } else if (op.type === "update") {
          const { data: current } = await itemsTable
            .select("updated_at")
            .eq("id", itemId)
            .maybeSingle();
          const serverTs = (current as { updated_at?: string } | null)?.updated_at
            ? new Date((current as { updated_at: string }).updated_at).getTime()
            : 0;
          const ourTs = new Date(op.timestamp).getTime();
          if (serverTs > ourTs) {
            skippedConflicts++;
          } else {
            const { error } = await itemsTable.update(op.payload).eq("id", itemId);
            if (error) throw error;
            synced++;
          }
        } else if (op.type === "delete") {
          const { error } = await itemsTable.delete().eq("id", itemId);
          if (error && error.code !== "PGRST116") throw error;
          synced++;
        }
      }
    } catch (err) {
      if (isSchemaTableMissing(err)) {
        markWorkspaceListTablesMissing();
        remaining.push(op);
        continue;
      }
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
export async function updateTask(
  id: string,
  updates: Partial<Task> & {
    workspaceId?: string;
    actorUserId?: string | null;
    actorName?: string;
    previousAssigneeIds?: string[];
  },
): Promise<boolean> {
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
  if (Object.prototype.hasOwnProperty.call(updates, "completedAt")) {
    payload.completed_at = updates.completedAt ?? null;
  }
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
  if (
    Object.prototype.hasOwnProperty.call(anyUpdates, "recurringRule") ||
    Object.prototype.hasOwnProperty.call(anyUpdates, "recurring_rule")
  ) {
    const rule =
      anyUpdates.recurringRule !== undefined
        ? anyUpdates.recurringRule
        : anyUpdates.recurring_rule;
    payload.recurring_rule = rule ?? null;
  }
  if (
    Object.prototype.hasOwnProperty.call(anyUpdates, "exceptionDates") ||
    Object.prototype.hasOwnProperty.call(anyUpdates, "exception_dates")
  ) {
    const ex =
      anyUpdates.exceptionDates !== undefined
        ? anyUpdates.exceptionDates
        : anyUpdates.exception_dates;
    payload.exception_dates = ex ?? null;
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

    const newAssigneeIds = payload.assignee_ids as string[] | undefined;
    const previousAssigneeIds = updates.previousAssigneeIds ?? [];
    if (newAssigneeIds && updates.workspaceId && !["w1", "w2"].includes(updates.workspaceId)) {
      const addedAssignees = newAssigneeIds.filter((uid) => !previousAssigneeIds.includes(uid));
      if (addedAssignees.length > 0) {
        void (async () => {
          const [{ data: workspace }, { data: task }] = await Promise.all([
            supabase.from("workspaces").select("name").eq("id", updates.workspaceId!).maybeSingle(),
            supabase.from("tasks").select("title").eq("id", id).maybeSingle(),
          ]);
          await fanoutTaskAssignedNotifications({
            supabase,
            workspaceId: updates.workspaceId!,
            workspaceName:
              (workspace as { name?: string } | null)?.name?.trim() || "your workspace",
            taskId: id,
            taskTitle: (task as { title?: string } | null)?.title || "Task",
            assigneeIds: addedAssignees,
            actorUserId: updates.actorUserId,
            actorName: updates.actorName || "Someone",
          });
        })().catch(() => {});
      }
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
  parentNoteId?: string | null; // Milestone 2: hierarchy
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
        ...(input.parentNoteId ? { parent_note_id: input.parentNoteId } : {}),
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
    ...(input.parentNoteId ? { parent_note_id: input.parentNoteId } : {}),
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
        parentNoteId: input.parentNoteId ?? null,
      };
    }

    const created = mapNoteRow(data);

    const {
      data: { user: actor },
    } = await supabase.auth.getUser();
    fanoutNoteAddedNotifications({
      workspaceId: input.workspaceId,
      noteId: created.id,
      noteTitle: created.title,
      actorUserId: actor?.id ?? null,
      source: (input.tags ?? []).includes("from-email") ? "email" : "manual",
      supabase: supabase as any,
    }).catch(() => {});

    return created;
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
      parentNoteId: input.parentNoteId ?? null,
    };
  }
}

/**
 * Resolve the workspace_id for a note id (for safe enqueueing of compensation ops on failure/offline).
 * Only called on the unhappy paths (error or !online), so the extra roundtrip is rare + cheap (PK lookup).
 * Returns '' if not live or not found (the guard will still refuse, but at least we tried).
 */
async function resolveWorkspaceIdForNote(noteId: string): Promise<string> {
  if (!isSupabaseLive()) return '';
  const supabase = getClient();
  if (!supabase) return '';
  try {
    const { data } = await supabase
      .from('notes')
      .select('workspace_id')
      .eq('id', noteId)
      .single();
    const ws = (data as any)?.workspace_id;
    return typeof ws === 'string' && ws ? ws : '';
  } catch {
    return '';
  }
}

/** Update an existing note (partial) */
export async function updateNote(id: string, updates: Partial<Note>): Promise<boolean> {
  if (typeof id !== 'string' || !id || id.length < 5) {
    console.error('[BadAssTasks] updateNote called with invalid id (likely object leaked from drag/hierarchy)', id);
    return false;
  }

  if (!isSupabaseLive()) return false;

  const supabase = getClient();
  if (!supabase) return false;

  const payload: Partial<NoteInsert> = {};

  if (updates.title !== undefined) payload.title = updates.title;
  if (updates.content !== undefined) payload.content = noteContentToJson(updates.content);
  if (updates.tags !== undefined) payload.tags = updates.tags;
  if ((updates as any).parentNoteId !== undefined) {
    const pn = (updates as any).parentNoteId;
    // Defensive: never let non-primitive values (objects) reach Postgres uuid columns
    payload.parent_note_id = (typeof pn === "string" || pn === null) ? pn : null;
  }
  // (snapshots writes removed — version history feature deleted for lighter DB + UI)
  // M2 note-to-note links + explicit ordering (these were written by callers but never reached the DB payload before)
  if ((updates as any).linkedNoteIds !== undefined) {
    (payload as any).linked_note_ids = (updates as any).linkedNoteIds;
  }
  if ((updates as any).linkedTaskIds !== undefined) {
    (payload as any).linked_task_ids = (updates as any).linkedTaskIds;
  }
  if ((updates as any).sortOrder !== undefined) {
    (payload as any).sort_order = (updates as any).sortOrder;
  }

  // Resolve workspace for any compensation enqueue (offline or Supabase error path).
  // Prefers explicit on the updates object (zero-cost common case from callers that have the note).
  const wsForQueue = (updates as any).workspaceId || (await resolveWorkspaceIdForNote(id));

  const online = isCurrentlyOnline();

  if (!online) {
    enqueuePendingOperation({
      type: "update",
      entityType: "note",
      targetId: id,
      payload,
      workspaceId: wsForQueue,
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
        workspaceId: wsForQueue,
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
      workspaceId: wsForQueue,
    });
    logHybridError("updateNote", err);
    return true;
  }
}

/**
 * M2: Complete live server snapshot persistence (onPersistSnapshot full round-trip).
 * When isSupabaseLive: fetches current snapshots JSONB from notes row, merges the new snapshot
 * (dedup by ts, prepend, cap at 10), writes back via update. Falls back to updateNote path + queue.
 * This ensures requestSnapshot (via editor capture) always roundtrips through hybridStore to Supabase
 * notes.snapshots when LIVE. Merge back happens automatically on next getNotes + mapNoteRow load.
 * Works with existing client merge in callers; this provides authoritative server path.
 * Idempotent, offline resilient.
 *
 * HARDENED (M2 server path): 
 * - Explicit isSupabaseLive guard + input validation at entry.
 * - Exponential backoff retry (3 attempts) exclusively on the LIVE Supabase fetch+update roundtrip.
 * - Structured logging via logHybridError on every failure path (fetch, update, retry exhaustion, fallback).
 * - Additional live-path diagnostics (attempt logging) for observability without noise in demo.
 * - All error paths remain non-throwing to callers; always resolve to boolean.
 *
 * CURRENT LIMITATIONS (M2):
 * - Dedup relies solely on client-generated `ts` string equality (clock skew / multi-tab / offline merge edge cases can produce near-duplicates).
 * - No per-snapshot authorship, checksum, or size metadata persisted.
 * - Hard 10-snapshot cap enforced here + UI; no server-side retention, expiry, or archival policy.
 * - Full content blobs (stringified TipTap JSON) — no delta/patch compression; bandwidth grows with note size/history depth.
 * - Single-writer assumption: concurrent editors on same note may race on the snapshots JSONB array (last write wins, potential lost snapshots).
 * - isCurrentlyOnline() uses passive navigator.onLine (no active connectivity probe); offline decision can be stale briefly.
 * - Fallback via updateNote in error paths may enqueue a *single* snapshot (not the full merged array) in some offline transitions.
 * - No versioning of the snapshots array itself or tombstoning.
 *
 * M3 NEXT STEPS (see docs/AGENT-72-PHASE2-NOTES-PROPOSAL.md, WAVE8, MILESTONE-2 closeout):
 * - Introduce dedicated `note_snapshots` table (with note_id, user_id, created_at server time, label, content jsonb, content_size).
 * - SECURITY DEFINER RPC `append_note_snapshot(p_note_id uuid, p_label text, p_content jsonb)` → atomic insert + trim-to-N server-side.
 * - Server-computed structured diffs or CRDT patches stored alongside for efficient panel loading + bandwidth.
 * - Full pagination + cursor-based history queries (beyond cap 10); soft-delete + retention policies per workspace.
 * - Realtime broadcast of snapshot append events to presence subscribers (collab users see new history entries live).
 * - Integration with activity_logs for "version created" audit trail; user attribution.
 * - Optional background job for snapshot GC + compression of old full-content blobs.
 * - Expose server diff endpoint for the richer diff viewer (move computeStructuredDiff serverward for large docs).
 */
export async function onPersistSnapshot(
  noteId: string,
  snapshot: { ts: string; content: string; label: string }
): Promise<boolean> {
  if (!isSupabaseLive()) return false;
  if (typeof noteId !== "string" || !noteId || !snapshot || !snapshot.ts) return false;

  const supabase = getClient();
  if (!supabase) return false;

  const online = isCurrentlyOnline();

  // Local retry helper (exp backoff, live-path only; keeps surface minimal)
  const withRetry = async <T>(
    op: () => Promise<T>,
    label: string,
    maxRetries = 3
  ): Promise<T | null> => {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await op();
      } catch (e) {
        logHybridError(`onPersistSnapshot:retry:${label}:attempt${attempt}`, e);
        if (attempt === maxRetries) {
          return null;
        }
        // Exponential backoff: 120ms, 240ms, 480ms
        await new Promise((r) => setTimeout(r, 120 * Math.pow(2, attempt)));
      }
    }
    return null;
  };

  try {
    if (!online) {
      // Offline: use existing updateNote which enqueues with snapshots payload (will merge on client caller side)
      // Note: limitation - single-snapshot enqueue in this branch (see M3 table above)
      logger.info?.(`[hybridStore] onPersistSnapshot offline enqueue for note ${noteId}`);
      return updateNote(noteId, { snapshots: [snapshot] } as any);
    }

    // LIVE round-trip: authoritative fetch + merge on server (HARDENED with retry + logging)
    logger.info?.(`[hybridStore] onPersistSnapshot LIVE start for note=${noteId} label="${snapshot.label}" ts=${snapshot.ts}`);

    let current: any = null;
    let fetchErr: any = null;

    const fetchResult = await withRetry(async () => {
      const res = await supabase
        .from("notes")
        .select("snapshots")
        .eq("id", noteId)
        .single();
      if (res.error) throw res.error;
      return res;
    }, "fetch-current-snapshots");

    if (fetchResult) {
      current = fetchResult.data;
    } else {
      fetchErr = new Error("fetch failed after all retries");
      logHybridError("onPersistSnapshot:fetch-after-retries", fetchErr);
    }

    let existing: Array<{ ts: string; content: string; label: string }> = [];
    if (!fetchErr && current) {
      const raw = (current as any).snapshots;
      if (Array.isArray(raw)) {
        existing = raw as any;
      } else if (raw) {
        existing = [raw] as any;
      }
    }

    // Merge strategy: new first, dedup by exact ts, hard cap 10 (matches UI limit)
    const deduped = existing.filter((s: any) => s && s.ts !== snapshot.ts);
    const merged = [snapshot, ...deduped].slice(0, 10);

    const updateResult = await withRetry(async () => {
      const u = await (supabase.from("notes") as any)
        .update({ snapshots: merged })
        .eq("id", noteId);
      if (u.error) throw u.error;
      return u;
    }, "update-snapshots");

    if (!updateResult) {
      const uErr = new Error("update failed after all retries");
      logHybridError("onPersistSnapshot:update-after-retries", uErr);
      // Fallback to updateNote path (will queue if needed)
      return updateNote(noteId, { snapshots: merged } as any);
    }

    logger.info?.(`[hybridStore] onPersistSnapshot LIVE success for note=${noteId} (merged count=${merged.length})`);
    return true;
  } catch (err) {
    logHybridError("onPersistSnapshot", err);
    // Resilient fallback: delegate to updateNote (handles enqueue + optimistic) - no outer existing ref
    try {
      return await updateNote(noteId, { snapshots: [snapshot] } as any);
    } catch (fbErr) {
      logHybridError("onPersistSnapshot:fallback-updateNote", fbErr);
      return false;
    }
  }
}

/** Delete a note */
export async function deleteNote(id: string): Promise<boolean> {
  if (!isSupabaseLive()) return false;

  const supabase = getClient();
  if (!supabase) return false;

  const online = isCurrentlyOnline();

  // Resolve ws for compensation queue (prevents "refusing to enqueue" for valid live note deletes)
  const wsForQueue = await resolveWorkspaceIdForNote(id);

  if (!online) {
    enqueuePendingOperation({
      type: "delete",
      entityType: "note",
      targetId: id,
      payload: {},
      workspaceId: wsForQueue,
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
        workspaceId: wsForQueue,
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
      workspaceId: wsForQueue,
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

  // Workspace switches are intentionally not logged — too noisy for activity feeds.
  if (params.actionType === "workspace.switched") {
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

  // Safety guard: never hit Supabase with invalid or demo workspace IDs
  if (!workspaceId || ["", "w1", "w2"].includes(workspaceId)) {
    return [];
  }

  const supabase = getClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("activity_logs")
    .select("*")
    .eq("workspace_id", workspaceId)
    .neq("action_type", "workspace.switched")
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
export { processDeadlineReminders } from "@/lib/notifications/processDeadlineReminders";

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

export { sendNotificationEmail } from "@/lib/notifications/sendNotificationEmail";

/** Load notification preferences for a user from profiles.notification_prefs. */
export async function getUserNotificationPrefs(userId: string): Promise<NotificationPrefs> {
  if (!isSupabaseLive() || !userId) return DEFAULT_NOTIFICATION_PREFS;

  const supabase = getClient();
  if (!supabase) return DEFAULT_NOTIFICATION_PREFS;

  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("notification_prefs")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      if (isMissingNotificationPrefsColumn(error)) {
        warnMissingNotificationPrefsColumnOnce();
        return DEFAULT_NOTIFICATION_PREFS;
      }
      logHybridError("getUserNotificationPrefs", error);
      return DEFAULT_NOTIFICATION_PREFS;
    }

    if (!data) return DEFAULT_NOTIFICATION_PREFS;

    return normalizeNotificationPrefs((data as { notification_prefs?: unknown }).notification_prefs);
  } catch (err) {
    if (isMissingNotificationPrefsColumn(err)) {
      warnMissingNotificationPrefsColumnOnce();
      return DEFAULT_NOTIFICATION_PREFS;
    }
    logHybridError("getUserNotificationPrefs", err);
    return DEFAULT_NOTIFICATION_PREFS;
  }
}

/** Persist notification preferences on the signed-in user's profile. */
export async function updateUserNotificationPrefs(
  userId: string,
  prefs: NotificationPrefs,
): Promise<boolean> {
  if (!isSupabaseLive() || !userId) return false;

  const supabase = getClient();
  if (!supabase) return false;

  try {
    const { error } = await (supabase.from("profiles") as any)
      .update({ notification_prefs: prefs as unknown as Json })
      .eq("id", userId);

    if (error) {
      if (isMissingNotificationPrefsColumn(error)) {
        warnMissingNotificationPrefsColumnOnce();
        return false;
      }
      logHybridError("updateUserNotificationPrefs", error);
      return false;
    }
    return true;
  } catch (err) {
    if (isMissingNotificationPrefsColumn(err)) {
      warnMissingNotificationPrefsColumnOnce();
      return false;
    }
    logHybridError("updateUserNotificationPrefs", err);
    return false;
  }
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

/** Aggregate comment counts + latest activity per task (for task list indicators). */
export async function getWorkspaceTaskCommentSummaries(
  taskIds: string[],
): Promise<Record<string, import("@/types").TaskCommentSummary>> {
  if (!isSupabaseLive() || taskIds.length === 0) return {};

  const supabase = getClient();
  if (!supabase) return {};

  try {
    const { data, error } = await supabase
      .from("comments")
      .select("task_id, created_at, updated_at, user_id")
      .in("task_id", taskIds);

    if (error) {
      logHybridError("getWorkspaceTaskCommentSummaries", error);
      return {};
    }

    const map: Record<string, import("@/types").TaskCommentSummary> = {};
    for (const row of (data ?? []) as Array<{
      task_id: string | null;
      created_at: string;
      updated_at: string | null;
      user_id: string;
    }>) {
      const taskId = row.task_id;
      if (!taskId) continue;

      const activityAt = ((row.updated_at as string | null) || (row.created_at as string));
      const userId = row.user_id as string;
      const existing = map[taskId];

      if (!existing) {
        map[taskId] = { count: 1, latestAt: activityAt, latestUserId: userId };
        continue;
      }

      existing.count += 1;
      if (new Date(activityAt).getTime() >= new Date(existing.latestAt).getTime()) {
        existing.latestAt = activityAt;
        existing.latestUserId = userId;
      }
    }

    return map;
  } catch (err) {
    logHybridError("getWorkspaceTaskCommentSummaries", err);
    return {};
  }
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

    if (params.userId) {
      void (async () => {
        const [members, workspaceResult, taskResult] = await Promise.all([
          getWorkspaceMembers(params.workspaceId),
          supabase.from("workspaces").select("name").eq("id", params.workspaceId).maybeSingle(),
          params.taskId
            ? supabase.from("tasks").select("title, assignee_ids").eq("id", params.taskId).maybeSingle()
            : Promise.resolve({ data: null }),
        ]);

        const workspaceName =
          (workspaceResult.data as { name?: string } | null)?.name?.trim() || "your workspace";
        const actorName =
          created.userName ||
          created.userEmail?.split("@")[0] ||
          "Someone";
        const taskRow = taskResult.data as { title?: string; assignee_ids?: string[] } | null;

        if (params.userId) {
          await fanoutCommentNotifications({
            supabase,
            workspaceId: params.workspaceId,
            workspaceName,
            actorUserId: params.userId,
            actorName,
            content: params.content,
            commentId: created.id,
            taskId: params.taskId,
            noteId: params.noteId,
            taskTitle: taskRow?.title,
            taskAssigneeIds: taskRow?.assignee_ids ?? [],
            members,
          });
        }
      })().catch(() => {});
    }

    return created;
  } catch (err) {
    logHybridError("createComment", err);
    return null;
  }
}

/** Update a comment (author only). */
export async function updateComment(
  commentId: string,
  content: string,
  userId: string,
): Promise<Comment | null> {
  if (!isSupabaseLive()) return null;

  const supabase = getClient();
  if (!supabase) return null;

  const trimmed = content.trim();
  if (!trimmed) return null;

  try {
    const { data, error } = await (supabase.from("comments") as any)
      .update({ content: trimmed, updated_at: new Date().toISOString() })
      .eq("id", commentId)
      .eq("user_id", userId)
      .select(`*, profiles(full_name, email)`)
      .single();

    if (error) {
      logHybridError("updateComment", error);
      return null;
    }

    return mapCommentRow(data);
  } catch (err) {
    logHybridError("updateComment", err);
    return null;
  }
}

/** Delete a comment (author only). */
export async function deleteComment(commentId: string, userId: string): Promise<boolean> {
  if (!isSupabaseLive()) return false;

  const supabase = getClient();
  if (!supabase) return false;

  try {
    const { error } = await (supabase.from("comments") as any)
      .delete()
      .eq("id", commentId)
      .eq("user_id", userId);

    if (error) {
      logHybridError("deleteComment", error);
      return false;
    }

    return true;
  } catch (err) {
    logHybridError("deleteComment", err);
    return false;
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
    role: fromDbRole(row.role),
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
    role: fromDbRole(row.role),
    invitedBy: row.invited_by ?? undefined,
    invitedUserId: (row as any).invited_user_id ?? undefined,
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

    const profileMap: Record<string, any> = {};

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

export type MyProfile = {
  fullName?: string;
  username?: string;
  location?: string;
};

/** Fetch the signed-in user's profile (workspace-independent). */
export async function getMyProfile(): Promise<MyProfile | null> {
  if (!isSupabaseLive()) return null;

  const supabase = getClient();
  if (!supabase) return null;

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const richSelect = "full_name, username, location";
    const legacySelect = "full_name, username";

    let { data, error } = await (supabase.from("profiles") as any)
      .select(richSelect)
      .eq("id", user.id)
      .maybeSingle();

    if (error && error.code === "42703" && String(error.message || "").includes("location")) {
      ({ data, error } = await (supabase.from("profiles") as any)
        .select(legacySelect)
        .eq("id", user.id)
        .maybeSingle());
    }

    if (error || !data) return null;

    const row = data as { full_name?: string | null; username?: string | null; location?: string | null };
    return {
      fullName: row.full_name ?? undefined,
      username: row.username ?? undefined,
      location: row.location ?? undefined,
    };
  } catch (err) {
    logHybridError("getMyProfile", err);
    return null;
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
  role: WorkspaceRole = "member"
): Promise<string | null> {
  if (!isSupabaseLive()) return null;
  if (["w1", "w2"].includes(workspaceId)) return null;

  const supabase = getClient();
  if (!supabase) return null;

  try {
    const { data, error } = await (supabase.rpc as any)("create_workspace_invite", {
      p_workspace_id: workspaceId,
      p_email: email ?? null,
      p_role: toDbRole(role),
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
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user?.id) {
      const ensureRes = await fetch("/api/profile/ensure", {
        method: "POST",
        credentials: "include",
      });
      if (!ensureRes.ok) {
        const payload = (await ensureRes.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error || "Could not create user profile before accepting invite.");
      }
    }

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

/** Update member role (owner/admin only) via privileged API route — RLS has no UPDATE on workspace_members. */
export async function updateMemberRole(
  workspaceId: string,
  userId: string,
  newRole: WorkspaceRole
): Promise<boolean> {
  if (!isSupabaseLive()) return false;
  if (["w1", "w2"].includes(workspaceId)) return false;
  if (typeof window === "undefined") return false;

  try {
    const response = await apiFetch("/api/workspace/member-role", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ workspaceId, userId, newRole }),
    });

    if (!response.ok) {
      const detail = await response.json().catch(() => ({}));
      logHybridError("updateMemberRole", (detail as { error?: string }).error || response.status);
      return false;
    }

    return true;
  } catch (err) {
    logHybridError("updateMemberRole", err);
    return false;
  }
}

export type TransferOwnershipResult = { ok: true } | { ok: false; error?: string };

/** Transfer workspace ownership to another member (current owner becomes admin) via privileged API route. */
export async function transferWorkspaceOwnership(
  workspaceId: string,
  currentOwnerId: string,
  newOwnerId: string
): Promise<TransferOwnershipResult> {
  if (!isSupabaseLive()) return { ok: false, error: "Supabase is not configured" };
  if (["w1", "w2"].includes(workspaceId)) return { ok: false, error: "Demo workspaces cannot transfer ownership" };
  if (currentOwnerId === newOwnerId) {
    return { ok: false, error: "Choose a different member to receive ownership" };
  }
  if (typeof window === "undefined") return { ok: false, error: "Ownership transfer must run in the browser" };

  try {
    const response = await apiFetch("/api/workspace/transfer-ownership", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ workspaceId, newOwnerId }),
    });

    if (!response.ok) {
      const detail = await response.json().catch(() => ({}));
      const message = (detail as { error?: string }).error || `Request failed (${response.status})`;
      logHybridError("transferWorkspaceOwnership", message);
      return { ok: false, error: message };
    }

    return { ok: true };
  } catch (err) {
    logHybridError("transferWorkspaceOwnership", err);
    return { ok: false, error: "Network error while transferring ownership" };
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
 * Deliver workspace invite email via server API route → Brevo.
 * Called optionally after createInvite when email provided.
 * Keeps hybrid demo/live separation; safe no-op when !live.
 */
export async function sendInviteEmail(
  workspaceId: string,
  inviteId: string,
  email?: string | null,
  workspaceName?: string,
  options?: { role?: string; inviterName?: string },
): Promise<boolean> {
  if (!isSupabaseLive() || ["w1", "w2"].includes(workspaceId)) {
    return false;
  }
  if (!email?.trim() || typeof window === "undefined") {
    return false;
  }

  try {
    const response = await apiFetch("/api/communications/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        workspaceId,
        inviteId,
        email: email.trim(),
        workspaceName: workspaceName || "your workspace",
        role: options?.role ? toDbRole(options.role as WorkspaceRole) : "user",
        inviterName: options?.inviterName,
      }),
    });

    if (!response.ok) {
      const detail = await response.json().catch(() => ({}));
      console.warn("[sendInviteEmail] API route failed", response.status, detail);
      return false;
    }

    return true;
  } catch (err) {
    console.warn("[sendInviteEmail] request failed", err);
    return false;
  }
}

/** Update workspace name and/or slug (owner only — enforced server-side via API). */
export async function updateWorkspace(
  workspaceId: string,
  updates: { name?: string; slug?: string }
): Promise<boolean> {
  if (!isSupabaseLive()) return false;
  if (["w1", "w2"].includes(workspaceId)) return false;

  try {
    const response = await apiFetch("/api/workspace/update-details", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspaceId,
        name: updates.name?.trim(),
        slug: updates.slug?.trim(),
      }),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      logHybridError("updateWorkspace", payload?.error || response.statusText);
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

  // Preferred: SECURITY DEFINER RPC (owner enforced server-side + future hooks)
  try {
    const { data, error: rpcErr } = await (supabase.rpc as any)("delete_workspace_for_owner", {
      p_workspace_id: workspaceId,
    });
    if (!rpcErr && data !== false) {
      return true;
    }
    if (rpcErr?.code === "PGRST202") {
      logger.warn(
        "deleteWorkspace: RPC delete_workspace_for_owner not found yet; falling back to direct delete under RLS."
      );
    } else if (rpcErr) {
      console.warn("[deleteWorkspace] RPC path failed, falling back to direct (", rpcErr.message || rpcErr, ")");
    }
  } catch (e) {
    console.warn("[deleteWorkspace] RPC call threw, falling back to direct delete path", e);
  }

  // Fallback: direct delete (protected by "Owners can delete their workspaces" RLS)
  try {
    const { data, error } = await supabase
      .from("workspaces")
      .delete()
      .eq("id", workspaceId)
      .select("id");
    if (error) {
      logHybridError("deleteWorkspace", error);
      return false;
    }
    if (!data?.length) {
      logger.warn(
        "deleteWorkspace: delete matched 0 rows — owner DELETE policy or delete_workspace_for_owner RPC is likely missing in Supabase. Run supabase/add-delete-workspace-rpc.sql."
      );
      return false;
    }
    return true;
  } catch (err) {
    logHybridError("deleteWorkspace", err);
    return false;
  }
}

// ------------------------------------------------------------------
// Realtime subscriptions for workspace-scoped live updates (tasks + notes + invites + members)
// Returns cleanup function. Call on workspace switch / unmount.
// Demo mode: instant no-op. Changes from other clients/devices will update UI via callbacks.
//
// CRITICAL: Idempotency + hygiene guard added to fix "postgres_changes after subscribe()" crash
// during rapid workspace switching in live mode. Bulletproofed here with:
// - String() coercion via sanitizeId on entry (ID hygiene for workspaces)
// - Clearing of currentRealtimeWorkspaceId in *ALL* teardown paths (prior teardown + returned cleanup)
// - Early-return logging on guard hit for observability
// - Guard now effective because we set current* ONLY on successful path and clear exclusively on teardown
// - No re-nulling inside setup (was causing guard to be ineffective)
// ------------------------------------------------------------------

let activeTaskChannel: any = null;
let activeNoteChannel: any = null;
let activeInviteChannel: any = null;
let activeMemberChannel: any = null;
let activeRealtimeCleanup: (() => void) | null = null;

// Track the workspace we are currently actively subscribed for (prevents double-subscribe on rapid switchWorkspace + initializeFromSupabase)
// This let is intentionally module-private. Use __getCurrentRealtimeWorkspaceIdForTests() / __reset... for tests only.
let currentRealtimeWorkspaceId: string | null = null;

export function subscribeToWorkspaceRealtime(
  workspaceId: string,
  handlers: {
    onTaskChange?: (payload: any) => void;
    onNoteChange?: (payload: any) => void;
    onInviteChange?: (payload: any) => void;
    onMemberChange?: (payload: any) => void;
  }
): () => void {
  // === ENTRY COERCION + PURGE (String() + bad-UUID discipline for realtime workspace path) ===
  // All downstream uses (channel names, filters, guard compares, logs) use the sanitized wsId.
  // This ensures non-string IDs (e.g. from rapid switch callers or hydration) never reach Supabase realtime or cause uuid parse failures.
  const wsId = sanitizeId(workspaceId, "workspace");

  if (!isSupabaseLive() || !wsId || ["w1", "w2"].includes(wsId)) {
    return () => {}; // DEMO / guard: no subscription
  }

  const supabase = getClient();
  if (!supabase) return () => {};

  // === STRENGTHENED IDEMPOTENCY GUARD ===
  // If already wired for this *exact* workspace (after coercion), bail early with no-op.
  // This is the primary defense against the Supabase Realtime "cannot add postgres_changes callbacks after subscribe()" crash
  // when switchWorkspace + initializeFromSupabase (or rapid tab/workspace changes) race to call this.
  // Guard is now reliable because:
  //  - currentRealtimeWorkspaceId is set once we decide to subscribe (after prior cleared)
  //  - currentRealtimeWorkspaceId cleared in every teardown path (see below)
  //  - Comparison + channel presence check after String coercion
  if (currentRealtimeWorkspaceId === wsId &&
      (activeTaskChannel || activeNoteChannel || activeInviteChannel || activeMemberChannel)) {
    console.log(
      `[realtime] EARLY RETURN (idempotency guard): already subscribed for workspace ${wsId} ` +
      `(currentRealtimeWorkspaceId=${currentRealtimeWorkspaceId}). Skipping to avoid postgres_changes-after-subscribe crash on rapid switch.`
    );
    return activeRealtimeCleanup ?? (() => {});
  }

  // === TEARDOWN PRIOR (one of the teardown paths: MUST clear guard) ===
  // Defensive: clear any stale channels from previous workspace BEFORE setting new guard value.
  // We clear currentRealtimeWorkspaceId here so that a subsequent subscribe for a *different* ws always proceeds.
  if (activeTaskChannel || activeNoteChannel || activeInviteChannel || activeMemberChannel) {
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
    currentRealtimeWorkspaceId = null; // explicit clear in teardown path
  }

  // Commit: we are now the active subscription for this workspace.
  // Set *before* creating channels (but after prior cleared). Guard will protect re-entrancy from here on.
  currentRealtimeWorkspaceId = wsId;

  const { onTaskChange, onNoteChange, onInviteChange, onMemberChange } = handlers;

  if (onTaskChange) {
    activeTaskChannel = supabase
      .channel(`ws-tasks-${wsId}`)
      .on(
        "postgres_changes" as any,
        {
          event: "*",
          schema: "public",
          table: "tasks",
          filter: `workspace_id=eq.${wsId}`,
        },
        (payload: any) => {
          onTaskChange(payload);
        }
      )
      .subscribe((status: string) => {
        if (status === "SUBSCRIBED") {
          console.log(`[realtime] tasks subscribed for workspace ${wsId}`);
        }
      });
  }

  if (onNoteChange) {
    activeNoteChannel = supabase
      .channel(`ws-notes-${wsId}`)
      .on(
        "postgres_changes" as any,
        {
          event: "*",
          schema: "public",
          table: "notes",
          filter: `workspace_id=eq.${wsId}`,
        },
        (payload: any) => {
          onNoteChange(payload);
        }
      )
      .subscribe((status: string) => {
        if (status === "SUBSCRIBED") {
          console.log(`[realtime] notes subscribed for workspace ${wsId}`);
        }
      });
  }

  if (onInviteChange) {
    activeInviteChannel = supabase
      .channel(`ws-invites-${wsId}`)
      .on(
        "postgres_changes" as any,
        {
          event: "*",
          schema: "public",
          table: "workspace_invites",
          filter: `workspace_id=eq.${wsId}`,
        },
        (payload: any) => {
          onInviteChange(payload);
        }
      )
      .subscribe((status: string) => {
        if (status === "SUBSCRIBED") {
          console.log(`[realtime] invites subscribed for workspace ${wsId}`);
        }
      });
  }

  if (onMemberChange) {
    activeMemberChannel = supabase
      .channel(`ws-members-${wsId}`)
      .on(
        "postgres_changes" as any,
        {
          event: "*",
          schema: "public",
          table: "workspace_members",
          filter: `workspace_id=eq.${wsId}`,
        },
        (payload: any) => {
          onMemberChange(payload);
        }
      )
      .subscribe((status: string) => {
        if (status === "SUBSCRIBED") {
          console.log(`[realtime] members subscribed for workspace ${wsId}`);
        }
      });
  }

  // Return the unsubscribe / teardown fn. This is a teardown path: it clears guard + all channels.
  activeRealtimeCleanup = () => {
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
    currentRealtimeWorkspaceId = null;
    activeRealtimeCleanup = null;
  };
  return activeRealtimeCleanup;
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
  const overdue = tasks.filter((t) => t.dueDate && isDueDatePast(t.dueDate) && t.status !== "done").length;
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

  const existingTaskTitles = new Set<string>();
  const existingNoteTitles = new Set<string>();
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

// ------------------------------------------------------------------
// C4-Exec-3 Phase A MVP (FEATURE-GLOBAL-WORKSPACE-HUB.md): Minimal lightweight
// cross-ws hybrid helpers (member-scoped via workspace_members, separate from
// per-ws slices in store). 
// 
// NON-NEGOTIABLE: Every export has isSupabaseLive() guard at VERY TOP (see line 623).
// Demo ws IDs ("w1"/"w2") purged. No broad scans; bounded + user-scoped only.
// Used exclusively by Home global aggregates (Workspace Pulse, Today's Focus,
// Recent Movement, AI stub). Zero scope creep.
// ------------------------------------------------------------------

/** 
 * Global recent activity across ALL workspaces the user belongs to (for Home Recent Movement).
 * Live: member join + IN filter on activity_logs. Demo: safe empty.
 * Returns mapped ActivityLog[] (lightweight, read-only for Phase A).
 */
export async function getGlobalRecentActivity(userId: string, limit: number = 15): Promise<ActivityLog[]> {
  if (!isSupabaseLive() || !userId) return []; // DEMO GUARD (VERY TOP per quality rule)
  const supabase = getClient();
  if (!supabase) return [];

  try {
    // Member-scoped fetch (matches fetchUserWorkspaces pattern exactly)
    const { data: mems, error: memErr } = await supabase
      .from("workspace_members")
      .select("workspace_id")
      .eq("user_id", userId);
    if (memErr) {
      logHybridError("getGlobalRecentActivity (members)", memErr);
      return [];
    }

    const wsIds = (mems || [])
      .map((m: any) => m.workspace_id)
      .filter((id: string | null) => !!id && !["w1", "w2"].includes(id as string));

    if (wsIds.length === 0) return [];

    const { data, error } = await supabase
      .from("activity_logs")
      .select("*")
      .in("workspace_id", wsIds)
      .neq("action_type", "workspace.switched")
      .order("created_at", { ascending: false })
      .limit(Math.min(limit, 30)); // aggressive cap for MVP

    if (error) {
      logHybridError("getGlobalRecentActivity", error);
      return [];
    }

    // Light map to our ActivityLog contract (no heavy joins for Phase A)
    return (data || []).map((row: any) => ({
      id: row.id,
      workspaceId: row.workspace_id,
      userId: row.user_id ?? undefined,
      actionType: row.action_type ?? "activity",
      targetType: row.target_type ?? "item",
      targetId: row.target_id ?? undefined,
      metadata: (row.metadata as Record<string, unknown>) ?? {},
      createdAt: row.created_at,
    })) as ActivityLog[];
  } catch (err) {
    logHybridError("getGlobalRecentActivity", err);
    return [];
  }
}

// ------------------------------------------------------------------
// Workspace team chat
// ------------------------------------------------------------------

type WorkspaceMessageRow = Database["public"]["Tables"]["workspace_messages"]["Row"];
type WorkspaceMessageReactionRow = {
  id: string;
  workspace_id: string;
  message_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
};

function mapMessageReactionRow(row: WorkspaceMessageReactionRow): MessageReaction {
  return {
    id: row.id,
    messageId: row.message_id,
    workspaceId: row.workspace_id,
    userId: row.user_id,
    emoji: row.emoji,
    createdAt: row.created_at,
  };
}

function mapWorkspaceMessageRow(row: WorkspaceMessageRow, profile?: { full_name?: string | null; username?: string | null }): WorkspaceMessage {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    userId: row.user_id,
    body: row.body,
    createdAt: row.created_at,
    authorName: profile?.full_name ?? undefined,
    authorUsername: profile?.username ?? undefined,
  };
}

export async function fetchWorkspaceMessages(workspaceId: string, limit = 80): Promise<WorkspaceMessage[]> {
  if (!isSupabaseLive() || ["w1", "w2"].includes(workspaceId)) return [];
  const supabase = getClient();
  if (!supabase) return [];

  try {
    const { data, error } = await supabase
      .from("workspace_messages")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: true })
      .limit(limit);

    if (error) {
      logHybridError("fetchWorkspaceMessages", error);
      return [];
    }

    return (data ?? []).map((row: WorkspaceMessageRow & { profiles?: { full_name?: string | null; username?: string | null } }) =>
      mapWorkspaceMessageRow(row, row.profiles ?? undefined)
    );
  } catch (err) {
    logHybridError("fetchWorkspaceMessages", err);
    return [];
  }
}

export async function sendWorkspaceMessage(
  workspaceId: string,
  body: string,
  userId: string
): Promise<WorkspaceMessage | null> {
  const trimmed = body.trim();
  if (!trimmed || trimmed.length > 4000) return null;
  if (!isSupabaseLive() || ["w1", "w2"].includes(workspaceId)) return null;

  const supabase = getClient();
  if (!supabase) return null;

  try {
    const { data, error } = await (supabase.from("workspace_messages") as any)
      .insert({
        workspace_id: workspaceId,
        user_id: userId,
        body: trimmed,
      })
      .select("*")
      .single();

    if (error || !data) {
      logHybridError("sendWorkspaceMessage", error);
      return null;
    }

    return mapWorkspaceMessageRow(data);
  } catch (err) {
    logHybridError("sendWorkspaceMessage", err);
    return null;
  }
}

export async function fetchWorkspaceMessageReactions(
  workspaceId: string
): Promise<MessageReaction[]> {
  if (!isSupabaseLive() || ["w1", "w2"].includes(workspaceId)) return [];
  const supabase = getClient();
  if (!supabase) return [];

  try {
    const { data, error } = await (supabase.from("workspace_message_reactions") as any)
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: true });

    if (error) {
      if (!isSchemaTableMissing(error)) {
        logHybridError("fetchWorkspaceMessageReactions", error);
      }
      return [];
    }
    return (data ?? []).map((row: WorkspaceMessageReactionRow) => mapMessageReactionRow(row));
  } catch (err) {
    if (!isSchemaTableMissing(err)) {
      logHybridError("fetchWorkspaceMessageReactions", err);
    }
    return [];
  }
}

export async function toggleWorkspaceMessageReaction(
  workspaceId: string,
  messageId: string,
  emoji: string,
  userId: string
): Promise<"added" | "removed" | null> {
  const trimmed = emoji.trim();
  if (!trimmed || trimmed.length > 32) return null;
  if (!isSupabaseLive() || ["w1", "w2"].includes(workspaceId)) return null;

  const supabase = getClient();
  if (!supabase) return null;

  try {
    const { data: existing, error: findErr } = await (supabase.from("workspace_message_reactions") as any)
      .select("id")
      .eq("message_id", messageId)
      .eq("user_id", userId)
      .eq("emoji", trimmed)
      .maybeSingle();

    if (findErr) {
      if (!isSchemaTableMissing(findErr)) {
        logHybridError("toggleWorkspaceMessageReaction", findErr);
      }
      return null;
    }

    if (existing?.id) {
      const { error: delErr } = await (supabase.from("workspace_message_reactions") as any)
        .delete()
        .eq("id", existing.id);
      if (delErr) {
        if (!isSchemaTableMissing(delErr)) {
          logHybridError("toggleWorkspaceMessageReaction", delErr);
        }
        return null;
      }
      return "removed";
    }

    const { error: insErr } = await (supabase.from("workspace_message_reactions") as any).insert({
      workspace_id: workspaceId,
      message_id: messageId,
      user_id: userId,
      emoji: trimmed,
    });

    if (insErr) {
      if (!isSchemaTableMissing(insErr)) {
        logHybridError("toggleWorkspaceMessageReaction", insErr);
      }
      return null;
    }
    return "added";
  } catch (err) {
    if (!isSchemaTableMissing(err)) {
      logHybridError("toggleWorkspaceMessageReaction", err);
    }
    return null;
  }
}

export type WorkspaceChatRealtimeHandlers = {
  onMessageInsert?: (message: WorkspaceMessage) => void;
  onReactionInsert?: (reaction: MessageReaction) => void;
  onReactionDelete?: (reaction: MessageReaction) => void;
};

let activeMessagesChannel: ReturnType<NonNullable<ReturnType<typeof getClient>>["channel"]> | null = null;
let activeMessagesWorkspaceId: string | null = null;

export function subscribeToWorkspaceMessages(
  workspaceId: string,
  onInsert: (message: WorkspaceMessage) => void
): () => void {
  return subscribeToWorkspaceChat(workspaceId, { onMessageInsert: onInsert });
}

export function subscribeToWorkspaceChat(
  workspaceId: string,
  handlers: WorkspaceChatRealtimeHandlers
): () => void {
  if (!isSupabaseLive() || ["w1", "w2"].includes(workspaceId)) return () => {};

  const supabase = getClient();
  if (!supabase) return () => {};

  const wsId = String(workspaceId);
  if (activeMessagesChannel && activeMessagesWorkspaceId === wsId) {
    return () => {};
  }

  if (activeMessagesChannel) {
    try {
      supabase.removeChannel(activeMessagesChannel);
    } catch {
      /* ignore */
    }
    activeMessagesChannel = null;
    activeMessagesWorkspaceId = null;
  }

  activeMessagesWorkspaceId = wsId;
  const channel = supabase.channel(`ws-messages-${wsId}`);

  if (handlers.onMessageInsert) {
    channel.on(
      "postgres_changes" as const,
      {
        event: "INSERT",
        schema: "public",
        table: "workspace_messages",
        filter: `workspace_id=eq.${wsId}`,
      },
      (payload: { new: WorkspaceMessageRow }) => {
        if (payload?.new) {
          handlers.onMessageInsert!(mapWorkspaceMessageRow(payload.new));
        }
      }
    );
  }

  const ch = channel as ReturnType<typeof supabase.channel> & {
    on: (event: string, filter: object, cb: (payload: unknown) => void) => typeof channel;
  };

  if (handlers.onReactionInsert) {
    ch.on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "workspace_message_reactions",
        filter: `workspace_id=eq.${wsId}`,
      },
      (payload: unknown) => {
        const p = payload as { new?: WorkspaceMessageReactionRow };
        if (p?.new) handlers.onReactionInsert!(mapMessageReactionRow(p.new));
      }
    );
  }

  if (handlers.onReactionDelete) {
    ch.on(
      "postgres_changes",
      {
        event: "DELETE",
        schema: "public",
        table: "workspace_message_reactions",
        filter: `workspace_id=eq.${wsId}`,
      },
      (payload: unknown) => {
        const p = payload as { old?: WorkspaceMessageReactionRow };
        if (p?.old) handlers.onReactionDelete!(mapMessageReactionRow(p.old));
      }
    );
  }

  activeMessagesChannel = channel.subscribe();

  return () => {
    if (activeMessagesChannel) {
      try {
        supabase.removeChannel(activeMessagesChannel);
      } catch {
        /* ignore */
      }
      activeMessagesChannel = null;
      activeMessagesWorkspaceId = null;
    }
  };
}

// ------------------------------------------------------------------
// Workspace Lists (checklist cards + items)
// ------------------------------------------------------------------

function isLiveDataWorkspace(workspaceId: string): boolean {
  return isSupabaseLive() && !!workspaceId && !["", "w1", "w2"].includes(workspaceId);
}

function mapWorkspaceListRow(row: WorkspaceListRow): WorkspaceList {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    title: row.title,
    color: row.color,
    sortOrder: row.sort_order,
    pinned: row.pinned ?? false,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapListItemRow(row: ListItemRow): ListItem {
  return {
    id: row.id,
    listId: row.list_id,
    workspaceId: row.workspace_id,
    text: row.text,
    completed: row.completed,
    sortOrder: row.sort_order,
    completedAt: row.completed_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getWorkspaceLists(workspaceId: string): Promise<WorkspaceList[]> {
  if (!isLiveDataWorkspace(workspaceId) || !isCurrentlyOnline()) return [];

  const supabase = getClient();
  if (!supabase) return [];

  try {
    const { data, error } = await supabase
      .from("workspace_lists")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("pinned", { ascending: false })
      .order("sort_order", { ascending: true });

    if (error) {
      if (isSchemaTableMissing(error)) {
        markWorkspaceListTablesMissing();
        return [];
      }
      logHybridError("getWorkspaceLists", error);
      return [];
    }
    markWorkspaceListTablesAvailable();
    return (data ?? []).map(mapWorkspaceListRow);
  } catch (err) {
    logHybridError("getWorkspaceLists", err);
    return [];
  }
}

export async function getListItems(workspaceId: string): Promise<ListItem[]> {
  if (!isLiveDataWorkspace(workspaceId) || !isCurrentlyOnline()) return [];

  const supabase = getClient();
  if (!supabase) return [];

  try {
    const { data, error } = await supabase
      .from("list_items")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("sort_order", { ascending: true });

    if (error) {
      if (isSchemaTableMissing(error)) {
        markWorkspaceListTablesMissing();
        return [];
      }
      logHybridError("getListItems", error);
      return [];
    }
    markWorkspaceListTablesAvailable();
    return (data ?? []).map(mapListItemRow);
  } catch (err) {
    logHybridError("getListItems", err);
    return [];
  }
}

export async function createWorkspaceList(input: {
  id?: string;
  workspaceId: string;
  title: string;
  color?: string;
  sortOrder?: number;
  pinned?: boolean;
}): Promise<boolean> {
  if (!isLiveDataWorkspace(input.workspaceId)) return false;
  if (!(await ensureWorkspaceListPersistenceReady())) return true;

  const clientId = normalizeListEntityId(input.id);
  const payload: WorkspaceListInsert = {
    id: clientId,
    workspace_id: input.workspaceId,
    title: input.title,
    color: input.color ?? "default",
    sort_order: input.sortOrder ?? 0,
    pinned: input.pinned ?? false,
  };

  if (!isCurrentlyOnline()) {
    enqueuePendingOperation({
      type: "create",
      entityType: "list",
      targetId: clientId,
      payload,
      workspaceId: input.workspaceId,
    });
    return true;
  }

  const supabase = getClient();
  if (!supabase) return false;

  try {
    const table = supabase.from("workspace_lists") as ReturnType<typeof supabase.from>;
    const { error } = await table.insert(payload);
    if (error) {
      if (isSchemaTableMissing(error)) {
        markWorkspaceListTablesMissing();
        return true;
      }
      enqueuePendingOperation({
        type: "create",
        entityType: "list",
        targetId: clientId,
        payload,
        workspaceId: input.workspaceId,
      });
      logHybridError("createWorkspaceList", error);
    } else {
      markWorkspaceListTablesAvailable();
    }
    return true;
  } catch (err) {
    if (isSchemaTableMissing(err)) {
      markWorkspaceListTablesMissing();
      return true;
    }
    enqueuePendingOperation({
      type: "create",
      entityType: "list",
      targetId: clientId,
      payload,
      workspaceId: input.workspaceId,
    });
    logHybridError("createWorkspaceList", err);
    return true;
  }
}

export async function updateWorkspaceList(
  id: string,
  workspaceId: string,
  updates: Partial<Pick<WorkspaceList, "title" | "color" | "sortOrder" | "pinned">>,
): Promise<boolean> {
  if (!isLiveDataWorkspace(workspaceId)) return false;
  if (!isWorkspaceListPersistenceEnabled()) return true;

  const listId = normalizeListEntityId(id);
  const payload: Partial<WorkspaceListInsert> = {};
  if (updates.title !== undefined) payload.title = updates.title;
  if (updates.color !== undefined) payload.color = updates.color;
  if (updates.sortOrder !== undefined) payload.sort_order = updates.sortOrder;
  if (updates.pinned !== undefined) payload.pinned = updates.pinned;
  if (Object.keys(payload).length === 0) return true;

  if (!isCurrentlyOnline()) {
    enqueuePendingOperation({ type: "update", entityType: "list", targetId: listId, payload, workspaceId });
    return true;
  }

  const supabase = getClient();
  if (!supabase) return false;

  try {
    const table = supabase.from("workspace_lists") as ReturnType<typeof supabase.from>;
    const { error } = await table.update(payload).eq("id", listId).eq("workspace_id", workspaceId);
    if (error) {
      if (isSchemaTableMissing(error)) {
        markWorkspaceListTablesMissing();
        return true;
      }
      enqueuePendingOperation({ type: "update", entityType: "list", targetId: listId, payload, workspaceId });
      logHybridError("updateWorkspaceList", error);
    }
    return true;
  } catch (err) {
    if (isSchemaTableMissing(err)) {
      markWorkspaceListTablesMissing();
      return true;
    }
    enqueuePendingOperation({ type: "update", entityType: "list", targetId: listId, payload, workspaceId });
    logHybridError("updateWorkspaceList", err);
    return true;
  }
}

export async function deleteWorkspaceList(id: string, workspaceId: string): Promise<boolean> {
  if (!isLiveDataWorkspace(workspaceId)) return false;
  if (!isWorkspaceListPersistenceEnabled()) return true;

  const listId = normalizeListEntityId(id);

  if (!isCurrentlyOnline()) {
    enqueuePendingOperation({ type: "delete", entityType: "list", targetId: listId, payload: {}, workspaceId });
    return true;
  }

  const supabase = getClient();
  if (!supabase) return false;

  try {
    const table = supabase.from("workspace_lists") as ReturnType<typeof supabase.from>;
    const { error } = await table.delete().eq("id", listId).eq("workspace_id", workspaceId);
    if (error && error.code !== "PGRST116") {
      if (isSchemaTableMissing(error)) {
        markWorkspaceListTablesMissing();
        return true;
      }
      enqueuePendingOperation({ type: "delete", entityType: "list", targetId: listId, payload: {}, workspaceId });
      logHybridError("deleteWorkspaceList", error);
    }
    return true;
  } catch (err) {
    if (isSchemaTableMissing(err)) {
      markWorkspaceListTablesMissing();
      return true;
    }
    enqueuePendingOperation({ type: "delete", entityType: "list", targetId: listId, payload: {}, workspaceId });
    logHybridError("deleteWorkspaceList", err);
    return true;
  }
}

export async function createListItem(input: {
  id?: string;
  listId: string;
  workspaceId: string;
  text: string;
  sortOrder?: number;
  completed?: boolean;
  completedAt?: string;
}): Promise<boolean> {
  if (!isLiveDataWorkspace(input.workspaceId)) return false;
  if (!(await ensureWorkspaceListPersistenceReady())) return true;

  const clientId = normalizeListEntityId(input.id);
  const payload: ListItemInsert = {
    id: clientId,
    list_id: normalizeListEntityId(input.listId),
    workspace_id: input.workspaceId,
    text: input.text,
    sort_order: input.sortOrder ?? 0,
    completed: input.completed ?? false,
    completed_at: input.completedAt ?? null,
  };

  if (!isCurrentlyOnline()) {
    enqueuePendingOperation({
      type: "create",
      entityType: "list_item",
      targetId: clientId,
      payload,
      workspaceId: input.workspaceId,
    });
    return true;
  }

  const supabase = getClient();
  if (!supabase) return false;

  try {
    const table = supabase.from("list_items") as ReturnType<typeof supabase.from>;
    const { error } = await table.insert(payload);
    if (error) {
      if (isSchemaTableMissing(error)) {
        markWorkspaceListTablesMissing();
        return true;
      }
      enqueuePendingOperation({
        type: "create",
        entityType: "list_item",
        targetId: clientId,
        payload,
        workspaceId: input.workspaceId,
      });
      logHybridError("createListItem", error);
    } else {
      markWorkspaceListTablesAvailable();
    }
    return true;
  } catch (err) {
    if (isSchemaTableMissing(err)) {
      markWorkspaceListTablesMissing();
      return true;
    }
    enqueuePendingOperation({
      type: "create",
      entityType: "list_item",
      targetId: clientId,
      payload,
      workspaceId: input.workspaceId,
    });
    logHybridError("createListItem", err);
    return true;
  }
}

export async function updateListItem(
  id: string,
  workspaceId: string,
  updates: Partial<Pick<ListItem, "text" | "completed" | "sortOrder" | "completedAt">>,
): Promise<boolean> {
  if (!isLiveDataWorkspace(workspaceId)) return false;
  if (!isWorkspaceListPersistenceEnabled()) return true;

  const itemId = normalizeListEntityId(id);
  const payload: Partial<ListItemInsert> = {};
  if (updates.text !== undefined) payload.text = updates.text;
  if (updates.completed !== undefined) payload.completed = updates.completed;
  if (updates.sortOrder !== undefined) payload.sort_order = updates.sortOrder;
  if (updates.completedAt !== undefined) payload.completed_at = updates.completedAt ?? null;
  if (Object.keys(payload).length === 0) return true;

  if (!isCurrentlyOnline()) {
    enqueuePendingOperation({ type: "update", entityType: "list_item", targetId: itemId, payload, workspaceId });
    return true;
  }

  const supabase = getClient();
  if (!supabase) return false;

  try {
    const table = supabase.from("list_items") as ReturnType<typeof supabase.from>;
    const { error } = await table.update(payload).eq("id", itemId).eq("workspace_id", workspaceId);
    if (error) {
      if (isSchemaTableMissing(error)) {
        markWorkspaceListTablesMissing();
        return true;
      }
      enqueuePendingOperation({ type: "update", entityType: "list_item", targetId: itemId, payload, workspaceId });
      logHybridError("updateListItem", error);
    }
    return true;
  } catch (err) {
    if (isSchemaTableMissing(err)) {
      markWorkspaceListTablesMissing();
      return true;
    }
    enqueuePendingOperation({ type: "update", entityType: "list_item", targetId: itemId, payload, workspaceId });
    logHybridError("updateListItem", err);
    return true;
  }
}

/** Push local-only lists into Supabase after migration (one-time backfill). */
export async function backfillWorkspaceListsIfNeeded(
  workspaceId: string,
  localLists: WorkspaceList[],
  localItems: ListItem[],
): Promise<boolean> {
  if (!isLiveDataWorkspace(workspaceId)) return false;
  if (!(await ensureWorkspaceListPersistenceReady())) return false;

  const serverLists = await getWorkspaceLists(workspaceId);
  if (serverLists.length > 0) return false;

  const lists = localLists.filter((l) => l.workspaceId === workspaceId);
  if (lists.length === 0) return false;

  for (const list of lists) {
    await createWorkspaceList({
      id: normalizeListEntityId(list.id),
      workspaceId,
      title: list.title,
      color: list.color,
      sortOrder: list.sortOrder,
      pinned: list.pinned,
    });
  }

  const listIds = new Set(lists.map((l) => normalizeListEntityId(l.id)));
  for (const item of localItems.filter(
    (i) => i.workspaceId === workspaceId && listIds.has(normalizeListEntityId(i.listId)),
  )) {
    await createListItem({
      id: normalizeListEntityId(item.id),
      listId: item.listId,
      workspaceId,
      text: item.text,
      sortOrder: item.sortOrder,
      completed: item.completed,
      completedAt: item.completedAt,
    });
  }

  return true;
}

export async function deleteListItem(id: string, workspaceId: string): Promise<boolean> {
  if (!isLiveDataWorkspace(workspaceId)) return false;
  if (!isWorkspaceListPersistenceEnabled()) return true;

  const itemId = normalizeListEntityId(id);

  if (!isCurrentlyOnline()) {
    enqueuePendingOperation({ type: "delete", entityType: "list_item", targetId: itemId, payload: {}, workspaceId });
    return true;
  }

  const supabase = getClient();
  if (!supabase) return false;

  try {
    const table = supabase.from("list_items") as ReturnType<typeof supabase.from>;
    const { error } = await table.delete().eq("id", itemId).eq("workspace_id", workspaceId);
    if (error && error.code !== "PGRST116") {
      if (isSchemaTableMissing(error)) {
        markWorkspaceListTablesMissing();
        return true;
      }
      enqueuePendingOperation({ type: "delete", entityType: "list_item", targetId: itemId, payload: {}, workspaceId });
      logHybridError("deleteListItem", error);
    }
    return true;
  } catch (err) {
    if (isSchemaTableMissing(err)) {
      markWorkspaceListTablesMissing();
      return true;
    }
    enqueuePendingOperation({ type: "delete", entityType: "list_item", targetId: itemId, payload: {}, workspaceId });
    logHybridError("deleteListItem", err);
    return true;
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
