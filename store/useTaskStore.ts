import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { Task, Note, Workspace, Priority, TaskStatus, ActivityLog, WorkspaceMember, WorkspaceInvite, Comment, Notification, NotificationPrefs, NotificationType, WorkspaceTaskStats, WorkspaceList, ListItem, HomeListHighlight } from "@/types";
import {
  buildListHighlightsForWorkspace,
  computeWorkspaceListStats,
  mergeListItems,
  mergeWorkspaceLists,
  pickGlobalListHighlights,
} from "@/features/home/lib/buildListHighlights";
import {
  buildGlobalOpenTaskFocus,
  buildGlobalUpcomingFocus,
  pickDueAttentionTasksFromWorkspace,
  pickUpcomingTasksFromWorkspace,
  sortOpenTaskFocusItems,
  sortUpcomingFocusItems,
} from "@/features/home/lib/buildUpcomingFocus";
import { computeWorkspaceTaskStats } from "@/features/home/lib/computeWorkspaceTaskStats";
import {
  createListSliceActions,
  SAMPLE_WORKSPACE_LISTS,
  SAMPLE_LIST_ITEMS,
  type ListSliceActions,
} from "@/store/listSlice";
import { buildAssigneeBreakdown, enrichTasksWithAssignees, resolveAssigneeLabel } from "@/lib/assignee";
import { mapRealtimeNoteRow, mergeRealtimeNoteUpdate } from "@/lib/notes/mapRealtimeNoteRow";
import { generateId, parseNaturalLanguage, getNextRecurringDue, toDueDateStorage } from "@/lib/utils";
import { startOfLocalToday, isDueDateOnOrBefore, isDueDatePast, isDueDateToday, parseLocalDate, toLocalDateString } from "@/lib/datetime";
import {
  canDeleteWorkspace,
  getWorkspaceSwitchTargetAfterDelete,
} from "@/lib/workspaceGuards";
import {
  getLastWorkspaceId,
  resolveCurrentWorkspace,
  saveLastWorkspaceId,
} from "@/lib/workspacePersistence";
import { toast } from "sonner";
import { fromDbRole, formatRoleLabel, type WorkspaceRole } from "@/lib/roles";
import {
  getTasks,
  getWorkspaceLists,
  getListItems,
  ensureWorkspaceListPersistenceReady,
  areWorkspaceListTablesReady,
  backfillWorkspaceListsIfNeeded,
  remapLegacyListIdsInState,
  createTask as createTaskSupabase,
  updateTask as updateTaskSupabase,
  deleteTask as deleteTaskSupabase,
  moveTask as moveTaskSupabase,
  getNotes,
  createNote as createNoteSupabase,
  updateNote as updateNoteSupabase,
  deleteNote as deleteNoteSupabase,
  isSupabaseLive,
  logActivity,
  getRecentActivity,
  // Offline / persistence enhancements (Phase 1)
  getPendingCount,
  processPendingOperations,
  getIsOnline,
  getPendingOperations,
  clearPendingOperations,
  generateClientId,
  // Phase 2 collaboration foundations
  getWorkspaceMembers,
  getWorkspaceInvites,
  createInvite,
  acceptInvite,
  updateMemberRole,
  removeMember,
  revokeInvite,
  sendInviteEmail,
  updateWorkspace,
  deleteWorkspace,
  updateMyProfile, // self profile (name + location)
  getMyProfile,
  searchPotentialTeammates, // new: multi-field (name/username/location/city) search for empty-owner invite UX (RPC-backed, RLS-safe)
  subscribeToWorkspaceRealtime,
  getWorkspacePresenceChannel,
  // Comments (Agent 14 realtime collab)
  getComments,
  createComment,
  // Agent 18: Admin/Export/Import/Templates/Stats + enhanced audit logging
  getWorkspaceStats,
  exportWorkspaceData,
  importWorkspaceData,
  getTemplates,
  logTemplateAction,
  ADMIN_TEMPLATE_LIBRARY,
  getStaticTemplates,
  templateToTaskPayload,
  templateToNotePayload,
  hasTemplateTag,
  // Agent 31: Notifications foundation (in-app + email for mentions/comments/invites/assignments/deadlines)
  getUserNotifications,
  createNotification,
  markNotificationsRead,
  getUnreadNotificationCount,
  sendNotificationEmail,
  extractMentions,
  deleteNotification,
  clearAllNotifications,
  getUserNotificationPrefs,
  updateUserNotificationPrefs,
  fetchWorkspaceMessages,
  fetchWorkspaceMessageReactions,
} from "@/lib/data/hybridStore";
import { hasUnreadChatActivity } from "@/lib/chatReadState";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

// Safe storage for Zustand persist (prevents "storage unavailable" warnings during SSR / early hydration / Turbopack)
const safeLocalStorage = createJSONStorage(() => {
  if (typeof window === "undefined") {
    return {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    };
  }
  return localStorage;
});

/** Resolve a task from the current workspace list or the Home cross-workspace focus slice. */
type HomeFocusItem = { task: Task; workspaceId: string; workspaceName: string };

function resolveTaskInStore(
  state: Pick<TaskState, "tasks" | "globalTodayFocus" | "globalOpenTaskFocus">,
  id: string
): Task | undefined {
  return (
    state.tasks.find((t) => t.id === id) ??
    state.globalTodayFocus.find((f) => f.task.id === id)?.task ??
    state.globalOpenTaskFocus.find((f) => f.task.id === id)?.task
  );
}

function patchHomeFocusSlice(
  items: HomeFocusItem[],
  id: string,
  apply: (task: Task) => Task,
): HomeFocusItem[] {
  return items.some((f) => f.task.id === id)
    ? items.map((f) => (f.task.id === id ? { ...f, task: apply(f.task) } : f))
    : items;
}

function patchTaskInSlices(
  state: TaskState,
  id: string,
  patch: Partial<Task> | ((task: Task) => Task)
): Pick<TaskState, "tasks" | "globalTodayFocus" | "globalOpenTaskFocus"> {
  const apply = (task: Task) =>
    typeof patch === "function" ? patch(task) : { ...task, ...patch };

  return {
    tasks: state.tasks.some((t) => t.id === id)
      ? state.tasks.map((t) => (t.id === id ? apply(t) : t))
      : state.tasks,
    globalTodayFocus: patchHomeFocusSlice(state.globalTodayFocus, id, apply),
    globalOpenTaskFocus: patchHomeFocusSlice(state.globalOpenTaskFocus, id, apply),
  };
}

function removeTaskFromSlices(
  state: TaskState,
  id: string,
): Pick<TaskState, "tasks" | "globalTodayFocus" | "globalOpenTaskFocus"> {
  return {
    tasks: state.tasks.filter((t) => t.id !== id),
    globalTodayFocus: state.globalTodayFocus.filter((f) => f.task.id !== id),
    globalOpenTaskFocus: state.globalOpenTaskFocus.filter((f) => f.task.id !== id),
  };
}

// Agent 30: deterministic fun user color for live cursors / presence avatars (no deps)
function getUserColor(userIdOrEmail: string): string {
  const palette = ['#00ff9f', '#c084fc', '#ff6b6b', '#60a5fa', '#fbbf24', '#34d399'];
  let hash = 0;
  for (let i = 0; i < userIdOrEmail.length; i++) hash = (hash * 31 + userIdOrEmail.charCodeAt(i)) | 0;
  return palette[Math.abs(hash) % palette.length];
}

type AppView = "home" | "tasks" | "notes" | "lists" | "teams" | "settings" | "admin";

interface TaskState extends ListSliceActions {
  // Data
  tasks: Task[];
  notes: Note[];
  workspaceLists: WorkspaceList[];
  listItems: ListItem[];
  currentWorkspace: Workspace;
  workspaces: Workspace[];
  recentActivity: ActivityLog[];

  // C4 Phase A: Home Global Workspace Hub - separate slices (never pollute per-ws state)
  globalTodayFocus: Array<{ task: Task; workspaceId: string; workspaceName: string }>;
  /** Cross-workspace overdue + today + tomorrow tasks for the Home hub list. */
  globalOpenTaskFocus: Array<{ task: Task; workspaceId: string; workspaceName: string }>;
  globalWorkspaceStats: Record<string, WorkspaceTaskStats>;
  globalListHighlights: HomeListHighlight[];

  // UI State
  currentView: AppView;
  taskFilter: {
    status?: TaskStatus[];
    search: string;
    // Agent 13: recurring-aware filtering
    recurring?: "all" | "only" | "none";
  };
  selectedTaskId: string | null;
  isCommandPaletteOpen: boolean;
  isKeyboardCheatsheetOpen: boolean;
  isInitializing: boolean;

  // Per-task operation loading states (Phase 1: individual CRUD feedback + optimistic)
  taskLoadingStates: Record<string, boolean>;

  // Offline + basic persistence/sync state (Phase 1 mission: improve offline support when Supabase configured)
  isOnline: boolean;
  isSyncing: boolean;
  pendingSyncCount: number;
  lastSyncAt: string | null;

  // Auth state (Phase 1 scaffolding)
  user: User | null;
  session: Session | null;
  isAuthLoading: boolean;
  isSigningOut: boolean;
  isSiteAdmin: boolean;
  /** User-scoped profile cache — survives workspace switches (prevents greeting flicker). */
  myProfile: { fullName?: string; username?: string; location?: string } | null;

  // Phase 2 collaboration state
  members: WorkspaceMember[];
  invites: WorkspaceInvite[];
  onlineUsers: Array<{ userId: string; email?: string; fullName?: string; username?: string; presenceRef?: string; view?: string; editingItemId?: string; editingItemType?: 'task' | 'note' }>;
  isLoadingMembers: boolean;
  // Comments (Agent 14)
  comments: Comment[];
  isLoadingComments: boolean;

  // Agent 31: Notification center state (bell + list, realtime, prefs)
  notifications: Notification[];
  unreadNotifCount: number;
  isLoadingNotifications: boolean;
  notificationPrefs: NotificationPrefs | null;

  // Agent 30: Live collab polish - remote cursors/selection for live cursors in editor + views, conflicts
  remoteCursors: Array<{ userId: string; email?: string; itemId?: string; itemType?: 'task' | 'note'; from: number; to: number; color?: string }>;
  activeConflicts: Record<string, { itemId: string; itemType: 'task' | 'note'; remoteUser: string; remoteUpdatedAt: string; remotePreview?: string }>;

  // Live collaborative editing (lightweight broadcast on presence channel + optimistic apply)
  // Source of truth remains postgres_changes + LWW. This is for "while typing" feel only.
  liveEditing: Record<string, { userId: string; email?: string; itemType: 'task' | 'note'; lastUpdatedAt: string }>;

  // Realtime presence polish (Agent 14): update meta for cross-view / per-item indicators
  updatePresenceMeta: (meta?: { view?: string; editingItemId?: string; editingItemType?: 'task' | 'note' }) => void;

  // Agent 30: broadcast cursor/selection + conflict helpers (builds on existing presence channel)
  updateCursorPosition: (itemType?: 'task' | 'note', itemId?: string, from?: number, to?: number) => void;
  clearCursorPosition: () => void;
  resolveConflict: (itemId: string, keepLocal: boolean) => Promise<void>;
  startDemoPresenceSimulator: () => void; // Agent 30: delightful simulated live collab in demo mode

  // Live collab (lightweight broadcast) - Slice 1 foundation
  broadcastLiveTaskEdit: (taskId: string, updates: { title?: string; description?: string }) => void;
  broadcastLiveNoteContent: (noteId: string, content: string) => void;

  // Actions - Tasks
  addTask: (input: string) => Promise<Task | null>;
  updateTask: (id: string, updates: Partial<Task>) => Promise<boolean | null>;
  deleteTask: (id: string) => Promise<boolean | null>;
  completeTask: (id: string) => Promise<"advanced" | "completed" | null>;
  moveTask: (id: string, newStatus: TaskStatus) => Promise<boolean | null>;
  reorderTasks: (activeId: string, overId: string) => void;

  /** Early Phase 4 recurring scaffolding (non-breaking stub).
   *  Delegates to updateTask for now. Full RRULE engine, scheduling, auto-generation in Phase 4.
   */
  setRecurringRule: (id: string, recurringRule: string | null) => Promise<boolean | null>;

  // Actions - Notes (now wired through hybrid layer, mirroring tasks)
  addNote: (title: string, content?: string) => Promise<Note | null>;
  updateNote: (id: string, updates: Partial<Note>) => Promise<boolean | null>;
  deleteNote: (id: string) => Promise<boolean | null>;

  // UI
  setView: (view: AppView) => void;
  setTaskFilter: (filter: Partial<TaskState["taskFilter"]>) => void;
  selectTask: (id: string | null) => void;
  toggleCommandPalette: (open?: boolean) => void;
  toggleKeyboardCheatsheet: (open?: boolean) => void;

  // Workspace (demo in !live mode)
  switchWorkspace: (id: string) => void;

  // Phase 1 real workspace support (ensure for post-login)
  ensureUserHasWorkspace: () => Promise<void>;

  // Helpers
  getFilteredTasks: () => Task[];
  getTasksByStatus: (status: TaskStatus) => Task[];

  // Auth + data init (Phase 1 UX)
  initializeAuth: () => Promise<void>;
  initializeFromSupabase: () => Promise<void>;
  signOut: () => Promise<void>;

  // Workspace loading (used in auth flow for live mode)
  fetchUserWorkspaces: () => Promise<void>;

  // Create additional real workspaces (beyond auto "Personal" on first login). Works in LIVE + keeps demo working.
  createWorkspace: (name: string) => Promise<Workspace | null>;

  // Refresh recent activity for current workspace (enables full dedicated activity log panel UX without full data re-init)
  refreshRecentActivity: () => Promise<void>;

  // Offline / sync controls (exposed for future UI status badges, manual "Sync now", etc.)
  syncPendingWrites: () => Promise<void>;
  refreshOfflineStatus: () => void;

  // Phase 2: Collaboration actions (members, invites, realtime wiring)
  fetchMembers: () => Promise<void>;
  fetchInvites: () => Promise<void>;
  sendInvite: (email?: string, role?: WorkspaceRole, invitedUserId?: string) => Promise<string | null>; // returns inviteId or null
  acceptInviteLink: (inviteId: string) => Promise<string | null>; // returns wsId
  changeMemberRole: (userId: string, newRole: WorkspaceRole) => Promise<boolean>;
  transferWorkspaceOwnership: (newOwnerId: string) => Promise<boolean>;
  removeWorkspaceMember: (userId: string) => Promise<boolean>;
  // Profile self-edit (name, username/handle, location). Personal, RLS-protected.
  updateMyProfile: (updates: { fullName?: string; username?: string; location?: string }) => Promise<boolean>;
  // Teammate search for invite (name/username/location/city/email) - empty owner state only, RPC-backed
  searchPotentialTeammates: (query: string, currentWorkspaceId?: string) => Promise<Array<{ id: string; fullName?: string; username?: string; location?: string; email?: string; avatarUrl?: string }>>;
  revokeInvite: (inviteId: string) => Promise<boolean>; // new for invite flow
  resendInvite: (inviteId: string) => Promise<boolean>; // resend UX: create fresh invite (same email/role, new expiry) then revoke old. Small increment.
  declineReceivedInvite: (inviteId: string) => Promise<boolean>; // recipient declines → fully removes the invite for everyone
  exitWorkspace: (workspaceId?: string) => Promise<boolean>; // self-service offboarding (world-class symmetric exit)
  updateWorkspaceDetails: (updates: { name?: string; slug?: string }) => Promise<boolean>;
  deleteCurrentWorkspace: () => Promise<boolean>;
  setupWorkspaceRealtime: () => void; // wires subs + presence (idempotent per ws)
  teardownWorkspaceRealtime: () => void;

  // Comments (Agent 14 realtime + @mentions polish)
  fetchComments: (target: { taskId?: string; noteId?: string }) => Promise<void>;
  addComment: (content: string, target: { taskId?: string; noteId?: string; parentCommentId?: string }) => Promise<boolean>;

  // Agent 31: Notifications (bell center, realtime, prefs, email for key events)
  fetchNotifications: (unreadOnly?: boolean) => Promise<void>;
  markNotifRead: (idOrIds: string | string[]) => Promise<void>;
  markAllNotifsRead: () => Promise<void>;
  refreshUnreadCount: () => Promise<void>;
  deleteNotification: (id: string) => Promise<boolean>;
  clearAllNotifications: () => Promise<boolean>;
  updateNotificationPrefs: (updates: Partial<NotificationPrefs>) => Promise<void>;
  loadNotificationPrefs: () => Promise<void>;

  // Agent 18: Team/Admin dashboard, export/import, templates, stats + audit
  getWorkspaceStats: () => Promise<any>;
  exportWorkspace: (format: "json" | "csv" | "md" | "all") => Promise<void>;
  importWorkspaceData: (parsed: { tasks?: any[]; notes?: any[] }, options?: { conflictStrategy?: "append" | "skip-dupe-titles" }) => Promise<{ importedTasks: number; importedNotes: number; skippedTasks?: number; skippedNotes?: number }>;
  getTemplates: () => Promise<{ taskTemplates: Task[]; noteTemplates: Note[] }>;
  applyTemplate: (tpl: any) => Promise<any>;
  saveCurrentAsTemplate: (type: "task" | "note", id: string) => Promise<void>;
  getAdminTemplateLibrary: () => any[];

  // C4-Exec-3 Phase A MVP: global Home hub separate slices (read-only aggregates)
  fetchGlobalHomeAggregates: () => Promise<void>;
  /** Instant Home list chips + workspace list stats from local store (no network). */
  refreshHomeListAggregatesFromStore: () => void;
  /** Instant Home upcoming task rows from local store (no network). */
  refreshHomeTaskFocusFromStore: () => void;
  /** Load list + item rows for a workspace into the store (no workspace switch). */
  hydrateWorkspaceListData: (workspaceId: string) => Promise<void>;

