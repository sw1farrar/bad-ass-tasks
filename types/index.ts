// Central type definitions for Badazz Tasks
// These will map 1:1 to Supabase tables in Phase 2

import type { WorkspaceRole } from "@/lib/roles";
import type { WorkspaceSettings } from "@/lib/workspace/workspaceSettings";

export type Priority = "P0" | "P1" | "P2" | "P3";

export type TaskStatus = "backlog" | "todo" | "doing" | "done";

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: Priority;
  dueDate?: string | null;
  /** Resolved display label (enriched from assigneeIds + workspace members) */
  assignee?: string;
  /** Primary assignee user id(s); persisted to tasks.assignee_ids in Supabase */
  assigneeIds?: string[];
  tags: string[];
  createdAt: string;
  completedAt?: string;
  timeEstimate?: number;
  linkedNoteIds: string[];
  workspaceId: string;
  // Recurring engine (Agent 8 foundation) + production exceptions (Agent 13)
  // recurringRule: RRULE-ish string e.g. "FREQ=WEEKLY;BYDAY=MO;INTERVAL=1"
  // Optional extensions on recurringRule:
  //   FROMCOMPLETION=TRUE = rolling schedule from completion date (default fixed from due)
  //   X-SERIES-ANCHOR=YYYY-MM-DD = stable series seed (monthly day-of-month + COUNT across advances)
  // exceptionDates: ISO/ YYYY-MM-DD strings for skipped occurrences (enables "skip one" per series)
  // Non-breaking addition. "Change one instance" and advanced overrides future (e.g. via JSON overrides).
  recurringRule?: string | null;
  exceptionDates?: string[];
  // Parent for task decomposition / subtasks (Agent 15 AI + schema support; optional, non-breaking)
  // Enables improved extraction to create hierarchical action items. UI lists treat flat for now.
  parentTaskId?: string | null;
  /** User-marked important — surfaced in tasks table with star control + filter */
  starred?: boolean;
  /** Workspace task folder (organizational grouping) */
  folderId?: string | null;
  /**
   * When set, this row is a notebook task surfaced on the workspace Tasks page
   * (not a native workspace task row).
   */
  notebookId?: string | null;
  notebookName?: string | null;
}

/** Workspace-scoped folder for grouping tasks (distinct from Files view). */
export interface TaskFolder {
  id: string;
  workspaceId: string;
  name: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export type FileReviewStatus = "pending_review" | "filed";

export type FileRecordType = "note" | "email" | "document" | "receipt" | "other";

export type { ReceiptLineItemRecord } from "@/lib/files/receiptLineItems";
export type { FileAiSuggestion, FileAiSuggestionStatus } from "@/lib/files/fileAiSuggestion";

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
  searchPlain?: string | null; // Denormalized search text (email body included)
  rawHtml?: string | null; // Archived inbound HTML for re-render
  emailSource?: string | null; // EML storage path or brevo:messageId
  emailPipelineVersion?: number | null;
  /** Files workflow: pending_review = triage queue; filed = approved library */
  reviewStatus?: FileReviewStatus;
  recordType?: FileRecordType;
  memo?: string | null;
  filedAt?: string | null;
  reviewedBy?: string | null;
  searchDocument?: string | null;
  isArchived?: boolean;
  /** User-flagged bookmark in Files browse */
  bookmarked?: boolean;
  /** False when only list metadata is loaded; true after full body fetch. */
  bodyHydrated?: boolean;
  /** Precomputed AI filing suggestion while note is in pending_review. */
  aiSuggestion?: import("@/lib/files/fileAiSuggestion").FileAiSuggestion | null;
  /** When set, this note belongs to a workspace notebook (not Files). */
  notebookId?: string | null;
}

