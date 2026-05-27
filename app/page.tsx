"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { 
  Check, Plus, Search, Command, Calendar, Users, Settings, 
  ChevronLeft, ChevronRight, Clock, Star, Zap, ArrowUpRight, Sparkles,
  Loader2, User, LogOut, X, Trash2, GripVertical, Repeat, Download, Upload, FileText, BarChart3, RefreshCw, FileDown,
  GitBranch, Network, Bell
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  addDays,
  isSameDay,
  isToday,
  startOfDay,
  addWeeks,
  subWeeks,
} from "date-fns";
import { toast } from "sonner";

// @dnd-kit for real Kanban drag & drop (Phase 1)
import {
  DndContext,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  useDroppable,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { useTaskStore } from "@/store/useTaskStore";
import { useShallow } from "zustand/shallow";
import { Task, Note, TaskStatus, Priority, ActivityLog, Notification } from "@/types";
import { cn, formatDueDate, getPriorityColor, getRecurringLabel, getOccurrencesInRange, getNextRecurringDue, normalizeExceptionKey, triggerHaptic, getRecurrenceEndDescription, generateRecurringInstances, type RecurringInstanceInfo } from "@/lib/utils";
import { jsonToNoteContent } from "@/lib/data/hybridStore"; // For clean plain-text previews even with rich JSONB stringified content from TipTap
import { CommandPalette } from "@/components/CommandPalette";
import { ConfirmationModal } from "@/components/ConfirmationModal";
import { Confetti } from "@/components/Confetti";
import { SupabaseSetupBanner } from "@/components/SupabaseSetupBanner";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { AuthModal } from "@/components/AuthModal";
import { TaskModal } from "@/components/TaskModal";
import { AIChatPanel } from "@/components/AIChatPanel";
import { TipTapEditor } from "@/components/TipTapEditor"; // Still works via shim re-export (or direct: "@/features/notes/editor/TipTapEditor")
import { KnowledgeGraph } from "@/components/KnowledgeGraph";
import { 
  extractActionItemsFromText, extractActionItemsFromTextAI, generateDailyBriefing, generateDailyBriefingAI, generateWeeklyBriefing, generateWeeklyBriefingAI, isXAIConfigured,
  getHybridSearchResults, buildKnowledgeGraph, suggestLinksForNote, suggestLinksForTask 
} from "@/lib/utils";

const VIEWS = [
  { id: "today", label: "Today", icon: Clock },
  { id: "tasks", label: "Tasks", icon: Check },
  { id: "notes", label: "Notes", icon: Star },
  { id: "calendar", label: "Calendar", icon: Calendar },
  { id: "teams", label: "Teams", icon: Users },
] as const;

/* =====================================================================
   Kanban DnD sub-components (real @dnd-kit, production-polished)
   - SortableKanbanTask: per-card with explicit drag handle + useSortable + rich visuals/hints
   - KanbanColumn: dedicated droppable wrapper (proper hook placement, reliable)
   - KanbanBoard: DndContext + sensors + overlay + delegates to store.kanbanReorder (optimistic+persist)
   - Buttery: 60fps transforms, clear drag-over, enhanced overlay, handle hints
   - Multi-drag: planned (requires custom multi-select + overlay); single is rock-solid
   - List DND: intentionally not wired here (conflicts with dynamic filters/sorts in getFilteredTasks; Board view is the manual reorder surface)
   ===================================================================== */

function SortableKanbanTask({ task, onOpen }: { task: Task; onOpen: (task: Task) => void }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 999 : undefined,
    // Extra buttery scale on drag for premium feel
    scale: isDragging ? "1.015" : undefined,
  };

  const due = task.dueDate ? formatDueDate(task.dueDate) : null;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "glass rounded-xl p-3.5 border border-white/10 hover:border-[#c084fc]/30 transition-all cursor-default",
        isDragging && "shadow-2xl ring-1 ring-[#c084fc]/40 border-[#c084fc]/40"
      )}
      data-dragging={isDragging}
    >
      <div className="flex justify-between items-start gap-2">
        <div className="flex items-start gap-2 flex-1 min-w-0">
          {/* Explicit drag handle: production quality, always discoverable, great a11y + micro-interaction hints */}
          <div
            {...listeners}
            {...attributes}
            className="mt-0.5 cursor-grab active:cursor-grabbing text-[#71717a] hover:text-[#c084fc] transition-all p-1 -ml-1 rounded hover:bg-white/10 select-none group/handle"
            onClick={(e) => e.stopPropagation()}
            title="Drag handle: reorder within column or move to another (hold &amp; drag)"
            aria-label="Drag task to reorder or change status"
            role="button"
            tabIndex={0}
          >
            <GripVertical className="h-3.5 w-3.5 group-hover/handle:scale-110 transition" />
          </div>
          <div
            onClick={() => onOpen(task)}
            className="font-medium text-sm leading-tight flex-1 min-w-0 cursor-pointer"
          >
            {task.title}
          </div>
        </div>
        <div className={`priority-badge priority-${task.priority.toLowerCase()} shrink-0`}>{task.priority}</div>
      </div>

      {due && (
        <div className="mt-2 text-[11px] text-[#71717a] ml-6">
          {due.label}
        </div>
      )}
      {task.recurringRule && (
        <div className="mt-1 text-[10px] text-[#c084fc]/80 ml-6 font-medium flex items-center gap-1">
          ↻ {getRecurringLabel(task.recurringRule)}
        </div>
      )}
    </div>
  );
}

// Extracted for RULES OF HOOKS compliance + clean separation (production reliability)
// Each column instance safely calls its own useDroppable at top level.
function KanbanColumn({ 
  col, 
  tasks: colTasks, 
  onOpenTask 
}: { 
  col: { status: TaskStatus; label: string }; 
  tasks: Task[]; 
  onOpenTask: (task: Task) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: col.status });
  const taskIds = colTasks.map((t) => t.id);

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "kanban-column rounded-2xl p-3 min-h-[420px] transition-all",
        isOver && "drag-over ring-1 ring-inset ring-[#c084fc]/60 bg-[#c084fc]/[0.015]"
      )}
    >
      <div className="flex items-center justify-between mb-3 px-2">
        <div className="font-semibold text-sm tracking-wide text-[#a1a1aa]">{col.label}</div>
        <div className="text-xs text-[#71717a] font-mono tabular-nums">{colTasks.length}</div>
      </div>

      <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
        <div className="space-y-2 min-h-[320px]">
          {colTasks.length === 0 && (
            <div className="text-center py-8 text-xs text-[#71717a] border border-dashed border-white/10 rounded-xl flex items-center justify-center min-h-[120px]">
              Drop tasks here
            </div>
          )}
          {colTasks.map((task) => (
            <SortableKanbanTask key={task.id} task={task} onOpen={onOpenTask} />
          ))}
        </div>
      </SortableContext>
    </div>
  );
}