  // Platform site admin (server-verified via /api/admin/me)
  fetchSiteAdminStatus: () => Promise<void>;
  fetchMyProfile: () => Promise<void>;
}

function clearedLiveSessionState() {
  return {
    tasks: [],
    notes: [],
    workspaceLists: [],
    listItems: [],
    recentActivity: [],
    workspaces: [],
    currentWorkspace: { id: "", name: "", slug: "", role: "member" } as Workspace,
    taskLoadingStates: {},
    members: [],
    invites: [],
    notifications: [],
    unreadNotifCount: 0,
    comments: [],
    selectedTaskId: null,
    isInitializing: false,
    pendingSyncCount: 0,
    isSyncing: false,
  };
}

// Demo-only beautiful sample data. Used EXCLUSIVELY when !isSupabaseLive() (no keys configured).
// When a real user is authenticated against live Supabase, MULTIPLE hardened guards (initializeAuth wipe,
// onFinishHydration sanitizer, initializeFromSupabase force-[] on demo IDs, ensureUserHasWorkspace flow)
// guarantee ZERO sample pollution ever reaches the store or UI. Samples NEVER leak into live auth sessions.
const SAMPLE_TASKS: Task[] = [
  {
    id: "t1",
    title: "Ship investor deck v4",
    description: "Finalize the 12-slide deck with updated traction metrics and competitive landscape.",
    status: "doing",
    priority: "P0",
    dueDate: new Date(Date.now() + 1000 * 3600 * 18).toISOString(),
    assignee: "You",
    tags: ["investors", "deck"],
    createdAt: new Date(Date.now() - 1000 * 3600 * 6).toISOString(),
    timeEstimate: 180,
    linkedNoteIds: ["n1"],
    workspaceId: "w1",
  },
  {
    id: "t2",
    title: "Review Q3 financial model with Sarah",
    description: "Go through the updated model. Focus on burn rate and runway scenarios.",
    status: "todo",
    priority: "P1",
    dueDate: new Date(Date.now() + 1000 * 3600 * 30).toISOString(),
    assignee: "Sarah",
    tags: ["finance", "sarah"],
    createdAt: new Date(Date.now() - 1000 * 3600 * 20).toISOString(),
    timeEstimate: 45,
    linkedNoteIds: [],
    workspaceId: "w1",
  },
  {
    id: "t3",
    title: "Polish landing page copy and hero animation",
    description: "Make the headline punchier. Add the new customer quote.",
    status: "doing",
    priority: "P1",
    dueDate: new Date(Date.now() + 1000 * 3600 * 8).toISOString(),
    assignee: "You",
    tags: ["marketing", "website"],
    createdAt: new Date(Date.now() - 1000 * 3600 * 4).toISOString(),
    timeEstimate: 90,
    linkedNoteIds: ["n2"],
    workspaceId: "w1",
  },
  {
    id: "t4",
    title: "Schedule user interviews for new onboarding flow",
    description: "",
    status: "backlog",
    priority: "P2",
    dueDate: new Date(Date.now() + 1000 * 3600 * 72).toISOString(),
    assignee: "You",
    tags: ["research"],
    createdAt: new Date(Date.now() - 1000 * 3600 * 30).toISOString(),
    linkedNoteIds: [],
    workspaceId: "w1",
  },
  {
    id: "t5",
    title: "Fix critical billing edge case for annual plans",
    description: "Users upgrading from monthly to annual are getting charged twice.",
    status: "todo",
    priority: "P0",
    dueDate: new Date(Date.now() + 1000 * 3600 * 5).toISOString(),
    assignee: "Alex",
    tags: ["bug", "billing"],
    createdAt: new Date(Date.now() - 1000 * 3600 * 2).toISOString(),
    timeEstimate: 120,
    linkedNoteIds: [],
    workspaceId: "w1",
  },
  {
    id: "t6",
    title: "Write launch announcement thread",
    description: "Twitter + LinkedIn. Make it personal and exciting.",
    status: "backlog",
    priority: "P2",
    dueDate: new Date(Date.now() + 1000 * 3600 * 100).toISOString(),
    assignee: "You",
    tags: ["content", "launch"],
    createdAt: new Date(Date.now() - 1000 * 3600 * 48).toISOString(),
    linkedNoteIds: ["n3"],
    workspaceId: "w1",
  },
  {
    id: "t7",
    title: "Migrate legacy user data to new schema",
    description: "One-time migration script + verification dashboard.",
    status: "done",
    priority: "P1",
    dueDate: new Date(Date.now() - 1000 * 3600 * 12).toISOString(),
    assignee: "You",
    tags: ["engineering"],
    createdAt: new Date(Date.now() - 1000 * 3600 * 100).toISOString(),
    completedAt: new Date(Date.now() - 1000 * 3600 * 10).toISOString(),
    linkedNoteIds: [],
    workspaceId: "w1",
  },
  // Agent 13 demo samples for recurring engine (never leak to live)
  {
    id: "t8",
    title: "Weekly team sync & metrics review",
    description: "Recurring every Monday. Use calendar to skip or drag series.",
    status: "todo",
    priority: "P2",
    dueDate: new Date(Date.now() + 1000 * 3600 * 24).toISOString(),
    assignee: "You",
    tags: ["recurring", "team"],
    createdAt: new Date(Date.now() - 1000 * 3600 * 50).toISOString(),
    recurringRule: "FREQ=WEEKLY;BYDAY=MO",
    exceptionDates: [],
    linkedNoteIds: [],
    workspaceId: "w1",
  },
  {
    id: "t9",
    title: "Monthly finance close",
    description: "End of month recurring (demo with one skipped occurrence).",
    status: "todo",
    priority: "P1",
    dueDate: new Date(Date.now() + 1000 * 3600 * 72).toISOString(),
    assignee: "Sarah",
    tags: ["finance", "recurring"],
    createdAt: new Date(Date.now() - 1000 * 3600 * 100).toISOString(),
    recurringRule: "FREQ=MONTHLY",
    exceptionDates: [toLocalDateString(new Date(Date.now() + 1000 * 3600 * 24 * 10))], // example skipped
    linkedNoteIds: [],
    workspaceId: "w1",
  },
];

// Demo-only beautiful sample data (see SAMPLE_TASKS comment for usage rules; never used in live auth).
const SAMPLE_NOTES: Note[] = [
  {
    id: "n1",
    title: "Investor Deck Outline — Q1 2026",
    content: "Key slides needed:\n• Traction: 4.2x YoY revenue\n• Market: $47B TAM\n• Why now: AI agents are exploding\n\nAction items extracted automatically.",
    createdAt: new Date(Date.now() - 1000 * 3600 * 30).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 3600 * 3).toISOString(),
    tags: ["investors", "strategy"],
    linkedTaskIds: ["t1"],
    workspaceId: "w1",
  },
  {
    id: "n2",
    title: "Landing Page Refresh Notes",
    content: "Hero ideas:\n\"Get shit done. Beautifully.\"\n\nThe new animation should feel like liquid. Use the neon green on the CTA only.\n\nUser quote from Alex at Vercel is gold.",
    createdAt: new Date(Date.now() - 1000 * 3600 * 18).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 3600 * 1).toISOString(),
    tags: ["marketing", "website"],
    linkedTaskIds: ["t3"],
    workspaceId: "w1",
  },
  {
    id: "n3",
    title: "Launch Week Plan",
    content: "Mon: Tease on Twitter\nTue: Deep dive thread\nWed: Product Hunt\nThu: Customer stories\nFri: AMA in Discord\n\nWe are so ready for this.",
    createdAt: new Date(Date.now() - 1000 * 3600 * 50).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 3600 * 20).toISOString(),
    tags: ["launch"],
    linkedTaskIds: ["t6"],
    workspaceId: "w1",
  },
];

const DEFAULT_WORKSPACE: Workspace = {
  id: "w1",
  name: "Badazz Ventures",
  slug: "badazz-ventures",
  role: "owner",
};

/** Best-effort member count when full roster isn't loaded (demo / non-current workspace). */
function resolveWorkspaceMemberCount(
  workspaceId: string,
  wsTasks: Task[],
  loadedMembers: WorkspaceMember[],
  currentWorkspaceId: string,
  allMembers: WorkspaceMember[],
): number {
  if (loadedMembers.length > 0) return loadedMembers.length;
  if (workspaceId === currentWorkspaceId && allMembers.length > 0) return allMembers.length;

  const assigneeIds = new Set<string>();
  const assigneeLabels = new Set<string>();
  for (const t of wsTasks) {
    if (t.assigneeIds?.length) {
      for (const id of t.assigneeIds) assigneeIds.add(id);
    } else if (t.assignee && t.assignee !== "Unassigned") {
      assigneeLabels.add(t.assignee);
    }
  }
  return Math.max(1, assigneeIds.size || assigneeLabels.size);
}

