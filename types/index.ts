// Central type definitions for Bad Ass Tasks
// These will map 1:1 to Supabase tables in Phase 2

export type Priority = "P0" | "P1" | "P2" | "P3";

export type TaskStatus = "backlog" | "todo" | "doing" | "done";

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: Priority;
  dueDate?: string;
  assignee?: string;
  tags: string[];
  createdAt: string;
  completedAt?: string;
  timeEstimate?: number;
  linkedNoteIds: string[];
  workspaceId: string;
  // Recurring engine (Agent 8 foundation) + production exceptions (Agent 13)
  // recurringRule: RRULE-ish string e.g. "FREQ=WEEKLY;BYDAY=MO;INTERVAL=1"
  // exceptionDates: ISO/ YYYY-MM-DD strings for skipped occurrences (enables "skip one" per series)
  // Non-breaking addition. "Change one instance" and advanced overrides future (e.g. via JSON overrides).
  recurringRule?: string | null;
  exceptionDates?: string[];
  // Parent for task decomposition / subtasks (Agent 15 AI + schema support; optional, non-breaking)
  // Enables improved extraction to create hierarchical action items. UI lists treat flat for now.
  parentTaskId?: string | null;
}

export interface Note {
  id: string;
  title: string;
  content: string; // Will become TipTap JSON in future
  createdAt: string;
  updatedAt: string;
  tags: string[];
  linkedTaskIds: string[];
  linkedNoteIds?: string[]; // M2 bidirectional note-to-note
  workspaceId: string;
  parentNoteId?: string | null; // Milestone 2: note hierarchy support
  sortOrder?: number; // M2 explicit drag ordering within parent (groundwork)
  snapshots?: Array<{ ts: string; content: string; label: string }>; // M2 version history server persistence
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  role: "owner" | "admin" | "user";
  owner_id?: string | null; // widened for hybridStore/page access to match schema (no behavior change)
  createdAt?: string; // from workspaces.created_at — used to identify the original workspace
}

export interface WorkspaceMember {
  workspaceId: string;
  userId: string;
  role: "owner" | "admin" | "user";
  joinedAt: string;
  invitedBy?: string;
  // Enriched from profiles join (best effort)
  fullName?: string;
  username?: string;     // @handle
  avatarUrl?: string;
  location?: string;     // "Where you're from"
  lastActiveAt?: string; // From profiles.last_active_at – useful for "last seen"
  // Note: email is deliberately not included here for privacy in member lists.
}

export interface WorkspaceInvite {
  id: string;
  workspaceId: string;
  email?: string | null;
  role: "owner" | "admin" | "user";
  invitedBy?: string;
  invitedUserId?: string;
  // Populated via profiles join when the invite came from the search flow (invited_user_id present)
  invitedFullName?: string;
  invitedUsername?: string;
  invitedAvatarUrl?: string;
  expiresAt?: string;
  acceptedAt?: string;
  createdAt: string;
  // For UI: computed invite link (not stored)
  inviteLink?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  role: "owner" | "admin" | "user";
}

export interface ActivityLog {
  id: string;
  workspaceId: string;
  userId?: string;
  actionType: string; // e.g. 'task.created', 'task.completed', 'note.created', 'workspace.switched', 'comment.added'
  targetType: string; // 'task', 'note', 'workspace'
  targetId?: string;
  metadata: Record<string, unknown>; // Strengthened: no loose any
  createdAt: string;
}

export interface WorkspaceMessage {
  id: string;
  workspaceId: string;
  userId: string;
  body: string;
  createdAt: string;
  /** Populated from profiles/members join when available */
  authorName?: string;
  authorUsername?: string;
}

export interface MessageReaction {
  id: string;
  messageId: string;
  workspaceId: string;
  userId: string;
  emoji: string;
  createdAt: string;
}

export interface ReactionSummary {
  emoji: string;
  count: number;
  userIds: string[];
  reactedByMe: boolean;
}

export interface Comment {
  id: string;
  content: string;
  userId: string;
  taskId?: string;
  noteId?: string;
  parentCommentId?: string;
  createdAt: string;
  updatedAt?: string;
  // Optional denormed for UI (from profile join or metadata)
  userName?: string;
  userEmail?: string;
}

export interface Command {
  id: string;
  label: string;
  description?: string;
  shortcut?: string;
  action: () => void;
  section: string;
  icon?: string;
}

// ------------------------------------------------------------------
// Offline / Persistence Layer Types (Phase 1: basic offline support)
// ------------------------------------------------------------------

/**
 * Represents a single queued write operation for offline support.
 * Used by hybrid data layer when Supabase is configured but network is unavailable
 * or a write fails transiently. Survives page refresh via localStorage (live mode only).
 */
export interface PendingOperation {
  opId: string;           // Unique identifier for this queue entry (UUID)
  type: 'create' | 'update' | 'delete';
  entityType: 'task' | 'note';
  targetId: string;       // The entity id (client-generated UUID for creates; real id otherwise)
  payload: Record<string, unknown>; // Strengthened (was any): op-specific data. Use type assertion at call sites if needed.
  timestamp: string;      // ISO string of when this op was originally attempted (client clock)
  workspaceId: string;    // Workspace context for the op (for safety scoping)
}

/**
 * Branded/strict type for payloads in offline queue (improves safety over raw Record).
 * Callers may still cast specific shapes when enqueueing (hybridStore handles the fields).
 */
export type PendingOperationPayload = Record<string, unknown>;

// ------------------------------------------------------------------
// Agent 31: Notification System Types
// ------------------------------------------------------------------

export type NotificationType = 'mention' | 'comment' | 'invite' | 'task_assigned' | 'deadline' | 'activity';

export interface Notification {
  id: string;
  workspaceId: string;
  userId: string; // recipient
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  readAt?: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
  activityLogId?: string;
}

export interface NotificationPrefs {
  email: boolean;
  inApp: boolean;
  types: Record<NotificationType, boolean>;
  perWorkspace?: Record<string, { muted?: boolean; email?: boolean }>;
  muteUntil?: string | null;
}
