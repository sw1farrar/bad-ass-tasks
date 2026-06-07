"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Check, Plus, Command, Users, Settings,
  ChevronRight, Clock, Star, ArrowUpRight,
  Loader2, User, LogOut, X, Bell, Home, MessageCircle, Zap, Repeat,
  Trash2, Search, RefreshCw, FileText, Download,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { toast } from "sonner";

import { useTaskStore } from "@/store/useTaskStore";
import { Task, TaskStatus, ActivityLog, Notification } from "@/types";
import { cn, formatDueDate, getNextRecurringDue, triggerHaptic, getUserFirstName } from "@/lib/utils";

import { CommandPalette } from "@/components/CommandPalette";
import { ConfirmationModal } from "@/components/ConfirmationModal";
import { Confetti } from "@/components/Confetti";
import { SupabaseSetupBanner } from "@/components/SupabaseSetupBanner";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { AuthModal } from "@/components/AuthModal";
import { LandingPage } from "@/components/LandingPage";
import { TaskModal } from "@/components/TaskModal";
import { NotesView } from "@/features/notes/NotesView";
import { useNoteOperations } from "@/features/notes/hooks";
import { useNoteKeyboard } from "@/features/notes/hooks";
import { HomeView } from "@/features/home";
import type { HomeFocusItem } from "@/features/home/lib/buildAttentionItems";
import { TodayView } from "@/features/today";
import { WorkspaceChatPanel, ChatDrawer, useWorkspaceChat } from "@/features/chat";
import { WorkspaceSettingsView } from "@/features/settings";
import { NotificationDetailModal } from "@/features/notifications";
import { TasksTable } from "@/features/tasks/components/TasksTable";
import { TaskRow } from "@/features/tasks/components/TaskRow";