export const useTaskStore = create<TaskState>()(
  persist(
    (set, get) => ({
      tasks: SAMPLE_TASKS,
      notes: SAMPLE_NOTES,
      workspaceLists: SAMPLE_WORKSPACE_LISTS,
      listItems: SAMPLE_LIST_ITEMS,
      currentWorkspace: DEFAULT_WORKSPACE,
      workspaces: [
        DEFAULT_WORKSPACE,
        { id: "w2", name: "Personal", slug: "personal", role: "owner" },
      ],
      recentActivity: [],

      // C4 Phase A Home global (separate slices)
      globalTodayFocus: [],
      globalOpenTaskFocus: [],
      globalWorkspaceStats: {},
      globalListHighlights: [],

      // Phase 2 collab defaults
      members: [],
      invites: [],
      onlineUsers: [],
      isLoadingMembers: false,
      comments: [],
      isLoadingComments: false,

      // Agent 31 notifications defaults
      notifications: [],
      unreadNotifCount: 0,
      isLoadingNotifications: false,
      notificationPrefs: null,

      // Agent 30 live collab
      remoteCursors: [],
      activeConflicts: {},
      liveEditing: {},

      currentView: "home",
      taskFilter: { search: "" },
      selectedTaskId: null,
      isCommandPaletteOpen: false,
      isKeyboardCheatsheetOpen: false,
      isInitializing: false,
      taskLoadingStates: {},

      // Offline + sync (default optimistic; real values set in initialize / listeners)
      isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
      isSyncing: false,
      pendingSyncCount: 0,
      lastSyncAt: null,

      // Auth
      user: null,
      session: null,
      isAuthLoading: true,
      isSigningOut: false,
      isSiteAdmin: false,
      myProfile: null,

      // NOTE: Early local CRUD definitions for tasks/notes were removed here (they duplicated the final hybrid-wired versions below).
      // This eliminates TS1117 "multiple properties with same name" while preserving all behavior (last definition in object wins at runtime).
      // All task + note mutations now live only in the "Overridden actions" block with full hybrid logic.

      // Realtime notifications helper (defined early so it can be used during auth restore + new sign-in)
      _setupUserNotificationsRealtime: (userId: string) => {
        const supabase = getSupabaseClient();
        if (!supabase || !isSupabaseLive()) return;

        const existing = (get() as any)._notificationsChannel;
        if (existing) {
          supabase.removeChannel(existing).catch(() => {});
        }

        const channel = supabase
          .channel(`user-notifs-${userId}`)
          .on(
            'postgres_changes' as any,
            {
              event: '*',
              schema: 'public',
              table: 'notifications',
              filter: `user_id=eq.${userId}`,
            },
            (payload: any) => {
              try {
                const eventType = payload.eventType;
                const row = payload.new || payload.old;
                if (!row) return;

                const current = get().notifications || [];

                if (eventType === 'INSERT') {
                  const mapped = {
                    id: row.id,
                    workspaceId: row.workspace_id,
                    userId: row.user_id,
                    type: row.type,
                    title: row.title,
                    message: row.message,
                    link: row.link ?? undefined,
                    readAt: row.read_at ?? undefined,
                    createdAt: row.created_at,
                    metadata: row.metadata ?? {},
                  };
                  if (!current.some((n: any) => n.id === mapped.id)) {
                    set({ notifications: [mapped, ...current] });
                    if (mapped.type === 'invite') {
                      get().refreshUnreadCount?.().catch(() => {});
                      // Safety net for the persistent banner
                      get().fetchNotifications?.(false).catch(() => {});
                    }
                  }
                } else if (eventType === 'DELETE') {
                  // Robust payload handling (DELETE often delivers only partial old row without REPLICA IDENTITY FULL)
                  const deletedId = (payload.old && payload.old.id) || (row && row.id);
                  if (deletedId) {
                    set({ notifications: current.filter((n: any) => n.id !== deletedId) });
                  }

                  // Strong banner-specific logging even on partial payloads
                  const meta = (payload.old && payload.old.metadata) || (row && row.metadata) || {};
                  if ((row && row.type === 'invite') || meta.invite_id) {
                    console.log('[realtime] Received DELETE for invite notification (invite_id:', meta.invite_id || 'unknown', ') — clearing banner + forcing authoritative refetch');
                  }

                  // Always force authoritative refetch after any DELETE (per expert consensus on fragility)
                  get().fetchNotifications?.(false).catch(() => {});
                  get().refreshUnreadCount?.().catch(() => {});
                }
              } catch (e) {
                console.warn('[realtime] notification change failed', e);
              }
            }
          )
          .subscribe((status: string) => {
            if (status === 'SUBSCRIBED') {
              console.log('[realtime] notifications live for user', userId);
            }
          });

        (get() as any)._notificationsChannel = channel;
      },

      reorderTasks: (activeId, overId) => {
        const { tasks } = get();
        const activeIndex = tasks.findIndex((t) => t.id === activeId);
        const overIndex = tasks.findIndex((t) => t.id === overId);

        if (activeIndex === -1 || overIndex === -1) return;

        const newTasks = [...tasks];
        const [moved] = newTasks.splice(activeIndex, 1);
        newTasks.splice(overIndex, 0, moved);

        set({ tasks: newTasks });
      },

      /** Recurring + exceptions (Agent 8 foundation + Agent 13 production extensions).
       *  Delegates to updateTask (now supports exceptionDates too). Engine handles skip/break client-side.
       */
      setRecurringRule: async (id, recurringRule) => {
        return await get().updateTask(id, { recurringRule });
      },

      setView: (view) => {
        const raw = view as string;
        const resolved =
          raw === "calendar" || raw === "today" ? "home" : (view as AppView);
        if (resolved === "admin" && !get().isSiteAdmin) {
          set({ currentView: "home" });
          get().updatePresenceMeta({ view: "home" });
          return;
        }
        set({ currentView: resolved });
        // Realtime presence: update meta so collaborators see where you are (across views)
        get().updatePresenceMeta({ view: resolved });
      },
      setTaskFilter: (filter) =>
        set((state) => ({ taskFilter: { ...state.taskFilter, ...filter } })),
      selectTask: (id) => {
        set({ selectedTaskId: id });
        // Update presence for per-task editing/viewing indicators
        get().updatePresenceMeta({ editingItemId: id || undefined, editingItemType: id ? 'task' : undefined });
      },
      toggleCommandPalette: (open) =>
        set((state) => ({
          isCommandPaletteOpen: open !== undefined ? open : !state.isCommandPaletteOpen,
        })),
      toggleKeyboardCheatsheet: (open) =>
        set((state) => ({
          isKeyboardCheatsheetOpen: open !== undefined ? open : !state.isKeyboardCheatsheetOpen,
        })),

      switchWorkspace: (id) => {
        const ws = get().workspaces.find((w) => w.id === id);
        if (ws) {
          // Teardown prior realtime before switching context
          get().teardownWorkspaceRealtime();

          set({ currentWorkspace: ws, members: [], invites: [], onlineUsers: [] });
          saveLastWorkspaceId(get().user?.id, id);
          // Re-initialize data when switching workspaces (important when using Supabase)
          get().initializeFromSupabase();
          // Per Phase 1 mission: fetch real workspaces list on switch (keeps switcher fresh for multi-ws scenarios)
          // Fire-and-forget is fine; UI already switched instantly.
          get().fetchUserWorkspaces();

          // Phase 2: load collab data + wire realtime for the new workspace
          if (isSupabaseLive() && !["w1", "w2"].includes(id)) {
            get().fetchMembers();
            get().fetchInvites();
            get().fetchNotifications?.().catch(() => {});
            // Setup realtime + presence *immediately* for real-time "Online in this workspace" (no artificial delay)
            get().setupWorkspaceRealtime();
          }
        }
      },

      getFilteredTasks: () => {
        const { tasks, taskFilter } = get();
        let result = [...tasks];

        if (taskFilter.search) {
          const q = taskFilter.search.toLowerCase();
          result = result.filter(
            (t) =>
              t.title.toLowerCase().includes(q) ||
              t.description?.toLowerCase().includes(q)
          );
        }

        if (taskFilter.status?.length) {
          result = result.filter((t) => taskFilter.status!.includes(t.status));
        }

        // Agent 13 recurring-aware filter (non-breaking; "only" = has rule, "none" = no rule)
        if (taskFilter.recurring && taskFilter.recurring !== "all") {
          if (taskFilter.recurring === "only") {
            result = result.filter((t) => !!t.recurringRule);
          } else if (taskFilter.recurring === "none") {
            result = result.filter((t) => !t.recurringRule);
          }
        }

        // Sort: incomplete first, then by due date, then newest created
        return result.sort((a, b) => {
          if (a.status === "done" && b.status !== "done") return 1;
          if (b.status === "done" && a.status !== "done") return -1;

          if (a.dueDate && b.dueDate) {
            const aTime = parseLocalDate(a.dueDate)?.getTime() ?? 0;
            const bTime = parseLocalDate(b.dueDate)?.getTime() ?? 0;
            return aTime - bTime;
          }
          if (a.dueDate) return -1;
          if (b.dueDate) return 1;

          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
      },

      getTasksByStatus: (status) => {
        return get().tasks.filter((t) => t.status === status);
      },

      // ------------------------------------------------------------------
      // Supabase Integration (Phase 1)
      // ------------------------------------------------------------------

      /**
       * Loads real tasks + notes from Supabase when live (for authenticated users).
       * Pure demo mode (!Supabase keys) uses beautiful SAMPLE_TASKS / SAMPLE_NOTES.
       *
       * Cleanup (Phase 1): when Supabase live + real user, we never mix or fall back to samples.
       * Empty real data is valid (new user workspace). Samples are demo-only.
       *
       * Called on mount, after auth sign-in, and on workspace switch.
       */
      initializeFromSupabase: async () => {
        set({ isInitializing: true });

        const online = getIsOnline();
        set({ isOnline: online, pendingSyncCount: getPendingCount() });

        try {
          if (!isSupabaseLive()) {
            // Demo mode only - beautiful local samples (already in initial state or persisted)
            return;
          }

          const workspaceId = get().currentWorkspace.id;

          // Guard: Never query Supabase with invalid or demo workspace IDs.
          // An empty string (or w1/w2) will cause "invalid input syntax for type uuid" errors.
          // ensureUserHasWorkspace() + fetchUserWorkspaces() are responsible for setting a real ID first.
          if (!workspaceId || ["", "w1", "w2"].includes(workspaceId)) {
            set({ tasks: [], notes: [], workspaceLists: [], listItems: [], recentActivity: [], taskLoadingStates: {} });
            return;
          }

          // Offline resilience: if we are offline, SKIP network fetch entirely.
          // Zustand rehydration (now including data for live) + any queued local changes provide full UX.
          if (!online) {
            set({ taskLoadingStates: {} });
            return;
          }

          const remappedLists = remapLegacyListIdsInState(
            get().workspaceLists,
            get().listItems,
          );
          if (remappedLists.changed) {
            set({
              workspaceLists: remappedLists.lists,
              listItems: remappedLists.items,
            });
          }

          const keptLists = remappedLists.lists;
          const keptItems = remappedLists.items;

          await ensureWorkspaceListPersistenceReady();

          // Load in parallel for speed (include activity logs for Phase 1 basic logging UI)
          const [realTasks, realNotes, realActivity, realLists, realListItems] = await Promise.all([
            getTasks(workspaceId),
            getNotes(workspaceId),
            getRecentActivity(workspaceId),
            getWorkspaceLists(workspaceId),
            getListItems(workspaceId),
          ]);

          let nextLists = realLists;
          let nextItems = realListItems;

          if (!areWorkspaceListTablesReady()) {
            // Tables not migrated yet — keep local/persisted lists (do not wipe on 404 fetch)
            nextLists = keptLists;
            nextItems = keptItems;
          } else if (
            realLists.length === 0 &&
            keptLists.some((l) => l.workspaceId === workspaceId)
          ) {
            const backfilled = await backfillWorkspaceListsIfNeeded(
              workspaceId,
              keptLists,
              keptItems,
            );
            if (backfilled) {
              [nextLists, nextItems] = await Promise.all([
                getWorkspaceLists(workspaceId),
                getListItems(workspaceId),
              ]);
            }
          }

          // Cleanup: For authenticated users with live Supabase, ALWAYS use real data (even empty arrays).
          // This eliminates any mixing or pollution from SAMPLE_TASKS / SAMPLE_NOTES.
          // Samples are ONLY for pure demo mode (!isSupabaseLive).
          const members = get().members || [];
          const userId = get().user?.id;
          set({
            tasks: enrichTasksWithAssignees(realTasks, members, userId),
            notes: realNotes,
            workspaceLists: nextLists,
            listItems: nextItems,
            recentActivity: realActivity,
            taskLoadingStates: {},
            pendingSyncCount: getPendingCount(),
            lastSyncAt: new Date().toISOString(),
          });

          // Phase 2: after data load for a real ws, fetch collab + start realtime subs + presence
          if (isSupabaseLive() && !["w1", "w2"].includes(workspaceId)) {
            get().fetchMembers();
            get().fetchInvites();
            // Agent 31: auto-load notifications (including cross-ws 'invite' rows) so global
            // recipient banners + bell badge populate immediately for the logged-in user without requiring
            // manual bell open. Fire-and-forget safe.
            get().fetchNotifications?.().catch(() => {});
            // Setup realtime + presence *immediately* for real-time "Online in this workspace" (no artificial delay)
            get().setupWorkspaceRealtime();
          }
        } catch (error: any) {
          console.error("[useTaskStore] initializeFromSupabase error:", error);
          // Only show a gentle toast for actual network / unexpected errors.
          // Guarded paths (demo workspace IDs) will no longer trigger this.
          if (!["w1", "w2"].includes(get().currentWorkspace.id)) {
            toast.error("Sync issue", {
              description: "Couldn't reach Supabase just now. You're seeing local (offline) data. Will retry on reconnect.",
              duration: 4500,
            });
          }
          // Do not crash the app; leave (persisted) data in place as graceful degradation for offline
          set({ taskLoadingStates: {} });
        } finally {
          set({ isInitializing: false, isOnline: getIsOnline(), pendingSyncCount: getPendingCount() });
        }
      },

      // ------------------------------------------------------------------
      // Auth (Phase 1 scaffolding)
      // ------------------------------------------------------------------

      initializeAuth: async () => {
        set({ isAuthLoading: true });

        const supabase = getSupabaseClient();

        if (!supabase) {
          // No Supabase configured — treat as not logged in
          set({ user: null, session: null, isAuthLoading: false });
          return;
        }

        // Get current session (guarded for slow network / transient auth errors)
        try {
          const { data: { session } } = await supabase.auth.getSession();
          set({ session, user: session?.user ?? null });

          // STRENGTHENED LIVE GUARD: If authenticated against real Supabase, immediately purge any
          // possible SAMPLE_* / demo-ws pollution from persisted state or initial seeds.
          // This guarantees zero demo data leakage reaches UI/store for signed-in live users.
          if (session?.user && isSupabaseLive()) {
            const prevWsId = get().currentWorkspace?.id;
            if (prevWsId && !["", "w1", "w2"].includes(prevWsId)) {
              saveLastWorkspaceId(session.user.id, prevWsId);
            }
            set({
              tasks: [],
              notes: [],
              workspaceLists: [],
              listItems: [],
              recentActivity: [],
              workspaces: [],
              currentWorkspace: { id: "", name: "Loading your workspaces...", slug: "", role: "owner" } as Workspace,
              taskLoadingStates: {},
            });
          }

          // Live workspace/data bootstrap runs from app/page.tsx after dual-auth passes.
          if (!session?.user) {
            set({ isSiteAdmin: false, myProfile: null });
          } else if (isSupabaseLive()) {
            get().loadNotificationPrefs?.().catch(() => {});
          }
        } catch (e) {
          console.warn("[auth] getSession failed (network?)", e);
          // Still allow UI to render; user can retry via sign in
          set({ user: null, session: null });
        }

        // Listen for auth changes (login, logout, token refresh)
        supabase.auth.onAuthStateChange((_event, newSession) => {
          const previousUser = get().user;
          const newUser = newSession?.user ?? null;

          set({
            session: newSession,
            user: newUser,
          });

          // Fresh sign-in: wipe demo residue; live bootstrap waits for dual-auth in app/page.tsx.
          if (!previousUser && newUser) {
            if (isSupabaseLive()) {
              set({
                tasks: [],
                notes: [],
                recentActivity: [],
                workspaces: [],
                currentWorkspace: { id: "", name: "Loading your workspaces...", slug: "", role: "owner" } as Workspace,
                taskLoadingStates: {},
              });
              get().loadNotificationPrefs?.().catch(() => {});
            }
          }

          // Sign-out: demo mode restores samples; live mode clears authenticated session data.
          if (previousUser && !newUser) {
            set({
              isSiteAdmin: false,
              myProfile: null,
              currentView: get().currentView === "admin" ? "home" : get().currentView,
            });
            if (!isSupabaseLive()) {
              set({
                tasks: SAMPLE_TASKS,
                notes: SAMPLE_NOTES,
                workspaceLists: SAMPLE_WORKSPACE_LISTS,
                listItems: SAMPLE_LIST_ITEMS,
                currentWorkspace: DEFAULT_WORKSPACE,
                workspaces: [
                  DEFAULT_WORKSPACE,
                  { id: "w2", name: "Personal", slug: "personal", role: "owner" },
                ],
                taskLoadingStates: {},
              });
            } else {
              set(clearedLiveSessionState());
            }
          }

          // Teardown notifications realtime channel on signout
          if (previousUser && !newUser) {
            const supabase = getSupabaseClient();
            const ch = (get() as any)._notificationsChannel;
            if (supabase && ch) {
              supabase.removeChannel(ch).catch(() => {});
              (get() as any)._notificationsChannel = null;
            }
          }
        });

        set({ isAuthLoading: false });

        // One-time setup of network listeners + initial offline status (live mode only; demo unaffected)
        // Listeners in hybrid also auto-trigger processPendingOperations on 'online'.
        if (isSupabaseLive() && typeof window !== "undefined") {
          const updateStatus = () => {
            const onlineNow = getIsOnline();
            const pending = getPendingCount();
            set({ isOnline: onlineNow, pendingSyncCount: pending });
            if (onlineNow && pending > 0) {
              // Opportunistic background sync (non-blocking)
              get().syncPendingWrites().catch(() => {});
            }
          };

          // Attach if not already (idempotent guard via closure)
          if (!(window as any).__bat_store_offline_listeners) {
            (window as any).__bat_store_offline_listeners = true;
            window.addEventListener("online", updateStatus);
            window.addEventListener("offline", updateStatus);
            // Initial sync of status
            setTimeout(updateStatus, 0);
          }

          // Presence reliability (real-time workspace online list):
          // - Instant meta refresh on tab visible/focus (reconnect after sleep/background/switch)
          // - Explicit untrack on unload for fast "disappear" when leaving the site/ws context
          if (!(window as any).__bat_presence_reliability_listeners) {
            (window as any).__bat_presence_reliability_listeners = true;
            const refreshPresenceMeta = () => {
              try {
                const ws = get().currentWorkspace;
                if (ws?.id && isSupabaseLive() && !["w1", "w2"].includes(ws.id)) {
                  get().updatePresenceMeta();
                }
              } catch {}
            };
            const onVisibility = () => {
              if (document.visibilityState === "visible") {
                refreshPresenceMeta();
              }
            };
            const onUnload = () => {
              try {
                const pres = (get() as any)._presenceChannel;
                if (pres) {
                  pres.untrack().catch(() => {});
                }
              } catch {}
            };
            document.addEventListener("visibilitychange", onVisibility);
            window.addEventListener("focus", refreshPresenceMeta);
            window.addEventListener("beforeunload", onUnload, { once: true });
            window.addEventListener("pagehide", onUnload, { once: true });
            (window as any).__bat_presence_handlers = { onVisibility, refreshPresenceMeta, onUnload };
          }
        }
      },

      signOut: async () => {
        if (get().isSigningOut) return;

        set({ isSigningOut: true });
        get().teardownWorkspaceRealtime();

        if (isSupabaseLive()) {
          clearPendingOperations();
          set(clearedLiveSessionState());
        } else {
          set({
            tasks: SAMPLE_TASKS,
            notes: SAMPLE_NOTES,
            workspaceLists: SAMPLE_WORKSPACE_LISTS,
            listItems: SAMPLE_LIST_ITEMS,
            currentWorkspace: DEFAULT_WORKSPACE,
            workspaces: [
              DEFAULT_WORKSPACE,
              { id: "w2", name: "Personal", slug: "personal", role: "owner" },
            ],
            taskLoadingStates: {},
          });
        }

        try {
          if (isSupabaseLive()) {
            await fetch("/api/auth/dual-auth/clear", { method: "POST" }).catch(() => undefined);
          }
          const supabase = getSupabaseClient();
          if (supabase) {
            await supabase.auth.signOut();
          }
        } finally {
          set({ isSigningOut: false, user: null, session: null });
        }
      },

      fetchUserWorkspaces: async () => {
        if (!isSupabaseLive()) return;

        const supabase = getSupabaseClient();
        if (!supabase) return;

        const currentUser = get().user;
        if (!currentUser) {
          // No user: do not touch workspaces (pure demo keeps its samples via initial state)
          return;
        }

        const noWorkspacePlaceholder = (): Workspace => ({
          id: "",
          name: "No workspace",
          slug: "",
          role: "owner",
        } as Workspace);

        /** Never wipe a known-good workspace list on transient fetch failures (prevents UI flash). */
        const preserveExistingOnFetchFailure = (reason: string) => {
          const existing = get().workspaces;
          const curr = get().currentWorkspace;
          if (existing.length > 0 || (curr.id && !["", "w1", "w2"].includes(curr.id))) {
            console.warn(`[useTaskStore] fetchUserWorkspaces: ${reason} — preserving existing workspace state`);
            return true;
          }
          return false;
        };

        try {
          // Proper fetching of the logged-in user's real workspaces from Supabase (via workspace_members join)
          const { data, error } = await supabase
            .from("workspace_members")
            .select(`
              role,
              workspaces (id, name, slug, owner_id, created_at)
            `)
            .eq("user_id", currentUser.id);

          if (error) {
            console.error("[useTaskStore] fetchUserWorkspaces error:", error);
            if (!preserveExistingOnFetchFailure("query error")) {
              set({ workspaces: [], currentWorkspace: noWorkspacePlaceholder() });
            }
            return;
          }

          const realWorkspaces: Workspace[] = (data ?? [])
            .map((m: any) => {
              const ws = m.workspaces;
              if (!ws?.id) return null;
              return {
                id: ws.id,
                name: ws.name,
                slug: ws.slug,
                role: fromDbRole(m.role),
                owner_id: ws.owner_id ?? null,
                createdAt: ws.created_at ?? undefined,
              } as Workspace;
            })
            .filter((w): w is Workspace => w !== null);

          if (realWorkspaces.length > 0) {
            set({ workspaces: realWorkspaces });

            const { currentWorkspace: curr } = get();
            const target = resolveCurrentWorkspace(realWorkspaces, {
              currentId: curr.id,
              lastSavedId: getLastWorkspaceId(currentUser.id),
            });

            if (target) {
              set({ currentWorkspace: target });
              saveLastWorkspaceId(currentUser.id, target.id);
            }
          } else if (!preserveExistingOnFetchFailure("empty result")) {
            set({ workspaces: [], currentWorkspace: noWorkspacePlaceholder() });
          }
        } catch (err) {
          console.error("[useTaskStore] fetchUserWorkspaces exception:", err);
          if (!preserveExistingOnFetchFailure("exception")) {
            set({ workspaces: [], currentWorkspace: noWorkspacePlaceholder() });
          }
        }
      },

      ensureUserHasWorkspace: async () => {
        const supabase = getSupabaseClient();
        if (!supabase || !isSupabaseLive()) return;

        const currentUser = get().user;
        if (!currentUser) return;

        try {
          // Check if user already has workspace membership(s) — decide bootstrap vs fetch full list
          const { data: memberships, error: memErr } = await supabase
            .from("workspace_members")
            .select("workspace_id")
            .eq("user_id", currentUser.id)
            .limit(1);

          if (memErr) {
            console.error("[useTaskStore] ensureUserHasWorkspace membership query error:", memErr);
          }

          if (!memberships || memberships.length === 0) {
            // Bootstrap a default workspace for the new (or first-time) user via the schema RPC
            const emailLocal = (currentUser.email || "user").split("@")[0].replace(/[^a-z0-9]/gi, "");
            const workspaceName = emailLocal ? `${emailLocal}'s Workspace` : "Personal Workspace";
            const workspaceSlug = `personal-${emailLocal || currentUser.id.slice(0, 8)}`;

            const { data: newId, error: rpcErr } = await (supabase.rpc as any)("create_workspace_for_user", {
              user_id: currentUser.id,
              workspace_name: workspaceName,
              workspace_slug: workspaceSlug,
            });

            if (rpcErr || !newId) {
              console.error("[useTaskStore] ensureUserHasWorkspace create RPC error or no id:", rpcErr);
              // Still attempt fetch (may be partial state)
              await get().fetchUserWorkspaces();
              await get().initializeFromSupabase();
              return;
            }

            // Optimistic workspace so a slow/empty follow-up fetch cannot flash "No workspaces yet".
            const bootstrapWs: Workspace = {
              id: String(newId),
              name: workspaceName,
              slug: workspaceSlug,
              role: "owner",
            };
            set({ workspaces: [bootstrapWs], currentWorkspace: bootstrapWs });
            saveLastWorkspaceId(currentUser.id, bootstrapWs.id);
          }

          // For both new users (post-create) and returning users: fetch the *full authoritative list* of real workspaces.
          // This replaces the previous buggy "only first ws" logic and enables proper multi-workspace switcher.
          await get().fetchUserWorkspaces();

          // Ensure we have data for whatever currentWorkspace fetch decided on (or the one it set)
          await get().initializeFromSupabase();
        } catch (err) {
          console.error("[useTaskStore] ensureUserHasWorkspace error:", err);
        }
      },

      // ------------------------------------------------------------------
      // createWorkspace — Phase 1: support creating additional workspaces (real Supabase + demo safe)
      // Uses the existing SECURITY DEFINER RPC so RLS is respected. Then refreshes full list via fetch.
      // ------------------------------------------------------------------
      createWorkspace: async (name: string): Promise<Workspace | null> => {
        const trimmed = (name || "").trim();
        if (!trimmed) {
          toast.error("Workspace name required");
          return null;
        }

        // Demo mode: local-only fake workspace (keeps switcher and demo delight working exactly as before)
        if (!isSupabaseLive()) {
          const id = `demo-${generateId().slice(0, 8)}`;
          const slug = trimmed.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-" + id.slice(5, 9);
          const demoWs: Workspace = {
            id,
            name: trimmed,
            slug,
            role: "owner",
          };
          set((state) => ({
            workspaces: [...state.workspaces, demoWs],
            currentWorkspace: demoWs,
          }));
          // Re-init data (noop in !live but keeps symmetry with switch)
          await get().initializeFromSupabase();
          toast.success(`Workspace "${trimmed}" created (demo)`);
          return demoWs;
        }

        const supabase = getSupabaseClient();
        const currentUser = get().user;
        if (!supabase || !currentUser) {
          toast.error("Cannot create workspace", { description: "Sign in with real Supabase to create workspaces." });
          return null;
        }

        try {
          // Unique slug: base from name + short timestamp entropy
          const base = trimmed.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "workspace";
          const workspaceSlug = `${base}-${Date.now().toString(36).slice(-6)}`;
          const workspaceName = trimmed;

          const { data: newId, error: rpcErr } = await (supabase.rpc as any)("create_workspace_for_user", {
            user_id: currentUser.id,
            workspace_name: workspaceName,
            workspace_slug: workspaceSlug,
          });

          if (rpcErr || !newId) {
            console.error("[useTaskStore] createWorkspace RPC error:", rpcErr);
            toast.error("Failed to create workspace", {
              description: rpcErr?.message || "The name may conflict or there was a server issue.",
            });
            return null;
          }

          const newRealWorkspace: Workspace = {
            id: String(newId),
            name: workspaceName,
            slug: workspaceSlug,
            role: "owner",
          };

          // Optimistic insert before refresh so a failed/empty fetch cannot wipe the new workspace.
          set((state) => ({
            workspaces: [
              ...state.workspaces.filter((w) => w.id !== newRealWorkspace.id),
              newRealWorkspace,
            ],
            currentWorkspace: newRealWorkspace,
          }));
          saveLastWorkspaceId(currentUser.id, newRealWorkspace.id);

          // Refresh authoritative list from DB (ensures multi-ws correctness and any role updates)
          await get().fetchUserWorkspaces();

          // Switch to the newly created one + load its (empty) data
          const freshList = get().workspaces;
          const target = freshList.find((w) => w.id === newRealWorkspace.id) || newRealWorkspace;
          set({ currentWorkspace: target });
          saveLastWorkspaceId(currentUser.id, target.id);
          await get().initializeFromSupabase();

          toast.success(`Workspace "${workspaceName}" created`, {
            description: "Switched to your new workspace.",
          });
          return target;
        } catch (err: any) {
          console.error("[useTaskStore] createWorkspace error:", err);
          toast.error("Failed to create workspace", { description: err?.message || "Unexpected error." });
          return null;
        }
      },

      // ------------------------------------------------------------------
      // refreshRecentActivity — supports production activity log panel (real DB when live)
      // Safe guard + only runs real query when appropriate. Called from UI (e.g. manual refresh in panel).
      // ------------------------------------------------------------------
      refreshRecentActivity: async () => {
        if (!isSupabaseLive()) return;

        const workspaceId = get().currentWorkspace.id;
        if (!workspaceId || ["w1", "w2"].includes(workspaceId)) return;

        try {
          const activity = await getRecentActivity(workspaceId);
          set({ recentActivity: activity });
        } catch (err) {
          console.error("[useTaskStore] refreshRecentActivity error:", err);
        }
      },

      // ------------------------------------------------------------------
      // C4-Exec-3 Phase A: fetchGlobalHomeAggregates (separate slices only)
      // - Demo: lightweight synth for nice cross-ws feel using workspaces + samples
      // - Live: member-scoped via new hybrid helper + existing guarded per-ws fns (bounded)
      // - Always: strict isSupabaseLive guards + demo ws purge. Separate from current* slices.
      // - Called on Home mount / manual refresh (light poll ok per charter)
      // ------------------------------------------------------------------
      fetchMyProfile: async () => {
        if (!isSupabaseLive() || !get().user) {
          set({ myProfile: null });
          return;
        }
        try {
          const profile = await getMyProfile();
          if (profile && (profile.fullName || profile.username || profile.location)) {
            set({ myProfile: profile });
          }
        } catch {
          // Keep any persisted myProfile on transient errors
        }
      },

      fetchSiteAdminStatus: async () => {
        if (!isSupabaseLive() || !get().user) {
          set({ isSiteAdmin: false });
          return;
        }
        try {
          const res = await fetch("/api/admin/me");
          const data = (await res.json()) as { isSiteAdmin?: boolean };
          const isAdmin = !!data.isSiteAdmin;
          set({ isSiteAdmin: isAdmin });
          if (!isAdmin && get().currentView === "admin") {
            set({ currentView: "home" });
          }
        } catch {
          set({ isSiteAdmin: false });
        }
      },

      refreshHomeTaskFocusFromStore: () => {
        const wss = get().workspaces || [];
        const today = startOfLocalToday();
        const storeTasks = get().tasks || [];
        const focus = get().globalTodayFocus || [];
        const openFocus = get().globalOpenTaskFocus || [];
        const userId = get().user?.id;
        const members = get().members || [];
        const prevStats = get().globalWorkspaceStats || {};

        const tasksForWorkspace = (workspaceId: string): Task[] => {
          const merged = new Map<string, Task>();
          for (const item of focus.filter((f) => f.workspaceId === workspaceId)) {
            merged.set(item.task.id, item.task);
          }
          for (const item of openFocus.filter((f) => f.workspaceId === workspaceId)) {
            merged.set(item.task.id, item.task);
          }
          for (const t of storeTasks.filter((task) => task.workspaceId === workspaceId)) {
            merged.set(t.id, t);
          }
          return [...merged.values()];
        };

        const patchedStats: Record<string, WorkspaceTaskStats> = { ...prevStats };
        for (const ws of wss) {
          const wsTasks = storeTasks.filter((t) => t.workspaceId === ws.id);
          if (wsTasks.length === 0) continue;
          const computed = computeWorkspaceTaskStats(wsTasks, members, userId, today);
          patchedStats[ws.id] = {
            ...computed,
            listCount: prevStats[ws.id]?.listCount,
            openListItemsCount: prevStats[ws.id]?.openListItemsCount,
            memberCount: prevStats[ws.id]?.memberCount,
          };
        }

        set({
          globalTodayFocus: buildGlobalUpcomingFocus(wss, tasksForWorkspace, 12, today),
          globalOpenTaskFocus: buildGlobalOpenTaskFocus(wss, tasksForWorkspace, 16, today),
          globalWorkspaceStats: patchedStats,
        });
      },

      refreshHomeListAggregatesFromStore: () => {
        const wss = get().workspaces || [];
        const lists = get().workspaceLists || [];
        const items = get().listItems || [];
        const allHighlights: HomeListHighlight[] = [];
        const patchedStats: Record<string, WorkspaceTaskStats> = {
          ...get().globalWorkspaceStats,
        };

        for (const ws of wss) {
          const listStats = computeWorkspaceListStats(lists, items, ws.id);
          allHighlights.push(
            ...buildListHighlightsForWorkspace(lists, items, ws.id, ws.name),
          );
          patchedStats[ws.id] = {
            openCount: patchedStats[ws.id]?.openCount ?? 0,
            totalTaskCount: patchedStats[ws.id]?.totalTaskCount ?? 0,
            doneCount: patchedStats[ws.id]?.doneCount ?? 0,
            overdueCount: patchedStats[ws.id]?.overdueCount ?? 0,
            dueTodayCount: patchedStats[ws.id]?.dueTodayCount ?? 0,
            assigneeBreakdown: patchedStats[ws.id]?.assigneeBreakdown ?? [],
            memberCount: patchedStats[ws.id]?.memberCount,
            ...listStats,
          };
        }

        set({
          globalListHighlights: pickGlobalListHighlights(allHighlights),
          globalWorkspaceStats: patchedStats,
        });
      },

      fetchGlobalHomeAggregates: async () => {
        const isLive = isSupabaseLive();
        const wss = get().workspaces || [];
        const userId = get().user?.id;
        const today = startOfLocalToday();

        if (!isLive) {
          const demoStats: Record<string, WorkspaceTaskStats> = {};
          const allHighlights: HomeListHighlight[] = [];
          const lists = get().workspaceLists || [];
          const items = get().listItems || [];
          const currentWsId = get().currentWorkspace.id;
          const storeMembers = get().members || [];
          for (const ws of wss) {
            const wsTasks = (get().tasks || []).filter((t) => t.workspaceId === ws.id);
            const listStats = computeWorkspaceListStats(lists, items, ws.id);
            demoStats[ws.id] = {
              ...computeWorkspaceTaskStats(wsTasks, storeMembers, userId, today),
              ...listStats,
              memberCount: resolveWorkspaceMemberCount(
                ws.id,
                wsTasks,
                [],
                currentWsId,
                storeMembers,
              ),
            };
            allHighlights.push(
              ...buildListHighlightsForWorkspace(lists, items, ws.id, ws.name),
            );
          }
          const tasksForWs = (wsId: string) =>
            (get().tasks || []).filter((t) => t.workspaceId === wsId);
          const demoFocus = buildGlobalUpcomingFocus(wss, tasksForWs, 12, today);
          const demoOpenFocus = buildGlobalOpenTaskFocus(wss, tasksForWs, 16, today);

          set({
            globalTodayFocus: demoFocus,
            globalOpenTaskFocus: demoOpenFocus,
            globalWorkspaceStats: demoStats,
            globalListHighlights: pickGlobalListHighlights(allHighlights),
          });
          return;
        }

        // LIVE path — strict guards (no demo ws ever)
        try {
          const focusItems: HomeFocusItem[] = [];
          const openFocusItems: HomeFocusItem[] = [];
          const statsByWs: Record<string, WorkspaceTaskStats> = {};
          const allHighlights: HomeListHighlight[] = [];
          const aggregatedLists: WorkspaceList[] = [];
          const aggregatedItems: ListItem[] = [];
          for (const ws of wss.slice(0, 6)) {
            if (!ws.id || ["w1", "w2"].includes(ws.id)) continue;
            try {
              const [wsTasks, wsMembers, wsLists, wsListItems] = await Promise.all([
                getTasks(ws.id),
                getWorkspaceMembers(ws.id).catch(() => [] as WorkspaceMember[]),
                getWorkspaceLists(ws.id).catch(() => [] as WorkspaceList[]),
                getListItems(ws.id).catch(() => [] as ListItem[]),
              ]);
              const enrichedTasks = enrichTasksWithAssignees(wsTasks, wsMembers, userId);
              const listStats = computeWorkspaceListStats(wsLists, wsListItems, ws.id);

              let unreadChat = false;
              if (wsMembers.length > 1 && userId) {
                try {
                  const [chatMessages, chatReactions] = await Promise.all([
                    fetchWorkspaceMessages(ws.id, 50),
                    fetchWorkspaceMessageReactions(ws.id),
                  ]);
                  unreadChat = hasUnreadChatActivity(
                    userId,
                    ws.id,
                    chatMessages,
                    chatReactions,
                  );
                } catch {
                  /* non-fatal */
                }
              }

              statsByWs[ws.id] = {
                ...computeWorkspaceTaskStats(enrichedTasks, wsMembers, userId, today),
                memberCount: wsMembers.length,
                unreadChat,
                ...listStats,
              };
              allHighlights.push(
                ...buildListHighlightsForWorkspace(wsLists, wsListItems, ws.id, ws.name),
              );
              aggregatedLists.push(...wsLists);
              aggregatedItems.push(...wsListItems);
              focusItems.push(
                ...pickUpcomingTasksFromWorkspace(enrichedTasks, ws.id, ws.name, today),
              );
              openFocusItems.push(
                ...pickDueAttentionTasksFromWorkspace(enrichedTasks, ws.id, ws.name, today),
              );
            } catch { /* per-ws fail non-fatal */ }
          }

          const state = get();
          set({
            globalTodayFocus: sortUpcomingFocusItems(focusItems).slice(0, 12),
            globalOpenTaskFocus: sortOpenTaskFocusItems(openFocusItems, today).slice(0, 16),
            globalWorkspaceStats: statsByWs,
            globalListHighlights: pickGlobalListHighlights(allHighlights),
            workspaceLists: mergeWorkspaceLists(state.workspaceLists, aggregatedLists),
            listItems: mergeListItems(state.listItems, aggregatedItems),
          });
        } catch (err) {
          console.error("[useTaskStore] fetchGlobalHomeAggregates live error:", err);
        }
      },

      hydrateWorkspaceListData: async (workspaceId: string) => {
        if (!workspaceId) return;
        if (!isSupabaseLive() || ["w1", "w2"].includes(workspaceId)) return;

        try {
          const [lists, items] = await Promise.all([
            getWorkspaceLists(workspaceId).catch(() => [] as WorkspaceList[]),
            getListItems(workspaceId).catch(() => [] as ListItem[]),
          ]);
          set((state) => ({
            workspaceLists: mergeWorkspaceLists(state.workspaceLists, lists),
            listItems: mergeListItems(state.listItems, items),
          }));
        } catch (err) {
          console.error("[useTaskStore] hydrateWorkspaceListData error:", err);
        }
      },

      // ------------------------------------------------------------------
      // Overridden actions that go through Supabase when live
      // ------------------------------------------------------------------

      addTask: async (input: string) => {
        const title = input.trim();
        if (!title) return null;
        let workspaceId = get().currentWorkspace.id;

        // Safety guard for live mode: never create against demo workspace IDs.
        // If we somehow have a demo ID while live, try to correct to a real one.
        if (isSupabaseLive() && ["w1", "w2"].includes(workspaceId)) {
          await get().fetchUserWorkspaces();
          const realWs = get().workspaces.find((w) => w.id && !["w1", "w2"].includes(w.id));
          if (realWs) {
            set({ currentWorkspace: realWs });
            workspaceId = realWs.id;
          } else {
            toast.error("No real workspace available in LIVE mode. Please create one first.");
            return null;
          }
        }

        // Use proper UUID for live mode (enables clean offline create queuing + Supabase PK compatibility).
        // Demo continues using short generateId for sample compatibility.
        const tempId = isSupabaseLive() ? generateClientId() : generateId();
        const parsed = parseNaturalLanguage(title);

        const optimisticTask: Task = {
          id: tempId,
          title: parsed.title || title,
          description: parsed.description || "",
          status: (parsed.status as TaskStatus) || "todo",
          priority: parsed.priority || "P2",
          dueDate: parsed.dueDate,
          assigneeIds: [],
          tags: parsed.tags || [],
          createdAt: new Date().toISOString(),
          linkedNoteIds: [],
          workspaceId,
          recurringRule: parsed.recurringRule,
          exceptionDates: parsed.exceptionDates,
        };

        // OPTIMISTIC: Always update UI immediately for instant feel (demo + live)
        set((state) => ({
          tasks: [optimisticTask, ...state.tasks],
          taskLoadingStates: { ...state.taskLoadingStates, [tempId]: true },
        }));

        if (isSupabaseLive()) {
          try {
            const created = await createTaskSupabase({
              workspaceId,
              id: tempId, // Pass so hybrid can use consistent client id for offline queue path
              title: optimisticTask.title,
              description: optimisticTask.description,
              status: optimisticTask.status,
              priority: optimisticTask.priority,
              dueDate: optimisticTask.dueDate,
              tags: optimisticTask.tags,
              // recurring + exceptions forwarding (Agent 13, built on Agent 8)
              ...(optimisticTask.recurringRule ? { recurringRule: optimisticTask.recurringRule } : {}),
              ...(optimisticTask.exceptionDates && optimisticTask.exceptionDates.length ? { exceptionDates: optimisticTask.exceptionDates } : {}),
            } as any);

            if (created) {
              // Replace temp with real server entity (id will match when we supplied it)
              set((state) => {
                const nextLoading = { ...state.taskLoadingStates };
                delete nextLoading[tempId];
                return {
                  tasks: state.tasks.map((t) => (t.id === tempId ? created : t)),
                  taskLoadingStates: nextLoading,
                  selectedTaskId: state.selectedTaskId === tempId ? created.id : state.selectedTaskId,
                  pendingSyncCount: getPendingCount(),
                  lastSyncAt: new Date().toISOString(),
                };
              });

              // Log key event only on successful remote persist
              logActivity({
                workspaceId,
                userId: get().user?.id,
                actionType: "task.created",
                targetType: "task",
                targetId: created.id,
                metadata: { title: created.title, priority: created.priority },
              });

              return created;
            } else {
              throw new Error("Supabase create returned null");
            }
          } catch (err) {
            // Hybrid layer now queues automatically on offline/failure. Keep optimistic change (persists via new strategy).
            set((state) => {
              const nextLoading = { ...state.taskLoadingStates };
              delete nextLoading[tempId];
              return {
                taskLoadingStates: nextLoading,
                pendingSyncCount: getPendingCount(),
                isOnline: getIsOnline(),
              };
            });
            toast.warning("Saved locally (queued for sync)", {
              description: "Offline or Supabase unreachable. Will sync automatically when back online.",
              duration: 4500,
            });
            return optimisticTask;
          }
        } else {
          // Demo mode - already optimistic, no remote, clear loading
          set((state) => {
            const nextLoading = { ...state.taskLoadingStates };
            delete nextLoading[tempId];
            return { taskLoadingStates: nextLoading };
          });
          return optimisticTask;
        }
      },

      updateTask: async (id, updates) => {
        const prevTask = resolveTaskInStore(get(), id);
        if (!prevTask) return null;

        const normalizedUpdates = { ...updates };
        if (normalizedUpdates.assigneeIds !== undefined) {
          normalizedUpdates.assignee = resolveAssigneeLabel(
            normalizedUpdates.assigneeIds,
            get().members || [],
            get().user?.id
          );
        }

        // OPTIMISTIC first for snappy UX + loading indicator (workspace tasks + Home focus slice)
        set((state) => ({
          ...patchTaskInSlices(state, id, (t) => {
            const merged = { ...t, ...normalizedUpdates };
            if (
              Object.prototype.hasOwnProperty.call(updates, "recurringRule") &&
              (updates.recurringRule === null || updates.recurringRule === undefined)
            ) {
              delete merged.recurringRule;
              if (
                Object.prototype.hasOwnProperty.call(updates, "exceptionDates") &&
                updates.exceptionDates === undefined
              ) {
                delete merged.exceptionDates;
              }
            }
            return merged;
          }),
          taskLoadingStates: { ...state.taskLoadingStates, [id]: true },
        }));

        if (isSupabaseLive()) {
          try {
            const ok = await updateTaskSupabase(id, { ...normalizedUpdates, workspaceId: prevTask.workspaceId });
            if (!ok) throw new Error("Supabase update failed");

            // Success: keep optimistic, clear loading + refresh pending (in case it queued inside hybrid)
            set((state) => {
              const next = { ...state.taskLoadingStates };
              delete next[id];
              return {
                taskLoadingStates: next,
                pendingSyncCount: getPendingCount(),
                isOnline: getIsOnline(),
                lastSyncAt: new Date().toISOString(),
              };
            });
            return true;
          } catch (err) {
            // Hybrid queued the change on failure. KEEP optimistic (don't revert) so user sees their edit.
            // This + new persist strategy = true offline edit survival.
            set((state) => {
              const next = { ...state.taskLoadingStates };
              delete next[id];
              return {
                taskLoadingStates: next,
                pendingSyncCount: getPendingCount(),
                isOnline: getIsOnline(),
              };
            });
            toast.info("Update kept locally", {
              description: "Queued for sync when connection returns.",
              duration: 3000,
            });
            return null;
          }
        } else {
          // Demo: clear loading (change already applied)
          set((state) => {
            const next = { ...state.taskLoadingStates };
            delete next[id];
            return { taskLoadingStates: next };
          });
          return true;
        }
      },

      deleteTask: async (id) => {
        const taskBeingDeleted = resolveTaskInStore(get(), id);
        if (!taskBeingDeleted) return null;

        // OPTIMISTIC remove immediately (workspace list + Home focus slice)
        set((state) => ({
          ...removeTaskFromSlices(state, id),
          selectedTaskId: state.selectedTaskId === id ? null : state.selectedTaskId,
          taskLoadingStates: { ...state.taskLoadingStates, [id]: true },
        }));

        if (isSupabaseLive()) {
          try {
            const ok = await deleteTaskSupabase(id, taskBeingDeleted.workspaceId);
            if (!ok) throw new Error("Supabase delete failed");

            // Success path: also update sync indicators (was missing before; now uniform)
            set((state) => {
              const next = { ...state.taskLoadingStates };
              delete next[id];
              return {
                taskLoadingStates: next,
                pendingSyncCount: getPendingCount(),
                isOnline: getIsOnline(),
                lastSyncAt: new Date().toISOString(),
              };
            });
            return true;
          } catch (err) {
            // Hybrid queued the delete. Keep the optimistic removal (don't restore).
            set((state) => {
              const next = { ...state.taskLoadingStates };
              delete next[id];
              return {
                taskLoadingStates: next,
                pendingSyncCount: getPendingCount(),
                isOnline: getIsOnline(),
              };
            });
            toast.warning("Delete queued", {
              description: "Task removed locally. Will sync delete when online.",
              duration: 3500,
            });
            return null;
          }
        } else {
          set((state) => {
            const next = { ...state.taskLoadingStates };
            delete next[id];
            return { taskLoadingStates: next };
          });
          return true;
        }
      },

      completeTask: async (id) => {
        const prevTask = resolveTaskInStore(get(), id);
        if (!prevTask || prevTask.status === "done" || get().taskLoadingStates[id]) return null;

        // Recurring: advance due date instead of marking done (unless series has ended)
        if (prevTask.recurringRule) {
          const advanceFrom = prevTask.dueDate ?? toDueDateStorage(startOfLocalToday());
          const next = getNextRecurringDue(
            prevTask.recurringRule,
            advanceFrom,
            prevTask.dueDate,
            prevTask.exceptionDates
          );
          if (next) {
            const ok = await get().updateTask(id, {
              dueDate: toDueDateStorage(next),
              status: "todo",
              completedAt: undefined,
            });
            return ok ? "advanced" : null;
          }
          // Series exhausted — fall through to terminal complete + clear recurrence
          const now = new Date().toISOString();
          const ok = await get().updateTask(id, {
            status: "done",
            completedAt: now,
            recurringRule: null,
            exceptionDates: undefined,
          });
          if (ok) {
            logActivity({
              workspaceId: prevTask.workspaceId,
              userId: get().user?.id,
              actionType: "task.completed",
              targetType: "task",
              targetId: id,
              metadata: { completedAt: now, seriesEnded: true },
            });
          }
          return ok ? "completed" : null;
        }

        const now = new Date().toISOString();
        const optimisticUpdate = {
          status: "done" as TaskStatus,
          completedAt: now,
        };

        // OPTIMISTIC + loading (workspace tasks + Home focus slice)
        set((state) => ({
          ...patchTaskInSlices(state, id, optimisticUpdate),
          taskLoadingStates: { ...state.taskLoadingStates, [id]: true },
        }));

        if (isSupabaseLive()) {
          try {
            const ok = await updateTaskSupabase(id, { status: "done", completedAt: now, workspaceId: prevTask.workspaceId });
            if (!ok) throw new Error("Supabase complete failed");

            // Success: keep optimistic change (consistent with updateTask), update sync state
            set((state) => {
              const next = { ...state.taskLoadingStates };
              delete next[id];
              return {
                taskLoadingStates: next,
                pendingSyncCount: getPendingCount(),
                isOnline: getIsOnline(),
                lastSyncAt: new Date().toISOString(),
              };
            });

            // Log on successful remote complete
            logActivity({
              workspaceId: prevTask.workspaceId,
              userId: get().user?.id,
              actionType: "task.completed",
              targetType: "task",
              targetId: id,
              metadata: { completedAt: now },
            });
            return "completed";
          } catch (err) {
            // On transient failure (hybrid queues): KEEP optimistic (no revert) for instant feel + offline resilience.
            // Matches policy in updateTask / addTask / deleteTask / kanban paths. Error recovery via queue + LWW on reconnect.
            set((state) => {
              const next = { ...state.taskLoadingStates };
              delete next[id];
              return {
                taskLoadingStates: next,
                pendingSyncCount: getPendingCount(),
                isOnline: getIsOnline(),
              };
            });
            toast.info("Complete kept locally", {
              description: "Queued for sync when connection returns.",
              duration: 3000,
            });
            return null;
          }
        } else {
          // Demo
          set((state) => {
            const next = { ...state.taskLoadingStates };
            delete next[id];
            return { taskLoadingStates: next };
          });
          return "completed";
        }
      },

      moveTask: async (id, newStatus) => {
        const prevTask = get().tasks.find((t) => t.id === id);
        if (!prevTask) return null;

        if (newStatus === "done") {
          const result = await get().completeTask(id);
          return result !== null;
        }

        // OPTIMISTIC status change
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === id ? { ...t, status: newStatus } : t
          ),
          taskLoadingStates: { ...state.taskLoadingStates, [id]: true },
        }));

        if (isSupabaseLive()) {
          try {
            const ok = await moveTaskSupabase(id, newStatus, prevTask.workspaceId);
            if (!ok) throw new Error("Supabase move failed");

            // Success: keep + sync state (consistent policy)
            set((state) => {
              const next = { ...state.taskLoadingStates };
              delete next[id];
              return {
                taskLoadingStates: next,
                pendingSyncCount: getPendingCount(),
                isOnline: getIsOnline(),
                lastSyncAt: new Date().toISOString(),
              };
            });
            return true;
          } catch (err) {
            // On transient: KEEP optimistic (status already changed in UI via kanban or direct). Queue handles. No revert.
            set((state) => {
              const next = { ...state.taskLoadingStates };
              delete next[id];
              return {
                taskLoadingStates: next,
                pendingSyncCount: getPendingCount(),
                isOnline: getIsOnline(),
              };
            });
            toast.info("Move kept locally", {
              description: "Status change queued for sync.",
              duration: 3000,
            });
            return null;
          }
        } else {
          set((state) => {
            const next = { ...state.taskLoadingStates };
            delete next[id];
            return { taskLoadingStates: next };
          });
          return true;
        }
      },

      // ------------------------------------------------------------------
      // Notes overrides (hybrid wiring - Phase 1/3 data layer hardening)
      // Mirroring the task pattern for full consistency: live Supabase + demo fallback + optimistic UI update.
      // Now supports rich TipTap JSONB round-tripping via enhanced hybrid helpers (stringified docs
      // saved to DB JSONB; plain text extracted for list/preview compat; Note.content model unchanged).
      // ------------------------------------------------------------------

      addNote: async (title: string, content = "") => {
        let workspaceId = get().currentWorkspace.id;

        // Safety guard for live mode (same as addTask)
        if (isSupabaseLive() && ["w1", "w2"].includes(workspaceId)) {
          await get().fetchUserWorkspaces();
          const realWs = get().workspaces.find((w) => w.id && !["w1", "w2"].includes(w.id));
          if (realWs) {
            set({ currentWorkspace: realWs });
            workspaceId = realWs.id;
          } else {
            toast.error("No real workspace available in LIVE mode. Please create one first.");
            return null;
          }
        }

        const noteId = isSupabaseLive() ? generateClientId() : generateId();

        const newNote: Note = {
          id: noteId,
          title,
          content,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          tags: [],
          linkedTaskIds: [],
          workspaceId,
        };

        if (isSupabaseLive()) {
          // Real mode - persist to Supabase (pass id for offline queue compatibility)
          const created = await createNoteSupabase({
            workspaceId,
            id: noteId,
            title: newNote.title,
            content: newNote.content,
            tags: newNote.tags,
          });

          if (created) {
            set((state) => {
              // Race-safe vs realtime INSERT handler: if the broadcast already added it, no-op.
              if (state.notes.some((n) => n.id === created.id)) return {};
              return { notes: [created, ...state.notes] };
            });
            // Log key event
            logActivity({
              workspaceId,
              userId: get().user?.id,
              actionType: "note.created",
              targetType: "note",
              targetId: created.id,
              metadata: { title: created.title },
            });
            return created;
          } else {
            // Fallback to local on failure (keeps UX working)
            set((state) => {
              if (state.notes.some((n) => n.id === newNote.id)) return {};
              return { notes: [newNote, ...state.notes] };
            });
            return newNote;
          }
        } else {
          // Demo mode - local only
          set((state) => {
            if (state.notes.some((n) => n.id === newNote.id)) return {};
            return { notes: [newNote, ...state.notes] };
          });
          return newNote;
        }
      },

      updateNote: async (id, updates) => {
        if (typeof id !== 'string' || !id || id.length < 5) {
          console.error('[BadAssTasks] store.updateNote called with invalid id (object leak?)', id);
          return false;
        }
        if (isSupabaseLive()) {
          await updateNoteSupabase(id, updates);
        }

        set((state) => ({
          notes: state.notes.map((n) =>
            n.id === id ? { ...n, ...updates, updatedAt: new Date().toISOString() } : n
          ),
        }));
        return true;
      },

      deleteNote: async (id) => {
        if (isSupabaseLive()) {
          await deleteNoteSupabase(id);
        }

        set((state) => ({
          notes: state.notes.filter((n) => n.id !== id),
        }));
        return true;
      },

      // ------------------------------------------------------------------
      // Lists (workspace-scoped checklists — local-first, persisted in zustand)
      // ------------------------------------------------------------------
      ...createListSliceActions(get, set),

      // ------------------------------------------------------------------
      // Real offline/sync actions (Phase 1 mission complete)
      // ------------------------------------------------------------------
      syncPendingWrites: async () => {
        if (!isSupabaseLive()) return;

        const currentPending = getPendingCount();
        if (currentPending === 0) {
          set({ pendingSyncCount: 0, isSyncing: false });
          return;
        }

        set({ isSyncing: true });

        try {
          const result = await processPendingOperations();

          const newCount = getPendingCount();
          const now = new Date().toISOString();

          set({
            isSyncing: false,
            pendingSyncCount: newCount,
            isOnline: getIsOnline(),
            lastSyncAt: now,
          });

          if (!result) return;

          if (result.synced > 0 || result.skippedConflicts > 0) {
            // After sync, best-effort refresh authoritative data (only if still online)
            if (getIsOnline()) {
              await get().initializeFromSupabase();
            }
            toast.success("Sync complete", {
              description: `${result.synced} change(s) synced${result.skippedConflicts ? `, ${result.skippedConflicts} resolved by last-write-wins` : ""}.`,
              duration: 3200,
            });
          }
          if (result.failed > 0) {
            toast.warning(`${result.failed} change(s) still pending`, {
              description: "Will retry automatically on next reconnect.",
            });
          }
        } catch (e) {
          set({ isSyncing: false, pendingSyncCount: getPendingCount(), isOnline: getIsOnline() });
          console.error("[store] syncPendingWrites error:", e);
        }
      },

      refreshOfflineStatus: () => {
        set({
          isOnline: getIsOnline(),
          pendingSyncCount: getPendingCount(),
        });
      },

      // ------------------------------------------------------------------
      // Phase 2 Collaboration implementations (demo/live separated, role-aware in UI layer)
      // ------------------------------------------------------------------

      fetchMembers: async () => {
        const wsId = get().currentWorkspace.id;
        if (!wsId || ["w1", "w2"].includes(wsId)) {
          set({ members: [], isLoadingMembers: false });
          return;
        }
        set({ isLoadingMembers: true });
        try {
          const members = await getWorkspaceMembers(wsId);
          const userId = get().user?.id;
          const selfMember = userId ? members.find((m) => m.userId === userId) : undefined;
          const profilePatch =
            selfMember?.fullName || selfMember?.username || selfMember?.location
              ? {
                  myProfile: {
                    ...get().myProfile,
                    fullName: selfMember.fullName ?? get().myProfile?.fullName,
                    username: selfMember.username ?? get().myProfile?.username,
                    location: selfMember.location ?? get().myProfile?.location,
                  },
                }
              : {};
          set((state) => ({
            members,
            isLoadingMembers: false,
            tasks: enrichTasksWithAssignees(state.tasks, members, userId),
            globalWorkspaceStats: {
              ...state.globalWorkspaceStats,
              [wsId]: {
                openCount: state.globalWorkspaceStats[wsId]?.openCount ?? 0,
                totalTaskCount: state.globalWorkspaceStats[wsId]?.totalTaskCount ?? 0,
                doneCount: state.globalWorkspaceStats[wsId]?.doneCount ?? 0,
                overdueCount: state.globalWorkspaceStats[wsId]?.overdueCount ?? 0,
                dueTodayCount: state.globalWorkspaceStats[wsId]?.dueTodayCount ?? 0,
                assigneeBreakdown: state.globalWorkspaceStats[wsId]?.assigneeBreakdown ?? [],
                listCount: state.globalWorkspaceStats[wsId]?.listCount,
                openListItemsCount: state.globalWorkspaceStats[wsId]?.openListItemsCount,
                memberCount: members.length,
              },
            },
            ...profilePatch,
          }));
        } catch (e) {
          console.error("[store] fetchMembers error", e);
          set({ isLoadingMembers: false });
        }
      },

      fetchInvites: async () => {
        const wsId = get().currentWorkspace.id;
        if (!isSupabaseLive() || !wsId || ["w1", "w2"].includes(wsId)) {
          set({ invites: [] });
          return;
        }
        try {
          const invs = await getWorkspaceInvites(wsId);
          set({ invites: invs });
        } catch (e) {
          console.error("[store] fetchInvites error", e);
        }
      },

      sendInvite: async (email, role = "member", invitedUserId) => {
        const wsId = get().currentWorkspace.id;
        const currentRole = get().currentWorkspace.role;
        const currentUserId = get().user?.id;

        const supabaseClient = getSupabaseClient();
        if (!isSupabaseLive() || !wsId || ["w1", "w2"].includes(wsId) || !supabaseClient) {
          toast.info("Invites are a live Supabase feature (demo is single-user)");
          return null;
        }
        if (!["owner", "admin"].includes(currentRole)) {
          toast.error("Only owners and admins can invite members");
          return null;
        }

        const inviteId = await createInvite(wsId, email, role);

        if (inviteId) {
          let inviterDisplayName = get().user?.email || "Someone";
          if (currentUserId && supabaseClient) {
            try {
              const { data: prof } = await supabaseClient
                .from("profiles")
                .select("username, full_name")
                .eq("id", currentUserId)
                .single();
              if (prof) {
                const username = (prof as { username?: string }).username || "";
                const fullName = (prof as { full_name?: string }).full_name || "";
                if (username) inviterDisplayName = `@${username}`;
                else if (fullName) inviterDisplayName = fullName;
              }
            } catch {
              // fall back to email
            }
          }

          // Enrich the invite row with invited_user_id + invited_by (when coming from search)
          if (invitedUserId && currentUserId) {
            try {
              const { error: enrichErr } = await (supabaseClient.from('workspace_invites') as any)
                .update({ 
                  invited_user_id: invitedUserId, 
                  invited_by: currentUserId 
                })
                .eq('id', inviteId);
              if (enrichErr) {
                console.warn("[store] Failed to enrich workspace_invites with invited_user_id/invited_by", enrichErr);
              }
            } catch (e) {
              console.warn("[store] Failed to enrich workspace_invites with invited_user_id/invited_by (exception)", e);
            }
          }

          await get().fetchInvites();
          if (!email) {
            toast.success("Invite created", { description: "Share the link with your teammate." });
          }

          // Create notification for the recipient (powers bell + global banner).
          // Note: direct insert may be constrained by RLS until policy updated for pre-membership invite targets.
          if (invitedUserId) {
            try {
              const wsName = get().currentWorkspace.name;
              const notifPayload = {
                user_id: invitedUserId,
                workspace_id: wsId,
                type: 'invite',
                title: 'Workspace Invite',
                message: `${inviterDisplayName} invited you to join "${wsName}"`,
                link: `/teams`,
                metadata: {
                  invite_id: inviteId,
                  workspace_id: wsId,
                  workspace_name: wsName,
                  invited_by: currentUserId,
                  invited_by_name: inviterDisplayName,
                  role: role,
                },
              };
              const { data: notifData, error: notifErr } = await (supabaseClient.from('notifications') as any).insert(notifPayload);
              if (notifErr) {
                console.warn("[store] Failed to create invite notification (RLS or schema?)", notifErr, "payload:", notifPayload);
              } else {
                // Optimistically surface in sender's notifs list too (in case they view it)
                try { get().fetchNotifications?.().catch(() => {}); } catch {}
              }
            } catch (e) {
              console.warn("[store] Failed to create invite notification (exception)", e);
            }
          }

          if (email) {
            const wsName = get().currentWorkspace.name;
            sendInviteEmail(wsId, inviteId, email, wsName, {
              role,
              inviterName: inviterDisplayName,
            })
              .then((sent) => {
                if (sent) {
                  toast.success("Invite email sent", { description: email });
                } else {
                  toast.message("Invite created", {
                    description: "Email could not be sent — share the invite link manually.",
                  });
                }
              })
              .catch(() => {
                toast.message("Invite created", {
                  description: "Email could not be sent — share the invite link manually.",
                });
              });
          }
        } else {
          toast.error("Failed to create invite");
        }
        return inviteId;
      },

      acceptInviteLink: async (inviteId) => {
        if (!isSupabaseLive()) {
          toast.info("Invite accept is live-only");
          return null;
        }
        const wsId = await acceptInvite(inviteId);
        if (wsId) {
          toast.success("Invite accepted! Switching workspace...");
          // Refresh workspaces + switch
          await get().fetchUserWorkspaces();
          // Switch to it
          const fresh = get().workspaces.find((w) => w.id === wsId);
          if (fresh) {
            get().switchWorkspace(wsId); // will trigger init
          } else {
            await get().fetchUserWorkspaces();
          }
          await get().fetchMembers();

          // Best-effort: ensure this user has a profiles row so their name shows up
          // nicely in the members list for everyone (instead of raw UUIDs).
          try {
            const supabase = getSupabaseClient();
            const me = get().user;
            if (supabase && me?.id) {
              await supabase.from('profiles').upsert({ id: me.id } as any, { onConflict: 'id' } as any);
            }
          } catch {}

          // World-class: ensure any powering invite notification is cleaned via central helper
          try {
            const { cleanupInviteEverywhere } = await import("@/lib/data/hybridStore");
            await cleanupInviteEverywhere(inviteId, 'accepted').catch(() => {});
          } catch {}
        } else {
          toast.error("Could not accept invite (invalid/expired?)");
        }
        return wsId;
      },

      changeMemberRole: async (userId, newRole) => {
        const wsId = get().currentWorkspace.id;
        const myRole = get().currentWorkspace.role;
        if (!["owner", "admin"].includes(myRole)) {
          toast.error("Insufficient permissions");
          return false;
        }
        if (userId === get().user?.id) {
          toast.error("Cannot change your own role here");
          return false;
        }
        // Safety: prevent demoting the last owner (protect workspace from lockout)
        const currentMembers = get().members || [];
        const target = currentMembers.find((m) => m.userId === userId);
        if (target?.role === "owner" && newRole !== "owner") {
          const ownerCount = currentMembers.filter((m) => m.role === "owner").length;
          if (ownerCount <= 1) {
            toast.error("Cannot demote the last owner — workspace would become unmanageable");
            return false;
          }
        }
        const ok = await updateMemberRole(wsId, userId, newRole);
        if (ok) {
          await get().fetchMembers();
          toast.success(`Role updated to ${formatRoleLabel(newRole)}`);
        } else {
          toast.error("Failed to update role");
        }
        return ok;
      },

      transferWorkspaceOwnership: async (newOwnerId) => {
        const wsId = get().currentWorkspace.id;
        const myRole = get().currentWorkspace.role;
        const currentUserId = get().user?.id;
        if (myRole !== "owner" || !currentUserId) {
          toast.error("Only the workspace owner can transfer ownership");
          return false;
        }
        if (newOwnerId === currentUserId) {
          toast.error("Choose another member to receive ownership");
          return false;
        }
        const target = (get().members || []).find((m) => m.userId === newOwnerId);
        if (!target) {
          toast.error("Member not found in this workspace");
          return false;
        }
        if (!isSupabaseLive() || ["w1", "w2"].includes(wsId)) {
          toast.info("Ownership transfer requires a live Supabase workspace");
          return false;
        }

        const result = await (await import("@/lib/data/hybridStore")).transferWorkspaceOwnership(
          wsId,
          currentUserId,
          newOwnerId,
        );
        if (result.ok) {
          set((state) => ({
            currentWorkspace: { ...state.currentWorkspace, role: "admin" },
            members: (state.members || []).map((m) => {
              if (m.userId === newOwnerId) return { ...m, role: "owner" as const };
              if (m.userId === currentUserId) return { ...m, role: "admin" as const };
              return m;
            }),
            workspaces: (state.workspaces || []).map((w) =>
              w.id === wsId ? { ...w, role: "admin" as const } : w,
            ),
          }));
          await Promise.all([
            get().fetchMembers?.().catch(() => {}),
            get().fetchUserWorkspaces?.().catch(() => {}),
          ]);
          const label = target.fullName || (target.username ? `@${target.username}` : "the selected member");
          toast.success("Ownership transferred", {
            description: `${label} is now the owner (effective immediately). You are an admin and may leave if you wish.`,
          });
        } else {
          toast.error(result.error || "Failed to transfer ownership");
        }
        return result.ok;
      },

      removeWorkspaceMember: async (userId) => {
        const wsId = get().currentWorkspace.id;
        const myRole = get().currentWorkspace.role;
        if (!["owner", "admin"].includes(myRole)) {
          toast.error("Only owners/admins can remove members");
          return false;
        }
        if (userId === get().user?.id) {
          toast.error("You cannot remove yourself");
          return false;
        }
        // Safety: prevent removing the last owner (protect workspace from lockout / orphaning)
        const currentMembers = get().members || [];
        const target = currentMembers.find((m) => m.userId === userId);
        if (target?.role === "owner") {
          const ownerCount = currentMembers.filter((m) => m.role === "owner").length;
          if (ownerCount <= 1) {
            toast.error("Cannot remove the last owner of the workspace");
            return false;
          }
        }
        const ok = await removeMember(wsId, userId);
        if (ok) {
          await get().fetchMembers();
          // World-class: refresh invites + notifications so owner sees clean state immediately
          // (removed user's pending invites and any assignment notifs are gone)
          await Promise.all([
            get().fetchInvites?.().catch(() => {}),
            get().fetchNotifications?.().catch(() => {}),
          ]);
          toast.success("Member removed");
        } else {
          toast.error("Failed to remove member");
        }
        return ok;
      },

      /**
       * Self-service exit from the current (or specified) workspace.
       * Owners must transfer ownership first — they cannot leave while still owner.
       */
      exitWorkspace: async (targetWorkspaceId) => {
        const wsId = targetWorkspaceId || get().currentWorkspace?.id;
        if (!wsId) {
          toast.error("No workspace to exit");
          return false;
        }
        const currentUserId = get().user?.id;
        if (!currentUserId) return false;

        if (get().currentWorkspace.role === "owner") {
          toast.error("Owners cannot leave", {
            description: "Transfer ownership to another member in Workspace Settings first.",
          });
          return false;
        }

        // Optimistic: immediately remove self from local members list
        const prevMembers = get().members || [];
        set({ members: prevMembers.filter((m) => m.userId !== currentUserId) });

        try {
          const ok = await (await import("@/lib/data/hybridStore")).exitWorkspace(wsId);
          if (ok) {
            // Refresh authoritative state
            await get().fetchUserWorkspaces?.().catch(() => {});
            await get().fetchMembers?.().catch(() => {});
            await get().fetchNotifications?.().catch(() => {});

            // If we just left the current workspace, switch to another one
            if (wsId === get().currentWorkspace?.id) {
              const remaining = get().workspaces || [];
              if (remaining.length > 0) {
                get().switchWorkspace(remaining[0].id);
              }
            }

            toast.success("You have left the workspace");
            return true;
          } else {
            // Rollback optimistic change
            set({ members: prevMembers });
            toast.error("Failed to exit workspace (you may be the last owner)");
            return false;
          }
        } catch (e) {
          set({ members: prevMembers });
          console.error("[exitWorkspace] error", e);
          toast.error("Failed to exit workspace");
          return false;
        }
      },

      updateMyProfile: async (updates) => {
        if (!isSupabaseLive()) {
          toast.info("Profile editing is a live Supabase feature (demo mode is read-only)");
          return false;
        }
        const ok = await updateMyProfile(updates);
        if (ok) {
          set({
            myProfile: {
              ...get().myProfile,
              fullName: updates.fullName ?? get().myProfile?.fullName,
              username: updates.username ?? get().myProfile?.username,
              location: updates.location ?? get().myProfile?.location,
            },
          });
          await get().fetchMembers(); // refresh list so fullName updates everywhere (members, comments, etc.)
          toast.success("Profile updated");
        } else {
          toast.error("Failed to save profile");
        }
        return ok;
      },

      searchPotentialTeammates: async (query, currentWorkspaceId) => {
        // Thin wrapper: hybrid already has full guards + RPC call. No extra toasts here (caller in UI decides UX).
        if (!isSupabaseLive()) return [];
        return await searchPotentialTeammates(query, currentWorkspaceId);
      },

      /**
       * Called when an owner/admin clicks Revoke on an invite in their "Invites sent" list.
       * Goals:
       *  - Delete the invite row
       *  - Clean up any associated notification(s) so the recipient's banner disappears
       *  - Refresh both invites and notifications lists
       */
      revokeInvite: async (inviteId) => {
        const wsId = get().currentWorkspace.id;
        const myRole = get().currentWorkspace.role;
        if (!["owner", "admin"].includes(myRole)) {
          toast.error("Only owners/admins can revoke invites");
          return false;
        }
        const ok = await revokeInvite(wsId, inviteId);
        if (ok) {
          await get().fetchInvites();
          await get().fetchNotifications?.().catch(() => {});
          toast.success("Invite revoked", { description: "Recipient should no longer see the banner." });
        } else {
          toast.error("Failed to revoke invite");
        }
        return ok;
      },

      /**
       * Called when the recipient clicks Decline on the persistent invite banner.
       * Goals:
       *  - Remove the notification for this recipient (so banner + bell clear for them)
       *  - Attempt to remove the invite row (so it disappears from sender's list too)
       *  - Use optimistic UI + fallback fetch for best UX
       */
      declineReceivedInvite: async (inviteId) => {
        const currentUserId = get().user?.id;
        if (!currentUserId) {
          console.error("[decline] No current user id");
          return false;
        }

        console.log("[decline] Declining invite", inviteId, "for user", currentUserId);

        // Optimistically remove from local state immediately (so UI feels responsive)
        const currentNotifs = get().notifications || [];
        const filtered = currentNotifs.filter((n: any) => {
          return !(n.type === "invite" && n.metadata?.invite_id === inviteId);
        });
        set({ notifications: filtered });

        try {
          // World-class central helper (prefers atomic RPCs, strong fallbacks)
          const ok = await (await import("@/lib/data/hybridStore")).cleanupInviteEverywhere(inviteId, 'declined');

          await get().fetchNotifications?.().catch(() => {});
          await get().fetchInvites?.().catch(() => {});

          if (ok) {
            toast.success("Invite declined");
            return true;
          } else {
            toast.error("Failed to decline invite (cleanup incomplete)");
            return false;
          }
        } catch (e) {
          console.error("[declineReceivedInvite] unexpected error", e);
          await get().fetchNotifications?.().catch(() => {});
          toast.error("Failed to decline invite");
          return false;
        }
      },

      resendInvite: async (inviteId) => {
        const wsId = get().currentWorkspace.id;
        const myRole = get().currentWorkspace.role;
        if (!["owner", "admin"].includes(myRole)) {
          toast.error("Only owners/admins can resend invites");
          return false;
        }
        const currentInvites = get().invites || [];
        const target = currentInvites.find((i) => i.id === inviteId);
        if (!target) {
          toast.error("Invite not found in pending list");
          return false;
        }
        // Create fresh (same email/role if any; gets new 14d expiry via RPC)
        const newId = await createInvite(wsId, target.email, target.role);
        if (!newId) {
          toast.error("Failed to create replacement invite");
          return false;
        }
        // Revoke the old one (now superseded)
        const revoked = await revokeInvite(wsId, inviteId);
        await get().fetchInvites();
        if (target.email) {
          const wsName = get().currentWorkspace.name;
          const inviterName = get().user?.email || "Someone";
          sendInviteEmail(wsId, newId, target.email, wsName, {
            role: target.role,
            inviterName,
          }).catch(() => {});
        }
        if (revoked) {
          toast.success("Invite resent", { description: "New link generated (old one revoked)." });
        } else {
          // Still succeeded in creating new; old may be stale but ok
          toast.success("New invite created", { description: "Old invite may still be valid until manually revoked." });
        }
        return true;
      },

      // Comments impl (Agent 14)
      fetchComments: async (target) => {
        set({ isLoadingComments: true });
        try {
          const list = await getComments(target);
          set({ comments: list, isLoadingComments: false });
        } catch {
          set({ isLoadingComments: false });
        }
      },
      addComment: async (content, target) => {
        const wsId = get().currentWorkspace.id;
        const user = get().user;
        if (!content.trim()) return false;
        // Optimistic add
        const tempId = `c_${Date.now()}`;
        const optimistic: Comment = {
          id: tempId,
          content: content.trim(),
          userId: user?.id || "me",
          taskId: target.taskId,
          noteId: target.noteId,
          parentCommentId: target.parentCommentId,
          createdAt: new Date().toISOString(),
          userEmail: user?.email || undefined,
        };
        set({ comments: [...(get().comments || []), optimistic] });

        const created = await createComment({
          content: content.trim(),
          taskId: target.taskId,
          noteId: target.noteId,
          parentCommentId: target.parentCommentId,
          workspaceId: wsId,
          userId: user?.id || null,
        });

        if (created) {
          // Replace optimistic with real
          set({
            comments: (get().comments || []).map((c) => (c.id === tempId ? created : c)),
          });
          // Refresh activity if wired
          get().refreshRecentActivity?.().catch(() => {});
          return true;
        } else {
          // Rollback optimistic on fail
          set({ comments: (get().comments || []).filter((c) => c.id !== tempId) });
          toast.error("Failed to post comment (demo or live error)");
          return false;
        }
      },

      // Agent 31: Notification actions (full foundation: fetch, mark, count, prefs, realtime friendly)
      fetchNotifications: async (unreadOnly = false) => {
        const user = get().user;
        // Fetch ALL notifications for the user (cross-workspace). This ensures 'invite' notifications
        // (which target a ws the recipient may not yet be a member of) appear in the bell
        // and drive global banners regardless of which workspace the recipient is currently viewing.
        if (!user || !isSupabaseLive()) {
          set({ notifications: [], isLoadingNotifications: false });
          return;
        }
        set({ isLoadingNotifications: true });
        try {
          const notifs = await getUserNotifications(user.id, undefined, 50, unreadOnly);
          const count = await getUnreadNotificationCount(user.id, undefined);
          set({ notifications: notifs, unreadNotifCount: count, isLoadingNotifications: false });
        } catch {
          set({ isLoadingNotifications: false });
        }
      },
      markNotifRead: async (idOrIds) => {
        const ids = Array.isArray(idOrIds) ? idOrIds : [idOrIds];
        const ok = await markNotificationsRead(ids);
        if (ok) {
          set((state) => ({
            notifications: state.notifications.map((n) =>
              ids.includes(n.id) ? { ...n, readAt: new Date().toISOString() } : n
            ),
            unreadNotifCount: Math.max(0, state.unreadNotifCount - ids.length),
          }));
        }
      },
      markAllNotifsRead: async () => {
        const unread = get().notifications.filter((n) => !n.readAt).map((n) => n.id);
        if (unread.length === 0) return;
        const ok = await markNotificationsRead(unread);
        if (ok) {
          set((state) => ({
            notifications: state.notifications.map((n) => ({ ...n, readAt: n.readAt || new Date().toISOString() })),
            unreadNotifCount: 0,
          }));
        }
      },
      deleteNotification: async (id) => {
        const userId = get().user?.id;
        if (!userId) return false;
        const ok = await deleteNotification(id, userId);
        if (ok) {
          set((state) => {
            const remaining = state.notifications.filter((n) => n.id !== id);
            const unreadCount = remaining.filter((n) => !n.readAt).length;
            return {
              notifications: remaining,
              unreadNotifCount: unreadCount,
            };
          });
        }
        return ok;
      },
      clearAllNotifications: async () => {
        const userId = get().user?.id;
        if (!userId) return false;
        const ok = await clearAllNotifications(userId);
        if (ok) {
          set({ notifications: [], unreadNotifCount: 0 });
        }
        return ok;
      },
      refreshUnreadCount: async () => {
        const user = get().user;
        const wsId = get().currentWorkspace.id;
        if (!user || !isSupabaseLive()) return;
        const count = await getUnreadNotificationCount(user.id, wsId);
        set({ unreadNotifCount: count });
      },
      loadNotificationPrefs: async () => {
        const userId = get().user?.id;
        if (!userId || !isSupabaseLive()) return;
        const prefs = await getUserNotificationPrefs(userId);
        set({ notificationPrefs: prefs });
      },
      updateNotificationPrefs: async (updates) => {
        const current = get().notificationPrefs || {
          email: true,
          inApp: true,
          types: { mention: true, comment: true, invite: true, task_assigned: true, deadline: true, activity: true },
          perWorkspace: {},
        } as NotificationPrefs;
        const next = {
          ...current,
          ...updates,
          types: { ...current.types, ...(updates.types || {}) },
          perWorkspace: { ...current.perWorkspace, ...(updates.perWorkspace || {}) },
        };
        set({ notificationPrefs: next });

        const userId = get().user?.id;
        if (userId && isSupabaseLive()) {
          const ok = await updateUserNotificationPrefs(userId, next);
          if (ok) {
            toast.success("Notification preferences updated");
            return;
          }
          toast.error("Could not save notification preferences", {
            description: "Your changes are active for this session only.",
          });
          return;
        }

        toast.success("Notification preferences updated", {
          description: "Sign in with a live workspace to persist settings.",
        });
      },

      // Agent 18: real powerful exports (full data + all formats via utils), imports with conflict, apply now wired
      getWorkspaceStats: async () => (await import("@/lib/data/hybridStore")).getWorkspaceStats(get().currentWorkspace.id),
      exportWorkspace: async (format) => {
        const ws = get().currentWorkspace;
        const wsId = ws.id;
        if (!isSupabaseLive() || ["w1", "w2"].includes(wsId)) {
          toast.info("Exports require a live (non-demo) workspace");
          return;
        }
        try {
          const hybridMod = await import("@/lib/data/hybridStore");
          const data = await hybridMod.exportWorkspaceData(wsId, { name: ws.name, slug: ws.slug });
          if (!data) {
            toast.error("Export data unavailable");
            return;
          }
          const utils = await import("@/lib/utils");
          const { downloadFile, exportToJSON, tasksToCSV, notesToCSV, membersToCSV, activityToCSV, exportToMarkdown } = utils;
          const stamp = new Date().toISOString().slice(0, 10);
          const base = ws.slug || "workspace";
          let exported = 0;
          if (format === "json" || format === "all") {
            downloadFile(`${base}-full-${stamp}.json`, exportToJSON(data as any), "application/json");
            exported++;
          }
          if (format === "csv" || format === "all") {
            downloadFile(`${base}-tasks-${stamp}.csv`, tasksToCSV(data.tasks || []), "text/csv");
            downloadFile(`${base}-notes-${stamp}.csv`, notesToCSV(data.notes || []), "text/csv");
            if (data.members && data.members.length) downloadFile(`${base}-members-${stamp}.csv`, membersToCSV(data.members), "text/csv");
            if (data.activity && data.activity.length) downloadFile(`${base}-activity-${stamp}.csv`, activityToCSV(data.activity), "text/csv");
            exported++;
          }
          if (format === "md" || format === "all") {
            downloadFile(`${base}-export-${stamp}.md`, exportToMarkdown(ws.name, data.tasks || [], data.notes || [], data.members || [], data.activity || []), "text/markdown");
            exported++;
          }
          toast.success(`Exported ${exported} file(s) for ${format.toUpperCase()}`);
        } catch (e) {
          toast.error("Export failed — check console");
          console.error(e);
        }
      },
      importWorkspaceData: async (p, options) => (await import("@/lib/data/hybridStore")).importWorkspaceData(get().currentWorkspace.id, p, options),
      getTemplates: async () => (await import("@/lib/data/hybridStore")).getTemplates(get().currentWorkspace.id),
      applyTemplate: async (tpl) => {
        const h = await import("@/lib/data/hybridStore");
        const res = await h.applyTemplate?.(get().currentWorkspace.id, tpl);
        // After apply (live), refresh to surface new items in UI immediately
        if (res && isSupabaseLive() && !["w1", "w2"].includes(get().currentWorkspace.id)) {
          setTimeout(() => get().initializeFromSupabase(), 120);
        }
        return res || null;
      },
      saveCurrentAsTemplate: async (type, id) => (await import("@/lib/data/hybridStore")).logTemplateAction?.(get().currentWorkspace.id, "saved", type, id),
      getAdminTemplateLibrary: () => (ADMIN_TEMPLATE_LIBRARY || []),

      updateWorkspaceDetails: async (updates) => {
        const wsId = get().currentWorkspace.id;
        const myRole = get().currentWorkspace.role;
        if (myRole !== "owner") {
          toast.error("Only the workspace owner can change the name or URL");
          return false;
        }
        const ok = await updateWorkspace(wsId, updates);
        if (ok) {
          // Refresh the authoritative list from the database
          await get().fetchUserWorkspaces();

          // Use the fresh object from the DB for the current workspace
          const freshList = get().workspaces;
          const updated = freshList.find((w) => w.id === wsId);

          if (updated) {
            set({ currentWorkspace: updated });
          }

          toast.success("Workspace updated");
        } else {
          toast.error("Failed to update workspace", {
            description: "The change may have been blocked by permissions or a conflicting slug.",
          });
        }
        return ok;
      },

      deleteCurrentWorkspace: async () => {
        const wsId = get().currentWorkspace.id;
        const userId = get().user?.id;
        const workspaces = get().workspaces;

        const guard = canDeleteWorkspace(wsId, workspaces, userId);
        if (!guard.allowed) {
          toast.error(guard.reason ?? "This workspace cannot be deleted");
          return false;
        }

        const ok = await deleteWorkspace(wsId);
        if (!ok) {
          toast.error("Failed to delete workspace", {
            description:
              "Nothing was removed on the server. Run supabase/add-delete-workspace-rpc.sql in your Supabase SQL editor, then try again.",
          });
          return false;
        }

        get().teardownWorkspaceRealtime();

        const remaining = workspaces.filter((w) => w.id !== wsId);
        const next = getWorkspaceSwitchTargetAfterDelete(remaining, userId);
        set({ workspaces: remaining });

        if (next) {
          set({ currentWorkspace: next, members: [], invites: [], onlineUsers: [] });
          saveLastWorkspaceId(userId, next.id);
          await get().initializeFromSupabase();
          if (isSupabaseLive() && !["w1", "w2"].includes(next.id)) {
            get().fetchMembers();
            get().fetchInvites();
            get().fetchNotifications?.().catch(() => {});
            get().setupWorkspaceRealtime();
          }
        } else {
          set({ currentWorkspace: { id: "", name: "No workspace", slug: "", role: "owner" } as Workspace });
        }

        await get().fetchUserWorkspaces();

        const refreshed = get().workspaces;
        const curr = get().currentWorkspace;
        if (refreshed.length > 0 && !refreshed.some((w) => w.id === curr.id)) {
          const fallback = getWorkspaceSwitchTargetAfterDelete(refreshed, userId) ?? refreshed[0];
          set({ currentWorkspace: fallback });
          saveLastWorkspaceId(userId, fallback.id);
          await get().initializeFromSupabase();
        }

        toast.success("Workspace deleted", {
          description: next ? `Switched to ${next.name}` : undefined,
        });
        return true;
      },

      setupWorkspaceRealtime: () => {
        const wsId = get().currentWorkspace.id;
        if (!isSupabaseLive() || !wsId || ["w1", "w2"].includes(wsId)) return;

        // Teardown old first
        get().teardownWorkspaceRealtime();

        const cleanup = subscribeToWorkspaceRealtime(wsId, {
          onTaskChange: (payload) => {
            // Smart update of local tasks list without full refetch (optimistic + live)
            const { eventType, new: newRow, old: oldRow } = payload;
            const currentTasks = get().tasks;
            if (eventType === "INSERT" && newRow) {
              // Avoid dupes
              if (!currentTasks.some((t) => t.id === newRow.id)) {
                // Map lightly (reuse hybrid mapper logic via import? simple here)
                const mapped = {
                  id: newRow.id,
                  workspaceId: newRow.workspace_id,
                  title: newRow.title,
                  description: newRow.description || "",
                  status: newRow.status,
                  priority: newRow.priority,
                  dueDate: newRow.due_date || undefined,
                  assigneeIds: newRow.assignee_ids || [],
                  assignee: resolveAssigneeLabel(
                    newRow.assignee_ids || [],
                    get().members || [],
                    get().user?.id
                  ),
                  tags: newRow.tags || [],
                  createdAt: newRow.created_at,
                  completedAt: newRow.completed_at || undefined,
                  timeEstimate: newRow.time_estimate || undefined,
                  linkedNoteIds: newRow.linked_note_ids || [],
                  recurringRule: newRow.recurring_rule ?? undefined,
                  exceptionDates: newRow.exception_dates ?? undefined,
                  parentTaskId: newRow.parent_task_id ?? undefined,
                } as Task;
                set({ tasks: [mapped, ...currentTasks] });
              }
            } else if (eventType === "UPDATE" && newRow) {
              // Agent 30: live conflict detection for concurrent edits (if selected/editing this item right now)
              const st = get();
              const isSelected = st.selectedTaskId === newRow.id;
              const isEditing = st.onlineUsers?.some(u => u.editingItemId === newRow.id && u.userId !== (st.user?.id || 'me')) || isSelected;
              const existing = currentTasks.find(t => t.id === newRow.id);
              const remotePreview = newRow.title || '';

              // Live collab polish: if we have a recent liveEditing signal for this task, the lightweight broadcast is already flowing — suppress the heavier conflict banner
              const liveEdit = st.liveEditing?.[newRow.id];
              const hasRecentLive = liveEdit && (Date.now() - new Date(liveEdit.lastUpdatedAt).getTime() < 8000);

              if (isEditing && existing && !hasRecentLive && (existing.title !== (newRow.title || '') || existing.description !== (newRow.description || ''))) {
                // Surface conflict UI (non blocking)
                set((s) => ({
                  activeConflicts: {
                    ...s.activeConflicts,
                    [newRow.id]: { itemId: newRow.id, itemType: 'task', remoteUser: 'collaborator', remoteUpdatedAt: newRow.updated_at || new Date().toISOString(), remotePreview }
                  }
                }));
              }
              set({
                tasks: currentTasks.map((t) => {
                  if (t.id !== newRow.id) return t;
                  const next = {
                    ...t,
                    title: newRow.title ?? t.title,
                    description: newRow.description ?? t.description,
                    status: newRow.status ?? t.status,
                    priority: newRow.priority ?? t.priority,
                    dueDate: newRow.due_date ?? t.dueDate,
                    tags: newRow.tags ?? t.tags,
                    completedAt: newRow.completed_at ?? t.completedAt,
                  } as Task;
                  if (Object.prototype.hasOwnProperty.call(newRow, "assignee_ids")) {
                    next.assigneeIds = newRow.assignee_ids ?? [];
                    next.assignee = resolveAssigneeLabel(
                      next.assigneeIds,
                      get().members || [],
                      get().user?.id
                    );
                  }
                  if (Object.prototype.hasOwnProperty.call(newRow, "recurring_rule")) {
                    next.recurringRule = newRow.recurring_rule ?? undefined;
                  }
                  if (Object.prototype.hasOwnProperty.call(newRow, "exception_dates")) {
                    next.exceptionDates = newRow.exception_dates ?? undefined;
                  }
                  if (Object.prototype.hasOwnProperty.call(newRow, "parent_task_id")) {
                    next.parentTaskId = newRow.parent_task_id ?? undefined;
                  }
                  return next;
                }),
              });
            } else if (eventType === "DELETE" && oldRow) {
              set({ tasks: currentTasks.filter((t) => t.id !== oldRow.id) });
            }
          },
          onNoteChange: (payload) => {
            const { eventType, new: newRow, old: oldRow } = payload;
            const currentNotes = get().notes;
            if (eventType === "INSERT" && newRow) {
              if (!currentNotes.some((n) => n.id === newRow.id)) {
                const mapped = mapRealtimeNoteRow(newRow as Record<string, unknown>);
                set({ notes: [mapped, ...currentNotes] });
              }
            } else if (eventType === "UPDATE" && newRow) {
              // Agent 30: live conflict detection for concurrent note edits
              const st = get();
              const isSelected = (st as any).selectedNoteId === newRow.id; // note id tracked in page but approximate via editing
              const editingOthers = (st.onlineUsers || []).some((u: any) => u.editingItemId === newRow.id && u.editingItemType === 'note' && u.userId !== (st.user?.id || 'me'));
              const existing = currentNotes.find(n => n.id === newRow.id);

              // Live collab polish: suppress conflict banner when live content broadcast is actively flowing
              const liveEdit = st.liveEditing?.[newRow.id];
              const hasRecentLive = liveEdit && (Date.now() - new Date(liveEdit.lastUpdatedAt).getTime() < 8000);

              if ((isSelected || editingOthers) && existing && !hasRecentLive && existing.title !== (newRow.title || '')) {
                set((s) => ({
                  activeConflicts: {
                    ...s.activeConflicts,
                    [newRow.id]: { itemId: newRow.id, itemType: 'note', remoteUser: 'collaborator', remoteUpdatedAt: newRow.updated_at || new Date().toISOString(), remotePreview: newRow.title }
                  }
                }));
              }
              set({
                notes: currentNotes.map((n) =>
                  n.id === newRow.id
                    ? mergeRealtimeNoteUpdate(n, newRow as Record<string, unknown>)
                    : n
                ),
              });
            } else if (eventType === "DELETE" && oldRow) {
              set({ notes: currentNotes.filter((n) => n.id !== oldRow.id) });
            }
          },
          onInviteChange: (payload) => {
            // When any invite changes (especially DELETE from recipient decline/accept),
            // refresh the sender's list so "Invites sent" updates instantly.
            // Also refetch notifications for symmetric zero-orphan banner/bell clearance across all clients/tabs.
            const { eventType } = payload;
            if (eventType === "DELETE" || eventType === "INSERT" || eventType === "UPDATE") {
              get().fetchInvites?.().catch(() => {});
              get().fetchNotifications?.().catch(() => {});
            }
          },
          onMemberChange: (payload) => {
            // When a member is added (accept), removed, or updated,
            // refresh the members list so everyone sees the change instantly.
            // Also refetch notifications for banner zero-orphan on membership events.
            const { eventType, old: oldRow, new: newRow } = payload;
            const currentUserId = get().user?.id;
            const currentWsId = get().currentWorkspace?.id;

            if (eventType === "UPDATE" && newRow?.workspace_id === currentWsId && newRow?.user_id && newRow?.role) {
              const updatedRole = fromDbRole(newRow.role as string);
              set((state) => ({
                members: (state.members || []).map((m) =>
                  m.userId === newRow.user_id ? { ...m, role: updatedRole } : m,
                ),
                ...(newRow.user_id === currentUserId
                  ? {
                      currentWorkspace: { ...state.currentWorkspace, role: updatedRole },
                      workspaces: (state.workspaces || []).map((w) =>
                        w.id === currentWsId ? { ...w, role: updatedRole } : w,
                      ),
                    }
                  : {}),
              }));
            }

            if (eventType === "INSERT" || eventType === "DELETE" || eventType === "UPDATE") {
              get().fetchMembers?.().catch(() => {});
              get().fetchNotifications?.().catch(() => {});
              if (eventType === "UPDATE") {
                get().fetchUserWorkspaces?.().catch(() => {});
              }
            }

            // Special handling for the removed user themselves
            if (eventType === "DELETE" && oldRow) {
              const currentUserId = get().user?.id;
              const removedUserId = oldRow.user_id;

              if (removedUserId === currentUserId) {
                const removedWorkspaceId = oldRow.workspace_id;
                const currentWs = get().currentWorkspace;

                // Try to find a friendly name before we refresh the list
                const wsList = get().workspaces || [];
                const removedWs = wsList.find((w) => w.id === removedWorkspaceId);
                const wsName = removedWs?.name || "a workspace";

                toast(`You have been removed from ${wsName}`);

                // Refresh the user's workspace list so they no longer see the removed workspace
                get().fetchUserWorkspaces?.().catch(() => {});

                if (removedWorkspaceId === currentWs?.id) {
                  // We were actively viewing the workspace we were just removed from
                  get().teardownWorkspaceRealtime?.();

                  const remaining = (get().workspaces || []).filter((w) => w.id !== removedWorkspaceId);

                  if (remaining.length > 0) {
                    // Automatically switch the removed user to another workspace they still belong to
                    get().switchWorkspace(remaining[0].id);
                  } else {
                    // No workspaces left — clear the current workspace state cleanly
                    set({
                      currentWorkspace: undefined,
                      tasks: [],
                      notes: [],
                      workspaceLists: [],
                      listItems: [],
                      members: [],
                      invites: [],
                      onlineUsers: [],
                    });
                  }
                }
              }
            }
          },
        });

        // Store cleanup for later teardown (simple closure capture via state flag)
        (get() as any)._realtimeCleanup = cleanup;

        // Basic presence (track self) + enhanced meta for view/item editing indicators (Agent 14 polish)
        const presenceChannel = getWorkspacePresenceChannel(wsId);
        if (presenceChannel) {
          const user = get().user;
          presenceChannel
            .on("presence", { event: "sync" }, () => {
              const state = presenceChannel.presenceState();
              const userMap = new Map<string, any>();

              Object.keys(state).forEach((key) => {
                const presences = state[key] as any[];
                presences.forEach((p) => {
                  const userId = p.user_id || key;
                  const existing = userMap.get(userId);

                  // Keep the most recent presence per user (prefer ones with editing context)
                  const currentTime = new Date(p.online_at || 0).getTime();
                  const existingTime = existing ? new Date(existing.online_at || 0).getTime() : 0;

                  if (!existing || currentTime > existingTime || (p.editingItemId && !existing.editingItemId)) {
                    userMap.set(userId, {
                      userId,
                      email: p.email,
                      presenceRef: key,
                      view: p.currentView,
                      editingItemId: p.editingItemId,
                      editingItemType: p.editingItemType,
                      online_at: p.online_at,
                    });
                  }
                });
              });

              const users = Array.from(userMap.values());
              set({ onlineUsers: users });
            })
            .on("presence", { event: "join" }, ({ key, newPresences }) => {
              // lightweight; full sync above handles
            })
            // Agent 30: listen for live cursor/selection broadcasts + mentions/conflict signals on the shared presence channel (premium collab)
            .on('broadcast', { event: 'cursor-update' }, ({ payload }) => {
              if (!payload?.userId) return;
              const selfId = get().user?.id || 'me';
              if (payload.userId === selfId) return; // ignore echo
              const color = payload.color || getUserColor(payload.userId);
              set((s) => {
                const filtered = (s.remoteCursors || []).filter(c => c.userId !== payload.userId);
                return { remoteCursors: [...filtered, { ...payload, color }] };
              });
            })
            .on('broadcast', { event: 'cursor-clear' }, ({ payload }) => {
              if (!payload?.userId) return;
              set((s) => ({ remoteCursors: (s.remoteCursors || []).filter(c => c.userId !== payload.userId) }));
            })
            .on('broadcast', { event: 'mention' }, ({ payload }) => {
              // Enhance mentions realtime: toast if mentioned (demo + live)
              const selfEmail = get().user?.email?.toLowerCase();
              if (payload?.mentionedEmails?.some((e: string) => e?.toLowerCase() === selfEmail) || payload?.mentionedUserIds?.includes(get().user?.id)) {
                toast(`🔔 Mentioned by ${payload.by || 'teammate'}`, { description: payload.preview || 'in a comment' });
              }
            })
            // Live collab foundation (Slice 1): lightweight "while typing" broadcasts
            .on('broadcast', { event: 'live-task-edit' }, ({ payload }) => {
              if (!payload?.taskId || !payload?.userId) return;
              const selfId = get().user?.id || 'me';
              if (payload.userId === selfId) return; // ignore own echoes

              // Update liveEditing indicator
              set((s) => ({
                liveEditing: {
                  ...s.liveEditing,
                  [payload.taskId]: {
                    userId: payload.userId,
                    email: payload.email,
                    itemType: 'task',
                    lastUpdatedAt: payload.ts || new Date().toISOString(),
                  },
                },
              }));

              // Optimistic apply only if this task is currently open/selected (avoid fighting local state)
              const currentSelected = get().selectedTaskId;
              if (currentSelected === payload.taskId) {
                const updates: any = {};
                if (payload.title !== undefined) updates.title = payload.title;
                if (payload.description !== undefined) updates.description = payload.description;
                if (Object.keys(updates).length > 0) {
                  set((s) => ({
                    tasks: s.tasks.map((t) =>
                      t.id === payload.taskId ? { ...t, ...updates } : t
                    ),
                  }));
                }
              }
            })
            .on('broadcast', { event: 'live-note-content' }, ({ payload }) => {
              if (!payload?.noteId || !payload?.userId || !payload?.content) return;
              const selfId = get().user?.id || 'me';
              if (payload.userId === selfId) return;

              console.log('[live-collab] RECEIVED note content', { noteId: payload.noteId, fromUser: payload.userId });

              set((s) => ({
                liveEditing: {
                  ...s.liveEditing,
                  [payload.noteId]: {
                    userId: payload.userId,
                    email: payload.email,
                    itemType: 'note',
                    lastUpdatedAt: payload.ts || new Date().toISOString(),
                  },
                },
              }));

              // Optimistic apply only when the note is currently being viewed/edited
              const currentNotes = get().notes;
              const isViewingThisNote = currentNotes.some((n) => n.id === payload.noteId); // simple check; parent controls visibility
              if (isViewingThisNote) {
                set((s) => ({
                  notes: s.notes.map((n) =>
                    n.id === payload.noteId ? { ...n, content: payload.content } : n
                  ),
                }));
              }
            })
            .subscribe(async (status) => {
              if (status === "SUBSCRIBED") {
                const st = get();
                await presenceChannel.track({
                  user_id: user?.id,
                  email: user?.email,
                  online_at: new Date().toISOString(),
                  currentView: st.currentView,
                  editingItemId: st.selectedTaskId || undefined,
                  editingItemType: st.selectedTaskId ? 'task' : undefined,
                }, { key: user?.id }); // Use user ID as presence key so multiple tabs from same user are handled better
                // Initial meta refresh available via action
                get().updatePresenceMeta();
              }
            });
          (get() as any)._presenceChannel = presenceChannel;
        }

        // Agent 30: Excellent demo simulated presence (cursors, views, editing) - makes demo feel truly live & magical like Figma
        const isDemo = !isSupabaseLive() || ["w1", "w2"].includes(wsId);
        if (isDemo) {
          get().startDemoPresenceSimulator?.();
        }
      },

      teardownWorkspaceRealtime: () => {
        const cleanup = (get() as any)._realtimeCleanup;
        if (typeof cleanup === "function") {
          cleanup();
          delete (get() as any)._realtimeCleanup;
        }
        const pres = (get() as any)._presenceChannel;
        if (pres) {
          // Explicit untrack for instant leave signal (peers see user disappear immediately on ws switch / signout / close)
          pres.untrack().catch(() => {});
          pres.unsubscribe().catch(() => {});
          delete (get() as any)._presenceChannel;
        }
        const t = (get() as any)._demoPresenceTimer;
        if (t) { clearInterval(t); delete (get() as any)._demoPresenceTimer; }
        set({ onlineUsers: [], remoteCursors: [], activeConflicts: {}, liveEditing: {} });
      },

      // Agent 14: refresh or update presence meta (view + editing item) for live indicators/cursors across views
      updatePresenceMeta: (meta) => {
        const pres = (get() as any)._presenceChannel;
        if (!pres || !isSupabaseLive()) return;
        const st = get();
        const user = st.user;
        const payload: any = {
          user_id: user?.id,
          email: user?.email,
          online_at: new Date().toISOString(),
          currentView: meta?.view ?? st.currentView,
          editingItemId: meta?.editingItemId ?? st.selectedTaskId ?? undefined,
          editingItemType: meta?.editingItemType ?? (st.selectedTaskId ? 'task' : undefined),
        };
        pres.track(payload, { key: user?.id }).catch(() => {});
      },

      // Agent 30: Update cursor/selection position - broadcasts via presence channel for live cursors in editor
      updateCursorPosition: (itemType, itemId, from = 0, to = 0) => {
        const pres = (get() as any)._presenceChannel;
        const st = get();
        const user = st.user;
        if (!user) return;
        // Always update local state for instant feel (self cursor not rendered)
        // For remote, broadcast so others receive
        const color = getUserColor(user.id || user.email || 'demo');
        const cursor = { userId: user.id || 'me', email: user.email || undefined, itemId, itemType, from, to, color };
        // Local mirror (for consistency, though self not shown in UI)
        set((s) => ({ remoteCursors: [...(s.remoteCursors || []).filter(c => c.userId !== (user.id||'me')), cursor] }));
        if (pres && isSupabaseLive()) {
          pres.send({
            type: 'broadcast',
            event: 'cursor-update',
            payload: { ...cursor, ts: Date.now() }
          }).catch(() => {});
        } else if (!isSupabaseLive() || ["w1","w2"].includes(st.currentWorkspace.id)) {
          // Demo: echo to other simulated users? handled by simulator
        }
      },
      clearCursorPosition: () => {
        const user = get().user;
        const uid = user?.id || 'me';
        set((s) => ({ remoteCursors: (s.remoteCursors || []).filter(c => c.userId !== uid) }));
        const pres = (get() as any)._presenceChannel;
        if (pres) {
          pres.send({ type: 'broadcast', event: 'cursor-clear', payload: { userId: uid } }).catch(() => {});
        }
      },

      // ===== Live collaborative editing (lightweight broadcast foundation) =====
      // These send small, frequent updates over the existing presence channel.
      // Receivers apply optimistically only when the item is currently open.
      // Full persistence still goes through normal updateTask / updateNote + postgres_changes + LWW.

      broadcastLiveTaskEdit: (taskId, updates) => {
        const pres = (get() as any)._presenceChannel;
        const st = get();
        const user = st.user;
        if (!user || !isSupabaseLive() || ["w1", "w2"].includes(st.currentWorkspace.id)) return;

        // For live collab broadcasts we are more permissive.
        // This helps with same-user multi-tab testing.
        if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;

        const payload = {
          taskId,
          userId: user.id || 'me',
          email: user.email,
          title: updates.title,
          description: updates.description,
          ts: new Date().toISOString(),
        };

        if (pres) {
          pres.send({
            type: 'broadcast',
            event: 'live-task-edit',
            payload,
          }).catch(() => {});
        }

        // Also keep our own liveEditing indicator fresh (so UI can show "You are editing")
        set((s) => ({
          liveEditing: {
            ...s.liveEditing,
            [taskId]: {
              userId: user.id || 'me',
              email: user.email,
              itemType: 'task',
              lastUpdatedAt: payload.ts,
            },
          },
        }));
      },

      broadcastLiveNoteContent: (noteId, content) => {
        const pres = (get() as any)._presenceChannel;
        const st = get();
        const user = st.user;
        if (!user || !isSupabaseLive() || ["w1", "w2"].includes(st.currentWorkspace.id)) return;

        // For live collab broadcasts we are more permissive than general presence.
        // This allows testing with the same user in multiple tabs (presence often collapses same-user sessions to 1 entry).
        // In production with real teammates this will almost always have > 1.
        if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;

        console.log('[live-collab] SENDING note content broadcast', { noteId, fromUser: user.id });

        const payload = {
          noteId,
          userId: user.id || 'me',
          email: user.email,
          content,
          ts: new Date().toISOString(),
        };

        if (pres) {
          pres.send({
            type: 'broadcast',
            event: 'live-note-content',
            payload,
          }).catch(() => {});
        }

        set((s) => ({
          liveEditing: {
            ...s.liveEditing,
            [noteId]: {
              userId: user.id || 'me',
              email: user.email,
              itemType: 'note',
              lastUpdatedAt: payload.ts,
            },
          },
        }));
      },

      // Agent 30: resolve concurrent edit conflict (LWW aware + UI choice)
      resolveConflict: async (itemId, keepLocal) => {
        const conflicts = get().activeConflicts || {};
        const conf = conflicts[itemId];
        if (!conf) return;
        if (keepLocal) {
          // Force local to server (re-apply update)
          if (conf.itemType === 'task') {
            const t = get().tasks.find(t => t.id === itemId);
            if (t) await get().updateTask(itemId, { title: t.title, description: t.description } as any);
          } else {
            const n = get().notes.find(n => n.id === itemId);
            if (n) await get().updateNote(itemId, { title: n.title, content: n.content });
          }
        } else {
          // Take remote: refetch item via init (simple)
          await get().initializeFromSupabase?.();
        }
        set((s) => {
          const next = { ... (s.activeConflicts || {}) };
          delete next[itemId];
          return { activeConflicts: next };
        });
        toast.success(keepLocal ? "Kept your version" : "Took collaborator's version");
      },

      // Agent 30: start (or restart) delightful simulated presence for demo workspaces - rotates views, editing, cursors, online users. Magical even without Supabase.
      startDemoPresenceSimulator: () => {
        const wsId = get().currentWorkspace.id;
        if (typeof window === 'undefined') return;
        // Clear any prior
        if ((get() as any)._demoPresenceTimer) clearInterval((get() as any)._demoPresenceTimer);
        const demoUsers = [
          { userId: 'demo-alice', email: 'alice@demo.dev', name: 'Alice Chen' },
          { userId: 'demo-bob', email: 'bob@demo.dev', name: 'Bob Rivera' },
        ];
        const views = ['home', 'tasks', 'notes', 'teams'] as const;
        const itemPool = [...get().tasks.map(t => ({id: t.id, type:'task' as const})), ...get().notes.map(n => ({id: n.id, type:'note' as const})) ];
        let tick = 0;
        const timer = setInterval(() => {
          tick++;
          const online = demoUsers.map((u, i) => {
            const v = views[(tick + i) % views.length];
            const item = itemPool.length ? itemPool[(tick + i*2) % itemPool.length] : undefined;
            return { userId: u.userId, email: u.email, presenceRef: u.userId, view: v, editingItemId: item?.id, editingItemType: item?.type };
          });
          set({ onlineUsers: online });
          // Simulate some remote cursors in editor (for notes/tasks if selected)
          const stNow = get();
          const selNote = stNow.notes.find(n => n.id === (stNow as any).selectedNoteIdInDemo || (stNow as any).selectedNoteId ); // loose
          if (selNote && tick % 3 === 0) {
            const fakeCursor = { userId: demoUsers[0].userId, email: demoUsers[0].email, itemId: selNote.id, itemType: 'note' as const, from: 10 + (tick%40), to: 12 + (tick%40), color: getUserColor(demoUsers[0].userId) };
            set((s) => ({ remoteCursors: [fakeCursor] }));
          }
          // Occasionally fake a conflict for polish demo (rare)
          if (tick % 12 === 0 && stNow.selectedTaskId && get().tasks.find(t=>t.id===stNow.selectedTaskId)) {
            // only surface if not already
            if (!get().activeConflicts[stNow.selectedTaskId]) {
              set((s) => ({ activeConflicts: { ...s.activeConflicts, [stNow.selectedTaskId!]: { itemId: stNow.selectedTaskId!, itemType: 'task', remoteUser: 'Alice Chen', remoteUpdatedAt: new Date().toISOString(), remotePreview: 'Updated title + desc' } } }));
            }
          }
        }, 2800); // smooth live feel, not spammy
        (get() as any)._demoPresenceTimer = timer;
        // Seed initial
        set({ onlineUsers: demoUsers.map((u,i) => ({ userId: u.userId, email: u.email, view: views[i%views.length] })) });
      },
    }),
    {
      name: "badazz-tasks-storage",
      storage: safeLocalStorage,
      partialize: (state) => {
        // Persistence strategy updated for Phase 1 offline support:
        // - Demo mode (!live): persist full data + workspaces (edits survive refresh, as before).
        // - Live/Supabase mode: NOW persist data (tasks/notes/workspaces/currentWorkspace) + UI prefs.
        //   This enables offline reads + local optimistic changes to survive refresh.
        //   Real server truth is still preferred on init when online; queue handles pending writes.
        //   Transient flags (isOnline, isSyncing, pending count) intentionally excluded.
        if (isSupabaseLive()) {
          return {
            tasks: state.tasks,
            notes: state.notes,
            workspaceLists: state.workspaceLists,
            listItems: state.listItems,
            currentWorkspace: state.currentWorkspace,
            workspaces: state.workspaces,
            currentView: state.currentView,
            taskFilter: state.taskFilter,
            myProfile: state.myProfile,
          };
        }
        return {
          tasks: state.tasks,
          notes: state.notes,
          workspaceLists: state.workspaceLists,
          listItems: state.listItems,
          currentWorkspace: state.currentWorkspace,
          workspaces: state.workspaces,
          myProfile: state.myProfile,
        };
      },
    }
  )
);