/** Workspace notebook container for rich-text notes (distinct from Files). */
export interface Notebook {
  id: string;
  workspaceId: string;
  name: string;
  sortOrder: number;
  /** Section tabs shown for this notebook (notes, tasks, investments, etc.). */
  enabledSections?: import("@/lib/notebooks/notebookSections").NotebookSectionTab[];
  /** Our sales for market-share comparison in the Competitors section. */
  ourSales?: number;
  archived?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface NotebookTask {
  id: string;
  notebookId: string;
  workspaceId: string;
  title: string;
  completed: boolean;
  sortOrder: number;
  /** When true, also appear on the workspace Tasks page. */
  showOnWorkspace?: boolean;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NotebookTaskProgress {
  id: string;
  taskId: string;
  body: string;
  authorId?: string | null;
  createdAt: string;
}

export interface NotebookInvestment {
  id: string;
  notebookId: string;
  workspaceId: string;
  title: string;
  sortOrder: number;
  completed?: boolean;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NotebookInvestmentNote {
  id: string;
  investmentId: string;
  body: string;
  authorId?: string | null;
  createdAt: string;
}

export interface NotebookCustomer {
  id: string;
  notebookId: string;
  workspaceId: string;
  accountName: string;
  createdAt: string;
  updatedAt: string;
}

export interface NotebookCustomerNote {
  id: string;
  customerId: string;
  body: string;
  authorId?: string | null;
  createdAt: string;
}

export interface NotebookCompetitor {
  id: string;
  notebookId: string;
  workspaceId: string;
  name: string;
  salesPotential: number;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface NotebookCompetitorNote {
  id: string;
  competitorId: string;
  body: string;
  authorId?: string | null;
  createdAt: string;
}

export type HealthMetricType =
  | "weight"
  | "body_fat"
  | "muscle_mass"
  | "waist"
  | "blood_pressure_systolic"
  | "resting_hr"
  | "sleep_hours"
  | "steps"
  | "active_minutes"
  | "calories_burned";

export interface HealthReading {
  id: string;
  workspaceId: string;
  userId: string;
  metricType: HealthMetricType;
  value: number;
  unit: string;
  recordedAt: string;
  note?: string | null;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface HealthProfile {
  workspaceId: string;
  userId: string;
  heightCm?: number | null;
  weightGoal?: number | null;
  weightUnit: string;
  updatedAt: string;
}

export type MeetingStatus = "draft" | "scheduled" | "in_progress" | "completed";
export type AgendaItemStatus = "open" | "in_progress" | "completed" | "continued";

export interface Meeting {
  id: string;
  workspaceId: string;
  title: string;
  /** Optional one-line / short blurb shown in the header and on agenda/summary exports. */
  description?: string | null;
  status: MeetingStatus;
  scheduledAt?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  previousMeetingId?: string | null;
  notebookId?: string | null;
  /** Legacy workspace-member UUID attendees (kept for older rows / filters). */
  attendeeIds: string[];
  /** Freeform attendee display names. */
  attendees?: string[];
  summaryHtml?: string | null;
  sortOrder: number;
  archived?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MeetingAgendaItem {
  id: string;
  meetingId: string;
  title: string;
  description?: string | null;
  sortOrder: number;
  ownerId?: string | null;
  /** Free-text responsible when not a workspace member. */
  ownerName?: string | null;
  status: AgendaItemStatus;
  /**
   * Covered in this meeting for carry-forward. Persists across complete/reopen
   * so returning a completed topic to Active keeps the Reviewed state.
   */
  reviewed?: boolean;
  continuedFromItemId?: string | null;
  linkedTaskIds: string[];
  timeBudgetMinutes?: number | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MeetingAgendaEntry {
  id: string;
  agendaItemId: string;
  body: string;
  authorId?: string | null;
  isDecision?: boolean;
  createdAt: string;
}

/** Google Keep–style checklist list (workspace-scoped). */
/** Active cross-workspace link for a list (source workspace perspective). */
export interface ListShareTarget {
  shareId: string;
  targetWorkspaceId: string;
  targetWorkspaceName: string;
  permission: "view" | "edit" | "manage";
  createdAt: string;
}

export interface WorkspaceList {
  id: string;
  workspaceId: string;
  title: string;
  color: string;
  sortOrder: number;
  pinned?: boolean;
  archived?: boolean;
  /** Live-linked list shared from another workspace into the current one. */
  isShared?: boolean;
  sourceWorkspaceId?: string;
  sourceWorkspaceName?: string;
  sharedByName?: string;
  shareId?: string;
  sharePermission?: "view" | "edit" | "manage";
  createdAt: string;
  updatedAt: string;
}

export interface ListItem {
  id: string;
  listId: string;
  workspaceId: string;
  text: string;
  completed: boolean;
  /** Parked item — hidden from the active list until restored. */
  pending?: boolean;
  sortOrder: number;
  /** Parent row for nested items; null/undefined = top-level. */
  parentItemId?: string | null;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  role: WorkspaceRole;
  owner_id?: string | null; // widened for hybridStore/page access to match schema (no behavior change)
  createdAt?: string; // from workspaces.created_at — used to identify the original workspace
  settings?: WorkspaceSettings;
}

export interface WorkspaceTaskStats {
  openCount: number;
  totalTaskCount: number;
  doneCount: number;
  overdueCount: number;
  dueTodayCount: number;
  assigneeBreakdown: Array<{ label: string; count: number }>;
  listCount?: number;
  openListItemsCount?: number;
  noteCount?: number;
  /** Files awaiting review in this workspace (Home tiles — workspace-independent). */
  pendingReviewCount?: number;
  memberCount?: number;
  /** True when workspace has 2+ members and chat has unread messages/reactions. */
  unreadChat?: boolean;
}

/** Cross-workspace list row for the Home hub (separate from per-workspace Lists view). */
export interface HomeListHighlight {
  id: string;
  title: string;
  color: string;
  workspaceId: string;
  workspaceName: string;
  openCount: number;
  totalCount: number;
  preview: string[];
  pinned?: boolean;
}

export interface WorkspaceMember {
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
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
  role: WorkspaceRole;
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
  role: WorkspaceRole;
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
  /**
   * Legacy DM peer (optional). Shared channels use conversationId instead.
   */
  recipientUserId?: string | null;
  /** Shared channel id; NULL = General (legacy team) channel */
  conversationId?: string | null;
  body: string;
  createdAt: string;
  /** Populated from profiles/members join when available */
  authorName?: string;
  authorUsername?: string;
}

/** Shared workspace chat thread: General channel or a named channel. */
export type ChatConversationId =
  | { kind: "general" }
  | { kind: "channel"; conversationId: string };

/** Shared channel row (all workspace members can see / post). */
export interface WorkspaceConversation {
  id: string;
  workspaceId: string;
  name: string;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Per-user archive prefs (and legacy custom titles) keyed by conversation_key. */
export interface WorkspaceConversationPref {
  id: string;
  workspaceId: string;
  userId: string;
  conversationKey: string;
  title?: string | null;
  archivedAt?: string | null;
  createdAt: string;
  updatedAt: string;
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

/** Aggregated comment metadata for task list indicators */
export interface TaskCommentSummary {
  count: number;
  latestAt: string;
  latestUserId: string;
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
  entityType: 'task' | 'note' | 'list' | 'list_item';
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

export interface ListShareInvite {
  id: string;
  listId: string;
  sourceWorkspaceId: string;
  invitedUserId: string;
  recipientEmail?: string;
  invitedFullName?: string;
  invitedUsername?: string;
  expiresAt?: string;
  createdAt: string;
}

export type NotificationType =
  | 'mention'
  | 'comment'
  | 'invite'
  | 'list_share'
  | 'task_assigned'
  | 'deadline'
  | 'activity'
  | 'inbound_file';

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

export interface NotificationTypeChannelPrefs {
  inApp: boolean;
  email: boolean;
}

export interface NotificationPrefs {
  types: Record<NotificationType, NotificationTypeChannelPrefs>;
  perWorkspace?: Record<string, { muted?: boolean; email?: boolean }>;
  muteUntil?: string | null;
}