const VIEWS = [
  { id: "home", label: "Home", icon: Home },
  { id: "today", label: "Today", icon: Clock },
  { id: "tasks", label: "Tasks", icon: Check },
  { id: "notes", label: "Notes", icon: Star },
  { id: "teams", label: "Team", icon: Users },
  { id: "settings", label: "Settings", icon: Settings },
] as const;

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
    // C4 Phase A Home globals (separate slices)
    globalTodayFocus,
    fetchGlobalHomeAggregates,
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
    exitWorkspace,
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

  const [confettiTrigger, setConfettiTrigger] = useState(0);
  const [chatOpen, setChatOpen] = useState(false);

  const workspaceChat = useWorkspaceChat({
    workspaceId: currentWorkspace.id,
    userId: user?.id,
    members,
    isOpen: chatOpen,
  });

  const toggleChat = () => {
    triggerHaptic("light");
    setChatOpen((open) => !open);
  };
  const [showWorkspaceMenu, setShowWorkspaceMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showFullTaskModal, setShowFullTaskModal] = useState(false);
  // Refs for outside click detection
  const workspaceMenuRef = React.useRef<HTMLDivElement>(null);
  const notificationsRef = React.useRef<HTMLDivElement>(null);
  // Notification detail modal (opened from bell dropdown clicks for better readability + actions)
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);
  // Workspace creation UI state (inline in switcher dropdown — production real DB)
  const [isCreatingWorkspace, setIsCreatingWorkspace] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [isCreatingLoading, setIsCreatingLoading] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Modern confirmation modals state
  const [pendingDeleteNote, setPendingDeleteNote] = useState<string | null>(null);
  const [pendingRemoveMember, setPendingRemoveMember] = useState<{ userId: string; label: string } | null>(null);
  const [pendingRevokeInvite, setPendingRevokeInvite] = useState<{ inviteId: string; label: string } | null>(null);
  const [pendingResendInvite, setPendingResendInvite] = useState<{ inviteId: string; label: string } | null>(null);
  const [pendingLeaveWorkspace, setPendingLeaveWorkspace] = useState(false);
  const [pendingDeleteNotification, setPendingDeleteNotification] = useState<string | null>(null);
  const [pendingClearNotifications, setPendingClearNotifications] = useState(false);

  const pendingDeleteNoteTitle = pendingDeleteNote
    ? notes.find((n) => n.id === pendingDeleteNote)?.title || "Untitled Note"
    : "";

  const handleConfirmRemoveMember = async () => {
    if (!pendingRemoveMember) return;
    await removeWorkspaceMember(pendingRemoveMember.userId);
    setPendingRemoveMember(null);
  };

  const handleConfirmRevokeInvite = async () => {
    if (!pendingRevokeInvite) return;
    await revokeInvite(pendingRevokeInvite.inviteId);
    setPendingRevokeInvite(null);
  };

  const handleConfirmResendInvite = async () => {
    if (!pendingResendInvite) return;
    await resendInvite(pendingResendInvite.inviteId);
    setPendingResendInvite(null);
  };

  const handleConfirmDeleteNotification = async () => {
    if (!pendingDeleteNotification) return;
    await deleteNotification?.(pendingDeleteNotification);
    setPendingDeleteNotification(null);
  };

  const handleConfirmClearNotifications = async () => {
    await clearAllNotifications?.();
    setPendingClearNotifications(false);
  };

  const handleConfirmDeleteNote = async () => {
    if (!pendingDeleteNote) return;
    const deletedId = pendingDeleteNote;
    const ok = await noteOps.confirmDeleteNote(deletedId);
    if (ok && selectedNoteId === deletedId) {
      setSelectedNoteId(null);
    }
  };

  const handleConfirmLeaveWorkspace = async () => {
    const wsId = currentWorkspace?.id;
    if (!wsId) return;
    if (!isSupabaseConfigured() || ["w1", "w2"].includes(wsId)) {
      toast.info("Leave workspace is a live Supabase feature");
      setPendingLeaveWorkspace(false);
      return;
    }
    // Delegate to store: full optimistic + RPC (exit_workspace with last-owner guard) + refresh + switch + toasts.
    // Realtime DELETE on workspace_members + onMemberChange will symmetrically update all other clients (zero-orphan).
    await exitWorkspace(wsId);
    setPendingLeaveWorkspace(false);
  };

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

  // Extracted note keyboard (M2 extraction - reduces monolith)
  useNoteKeyboard({
    selectedNoteId,
    setSelectedNoteId,
    isTyping: false, // simplified; in full extraction would use stable isInputActive
  });

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

  // User profile self-edit (full name, username/handle, location). Triggered from top-right pill + Teams view.
  const [profileFullName, setProfileFullName] = useState("");
  const [profileUsername, setProfileUsername] = useState("");
  const [profileLocation, setProfileLocation] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [showProfilePopover, setShowProfilePopover] = useState(false);



  // PWA foundation: install prompt + service worker registration (mobile-first, demo safe)
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);

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

  // Legacy invite links (?invite=UUID) → dedicated invite landing page
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const inviteToken = params.get("invite");
    if (inviteToken) {
      window.location.replace(`/invite/${inviteToken}`);
    }
  }, []);

  // After invite acceptance, switch into the joined workspace
  useEffect(() => {
    if (typeof window === "undefined" || !user) return;
    const params = new URLSearchParams(window.location.search);
    const workspaceId = params.get("workspace");
    if (!workspaceId) return;

    (async () => {
      await switchWorkspace(workspaceId);
      await useTaskStore.getState().fetchUserWorkspaces?.().catch(() => {});
      const url = new URL(window.location.href);
      url.searchParams.delete("workspace");
      window.history.replaceState({}, "", url.toString());
    })();
  }, [user, switchWorkspace]);

  // Deep links for PWA shortcuts + shareable views (Agent 27): ?view=today|tasks|notes|teams
  // Initializes from manifest shortcuts (?view=...&source=pwa). Syncs on change for back/forward + share.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const rawView = params.get("view");
    const urlView = rawView === "calendar" ? "tasks" : rawView;
    const validViews = VIEWS.map(v => v.id);
    if (urlView && validViews.includes(urlView as (typeof VIEWS)[number]["id"]) && urlView !== currentView) {
      setView(urlView as (typeof VIEWS)[number]["id"]);
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

  const isConfigured = isSupabaseConfigured();
  const isTrulyLive = isConfigured && !!user;
  const showLandingGate = isConfigured && !user;

  const handleInstallApp = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        toast.success("Thanks for installing!", { description: "Badazz Tasks is now on your home screen." });
      }
      setDeferredPrompt(null);
      setShowInstallPrompt(false);
      return;
    }
    triggerHaptic("light");
    toast.info("Add to Home Screen", {
      description: "Use your browser Share menu → Add to Home Screen.",
      duration: 8000,
    });
  };

  const handleComplete = async (id: string) => {
    triggerHaptic("success");
    const task = tasks.find((t) => t.id === id);
    if (!task || task.status === "done" || taskLoadingStates?.[id]) return;

    if (task.recurringRule) {
      const next = getNextRecurringDue(task.recurringRule, new Date(), task.dueDate, task.exceptionDates);
      if (next) {
        await updateTask(id, { dueDate: next.toISOString() });
        toast.success("Recurrence advanced", {
          description: `${task.title} → next due ${format(next, "MMM d")}`,
        });
        return;
      }
    }

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

  const openTask = (task: Task) => {
    selectTask(task.id);
    setShowFullTaskModal(true);
  };

  const ensureWorkspaceForHomeAction = async (workspaceId: string) => {
    if (currentWorkspace.id !== workspaceId) {
      switchWorkspace(workspaceId);
      await useTaskStore.getState().initializeFromSupabase();
    }
  };

  const handleHomeOpenFocusTask = async (item: HomeFocusItem) => {
    await ensureWorkspaceForHomeAction(item.workspaceId);
    const freshTask =
      useTaskStore.getState().tasks.find((t) => t.id === item.task.id) || item.task;
    openTask(freshTask);
  };

  const handleHomeCompleteFocusTask = async (item: HomeFocusItem) => {
    await ensureWorkspaceForHomeAction(item.workspaceId);
    await handleComplete(item.task.id);
    fetchGlobalHomeAggregates();
  };

  const handleHomeAcceptInvite = async (inviteId: string) => {
    const wsId = await acceptInviteLink(inviteId);
    if (wsId) {
      const toDelete = (notifications || [])
        .filter((n: Notification) => n.metadata?.invite_id === inviteId)
        .map((n: Notification) => n.id);
      for (const id of toDelete) {
        await deleteNotification?.(id);
      }
      await Promise.all([
        fetchNotifications?.().catch(() => {}),
        useTaskStore.getState().fetchUserWorkspaces?.().catch(() => {}),
        fetchGlobalHomeAggregates(),
      ]);
    }
  };

  const handleHomeDeclineInvite = async (inviteId: string) => {
    await declineReceivedInvite(inviteId);
    await fetchNotifications?.().catch(() => {});
    fetchGlobalHomeAggregates();
  };

  const handleHomeOpenNotification = (notification: Notification) => {
    setSelectedNotification(notification);
    setShowNotifications(true);
    if (!notification.readAt) {
      markNotifRead?.(notification.id);
    }
  };

  const homeUserDisplayName = useMemo(() => {
    const selfMember = members.find((m) => m.userId === user?.id);
    const metaName = (user?.user_metadata as { full_name?: string } | undefined)?.full_name;
    return getUserFirstName({
      profileFullName,
      memberFullName: selfMember?.fullName,
      authFullName: metaName,
      username: selfMember?.username,
      email: user?.email,
    });
  }, [user, profileFullName, members]);

  const renderTaskRow = (task: Task) => {
    const due = formatDueDate(task.dueDate);
    const isDone = task.status === "done";
    const isOpLoading = !!taskLoadingStates?.[task.id];
    const onlineEditorsCount = (remoteCursors || []).filter(
      (c: { itemId?: string; itemType?: string }) => c.itemId === task.id && c.itemType === "task"
    ).length;

    return (
      <TaskRow
        key={task.id}
        task={task}
        isDone={isDone}
        isOpLoading={isOpLoading}
        due={due}
        onlineEditorsCount={onlineEditorsCount}
        onOpen={openTask}
        onComplete={handleComplete}
        onSwipeComplete={(id) => handleComplete(id)}
      />
    );
  };

  const renderTodayView = () => (
    <TodayView
      todayTasks={todayTasks}
      activeTaskCount={activeTaskCount}
      setView={setView}
      renderTaskRow={renderTaskRow}
    />
  );

  const renderTasksView = () => (
    <div className="flex flex-col gap-3 min-h-0 max-w-5xl">
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-1">
        <input
          value={taskFilter.search || ""}
          onChange={(e) => setTaskFilter({ search: e.target.value })}
          placeholder="Filter tasks…"
          className="input px-3 py-2.5 rounded-xl text-sm max-w-md"
        />
        <div className="flex gap-1.5 overflow-x-auto pb-1 text-[10px]">
          {(["all", "only", "none"] as const).map((mode) => (
            <button
              key={`rec-${mode}`}
              onClick={() => setTaskFilter({ recurring: mode === "all" ? undefined : mode })}
              className={cn(
                "px-2 py-1 rounded-full border transition shrink-0",
                (mode === "all" && !taskFilter.recurring) || taskFilter.recurring === mode
                  ? "bg-[#c084fc] text-black border-[#c084fc]"
                  : "border-white/10 hover:bg-white/5 text-[#a1a1aa]"
              )}
            >
              {mode === "all" ? "All" : mode === "only" ? "Recurring" : "One-off"}
            </button>
          ))}
        </div>
      </div>

      <TasksTable
        tasks={filteredTasks}
        taskLoadingStates={taskLoadingStates}
        onOpenTask={openTask}
        onComplete={handleComplete}
        onAddTask={addTask}
      />
    </div>
  );

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
        setNewWorkspaceName("");
        setIsCreatingWorkspace(false);
        setShowWorkspaceMenu(false);
      }
    } finally {
      setIsCreatingLoading(false);
    }
  };

  // Keyboard shortcuts - reliable, input-aware, keyboard-first experience
  useEffect(() => {
    const isInputActive = () => {
      const el = document.activeElement as HTMLElement | null;
      if (!el) return false;
      const tag = el.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return true;
      if (el.isContentEditable) return true;
      if (el.closest("[data-cmdk-input]")) return true;
      return false;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const typing = isInputActive();
      const paletteOpen = isCommandPaletteOpen;

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (isKeyboardCheatsheetOpen) toggleKeyboardCheatsheet(false);
        toggleCommandPalette();
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "n") {
        if (typing) return;
        e.preventDefault();
        setView("tasks");
        setTimeout(() => {
          const input = document.getElementById("task-quick-add") as HTMLInputElement;
          input?.focus();
        }, 10);
        return;
      }

      if (e.key === "?" && !e.metaKey && !e.ctrlKey && !e.shiftKey) {
        if (typing || paletteOpen) return;
        e.preventDefault();
        toggleKeyboardCheatsheet(true);
        return;
      }

      if (!typing && !paletteOpen && !showFullTaskModal && !showAuthModal && !isKeyboardCheatsheetOpen) {
        if (e.key === "1") { setView("today"); return; }
        if (e.key === "2") { setView("tasks"); return; }
        if (e.key === "3") { setView("notes"); return; }
        if (e.key === "4") { setView("teams"); return; }
        if (e.key === "5") { setView("settings"); return; }
      }

      if (e.key === "Escape") {
        if (isKeyboardCheatsheetOpen) {
          toggleKeyboardCheatsheet(false);
          return;
        }
        if (showAuthModal) {
          setShowAuthModal(false);
          return;
        }
        if (showFullTaskModal) {
          setShowFullTaskModal(false);
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
        setShowWorkspaceMenu(false);
        if (paletteOpen) toggleCommandPalette(false);
        return;
      }

      if (e.key === " " && selectedTaskId && !typing) {
        e.preventDefault();
        const task = tasks.find((t) => t.id === selectedTaskId);
        if (task && task.status !== "done") {
          handleComplete(task.id);
        }
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
    showFullTaskModal,
    showAuthModal,
    setView,
  ]);

  useEffect(() => {
    if (!workspaces.length) return;
    fetchGlobalHomeAggregates();
  }, [workspaces, user?.id, fetchGlobalHomeAggregates]);

  useEffect(() => {
    if (currentView === "home") {
      fetchGlobalHomeAggregates();
    }
  }, [currentView, fetchGlobalHomeAggregates]);

  const renderHomeView = () => {
    const workspacePulse = (workspaces || []).map((ws) => {
      const wsFocus = (globalTodayFocus || []).filter((f) => f.workspaceId === ws.id);
      const overdue = wsFocus.filter((f) => {
        if (!f.task.dueDate) return false;
        const due = new Date(f.task.dueDate);
        const now = new Date();
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        due.setHours(0, 0, 0, 0);
        return due < todayStart;
      }).length;

      return {
        id: ws.id,
        name: ws.name,
        role: ws.role,
        dueToday: wsFocus.length,
        overdue,
        unreadNotifications: (notifications || []).filter(
          (n: Notification) => !n.readAt && n.workspaceId === ws.id
        ).length,
        isCurrent: currentWorkspace.id === ws.id,
        onlineCount: currentWorkspace.id === ws.id ? (onlineUsers || []).length : undefined,
      };
    });

    return (
      <HomeView
        userDisplayName={homeUserDisplayName}
        workspaces={workspaces}
        switchWorkspace={switchWorkspace}
        setView={setView}
        globalTodayFocus={globalTodayFocus}
        notifications={notifications}
        workspacePulse={workspacePulse}
        taskLoadingStates={taskLoadingStates}
        onQuickAddTask={() => {
          setView("tasks");
          setTimeout(() => {
            const input = document.getElementById("task-quick-add") as HTMLInputElement | null;
            input?.focus();
          }, 10);
        }}
        onQuickAddNote={() => setView("notes")}
        onOpenChat={() => setChatOpen(true)}
        onOpenCommandPalette={() => toggleCommandPalette(true)}
        onCompleteFocusTask={handleHomeCompleteFocusTask}
        onOpenFocusTask={handleHomeOpenFocusTask}
        onAcceptInvite={handleHomeAcceptInvite}
        onDeclineInvite={handleHomeDeclineInvite}
        onOpenNotification={handleHomeOpenNotification}
      />
    );
  };

  // Extracted note operations (M2 architectural cleanup)
  // IMPORTANT: Must be declared *after* openTask (and other helpers it closes over)
  // to avoid Temporal Dead Zone (TDZ) ReferenceError.
  const noteOps = useNoteOperations({
    notes,
    tasks,
    selectedNoteId,
    addNote,
    updateNote,
    deleteNote,
    updateTask,
    addTask,
    openTask,
    setPendingDeleteNote,
    // M2 tiny extraction: pass isTrulyLive so the extracted handlePersistSnapshot
    // (moved out of this renderNotesView) can apply the exact same live-only guard.
    isTrulyLive,
  });

  const renderNotesView = () => {
    return (
      <NotesView
        notes={notes}
        tasks={tasks}
        selectedNoteId={selectedNoteId}
        onSelectNote={setSelectedNoteId}
        // All complex note orchestration now comes from the extracted hook
        onCreateNote={noteOps.onCreateNote}
        onUpdateNote={noteOps.onUpdateNote}
        onDeleteNote={noteOps.onDeleteNote}
        onLinkTaskToNote={noteOps.onLinkTaskToNote}
        onUnlinkTaskFromNote={noteOps.onUnlinkTaskFromNote}
        onOpenTask={(taskId) => {
          const t = tasks.find((x) => x.id === taskId);
          if (t) openTask(t);
        }}
        onToggleTaskStatus={noteOps.onToggleTaskStatus}
        onUpdateTask={noteOps.onUpdateTask}
        onCreateTaskAndEmbed={noteOps.onCreateTaskAndEmbed}
        onCreateTaskAndLink={noteOps.onCreateTaskAndLink}
        onCreateSubNote={noteOps.onCreateSubNote}
        onLinkNoteToNote={noteOps.onLinkNoteToNote}
        onUnlinkNoteFromNote={noteOps.onUnlinkNoteFromNote}
        onOpenNote={(noteId) => setSelectedNoteId(noteId)}  // Simple navigation for db-blocks and embeds

        // Live snapshot persistence (M2) — now from the extracted hook (tiny monolith slimming)
        // The full handler + guard + bounded snapshots array logic was the last inline notes
        // code in renderNotesView(). Reduced this notes area by ~11 lines. Sourced exactly
        // like the other noteOps.* handlers (onCreateNote, requestSnapshot, etc.).
        onPersistSnapshot={noteOps.onPersistSnapshot}
        requestSnapshot={noteOps.requestSnapshot}
        requestTitleSnapshot={noteOps.requestTitleSnapshot}
        isLive={isTrulyLive}
        // M2 bidirectional adapters now come from the extracted hook (monolith slimming)
        onMentionLinked={noteOps.onMentionLinked}
        onRemoveLinked={noteOps.onRemoveLinked}
        onRemoveBacklink={noteOps.onRemoveLinked}
        // M2: automatic mention → link sync now handled inside NotesView via the centralized useMentions hook
        // (receives the real link/unlink handlers from noteOps). Override only if needed.
        onMentionsChanged={undefined}
      />
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
          const link = `${window.location.origin}/invite/${inviteId}`;
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
      const link = `${window.location.origin}/invite/${inviteId}`;
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
            <div className="text-4xl font-semibold tracking-tighter mb-3">Team</div>

            {/* Recipient context — only show for non-owners of this workspace */}
            {currentWorkspace.role && currentWorkspace.role !== 'owner' && (
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
              <Search className="h-5 w-5 text-[#c084fc]" /> Find people
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
                placeholder="Name, @username, or city"
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
                          {result.location && <div className="text-xs text-[#71717a] truncate">≡ƒôì {result.location}</div>}
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
          <div className="flex items-center gap-3">
            <Users className="h-8 w-8 text-[#c084fc]" />
            <div className="text-2xl font-semibold tracking-tighter">Team</div>
          </div>
          <div className="flex items-center gap-2">
            {canManage && isLive && !isDemoWs && (
              <button
                onClick={() => setShowInviteDialog(true)}
                className="btn btn-primary text-sm flex items-center gap-2"
              >
                <Plus className="h-4 w-4" /> Invite
              </button>
            )}
            <button onClick={handleManualAccept} className="btn btn-ghost text-xs px-3 py-1.5" disabled={!isLive}>
              Accept invite
            </button>
          </div>
        </div>

        {/* Presence */}
        {onlineUsers.length > 0 && (
          <div className="glass rounded-2xl p-4 border border-white/10">
            <div className="flex flex-wrap gap-2">
              {onlineUsers.map((u) => (
                <div key={u.userId || u.presenceRef} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#00ff9f]/10 text-[#00ff9f] text-xs border border-[#00ff9f]/20">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#00ff9f] animate-pulse" />
                  {(u as any).fullName || ((u as any).username ? `@${(u as any).username}` : "Online")}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Profile editing lives in the avatar menu (top-right) to avoid duplication on the Teams page. */}

        {/* Members list with role enforcement */}
        <div className="glass rounded-2xl border border-white/10 overflow-hidden">
          <div className="px-5 py-3 border-b border-white/10 flex items-center justify-between bg-white/5">
            <div className="font-medium">Members ({members.length})</div>
            {isLoadingMembers && <Loader2 className="h-4 w-4 animate-spin text-[#c084fc]" />}
          </div>

          {members.length === 0 ? (
            <div className="p-8 text-center text-[#71717a] text-sm">No members</div>
          ) : (
            <div className="divide-y divide-white/10 text-sm">
              {members.map((m) => {
                const isSelf = m.userId === user?.id;
                const canActOnThis = canManage && !isSelf;
                return (
                  <div key={m.userId} className="px-5 py-3.5 flex items-center gap-4 hover:bg-white/5 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">
                        {m.fullName || (m.username ? `@${m.username}` : "Member")}
                      </div>
                    </div>

                    <div className="text-xs px-2.5 py-1 rounded bg-white/5 border border-white/10 font-mono text-[#a1a1aa]">
                      {m.role}
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
                          const wsId = currentWorkspace?.id;
                          if (!wsId) return;
                          if (!isSupabaseConfigured() || ["w1", "w2"].includes(wsId)) {
                            toast.info("Leave workspace is a live Supabase feature");
                            return;
                          }
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
              <div className="p-6 text-sm text-[#71717a]">None</div>
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
                      <div className="text-[11px] text-[#71717a] font-mono">{inv.role}</div>
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

        {/* Invite Dialog */}
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
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const currentViewComponent = () => {
    switch (currentView) {
      case "home": return renderHomeView();
      case "today": return renderTodayView();
      case "tasks": return renderTasksView();
      case "notes": return renderNotesView();
      case "teams": return renderTeamsView();
      case "settings": return <WorkspaceSettingsView />;
      default: return renderHomeView();
    }
  };

  // Hold UI until Supabase session is resolved — prevents a flash of the dashboard on refresh.
  if (isConfigured && isAuthLoading) {
    return (
      <div className="fixed inset-0 z-[150] flex items-center justify-center bg-[#0a0a0f] text-[#f4f4f5]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-[#c084fc]" aria-hidden="true" />
          <p className="text-sm text-[#71717a]">Loading…</p>
        </div>
      </div>
    );
  }

  if (showLandingGate) {
    return (
      <>
        <LandingPage onSignIn={() => setShowAuthModal(true)} isCheckingSession={false} />
        <AuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          onSuccess={() => {
            toast.success("Welcome to Badazz Tasks", {
              description: "Your workspaces and data are ready.",
              duration: 4000,
            });
          }}
        />
      </>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#0a0a0f] text-[#f4f4f5]">
      {/* Top Bar — responsive compaction on mobile via .top-bar */}
      <div className="top-bar relative h-16 border-b border-white/10 flex items-center px-5 justify-between z-50 bg-[#0a0a0f]/95 backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 shrink-0 min-w-0">
            <div className="h-7 w-7 md:h-8 md:w-8 rounded-lg bg-gradient-to-br from-[#c084fc] to-[#a855f7] flex items-center justify-center flex-shrink-0">
              <Check className="h-4 w-4 md:h-4.5 md:w-4.5 text-black" />
            </div>
            <div className="min-w-0 hidden sm:block">
              <div className="font-semibold tracking-[-0.3px] text-sm md:text-[17px] leading-none whitespace-nowrap">Badazz Tasks</div>
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
              className="flex items-center gap-2 text-sm px-3 py-1.5 rounded-xl hover:bg-white/5 border border-white/10 workspace-switcher"
            >
              <span className="flex items-center gap-1.5 workspace-name truncate">
                <span className="truncate">{currentWorkspace.name}</span>
                {!isSingleOwnerWorkspace && (
                  <span className="text-[9px] px-1 py-px rounded bg-white/5 text-[#a1a1aa] font-mono tracking-widest shrink-0">{currentWorkspace.role}</span>
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
                      <span className="flex items-center gap-1.5 min-w-0">
                        <span className="truncate">{ws.name}</span>
                        {!(ws.id === currentWorkspace.id && isSingleOwnerWorkspace) && (
                          <span className="text-[10px] px-1.5 py-px rounded bg-white/5 text-[#71717a] font-mono tracking-widest shrink-0">{ws.role}</span>
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
                  className="absolute right-0 top-12 w-80 max-w-[min(20rem,calc(100vw-2rem))] glass-strong rounded-2xl border border-white/10 shadow-2xl z-[260] overflow-hidden bg-[#111114]"
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
                          onClick={() => setPendingClearNotifications(true)}
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
                      <div className="p-4 text-center text-[#71717a] text-xs">LoadingΓÇª</div>
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
                              setPendingDeleteNotification(n.id);
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

          <button
            type="button"
            onClick={toggleChat}
            className={cn(
              "relative flex items-center justify-center h-9 w-9 rounded-xl border transition",
              chatOpen
                ? "border-[#c084fc]/50 bg-[#c084fc]/10 text-[#c084fc]"
                : "border-white/10 text-[#a1a1aa] hover:text-white hover:border-[#c084fc]/40"
            )}
            aria-label={chatOpen ? "Collapse messages" : "Open messages"}
            aria-expanded={chatOpen}
          >
            <MessageCircle className="h-4 w-4" />
            {workspaceChat.hasUnread && !chatOpen && (
              <span
                className="absolute top-0.5 right-0.5 h-2 w-2 rounded-full bg-[#ff3366] ring-2 ring-[#0a0a0f]"
                aria-label="Unread messages"
              />
            )}
          </button>

          {/* Polished Auth + User Area (Phase 1 UX track) */}
          {isAuthLoading ? (
            <div className="flex items-center gap-2 rounded-full bg-white/5 border border-white/10 px-3 py-1.5 text-xs text-[#71717a]">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-[#c084fc]" />
              <span className="hidden md:inline">AuthenticatingΓÇª</span>
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
              className="absolute right-4 top-14 w-80 max-w-[min(20rem,calc(100vw-2rem))] glass rounded-2xl border border-white/10 shadow-2xl z-[260] p-5 text-sm"
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
              title="Install Badazz Tasks for offline + home screen access"
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
                <>≡ƒôí Offline</>
              ) : syncDisplay.isSyncing ? (
                <>Γƒ│ Syncing</>
              ) : syncDisplay.pendingSyncCount > 0 ? (
                <>Γåæ {syncDisplay.pendingSyncCount} sync</>
              ) : (
                <>Γ£ô Synced</>
              )}
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar — improved a11y: navigation landmark + aria */}
        <aside className="sidebar w-64 hidden lg:flex flex-col pt-3 px-3 border-r border-white/10" aria-label="Workspace navigation and views">
          {/* Sidebar content starts here (unchanged inner structure for minimal diff) */}

          {/* Home - Global meta view (sits above the per-workspace section) */}
          <div className="px-1 mb-2">
            <div
              role="button"
              tabIndex={0}
              aria-current={currentView === "home" ? "page" : undefined}
              onClick={() => setView("home")}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setView("home");
                }
              }}
              className={cn("sidebar-item", currentView === "home" && "active")}
            >
              <Home className="h-4 w-4" />
              Home
            </div>
          </div>

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
            {VIEWS.filter(v => v.id !== "home").map((v) => {
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
                </div>
              );
            })}
          </div>

          <div className="mt-auto px-4 pb-6 text-[10px] text-[#71717a]">
            <div className="mb-1">Badazz Tasks</div>
            <div>Real-time sync active.</div>
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
                <><span className="spinner" /> RefreshingΓÇª</>
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
                    const inviteId = first?.metadata?.invite_id as string | undefined;
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
                    const inviteId = first?.metadata?.invite_id as string | undefined;
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

          {/* Demo / Setup Banner — only shown when not connected to Supabase */}
          {!isSupabaseConfigured() && (
            <div className="mb-6 rounded-2xl bg-[#111114] border border-[#c084fc]/20 px-5 py-3 text-sm flex items-center gap-3">
              <div className="text-[#c084fc]">⚠</div>
              <div className="flex-1 text-[#a1a1aa]">
                Demo mode — all data lives in your browser for now.
              </div>
              <button onClick={() => window.open("docs/MILESTONE-1-SUPABASE-ACTIVATION.md", "_blank")} className="text-xs underline text-[#c084fc] whitespace-nowrap">Connect Supabase</button>
            </div>
          )}

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
                    ? "Syncing your tasks and workspace from SupabaseΓÇª" 
                    : "Loading dataΓÇª"}
                </div>
                {isTrulyLive && (
                  <div className="text-[10px] font-mono text-[#c084fc] hidden sm:block">LIVE MODE</div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Graceful edge case: logged in but no workspaces (future-proof for real auth) — ensureUserHasWorkspace + manual create supported */}
          {user && workspaces.length === 0 && !isInitializing && (
            <div className="mb-4 rounded-2xl border border-[#ff9500]/30 bg-[#111114] p-5 text-sm">
              <div className="flex items-start gap-3">
                <div className="text-[#ff9500] mt-0.5">ΓÜá∩╕Å</div>
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

        <motion.aside
          className={cn(
            "hidden xl:flex flex-col bg-[#0a0a0f] min-h-0 overflow-hidden shrink-0",
            chatOpen && "border-l border-white/10"
          )}
          initial={false}
          animate={{
            width: chatOpen ? 320 : 0,
            opacity: chatOpen ? 1 : 0,
          }}
          transition={{ type: "spring", stiffness: 400, damping: 38, mass: 0.85 }}
          aria-hidden={!chatOpen}
        >
          <div className="w-80 h-full p-4 flex flex-col min-h-0">
            <WorkspaceChatPanel
              workspaceId={currentWorkspace.id}
              workspaceName={currentWorkspace.name}
              userId={user?.id}
              members={members}
              chat={workspaceChat}
              onCollapse={() => setChatOpen(false)}
            />
          </div>
        </motion.aside>
      </div>

      {/* Mobile Bottom Navigation — native iOS/Android style, only <md via CSS + md:hidden
          Reuses existing VIEWS + setView from store. No desktop impact. Touch-optimized via globals.css
      */}
      <nav className="bottom-nav md:hidden border-t border-white/10" aria-label="Primary navigation">
        {VIEWS.filter((v) => v.id !== "settings").map((v) => {
          const Icon = v.icon;
          const isActive = currentView === v.id;
          const label = v.label;
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

      <ChatDrawer
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        chat={workspaceChat}
        workspaceId={currentWorkspace.id}
        workspaceName={currentWorkspace.name}
        userId={user?.id}
        members={members}
      />

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
                  { key: "⌘N / Ctrl+N", desc: "Focus task quick-add" },
                  { key: "ESC", desc: "Close any modal, sheet, or selection" },
                ]},
                { cat: "Navigation", items: [
                  { key: "1", desc: "Go to Today view" },
                  { key: "2", desc: "Go to All Tasks view" },
                  { key: "3", desc: "Go to Notes view" },
                  { key: "4", desc: "Go to Team" },
                ]},
                { cat: "Tasks & Action", items: [
                  { key: "Space", desc: "Complete currently selected task (in list)" },
                  { key: "Click row", desc: "Open full task detail modal" },
                  { key: "ΓîÿN in palette", desc: "Create task directly from command palette" },
                ]},
                { cat: "Command Palette", items: [
                  { key: "Γåæ Γåô", desc: "Navigate results inside palette" },
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
              <div>Pro tip: Open palette with ⌘K and type ΓÇ£workspaceΓÇ¥, ΓÇ£noteΓÇ¥, or a task name to jump instantly.</div>
              <div className="font-mono text-[#c084fc]">Badazz Tasks</div>
            </div>
          </div>
        </div>
      )}

      <NotificationDetailModal
        notification={selectedNotification}
        onClose={() => setSelectedNotification(null)}
        onMarkRead={markNotifRead}
        onViewChange={setView}
      />

      <ConfirmationModal
        open={!!pendingDeleteNote}
        onOpenChange={(open) => !open && setPendingDeleteNote(null)}
        title="Delete this note?"
        highlight={pendingDeleteNoteTitle}
        description="This note and its content will be permanently deleted. This cannot be undone."
        confirmText="Delete note"
        variant="destructive"
        onConfirm={handleConfirmDeleteNote}
      />

      <ConfirmationModal
        open={!!pendingRemoveMember}
        onOpenChange={(open) => !open && setPendingRemoveMember(null)}
        title="Remove team member?"
        highlight={pendingRemoveMember?.label}
        description="They will lose access to this workspace and all its tasks and notes."
        confirmText="Remove member"
        variant="destructive"
        onConfirm={handleConfirmRemoveMember}
      />

      <ConfirmationModal
        open={!!pendingRevokeInvite}
        onOpenChange={(open) => !open && setPendingRevokeInvite(null)}
        title="Revoke invite?"
        highlight={pendingRevokeInvite?.label}
        description="The invitation link will stop working and any pending notification will be cleared."
        confirmText="Revoke invite"
        variant="destructive"
        onConfirm={handleConfirmRevokeInvite}
      />

      <ConfirmationModal
        open={!!pendingResendInvite}
        onOpenChange={(open) => !open && setPendingResendInvite(null)}
        title="Resend invite?"
        highlight={pendingResendInvite?.label}
        description="A fresh invite link will be generated. The previous link will be revoked."
        confirmText="Resend invite"
        onConfirm={handleConfirmResendInvite}
      />

      <ConfirmationModal
        open={pendingLeaveWorkspace}
        onOpenChange={setPendingLeaveWorkspace}
        title="Leave this workspace?"
        highlight={currentWorkspace.name}
        description="You will lose access to all tasks, notes, and team chat in this workspace."
        confirmText="Leave workspace"
        variant="destructive"
        onConfirm={handleConfirmLeaveWorkspace}
      />

      <ConfirmationModal
        open={!!pendingDeleteNotification}
        onOpenChange={(open) => !open && setPendingDeleteNotification(null)}
        title="Delete notification?"
        description="This notification will be permanently removed from your inbox."
        confirmText="Delete"
        variant="destructive"
        onConfirm={handleConfirmDeleteNotification}
      />

      <ConfirmationModal
        open={pendingClearNotifications}
        onOpenChange={setPendingClearNotifications}
        title="Clear all notifications?"
        description={`This will permanently delete all ${notifications.length} notification${notifications.length === 1 ? "" : "s"} in your inbox.`}
        confirmText="Clear all"
        variant="destructive"
        onConfirm={handleConfirmClearNotifications}
      />

    </div>
  );
}