// ------------------------------------------------------------------
// Quality / Leakage Prevention: Rehydration Sanitizer (live mode only)
// ------------------------------------------------------------------
// If localStorage ever contains demo data (from before Supabase keys were added, or mixed sessions),
// this guarantees it is purged the instant the store finishes rehydrating in a live Supabase environment.
// This is the final safety net ensuring ZERO SAMPLE pollution can reach authenticated users.
if (typeof window !== "undefined") {
  // @ts-ignore - persist API is available on the store instance
  useTaskStore.persist.onFinishHydration((state) => {
    const persistedView = (state as { currentView?: string })?.currentView;
    if (persistedView === "calendar" || persistedView === "today") {
      useTaskStore.setState({ currentView: "home" });
    }
    if (isSupabaseLive() && state) {
      const currId = (state as any).currentWorkspace?.id || "";
      const wsList = (state as any).workspaces || [];
      const taskList = (state as any).tasks || [];
      const looksLikeDemo =
        ["w1", "w2"].includes(currId) ||
        wsList.some((w: any) => ["w1", "w2"].includes(w?.id)) ||
        taskList.some((t: any) => t?.workspaceId === "w1" || t?.workspaceId === "w2");

      if (looksLikeDemo) {
        useTaskStore.setState({
          tasks: [],
          notes: [],
          workspaceLists: [],
          listItems: [],
          recentActivity: [],
          workspaces: [],
          currentWorkspace: { id: "", name: "Loading your workspaces...", slug: "", role: "owner" } as Workspace,
          taskLoadingStates: {},
        });
      }
    }
  });
}