function KanbanBoard({ onOpenTask }: { onOpenTask: (task: Task) => void }) {
  // Stable subscriptions only (prevents "getSnapshot should be cached" infinite loop)
  const tasks = useTaskStore((state) => state.tasks);
  const kanbanReorder = useTaskStore((state) => state.kanbanReorder);

  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 }, // reliable click vs drag
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // All derived data is memoized → stable snapshots for useSyncExternalStore
  const activeTask = useMemo(() =>
    activeId ? tasks.find((t) => t.id === activeId) : null,
    [activeId, tasks]
  );

  const columns = useMemo(() => ([
    { status: "backlog" as TaskStatus, label: "Backlog" },
    { status: "todo" as TaskStatus, label: "Todo" },
    { status: "doing" as TaskStatus, label: "Doing" },
    { status: "done" as TaskStatus, label: "Done" },
  ] as const), []);

  const columnsWithTasks = useMemo(() => {
    return columns.map((col) => ({
      ...col,
      tasks: tasks.filter((t) => t.status === col.status),
    }));
  }, [columns, tasks]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over || active.id === over.id) return;
    // All logic + persist lives in the solid store.kanbanReorder (optimistic + hybrid)
    kanbanReorder(String(active.id), String(over.id));
  };

  const handleDragCancel = () => setActiveId(null);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="kanban-board flex md:grid md:grid-cols-4 gap-4 overflow-x-auto snap-x snap-mandatory pb-2 -mx-1 px-1 md:mx-0 md:px-0 md:overflow-visible touch-pan-x">
        {columnsWithTasks.map((col) => (
          <KanbanColumn 
            key={col.status} 
            col={col} 
            tasks={col.tasks} 
            onOpenTask={onOpenTask} 
          />
        ))}
      </div>

      <DragOverlay dropAnimation={{ duration: 160, easing: "cubic-bezier(0.23, 1, 0.32, 1)" }}>
        {activeTask ? (
          <div className="glass rounded-xl p-3.5 border border-white/10 shadow-2xl scale-[1.02] rotate-[0.5deg]">
            <div className="flex justify-between items-start gap-2">
              <div className="font-medium text-sm leading-tight">{activeTask.title}</div>
              <div className={`priority-badge priority-${activeTask.priority.toLowerCase()} shrink-0`}>{activeTask.priority}</div>
            </div>
            {activeTask.dueDate && (
              <div className="mt-2 text-[11px] text-[#71717a]">
                {formatDueDate(activeTask.dueDate)?.label}
              </div>
            )}
            <div className="mt-1.5 text-[9px] text-[#c084fc] font-mono tracking-widest opacity-70">DRAGGING</div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

export default function BadAssTasks() {
  const {
    tasks,
    notes,
    currentWorkspace,
    workspaces,
    recentActivity,
    currentView,
    taskFilter,
    selectedTaskId,
    isCommandPaletteOpen,
    isInitializing,
    user,
    isAuthLoading,
    initializeAuth,
    signOut,
    setView,
    setTaskFilter,
    selectTask,
    toggleCommandPalette,
    toggleKeyboardCheatsheet,
    isKeyboardCheatsheetOpen,
    addTask,
    updateTask,
    deleteTask,
    completeTask,
    taskLoadingStates,
    getFilteredTasks,
    getTodayTasks,
    switchWorkspace,
    addNote,
    updateNote,
    deleteNote,
    createWorkspace,
    refreshRecentActivity,
    // Offline / sync (Agent 17 mobile polish — exposed from hybrid + store)
    isOnline,
    isSyncing,
    pendingSyncCount,
    lastSyncAt,
    syncPendingWrites,
    refreshOfflineStatus,
    // Phase 2 collab
    members,
    invites,
    onlineUsers,
    isLoadingMembers,
    fetchMembers,
    fetchInvites,
    sendInvite,
    acceptInviteLink,
    changeMemberRole,
    removeWorkspaceMember,
    revokeInvite,
    resendInvite,
    declineReceivedInvite,
    updateWorkspaceDetails,
    deleteCurrentWorkspace,
    updateMyProfile, // self name + location profile editing
    searchPotentialTeammates, // new backend search for name/username/city in empty owner invite state
    setupWorkspaceRealtime,
    // Agent 14 realtime presence polish
    updatePresenceMeta,
    // Agent 30 live collab polish
    remoteCursors,
    updateCursorPosition,
    clearCursorPosition,
    activeConflicts,
    resolveConflict,
    // Live collab (lightweight broadcast)
    liveEditing,
    broadcastLiveNoteContent,
    // Agent 31 notifications
    notifications,
    unreadNotifCount,
    isLoadingNotifications,
    fetchNotifications,
    markNotifRead,
    markAllNotifsRead,
    refreshUnreadCount,
    deleteNotification,
    clearAllNotifications,
    notificationPrefs,
    updateNotificationPrefs,
  } = useTaskStore();

  // Derive pending *received* workspace invites for the current user from the centralized notifications store.
  // This replaces the previous fragile direct-query + undefined-supabase pattern. Since fetchNotifications
  // now pulls ALL notifs for the user (cross-ws) and auto-runs on login/ws init, the banner + bell
  // will correctly surface specific "X invited you to Y" data as soon as the sender creates the invite
  // (once the notifications INSERT RLS policy allows pre-membership targets).
  const pendingReceivedInvites = (notifications || []).filter((n: any) => n.type === 'invite' && !n.readAt);
  const hasPendingReceivedInvites = pendingReceivedInvites.length;

  // Role/permission flags — hoisted early so they are available before any useEffect
  // or logic that depends on them. (The old `isEmptyOwnerState` identifier has been fully
  // inlined to eliminate all TDZ risk.)
  const myRole = currentWorkspace.role;
  const canManage = ["owner", "admin"].includes(myRole);
  const isLiveWorkspace = isSupabaseConfigured() && !["w1", "w2"].includes(currentWorkspace.id);
  const isDemoWs = ["w1", "w2"].includes(currentWorkspace.id);
  const isSingleOwnerWorkspace = myRole === 'owner' && members.length <= 1 && isLiveWorkspace && !isDemoWs;

  const [showAddInput, setShowAddInput] = useState(false);
  const [quickAddValue, setQuickAddValue] = useState("");
  const [confettiTrigger, setConfettiTrigger] = useState(0);
  const [kanbanView, setKanbanView] = useState<"list" | "board">("list");
  const [showWorkspaceMenu, setShowWorkspaceMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showFullTaskModal, setShowFullTaskModal] = useState(false);
  const [showAIChat, setShowAIChat] = useState(false);

  // Refs for outside click detection
  const workspaceMenuRef = React.useRef<HTMLDivElement>(null);
  const notificationsRef = React.useRef<HTMLDivElement>(null);
  // Notification detail modal (opened from bell dropdown clicks for better readability + actions)
  const [selectedNotification, setSelectedNotification] = useState<any>(null);
  // Workspace creation UI state (inline in switcher dropdown — production real DB)
  const [isCreatingWorkspace, setIsCreatingWorkspace] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [isCreatingLoading, setIsCreatingLoading] = useState(false);
  const [isRefreshingActivity, setIsRefreshingActivity] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Modern confirmation modals state
  const [pendingDeleteWorkspace, setPendingDeleteWorkspace] = useState(false);
  const [pendingDeleteNote, setPendingDeleteNote] = useState<string | null>(null);
  const [pendingRemoveMember, setPendingRemoveMember] = useState<{ userId: string; label: string } | null>(null);
  const [pendingRevokeInvite, setPendingRevokeInvite] = useState<{ inviteId: string; label: string } | null>(null);
  const [pendingResendInvite, setPendingResendInvite] = useState<{ inviteId: string; label: string } | null>(null);
  const [pendingLeaveWorkspace, setPendingLeaveWorkspace] = useState(false);

  const handleConfirmRemoveMember = async () => {
    if (!pendingRemoveMember) return;
    await removeWorkspaceMember(pendingRemoveMember.userId);
    setPendingRemoveMember(null);
  };

  const handleConfirmDeleteWorkspace = async () => {
    if (myRole !== "owner") return;
    if (deleteConfirmName.trim() !== currentWorkspace.name) {
      toast.error("Type the exact workspace name to confirm deletion");
      setPendingDeleteWorkspace(false);
      return;
    }
    const ok = await deleteCurrentWorkspace();
    if (ok) {
      setShowWorkspaceSettings(false);
      setDeleteConfirmName("");
    }
    setPendingDeleteWorkspace(false);
  };

  const handleConfirmDeleteNote = async () => {
    if (!pendingDeleteNote) return;
    await deleteNote(pendingDeleteNote);
    setPendingDeleteNote(null);
  };

  const handleConfirmLeaveWorkspace = async () => {
    if (!currentWorkspace.id) return;
    await exitWorkspace(currentWorkspace.id);
    setPendingLeaveWorkspace(false);
  };

  // Final cleanup for any remaining raw confirms in this file will be done in follow-up if needed.

  // Close dropdowns when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (workspaceMenuRef.current && !workspaceMenuRef.current.contains(event.target as Node)) {
        setShowWorkspaceMenu(false);
      }
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);

  // Client-only state for the mobile sync indicator to prevent hydration mismatch.
  // These values can differ between server render and client (navigator.onLine + queue rehydration).
  const [syncDisplay, setSyncDisplay] = useState({
    isOnline: true,
    isSyncing: false,
    pendingSyncCount: 0,
  });

  // Pull-to-refresh state (Agent 27 mobile native)
  const [isPullRefreshing, setIsPullRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);

  // Phase 2 collaboration UI state (inline, no new files)
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"owner" | "admin" | "user">("user");
  const [isSendingInvite, setIsSendingInvite] = useState(false);
  const [copiedInviteId, setCopiedInviteId] = useState<string | null>(null);

  // New: Team search for Facebook-style "find friends" invites (used especially in empty owner state)
  const [teamSearchQuery, setTeamSearchQuery] = useState("");
  const [teamSearchResults, setTeamSearchResults] = useState<any[]>([]);
  const [isSearchingTeam, setIsSearchingTeam] = useState(false);
  const [showDirectInvite, setShowDirectInvite] = useState(false);
  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null); // debounce for real RPC search (name/username/city)
  const hasFetchedInvitesForEmptyState = useRef(false);

  // Reset the one-time fetch flag when leaving the empty owner state.
  // Inlined calc (using earlier-declared myRole/members/etc) removes 'isEmptyOwnerState' identifier
  // from all hook call sites + deps arrays. This eliminates TDZ risk (declaration at 379 now only
  // referenced in late render code inside renderTeamsView if at 2216) for RSC/client + source order.
  useEffect(() => {
    const isEmpty = myRole === 'owner' && members.length <= 1 && isLiveWorkspace && !isDemoWs;
    if (!isEmpty) {
      hasFetchedInvitesForEmptyState.current = false;
    }
  }, [myRole, members, isLiveWorkspace, isDemoWs]);

  // One-time fetch of pending *sent* invites when entering the special empty-owner invite view.
  useEffect(() => {
    const isEmpty = myRole === 'owner' && members.length <= 1 && isLiveWorkspace && !isDemoWs;
    if (isEmpty && !hasFetchedInvitesForEmptyState.current) {
      hasFetchedInvitesForEmptyState.current = true;
      fetchInvites();
    }
  }, [myRole, members, isLiveWorkspace, isDemoWs, fetchInvites]);

  // NOTE: Removed previous local hasPendingReceivedInvites + broken supabase query effect.
  // Recipient pending invites are now derived directly from the centralized store.notifications
  // (auto-fetched on init/switch for live users, cross-ws so invites always visible in bell + banner).

  // Workspace settings (owner-only modal for name/slug/delete) - small addition for E03
  const [showWorkspaceSettings, setShowWorkspaceSettings] = useState(false);
  const [settingsName, setSettingsName] = useState("");
  const [settingsSlug, setSettingsSlug] = useState("");
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");

  // User profile self-edit (full name, username/handle, location). Triggered from top-right pill + Teams view.
  const [profileFullName, setProfileFullName] = useState("");
  const [profileUsername, setProfileUsername] = useState("");
  const [profileLocation, setProfileLocation] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [showProfilePopover, setShowProfilePopover] = useState(false);

  // Agent 28: Polished owner/admin-only Admin Dashboard (tabbed, powerful, delightful)
  // Lives inside Teams view (gated by canManage) + reuses Workspace Settings for core owner actions.
  // All paths respect live/demo + role guards from hybrid + store.
  const [adminTab, setAdminTab] = useState<'overview' | 'exports' | 'imports' | 'templates' | 'insights'>('overview');
  const [importStrategy, setImportStrategy] = useState<'append' | 'skip-dupe-titles'>('skip-dupe-titles');
  const [importPreview, setImportPreview] = useState<{ tasks: number; notes: number; source: string } | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [insights, setInsights] = useState<any>(null);
  const [isLoadingInsights, setIsLoadingInsights] = useState(false);

  // Agent 32: Semantic Search + Knowledge Graph state (delightful discovery, no new files for core)
  const [isGraphOpen, setIsGraphOpen] = useState(false);
  const [graphFocusId, setGraphFocusId] = useState<string | null>(null);
  const [globalSearchQuery, setGlobalSearchQuery] = useState("");
  const [searchResultType, setSearchResultType] = useState<'all' | 'task' | 'note'>('all');

  // PWA foundation: install prompt + service worker registration (mobile-first, demo safe)
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);

  // Calendar state (Agent 8 — beautiful interactive month/week/timeline + drag reschedule)
  const [calendarMonth, setCalendarMonth] = useState<Date>(() => startOfMonth(new Date()));
  const [calendarMode, setCalendarMode] = useState<"month" | "week" | "timeline">("month");

  // Perf: memoize expensive filter + sort (large task lists, frequent re-renders from DnD/state)
  // Note: getFilteredTasks is stable from Zustand but computation is non-trivial.
  const filteredTasks = useMemo(() => getFilteredTasks(), [getFilteredTasks, tasks, taskFilter]);
  const selectedTask = tasks.find((t) => t.id === selectedTaskId);

  // Today view derived data — computed client-side only to prevent hydration mismatch
  // (getTodayTasks uses new Date() which differs between server and client)
  const [todayTasks, setTodayTasks] = useState<Task[]>([]);
  const [activeTaskCount, setActiveTaskCount] = useState(0);

  useEffect(() => {
    setTodayTasks(getTodayTasks());
    setActiveTaskCount(tasks.filter((t) => t.status !== "done").length);
  }, [tasks]);
  // selectedNote removed (was only for legacy renderNoteDetail modal; rich detail now inline in Notes view)

  // Initialize auth + real data from Supabase when available.
  // Post-login: initializeAuth sets listener which calls ensureUserHasWorkspace() + initFrom for bootstrap (real ws + no demo pollution).
  useEffect(() => {
    const store = useTaskStore.getState();
    store.initializeAuth();
    store.initializeFromSupabase();
  }, []);

  // Ensure notifications (including cross-workspace invites) are loaded early for the recipient banner + bell badge.
  // The store now auto-fetches on init/switch, but we also kick it here once we have a live user so the global
  // "you were invited" banner appears immediately without requiring the user to open the bell first.
  useEffect(() => {
    if (user && isSupabaseConfigured()) {
      // Fire-and-forget; the store will populate the notifications array which drives the banner.
      fetchNotifications?.(false).catch(() => {});
    }
  }, [user]);

  // Phase 2: Handle invite link accept via URL param (?invite=UUID) - works post-login or triggers auth
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const inviteToken = params.get("invite");
    if (inviteToken && user && isSupabaseConfigured()) {
      // Auto-accept and clean URL
      (async () => {
        const wsId = await acceptInviteLink(inviteToken);
        if (wsId) {
          // Clean the param from URL without reload
          const url = new URL(window.location.href);
          url.searchParams.delete("invite");
          window.history.replaceState({}, "", url.toString());
        }
      })();
    }
  }, [user, acceptInviteLink]);

  // Deep links for PWA shortcuts + shareable views (Agent 27): ?view=today|tasks|notes|calendar|teams
  // Initializes from manifest shortcuts (?view=...&source=pwa). Syncs on change for back/forward + share.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const urlView = params.get("view") as any;
    const validViews = VIEWS.map(v => v.id);
    if (urlView && validViews.includes(urlView) && urlView !== currentView) {
      setView(urlView);
    }
  }, []); // one-time init on mount

  // Keep URL in sync when view changes (replaceState, no history spam, works for PWA)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("view") !== currentView) {
      url.searchParams.set("view", currentView);
      // Keep other params like source=pwa or invite if present
      window.history.replaceState({}, "", url.toString());
    }
  }, [currentView]);

  // Pull-to-refresh for mobile lists (Today/Tasks/Notes). Threshold + haptic + optimistic refresh.
  // Uses passive touch on .main-content when near top. No new libs.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const isMobileNow = window.innerWidth < 768;
    if (!isMobileNow) return;

    let startY = 0;
    let isPulling = false;
    const mainEl = document.querySelector('.main-content') as HTMLElement | null;
    if (!mainEl) return;

    const handleTouchStart = (e: TouchEvent) => {
      if (mainEl.scrollTop > 8 || isPullRefreshing) return;
      isPulling = true;
      startY = e.touches[0].clientY;
    };
    const handleTouchMove = (e: TouchEvent) => {
      if (!isPulling) return;
      const dy = Math.max(0, e.touches[0].clientY - startY);
      setPullDistance(Math.min(dy, 70));
    };
    const handleTouchEnd = async () => {
      if (!isPulling) return;
      const dist = pullDistance;
      isPulling = false;
      const wasPulling = dist > 0;
      setPullDistance(0);
      if (dist > 52 && !isPullRefreshing) {
        setIsPullRefreshing(true);
        triggerHaptic('medium');
        try {
          if (refreshRecentActivity) {
            await refreshRecentActivity();
          }
          setTodayTasks(getTodayTasks());
          setActiveTaskCount(tasks.filter((t) => t.status !== "done").length);
          toast.success("Refreshed", { description: "Data and activity synced." });
        } catch {}
        setTimeout(() => setIsPullRefreshing(false), 350);
      }
    };

    mainEl.addEventListener('touchstart', handleTouchStart, { passive: true });
    mainEl.addEventListener('touchmove', handleTouchMove, { passive: true });
    mainEl.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      mainEl.removeEventListener('touchstart', handleTouchStart);
      mainEl.removeEventListener('touchmove', handleTouchMove);
      mainEl.removeEventListener('touchend', handleTouchEnd);
    };
  }, [pullDistance, isPullRefreshing, refreshRecentActivity, tasks]);

  // Keyboard shortcuts - reliable, input-aware, keyboard-first experience
  useEffect(() => {
    const isInputActive = () => {
      const el = document.activeElement as HTMLElement | null;
      if (!el) return false;
      const tag = el.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return true;
      if (el.isContentEditable) return true;
      if (el.closest("[data-cmdk-input]")) return true; // inside cmdk palette input
      return false;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const typing = isInputActive();
      const paletteOpen = isCommandPaletteOpen;

      // Always allow palette toggle (global power key)
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (isKeyboardCheatsheetOpen) toggleKeyboardCheatsheet(false);
        toggleCommandPalette();
        return;
      }

      // Quick add (⌘N) - only when not already typing in a field
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "n") {
        if (typing) return;
        e.preventDefault();
        setShowAddInput(true);
        setTimeout(() => {
          const input = document.getElementById("quick-add") as HTMLInputElement;
          input?.focus();
        }, 10);
        return;
      }

      // ? for keyboard cheatsheet (when not typing, not in palette)
      if (e.key === "?" && !e.metaKey && !e.ctrlKey && !e.shiftKey) {
        if (typing || paletteOpen) return;
        e.preventDefault();
        toggleKeyboardCheatsheet(true);
        return;
      }

      // View switching (1-5) - number keys only when safe (not typing, not palette, not in modals)
      if (!typing && !paletteOpen && !showAddInput && !showFullTaskModal && !showAuthModal && !isKeyboardCheatsheetOpen) {
        if (e.key === "1") { setView("today"); return; }
        if (e.key === "2") { setView("tasks"); return; }
        if (e.key === "3") { setView("notes"); return; }
        if (e.key === "4") { setView("calendar"); return; }
        if (e.key === "5") { setView("teams"); return; }
      }

      // Close modals / sheets (Escape always respected, layered)
      if (e.key === "Escape") {
        if (isKeyboardCheatsheetOpen) {
          toggleKeyboardCheatsheet(false);
          return;
        }
        if (showAIChat) {
          setShowAIChat(false);
          return;
        }
        if (showAuthModal) {
          setShowAuthModal(false);
          return;
        }
        if (showFullTaskModal) {
          setShowFullTaskModal(false);
          // keep selection for context panel
          return;
        }
        if (selectedTaskId) {
          selectTask(null);
          return;
        }
        if (selectedNoteId) {
          setSelectedNoteId(null);
          return;
        }
        if (showAddInput) {
          setShowAddInput(false);
          setQuickAddValue("");
          return;
        }
        setShowWorkspaceMenu(false);
        if (paletteOpen) {
          toggleCommandPalette(false);
        }
        return;
      }

      // Space to complete selected task (only when a task is selected and not typing)
      if (e.key === " " && selectedTaskId && !typing) {
        e.preventDefault();
        const task = tasks.find((t) => t.id === selectedTaskId);
        if (task && task.status !== "done") {
          handleComplete(task.id);
        }
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    selectedTaskId,
    selectedNoteId,
    tasks,
    toggleCommandPalette,
    toggleKeyboardCheatsheet,
    isCommandPaletteOpen,
    isKeyboardCheatsheetOpen,
    showAddInput,
    showFullTaskModal,
    showAuthModal,
    showAIChat,
    setView,
  ]);

  // Client-only sync display state to prevent hydration mismatch on the mobile sync indicator.
  // Values like isOnline / pendingSyncCount can differ between server render and client
  // (navigator.onLine + persisted queue rehydration).
  useEffect(() => {
    const updateSyncDisplay = () => {
      const { isOnline, isSyncing, pendingSyncCount } = useTaskStore.getState();
      setSyncDisplay({ isOnline, isSyncing, pendingSyncCount });
    };

    updateSyncDisplay();

    const unsubscribe = useTaskStore.subscribe((state) => {
      setSyncDisplay({
        isOnline: state.isOnline,
        isSyncing: state.isSyncing,
        pendingSyncCount: state.pendingSyncCount,
      });
    });

    const handleOnline = () => updateSyncDisplay();
    const handleOffline = () => updateSyncDisplay();

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      unsubscribe();
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // PWA: Register service worker for offline shell + handle beforeinstallprompt for native install experience.
  // Only runs in browser; safe in demo. On mobile it enables "Add to Home Screen" + offline.
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    // Register SW (non-blocking)
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        console.log('[PWA] SW registered for offline shell:', reg.scope);
      })
      .catch((err) => console.warn('[PWA] SW registration failed (dev ok):', err));

    // Install prompt capture (fires on eligible mobile Chrome/Edge/Safari etc.)
    const handleBeforeInstall = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallPrompt(true);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    // If already installed or not applicable, prompt won't fire.
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  // === STRICT AUTH GATE (addresses user requirement) ===
  // When Supabase env keys are present, the app must NEVER render the productivity UI,
  // workspace switcher, or the "LIVE" badge until a real user is authenticated.
  // This was the root cause of the previous misleading experience (LIVE badge + full
  // creation UI visible, but no user_id/workspace_id so nothing persisted).
  const isConfigured = isSupabaseConfigured();
  const isTrulyLive = isConfigured && !!user;
  const showLandingGate = isConfigured && !user && !isAuthLoading;

  const handleInstallApp = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        toast.success("Thanks for installing!", { description: "Bad Ass Tasks is now on your home screen." });
      }
      setDeferredPrompt(null);
      setShowInstallPrompt(false);
      return;
    }
    // Persistent fallback (no beforeinstallprompt or after dismiss) — common on iOS Safari etc.
    triggerHaptic('light');
    toast.info("Add to Home Screen", {
      description: "Tap the Share button in your browser → 'Add to Home Screen' (or 'Install App'). Works great as PWA with offline support!",
      duration: 8000,
    });
  };

  const handleQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickAddValue.trim()) return;

    const res = await addTask(quickAddValue);
    if (!res) {
      toast.error("Failed to create task", { description: "Please try again." });
      return;
    }
    const newTask = res;
    
    toast.success("Task captured", {
      description: newTask.title,
      action: {
        label: "Open",
        onClick: () => selectTask(newTask.id),
      },
    });

    setQuickAddValue("");
    setShowAddInput(false);
    setView("tasks");
  };

  const handleComplete = async (id: string) => {
    triggerHaptic('success');
    const task = tasks.find((t) => t.id === id);
    if (!task || task.status === "done" || taskLoadingStates?.[id]) return;

    // Recurring engine integration (Agent 8): auto-advance due date instead of marking done
    // Keeps the task alive and actionable. Full series/exception support in future engine phase.
    if (task.recurringRule) {
      const next = getNextRecurringDue(task.recurringRule, new Date(), task.dueDate, task.exceptionDates);
      if (next) {
        await updateTask(id, { dueDate: next.toISOString() }); // Do NOT complete — advance the anchor (skips exceptions)
        toast.success("Recurrence advanced", {
          description: `${task.title} → next due ${format(next, "MMM d")}`,
        });
        return;
      }
    }

    // Normal non-recurring path
    await completeTask(id);
    setConfettiTrigger((c) => c + 1);

    toast.success("Task completed", {
      description: task.title,
      action: {
        label: "Undo",
        onClick: async () => {
          await updateTask(id, { status: "todo", completedAt: undefined });
        },
      },
    });
  };

  const handleAddFromNatural = async () => {
    const input = prompt("What needs to get done?\n\nExamples:\n• Finish proposal by Friday P1\n• Call mom tomorrow @personal\n• Ship landing page P0");
    if (input) {
      const res = await addTask(input);
      if (!res) {
        toast.error("Failed to create task", { description: "Please try again." });
        return;
      }
      const task = res;
      toast.success(`Added: ${task.title}`);
      setView("tasks");
    }
  };

  // Handler to create additional workspace (real DB via RPC when live; demo safe). Production ready.
  const handleCreateWorkspace = async () => {
    const name = newWorkspaceName.trim();
    if (!name) {
      toast.error("Please enter a workspace name");
      return;
    }
    setIsCreatingLoading(true);
    try {
      const created = await createWorkspace(name);
      if (created) {
        // Success path: store already toasts + switches + reloads data. Clean up local UI.
        setNewWorkspaceName("");
        setIsCreatingWorkspace(false);
        setShowWorkspaceMenu(false);
      }
    } finally {
      setIsCreatingLoading(false);
    }
  };

  // Workspace settings handlers (owner-only; small self-contained modal)
  const openWorkspaceSettings = () => {
    if (myRole !== "owner") {
      toast.error("Only owners can access workspace settings");
      return;
    }
    setSettingsName(currentWorkspace.name);
    setSettingsSlug(currentWorkspace.slug);
    setDeleteConfirmName("");
    setShowWorkspaceSettings(true);
    setShowWorkspaceMenu(false);
  };

  const handleSaveWorkspaceSettings = async () => {
    if (myRole !== "owner") return;
    setIsSavingSettings(true);
    try {
      const updates: { name?: string; slug?: string } = {};
      if (settingsName.trim() && settingsName.trim() !== currentWorkspace.name) updates.name = settingsName.trim();
      if (settingsSlug.trim() && settingsSlug.trim() !== currentWorkspace.slug) updates.slug = settingsSlug.trim();
      if (Object.keys(updates).length === 0) {
        setShowWorkspaceSettings(false);
        return;
      }
      const ok = await updateWorkspaceDetails(updates);
      if (ok) {
        setShowWorkspaceSettings(false);
      }
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleDeleteWorkspace = () => {
    if (myRole !== "owner") return;
    if (deleteConfirmName.trim() !== currentWorkspace.name) {
      toast.error("Type the exact workspace name to confirm deletion");
      return;
    }
    // Trigger the modern confirmation modal
    setPendingDeleteWorkspace(true);
  };

  // Production activity log panel support: manual refresh wired to real hybrid getRecentActivity
  const handleRefreshActivity = async () => {
    if (!refreshRecentActivity) return;
    setIsRefreshingActivity(true);
    try {
      await refreshRecentActivity();
      toast.success("Activity refreshed", { description: "Latest events from current workspace." });
    } finally {
      setIsRefreshingActivity(false);
    }
  };

  const openTask = (task: Task) => {
    selectTask(task.id);
    setShowFullTaskModal(true);
  };

  const renderTaskRow = (task: Task) => {
    const due = formatDueDate(task.dueDate);
    const isDone = task.status === "done";
    const isOpLoading = !!taskLoadingStates?.[task.id];

    // Keyboard + screen reader support for primary task list items (WCAG AA: operable, named, keyboard accessible)
    const handleTaskRowKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openTask(task);
      }
    };

    // Swipe-to-complete gesture (mobile native delight): left swipe completes (with reveal + haptic + undo toast).
    // Uses framer-motion (already in project) + our .swipe-* CSS. Desktop unaffected.
    const swipeThreshold = 120;

    const handleSwipeEnd = (_e: any, info: any) => {
      if (isDone || isOpLoading) return;
      const offsetX = info.offset?.x || 0;
      const velocityX = info.velocity?.x || 0;
      if (offsetX < -swipeThreshold || velocityX < -800) {
        // Left swipe = complete
        triggerHaptic('success');
        handleComplete(task.id);
      } else if (offsetX > swipeThreshold || velocityX > 800) {
        // Right swipe = quick action: cycle priority (native delight, no modal needed)
        triggerHaptic('medium');
        const prioCycle: Priority[] = ["P0", "P1", "P2", "P3"];
        const currentIdx = prioCycle.indexOf(task.priority);
        const nextPrio = prioCycle[(currentIdx + 1) % prioCycle.length];
        updateTask(task.id, { priority: nextPrio });
        toast.success(`Priority → ${nextPrio}`, { description: task.title });
      }
    };

    return (
      <div key={task.id} className="swipe-container relative rounded-xl overflow-hidden mb-1">
        {/* Reveal backgrounds (visible during drag) */}
        <div className="swipe-action-bg complete" aria-hidden="true">
          <Check className="h-5 w-5 mr-2" /> COMPLETE
        </div>
        <div className="swipe-action-bg actions" aria-hidden="true">
          ACTIONS <ArrowUpRight className="h-4 w-4 ml-1" />
        </div>

        <motion.div
          drag="x"
          dragConstraints={{ left: -160, right: 120 }}
          dragElastic={0.2}
          onDragEnd={handleSwipeEnd}
          whileTap={{ scale: 0.995 }}
          className={cn(
            "task-row group flex items-center gap-4 px-5 py-3.5 rounded-xl border border-transparent cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#c084fc]/50 bg-[var(--bg-card)] relative z-10",
            isDone && "completed"
          )}
          role="button"
          tabIndex={0}
          aria-label={`Task: ${task.title}${isDone ? " (completed)" : ""}${due ? `, due ${due.label}` : ""}. Swipe left to complete.`}
          onClick={() => openTask(task)}
          onKeyDown={handleTaskRowKeyDown}
          style={{ touchAction: 'pan-y' }} // vertical scroll ok, horizontal captured by drag
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (!isOpLoading && !isDone) {
                triggerHaptic('success');
                handleComplete(task.id);
              }
            }}
            disabled={isOpLoading || isDone}
            className={cn(
              "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-all active:scale-90 disabled:opacity-60",
              isDone 
                ? "bg-[#00ff9f] border-[#c084fc] text-black" 
                : "border-[#3a3a42] hover:border-[#c084fc] group-hover:border-[#c084fc]/70"
            )}
            aria-label={isDone ? "Completed" : isOpLoading ? "Updating task" : "Mark complete"}
          >
            {isOpLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : isDone ? (
              <Check className="h-3.5 w-3.5" />
            ) : null}
          </button>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3">
              <div className={cn("task-title font-medium text-[15px] truncate", isDone && "line-through")}>
                {task.title}
              </div>
              <div className={`priority-badge priority-${task.priority.toLowerCase()}`}>
                {task.priority}
              </div>
              {task.recurringRule && (
                <span className="recurring-badge text-[10px] px-1.5 py-px rounded bg-[#c084fc]/10 text-[#c084fc] border border-[#c084fc]/30 font-medium flex items-center gap-0.5" title={getRecurringLabel(task.recurringRule)}>
                  ↻ {getRecurringLabel(task.recurringRule).split(" ")[0]}
                </span>
              )}
              {/* Agent 14: cross-client editing indicator on task row (who has it open/selected) */}
              {(() => {
                const editors = (onlineUsers || []).filter((u: any) => u.editingItemId === task.id && u.editingItemType === 'task' && u.userId !== user?.id);
                if (editors.length === 0) return null;
                return <span className="text-[9px] text-[#00ff9f] ml-1 font-mono" title={`Editing: ${editors.map((e:any)=>e.email||e.userId?.slice(0,6)).join(', ')}`}>✎{editors.length}</span>;
              })()}
            </div>
            {task.description && (
              <div className="text-xs text-[#71717a] mt-0.5 line-clamp-1">{task.description}</div>
            )}
          </div>

          <div className="flex items-center gap-3 text-sm">
            {task.tags.length > 0 && (
              <div className="hidden md:flex gap-1.5">
                {task.tags.slice(0, 2).map((tag) => (
                  <span key={tag} className="text-[10px] px-2 py-px rounded bg-white/5 text-[#a1a1aa]">{tag}</span>
                ))}
              </div>
            )}

            {task.assignee && (
              <div className="text-[#71717a] text-xs hidden sm:block">{task.assignee}</div>
            )}

            {due && (
              <div className={cn(
                "due-badge text-xs font-medium",
                due.variant === "overdue" && "due-overdue",
                due.variant === "today" && "due-today",
                due.variant === "soon" && "due-soon"
              )}>
                {due.label}
              </div>
            )}

            <div className="text-[#71717a] text-xs font-mono w-14 text-right hidden lg:block">
              {task.timeEstimate ? `${task.timeEstimate}m` : ""}
            </div>
          </div>
        </motion.div>
      </div>
    );
  };

  // Old button-based Kanban removed — replaced by real @dnd-kit implementation (see KanbanBoard + store.kanbanReorder above)

  const renderTodayView = () => (
    <div className="max-w-4xl mx-auto pt-8">
      <div className="mb-8">
        <div className="text-[#c084fc] text-sm font-semibold tracking-[3px] mb-1">GOOD MORNING, ALEX</div>
        <div className="flex items-center gap-3">
          <div className="text-5xl font-semibold tracking-tighter">What matters today?</div>
          <button
            onClick={async () => {
              const realMode = isXAIConfigured();
              const b = realMode 
                ? await generateDailyBriefingAI(tasks, notes, recentActivity)
                : generateDailyBriefing(tasks, notes, recentActivity);
              toast.success(realMode ? `xAI Grok: ${b.greeting}` : b.greeting, {
                description: `${b.focusSuggestion} • ${b.stats.p0Count} P0s • ${b.stats.dueToday} due`,
                duration: 7000,
              });
            }}
            className="ml-2 text-xs px-3 py-1.5 rounded-full border border-[#ff00aa]/40 text-[#ff00aa] hover:bg-[#ff00aa]/10 flex items-center gap-1"
            title="Generate smart AI daily briefing from your live data (real xAI when configured)"
          >
            <Sparkles className="h-3.5 w-3.5" /> AI Briefing
          </button>
          <button
            onClick={async () => {
              const realMode = isXAIConfigured();
              const w = realMode 
                ? await generateWeeklyBriefingAI(tasks, notes, recentActivity) as any
                : generateWeeklyBriefing(tasks, notes, recentActivity) as any;
              toast.success(realMode ? `xAI Grok: ${w.greeting}` : w.greeting, {
                description: `${w.focusSuggestion} • ${w.weekActions?.[0] || ""} • Trend: ${w.trend || ""}`,
                duration: 8000,
              });
            }}
            className="ml-1 text-xs px-2.5 py-1.5 rounded-full border border-[#c084fc]/40 text-[#c084fc] hover:bg-[#c084fc]/10 flex items-center gap-1"
            title="Generate AI weekly briefing with actionable insights"
          >
            Weekly
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="glass rounded-3xl p-6">
          <div className="text-[#71717a] text-sm">Due today or overdue</div>
          <div className="text-6xl font-semibold tabular-nums mt-2 text-[#ff3366]">{todayTasks.length}</div>
          <div className="text-sm mt-1 text-[#a1a1aa]">Focus here first</div>
        </div>
        <div className="glass rounded-3xl p-6">
          <div className="text-[#71717a] text-sm">Active tasks</div>
          <div className="text-6xl font-semibold tabular-nums mt-2">{activeTaskCount}</div>
          <div className="flex items-center gap-2 mt-2 text-[#c084fc] text-sm">
            <Zap className="h-4 w-4" /> 3 high priority
          </div>
        </div>
        <div className="glass rounded-3xl p-6 flex flex-col justify-between">
          <div>
            <div className="text-[#71717a] text-sm">Focus score</div>
            <div className="text-6xl font-semibold tabular-nums mt-1">87</div>
          </div>
          <div className="text-[#c084fc] text-sm mt-4">+12 from yesterday. You're in flow.</div>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="font-semibold">Today's Priorities</div>
          <button onClick={() => setView("tasks")} className="text-xs text-[#c084fc] flex items-center gap-1 hover:underline">
            SEE ALL <ArrowUpRight className="h-3 w-3" />
          </button>
        </div>
        <div className="space-y-1">
          {todayTasks.length > 0 ? (
            todayTasks.slice(0, 5).map(renderTaskRow)
          ) : (
            <div className="text-center py-12 text-[#71717a]">Nothing due today. You are clear.</div>
          )}
        </div>
      </div>
    </div>
  );

  const renderTasksView = () => (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="text-3xl font-semibold tracking-tight">Tasks</div>
          <div className="text-[#71717a] text-sm mt-1">{filteredTasks.length} tasks • {tasks.filter(t => t.status !== "done").length} open</div>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={() => setKanbanView("list")} 
            className={cn("px-4 py-1.5 text-sm rounded-full transition", kanbanView === "list" ? "bg-white/10" : "hover:bg-white/5")}
          >
            List
          </button>
          <button 
            onClick={() => setKanbanView("board")} 
            className={cn("px-4 py-1.5 text-sm rounded-full transition", kanbanView === "board" ? "bg-white/10" : "hover:bg-white/5")}
          >
            Board
          </button>
          <button onClick={handleAddFromNatural} className="btn btn-secondary ml-2 text-sm px-4">
            <Plus className="h-4 w-4" /> Natural add
          </button>
        </div>
      </div>

      {/* Agent 32: Upgraded hybrid semantic global search + filters (replaces basic; drives results + graph) */}
      <div className="flex flex-col gap-2 mb-4">
        <div className="flex gap-2 items-center">
          <input
            value={globalSearchQuery}
            onChange={(e) => {
              setGlobalSearchQuery(e.target.value);
              // Keep legacy filter in sync for list compatibility
              setTaskFilter({ search: e.target.value });
            }}
            placeholder="Search tasks, notes, tags... (hybrid semantic: keywords + meaning + links)"
            className="input flex-1 px-4 py-2.5 rounded-2xl text-sm"
          />
          <button
            onClick={() => setIsGraphOpen(true)}
            className="btn btn-secondary px-3 py-2 text-sm flex items-center gap-1.5 border-[#c084fc]/40 hover:border-[#c084fc]"
            title="Open interactive Knowledge Graph (visual links + suggestions)"
          >
            <Network className="h-4 w-4" /> Graph
          </button>
        </div>
        {/* Quick type filters + clear */}
        <div className="flex gap-1.5 flex-wrap text-[10px]">
          {(['all','task','note'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setSearchResultType(t)}
              className={cn(
                "px-2.5 py-0.5 rounded-full border transition",
                searchResultType === t ? "bg-[#c084fc] text-black border-[#c084fc]" : "border-white/10 hover:bg-white/5 text-[#a1a1aa]"
              )}
            >
              {t === 'all' ? 'All' : t === 'task' ? 'Tasks' : 'Notes'}
            </button>
          ))}
          <button onClick={() => { setGlobalSearchQuery(""); setTaskFilter({ search: "" }); setSearchResultType('all'); }} className="px-2 py-0.5 text-[#71717a] hover:text-white">Clear</button>
          <span className="ml-auto text-[#71717a]/70 self-center">Hybrid semantic + graph links</span>
        </div>
      </div>

      {/* Agent 13: Recurring-aware filter chips (affects lists + today; calendar uses engine directly) */}
      <div className="flex gap-1 mb-3 text-[10px]">
        {(["all", "only", "none"] as const).map((mode) => (
          <button
            key={mode}
            onClick={() => setTaskFilter({ recurring: mode === "all" ? undefined : mode })}
            className={cn(
              "px-2 py-0.5 rounded-full border transition",
              (mode === "all" && !taskFilter.recurring) || taskFilter.recurring === mode
                ? "bg-[#c084fc] text-black border-[#c084fc]"
                : "border-white/10 hover:bg-white/5 text-[#a1a1aa]"
            )}
          >
            {mode === "all" ? "All tasks" : mode === "only" ? "Recurring only" : "Non-recurring"}
          </button>
        ))}
      </div>

      {/* Agent 32: Live hybrid semantic results (when global query active) — delightful ranked cards with quick actions */}
      {globalSearchQuery.trim().length > 1 && (() => {
        const hybrid = getHybridSearchResults(globalSearchQuery, { tasks, notes }, { 
          types: searchResultType === 'all' ? ['task','note'] : [searchResultType], 
          limit: 12 
        });
        if (hybrid.length === 0) return null;
        return (
          <div className="mb-4 glass rounded-2xl p-3 border border-[#c084fc]/20">
            <div className="flex items-center justify-between mb-2 px-1">
              <div className="text-xs font-semibold tracking-widest text-[#c084fc]">SEMANTIC RESULTS • {hybrid.length} matches</div>
              <button onClick={() => setIsGraphOpen(true)} className="text-[10px] text-[#c084fc] hover:underline flex items-center gap-1">View in Graph <Network className="h-3 w-3"/></button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {hybrid.map((r) => (
                <div 
                  key={r.id} 
                  onClick={() => {
                    if (r.type === 'task') {
                      setView("tasks"); selectTask(r.id); setShowFullTaskModal(true);
                    } else {
                      setView("notes"); setSelectedNoteId(r.id);
                    }
                  }}
                  className="group p-2.5 rounded-xl border border-white/10 hover:border-[#c084fc]/40 bg-white/5 cursor-pointer flex gap-2 text-sm"
                >
                  <div className="mt-0.5">{r.type === 'task' ? <Check className="h-4 w-4 text-[#c084fc]" /> : <Star className="h-4 w-4 text-[#00ff9f]" />}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate group-hover:text-[#c084fc]">{r.title}</div>
                    <div className="text-[10px] text-[#71717a] truncate">{r.snippet}</div>
                    <div className="text-[9px] mt-0.5 text-[#c084fc]/70 font-mono">{r.score}% • {r.reasons.join(' ')}</div>
                  </div>
                  <button 
                    onClick={(e) => { e.stopPropagation(); setIsGraphOpen(true); setGraphFocusId(r.id); }}
                    className="self-start text-[9px] px-1.5 py-0.5 rounded bg-white/10 opacity-60 group-hover:opacity-100"
                  >Graph</button>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {kanbanView === "list" ? (
        <div className="space-y-1">
          {filteredTasks.length > 0 ? filteredTasks.map(renderTaskRow) : (
            <div className="text-center py-16 text-[#71717a]">No tasks match your filters.</div>
          )}
        </div>
      ) : (
        <KanbanBoard onOpenTask={openTask} />
      )}
    </div>
  );

  const renderNotesView = () => {
    return <div className="p-8 text-center text-[#71717a]">Notes view temporarily stubbed for syntax debugging.</div>;
  };
  /* =====================================================================
     World-class Calendar + Recurring + Drag-to-reschedule (Agent 8 + Agent 25 Production Polish)
     - Month / Week / Timeline views with virtual recurring instances (engine powered, exceptions honored)
     - Intelligent drag: series anchor OR "this occurrence only" (skip + one-off duplicate)
     - Skip × on instance chips + full exception management
     - End conditions (COUNT/UNTIL) surfaced in labels + calendar
     - Uses generateRecurringInstances + getRecurrenceEndDescription for rich display
     - Perf: bounded gen, suitable for large sets. Strict demo/live separation.
     - Feels like Linear/Notion for recurring work.
  ===================================================================== */
  const renderCalendarView = () => {
    const today = new Date();

    // Compute visible range for current mode
    let viewStart: Date;
    let viewEnd: Date;
    let days: Date[] = [];

    if (calendarMode === "month") {
      const monthStart = startOfMonth(calendarMonth);
      const monthEnd = endOfMonth(calendarMonth);
      viewStart = startOfWeek(monthStart, { weekStartsOn: 0 });
      viewEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
      days = eachDayOfInterval({ start: viewStart, end: viewEnd });
    } else if (calendarMode === "week") {
      viewStart = startOfWeek(calendarMonth, { weekStartsOn: 0 });
      viewEnd = endOfWeek(calendarMonth, { weekStartsOn: 0 });
      days = eachDayOfInterval({ start: viewStart, end: viewEnd });
    } else {
      // Timeline: 4 weeks around current
      viewStart = startOfWeek(subWeeks(calendarMonth, 1), { weekStartsOn: 0 });
      viewEnd = endOfWeek(addWeeks(calendarMonth, 2), { weekStartsOn: 0 });
      days = eachDayOfInterval({ start: viewStart, end: viewEnd });
    }

    // Build map of dateKey -> tasks/instances visible that day (incl. recurring projections)
    const dateKey = (d: Date) => format(startOfDay(d), "yyyy-MM-dd");
    const dayMap: Record<string, { task: Task; isRecurringInstance: boolean; occurrenceDate: Date }[]> = {};

    tasks.forEach((task) => {
      if (task.status === "done" && !task.recurringRule) return; // hide done non-recurring

      const anchor = task.dueDate;
      const isRecurring = !!task.recurringRule;

      if (!isRecurring && anchor) {
        const dueD = startOfDay(new Date(anchor));
        if (dueD >= viewStart && dueD <= viewEnd) {
          const key = dateKey(dueD);
          if (!dayMap[key]) dayMap[key] = [];
          dayMap[key].push({ task, isRecurringInstance: false, occurrenceDate: dueD });
        }
      } else if (isRecurring && anchor) {
        // Use engine (Agent 13: exceptions passed for accurate skip filtering)
        const occs = getOccurrencesInRange(anchor, task.recurringRule!, addDays(viewStart, -2), addDays(viewEnd, 2), 40, task.exceptionDates);
        occs.forEach((occ) => {
          if (occ >= viewStart && occ <= viewEnd) {
            const key = dateKey(occ);
            if (!dayMap[key]) dayMap[key] = [];
            // Avoid dup if anchor coincides
            if (!dayMap[key].some((e) => e.task.id === task.id && isSameDay(e.occurrenceDate, occ))) {
              dayMap[key].push({ task, isRecurringInstance: true, occurrenceDate: occ });
            }
          }
        });
      }
    });

    // Skip one occurrence handler (Agent 13 exception support) - updates master task exceptions array
    const handleSkipOccurrence = async (taskId: string, occurrenceDate: Date) => {
      const task = tasks.find((t) => t.id === taskId);
      if (!task || !task.recurringRule) return;
      const exKey = normalizeExceptionKey(occurrenceDate);
      const currentEx = task.exceptionDates || [];
      if (currentEx.some((ex) => normalizeExceptionKey(ex) === exKey)) return; // already skipped
      const nextEx = [...currentEx, exKey];
      await updateTask(taskId, { exceptionDates: nextEx });
      toast.success("Occurrence skipped", {
        description: `${task.title} — ${format(occurrenceDate, "MMM d")} excluded from series`,
      });
    };

    // Drag handlers for reschedule (native, reliable, zero extra setup)
    // Agent 13 enhanced: richer payload for recurring instances to provide better feedback (still reschedules series anchor per design; deeper UX for prod)
    const handleDragStart = (e: React.DragEvent, taskId: string, isRecurringInstance = false, occurrenceDate?: Date) => {
      const payload = occurrenceDate
        ? `${taskId}|${isRecurringInstance ? occurrenceDate.toISOString() : ""}`
        : taskId;
      e.dataTransfer.setData("text/plain", payload);
      e.dataTransfer.effectAllowed = "move";
    };

    const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
    };

    const handleDrop = async (e: React.DragEvent, targetDay: Date) => {
      e.preventDefault();
      const raw = e.dataTransfer.getData("text/plain");
      if (!raw) return;
      const [taskId, occIso] = raw.split("|");
      if (!taskId) return;

      const task = tasks.find((t) => t.id === taskId);
      if (!task) return;

      const isInstanceDrag = !!occIso;
      const occurrenceDate = occIso ? new Date(occIso) : null;

      // Preserve original time-of-day if present, else default to 09:00
      let newDue: Date;
      if (task.dueDate) {
        const orig = new Date(task.dueDate);
        newDue = new Date(targetDay);
        newDue.setHours(orig.getHours(), orig.getMinutes(), 0, 0);
      } else {
        newDue = new Date(targetDay);
        newDue.setHours(9, 0, 0, 0);
      }
      const newDueIso = newDue.toISOString();

      if (isInstanceDrag && occurrenceDate && task.recurringRule) {
        // Intelligent recurring handling (production UX): ask user series vs this occurrence only
        const choice = window.confirm(
          `Recurring instance dragged.\n\n` +
          `OK = Move entire series anchor (affects all future)\n` +
          `Cancel = Skip original occurrence + create standalone one-off task at new date (series unchanged)`
        );

        if (choice) {
          // Series anchor move (current behavior)
          await updateTask(taskId, { dueDate: newDueIso });
          toast.success("Series rescheduled", {
            description: `${task.title} anchor moved to ${format(newDue, "MMM d")} (future occurrences updated). Use Skip or modal for one-offs.`,
          });
        } else {
          // One-off: skip the dragged-from occurrence, create independent copy on target
          const exKey = normalizeExceptionKey(occurrenceDate);
          const currentEx = task.exceptionDates || [];
          if (!currentEx.some((ex) => normalizeExceptionKey(ex) === exKey)) {
            await updateTask(taskId, { exceptionDates: [...currentEx, exKey] });
          }
          // Create one-off duplicate (non-recurring) at new date, copy key fields
          try {
            const res = await addTask(task.title);
            if (!res) {
              toast.error("Failed to create one-off task");
              return;
            }
            const oneOff = res;
            await updateTask(oneOff.id, {
              dueDate: newDueIso,
              priority: task.priority,
              tags: task.tags || [],
              timeEstimate: task.timeEstimate,
              description: task.description || "",
              // status defaults to todo
            });
            toast.success("One-off created", {
              description: `${task.title} — occurrence skipped in series; standalone task added for ${format(newDue, "MMM d")}`,
            });
          } catch (e) {
            toast.error("Could not create one-off (series skip applied)");
          }
        }
      } else {
        // Non-recurring or series drag: simple reschedule
        await updateTask(taskId, { dueDate: newDueIso });
        toast.success("Rescheduled", {
          description: `${task.title} moved to ${format(newDue, "MMM d")}`,
        });
      }
    };

    const goPrev = () => {
      if (calendarMode === "month") setCalendarMonth(subMonths(calendarMonth, 1));
      else if (calendarMode === "week") setCalendarMonth(subWeeks(calendarMonth, 1));
      else setCalendarMonth(subWeeks(calendarMonth, 2));
    };
    const goNext = () => {
      if (calendarMode === "month") setCalendarMonth(addMonths(calendarMonth, 1));
      else if (calendarMode === "week") setCalendarMonth(addWeeks(calendarMonth, 1));
      else setCalendarMonth(addWeeks(calendarMonth, 2));
    };
    const goToday = () => {
      const t = new Date();
      setCalendarMonth(startOfMonth(t));
    };

    return (
      <div className="max-w-[1200px] mx-auto pt-6 pb-12">
        {/* Calendar Header — premium controls */}
        <div className="flex items-center justify-between mb-6 px-2">
          <div className="flex items-center gap-4">
            <div className="text-3xl font-semibold tracking-tighter flex items-center gap-3">
              <Calendar className="h-7 w-7 text-[#c084fc]" />
              Calendar
            </div>
            <div className="text-sm text-[#71717a] font-mono">
              {format(calendarMonth, "MMMM yyyy")}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Mode switcher — world class tabs */}
            {(["month", "week", "timeline"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setCalendarMode(m)}
                className={cn(
                  "px-4 py-1.5 text-sm rounded-full transition font-medium border",
                  calendarMode === m
                    ? "bg-white/10 border-[#c084fc]/50 text-white"
                    : "border-white/10 hover:bg-white/5 text-[#a1a1aa]"
                )}
              >
                {m === "month" ? "Month" : m === "week" ? "Week" : "Timeline"}
              </button>
            ))}

            <div className="w-px h-6 bg-white/10 mx-1" />

            <button onClick={goPrev} className="p-2 rounded-xl hover:bg-white/5 border border-white/10 transition" aria-label="Previous period">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button onClick={goToday} className="px-4 py-1.5 text-sm rounded-full bg-white/5 hover:bg-white/10 border border-white/10">Today</button>
            <button onClick={goNext} className="p-2 rounded-xl hover:bg-white/5 border border-white/10 transition" aria-label="Next period">
              <ChevronRight className="h-4 w-4" />
            </button>

            <button
              onClick={() => {
                // Quick demo: create recurring task shortcut
                const title = prompt("Quick recurring task title? (e.g. Review metrics)");
                if (title) {
                  // Fire and forget via store (will be in todo by default)
                  (async () => {
                    const res = await addTask(`${title} weekly`);
                    if (!res) {
                      toast.error("Failed to create recurring task");
                      return;
                    }
                    const t = res;
                    await updateTask(t.id, { recurringRule: "FREQ=WEEKLY;BYDAY=MO" });
                    toast("Recurring weekly task created");
                    setCalendarMode("month");
                  })();
                }
              }}
              className="ml-2 text-xs px-3 py-1.5 rounded-full bg-[#c084fc]/10 text-[#c084fc] border border-[#c084fc]/30 hover:bg-[#c084fc]/20 flex items-center gap-1"
            >
              <Repeat className="h-3.5 w-3.5" /> + Weekly
            </button>
          </div>
        </div>

        {/* Legend (Agent 25 production polish) */}
        <div className="flex items-center gap-4 text-xs text-[#71717a] mb-4 px-2 flex-wrap">
          <div className="flex items-center gap-1.5"><span className="inline-block w-2 h-2 rounded bg-[#c084fc]" /> Due / scheduled</div>
          <div className="flex items-center gap-1.5"><span className="inline-block w-2 h-2 rounded border border-[#c084fc] border-dashed" /> Recurring instance</div>
          <div className="flex items-center gap-1.5 text-[#c084fc]/70">× = Skip (exception)</div>
          <div>Drag: series (default) or one-off (confirm) • Full COUNT/UNTIL + exceptions in engine + modal • Click chip → details</div>
        </div>

        {/* MONTH / WEEK GRID */}
        {(calendarMode === "month" || calendarMode === "week") && (
          <div className={cn(
            "grid gap-px bg-white/5 p-px rounded-3xl overflow-hidden border border-white/10",
            calendarMode === "month" ? "grid-cols-7" : "grid-cols-7"
          )}>
            {/* Day headers */}
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d, i) => (
              <div key={i} className="text-center py-2 text-[10px] font-mono tracking-[1px] text-[#71717a] bg-[#0a0a0f]">
                {d}
              </div>
            ))}

            {days.map((day, idx) => {
              const key = dateKey(day);
              const dayTasks = (dayMap[key] || []).slice(0, calendarMode === "month" ? 4 : 8);
              const isCurrentMonth = calendarMode === "month" ? day.getMonth() === calendarMonth.getMonth() : true;
              const isDayToday = isToday(day);

              return (
                <div
                  key={idx}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, day)}
                  className={cn(
                    "min-h-[108px] p-2 bg-[#111114] border-r border-b border-white/5 transition group",
                    !isCurrentMonth && calendarMode === "month" && "opacity-50 bg-[#0c0c10]",
                    isDayToday && "ring-1 ring-inset ring-[#c084fc]/60 bg-[#c084fc]/[0.015]"
                  )}
                >
                  <div className={cn(
                    "text-xs font-mono mb-1.5 flex items-baseline justify-between",
                    isDayToday ? "text-[#c084fc] font-semibold" : "text-[#a1a1aa]"
                  )}>
                    {format(day, "d")}
                    {isDayToday && <span className="text-[9px] px-1 py-px bg-[#c084fc] text-black rounded">TODAY</span>}
                  </div>

                  <div className="space-y-1">
                    {dayTasks.map(({ task, isRecurringInstance, occurrenceDate }, tIdx) => (
                      <div
                        key={`${task.id}-${tIdx}`}
                        draggable
                        onDragStart={(e) => handleDragStart(e, task.id, isRecurringInstance, occurrenceDate)}
                        onClick={() => openTask(task)}
                        className={cn(
                          "text-[10px] px-2 py-1 rounded-lg cursor-grab active:cursor-grabbing border transition flex items-center gap-1.5 truncate",
                          isRecurringInstance
                            ? "bg-[#c084fc]/5 border-[#c084fc]/30 text-[#c084fc] hover:border-[#c084fc]/60"
                            : "bg-white/5 border-white/10 hover:border-white/30 text-[#f4f4f5]"
                        )}
                        title={`${task.title}${isRecurringInstance ? ` (recurring inst ${format(occurrenceDate, "MMM d")} — drag for series or one-off; end: ${getRecurrenceEndDescription(task.recurringRule)})` : ""} — drag to reschedule`}
                      >
                        <span className="truncate flex-1">{task.title}</span>
                        {task.recurringRule && (
                          <span className="text-[#c084fc]/70 text-[9px] shrink-0">↻</span>
                        )}
                        {isRecurringInstance && <span className="text-[8px] opacity-60">inst</span>}
                        {isRecurringInstance && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSkipOccurrence(task.id, occurrenceDate);
                            }}
                            className="ml-1 text-[8px] opacity-60 hover:opacity-100 hover:text-red-400 px-0.5"
                            title="Skip this occurrence (add exception)"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    ))}
                    {dayTasks.length === 0 && (
                      <div className="h-6 text-[9px] text-[#71717a]/60 flex items-center justify-center border border-dashed border-white/10 rounded opacity-0 group-hover:opacity-100 transition">
                        Drop to schedule
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* TIMELINE / GANTT VIEW — basic but delightful horizontal bars */}
        {calendarMode === "timeline" && (
          <div className="glass rounded-3xl p-6 overflow-x-auto">
            <div className="min-w-[900px]">
              <div className="text-sm text-[#71717a] mb-4">Timeline • {format(viewStart, "MMM d")} — {format(viewEnd, "MMM d, yyyy")}</div>

              {tasks.filter(t => t.dueDate || t.recurringRule).slice(0, 12).map((task, i) => {
                const anchor = task.dueDate ? new Date(task.dueDate) : today;
                const estDays = Math.max(1, Math.round((task.timeEstimate || 60) / (8 * 60))); // rough days
                const barStart = Math.max(0, Math.floor((anchor.getTime() - viewStart.getTime()) / (1000 * 86400)));
                const barWidth = Math.max(2, estDays);

                return (
                  <div key={i} className="flex items-center gap-4 py-2 border-b border-white/5 last:border-0 group">
                    <div className="w-48 truncate text-sm cursor-pointer hover:text-[#c084fc]" onClick={() => openTask(task)}>
                      {task.title}
                      {task.recurringRule && <span className="ml-2 text-[#c084fc] text-xs">↻ {getRecurringLabel(task.recurringRule).slice(0,10)}</span>}
                    </div>

                    <div className="flex-1 relative h-5 bg-white/5 rounded">
                      <div
                        className={cn(
                          "absolute h-5 rounded transition-all flex items-center px-2 text-[9px] font-medium cursor-grab active:cursor-grabbing",
                          task.recurringRule ? "bg-[#c084fc]/70 text-black" : "bg-[#c084fc] text-black"
                        )}
                        style={{ left: `${Math.min(92, (barStart / 28) * 100)}%`, width: `${Math.min(35, barWidth * 3.2)}%` }}
                        draggable
                        onDragStart={(e) => handleDragStart(e, task.id, false, undefined)}
                        onClick={() => openTask(task)}
                        title={task.recurringRule ? "Drag to reschedule series anchor" : "Drag me to another day in month view, or click"}
                      >
                        {format(anchor, "MMM d")}
                      </div>
                    </div>

                    <div className="w-20 text-right text-xs text-[#71717a] tabular-nums">
                      {task.timeEstimate ? `${task.timeEstimate}m` : ""}
                    </div>
                  </div>
                );
              })}

              {tasks.filter(t => t.dueDate || t.recurringRule).length === 0 && (
                <div className="text-center py-12 text-[#71717a]">No scheduled or recurring tasks yet. Create some with due dates!</div>
              )}
            </div>
          </div>
        )}

        {/* Footer hint */}
        <div className="mt-4 text-center text-[10px] text-[#71717a]">
          Drag chips: series or one-off (prompt) • × skips occurrence • Modal: rich end conditions (Never/After N/Until), raw RRULE, unskips • Engine v25: COUNT+UNTIL+instances+perf (demo/live clean)
        </div>
      </div>
    );
  };

  const renderTeamsView = () => {
    // Use centralized role/permission flags defined at component root for app-wide consistency & enforcement
    const isLive = isSupabaseConfigured();
    const currentWsId = currentWorkspace.id;
    const isDemoWs = ["w1", "w2"].includes(currentWsId);

    // Special empty state for workspace owners with no other members yet.
    // Per user request: hide the full busy interface and show a clean, modern invite-focused experience.
    // The predicate is inlined (no TDZ identifier remains).

    const handleSendInvite = async () => {
      console.log("[DEBUG] handleSendInvite was called");
      if (!isLiveWorkspace || ["w1", "w2"].includes(currentWorkspace.id)) {
        toast.info("Invites require a live Supabase workspace");
        return;
      }
      setIsSendingInvite(true);
      try {
        const emailVal = inviteEmail.trim() || undefined;
        const inviteId = await sendInvite(emailVal, inviteRole);
        console.log("[DEBUG] sendInvite returned:", inviteId);

        if (inviteId) {
          // Build nice link
          const link = `${window.location.origin}/?invite=${inviteId}`;
          // Copy immediately for delight
          try {
            await navigator.clipboard.writeText(link);
            setCopiedInviteId(inviteId);
            setTimeout(() => setCopiedInviteId(null), 2500);
            toast.success("Invite sent & link copied!", { description: "They can join via the link." });
          } catch {}
          setInviteEmail("");
          setTeamSearchQuery("");
          setTeamSearchResults([]);

          console.log("[DEBUG] About to call fetchInvites() after send");
          await fetchInvites();
          const currentInvites = useTaskStore.getState().invites;
          console.log("[DEBUG] After fetchInvites(), invites array =", currentInvites);
          console.log("[DEBUG] invites.length =", currentInvites?.length);

          // Force re-render of empty state to show new pending invites immediately.
          // Harmless no-op set on local state (closed over in empty UI) guarantees a fresh render
          // pass after store update so the promoted "Invites sent" section (top of empty-owner UI)
          // definitely appears with the latest invites data.
          setTeamSearchResults((r) => r);
        } else {
          console.warn("[DEBUG] sendInvite did NOT return an id. Invite creation likely failed.");
        }
      } finally {
        setIsSendingInvite(false);
      }
    };

    const copyInviteLink = async (inviteId: string) => {
      const link = `${window.location.origin}/?invite=${inviteId}`;
      try {
        await navigator.clipboard.writeText(link);
        setCopiedInviteId(inviteId);
        setTimeout(() => setCopiedInviteId(null), 2000);
        toast.success("Link copied");
      } catch {
        toast.error("Copy failed - link: " + link);
      }
    };

    const handleRoleChange = async (userId: string, newRole: "owner" | "admin" | "user") => {
      await changeMemberRole(userId, newRole);
    };

    const handleRemove = async (userId: string, emailOrId: string) => {
      setPendingRemoveMember({ userId, label: emailOrId || "this teammate" });
    };

    const handleRevokeInvite = async (inviteId: string, label: string) => {
      setPendingRevokeInvite({ inviteId, label: label || inviteId.slice(0, 8) });
    };

    const handleResendInvite = async (inviteId: string, label: string) => {
      setPendingResendInvite({ inviteId, label: label || inviteId.slice(0, 8) });
    };

    const handleManualAccept = async () => {
      const token = prompt("Paste invite token (UUID from link):");
      if (!token) return;
      await acceptInviteLink(token.trim());
    };

    // === Special modern empty state for owners with no other members yet ===
    // Inlined predicate (using early-declared myRole/members/etc.) completely removes the
    // 'isEmptyOwnerState' identifier from executable code. This eliminates all TDZ risk.
    if (myRole === 'owner' && members.length <= 1 && isLiveWorkspace && !isDemoWs) {
      return (
        <div className="max-w-2xl mx-auto pt-12 pb-20">
          <div className="text-center mb-10">
            <div className="mx-auto mb-6 h-20 w-20 rounded-3xl bg-gradient-to-br from-[#c084fc] to-[#a855f7] flex items-center justify-center">
              <Users className="h-10 w-10 text-black" />
            </div>
            <div className="text-4xl font-semibold tracking-tighter mb-3">Build your team</div>
            <p className="text-xl text-[#a1a1aa] max-w-md mx-auto">
              Workspaces shine when you have collaborators. Search for people in the database or send an invite.
            </p>

            {/* Recipient context — only show for non-creators of *this* workspace */}
            {currentWorkspace.owner_id && currentWorkspace.owner_id !== user?.id && (
              <div className="mt-4 mb-2 text-sm text-[#c084fc] bg-[#c084fc]/10 border border-[#c084fc]/20 rounded-xl px-4 py-2 inline-block">
                You were invited to this workspace.
              </div>
            )}
          </div>

          {/* === "Invites sent" — primary focus once any exist (world-class simple feedback) === */}
          {invites.length > 0 && (
            <div className="glass rounded-3xl p-8 border border-white/10 mb-8">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="font-semibold text-xl tracking-tight">Invites sent</div>
                  <div className="px-3 py-0.5 rounded-full bg-[#c084fc]/20 text-sm font-mono text-[#c084fc] border border-[#c084fc]/30">
                    {invites.length}
                  </div>
                </div>
                <div className="text-xs text-[#71717a] font-mono">Pending</div>
              </div>

              <div className="space-y-3">
                {invites.map((inv, index) => (
                  <div key={inv.id} className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition group">
                    <div className="min-w-0">
                      {/* Privacy: never show the recipient's email in the sender's "Invites sent" list.
                          Prefer name + @username (populated when invite came via search). */}
                      <div className="font-medium truncate">
                        {inv.invitedFullName || (inv.invitedUsername ? `@${inv.invitedUsername}` : "Pending teammate")}
                      </div>
                      <div className="text-xs text-[#71717a] font-mono mt-0.5">
                        {inv.role} • {new Date(inv.createdAt).toLocaleDateString()}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 opacity-80 group-hover:opacity-100 transition">
                      <button
                        onClick={() => copyInviteLink(inv.id)}
                        className="btn btn-secondary text-xs px-3 py-1.5"
                      >
                        {copiedInviteId === inv.id ? "Copied!" : "Copy link"}
                      </button>
                      <button
                        onClick={() => {
                          const label = inv.invitedFullName || (inv.invitedUsername ? `@${inv.invitedUsername}` : inv.email || "link-only");
                          handleResendInvite(inv.id, label);
                        }}
                        className="btn btn-secondary text-xs px-3 py-1.5 flex items-center gap-1"
                        disabled={!isLive}
                      >
                        <Repeat className="h-3 w-3" /> Resend
                      </button>
                      <button
                        onClick={() => {
                          const label = inv.invitedFullName || (inv.invitedUsername ? `@${inv.invitedUsername}` : inv.email || "link-only");
                          handleRevokeInvite(inv.id, label);
                        }}
                        className="p-2 text-red-400 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition"
                        aria-label="Revoke invite"
                        disabled={!isLive}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Prominent user search (Facebook-style "find friends") */}
          <div className="glass rounded-3xl p-8 border border-white/10 mb-8">
            <div className="font-semibold text-lg mb-4 flex items-center gap-2">
              <Search className="h-5 w-5 text-[#c084fc]" /> Search for teammates
            </div>

            <div className="relative">
              <input
                type="text"
                value={teamSearchQuery}
                onChange={(e) => {
                  const q = e.target.value;
                  setTeamSearchQuery(q);
                  setIsSearchingTeam(true);
                  if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
                  if (!q.trim()) {
                    setTeamSearchResults([]);
                    setIsSearchingTeam(false);
                    setShowDirectInvite(false);
                    return;
                  }
                  searchDebounceRef.current = setTimeout(async () => {
                    try {
                      const results = await searchPotentialTeammates(q.trim(), currentWorkspace.id);
                      setTeamSearchResults(results);
                    } catch {
                      setTeamSearchResults([]);
                    } finally {
                      setIsSearchingTeam(false);
                    }
                  }, 350);
                }}
                placeholder="Search by name, @username or city (e.g. Jordan, @alex, Austin)"
                className="input w-full px-5 py-4 text-lg rounded-2xl mb-4 pr-10"
              />
              {teamSearchQuery && (
                <button
                  onClick={() => {
                    setTeamSearchQuery("");
                    setTeamSearchResults([]);
                    setIsSearchingTeam(false);
                    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
                  }}
                  className="absolute right-4 top-4 text-[#71717a] hover:text-white"
                  aria-label="Clear search"
                >
                  <X className="h-5 w-5" />
                </button>
              )}
            </div>

            {/* Clickable trigger for direct invite - always visible when searching */}
            {teamSearchQuery.trim() && (
              <div
                onClick={() => setShowDirectInvite(!showDirectInvite)}
                className="text-sm text-[#c084fc] hover:underline cursor-pointer mb-4 flex items-center gap-1.5 select-none"
              >
                Not seeing who you're looking for? <span className="font-medium">Invite by email or create a link</span>
              </div>
            )}

            {/* Expanded direct invite form */}
            {showDirectInvite && (
              <div className="mb-6 space-y-3 border border-white/10 bg-white/5 rounded-2xl p-5">
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="teammate@company.com (optional for link-only)"
                  className="input w-full px-4 py-3 rounded-2xl"
                />

                <div className="flex gap-3">
                  <button
                    onClick={() => handleSendInvite()}
                    disabled={isSendingInvite || !inviteEmail.trim()}
                    className="flex-1 btn btn-primary py-3 text-sm disabled:opacity-60"
                  >
                    {isSendingInvite ? "Sending..." : "Send invite"}
                  </button>
                  <button
                    onClick={async () => {
                      setInviteEmail("");
                      await handleSendInvite();
                    }}
                    disabled={isSendingInvite}
                    className="flex-1 btn btn-secondary py-3 text-sm"
                  >
                    Create shareable link
                  </button>
                </div>

                <div className="text-[11px] text-[#71717a] text-center">
                  They’ll receive an email (if provided) or can join via the link.
                </div>
              </div>
            )}

            {isSearchingTeam && (
              <div className="flex items-center gap-2 text-sm text-[#a1a1aa] mb-3 px-1">
                <Loader2 className="h-4 w-4 animate-spin" /> Searching directory...
              </div>
            )}

            {teamSearchResults.length > 0 && (
              <div className="space-y-2 mb-4">
                {teamSearchResults.map((result, idx) => {
                  const initial = (result.fullName || result.username || result.email || "?").toString()[0].toUpperCase();
                  const displayName = result.fullName || result.username || "User";
                  return (
                    <div key={result.id || idx} className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition">
                      <div className="flex items-center gap-3 min-w-0">
                        {result.avatarUrl ? (
                          <img src={result.avatarUrl} alt="" className="h-10 w-10 rounded-full object-cover border border-white/10" />
                        ) : (
                          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-[#c084fc]/80 to-[#a855f7]/80 flex items-center justify-center text-black font-bold flex-shrink-0">
                            {initial}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="font-medium truncate">{displayName}</div>
                          {result.username && <div className="text-xs text-[#c084fc] font-mono">@{result.username}</div>}
                          {result.location && <div className="text-xs text-[#71717a] truncate">📍 {result.location}</div>}
                        </div>
                      </div>
                      <button
                        onClick={async () => {
                          console.log("[DEBUG] Clicked 'Invite' button on search result", result);

                          // Clear search UI immediately for clean experience
                          setTeamSearchQuery("");
                          setTeamSearchResults([]);
                          setIsSearchingTeam(false);

                          if (!result.email) {
                            // No email available from search — fall back to manual form
                            setShowDirectInvite(true);
                            return;
                          }

                          // Automatically send the invite using the email from the search result
                          // (email is never shown to the sender for privacy)
                          const inviteId = await sendInvite(result.email, "user", result.id);

                          if (inviteId) {
                            toast.success("Invite sent!", {
                              description: "They will receive an email notification."
                            });
                            await fetchInvites();

                            // Optimistic enrichment for the sender's "Invites sent" list
                            // (search result already has the nice name/username; avoids RLS/profile visibility issues
                            // until we add a more permissive profiles policy or the DB hydration succeeds).
                            const store = useTaskStore.getState();
                            const patchedInvites = (store.invites || []).map((inv: any) =>
                              inv.id === inviteId
                                ? {
                                    ...inv,
                                    invitedFullName: result.fullName || inv.invitedFullName,
                                    invitedUsername: result.username || inv.invitedUsername,
                                  }
                                : inv
                            );
                            useTaskStore.setState({ invites: patchedInvites });

                            // The "Invites sent" section should now appear above with the real name
                          } else {
                            toast.error("Failed to send invite");
                          }
                        }}
                        className="btn btn-primary px-5 py-2 text-sm flex-shrink-0"
                      >
                        Invite
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {!isSearchingTeam && teamSearchQuery.trim() && teamSearchResults.length === 0 && (
              <div className="text-sm text-[#71717a] mb-4 px-1">
                No matches in the directory.
              </div>
            )}

            {/* Always-visible "Invite by email" option — stays noticeable even with many results */}


            <div className="text-[11px] text-[#71717a] mt-4">
              Search name, username or city. Results preview details before you invite.
            </div>
          </div>





          {/* "While you wait" tip — only show if profile is incomplete */}
          {(() => {
            const selfMember = members.find((m) => m.userId === user?.id);
            // Profile completion prompt removed — editing now lives exclusively in the avatar menu.
            return null;
          })()}
        </div>
      );
    }

    return (
      <div className="max-w-4xl mx-auto space-y-8 pb-12">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <Users className="h-8 w-8 text-[#c084fc]" />
              <div>
                <div className="text-2xl font-semibold tracking-tighter">Teams &amp; Collaboration</div>
                <div className="text-sm text-[#71717a] flex items-center gap-2">
                  {currentWorkspace.name}
                  {!isSingleOwnerWorkspace && (
                    <span className="px-2 py-0.5 rounded bg-white/5 text-[10px] font-mono text-[#c084fc] border border-white/10">{myRole}</span>
                  )}
                  {isLive && !isDemoWs ? (
                    <span className="text-[#00ff9f] text-[10px]">• LIVE REALTIME</span>
                  ) : (
                    <span className="text-[#71717a] text-[10px]">• DEMO (single-user)</span>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { fetchMembers(); fetchInvites(); }}
              className="btn btn-ghost text-xs px-3 py-1.5"
              disabled={!isLiveWorkspace || ["w1", "w2"].includes(currentWorkspace.id)}
            >
              Refresh
            </button>
            {canManage && isLive && !isDemoWs && (
              <button
                onClick={() => setShowInviteDialog(true)}
                className="btn btn-primary text-sm flex items-center gap-2"
              >
                <Plus className="h-4 w-4" /> Invite member
              </button>
            )}
            <button onClick={handleManualAccept} className="btn btn-ghost text-xs px-3 py-1.5" disabled={!isLive}>
              Accept invite token
            </button>
          </div>
        </div>

        {/* Presence indicators (basic realtime presence) */}
        <div className="glass rounded-2xl p-5 border border-white/10">
          <div className="flex items-center gap-2 mb-3 text-sm font-medium text-[#a1a1aa]">
            <Zap className="h-4 w-4 text-[#c084fc]" /> Online in this workspace
            <span className="ml-auto text-[10px] text-[#71717a] font-mono">{onlineUsers.length} here now</span>
          </div>
          {onlineUsers.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {onlineUsers.map((u) => (
                <div key={u.userId || u.presenceRef} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#00ff9f]/10 text-[#00ff9f] text-xs border border-[#00ff9f]/20" title={`${u.email || u.userId} • ${u.view || 'viewing'} ${u.editingItemId ? `editing ${u.editingItemType}` : ''}`}>
                  <div className="w-1.5 h-1.5 rounded-full bg-[#00ff9f] animate-pulse" />
                  {u.fullName || (u.username ? `@${u.username}` : "Anonymous teammate")}
                  {u.view && <span className="opacity-60">·{u.view}</span>}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-[#71717a]">No other users detected (you are the only one here, or realtime connecting...)</div>
          )}
          {!isLive && <div className="text-[11px] mt-2 text-[#c084fc]">Presence &amp; realtime require live Supabase connection.</div>}
        </div>

        {/* Profile editing lives in the avatar menu (top-right) to avoid duplication on the Teams page. */}

        {/* Members list with role enforcement */}
        <div className="glass rounded-2xl border border-white/10 overflow-hidden">
          <div className="px-5 py-3 border-b border-white/10 flex items-center justify-between bg-white/5">
            <div className="font-medium">Members ({members.length})</div>
            {isLoadingMembers && <Loader2 className="h-4 w-4 animate-spin text-[#c084fc]" />}
          </div>

          {members.length === 0 ? (
            <div className="p-8 text-center text-[#71717a] text-sm">
              {isDemoWs ? "Demo workspaces are single-player. Switch to or create a live workspace to see real members." : "No members loaded yet. Create your first workspace or refresh."}
            </div>
          ) : (
            <div className="divide-y divide-white/10 text-sm">
              {members.map((m) => {
                const isSelf = m.userId === user?.id;
                const canActOnThis = canManage && !isSelf;
                return (
                  <div key={m.userId} className="px-5 py-3.5 flex items-center gap-4 hover:bg-white/5 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">
                        {m.fullName || (m.username ? `@${m.username}` : "Unknown teammate")}
                      </div>
                      <div className="text-[11px] text-[#71717a] font-mono truncate flex items-center gap-2">
                        {m.username && <span>@{m.username}</span>}
                        {m.lastActiveAt && (
                          <span className="text-[#a1a1aa]">
                            last seen {new Date(m.lastActiveAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-xs px-2.5 py-1 rounded bg-white/5 border border-white/10 font-mono text-[#a1a1aa]">
                      {m.role}
                    </div>

                    <div className="text-[11px] text-[#71717a] hidden sm:block">
                      {new Date(m.joinedAt).toLocaleDateString()}
                    </div>

                    {canActOnThis ? (
                      <div className="flex items-center gap-2">
                        <select
                          value={m.role}
                          onChange={(e) => handleRoleChange(m.userId, e.target.value as any)}
                          className="bg-[#111114] border border-white/20 rounded px-2 py-1 text-xs font-mono focus:outline-none focus:border-[#c084fc]"
                          disabled={!isLive}
                        >
                          <option value="user">user</option>
                          <option value="admin">admin</option>
                          <option value="owner">owner</option>
                        </select>
                        <button
                          onClick={() => {
                            const display = m.fullName || (m.username ? `@${m.username}` : "this teammate");
                            handleRemove(m.userId, display);
                          }}
                          className="p-1.5 text-red-400 hover:text-red-500 hover:bg-red-500/10 rounded transition"
                          aria-label="Remove member"
                          title="Remove member"
                          disabled={!isLive}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </div>
                    ) : isSelf ? (
                      <button
                        onClick={async () => {
                          setPendingLeaveWorkspace(true);
                        }}
                        className="px-3 py-1 text-xs rounded-xl border border-white/20 hover:bg-white/5 text-[#a1a1aa] disabled:opacity-50"
                        disabled={!isLive}
                        title="Leave this workspace (self-service exit)"
                      >
                        Leave team
                      </button>
                    ) : (
                      <div className="text-[10px] text-[#71717a] px-2"></div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Pending Invites (owner/admin only) */}
        {canManage && isLive && !isDemoWs && (
          <div className="glass rounded-2xl border border-white/10 overflow-hidden">
            <div className="px-5 py-3 border-b border-white/10 flex items-center justify-between bg-white/5">
              <div className="font-medium">Pending Invites ({invites.length})</div>
            </div>
            {invites.length === 0 ? (
              <div className="p-6 text-sm text-[#71717a]">No pending invites. Use the invite button above to add teammates.</div>
            ) : (
              <div className="divide-y divide-white/10 text-sm">
                {invites.map((inv) => (
                  <div key={inv.id} className="px-5 py-3 flex items-center gap-3">
                    <div className="flex-1">
                      {/* Privacy: never show the recipient's email in the sender's "Invites sent" list.
                          Prefer name + @username (populated when invite came via search). */}
                      <div>
                        {inv.invitedFullName || (inv.invitedUsername ? `@${inv.invitedUsername}` : "Link-only invite")}
                      </div>
                      <div className="text-[11px] text-[#71717a] font-mono">Role: {inv.role} • Created {new Date(inv.createdAt).toLocaleDateString()}</div>
                    </div>
                    <button
                      onClick={() => copyInviteLink(inv.id)}
                      className="btn btn-secondary text-xs px-3 py-1 flex items-center gap-1"
                    >
                      {copiedInviteId === inv.id ? "Copied!" : "Copy link"}
                    </button>
                    <button
                      onClick={() => {
                        const label = inv.invitedFullName || (inv.invitedUsername ? `@${inv.invitedUsername}` : inv.email || "link-only");
                        handleResendInvite(inv.id, label);
                      }}
                      className="btn btn-secondary text-xs px-2 py-1 flex items-center gap-1"
                      title="Resend fresh invite (new expiry, revokes old)"
                      disabled={!isLive}
                    >
                      <Repeat className="h-3.5 w-3.5" /> Resend
                    </button>
                    <button
                      onClick={() => {
                        const label = inv.invitedFullName || (inv.invitedUsername ? `@${inv.invitedUsername}` : inv.email || "link-only");
                        handleRevokeInvite(inv.id, label);
                      }}
                      className="p-1.5 text-red-400 hover:text-red-500 hover:bg-red-500/10 rounded transition"
                      aria-label="Revoke invite"
                      title="Revoke invite"
                      disabled={!isLive}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Agent 28: DEDICATED POLISHED ADMIN DASHBOARD (owner/admin only, inside Teams) */}
        {/* Powerful, trustworthy tools: tabbed overview/exports/imports/templates/insights. */}
        {/* Full data exports (JSON+all CSVs+enhanced MD incl members/activity), smart import conflict handling, rich template lib, real insights. */}
        {/* Security: entire block gated by canManage; hybrid+store enforce live/demo + role at action level. */}
        {canManage && (
          <div className="glass rounded-2xl border border-white/10 overflow-hidden">
            {/* Header + Tabs */}
            <div className="px-5 py-3 border-b border-white/10 bg-white/5">
              <div className="flex items-center justify-between mb-3">
                <div className="font-semibold flex items-center gap-2 text-lg tracking-tight">
                  <Settings className="h-5 w-5 text-[#c084fc]" /> Admin Dashboard
                  {!isSingleOwnerWorkspace && (
                    <span className="text-xs px-2 py-0.5 rounded bg-white/10 text-[#a1a1aa] font-mono">{myRole.toUpperCase()}</span>
                  )}
                  <span className="text-[10px] text-[#71717a]">• {currentWorkspace.name}</span>
                </div>
                <button
                  onClick={async () => {
                    try {
                      const storeStats = await useTaskStore.getState().getWorkspaceStats();
                      toast.success("Stats refreshed", { description: `${storeStats.taskCount || tasks.length} tasks • ${storeStats.completionRate || 0}% done • ${storeStats.overdueCount || 0} overdue` });
                    } catch {
                      toast.info("Stats updated from local data");
                    }
                  }}
                  className="btn btn-ghost text-xs px-3 py-1 flex items-center gap-1"
                  disabled={!isLiveWorkspace || ["w1", "w2"].includes(currentWorkspace.id)}
                >
                  <RefreshCw className="h-3.5 w-3.5" /> Refresh
                </button>
              </div>

              {/* Tab Navigation - feels like dedicated powerful tool */}
              <div className="flex flex-wrap gap-1 text-xs">
                {[
                  { id: 'overview', label: 'Overview', icon: BarChart3 },
                  { id: 'exports', label: 'Export Data', icon: FileDown },
                  { id: 'imports', label: 'Import & Restore', icon: Upload },
                  { id: 'templates', label: 'Apply Templates', icon: FileText },
                  { id: 'insights', label: 'Team Insights', icon: Users },
                ].map((tab) => {
                  const Icon = tab.icon;
                  const active = adminTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setAdminTab(tab.id as any)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border transition-all ${active ? 'bg-[#c084fc] text-black border-[#c084fc] font-medium' : 'bg-white/5 border-white/10 hover:bg-white/10 text-[#a1a1aa] hover:text-white'}`}
                    >
                      <Icon className="h-3.5 w-3.5" /> {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* OVERVIEW TAB */}
            {adminTab === 'overview' && (
              <div className="p-5">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mb-4">
                  <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                    <div className="text-[#71717a] text-xs flex items-center gap-1">Tasks <span className="text-emerald-400">•</span> Done</div>
                    <div className="text-2xl font-semibold tabular-nums mt-1">{tasks.length} <span className="text-xs text-[#a1a1aa]">/ {tasks.filter(t => t.status === "done").length}</span></div>
                  </div>
                  <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                    <div className="text-[#71717a] text-xs">Notes • Team Size</div>
                    <div className="text-2xl font-semibold tabular-nums mt-1">{notes.length} <span className="text-xs text-[#a1a1aa]">/ {members.length}</span></div>
                  </div>
                  <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                    <div className="text-[#71717a] text-xs">Overdue • Completion</div>
                    <div className="text-2xl font-semibold tabular-nums mt-1 text-[#ff3366]">{tasks.filter(t => t.dueDate && new Date(t.dueDate).getTime() < Date.now() && t.status !== "done").length} <span className="text-xs text-[#a1a1aa]">/ ~{Math.round((tasks.filter(t => t.status === "done").length / Math.max(1, tasks.length)) * 100)}%</span></div>
                  </div>
                  <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                    <div className="text-[#71717a] text-xs">Activity Volume</div>
                    <div className="text-2xl font-semibold tabular-nums mt-1">{recentActivity.length}</div>
                    <div className="text-[10px] text-[#c084fc]">Recent events (full in Insights)</div>
                  </div>
                </div>
                <div className="text-[11px] text-[#71717a]">Use the tabs above for full exports, smart imports, starter templates, and deep team insights. All admin actions are audited in Activity log.</div>
              </div>
            )}

            {/* EXPORTS TAB — complete, useful, multiple formats */}
            {adminTab === 'exports' && (
              <div className="p-5 border-t border-white/10 space-y-4">
                <div>
                  <div className="text-sm font-medium mb-1 flex items-center gap-2">Full Workspace Export <span className="text-[10px] px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 rounded">includes tasks, notes, members, activity</span></div>
                  <div className="text-xs text-[#a1a1aa]">JSON = complete portable backup/restore. CSVs = analysis in Sheets/Excel. MD = human + Notion ready (now with team + activity sections).</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => useTaskStore.getState().exportWorkspace('json')} disabled={!isLiveWorkspace || ["w1", "w2"].includes(currentWorkspace.id)} className="btn btn-secondary text-xs px-4 py-2 flex items-center gap-2"><FileDown className="h-4 w-4" /> Full JSON</button>
                  <button onClick={() => useTaskStore.getState().exportWorkspace('csv')} disabled={!isLiveWorkspace || ["w1", "w2"].includes(currentWorkspace.id)} className="btn btn-secondary text-xs px-4 py-2 flex items-center gap-2"><FileDown className="h-4 w-4" /> All CSVs (Tasks + Notes + Members + Activity)</button>
                  <button onClick={() => useTaskStore.getState().exportWorkspace('md')} disabled={!isLiveWorkspace || ["w1", "w2"].includes(currentWorkspace.id)} className="btn btn-secondary text-xs px-4 py-2 flex items-center gap-2"><FileDown className="h-4 w-4" /> Enhanced Markdown</button>
                  <button onClick={() => useTaskStore.getState().exportWorkspace('all')} disabled={!isLiveWorkspace || ["w1", "w2"].includes(currentWorkspace.id)} className="btn btn-primary text-xs px-4 py-2 flex items-center gap-2 bg-[#c084fc] text-black hover:bg-[#a855f7]"><Download className="h-4 w-4" /> Export EVERYTHING (recommended)</button>
                </div>
                <div className="text-[10px] text-[#71717a] pt-1">Exports are logged as admin.export.* actions. Perfect for audits, migrations, or external reporting.</div>
              </div>
            )}

            {/* IMPORTS TAB — with conflict handling + preview */}
            {adminTab === 'imports' && (
              <div className="p-5 border-t border-white/10 space-y-4">
                <div>
                  <div className="text-sm font-medium mb-1">Smart Import (JSON / CSV / MD)</div>
                  <div className="text-xs text-[#a1a1aa]">Appends to workspace. Choose conflict strategy for safe repeated imports (e.g. from other tools or previous exports).</div>
                </div>

                <div className="flex flex-wrap gap-3 items-center">
                  <div>
                    <div className="text-[10px] uppercase tracking-widest text-[#a1a1aa] mb-1">Conflict Strategy</div>
                    <div className="flex gap-2 text-xs">
                      <label className={`px-3 py-1 rounded-xl border cursor-pointer ${importStrategy === 'skip-dupe-titles' ? 'border-[#c084fc] bg-white/10' : 'border-white/20'}`}>
                        <input type="radio" className="hidden" checked={importStrategy === 'skip-dupe-titles'} onChange={() => setImportStrategy('skip-dupe-titles')} /> Smart: skip duplicates (by title)
                      </label>
                      <label className={`px-3 py-1 rounded-xl border cursor-pointer ${importStrategy === 'append' ? 'border-[#c084fc] bg-white/10' : 'border-white/20'}`}>
                        <input type="radio" className="hidden" checked={importStrategy === 'append'} onChange={() => setImportStrategy('append')} /> Append everything
                      </label>
                    </div>
                  </div>

                  <label className="btn btn-secondary text-xs px-4 py-2 cursor-pointer inline-flex items-center gap-2 mt-4">
                    <Upload className="h-4 w-4" /> Choose File (JSON, CSV, MD/TXT)
                    <input
                      type="file"
                      accept=".json,.csv,.md,.txt"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file || !isLiveWorkspace || ["w1", "w2"].includes(currentWorkspace.id)) return;
                        setImportPreview(null);
                        const text = await file.text();
                        const ext = file.name.split(".").pop()?.toLowerCase() || '';
                        let parsed: any = { tasks: [], notes: [] };
                        try {
                          const utilsMod = await import("@/lib/utils");
                          if (ext === "json") {
                            parsed = utilsMod.parseJSONImport(text);
                          } else if (ext === "csv") {
                            parsed = { tasks: utilsMod.parseCSVToTasks(text) };
                          } else {
                            // crude MD task extraction + basic note from headings
                            const taskLines = text.split("\n").filter(l => l.match(/^\s*-\s*\[[\sx]\]/i));
                            parsed.tasks = taskLines.map(l => ({ title: l.replace(/^\s*-\s*\[[\sx]\]\s*/, "").trim().slice(0, 140) }));
                            // simple notes from ### headings
                            const noteMatches = text.match(/^###\s+(.+)$/gm) || [];
                            parsed.notes = noteMatches.slice(0, 20).map((h: string) => ({ title: h.replace(/^###\s+/, "").trim() }));
                          }
                          setImportPreview({ tasks: parsed.tasks?.length || 0, notes: parsed.notes?.length || 0, source: file.name });
                          // store parsed for actual import
                          (window as any).__pendingImport = parsed;
                        } catch (err) {
                          toast.error("Failed to parse file");
                        }
                        e.target.value = "";
                      }}
                    />
                  </label>
                </div>

                {importPreview && (
                  <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-xs">
                    <div>Preview from <span className="font-mono">{importPreview.source}</span>:</div>
                    <div className="font-medium mt-1">{importPreview.tasks} tasks • {importPreview.notes} notes ready to import.</div>
                    <div className="mt-2 flex gap-2">
                      <button
                        disabled={isImporting || !isLiveWorkspace || ["w1", "w2"].includes(currentWorkspace.id)}
                        onClick={async () => {
                          const parsed = (window as any).__pendingImport;
                          if (!parsed) return;
                          setIsImporting(true);
                          try {
                            const res = await useTaskStore.getState().importWorkspaceData(parsed, { conflictStrategy: importStrategy });
                            toast.success(`Import complete: ${res.importedTasks} tasks, ${res.importedNotes} notes${res.skippedTasks || res.skippedNotes ? ` (skipped ${res.skippedTasks || 0} tasks, ${res.skippedNotes || 0} notes)` : ''}`);
                            // Refresh UI state
                            await useTaskStore.getState().initializeFromSupabase?.();
                            setImportPreview(null);
                            (window as any).__pendingImport = null;
                          } catch (e) {
                            toast.error("Import failed");
                          } finally {
                            setIsImporting(false);
                          }
                        }}
                        className="btn btn-primary text-xs px-3 py-1"
                      >
                        {isImporting ? "Importing..." : `Import with ${importStrategy === 'skip-dupe-titles' ? 'Smart Skip' : 'Append'}`}
                      </button>
                      <button onClick={() => { setImportPreview(null); (window as any).__pendingImport = null; }} className="btn btn-ghost text-xs px-3 py-1">Cancel</button>
                    </div>
                  </div>
                )}
                <div className="text-[10px] text-[#71717a]">Imports logged as admin.import.bulk. After import, lists auto-refresh on live workspaces.</div>
              </div>
            )}

            {/* TEMPLATES TAB — expanded high-quality library, easy apply */}
            {adminTab === 'templates' && (
              <div className="p-5 border-t border-white/10">
                <div className="text-sm font-medium mb-2">High-Quality Starter Templates — click to apply instantly</div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 text-xs mb-3">
                  {(useTaskStore.getState().getAdminTemplateLibrary ? useTaskStore.getState().getAdminTemplateLibrary() : []).map((tpl: any, idx: number) => (
                    <div key={idx} className="bg-white/5 border border-white/10 rounded-xl p-3 hover:border-[#c084fc]/40 transition group">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-medium flex items-center gap-1.5">
                            {tpl.title}
                            <span className={`text-[9px] px-1 rounded ${tpl.type === 'note' ? 'bg-blue-500/20 text-blue-300' : 'bg-emerald-500/20 text-emerald-300'}`}>{tpl.type}</span>
                          </div>
                          {tpl.description && <div className="text-[10px] text-[#a1a1aa] line-clamp-2 mt-0.5 pr-2">{tpl.description.slice(0, 110)}{tpl.description.length > 110 ? "…" : ""}</div>}
                          {tpl.tags && <div className="mt-1 flex flex-wrap gap-1">{tpl.tags.filter((t: string) => t !== 'template').slice(0,3).map((t: string) => <span key={t} className="text-[9px] px-1 bg-white/10 rounded text-[#71717a]">{t}</span>)}</div>}
                        </div>
                        <button
                          onClick={async () => {
                            const res = await useTaskStore.getState().applyTemplate(tpl);
                            if (res) {
                              toast.success(`Applied: ${tpl.title}`);
                            } else {
                              toast.info("Template applied (demo or error — check tasks/notes)");
                            }
                          }}
                          className="opacity-70 group-hover:opacity-100 text-[#c084fc] hover:text-white text-[10px] px-2 py-0.5 border border-white/20 rounded hover:bg-[#c084fc]/10 self-start"
                          disabled={!isLiveWorkspace || ["w1", "w2"].includes(currentWorkspace.id)}
                        >
                          Apply
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="text-[10px] text-[#71717a]">Templates create real items (tagged “from-template”). Great for OKRs, launches, client work, retros. Add “template” tag to your own items to surface them in getTemplates().</div>
              </div>
            )}

            {/* INSIGHTS TAB — activity summary, member contributions, overdue trends */}
            {adminTab === 'insights' && (
              <div className="p-5 border-t border-white/10 space-y-4 text-sm">
                <div className="flex items-center justify-between">
                  <div className="font-medium">Admin &amp; Team Insights</div>
                  <button
                    onClick={async () => {
                      setIsLoadingInsights(true);
                      try {
                        const hybrid = await import("@/lib/data/hybridStore");
                        const fullActivity = await hybrid.getRecentActivity(currentWorkspace.id, 500);
                        // Simple but powerful computations
                        const contribMap: Record<string, number> = {};
                        fullActivity.forEach((a: any) => {
                          const key = a.userId || a.userName || "unknown";
                          contribMap[key] = (contribMap[key] || 0) + 1;
                        });
                        const topContribs = Object.entries(contribMap).sort((a, b) => b[1] - a[1]).slice(0, 5);
                        const adminActions = fullActivity.filter((a: any) => (a.actionType || "").startsWith("admin.")).length;
                        const overdueNow = tasks.filter(t => t.dueDate && new Date(t.dueDate).getTime() < Date.now() && t.status !== "done");
                        const overdueByPrio: Record<string, number> = {};
                        overdueNow.forEach(t => { overdueByPrio[t.priority] = (overdueByPrio[t.priority] || 0) + 1; });
                        setInsights({
                          totalActivity: fullActivity.length,
                          adminActions,
                          topContributors: topContribs,
                          overdueCount: overdueNow.length,
                          overdueByPriority: overdueByPrio,
                          lastAnalyzed: new Date().toLocaleTimeString(),
                        });
                        toast.success("Deep insights loaded");
                      } catch (e) {
                        // Fallback to local recent
                        const contribMap: Record<string, number> = {};
                        recentActivity.forEach((a: any) => { const k = a.userId || "anon"; contribMap[k] = (contribMap[k] || 0) + 1; });
                        setInsights({ totalActivity: recentActivity.length, topContributors: Object.entries(contribMap).sort((a,b)=>b[1]-a[1]).slice(0,5), overdueCount: tasks.filter(t=>t.dueDate && new Date(t.dueDate)<new Date() && t.status!=="done").length, lastAnalyzed: "local (limited)" });
                      } finally {
                        setIsLoadingInsights(false);
                      }
                    }}
                    disabled={isLoadingInsights}
                    className="btn btn-ghost text-xs px-3 py-1 flex gap-1"
                  >
                    <BarChart3 className="h-3.5 w-3.5" /> {isLoadingInsights ? "Analyzing..." : "Load / Refresh Deep Insights"}
                  </button>
                </div>

                {insights ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                      <div className="text-xs text-[#71717a] mb-1">Activity &amp; Admin Volume</div>
                      <div className="text-xl font-semibold">{insights.totalActivity} total events • {insights.adminActions || 0} admin actions</div>
                      <div className="text-[10px] mt-1 text-[#a1a1aa]">Last analyzed: {insights.lastAnalyzed}</div>
                    </div>
                    <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                      <div className="text-xs text-[#71717a] mb-1">Overdue Trends</div>
                      <div className="text-xl font-semibold text-[#ff3366]">{insights.overdueCount} overdue now</div>
                      <div className="text-xs mt-1">By priority: {Object.entries(insights.overdueByPriority || {}).map(([p,c]) => `${p}:${c}`).join("  ") || "—"}</div>
                    </div>
                    <div className="bg-white/5 rounded-xl p-3 border border-white/10 md:col-span-2">
                      <div className="text-xs text-[#71717a] mb-1.5">Top Contributors (by actions in activity log)</div>
                      {insights.topContributors?.length ? (
                        <div className="flex flex-wrap gap-2">
                          {insights.topContributors.map(([user, count]: [string, number], i: number) => (
                            <div key={i} className="px-2 py-0.5 bg-white/10 rounded text-xs font-mono">{user.slice(0, 12)}: <span className="text-[#c084fc]">{count}</span></div>
                          ))}
                        </div>
                      ) : <div className="text-xs">No activity data yet.</div>}
                      <div className="text-[10px] text-[#71717a] mt-2">Contributions include all actions (tasks, notes, comments, admin ops). Great for spotting active leads.</div>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-[#a1a1aa]">Click “Load / Refresh Deep Insights” for member contribution breakdown, overdue trends by priority, and admin action counts. Uses up to 500 recent events for accuracy.</div>
                )}
              </div>
            )}

            {/* Footer bar for admin section */}
            <div className="px-5 py-3 border-t border-white/10 bg-white/[0.02] flex flex-wrap items-center justify-between gap-2 text-[10px] text-[#71717a]">
              <div>Powerful admin tools for team leads. All actions (export, import, template apply, role changes) create immutable audit logs via <span className="font-mono">admin.*</span> events.</div>
              {myRole === "owner" && (
                <button onClick={openWorkspaceSettings} className="text-[#c084fc] hover:underline flex items-center gap-1">
                  Open Core Workspace Settings (name, slug, delete) <Settings className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Role enforcement notice */}
        {!canManage && isLive && !isDemoWs && (
          <div className="text-xs text-[#71717a] px-1">You are a regular member. Only workspace owners and admins can invite or manage members.</div>
        )}

        {/* Basic permissions visibility note (E04) */}
        {isLive && !isDemoWs && (
          <div className="text-[10px] text-[#71717a] px-1 pt-2">Activity, tasks & notes are visible to all workspace members (RLS). Full management requires owner/admin role.</div>
        )}

        {/* Invite Dialog (inline glass modal) */}
        {showInviteDialog && (
          <div className="fixed inset-0 z-[220] flex items-center justify-center bg-black/80 p-4" onClick={() => setShowInviteDialog(false)}>
            <div className="glass w-full max-w-md rounded-3xl p-6" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-4">
                <div className="font-semibold text-xl tracking-tight">Invite to {currentWorkspace.name}</div>
                <button onClick={() => setShowInviteDialog(false)} aria-label="Close invite dialog" className="text-[#71717a] hover:text-white p-1 rounded focus:outline-none focus:ring-1 focus:ring-white/30"><X className="h-5 w-5" /></button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs text-[#a1a1aa] block mb-1.5">Email (optional)</label>
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="teammate@company.com (leave blank for link-only)"
                    className="w-full bg-[#111114] border border-white/20 focus:border-[#c084fc] rounded-xl px-4 py-3 text-sm outline-none"
                    disabled={isSendingInvite}
                  />
                </div>
                <div>
                  <label className="text-xs text-[#a1a1aa] block mb-1.5">Role</label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as any)}
                    className="w-full bg-[#111114] border border-white/20 rounded-xl px-4 py-3 text-sm"
                    disabled={isSendingInvite}
                  >
                    <option value="user">User (default)</option>
                    <option value="admin">Admin</option>
                    <option value="owner">Owner</option>
                  </select>
                </div>

                <div className="pt-2 flex gap-3">
                  <button
                    onClick={() => setShowInviteDialog(false)}
                    className="flex-1 btn btn-secondary py-3"
                    disabled={isSendingInvite}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSendInvite}
                    disabled={isSendingInvite}
                    className="flex-1 btn btn-primary py-3 disabled:opacity-60"
                  >
                    {isSendingInvite ? "Creating..." : "Create & Copy Invite Link"}
                  </button>
                </div>
                <div className="text-[11px] text-[#71717a] text-center">Link expires in 14 days. Recipient must sign in to accept.</div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const currentViewComponent = () => {
    switch (currentView) {
      case "today": return renderTodayView();
      case "tasks": return renderTasksView();
      case "notes": return renderNotesView();
      case "calendar": return renderCalendarView();
      case "teams": return renderTeamsView();
      default: return renderTasksView();
    }
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#0a0a0f] text-[#f4f4f5]">
      {/* Top Bar — responsive compaction on mobile via .top-bar */}
      <div className="top-bar h-16 border-b border-white/10 flex items-center px-5 justify-between z-50 bg-[#0a0a0f]/95 backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-[#c084fc] to-[#a855f7] flex items-center justify-center">
              <Check className="h-4.5 w-4.5 text-black" />
            </div>
            <div>
              <div className="font-semibold tracking-[-0.3px] text-[17px]">Bad Ass Tasks</div>
            </div>
          </div>

          {/* Workspace Switcher */}
          <div ref={workspaceMenuRef} className="relative">
            <button 
              onClick={() => {
                const nextOpen = !showWorkspaceMenu;
                setShowWorkspaceMenu(nextOpen);
                if (!nextOpen) {
                  // Reset creation flow when closing menu (keeps state clean)
                  setIsCreatingWorkspace(false);
                  setNewWorkspaceName("");
                }
              }}
              className="flex items-center gap-2 text-sm px-3 py-1.5 rounded-xl hover:bg-white/5 border border-white/10"
            >
              <span className="flex items-center gap-1.5">
                {currentWorkspace.name}
                {!isSingleOwnerWorkspace && (
                  <span className="text-[9px] px-1 py-px rounded bg-white/5 text-[#a1a1aa] font-mono tracking-widest">{currentWorkspace.role}</span>
                )}
              </span>
              <ChevronRight className="h-3 w-3 rotate-90" />
            </button>

            <AnimatePresence>
              {showWorkspaceMenu && (
                <div ref={workspaceMenuRef} className="absolute top-12 left-0 glass rounded-2xl py-1 w-56 shadow-xl z-50 border border-white/10">
                  {workspaces.map((ws) => (
                    <button 
                      key={ws.id}
                      onClick={() => { switchWorkspace(ws.id); setShowWorkspaceMenu(false); }}
                      className={cn("w-full text-left px-4 py-2.5 text-sm hover:bg-white/5 flex justify-between items-center", ws.id === currentWorkspace.id && "text-[#c084fc]")}
                    >
                      <span className="flex items-center gap-1.5">
                        {ws.name}
                        {!(ws.id === currentWorkspace.id && isSingleOwnerWorkspace) && (
                          <span className="text-[10px] px-1.5 py-px rounded bg-white/5 text-[#71717a] font-mono tracking-widest">{ws.role}</span>
                        )}
                      </span>
                      {ws.id === currentWorkspace.id && <Check className="h-3.5 w-3.5" />}
                    </button>
                  ))}
                  <div className="border-t border-white/10 my-1" />
                  
                  {/* Production workspace creation (real DB via RPC when LIVE; role=owner on create). Inline for zero-friction multi-ws. */}
                  {!isCreatingWorkspace ? (
                    <button
                      onClick={() => {
                        setIsCreatingWorkspace(true);
                        setNewWorkspaceName("");
                      }}
                      className="w-full text-left px-4 py-2 text-xs text-[#c084fc] hover:bg-white/5 flex items-center gap-2"
                    >
                      <Plus className="h-3.5 w-3.5" /> Create new workspace
                    </button>
                  ) : (
                    <div className="px-3 py-2">
                      <input
                        type="text"
                        value={newWorkspaceName}
                        onChange={(e) => setNewWorkspaceName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !isCreatingLoading) {
                            handleCreateWorkspace();
                          }
                          if (e.key === "Escape") {
                            setIsCreatingWorkspace(false);
                            setNewWorkspaceName("");
                          }
                        }}
                        placeholder="Workspace name (e.g. Client X)"
                        className="w-full bg-[#0a0a0f] border border-white/20 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-[#c084fc]/60 mb-2"
                        autoFocus
                        disabled={isCreatingLoading}
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={handleCreateWorkspace}
                          disabled={isCreatingLoading || !newWorkspaceName.trim()}
                          className="flex-1 btn btn-primary text-xs py-1.5 disabled:opacity-50"
                        >
                          {isCreatingLoading ? "Creating..." : "Create"}
                        </button>
                        <button
                          onClick={() => {
                            setIsCreatingWorkspace(false);
                            setNewWorkspaceName("");
                          }}
                          disabled={isCreatingLoading}
                          className="flex-1 text-xs py-1.5 rounded-lg border border-white/15 hover:bg-white/5"
                        >
                          Cancel
                        </button>
                      </div>
                      <div className="text-[10px] text-[#71717a] mt-1.5 px-1">
                        {isSupabaseConfigured() ? "Saved to your Supabase account" : "Demo only (local)"}
                      </div>
                    </div>
                  )}
                  {/* Workspace settings entry (owner only, live) - opens modal for name/slug/delete */}
                  {myRole === "owner" && isLiveWorkspace && (
                    <button
                      onClick={openWorkspaceSettings}
                      className="w-full text-left px-4 py-2 text-xs text-[#a1a1aa] hover:bg-white/5 flex items-center gap-2 border-t border-white/10 mt-1"
                    >
                      <Settings className="h-3.5 w-3.5" /> Workspace settings
                    </button>
                  )}
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="flex items-center gap-3 text-sm">
          {/* Agent 31: Notification bell (non-intrusive, timely badge + dropdown) */}
          <div ref={notificationsRef} className="relative">
            <button
              onClick={() => {
                const next = !showNotifications;
                setShowNotifications(next);
                if (next) {
                  fetchNotifications?.(false).catch(() => {});
                  refreshUnreadCount?.().catch(() => {});
                }
              }}
              className="btn btn-ghost h-9 w-9 p-0 flex items-center justify-center rounded-full hover:bg-white/10 border border-white/10 relative transition"
              title="Notifications"
              aria-label="Notifications"
            >
              <Bell className="h-4 w-4" />
              {unreadNotifCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-[#ff3366] text-[10px] font-mono text-white flex items-center justify-center ring-1 ring-[#0a0a0f]">
                  {unreadNotifCount > 9 ? '9+' : unreadNotifCount}
                </span>
              )}
            </button>
            <AnimatePresence>
              {showNotifications && (
                <div
                  ref={notificationsRef}
                  className="absolute right-0 top-12 w-80 glass-strong rounded-2xl border border-white/10 shadow-2xl z-[260] overflow-hidden bg-[#111114]"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between bg-[#0a0a0f]">
                    <div className="font-semibold text-sm tracking-tight flex items-center gap-2">
                      <Bell className="h-4 w-4" /> Notifications
                    </div>
                    <div className="flex items-center gap-2">
                      {unreadNotifCount > 0 && (
                        <button
                          onClick={() => markAllNotifsRead?.()}
                          className="text-[10px] px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-[#c084fc]"
                        >
                          Mark all read
                        </button>
                      )}
                      {notifications.length > 0 && (
                        <button
                          onClick={() => clearAllNotifications?.()}
                          className="text-[10px] px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-red-400 hover:text-red-500"
                        >
                          Clear all
                        </button>
                      )}
                      <button onClick={() => setShowNotifications(false)} aria-label="Close notifications panel" className="text-[#71717a] hover:text-white p-1 rounded focus:outline-none focus:ring-1 focus:ring-white/30"><X className="h-4 w-4" /></button>
                    </div>
                  </div>
                  <div className="max-h-[320px] overflow-auto p-1 text-sm">
                    {isLoadingNotifications ? (
                      <div className="p-4 text-center text-[#71717a] text-xs">Loading…</div>
                    ) : notifications.length === 0 ? (
                      <div className="p-6 text-center text-[#71717a] text-xs">All clear. No notifications yet.<br />@mentions, comments &amp; invites will appear here.</div>
                    ) : (
                      notifications.slice(0, 20).map((n: Notification) => (
                        <div
                          key={n.id}
                          onClick={() => {
                            if (!n.readAt) markNotifRead?.(n.id);
                            setSelectedNotification(n);
                            setShowNotifications(false);
                          }}
                          className={cn(
                            "px-3 py-2.5 rounded-xl m-1 cursor-pointer border border-white/10 bg-[#0f0f12] hover:bg-[#1a1a1f] flex gap-2 transition-colors",
                            !n.readAt && "bg-[#c084fc]/10 border-[#c084fc]/30"
                          )}
                        >
                          <div className="mt-0.5 text-[#c084fc]/80 shrink-0">
                            {n.type === 'mention' && <Zap className="h-3.5 w-3.5" />}
                            {n.type === 'comment' && <Star className="h-3.5 w-3.5" />}
                            {n.type === 'invite' && <Users className="h-3.5 w-3.5" />}
                            {n.type === 'task_assigned' && <Check className="h-3.5 w-3.5" />}
                            {n.type === 'deadline' && <Clock className="h-3.5 w-3.5" />}
                            {n.type === 'activity' && <Zap className="h-3.5 w-3.5" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="font-medium text-xs truncate">{n.title}</div>
                            <div className="text-[11px] text-[#a1a1aa] line-clamp-2">{n.message}</div>
                            <div className="text-[9px] text-[#71717a] mt-0.5">{new Date(n.createdAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</div>
                          </div>
                          {!n.readAt && <div className="w-1.5 h-1.5 mt-1.5 rounded-full bg-[#c084fc] shrink-0" />}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteNotification?.(n.id);
                            }}
                            className="ml-1 p-1 text-[#71717a] hover:text-white rounded hover:bg-white/10"
                            aria-label="Remove notification"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="p-2 border-t border-white/10 bg-black/20 text-[10px] text-center text-[#71717a]">
                    Timely • Non-intrusive • Powered by activity logs
                  </div>
                </div>
              )}
            </AnimatePresence>
          </div>

          <div 
            onClick={() => toggleCommandPalette(true)}
            className="hidden md:flex items-center gap-2 bg-white/5 hover:bg-white/10 transition px-3 py-1.5 rounded-2xl cursor-pointer border border-white/10"
          >
            <Command className="h-3.5 w-3.5" />
            <span className="text-[#71717a]">⌘K</span>
          </div>

          <button onClick={handleAddFromNatural} className="btn btn-primary text-xs px-4 py-2">
            <Plus className="h-3.5 w-3.5" /> QUICK ADD
          </button>

          {/* Polished Auth + User Area (Phase 1 UX track) */}
          {isAuthLoading ? (
            <div className="flex items-center gap-2 rounded-full bg-white/5 border border-white/10 px-3 py-1.5 text-xs text-[#71717a]">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-[#c084fc]" />
              <span className="hidden md:inline">Authenticating…</span>
            </div>
          ) : user ? (
            <div className="flex items-center gap-1.5">
              {/* User avatar + identity pill — clickable to edit profile (name, username, location) */}
              <div
                onClick={() => setShowProfilePopover(true)}
                className="group flex items-center gap-2 pl-1.5 pr-3 py-1 rounded-full bg-white/5 border border-white/10 hover:border-[#c084fc]/40 transition-all cursor-pointer active:scale-[0.985]"
                title="Click to edit your profile (name, username, location)"
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setShowProfilePopover(true); } }}
              >
                <div className="h-6 w-6 flex-shrink-0 rounded-full bg-gradient-to-br from-[#c084fc] to-[#a855f7] flex items-center justify-center text-[10px] font-bold text-black ring-1 ring-inset ring-white/30 shadow-sm">
                  {user.email ? user.email.charAt(0).toUpperCase() : <User className="h-3.5 w-3.5" />}
                </div>
                <div className="hidden md:block text-xs text-[#a1a1aa] max-w-[110px] truncate font-medium">
                  {(() => {
                    const self = members.find((m) => m.userId === user?.id);
                    const handle = self?.username ? `@${self.username}` : null;
                    return handle || self?.fullName || user.email?.split("@")[0] || "You";
                  })()}
                </div>
              </div>

              {/* Sign out action */}
              <button
                onClick={() => signOut()}
                className="btn btn-ghost h-8 w-8 p-0 flex items-center justify-center rounded-full hover:bg-white/5 hover:text-[#ff00aa] transition"
                title="Sign out"
                aria-label="Sign out"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowAuthModal(true)}
              className="btn btn-secondary text-xs px-4 py-2 hidden md:flex items-center gap-1.5"
            >
              <User className="h-3.5 w-3.5" /> Sign in
            </button>
          )}

          {/* Profile Popover — triggered by clicking the top-right avatar + name pill */}
          {showProfilePopover && user && (
            <div 
              className="absolute right-4 top-14 w-80 glass rounded-2xl border border-white/10 shadow-2xl z-[260] p-5 text-sm"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="font-semibold tracking-tight flex items-center gap-2">
                  <User className="h-4 w-4 text-[#c084fc]" /> Your profile
                </div>
                <button onClick={() => setShowProfilePopover(false)} className="text-[#71717a] hover:text-white p-1" aria-label="Close profile editor">
                  <X className="h-4 w-4" />
                </button>
              </div>

              {(() => {
                const selfMember = members.find((m) => m.userId === user.id);
                const nameVal = profileFullName || selfMember?.fullName || "";
                const userVal = profileUsername || selfMember?.username || "";
                const locVal  = profileLocation  || selfMember?.location  || "";

                const save = async () => {
                  setIsSavingProfile(true);
                  try {
                    const ok = await updateMyProfile({
                      fullName: profileFullName || undefined,
                      username: profileUsername || undefined,
                      location: profileLocation || undefined,
                    });
                    if (ok) {
                      setProfileFullName("");
                      setProfileUsername("");
                      setProfileLocation("");
                      setShowProfilePopover(false);
                    }
                  } finally {
                    setIsSavingProfile(false);
                  }
                };

                return (
                  <>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-[10px] uppercase tracking-widest text-[#71717a] mb-1">Full name</label>
                        <input
                          type="text"
                          value={nameVal}
                          onChange={(e) => setProfileFullName(e.target.value)}
                          placeholder="Alex Rivera"
                          className="input w-full px-3 py-2 text-sm rounded-xl"
                          disabled={isSavingProfile || !isLiveWorkspace || ["w1", "w2"].includes(currentWorkspace.id)}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase tracking-widest text-[#71717a] mb-1">Username / handle</label>
                        <div className="flex items-center gap-1">
                          <span className="text-[#a1a1aa] px-2">@</span>
                          <input
                            type="text"
                            value={userVal}
                            onChange={(e) => setProfileUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                            placeholder="alexr"
                            className="input flex-1 px-3 py-2 text-sm rounded-xl font-mono"
                            disabled={isSavingProfile || !isLiveWorkspace || ["w1", "w2"].includes(currentWorkspace.id)}
                          />
                        </div>
                        <div className="text-[10px] text-[#71717a] mt-0.5">Used as @handle in the interface</div>
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase tracking-widest text-[#71717a] mb-1">Where you're from</label>
                        <input
                          type="text"
                          value={locVal}
                          onChange={(e) => setProfileLocation(e.target.value)}
                          placeholder="San Francisco, CA or Remote"
                          className="input w-full px-3 py-2 text-sm rounded-xl"
                          disabled={isSavingProfile || !isLiveWorkspace || ["w1", "w2"].includes(currentWorkspace.id)}
                        />
                      </div>
                    </div>

                    <div className="mt-4 flex items-center gap-2">
                      <button
                        onClick={save}
                        disabled={isSavingProfile || !isLiveWorkspace || ["w1", "w2"].includes(currentWorkspace.id)}
                        className="btn btn-primary text-xs px-4 py-1.5 disabled:opacity-50"
                      >
                        {isSavingProfile ? "Saving..." : "Save changes"}
                      </button>
                      <button onClick={() => setShowProfilePopover(false)} className="btn btn-ghost text-xs px-3 py-1.5">
                        Cancel
                      </button>
                      {!isLiveWorkspace && <span className="text-[10px] text-[#c084fc]">Live connection required to save</span>}
                    </div>
                  </>
                );
              })()}
            </div>
          )}

          {/* LIVE / DEMO status badge — now strictly gated to real authenticated user (user requirement) */}
          <div className="pl-1 flex items-center gap-1.5 text-[10px] font-mono tracking-[1px] text-[#71717a] border-l border-white/10 ml-1 pl-3">
            <div 
              className={cn(
                "h-1.5 w-1.5 rounded-full transition-all",
                isTrulyLive 
                  ? "bg-[#c084fc] shadow-[0_0_6px_#c084fc]" 
                  : "bg-[#71717a] animate-pulse"
              )} 
            />
            <span className={isTrulyLive ? "text-[#c084fc]" : ""}>
              {isTrulyLive ? "LIVE" : "DEMO"}
            </span>
          </div>

          {/* PWA Install Prompt (polished Agent 27) — visible on phones/tablets when eligible (beforeinstallprompt).
              On desktop rarely fires so hidden naturally. Persistent hint added to Command Palette.
              Tap triggers native + haptic. Now correctly shows on narrow viewports.
          */}
          {showInstallPrompt && (
            <button
              onClick={() => {
                triggerHaptic('light');
                handleInstallApp();
              }}
              className="btn btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5 lg:hidden active:scale-95"
              title="Install Bad Ass Tasks for offline + home screen access"
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden md:inline">Install</span>
            </button>
          )}

          {/* Mobile-first advanced offline UX: sync status + tap-to-force-sync (uses existing store flags + queue).
              Glass pill, safe-area friendly, visible on mobile or when pending/offline. */}
          {(syncDisplay.pendingSyncCount > 0 || !syncDisplay.isOnline || syncDisplay.isSyncing) && (
            <button
              onClick={async () => {
                triggerHaptic('light');
                if (syncPendingWrites) {
                  await syncPendingWrites();
                } else if (refreshOfflineStatus) {
                  refreshOfflineStatus();
                }
                toast(syncDisplay.isOnline ? (syncDisplay.pendingSyncCount > 0 ? "Syncing pending writes..." : "Already in sync") : "Offline — changes will queue", {
                  description: syncDisplay.pendingSyncCount > 0 ? `${syncDisplay.pendingSyncCount} operation${syncDisplay.pendingSyncCount === 1 ? '' : 's'} pending` : undefined,
                });
              }}
              className={cn(
                "sync-indicator text-[10px] px-2.5 py-1 active:scale-95 md:hidden",
                !syncDisplay.isOnline ? "offline" : syncDisplay.isSyncing ? "syncing" : syncDisplay.pendingSyncCount > 0 ? "offline" : "online"
              )}
              title={syncDisplay.isOnline ? `${syncDisplay.pendingSyncCount} pending` : "Offline mode"}
            >
              {!syncDisplay.isOnline ? (
                <>📡 Offline</>
              ) : syncDisplay.isSyncing ? (
                <>⟳ Syncing</>
              ) : syncDisplay.pendingSyncCount > 0 ? (
                <>↑ {syncDisplay.pendingSyncCount} sync</>
              ) : (
                <>✓ Synced</>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Agent 32: The Knowledge Graph modal — visual, interactive, with hybrid suggestions for magical linking */}
      <KnowledgeGraph
        open={isGraphOpen}
        onClose={() => { setIsGraphOpen(false); setGraphFocusId(null); }}
        tasks={tasks}
        notes={notes}
        onOpenItem={(type, id) => {
          if (type === 'task') {
            setView("tasks");
            selectTask(id);
            setShowFullTaskModal(true);
          } else {
            setView("notes");
            setSelectedNoteId(id);
          }
          setIsGraphOpen(false);
        }}
        onLinkItems={(fromType, fromId, toType, toId) => {
          // Maintain bidirectional using existing data model (expandable to note<->note later)
          if (fromType === 'note' && toType === 'task') {
            const note = notes.find(n => n.id === fromId);
            const task = tasks.find(t => t.id === toId);
            if (note && task) {
              const newNL = Array.from(new Set([...(note.linkedTaskIds || []), toId]));
              updateNote(fromId, { linkedTaskIds: newNL });
              const newTL = Array.from(new Set([...(task.linkedNoteIds || []), fromId]));
              updateTask(toId, { linkedNoteIds: newTL as any });
              toast.success("Linked bidirectionally", { description: "Graph & search now reflect the connection." });
            }
          } else if (fromType === 'task' && toType === 'note') {
            const task = tasks.find(t => t.id === fromId);
            const note = notes.find(n => n.id === toId);
            if (task && note) {
              const newTL = Array.from(new Set([...(task.linkedNoteIds || []), toId]));
              updateTask(fromId, { linkedNoteIds: newTL as any });
              const newNL = Array.from(new Set([...(note.linkedTaskIds || []), fromId]));
              updateNote(toId, { linkedTaskIds: newNL });
              toast.success("Linked bidirectionally", { description: "Graph & search now reflect the connection." });
            }
          }
        }}
        initialFocusId={graphFocusId}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar — improved a11y: navigation landmark + aria */}
        <aside className="sidebar w-64 hidden lg:flex flex-col pt-3 px-3 border-r border-white/10" aria-label="Workspace navigation and views">
          {/* Sidebar content starts here (unchanged inner structure for minimal diff) */}
          <div className="px-3 mb-4">
            <div className="text-xs text-[#71717a] font-medium tracking-widest mb-1.5 px-1">WORKSPACE</div>
            <div className="flex items-center gap-2 text-lg font-semibold tracking-tighter">
              {currentWorkspace.name}
              {!isSingleOwnerWorkspace && (
                <span 
                  className="text-[10px] px-1.5 py-0.5 rounded-md bg-white/5 text-[#c084fc] font-mono tracking-widest border border-white/10" 
                  title={canManage ? "You can manage members, invites & settings (owner/admin)" : "Read/view access. Manage in Teams view if owner/admin."}
                >
                  {currentWorkspace.role}
                </span>
              )}
              {!canManage && isLiveWorkspace && (
                <span 
                  className="text-[9px] text-[#71717a] font-mono cursor-help" 
                  title="Limited permissions: invites, role changes & workspace settings require owner/admin. All members can view tasks/notes/activity (RLS)."
                >
                  view
                </span>
              )}
            </div>
          </div>

          <div className="space-y-0.5 px-1">
            {VIEWS.map((v) => {
              const Icon = v.icon;
              const isActive = currentView === v.id;
              const handleSidebarNav = (e?: React.KeyboardEvent) => {
                if (e && e.key !== "Enter" && e.key !== " ") return;
                if (e) e.preventDefault();
                setView(v.id as any);
              };
              return (
                <div
                  key={v.id}
                  role="button"
                  tabIndex={0}
                  aria-current={isActive ? "page" : undefined}
                  onClick={() => setView(v.id as any)}
                  onKeyDown={handleSidebarNav}
                  className={cn("sidebar-item", isActive && "active")}
                >
                  <Icon className="h-4 w-4" />
                  {v.label}
                  {/* Agent 14: live cross-view presence indicator (who is in this view right now) */}
                  {(() => {
                    const viewUsers = (onlineUsers || []).filter((u: any) => u.view === v.id);
                    if (viewUsers.length === 0) return null;
                    const names = viewUsers.map((u:any) => u.email?.split('@')[0] || u.userId?.slice(0,5)).join(', ');
                    return (
                      <span className="ml-1.5 text-[9px] text-[#00ff9f] font-mono flex items-center gap-0.5" title={`${names} viewing ${v.label}`}>
                        ●{viewUsers.length}
                      </span>
                    );
                  })()}
                </div>
              );
            })}
          </div>

          <div className="mt-auto px-4 pb-6 text-[10px] text-[#71717a]">
            <div className="mb-1">Prototype v0.1</div>
            <div>Real-time sync + full backend coming next.</div>
          </div>
        </aside>

        {/* Main Content — mobile gets extra pb via .main-content + globals.css for bottom nav. a11y: main landmark */}
        <main className="main-content relative flex-1 overflow-auto p-6 lg:p-8">
          {/* Pull-to-refresh visual (mobile native, triggered by touch at scrollTop=0) */}
          {(pullDistance > 4 || isPullRefreshing) && (
            <div 
              className={cn(
                "pull-to-refresh-indicator",
                (pullDistance > 4 || isPullRefreshing) && "visible",
                isPullRefreshing && "refreshing"
              )}
              style={{ transform: `translateX(-50%) translateY(${Math.min(pullDistance * 0.6, 18)}px)` }}
              aria-live="polite"
            >
              {isPullRefreshing ? (
                <><span className="spinner" /> Refreshing…</>
              ) : pullDistance > 52 ? "Release to refresh" : "Pull to refresh"}
            </div>
          )}

          {/* Persistent received workspace invite banner (distinct from bell notifications).
             - Cannot be dismissed or marked read from here (only Accept/Decline removes it).
             - Shows full "Name (@username) invited you to join 'Workspace Name'".
             - Has direct Accept / Decline actions.
             - Stays visible across pages until action is taken.
          */}
          {user && pendingReceivedInvites.length > 0 && (
            <div className="mb-6 border border-[#c084fc]/50 bg-[#c084fc]/10 rounded-2xl p-5 flex flex-col gap-4">
              <div className="text-sm font-medium text-[#c084fc]">
                You have pending workspace invitation{pendingReceivedInvites.length > 1 ? 's' : ''}.
              </div>

              <div className="space-y-3">
                {pendingReceivedInvites.slice(0, 2).map((n: any) => {
                  const meta = n.metadata || {};
                  const fullName = meta.invited_by_full_name || meta.invited_by_name || 'Someone';
                  const username = meta.invited_by_username ? ` (@${meta.invited_by_username})` : '';
                  const wsName = meta.workspace_name || 'a workspace';
                  return (
                    <div key={n.id} className="text-sm text-[#e5e5e7]">
                      <span className="font-medium">{fullName}</span>{username} invited you to join{' '}
                      <span className="font-semibold">"{wsName}"</span>.
                    </div>
                  );
                })}
                {pendingReceivedInvites.length > 2 && (
                  <div className="text-xs text-[#a1a1aa]">+{pendingReceivedInvites.length - 2} more</div>
                )}
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  onClick={async () => {
                    const first = pendingReceivedInvites[0];
                    const inviteId = first?.metadata?.invite_id;
                    if (inviteId) {
                      await acceptInviteLink(inviteId);

                      // Remove the invite notification(s) that were powering this banner
                      const toDelete = pendingReceivedInvites
                        .filter((n: any) => n.metadata?.invite_id === inviteId)
                        .map((n: any) => n.id);

                      for (const id of toDelete) {
                        await deleteNotification?.(id);
                      }

                      // Refresh everything
                      const store = useTaskStore.getState();
                      await Promise.all([
                        fetchNotifications?.().catch(() => {}),
                        store.fetchUserWorkspaces?.().catch(() => {}),
                      ]);
                    }
                  }}
                  className="btn btn-primary text-sm px-5 py-2"
                >
                  Accept
                </button>

                <button
                  onClick={async () => {
                    const first = pendingReceivedInvites[0];
                    const inviteId = first?.metadata?.invite_id;
                    if (inviteId) {
                      await declineReceivedInvite(inviteId);
                      // Extra safety net for the persistent banner after decline
                      const store = useTaskStore.getState();
                      await store.fetchNotifications?.().catch(() => {});
                    }
                  }}
                  className="px-4 py-2 text-sm rounded-xl border border-white/20 hover:bg-white/5 text-[#a1a1aa]"
                >
                  Decline
                </button>
              </div>
            </div>
          )}

          {/* Prototype Banner */}
          <div className="mb-6 rounded-2xl bg-[#111114] border border-[#c084fc]/20 px-5 py-3 text-sm flex items-center gap-3">
            <div className="text-[#c084fc]">⚡</div>
            <div className="flex-1 text-[#a1a1aa]">
              {isSupabaseConfigured() 
                ? "Connected to Supabase. You're running on real infrastructure."
                : "High-fidelity prototype mode. All data lives in your browser. Connect Supabase below to unlock auth + real-time sync."
              }
            </div>
            <button onClick={() => window.open("docs/bad-ass-tasks-prompt.md", "_blank")} className="text-xs underline text-[#c084fc] whitespace-nowrap">READ THE VISION</button>
          </div>

          {/* Clearer data loading state (Phase 1 UX polish) — visible but non-blocking */}
          <AnimatePresence>
            {isInitializing && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="mb-4 flex items-center gap-3 rounded-2xl border border-[#c084fc]/20 bg-[#111114] px-4 py-2.5 text-sm text-[#a1a1aa]"
              >
                <Loader2 className="h-4 w-4 animate-spin text-[#c084fc] flex-shrink-0" />
                <div className="flex-1">
                  {user 
                    ? "Syncing your tasks and workspace from Supabase…" 
                    : "Loading data…"}
                </div>
                <div className="text-[10px] font-mono text-[#71717a] hidden sm:block">LIVE MODE</div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Graceful edge case: logged in but no workspaces (future-proof for real auth) — ensureUserHasWorkspace + manual create supported */}
          {user && workspaces.length === 0 && !isInitializing && (
            <div className="mb-4 rounded-2xl border border-[#ff9500]/30 bg-[#111114] p-5 text-sm">
              <div className="flex items-start gap-3">
                <div className="text-[#ff9500] mt-0.5">⚠️</div>
                <div className="flex-1">
                  <div className="font-medium text-[#f4f4f5]">No workspaces yet</div>
                  <div className="text-[#a1a1aa] mt-0.5 text-xs">
                    A default should appear automatically. Or create one now:
                  </div>
                  <button
                    onClick={() => {
                      setShowWorkspaceMenu(true);
                      // Slight delay so menu renders before flipping to create input
                      setTimeout(() => {
                        setIsCreatingWorkspace(true);
                        setNewWorkspaceName("");
                      }, 50);
                    }}
                    className="mt-2 text-xs btn btn-secondary px-3 py-1"
                  >
                    + Create workspace manually
                  </button>
                </div>
              </div>
            </div>
          )}

          {currentViewComponent()}
        </main>

        {/* Right Context Panel */}
        <div className="hidden xl:flex w-80 border-l border-white/10 p-6 flex-col bg-[#0a0a0f]">
          <div className="text-xs tracking-[2px] text-[#71717a] mb-4">CONTEXT</div>

          {selectedTask ? (
            <div className="glass rounded-2xl p-5">
              <div className="font-semibold text-xl tracking-tighter pr-6">{selectedTask.title}</div>
              <div className="mt-4 flex gap-2">
                <div className={`priority-badge priority-${selectedTask.priority.toLowerCase()}`}>{selectedTask.priority}</div>
                <div className="status-pill status-doing">{selectedTask.status}</div>
              </div>

              {selectedTask.description && (
                <div className="mt-4 text-sm text-[#a1a1aa]">{selectedTask.description}</div>
              )}

              <div className="mt-6 space-y-3 text-sm">
                <div className="flex justify-between"><span className="text-[#71717a]">Assignee</span> <span>{selectedTask.assignee || "Unassigned"}</span></div>
                <div className="flex justify-between"><span className="text-[#71717a]">Due</span> <span>{selectedTask.dueDate ? format(new Date(selectedTask.dueDate), "EEEE, MMM d") : "—"}</span></div>
                <div className="flex justify-between"><span className="text-[#71717a]">Estimate</span> <span>{selectedTask.timeEstimate || "—"} min</span></div>
              </div>

              <div className="flex gap-2 mt-8">
                <button 
                  onClick={() => handleComplete(selectedTask.id)} 
                  disabled={!!taskLoadingStates?.[selectedTask.id]}
                  className="btn btn-primary flex-1 text-sm py-2.5 disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {taskLoadingStates?.[selectedTask.id] ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Mark done
                </button>
                <button 
                  onClick={async () => { await deleteTask(selectedTask.id); selectTask(null); }} 
                  disabled={!!taskLoadingStates?.[selectedTask.id]}
                  className="btn btn-secondary flex-1 text-sm py-2.5 disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {taskLoadingStates?.[selectedTask.id] ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Delete
                </button>
              </div>
            </div>
          ) : (
            <div>
              {/* Full production activity log panel — wired to real getRecentActivity (hybrid) + refreshRecentActivity when LIVE */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-xs tracking-[2px] text-[#71717a]">
                  <Zap className="h-3.5 w-3.5" />
                  ACTIVITY LOG
                </div>
                {user && isSupabaseConfigured() && (
                  <button
                    onClick={handleRefreshActivity}
                    disabled={isRefreshingActivity}
                    className="text-[10px] text-[#c084fc] hover:text-white flex items-center gap-1 disabled:opacity-50 transition"
                    title="Refresh activity from DB"
                  >
                    {isRefreshingActivity ? <Loader2 className="h-3 w-3 animate-spin" /> : "↻"} refresh
                  </button>
                )}
              </div>

              {recentActivity && recentActivity.length > 0 ? (
                <div className="space-y-1.5 text-[11px] max-h-[280px] overflow-auto pr-1 border border-white/5 rounded-xl p-1 bg-black/20">
                  {recentActivity.slice(0, 15).map((log: ActivityLog) => {
                    const action = log.actionType || "";
                    let Icon = Zap;
                    if (action.includes("task.completed") || action.includes("complete")) Icon = Check;
                    else if (action.includes("created") || action.includes("task.")) Icon = Plus;
                    else if (action.includes("workspace")) Icon = Users;
                    else if (action.includes("note")) Icon = Star;
                    return (
                      <div key={log.id} className="rounded-lg bg-white/[0.025] border border-white/5 px-3 py-2 flex gap-2">
                        <div className="mt-0.5 text-[#c084fc]/70"><Icon className="h-3.5 w-3.5" /></div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-[#e4e4e7] tracking-tight text-xs">{action.replace(/\./g, " ")}</div>
                          {(log.metadata as any)?.title ? (
                            <div className="text-[#a1a1aa] truncate text-[10px] mt-0.5">{String((log.metadata as any).title)}</div>
                          ) : null}
                          <div className="text-[#71717a] mt-1 text-[9px] tabular-nums flex items-center gap-1">
                            {format(new Date(log.createdAt), "MMM d, HH:mm")}
                            {log.userId ? <span className="opacity-50">· by {log.userId.slice(0, 8)}</span> : null}
                            {(log.metadata as any)?.priority ? <span className="opacity-60">· {String((log.metadata as any).priority)}</span> : null}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-xs text-[#71717a] leading-snug rounded-xl border border-white/5 bg-black/10 p-3">
                  {user && isSupabaseConfigured() 
                    ? "No activity yet in this workspace. Create tasks/notes or switch workspaces to populate the log (persisted via Supabase + RLS). All members can view activity in this workspace." 
                    : "Activity logging is enabled only in LIVE Supabase mode. Demo runs without persistent logs."}
                </div>
              )}

              <div className="h-px bg-white/10 my-6" />
              <div className="text-[#c084fc] text-xs">PRO TIP</div>
              Press <span className="font-mono text-white">⌘K</span> for the command palette. It can do almost everything.
            </div>
          )}

          <div className="mt-auto pt-8 text-[10px] text-[#71717a] leading-snug">
            Built with love for people who ship.<br />Neon green + pink. Zero friction. 60fps everything.
          </div>
        </div>
      </div>

      {/* Mobile Bottom Navigation — native iOS/Android style, only <md via CSS + md:hidden
          Reuses existing VIEWS + setView from store. No desktop impact. Touch-optimized via globals.css
      */}
      <nav className="bottom-nav md:hidden border-t border-white/10" aria-label="Primary navigation">
        {VIEWS.map((v) => {
          const Icon = v.icon;
          const isActive = currentView === v.id;
          const label = v.id === "calendar" ? "Cal" : v.label;
          return (
            <div
              key={v.id}
              role="button"
              tabIndex={0}
              aria-current={isActive ? "page" : undefined}
              onClick={() => {
                triggerHaptic('light');
                setView(v.id as any);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  triggerHaptic('light');
                  setView(v.id as any);
                }
              }}
              className={cn("bottom-nav-item", isActive && "active")}
            >
              <Icon className="icon" />
              <span className="font-medium tracking-tight">{label}</span>
            </div>
          );
        })}
      </nav>

      {/* Mobile FAB — prominent, native position (bottom-right above bottom nav on phones).
          Uses existing handleAddFromNatural (prompt + natural language parse + addTask + toast + switch to tasks).
          Styled + hidden on desktop via globals.css .fab + @media. Touch optimized (56px, active scale).
      */}
      <button
        onClick={() => {
          triggerHaptic('medium');
          handleAddFromNatural();
        }}
        className="fab md:hidden"
        aria-label="Add new task"
        title="Quick add task (natural language supported)"
      >
        <Plus className="h-7 w-7" />
      </button>

      {/* Floating Quick Add Bar (Tasks view) — hidden on mobile (replaced by prominent FAB + bottom nav) */}
      <AnimatePresence>
        {(showAddInput || currentView === "tasks") && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-lg px-4 hidden md:block">
            {!showAddInput ? (
              <button 
                onClick={() => setShowAddInput(true)}
                className="w-full glass py-3 rounded-2xl text-sm flex items-center justify-center gap-2 border border-white/10 hover:border-[#c084fc]/40 active:scale-[0.985] transition"
              >
                <Plus className="h-4 w-4" /> Add task (⌘N) — supports natural language
              </button>
            ) : (
              <form onSubmit={handleQuickAdd} className="glass rounded-2xl p-1 border border-[#c084fc]/30">
                <input
                  id="quick-add"
                  value={quickAddValue}
                  onChange={(e) => setQuickAddValue(e.target.value)}
                  placeholder='Type anything... "Finish proposal by Friday P0 @investors"'
                  className="w-full bg-transparent px-5 py-3.5 text-sm outline-none placeholder:text-[#71717a]"
                  autoFocus
                />
              </form>
            )}
          </div>
        )}
      </AnimatePresence>

      {/* Command Palette */}
      <CommandPalette 
        open={isCommandPaletteOpen} 
        onOpenChange={(o) => toggleCommandPalette(o)} 
      />

      {/* Confetti on completions */}
      <Confetti trigger={confettiTrigger} />

      {/* Supabase connection helper (self-gating; only renders in !live demo mode) */}
      <SupabaseSetupBanner />

      {/* Auth Modal */}
      <AuthModal 
        isOpen={showAuthModal} 
        onClose={() => setShowAuthModal(false)}
        onSuccess={() => {
          const live = isSupabaseConfigured();
          toast.success(live ? "Synced with Supabase" : "Welcome back!", { 
            description: live 
              ? "You're now in LIVE mode. Data persists across devices & refreshes." 
              : "Demo login complete. Add Supabase keys for the real experience.",
            duration: 4000,
          });
        }}
      />

      {selectedTask && (
        <TaskModal 
          task={selectedTask} 
          isOpen={showFullTaskModal} 
          onClose={() => {
            setShowFullTaskModal(false);
            // Keep the selection so right panel still shows context
          }} 
        />
      )}

      {/* Note: rich detail is now inline inside renderNotesView() using TipTapEditor (legacy modal removed) */}

      {/* Workspace Settings Modal (owner-gated, accessible from switcher dropdown in any view) */}
      {showWorkspaceSettings && (
        <div className="fixed inset-0 z-[230] flex items-center justify-center bg-black/80 p-4" onClick={() => setShowWorkspaceSettings(false)}>
          <div className="glass w-full max-w-md rounded-3xl p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <div className="font-semibold text-xl tracking-tight flex items-center gap-2">
                <Settings className="h-5 w-5 text-[#c084fc]" /> Workspace Settings
              </div>
              <button onClick={() => setShowWorkspaceSettings(false)} aria-label="Close workspace settings" className="text-[#71717a] hover:text-white p-1 rounded focus:outline-none focus:ring-1 focus:ring-white/30"><X className="h-5 w-5" /></button>
            </div>

            <div className="space-y-5 text-sm">
              <div>
                <label className="text-xs text-[#a1a1aa] block mb-1.5">Name</label>
                <input
                  value={settingsName}
                  onChange={(e) => setSettingsName(e.target.value)}
                  className="w-full bg-[#111114] border border-white/20 focus:border-[#c084fc] rounded-xl px-4 py-2.5 text-sm"
                  disabled={isSavingSettings || myRole !== "owner"}
                />
              </div>
              <div>
                <label className="text-xs text-[#a1a1aa] block mb-1.5">Slug (unique URL-friendly ID)</label>
                <input
                  value={settingsSlug}
                  onChange={(e) => setSettingsSlug(e.target.value)}
                  className="w-full bg-[#111114] border border-white/20 focus:border-[#c084fc] rounded-xl px-4 py-2.5 text-sm font-mono"
                  disabled={isSavingSettings || myRole !== "owner"}
                />
                <div className="text-[10px] text-[#71717a] mt-1">Changing slug may affect bookmarks/invites. Use caution.</div>
              </div>

              <div className="flex gap-3 pt-1">
                <button onClick={() => setShowWorkspaceSettings(false)} className="flex-1 btn btn-secondary py-2.5" disabled={isSavingSettings}>Cancel</button>
                <button onClick={handleSaveWorkspaceSettings} disabled={isSavingSettings || myRole !== "owner"} className="flex-1 btn btn-primary py-2.5 disabled:opacity-60">
                  {isSavingSettings ? "Saving..." : "Save changes"}
                </button>
              </div>

              {/* Danger zone for owners */}
              {myRole === "owner" && (
                <div className="pt-4 border-t border-red-500/20">
                  <div className="text-xs uppercase tracking-widest text-red-400 mb-2">Danger Zone</div>
                  <div className="text-[11px] text-[#a1a1aa] mb-2">Deleting removes the workspace, all tasks, notes, members and invites permanently.</div>
                  <input
                    value={deleteConfirmName}
                    onChange={(e) => setDeleteConfirmName(e.target.value)}
                    placeholder={`Type "${currentWorkspace.name}" to confirm`}
                    className="w-full bg-[#111114] border border-red-500/30 rounded-xl px-3 py-2 text-xs mb-2"
                  />
                  <button
                    onClick={handleDeleteWorkspace}
                    disabled={isSavingSettings || deleteConfirmName.trim() !== currentWorkspace.name}
                    className="w-full py-2 rounded-xl bg-red-600/90 hover:bg-red-600 text-white text-xs font-medium disabled:opacity-50"
                  >
                    Delete Workspace Forever
                  </button>
                </div>
              )}
            </div>
            <div className="text-[10px] text-[#71717a] text-center mt-4">Only owners see this. Changes sync live via Supabase.</div>
          </div>
        </div>
      )}

      {/* Floating AI button (Phase 7) — .ai-fab for mobile repositioning above nav */}
      <button
        onClick={() => setShowAIChat(!showAIChat)}
        className="ai-fab fixed bottom-6 right-6 z-[80] btn btn-primary px-5 py-3 rounded-2xl flex items-center gap-2 shadow-xl md:bottom-6 md:right-6"
      >
        <Sparkles className="h-4 w-4" /> AI
      </button>

      {showAIChat && <AIChatPanel onClose={() => setShowAIChat(false)} />}

      {/* Keyboard Cheatsheet - beautiful discoverable modal, keyboard-first (triggered by ? or palette) */}
      {isKeyboardCheatsheetOpen && (
        <div className="fixed inset-0 z-[110] flex items-end md:items-center justify-center p-4 md:p-4">
          <div 
            className="fixed inset-0 bg-black/80 backdrop-blur-md sheet-backdrop md:bg-black/70" 
            onClick={() => toggleKeyboardCheatsheet(false)} 
          />
          <div className="relative w-full max-w-[720px] md:max-w-[720px] glass-strong rounded-t-3xl md:rounded-3xl shadow-2xl border border-white/10 overflow-hidden mobile-bottom-sheet">
            {/* Mobile drag handle (visual + native affordance; CSS hides/positions on desktop) */}
            <div className="sheet-drag-handle md:hidden" aria-hidden="true" />
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="text-[#c084fc]"><Command className="h-5 w-5" /></div>
                <div>
                  <div className="font-semibold tracking-tighter text-xl">Keyboard Shortcuts</div>
                  <div className="text-xs text-[#71717a]">Master these. Move at the speed of thought.</div>
                </div>
              </div>
              <button 
                onClick={() => toggleKeyboardCheatsheet(false)}
                className="text-[#71717a] hover:text-white px-3 py-1 text-xs font-mono rounded bg-white/5 hover:bg-white/10"
              >
                ESC
              </button>
            </div>

            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6 text-sm">
              {[
                { cat: "Global Power", items: [
                  { key: "⌘K / Ctrl+K", desc: "Open / close Command Palette (your command center)" },
                  { key: "?", desc: "Open this keyboard cheatsheet from anywhere" },
                  { key: "⌘N / Ctrl+N", desc: "Quick add new task (natural language)" },
                  { key: "ESC", desc: "Close any modal, sheet, or selection" },
                ]},
                { cat: "Navigation", items: [
                  { key: "1", desc: "Go to Today view" },
                  { key: "2", desc: "Go to All Tasks view" },
                  { key: "3", desc: "Go to Notes view" },
                  { key: "4", desc: "Go to Calendar view" },
                  { key: "5", desc: "Go to Teams view" },
                ]},
                { cat: "Tasks & Action", items: [
                  { key: "Space", desc: "Complete currently selected task (in list)" },
                  { key: "Click row", desc: "Open full task detail modal" },
                  { key: "⌘N in palette", desc: "Create task directly from command palette" },
                ]},
                { cat: "Command Palette", items: [
                  { key: "↑ ↓", desc: "Navigate results inside palette" },
                  { key: "Enter", desc: "Execute selected command or jump" },
                  { key: "Type anything", desc: "Fuzzy search commands, workspaces, tasks, notes" },
                  { key: "ESC", desc: "Close palette (or ? inside for this sheet)" },
                ]},
              ].map((section) => (
                <div key={section.cat}>
                  <div className="uppercase tracking-[2px] text-[10px] font-semibold text-[#c084fc] mb-2.5">{section.cat}</div>
                  <div className="space-y-1.5">
                    {section.items.map((it, idx) => (
                      <div key={idx} className="flex justify-between items-baseline gap-4 py-0.5 text-[#e4e4e7]">
                        <div className="font-mono text-xs bg-white/5 px-2 py-px rounded text-[#c084fc] whitespace-nowrap">{it.key}</div>
                        <div className="text-right text-[#a1a1aa] text-[13px] leading-tight">{it.desc}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="px-6 py-3.5 bg-black/30 text-[11px] text-[#71717a] border-t border-white/10 flex items-center justify-between">
              <div>Pro tip: Open palette with ⌘K and type “workspace”, “note”, or a task name to jump instantly.</div>
              <div className="font-mono text-[#c084fc]">Bad Ass Tasks</div>
            </div>
          </div>
        </div>
      )}

      {/* Keyboard hint */}
      <div className="fixed bottom-3 right-4 text-[10px] text-[#71717a] hidden lg:block font-mono">
        ⌘K palette • ⌘N add • 1-5 views • ? cheatsheet • Space complete
        {isTrulyLive && <span className="ml-2 text-[#c084fc]">• Connected to Supabase</span>}
      </div>

      {/* Notification detail modal (opened from bell) — readable full view + dismiss / actions */}
      {selectedNotification && (
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 p-4"
          onClick={() => setSelectedNotification(null)}
        >
          <div
            className="glass-strong w-full max-w-md rounded-3xl border border-white/10 p-6 text-sm shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="text-[#c084fc]">
                  {selectedNotification.type === 'invite' && <Users className="h-5 w-5" />}
                  {selectedNotification.type === 'mention' && <Zap className="h-5 w-5" />}
                  {selectedNotification.type === 'comment' && <Star className="h-5 w-5" />}
                  {selectedNotification.type === 'task_assigned' && <Check className="h-5 w-5" />}
                  {selectedNotification.type === 'deadline' && <Clock className="h-5 w-5" />}
                  {selectedNotification.type === 'activity' && <Zap className="h-5 w-5" />}
                </div>
                <div className="font-semibold text-lg tracking-tight">{selectedNotification.title}</div>
              </div>
              <button onClick={() => setSelectedNotification(null)} className="text-[#71717a] hover:text-white p-1"><X className="h-4 w-4" /></button>
            </div>

            <div className="text-[#e5e5e7] whitespace-pre-wrap mb-4 leading-relaxed">
              {selectedNotification.message}
            </div>

            {selectedNotification.metadata && Object.keys(selectedNotification.metadata).length > 0 && (
              <div className="mb-4 rounded-xl bg-black/30 border border-white/5 p-3 text-[11px] text-[#a1a1aa]">
                <div className="font-mono text-[10px] mb-1 opacity-60">DETAILS</div>
                {selectedNotification.metadata.workspace_name && <div>Workspace: <span className="text-white">{selectedNotification.metadata.workspace_name}</span></div>}
                {selectedNotification.metadata.invited_by_name && <div>From: <span className="text-white">{selectedNotification.metadata.invited_by_name}</span></div>}
                {selectedNotification.metadata.role && <div>Role: <span className="text-white">{selectedNotification.metadata.role}</span></div>}
              </div>
            )}

            <div className="text-[10px] text-[#71717a] mb-5">
              {new Date(selectedNotification.createdAt).toLocaleString()}
            </div>

            <div className="flex gap-2">
              {selectedNotification.link && (
                <button
                  onClick={() => {
                    if (selectedNotification.link) {
                      if (selectedNotification.type === 'invite') setView('teams');
                      else window.location.hash = selectedNotification.link;
                    }
                    setSelectedNotification(null);
                  }}
                  className="btn btn-primary text-sm flex-1"
                >
                  {selectedNotification.type === 'invite' ? 'View invites' : 'Go to link'}
                </button>
              )}
              <button
                onClick={() => {
                  if (!selectedNotification.readAt) markNotifRead?.(selectedNotification.id);
                  setSelectedNotification(null);
                }}
                className="flex-1 rounded-xl border border-white/15 py-2 text-sm hover:bg-white/5"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STRICT AUTH LANDING GATE OVERLAY
          Covers the entire shell (top bar, sidebar, views, everything) when Supabase is configured
          but no user is signed in. This enforces the requirement that unauthenticated visitors
          see a proper landing page and cannot interact with the app as if logged in.
          The AuthModal can still open on top (higher z) for sign-in. Once user appears, this unmounts
          and the real (now authenticated) productivity UI is revealed. */}
      {showLandingGate && (
        <div className="fixed inset-0 z-[150] bg-[#0a0a0f] flex items-center justify-center p-6" aria-modal="true" role="dialog">
          <div className="w-full max-w-[680px] text-center">
            <div className="mx-auto mb-6 h-16 w-16 rounded-2xl bg-gradient-to-br from-[#c084fc] to-[#a855f7] flex items-center justify-center shadow-[0_0_40px_-10px_#c084fc]">
              <Check className="h-8 w-8 text-black" />
            </div>

            <h1 className="text-6xl font-semibold tracking-[-2.5px] mb-3">Bad Ass Tasks</h1>
            <p className="text-2xl text-[#a1a1aa] tracking-[-0.6px] mb-2">"Get shit done. Beautifully."</p>
            <p className="text-[#71717a] max-w-md mx-auto mb-9 text-[15px]">
              The ruthless, delightful productivity system for founders, builders &amp; teams who ship.
            </p>

            <div className="flex flex-col items-center gap-3">
              <button
                onClick={() => setShowAuthModal(true)}
                className="btn btn-primary text-base px-9 py-3.5 flex items-center gap-2.5 text-lg font-medium active:scale-[0.985] transition"
              >
                <User className="h-5 w-5" /> Sign in or create account
              </button>
              <div className="text-xs text-[#71717a]">Simple email &amp; password. No OAuth or magic links required.</div>
            </div>

            <div className="mt-10 pt-6 border-t border-white/10 text-[11px] text-[#71717a] max-w-[42ch] mx-auto leading-snug">
              Supabase is configured for this instance. You must sign in with a real account to access persistent workspaces, tasks, notes, and realtime collaboration.
              <span className="block mt-1.5 opacity-75">For a pure local-only demo experience, remove the Supabase environment variables and restart the dev server.</span>
            </div>
          </div>
        </div>
      )}

      {/* Modern Confirmation Modals - temporarily commented to diagnose parse error */}
      {/* 
      <ConfirmationModal
        open={pendingDeleteWorkspace}
        onOpenChange={setPendingDeleteWorkspace}
        title="Delete Workspace?"
        description={`This will permanently delete "${currentWorkspace.name}" and ALL its tasks, notes, and members. This action cannot be undone.`}
        confirmText="Delete Workspace"
        variant="destructive"
        onConfirm={handleConfirmDeleteWorkspace}
      />

      <ConfirmationModal
        open={!!pendingDeleteNote}
        onOpenChange={(open) => !open && setPendingDeleteNote(null)}
        title="Delete Note?"
        description="This note will be permanently deleted. This cannot be undone."
        confirmText="Delete Note"
        variant="destructive"
        onConfirm={handleConfirmDeleteNote}
      />

      <ConfirmationModal
        open={!!pendingRemoveMember}
        onOpenChange={(open) => !open && setPendingRemoveMember(null)}
        title="Remove Member?"
        description={`Are you sure you want to remove ${pendingRemoveMember?.label} from this workspace?`}
        confirmText="Remove Member"
        variant="destructive"
        onConfirm={handleConfirmRemoveMember}
      />

      <ConfirmationModal
        open={pendingLeaveWorkspace}
        onOpenChange={setPendingLeaveWorkspace}
        title="Leave Workspace?"
        description={`You will lose access to "${currentWorkspace.name}" and all its tasks and notes. This cannot be undone.`}
        confirmText="Leave Workspace"
        variant="destructive"
        onConfirm={handleConfirmLeaveWorkspace}
      />
      */}

    </div>
  );
}

