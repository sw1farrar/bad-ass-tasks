"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Check, Plus, Command, Users, Settings,
  ChevronRight, ChevronDown, Clock, Star, ArrowUpRight, ListChecks, Shield,
  Loader2, User, LogOut, X, Bell, Home, MessageCircle, Zap, Repeat,
  Trash2, Search, RefreshCw, FileText, Download,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

import { useTaskStore } from "@/store/useTaskStore";
import { Task, TaskStatus, ActivityLog, Notification } from "@/types";
import { cn, formatDueDate, triggerHaptic, getUserGreetingName, getNameInitials, formatLocalDateShort } from "@/lib/utils";
import {
  buildTaskCompletionUndoContext,
  showTaskCompletionFeedback,
} from "@/features/tasks/lib/taskCompletionFeedback";
import { registerDualAuthRequiredHandler } from "@/lib/api/apiFetch";
import { useIsMobileViewport } from "@/lib/hooks/useIsMobileViewport";
import { useScrollLock } from "@/lib/hooks/useScrollLock";
import { isDueDatePast } from "@/lib/datetime";
import { formatRoleLabel, type WorkspaceRole } from "@/lib/roles";

import { CommandPalette } from "@/components/CommandPalette";
import { ConfirmationModal } from "@/components/ConfirmationModal";
import { Confetti } from "@/components/Confetti";
import { SupabaseSetupBanner } from "@/components/SupabaseSetupBanner";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { AuthModal } from "@/components/AuthModal";
import { CreateWorkspaceGate } from "@/components/CreateWorkspaceGate";
import { DualAuthGate } from "@/components/DualAuthGate";
import { LandingPage } from "@/components/LandingPage";
import { TaskModal } from "@/components/TaskModal";
import { NotesView } from "@/features/notes/NotesView";
import { useNoteOperations } from "@/features/notes/hooks";
import { useNoteKeyboard } from "@/features/notes/hooks";
import { HomeView, HomeListModal, type HomeListModalTarget } from "@/features/home";
import { SidebarWorkspaceIndicator } from "@/components/SidebarWorkspaceIndicator";
import {
  AnimatedBottomNavItemContent,
  AnimatedWorkspaceName,
  WorkspaceSwitchEffects,
} from "@/components/WorkspaceSwitchEffects";
import { WorkspaceViewHeader } from "@/components/WorkspaceViewHeader";
import { TasksNavIndicator } from "@/components/TasksNavIndicator";
import { countOpenAndOverdueTasks } from "@/features/home/lib/computeWorkspaceTaskStats";
import { getSearchResultDisplayName, isSharedWorkspace } from "@/lib/assignee";
import { ListsView } from "@/features/lists";
import { SiteAdminView } from "@/features/admin";
import "@/features/lists/lists-workspace.css";
import type { HomeFocusItem } from "@/features/home/lib/buildAttentionItems";
import { WorkspaceChatPanel, ChatDrawer, useWorkspaceChat } from "@/features/chat";
import { WorkspaceSettingsView } from "@/features/settings";
import { TransferOwnershipControl } from "@/features/workspace/TransferOwnershipControl";
import {
  TeamsAdminDashboard,
  TeamCollaborationPanel,
  TeamMemberDirectory,
} from "@/features/teams/components";
import { BottomSheet } from "@/components/BottomSheet";
import { NotificationDetailModal } from "@/features/notifications";
import { TasksTable } from "@/features/tasks/components/TasksTable";
import "@/features/tasks/tasks-workspace.css";
import "@/features/teams/teams-workspace.css";

function workspaceAccessLabel(
  workspaceId: string,
  role: string | undefined,
  statsMemberCount: number | undefined,
  currentWorkspaceId: string,
  currentMembersCount: number,
): string {
  const count =
    workspaceId === currentWorkspaceId
      ? Math.max(currentMembersCount, statsMemberCount ?? 0)
      : statsMemberCount;

  if (count === 1) return "Private";
  if (typeof count === "number" && count > 1) return formatRoleLabel(role);
  if (workspaceId === currentWorkspaceId && currentMembersCount <= 1) return "Private";
  return formatRoleLabel(role);
}

const VIEWS = [
  { id: "home", label: "Home", icon: Home },
  { id: "tasks", label: "Tasks", icon: Check },
  { id: "notes", label: "Notes", icon: Star },
  { id: "lists", label: "Lists", icon: ListChecks },
  { id: "teams", label: "Team", icon: Users },
  { id: "settings", label: "Workspace Settings", icon: Settings },
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
    user,
    isAuthLoading,
    isSigningOut,
    isSiteAdmin,
    initializeAuth,
    signOut,
    setView,
    setTaskFilter,
    selectTask,
    toggleCommandPalette,
    toggleKeyboardCheatsheet,
    isKeyboardCheatsheetOpen,
    celebrationTrigger,
    triggerCelebration,
    addTask,
    updateTask,
    deleteTask,
    completeTask,
    undoTaskCompletion,
    taskLoadingStates,
    getFilteredTasks,
    switchWorkspace,
    addNote,
    updateNote,
    deleteNote,
    getWorkspaceLists,
    getListItemsForList,
    getListSummary,
    addList,
    updateList,
    deleteList,
    reorderLists,
    toggleListPinned,
    addListItem,
    toggleListItem,
    updateListItem,
    deleteListItem,
    reorderListItems,
    indentListItem,
    outdentListItem,
    clearCompletedListItems,
    createWorkspace,
    refreshRecentActivity,
    // C4 Phase A Home globals (separate slices)
    globalTodayFocus,
    globalOpenTaskFocus,
    globalWorkspaceStats,
    globalListHighlights,
    fetchGlobalHomeAggregates,
    refreshHomeListAggregatesFromStore,
    refreshHomeNoteAggregatesFromStore,
    refreshHomeTaskFocusFromStore,
    hydrateWorkspaceListData,
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
    myProfile,
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
  const isWorkspaceOwner = myRole === "owner";
  const canManage = ["owner", "admin"].includes(myRole);
  const isLiveWorkspace = isSupabaseConfigured() && !["w1", "w2"].includes(currentWorkspace.id);
  const isDemoWs = ["w1", "w2"].includes(currentWorkspace.id);
  const isSingleOwnerWorkspace = myRole === 'owner' && members.length <= 1 && isLiveWorkspace && !isDemoWs;
  const showWorkspaceChat = isSharedWorkspace(members);


  const [chatOpen, setChatOpen] = useState(false);
  const [isLiveBootstrapping, setIsLiveBootstrapping] = useState(false);
  const [liveBootstrapFinished, setLiveBootstrapFinished] = useState(false);

  // Messages panel open by default on desktop (xl sidebar) — only for multi-member workspaces.
  useEffect(() => {
    if (!showWorkspaceChat) {
      setChatOpen(false);
      return;
    }
    if (window.matchMedia("(min-width: 1280px)").matches) {
      setChatOpen(true);
    }
  }, [currentWorkspace.id, showWorkspaceChat]);

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
  const isMobileViewport = useIsMobileViewport();
  useScrollLock(showNotifications && isMobileViewport);
  const [showProfilePopover, setShowProfilePopover] = useState(false);
  const [showFullTaskModal, setShowFullTaskModal] = useState(false);
  const [modalTask, setModalTask] = useState<Task | null>(null);
  const [homeListModal, setHomeListModal] = useState<HomeListModalTarget | null>(null);
  const [homeTaskModalContext, setHomeTaskModalContext] = useState<{
    workspaceId: string;
    workspaceName: string;
    taskId: string;
  } | null>(null);
  const [pendingWorkspaceNav, setPendingWorkspaceNav] = useState<
    | { kind: "task"; workspaceId: string; taskId: string }
    | { kind: "list"; workspaceId: string; listId: string }
    | null
  >(null);
  const [highlightListId, setHighlightListId] = useState<string | null>(null);
  // Refs for outside click detection
  const workspaceMenuRef = React.useRef<HTMLDivElement>(null);
  const workspaceNameRef = React.useRef<HTMLSpanElement>(null);
  const notificationsRef = React.useRef<HTMLDivElement>(null);
  const profilePopoverRef = React.useRef<HTMLDivElement>(null);
  // Notification detail modal (opened from bell dropdown clicks for better readability + actions)
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);
  // Workspace creation UI state (inline in switcher dropdown — production real DB)
  const [isCreatingWorkspace, setIsCreatingWorkspace] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [isCreatingLoading, setIsCreatingLoading] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [dualAuthChecked, setDualAuthChecked] = useState(false);
  const [dualAuthRequired, setDualAuthRequired] = useState(false);
  const [dualAuthVerified, setDualAuthVerified] = useState(false);
  const [dualAuthEmail, setDualAuthEmail] = useState("");

  // Modern confirmation modals state
  const [pendingDeleteNote, setPendingDeleteNote] = useState<string | null>(null);
  const [pendingRemoveMember, setPendingRemoveMember] = useState<{ userId: string; label: string } | null>(null);
  const [pendingRevokeInvite, setPendingRevokeInvite] = useState<{ inviteId: string; label: string } | null>(null);
  const [pendingResendInvite, setPendingResendInvite] = useState<{ inviteId: string; label: string } | null>(null);
  const [pendingLeaveWorkspace, setPendingLeaveWorkspace] = useState(false);
  const [pendingDeleteNotification, setPendingDeleteNotification] = useState<string | null>(null);
  const [pendingClearNotifications, setPendingClearNotifications] = useState(false);
  const [pendingSignOut, setPendingSignOut] = useState(false);

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
    if (myRole === "owner") {
      toast.error("Owners cannot leave", {
        description: "Transfer ownership in Workspace Settings before leaving this workspace.",
      });
      setPendingLeaveWorkspace(false);
      return;
    }
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
      if (
        showWorkspaceMenu &&
        workspaceMenuRef.current &&
        !workspaceMenuRef.current.contains(event.target as Node)
      ) {
        setShowWorkspaceMenu(false);
      }
      if (
        showNotifications &&
        notificationsRef.current &&
        !notificationsRef.current.contains(event.target as Node)
      ) {
        setShowNotifications(false);
      }
      if (
        showProfilePopover &&
        profilePopoverRef.current &&
        !profilePopoverRef.current.contains(event.target as Node)
      ) {
        setShowProfilePopover(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showProfilePopover, showWorkspaceMenu, showNotifications]);

  // Shrink workspace name on phones so the full label fits without truncating early
  React.useEffect(() => {
    const fitWorkspaceName = () => {
      const el = workspaceNameRef.current;
      if (!el) return;
      const isMobile = window.matchMedia("(max-width: 767px)").matches;
      if (!isMobile) {
        el.style.fontSize = "";
        return;
      }
      const maxSize = 21;
      const minSize = 13;
      let size = maxSize;
      el.style.fontSize = `${size}px`;
      while (el.scrollWidth > el.clientWidth && size > minSize) {
        size -= 0.5;
        el.style.fontSize = `${size}px`;
      }
    };

    fitWorkspaceName();
    const t = window.setTimeout(fitWorkspaceName, 360);
    const parent = workspaceNameRef.current?.parentElement;
    const ro = typeof ResizeObserver !== "undefined" && parent ? new ResizeObserver(fitWorkspaceName) : null;
    ro?.observe(parent!);
    window.addEventListener("resize", fitWorkspaceName);
    return () => {
      window.clearTimeout(t);
      ro?.disconnect();
      window.removeEventListener("resize", fitWorkspaceName);
    };
  }, [currentWorkspace.id, currentWorkspace.name, showWorkspaceMenu]);

  const prevWorkspaceIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (typeof window === "undefined" || window.innerWidth >= 768) {
      prevWorkspaceIdRef.current = currentWorkspace.id;
      return;
    }
    if (prevWorkspaceIdRef.current === null) {
      prevWorkspaceIdRef.current = currentWorkspace.id;
      return;
    }
    if (prevWorkspaceIdRef.current !== currentWorkspace.id) {
      triggerHaptic("light");
      prevWorkspaceIdRef.current = currentWorkspace.id;
    }
  }, [currentWorkspace.id]);

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
  const [inviteRole, setInviteRole] = useState<WorkspaceRole>("member");
  const [isSendingInvite, setIsSendingInvite] = useState(false);
  const [copiedInviteId, setCopiedInviteId] = useState<string | null>(null);

  // New: Team search for Facebook-style "find friends" invites (used especially in empty owner state)
  const [teamSearchQuery, setTeamSearchQuery] = useState("");
  const [teamSearchResults, setTeamSearchResults] = useState<any[]>([]);
  const [isSearchingTeam, setIsSearchingTeam] = useState(false);

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



  // PWA foundation: install prompt + service worker registration (mobile-first, demo safe)
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);

  // Perf: memoize expensive filter + sort (large task lists, frequent re-renders from DnD/state)
  // Note: getFilteredTasks is stable from Zustand but computation is non-trivial.
  const filteredTasks = useMemo(
    () => getFilteredTasks(),
    [getFilteredTasks, tasks, taskFilter, currentWorkspace.id],
  );

  // Mobile task list uses All / Incomplete / Completed — normalize legacy recurrence sub-filters
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const normalize = () => {
      if (!mq.matches) return;
      const mode = taskFilter.recurring ?? "incomplete";
      if (mode === "only" || mode === "none") {
        setTaskFilter({ recurring: "incomplete" });
      }
    };
    normalize();
    mq.addEventListener("change", normalize);
    return () => mq.removeEventListener("change", normalize);
  }, [taskFilter.recurring, setTaskFilter]);

  const currentWorkspaceTaskCounts = useMemo(() => {
    const wsId = currentWorkspace.id;
    const wsTasks = tasks.filter((t) => t.workspaceId === wsId);
    if (wsTasks.length > 0) {
      return countOpenAndOverdueTasks(wsTasks);
    }
    const stats = globalWorkspaceStats?.[wsId];
    return {
      openCount: stats?.openCount ?? 0,
      overdueCount: stats?.overdueCount ?? 0,
    };
  }, [tasks, currentWorkspace.id, globalWorkspaceStats]);

  const selectedTask = useMemo(() => {
    if (!showFullTaskModal) return undefined;
    if (modalTask) {
      const fromWorkspace = tasks.find((t) => t.id === modalTask.id);
      if (fromWorkspace) return fromWorkspace;
      const fromFocus =
        globalTodayFocus.find((f) => f.task.id === modalTask.id)?.task ??
        globalOpenTaskFocus.find((f) => f.task.id === modalTask.id)?.task;
      if (fromFocus) return fromFocus;
      return modalTask;
    }
    return tasks.find((t) => t.id === selectedTaskId);
  }, [showFullTaskModal, modalTask, tasks, selectedTaskId, globalTodayFocus, globalOpenTaskFocus]);

  // selectedNote removed (was only for legacy renderNoteDetail modal; rich detail now inline in Notes view)

  // Initialize auth first; live users get workspace + data bootstrap inside initializeAuth
  // (awaited) so the loading screen stays up until the app is ready. Demo-only init runs after.
  useEffect(() => {
    void (async () => {
      const store = useTaskStore.getState();
      await store.initializeAuth();
      if (!isSupabaseConfigured()) {
        await store.initializeFromSupabase();
      }
    })();
  }, []);

  const liveBootstrapUserRef = React.useRef<string | null>(null);

  const bootstrapLiveSession = React.useCallback(async () => {
    const store = useTaskStore.getState();
    await store.ensureUserHasWorkspace();
    await store.initializeFromSupabase();
    await Promise.all([
      store.fetchSiteAdminStatus(),
      store.fetchMyProfile(),
    ]);
    if (user?.id && isSupabaseConfigured()) {
      (store as { _setupUserNotificationsRealtime?: (id: string) => void })
        ._setupUserNotificationsRealtime?.(user.id);
    }
    await store.fetchNotifications?.(false).catch(() => undefined);
  }, [user?.id]);

  // Dual authentication: email OTP after sign-in unless this device is trusted.
  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setDualAuthChecked(true);
      setDualAuthRequired(false);
      setDualAuthVerified(true);
      return;
    }

    if (!user || isAuthLoading) {
      if (!user) {
        setDualAuthChecked(true);
        setDualAuthRequired(false);
        setDualAuthVerified(false);
        setDualAuthEmail("");
      } else {
        setDualAuthChecked(false);
      }
      return;
    }

    let cancelled = false;
    void (async () => {
      const maxAttempts = 5;
      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        if (cancelled) return;
        try {
          const response = await fetch("/api/auth/dual-auth/status", { cache: "no-store" });
          const payload = (await response.json().catch(() => ({}))) as {
            required?: boolean;
            verified?: boolean;
            enforced?: boolean;
            email?: string;
            error?: string;
          };

          if (response.status === 401 && attempt < maxAttempts - 1) {
            await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
            continue;
          }

          if (cancelled) return;

          if (!response.ok) {
            // Fail closed: require verification when status cannot be confirmed for a live session.
            setDualAuthRequired(true);
            setDualAuthVerified(false);
            setDualAuthEmail(payload.email || user.email || "your email");
            break;
          }

          setDualAuthRequired(!!payload.required);
          setDualAuthVerified(!!payload.verified);
          setDualAuthEmail(payload.email || "your email");
          break;
        } catch {
          if (cancelled) return;
          if (attempt < maxAttempts - 1) {
            await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
            continue;
          }
          setDualAuthRequired(true);
          setDualAuthVerified(false);
          setDualAuthEmail(user.email || "your email");
        }
      }

      if (!cancelled) setDualAuthChecked(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [user, isAuthLoading]);

  // Load live data only after dual-auth passes (or when dual-auth is not enforced).
  useEffect(() => {
    if (!isSupabaseConfigured() || !user || !dualAuthChecked) return;
    if (dualAuthRequired && !dualAuthVerified) return;
    if (liveBootstrapUserRef.current === user.id) return;

    setIsLiveBootstrapping(true);
    setLiveBootstrapFinished(false);
    void bootstrapLiveSession()
      .then(() => {
        liveBootstrapUserRef.current = user.id;
      })
      .catch(() => {
        liveBootstrapUserRef.current = null;
      })
      .finally(() => {
        setIsLiveBootstrapping(false);
        setLiveBootstrapFinished(true);
      });
  }, [user, dualAuthChecked, dualAuthRequired, dualAuthVerified, bootstrapLiveSession]);

  useEffect(() => {
    if (!user) {
      liveBootstrapUserRef.current = null;
      setLiveBootstrapFinished(false);
    }
  }, [user]);

  const handleDualAuthVerified = React.useCallback(() => {
    setDualAuthVerified(true);
  }, []);

  useEffect(() => {
    registerDualAuthRequiredHandler(() => {
      setDualAuthVerified(false);
      toast.info("Verification required", {
        description: "Enter the code from your email to continue.",
      });
    });
    return () => registerDualAuthRequiredHandler(null);
  }, []);

  // Ensure notifications (including cross-workspace invites) are loaded early for the recipient banner + bell badge.
  // The store now auto-fetches on init/switch, but we also kick it here once we have a live user so the global
  // "you were invited" banner appears immediately without requiring the user to open the bell first.
  useEffect(() => {
    if (user && isSupabaseConfigured() && dualAuthVerified) {
      // Fire-and-forget; the store will populate the notifications array which drives the banner.
      fetchNotifications?.(false).catch(() => {});
    }
  }, [user, dualAuthVerified]);

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

  // Open auth modal when middleware or /login redirects with ?signin=1
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("signin") !== "1") return;
    setShowAuthModal(true);
    params.delete("signin");
    const url = new URL(window.location.href);
    url.search = params.toString();
    window.history.replaceState({}, "", url.toString());
  }, []);

  // Deep links for PWA shortcuts + shareable views: ?view=home|tasks|notes|teams
  // Initializes from manifest shortcuts (?view=...&source=pwa). Syncs on change for back/forward + share.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const rawView = params.get("view");
    const urlView =
      rawView === "calendar" || rawView === "today" ? "home" : rawView;
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

  // Pull-to-refresh for mobile lists. Threshold + haptic + optimistic refresh.
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
      const target = e.target as HTMLElement | null;
      if (
        target?.closest(
          ".list-item-drag, .list-card-drag-handle, .sortable-list-card, .list-item-drag-overlay, .list-card-drag-overlay",
        )
      ) {
        return;
      }
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
  const isTrulyLive = isConfigured && !!user && dualAuthVerified;
  const showSessionGate =
    isConfigured && (isAuthLoading || isSigningOut || (!!user && !dualAuthChecked));
  const showLandingGate = isConfigured && !user && !isSigningOut;
  const showDualAuthGate =
    isConfigured &&
    !!user &&
    dualAuthChecked &&
    dualAuthRequired &&
    !dualAuthVerified &&
    !isSigningOut;
  const awaitingLiveBootstrap =
    isConfigured &&
    !!user &&
    dualAuthChecked &&
    (!dualAuthRequired || dualAuthVerified) &&
    !liveBootstrapFinished;

  const showBootstrapGate =
    awaitingLiveBootstrap ||
    isLiveBootstrapping ||
    currentWorkspace.name === "Loading your workspaces...";

  const showNoWorkspaceGate =
    isSupabaseConfigured() &&
    !!user &&
    dualAuthChecked &&
    (!dualAuthRequired || dualAuthVerified) &&
    liveBootstrapFinished &&
    !isLiveBootstrapping &&
    workspaces.length === 0;

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

  const resolveTaskById = React.useCallback((id: string): Task | undefined => {
    const state = useTaskStore.getState();
    return (
      state.tasks.find((t) => t.id === id) ??
      state.globalTodayFocus.find((f) => f.task.id === id)?.task ??
      state.globalOpenTaskFocus.find((f) => f.task.id === id)?.task
    );
  }, []);

  const handleComplete = async (
    id: string,
    undoContext?: { task: Task; workspaceId: string; workspaceName: string },
  ) => {
    triggerHaptic("success");
    const task = resolveTaskById(id);
    if (!task || taskLoadingStates?.[id]) return;

    if (task.status === "done") {
      await updateTask(id, { status: "todo", completedAt: undefined });
      refreshHomeTaskFocusFromStore();
      toast.success("Task reopened", { description: task.title });
      return;
    }

    const undoFallback =
      undoContext ??
      buildTaskCompletionUndoContext(
        task,
        workspaces.find((w) => w.id === task.workspaceId)?.name ?? "Workspace",
      );

    const result = await completeTask(id);
    if (result === "advanced") {
      showTaskCompletionFeedback("advanced", task, {
        undoTaskCompletion,
        undoFallback,
        advancedTask: resolveTaskById(id),
      });
      return;
    }
    if (result === "completed") {
      showTaskCompletionFeedback("completed", task, {
        undoTaskCompletion,
        undoFallback,
        triggerCelebration,
      });
    }
  };

  const closeTaskModal = React.useCallback(() => {
    setShowFullTaskModal(false);
    setModalTask(null);
    setHomeTaskModalContext(null);
  }, []);

  const openTask = (task: Task) => {
    selectTask(task.id);
    setModalTask(task);
    setShowFullTaskModal(true);
  };

  const handleHomeOpenFocusTask = (item: HomeFocusItem) => {
    setHomeTaskModalContext({
      workspaceId: item.workspaceId,
      workspaceName: item.workspaceName,
      taskId: item.task.id,
    });
    openTask(item.task);
  };

  const navigateToTaskInWorkspace = (workspaceId: string, taskId: string) => {
    setShowFullTaskModal(false);
    setModalTask(null);
    setPendingWorkspaceNav({ kind: "task", workspaceId, taskId });
    setView("tasks");
    if (currentWorkspace.id !== workspaceId) {
      switchWorkspace(workspaceId);
    }
  };

  const navigateToListInWorkspace = (workspaceId: string, listId: string) => {
    refreshHomeListAggregatesFromStore();
    setHomeListModal(null);
    setView("lists");
    if (currentWorkspace.id !== workspaceId) {
      setPendingWorkspaceNav({ kind: "list", workspaceId, listId });
      switchWorkspace(workspaceId);
      return;
    }
    void hydrateWorkspaceListData(workspaceId).then(() => {
      setHighlightListId(listId);
    });
  };

  const handleHomeOpenList = (listId: string, workspaceId: string) => {
    const highlight = (globalListHighlights || []).find(
      (l) => l.id === listId && l.workspaceId === workspaceId,
    );
    const storedList = useTaskStore
      .getState()
      .workspaceLists.find((l) => l.id === listId && l.workspaceId === workspaceId);
    const workspaceName =
      highlight?.workspaceName ??
      workspaces.find((w) => w.id === workspaceId)?.name ??
      "Workspace";
    setHomeListModal({
      listId,
      workspaceId,
      workspaceName,
      title: highlight?.title ?? storedList?.title ?? "Untitled list",
      color: highlight?.color ?? storedList?.color ?? "default",
    });
  };

  const handleHomeCompleteFocusTask = async (item: HomeFocusItem) => {
    const wasDone = item.task.status === "done";
    await handleComplete(item.task.id, {
      task: item.task,
      workspaceId: item.workspaceId,
      workspaceName: item.workspaceName,
    });
    refreshHomeTaskFocusFromStore();

    const state = useTaskStore.getState();
    const hasLocalTasks = state.tasks.some((t) => t.workspaceId === item.workspaceId);
    if (!hasLocalTasks) {
      const stats = state.globalWorkspaceStats[item.workspaceId];
      if (stats) {
        useTaskStore.setState({
          globalWorkspaceStats: {
            ...state.globalWorkspaceStats,
            [item.workspaceId]: {
              ...stats,
              openCount: wasDone
                ? stats.openCount + 1
                : Math.max(0, stats.openCount - 1),
              doneCount: wasDone
                ? Math.max(0, stats.doneCount - 1)
                : stats.doneCount + 1,
            },
          },
        });
      }
    }
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
    return getUserGreetingName({
      profileFullName: profileFullName || myProfile?.fullName,
      memberFullName: myProfile?.fullName || selfMember?.fullName,
      authFullName: metaName,
      email: user?.email,
    });
  }, [user, profileFullName, myProfile, members]);

  const avatarInitials = useMemo(() => {
    const selfMember = members.find((m) => m.userId === user?.id);
    const metaName = (user?.user_metadata as { full_name?: string } | undefined)?.full_name;
    const fromName = getNameInitials(myProfile?.fullName || selfMember?.fullName || metaName);
    if (fromName) return fromName;
    if (user?.email) return user.email.charAt(0).toUpperCase();
    return "";
  }, [user, myProfile, members]);

  const renderTasksView = () => (
    <div className="tasks-root">
      <div className="tasks-workspace flex flex-col min-h-0 w-full">
        <WorkspaceViewHeader
          variant="inline"
          title="Tasks"
          workspaceName={currentWorkspace.name}
          icon={<Check className="h-6 w-6" />}
          meta={`${filteredTasks.length} task${filteredTasks.length === 1 ? "" : "s"} · ${currentWorkspaceTaskCounts.openCount} open`}
          hideWorkspaceLabelOnMobile
          hideWorkspaceNameOnMobile
          hideMetaOnMobile
          className="mb-1"
        />
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-1">
          <input
            value={taskFilter.search || ""}
            onChange={(e) => setTaskFilter({ search: e.target.value })}
            placeholder="Search tasks"
            className="tasks-page-search input px-3 py-2.5 rounded-xl text-sm w-full md:max-w-md"
          />
          <div className="task-recurring-filters w-full max-md:w-full md:w-auto md:shrink-0 overflow-x-auto md:overflow-visible pb-1">
            <div
              className="task-recurring-filters__track flex w-full md:w-auto items-center gap-0.5 md:gap-0.5 p-1 md:p-0.5 rounded-full border border-white/10 bg-white/[0.04]"
              role="group"
              aria-label="Filter tasks by status"
            >
            {(["all", "incomplete", "completed"] as const).map((mode) => {
              const activeMode = taskFilter.recurring ?? "incomplete";
              const isActive = activeMode === mode;
              const label =
                mode === "all" ? "All" : mode === "incomplete" ? "Incomplete" : "Complete";
              return (
                <button
                  key={`task-status-filter-${mode}`}
                  type="button"
                  onClick={() => setTaskFilter({ recurring: mode })}
                  aria-pressed={isActive}
                  className={cn(
                    "task-recurring-filter-pill inline-flex items-center justify-center rounded-full text-xs font-semibold whitespace-nowrap transition-all",
                    "flex-1 min-w-0 max-md:flex-1 md:flex-none h-9 max-md:px-1.5 md:h-7 md:px-2.5 min-h-0",
                    isActive
                      ? "is-active bg-[#c084fc] text-black shadow-[0_0_12px_rgba(192,132,252,0.28)]"
                      : "text-[#a1a1aa] hover:text-white hover:bg-white/5",
                  )}
                >
                  {label}
                </button>
              );
            })}
            </div>
          </div>
        </div>

        <TasksTable
          tasks={filteredTasks}
          taskLoadingStates={taskLoadingStates}
          onOpenTask={openTask}
          onComplete={handleComplete}
          onAddTask={addTask}
          onSwipeComplete={handleComplete}
          showAssignee={isSharedWorkspace(members)}
        />
      </div>
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

  const handleCreateFirstWorkspace = async (name: string) => {
    setIsCreatingLoading(true);
    try {
      const created = await createWorkspace(name);
      return !!created;
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

      if (!typing && !paletteOpen && !showFullTaskModal && !homeListModal && !showAuthModal && !isKeyboardCheatsheetOpen) {
        if (e.key === "1") { setView("tasks"); return; }
        if (e.key === "2") { setView("notes"); return; }
        if (e.key === "3") { setView("lists"); return; }
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
          return;
        }
        if (homeListModal) {
          setHomeListModal(null);
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

      if (
        e.key === " " &&
        selectedTaskId &&
        !typing &&
        !showFullTaskModal &&
        !paletteOpen &&
        !isKeyboardCheatsheetOpen
      ) {
        e.preventDefault();
        const task = resolveTaskById(selectedTaskId);
        if (task) {
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
    handleComplete,
    resolveTaskById,
    closeTaskModal,
    toggleCommandPalette,
    toggleKeyboardCheatsheet,
    isCommandPaletteOpen,
    isKeyboardCheatsheetOpen,
    showFullTaskModal,
    homeListModal,
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
      refreshHomeNoteAggregatesFromStore();
      fetchNotifications?.(false).catch(() => {});
    }
  }, [currentView, fetchGlobalHomeAggregates, refreshHomeNoteAggregatesFromStore, fetchNotifications]);

  useEffect(() => {
    if (workspaceChat.hasUnread) {
      fetchGlobalHomeAggregates();
    }
  }, [workspaceChat.hasUnread, fetchGlobalHomeAggregates]);

  useEffect(() => {
    if (currentView !== "lists") setHighlightListId(null);
  }, [currentView]);

  useEffect(() => {
    if (!pendingWorkspaceNav) return;
    if (currentWorkspace.id !== pendingWorkspaceNav.workspaceId) return;

    if (pendingWorkspaceNav.kind === "task") {
      if (currentView !== "tasks") return;
      const task =
        tasks.find((t) => t.id === pendingWorkspaceNav.taskId) ??
        globalTodayFocus.find((f) => f.task.id === pendingWorkspaceNav.taskId)?.task ??
        globalOpenTaskFocus.find((f) => f.task.id === pendingWorkspaceNav.taskId)?.task;
      if (task) {
        setHomeTaskModalContext(null);
        openTask(task);
        setPendingWorkspaceNav(null);
      }
      return;
    }

    if (currentView !== "lists") return;
    void hydrateWorkspaceListData(pendingWorkspaceNav.workspaceId).then(() => {
      setHighlightListId(pendingWorkspaceNav.listId);
      setPendingWorkspaceNav(null);
    });
  }, [
    pendingWorkspaceNav,
    currentWorkspace.id,
    currentView,
    tasks,
    globalTodayFocus,
    globalOpenTaskFocus,
    hydrateWorkspaceListData,
  ]);

  const renderHomeView = () => {
    const workspacePulse = (workspaces || []).map((ws) => {
      const wsFocus = (globalTodayFocus || []).filter((f) => f.workspaceId === ws.id);
      const stats = globalWorkspaceStats?.[ws.id];
      const overdue = stats?.overdueCount ?? wsFocus.filter((f) => {
        if (!f.task.dueDate) return false;
        return isDueDatePast(f.task.dueDate);
      }).length;

      const assignedToYou = wsFocus.filter(
        (f) =>
          f.task.assigneeIds?.[0] === user?.id || f.task.assignee === "You"
      ).length;

      return {
        id: ws.id,
        name: ws.name,
        role: ws.role,
        openTasks: stats?.openCount ?? 0,
        dueToday: stats?.dueTodayCount ?? wsFocus.length,
        overdue,
        assigneeBreakdown: stats?.assigneeBreakdown ?? [],
        assignedToYou,
        unreadNotifications: (notifications || []).filter(
          (n: Notification) => !n.readAt && n.workspaceId === ws.id
        ).length,
        unreadChat: stats?.unreadChat ?? false,
        isCurrent: currentWorkspace.id === ws.id,
        onlineCount: currentWorkspace.id === ws.id ? (onlineUsers || []).length : undefined,
        listCount: stats?.listCount ?? 0,
        openListItemsCount: stats?.openListItemsCount ?? 0,
        noteCount: stats?.noteCount ?? 0,
        taskCount:
          stats?.totalTaskCount ??
          (tasks || []).filter((t) => t.workspaceId === ws.id).length,
        memberCount: stats?.memberCount,
      };
    });

    return (
      <HomeView
        userDisplayName={homeUserDisplayName}
        workspaces={workspaces}
        switchWorkspace={switchWorkspace}
        setView={setView}
        globalTodayFocus={globalTodayFocus}
        globalOpenTaskFocus={globalOpenTaskFocus}
        notifications={notifications}
        workspacePulse={workspacePulse}
        taskLoadingStates={taskLoadingStates}
        listPreviews={(globalListHighlights || []).map((list) => ({
          id: list.id,
          title: list.title,
          color: list.color,
          workspaceId: list.workspaceId,
          workspaceName: list.workspaceName,
          openCount: list.openCount,
          totalCount: list.totalCount,
          preview: list.preview,
          pinned: list.pinned,
        }))}
        onOpenList={handleHomeOpenList}
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
    completeTask,
    addTask,
    openTask,
    setPendingDeleteNote,
    // M2 tiny extraction: pass isTrulyLive so the extracted handlePersistSnapshot
    // (moved out of this renderNotesView) can apply the exact same live-only guard.
    isTrulyLive,
  });

  const renderListsView = () => {
    const lists = getWorkspaceLists();
    return (
      <div className="lists-root flex flex-col min-h-0 flex-1">
      <ListsView
        workspaceName={currentWorkspace.name}
        lists={lists}
        getItemsForList={getListItemsForList}
        onAddList={(title) => { void addList(title); }}
        onUpdateList={(id, updates) => { void updateList(id, updates); }}
        onDeleteList={(id) => { void deleteList(id); }}
        onTogglePinned={(id) => { void toggleListPinned(id); }}
        onAddItem={(listId, text) => { void addListItem(listId, text); }}
        onToggleItem={(id) => { void toggleListItem(id); }}
        onUpdateItem={(id, text) => { void updateListItem(id, { text }); }}
        onDeleteItem={(id) => { void deleteListItem(id); }}
        onReorderLists={reorderLists}
        onReorderItems={reorderListItems}
        onIndentItem={(id) => { void indentListItem(id); }}
        onOutdentItem={(id) => { void outdentListItem(id); }}
        onClearCompleted={(listId) => { void clearCompletedListItems(listId); }}
        highlightListId={highlightListId}
      />
      </div>
    );
  };

  const renderNotesView = () => {
    return (
      <NotesView
        notes={notes}
        tasks={tasks}
        workspaceId={currentWorkspace.id}
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
        onToggleTaskComplete={noteOps.onToggleTaskComplete}
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

    const openEmailInviteSheet = () => {
      setInviteEmail("");
      setShowInviteDialog(true);
    };

    const handleSendInvite = async () => {
      if (!isLiveWorkspace || ["w1", "w2"].includes(currentWorkspace.id)) {
        toast.info("Invites require a live Supabase workspace");
        return;
      }

      const emailVal = inviteEmail.trim();
      if (isMobileViewport && !emailVal) {
        toast.error("Enter an email address");
        return;
      }

      setIsSendingInvite(true);
      try {
        const inviteId = await sendInvite(emailVal || undefined, inviteRole);

        if (inviteId) {
          if (isMobileViewport && emailVal) {
            toast.success("Invite sent!", {
              description: "They will receive an email notification.",
            });
            setShowInviteDialog(false);
          } else {
            const link = `${window.location.origin}/invite/${inviteId}`;
            try {
              await navigator.clipboard.writeText(link);
              setCopiedInviteId(inviteId);
              setTimeout(() => setCopiedInviteId(null), 2500);
              toast.success("Invite sent & link copied!", { description: "They can join via the link." });
            } catch {
              toast.success("Invite created", { description: link });
            }
            setShowInviteDialog(false);
          }

          setInviteEmail("");
          setTeamSearchQuery("");
          setTeamSearchResults([]);
          await fetchInvites();
          setTeamSearchResults((r) => r);
        }
      } finally {
        setIsSendingInvite(false);
      }
    };

    const closeInviteDialog = () => {
      setShowInviteDialog(false);
      setInviteEmail("");
    };

    const renderTeamInviteSheet = () => (
      <BottomSheet
        open={showInviteDialog}
        onClose={closeInviteDialog}
        title={isMobileViewport ? "Invite by email" : `Invite to ${currentWorkspace.name}`}
        zIndex={220}
        panelClassName="glass team-invite-modal"
        mobileLayout={isMobileViewport ? "centered" : "sheet"}
        showClose={!isMobileViewport}
        showDragHandle={false}
        enableDragDismiss={!isMobileViewport}
      >
        {isMobileViewport ? (
          <div className="team-invite-sheet p-5 space-y-4">
            <div>
              <label htmlFor="team-invite-email" className="text-xs text-[#a1a1aa] block mb-1.5">
                Email address
              </label>
              <input
                id="team-invite-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="teammate@company.com"
                className="w-full bg-[#111114] border border-white/20 focus:border-[#c084fc] rounded-xl px-4 py-3 text-base outline-none min-h-[48px]"
                disabled={isSendingInvite}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && inviteEmail.trim() && !isSendingInvite) {
                    void handleSendInvite();
                  }
                }}
              />
            </div>
            <div className="flex flex-col gap-2 pt-1">
              <button
                type="button"
                onClick={() => void handleSendInvite()}
                disabled={isSendingInvite || !inviteEmail.trim()}
                className="w-full btn btn-primary py-3.5 min-h-[48px] text-sm font-semibold disabled:opacity-60"
              >
                {isSendingInvite ? "Sending..." : "Send invite"}
              </button>
              <button
                type="button"
                onClick={closeInviteDialog}
                disabled={isSendingInvite}
                className="w-full btn btn-secondary py-3 min-h-[44px] text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="p-5 space-y-4">
            <div>
              <label className="text-xs text-[#a1a1aa] block mb-1.5">Email (optional)</label>
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="teammate@company.com (leave blank for link-only)"
                className="w-full bg-[#111114] border border-white/20 focus:border-[#c084fc] rounded-xl px-4 py-3 text-sm outline-none min-h-[44px]"
                disabled={isSendingInvite}
              />
            </div>
            <div>
              <label className="text-xs text-[#a1a1aa] block mb-1.5">Role</label>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as WorkspaceRole)}
                className="w-full bg-[#111114] border border-white/20 rounded-xl px-4 py-3 text-sm min-h-[44px]"
                disabled={isSendingInvite}
              >
                <option value="member">Member (default)</option>
                <option value="admin">Admin</option>
                <option value="owner">Owner</option>
              </select>
            </div>
            <div className="pt-2 flex flex-col-reverse sm:flex-row gap-3">
              <button
                type="button"
                onClick={() => setShowInviteDialog(false)}
                className="flex-1 btn btn-secondary py-3 min-h-[44px]"
                disabled={isSendingInvite}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleSendInvite()}
                disabled={isSendingInvite}
                className="flex-1 btn btn-primary py-3 min-h-[44px] disabled:opacity-60"
              >
                {isSendingInvite ? "Creating..." : "Create & Copy Invite Link"}
              </button>
            </div>
          </div>
        )}
      </BottomSheet>
    );

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

    const handleRoleChange = async (userId: string, newRole: WorkspaceRole) => {
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

    // === Special modern empty state for owners with no other members yet ===
    // Inlined predicate (using early-declared myRole/members/etc.) completely removes the
    // 'isEmptyOwnerState' identifier from executable code. This eliminates all TDZ risk.
    if (myRole === 'owner' && members.length <= 1 && isLiveWorkspace && !isDemoWs) {
      return (
        <div className="teams-root">
        <div className="teams-workspace teams-workspace--empty max-w-2xl mx-auto pt-4 md:pt-12 pb-8 md:pb-20">
          <div className="team-empty-hero text-center mb-6 md:mb-10">
            <div className="mx-auto mb-4 md:mb-6 h-14 w-14 md:h-20 md:w-20 rounded-2xl md:rounded-3xl bg-gradient-to-br from-[#c084fc] to-[#a855f7] flex items-center justify-center">
              <Users className="h-7 w-7 md:h-10 md:w-10 text-black" />
            </div>
            <div className="text-2xl md:text-4xl font-semibold tracking-tighter mb-2">Team</div>
            <div className="hidden md:inline-flex max-w-full items-center rounded-lg border border-[#c084fc]/25 bg-[#c084fc]/8 px-3 py-1 text-sm font-semibold tracking-tight text-[#e9d5ff] mb-3 truncate">
              {currentWorkspace.name}
            </div>
            <p className="team-empty-private-notice text-sm text-[#a1a1aa] max-w-md mx-auto leading-relaxed px-3 md:px-0">
              You&apos;re in a private workspace and don&apos;t have teammates yet. Search below to find
              people and invite them.
            </p>

            {/* Recipient context — only show for non-owners of this workspace */}
            {currentWorkspace.role && currentWorkspace.role !== 'owner' && (
              <div className="mt-4 mb-2 text-sm text-[#c084fc] bg-[#c084fc]/10 border border-[#c084fc]/20 rounded-xl px-4 py-2 inline-block">
                You were invited to this workspace.
              </div>
            )}
          </div>

          {/* === "Invites sent" — primary focus once any exist (world-class simple feedback) === */}
          {invites.length > 0 && (
            <div className="team-empty-card glass rounded-2xl md:rounded-3xl p-4 md:p-8 border border-white/10 mb-4 md:mb-8">
              <div className="flex items-center justify-between mb-4 md:mb-6">
                <div className="flex items-center gap-2 md:gap-3 min-w-0">
                  <div className="font-semibold text-base md:text-xl tracking-tight">Invites sent</div>
                  <div className="px-3 py-0.5 rounded-full bg-[#c084fc]/20 text-sm font-mono text-[#c084fc] border border-[#c084fc]/30">
                    {invites.length}
                  </div>
                </div>
                <div className="text-xs text-[#71717a] font-mono">Pending</div>
              </div>

              <div className="space-y-2 md:space-y-3">
                {invites.map((inv, index) => (
                  <div key={inv.id} className="team-invite-sent-row flex items-center justify-between p-3 md:p-4 rounded-xl md:rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition group">
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

                    <div className="team-invite-sent-row__actions flex items-center gap-2 opacity-80 group-hover:opacity-100 transition">
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
          <div className="team-empty-card glass rounded-2xl md:rounded-3xl p-4 md:p-8 border border-white/10 mb-4 md:mb-8">
            <div className="font-semibold text-base md:text-lg mb-3 md:mb-4 flex items-center gap-2">
              <Search className="h-5 w-5 text-[#c084fc] shrink-0" /> Find people
            </div>

            <div className="relative">
              <input
                type="text"
                value={teamSearchQuery}
                onChange={(e) => {
                  const q = e.target.value;
                  setTeamSearchQuery(q);
                  setIsSearchingTeam(true);
                  setTeamSearchResults([]);
                  if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
                  if (!q.trim()) {
                    setIsSearchingTeam(false);
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
                className="team-empty-search-input input w-full px-4 md:px-5 py-3 md:py-4 text-sm md:text-lg rounded-xl md:rounded-2xl mb-3 md:mb-4 pr-11"
              />
              {teamSearchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setTeamSearchQuery("");
                    setTeamSearchResults([]);
                    setIsSearchingTeam(false);
                    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
                  }}
                  className="team-empty-search-clear absolute right-2 top-1/2 -translate-y-1/2 text-[#71717a] hover:text-white"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {isSearchingTeam && (
              <div className="flex items-center gap-2 text-sm text-[#a1a1aa] mb-3 px-1">
                <Loader2 className="h-4 w-4 animate-spin" /> Searching directory...
              </div>
            )}

            {!isSearchingTeam && teamSearchResults.length > 0 && (
              <div className="space-y-2 mb-4">
                {teamSearchResults.map((result, idx) => {
                  const initial = (result.fullName || result.username || result.email || "?").toString()[0].toUpperCase();
                  const displayName = getSearchResultDisplayName(result);
                  return (
                    <div key={result.id || idx} className="team-invite-result-row flex items-center justify-between p-3 md:p-4 rounded-xl md:rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition">
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
                            openEmailInviteSheet();
                            return;
                          }

                          // Automatically send the invite using the email from the search result
                          // (email is never shown to the sender for privacy)
                          const inviteId = await sendInvite(result.email, "member", result.id);

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
              isMobileViewport ? (
                <div className="team-search-not-found rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-6 text-center mb-2">
                  <div className="mx-auto mb-3 h-12 w-12 rounded-full bg-[#c084fc]/10 border border-[#c084fc]/30 flex items-center justify-center">
                    <User className="h-5 w-5 text-[#c084fc]" />
                  </div>
                  <p className="text-base font-semibold tracking-tight text-[#f4f4f5] mb-5">
                    User not found
                  </p>
                  <button
                    type="button"
                    onClick={openEmailInviteSheet}
                    className="w-full btn btn-primary min-h-[48px] text-sm font-semibold shadow-[0_0_20px_rgba(192,132,252,0.2)]"
                  >
                    Invite
                  </button>
                </div>
              ) : (
                <div className="text-sm text-[#71717a] mb-4 px-1">
                  No matches in the directory.
                </div>
              )
            )}
          </div>





          {/* "While you wait" tip — only show if profile is incomplete */}
          {(() => {
            const selfMember = members.find((m) => m.userId === user?.id);
            // Profile completion prompt removed — editing now lives exclusively in the avatar menu.
            return null;
          })()}

          {renderTeamInviteSheet()}
        </div>
        </div>
      );
    }

    const teamOnlineUserIds = new Set(
      (onlineUsers || [])
        .map((u) => u.userId)
        .filter((id): id is string => !!id)
    );

    return (
      <div className="teams-root">
      <div className="teams-workspace flex flex-col gap-3 md:gap-8 pb-8 md:pb-12">
        <WorkspaceViewHeader
          variant="inline"
          title="Team"
          workspaceName={currentWorkspace.name}
          icon={<Users className="h-6 w-6" />}
          meta={`${members.length} member${members.length === 1 ? "" : "s"}${onlineUsers.length > 0 ? ` · ${onlineUsers.length} online` : ""}`}
          hideWorkspaceLabelOnMobile
          hideWorkspaceNameOnMobile
          hideMetaOnMobile
          className="mb-0 md:mb-2"
          actions={
            canManage && isLive && !isDemoWs ? (
              <button
                onClick={() => setShowInviteDialog(true)}
                className="btn btn-primary text-sm flex items-center gap-2 min-h-[40px] md:min-h-[44px]"
              >
                <Plus className="h-4 w-4" /> Invite
              </button>
            ) : undefined
          }
        />

        <TeamMemberDirectory
          members={members}
          tasks={tasks}
          onlineUserIds={teamOnlineUserIds}
          currentUserId={user?.id}
          isLoading={isLoadingMembers}
          renderMemberActions={(m, isSelf) => {
            const canActOnThis = canManage && !isSelf;
            if (canActOnThis) {
              return (
                <div className="flex items-center gap-2">
                  <select
                    value={m.role}
                    onChange={(e) => handleRoleChange(m.userId, e.target.value as WorkspaceRole)}
                    className="bg-[#111114] border border-white/20 rounded px-2 py-1 text-xs font-mono focus:outline-none focus:border-[#c084fc]"
                    disabled={!isLive}
                  >
                    <option value="member">Member</option>
                    <option value="admin">Admin</option>
                    <option value="owner">Owner</option>
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
              );
            }
            if (isSelf) {
              if (myRole === "owner") {
                return (
                  <TransferOwnershipControl
                    members={members}
                    currentUserId={user?.id}
                    disabled={!isLive}
                    variant="compact"
                  />
                );
              }
              return (
                <button
                  onClick={() => {
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
              );
            }
            return null;
          }}
        />

        <TeamCollaborationPanel
          tasks={tasks}
          members={members}
          recentActivity={recentActivity}
          currentUserId={user?.id}
          onlineCount={onlineUsers.length}
          onOpenTasks={() => setView("tasks")}
          onOpenHome={() => setView("home")}
          onOpenChat={() => setChatOpen(true)}
        />

        {/* Pending Invites (owner/admin only) */}
        {canManage && isLive && !isDemoWs && (
          <div className="team-pending-panel glass rounded-2xl border border-white/10 overflow-hidden">
            <div className="team-pending-header px-5 py-3 border-b border-white/10 flex items-center justify-between bg-white/5">
              <div className="font-medium text-sm md:text-base">Pending invites ({invites.length})</div>
            </div>
            {invites.length === 0 ? (
              <div className="p-4 md:p-6 text-sm text-[#71717a]">None</div>
            ) : (
              <div className="divide-y divide-white/10 text-sm">
                {invites.map((inv) => (
                  <div key={inv.id} className="team-pending-row flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">
                        {inv.invitedFullName || (inv.invitedUsername ? `@${inv.invitedUsername}` : "Link-only invite")}
                      </div>
                      <div className="text-[11px] text-[#71717a] font-mono">{formatRoleLabel(inv.role)}</div>
                    </div>
                    <div className="team-pending-row__actions flex items-center gap-2">
                      <button
                        onClick={() => copyInviteLink(inv.id)}
                        className="btn btn-secondary text-xs px-3 py-1 flex items-center gap-1"
                      >
                        {copiedInviteId === inv.id ? "Copied!" : "Copy"}
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
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {canManage && (
          <TeamsAdminDashboard
            currentWorkspace={currentWorkspace}
            myRole={myRole}
            isSingleOwnerWorkspace={isSingleOwnerWorkspace}
            isLiveWorkspace={isLiveWorkspace}
            tasks={tasks}
            notes={notes}
            members={members}
            recentActivity={recentActivity}
            onOpenWorkspaceSettings={() => setView("settings")}
            canEditWorkspaceDetails={isWorkspaceOwner}
          />
        )}

        {renderTeamInviteSheet()}
      </div>
      </div>
    );
  };

  const currentViewComponent = () => {
    switch (currentView) {
      case "home": return renderHomeView();
      case "tasks": return renderTasksView();
      case "notes": return renderNotesView();
      case "lists": return renderListsView();
      case "teams": return renderTeamsView();
      case "settings": return <WorkspaceSettingsView />;
      case "admin": return isSiteAdmin ? <SiteAdminView /> : renderHomeView();
      default: return renderHomeView();
    }
  };

  // Hold UI until auth bootstrap or sign-out finishes — prevents flash of app chrome or stale data.
  if (showSessionGate) {
    return (
      <div className="fixed inset-0 z-[150] flex items-center justify-center bg-[#0a0a0f] text-[#f4f4f5]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-[#c084fc]" aria-hidden="true" />
          <p className="text-sm text-[#71717a]">{isSigningOut ? "Signing out…" : "Loading…"}</p>
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
            toast.success("Signed in", {
              description: "Enter the verification code from your email.",
              duration: 4000,
            });
          }}
        />
      </>
    );
  }

  if (showDualAuthGate) {
    return (
      <DualAuthGate
        maskedEmail={dualAuthEmail}
        onVerified={handleDualAuthVerified}
        onSignOut={() => {
          void signOut();
        }}
      />
    );
  }

  if (showBootstrapGate) {
    return (
      <div className="fixed inset-0 z-[150] flex items-center justify-center bg-[#0a0a0f] text-[#f4f4f5]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-[#c084fc]" aria-hidden="true" />
          <p className="text-sm text-[#71717a]">Loading your workspaces…</p>
        </div>
      </div>
    );
  }

  if (showNoWorkspaceGate) {
    return (
      <CreateWorkspaceGate
        userEmail={user?.email}
        onCreate={handleCreateFirstWorkspace}
        isCreating={isCreatingLoading}
      />
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#0a0a0f] text-[#f4f4f5]">
      {/* Top Bar — mobile: row 1 brand + actions, row 2 edge-to-edge workspace */}
      <div className="top-bar relative md:h-16 md:flex md:items-center border-b border-white/10 z-50 bg-[#0a0a0f]/95 backdrop-blur-xl">
        <div className="top-bar-layout w-full md:px-5 md:flex md:items-center md:justify-between md:gap-4">
          <div className="top-bar-leading md:flex md:items-center md:gap-4 md:min-w-0 md:flex-1">
            <div className="top-bar-brand flex items-center gap-2 min-w-0 overflow-hidden">
              <div className="h-7 w-7 md:h-8 md:w-8 rounded-lg bg-gradient-to-br from-[#c084fc] to-[#a855f7] flex items-center justify-center flex-shrink-0">
                <Check className="h-4 w-4 md:h-4.5 md:w-4.5 text-black" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-semibold tracking-[-0.3px] text-sm md:text-[17px] leading-none truncate">Badazz Tasks</div>
              </div>
            </div>

            {/* Workspace Switcher — full-bleed second row on mobile */}
            <div ref={workspaceMenuRef} className="top-bar-workspace relative min-w-0 md:shrink-0">
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
              className="group relative flex items-center gap-2 text-base md:text-sm px-4 py-3 md:px-4 md:py-2 rounded-none md:rounded-xl hover:bg-white/5 border-0 border-t md:border border-white/10 workspace-switcher w-full md:w-[28rem] max-md:grid max-md:grid-cols-[auto_minmax(0,1fr)] max-md:items-center md:justify-between min-h-[48px] md:min-h-[44px] max-md:pl-3 max-md:pr-0 max-md:overflow-hidden"
              aria-expanded={showWorkspaceMenu}
            >
              <WorkspaceSwitchEffects
                workspaceId={currentWorkspace.id}
                variant="mobile"
                className="md:hidden z-0"
              />
              <span
                className={cn(
                  "workspace-chevron relative z-[1] flex shrink-0 items-center justify-center rounded-lg border transition-all duration-200 ease-out",
                  "h-8 w-8 md:h-7 md:w-7 max-md:col-start-1",
                  showWorkspaceMenu
                    ? "bg-[#c084fc]/15 border-[#c084fc]/40 text-[#c084fc] shadow-[0_0_14px_rgba(192,132,252,0.22)]"
                    : "bg-white/[0.04] border-white/10 text-[#71717a] group-hover:bg-[#c084fc]/10 group-hover:border-[#c084fc]/25 group-hover:text-[#c084fc]"
                )}
                aria-hidden
              >
                <ChevronDown
                  className={cn(
                    "h-4 w-4 md:h-3.5 md:w-3.5 transition-transform duration-200 ease-out",
                    showWorkspaceMenu && "rotate-180"
                  )}
                  strokeWidth={2.25}
                />
              </span>
              <span className="relative z-[1] flex items-center justify-center md:justify-start gap-1.5 workspace-name min-w-0 md:flex-1 max-md:col-start-2 max-md:overflow-hidden max-md:pr-2 md:truncate">
                <span className="md:hidden block w-full min-w-0">
                  <AnimatedWorkspaceName
                    ref={workspaceNameRef}
                    workspaceId={currentWorkspace.id}
                    name={currentWorkspace.name}
                    className="workspace-name-label block w-full whitespace-nowrap text-center text-[21px] font-semibold leading-tight"
                  />
                </span>
                <span className="hidden md:block truncate text-left text-sm font-normal leading-tight">
                  {currentWorkspace.name}
                </span>
                {!isSingleOwnerWorkspace && (
                  <span className="hidden md:inline text-[9px] px-1 py-px rounded bg-white/5 text-[#a1a1aa] font-mono tracking-widest shrink-0">{formatRoleLabel(currentWorkspace.role)}</span>
                )}
              </span>
            </button>

            <AnimatePresence>
              {showWorkspaceMenu && (
                <div className="absolute top-full left-0 right-0 md:right-auto mt-1 md:mt-0 md:top-12 top-bar-menu-panel glass rounded-2xl py-1 w-full md:w-[28rem] shadow-xl z-50 border border-white/10">
                  {workspaces.map((ws) => {
                    const accessLabel = workspaceAccessLabel(
                      ws.id,
                      ws.role,
                      globalWorkspaceStats?.[ws.id]?.memberCount,
                      currentWorkspace.id,
                      members.length,
                    );
                    return (
                    <button 
                      key={ws.id}
                      onClick={() => { switchWorkspace(ws.id); setShowWorkspaceMenu(false); }}
                      className={cn("w-full text-left px-4 py-2.5 text-sm hover:bg-white/5 flex justify-between items-center gap-2", ws.id === currentWorkspace.id && "text-[#c084fc]")}
                    >
                      <span className="flex items-center gap-1.5 min-w-0 flex-1">
                        <span className="truncate">{ws.name}</span>
                        <span
                          className={cn(
                            "md:hidden text-[9px] px-1.5 py-px rounded shrink-0 font-semibold uppercase tracking-wide",
                            accessLabel === "Private"
                              ? "bg-white/5 text-[#71717a]"
                              : "bg-white/5 text-[#a1a1aa]",
                          )}
                        >
                          {accessLabel}
                        </span>
                        <span className="hidden md:inline text-[10px] px-1.5 py-px rounded bg-white/5 text-[#71717a] font-mono tracking-widest shrink-0">
                          {accessLabel}
                        </span>
                      </span>
                      {ws.id === currentWorkspace.id && <Check className="h-3.5 w-3.5 shrink-0" />}
                    </button>
                    );
                  })}
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

        <div className="top-bar-actions flex items-center gap-1.5 md:gap-3 text-sm shrink-0 flex-nowrap">
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
              className="btn btn-ghost h-11 w-11 min-h-[44px] min-w-[44px] p-0 flex items-center justify-center rounded-full hover:bg-white/10 border border-white/10 relative transition"
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
                <>
                <motion.div
                  key="notifications-backdrop"
                  className="fixed inset-0 z-[255] bg-black/50 md:bg-black/30"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  onClick={() => setShowNotifications(false)}
                  aria-hidden
                />
                <motion.div
                  key="notifications-panel"
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                  className="notifications-panel md:!absolute md:!right-0 md:!top-12 md:!left-auto md:!w-80 md:max-w-[min(20rem,calc(100vw-2rem))] md:glass-strong md:rounded-2xl md:border md:border-white/10 md:shadow-2xl z-[260] overflow-hidden bg-[#111114]"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="notifications-panel__header px-4 py-3 border-b border-white/10 flex items-center justify-between bg-[#0a0a0f]">
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
                      <button
                        type="button"
                        onClick={() => setShowNotifications(false)}
                        className="text-xs font-semibold px-2.5 py-1 rounded-lg text-[#a1a1aa] hover:text-white hover:bg-white/10 transition shrink-0"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                  <div className="notifications-panel__list max-h-[320px] overflow-auto p-1 text-sm">
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
                  <div className="notifications-panel__footer p-2 border-t border-white/10 bg-[#0a0a0f] text-[10px] text-center text-[#71717a]">
                    Timely • Non-intrusive • Powered by activity logs
                  </div>
                </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>

          {showWorkspaceChat && (
            <button
              type="button"
              onClick={toggleChat}
              className={cn(
                "relative hidden md:flex items-center justify-center h-11 w-11 min-h-[44px] min-w-[44px] rounded-xl border transition",
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
          )}

          {/* Polished Auth + User Area (Phase 1 UX track) */}
          <div ref={profilePopoverRef} className="relative">
          {isAuthLoading ? (
            <div className="flex items-center gap-2 rounded-full bg-white/5 border border-white/10 px-3 py-1.5 text-xs text-[#71717a]">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-[#c084fc]" />
              <span className="hidden md:inline">AuthenticatingΓÇª</span>
            </div>
          ) : user ? (
            <>
            <div className="flex items-center gap-1.5">
              {/* User avatar + identity pill — clickable to edit profile (name, username, location) */}
              <div
                onClick={() => {
                  setShowWorkspaceMenu(false);
                  setShowNotifications(false);
                  setShowProfilePopover((open) => !open);
                }}
                className={cn(
                  "group flex items-center justify-center min-h-[44px] min-w-[44px] cursor-pointer active:scale-[0.985] transition-all",
                  "p-0 rounded-full max-md:bg-transparent max-md:border-0",
                  "md:bg-white/5 md:border md:p-1",
                  showProfilePopover
                    ? "md:border-[#c084fc]/40 md:bg-[#c084fc]/10 max-md:ring-2 max-md:ring-[#c084fc]/40"
                    : "md:border-white/10 md:hover:border-[#c084fc]/40"
                )}
                title="Click to edit your profile (name, username, location)"
                role="button"
                tabIndex={0}
                aria-expanded={showProfilePopover}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setShowWorkspaceMenu(false);
                    setShowNotifications(false);
                    setShowProfilePopover((open) => !open);
                  }
                  if (e.key === "Escape") setShowProfilePopover(false);
                }}
              >
                <div className="h-9 w-9 flex-shrink-0 rounded-full bg-gradient-to-br from-[#c084fc] to-[#a855f7] flex items-center justify-center text-xs font-bold text-black ring-1 ring-inset ring-white/30 shadow-sm">
                  {avatarInitials || <User className="h-4 w-4" />}
                </div>
              </div>
            </div>

            <AnimatePresence>
              {showProfilePopover && user && (
                <motion.div
                  initial={{ opacity: 0, y: -6, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.98 }}
                  transition={{ duration: 0.15, ease: "easeOut" }}
                  className="absolute right-0 top-full mt-2 z-[260] w-[min(20rem,calc(100vw-1.5rem))] top-bar-menu-panel glass rounded-2xl border border-white/10 shadow-2xl overflow-hidden"
                  role="dialog"
                  aria-label="Your profile"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between gap-2">
                    <h2 className="font-semibold text-sm tracking-tight text-[#f4f4f5]">Your profile</h2>
                    <button
                      type="button"
                      onClick={() => setShowProfilePopover(false)}
                      className="shrink-0 p-1.5 rounded-lg text-[#71717a] hover:text-white hover:bg-white/10 transition"
                      aria-label="Close profile editor"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  {(() => {
                    const selfMember = members.find((m) => m.userId === user.id);
                    const nameVal = profileFullName || selfMember?.fullName || myProfile?.fullName || "";
                    const userVal = profileUsername || selfMember?.username || myProfile?.username || "";
                    const locVal = profileLocation || selfMember?.location || myProfile?.location || "";
                    const profileDisabled =
                      isSavingProfile || !isLiveWorkspace || ["w1", "w2"].includes(currentWorkspace.id);

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
                      <div className="p-4 text-sm space-y-4">
                        <div className="space-y-3">
                          <div>
                            <label className="block text-[10px] uppercase tracking-widest text-[#71717a] mb-1.5">
                              Signed in as
                            </label>
                            <p
                              className="px-3 py-2.5 text-sm rounded-xl min-h-[44px] bg-white/5 border border-white/10 text-[#e4e4e7] truncate"
                              title={user.email ?? undefined}
                            >
                              {user.email || "No email on this account"}
                            </p>
                          </div>
                          <div>
                            <label className="block text-[10px] uppercase tracking-widest text-[#71717a] mb-1.5">
                              Full name
                            </label>
                            <input
                              type="text"
                              value={nameVal}
                              onChange={(e) => setProfileFullName(e.target.value)}
                              placeholder="Alex Rivera"
                              className="input w-full px-3 py-2.5 text-sm rounded-xl min-h-[44px]"
                              disabled={profileDisabled}
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] uppercase tracking-widest text-[#71717a] mb-1.5">
                              Username / handle
                            </label>
                            <div className="flex items-center gap-1">
                              <span className="text-[#a1a1aa] px-2">@</span>
                              <input
                                type="text"
                                value={userVal}
                                onChange={(e) =>
                                  setProfileUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))
                                }
                                placeholder="alexr"
                                className="input flex-1 px-3 py-2.5 text-sm rounded-xl font-mono min-h-[44px]"
                                disabled={profileDisabled}
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block text-[10px] uppercase tracking-widest text-[#71717a] mb-1.5">
                              Where you&apos;re from
                            </label>
                            <input
                              type="text"
                              value={locVal}
                              onChange={(e) => setProfileLocation(e.target.value)}
                              placeholder="San Francisco, CA or Remote"
                              className="input w-full px-3 py-2.5 text-sm rounded-xl min-h-[44px]"
                              disabled={profileDisabled}
                            />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setShowProfilePopover(false)}
                            className="btn btn-ghost flex-1 min-h-[44px]"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={save}
                            disabled={profileDisabled}
                            className="btn btn-primary flex-1 min-h-[44px] disabled:opacity-50"
                          >
                            {isSavingProfile ? "Saving..." : "Save"}
                          </button>
                        </div>
                        {!isLiveWorkspace && (
                          <p className="text-[10px] text-[#c084fc] text-center">Live connection required to save</p>
                        )}
                        {isSiteAdmin && (
                          <div className="border-t border-white/10 pt-3 md:hidden">
                            <button
                              type="button"
                              onClick={() => {
                                setShowProfilePopover(false);
                                setView("admin");
                              }}
                              className={cn(
                                "w-full min-h-[44px] flex items-center justify-center gap-2 rounded-lg transition font-medium",
                                currentView === "admin"
                                  ? "text-[#c084fc] bg-[#c084fc]/10"
                                  : "text-[#e4e4e7] hover:bg-white/5",
                              )}
                            >
                              <Shield className="h-4 w-4 text-[#c084fc]" />
                              Admin
                            </button>
                          </div>
                        )}
                        <div className="border-t border-white/10 pt-3">
                          <button
                            type="button"
                            onClick={() => {
                              setShowProfilePopover(false);
                              setPendingSignOut(true);
                            }}
                            className="w-full min-h-[44px] flex items-center justify-center gap-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition font-medium"
                          >
                            <LogOut className="h-4 w-4 text-red-400" />
                            Log out
                          </button>
                        </div>
                      </div>
                    );
                  })()}
                </motion.div>
              )}
            </AnimatePresence>
            </>
          ) : (
            <>
              <button
                onClick={() => setShowAuthModal(true)}
                className="btn btn-secondary text-xs px-4 py-2 hidden md:flex items-center gap-1.5 min-h-[44px]"
              >
                <User className="h-3.5 w-3.5" /> Sign in
              </button>
              <button
                onClick={() => setShowAuthModal(true)}
                className="md:hidden min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border border-white/10 text-[#a1a1aa] hover:text-white hover:border-[#c084fc]/40 transition"
                aria-label="Sign in"
              >
                <User className="h-4 w-4" />
              </button>
            </>
          )}

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
              className="btn btn-secondary text-xs px-3 py-1.5 hidden md:flex items-center gap-1.5 active:scale-95"
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
                "sync-indicator top-bar-sync-mobile text-[10px] px-2.5 py-1 active:scale-95 max-md:hidden md:hidden",
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
              className={cn(
                "sidebar-item sidebar-item--home",
                currentView === "home" && "active",
              )}
            >
              <span className="sidebar-item--home__icon" aria-hidden="true">
                <Home className="h-4 w-4" />
              </span>
              Home
            </div>
          </div>

          <SidebarWorkspaceIndicator
            workspace={currentWorkspace}
            showRole={!isSingleOwnerWorkspace}
            canManage={canManage}
          />

          <div className="space-y-0.5 px-1">
            {VIEWS.filter(v => v.id !== "home").map((v) => {
              const navMeta =
                v.id === "settings"
                  ? { label: "Settings", Icon: Settings }
                  : { label: v.label, Icon: v.icon };
              const Icon = navMeta.Icon;
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
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="flex-1 min-w-0 truncate">{navMeta.label}</span>
                  {v.id === "tasks" && (
                    <TasksNavIndicator
                      openCount={currentWorkspaceTaskCounts.openCount}
                      overdueCount={currentWorkspaceTaskCounts.overdueCount}
                      variant="sidebar"
                    />
                  )}
                </div>
              );
            })}
          </div>

          {isSiteAdmin && user && (
            <div className="px-1 mt-4 pt-4 border-t border-white/10">
              <div
                role="button"
                tabIndex={0}
                aria-current={currentView === "admin" ? "page" : undefined}
                onClick={() => setView("admin")}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setView("admin");
                  }
                }}
                className={cn(
                  "sidebar-item border border-transparent",
                  currentView === "admin" && "active border-[#c084fc]/30 bg-[#c084fc]/10"
                )}
              >
                <Shield className="h-4 w-4 text-[#c084fc]" />
                Admin
              </div>
            </div>
          )}

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
            <div
              data-landing-capture-hide
              className="mb-6 rounded-2xl bg-[#111114] border border-[#c084fc]/20 px-5 py-3 text-sm flex items-center gap-3"
            >
              <div className="text-[#c084fc]">⚠</div>
              <div className="flex-1 text-[#a1a1aa]">
                Demo mode — all data lives in your browser for now.
              </div>
              <button onClick={() => window.open("docs/MILESTONE-1-SUPABASE-ACTIVATION.md", "_blank")} className="text-xs underline text-[#c084fc] whitespace-nowrap">Connect Supabase</button>
            </div>
          )}

          {currentViewComponent()}
        </main>

        {showWorkspaceChat && (
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
        )}
      </div>

      {/* Mobile Bottom Navigation — native iOS/Android style, only <md via CSS + md:hidden
          Reuses existing VIEWS + setView from store. No desktop impact. Touch-optimized via globals.css
      */}
      <nav className="bottom-nav md:hidden border-t border-white/10" aria-label="Primary navigation">
        <WorkspaceSwitchEffects
          workspaceId={currentWorkspace.id}
          variant="bottom-nav"
        />
        {VIEWS.map((v, navIndex) => {
          const navMeta =
            v.id === "settings"
              ? { label: "Settings", Icon: Settings }
              : { label: v.label, Icon: v.icon };
          const Icon = navMeta.Icon;
          const isActive = currentView === v.id;
          const label = navMeta.label;
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
              className={cn(
                "bottom-nav-item relative z-[1]",
                v.id === "home" && "bottom-nav-item--home",
                isActive && "active",
              )}
            >
              <AnimatedBottomNavItemContent
                workspaceId={currentWorkspace.id}
                itemId={v.id}
                index={navIndex}
              >
                <span className="bottom-nav-item__icon-wrap">
                  <Icon className="icon" />
                  {v.id === "tasks" && (
                    <TasksNavIndicator
                      openCount={currentWorkspaceTaskCounts.openCount}
                      overdueCount={currentWorkspaceTaskCounts.overdueCount}
                      variant="bottom"
                    />
                  )}
                </span>
                <span className="font-medium tracking-tight">{label}</span>
              </AnimatedBottomNavItemContent>
            </div>
          );
        })}
      </nav>

      {showWorkspaceChat && (
        <ChatDrawer
          open={chatOpen}
          onClose={() => setChatOpen(false)}
          chat={workspaceChat}
          workspaceId={currentWorkspace.id}
          workspaceName={currentWorkspace.name}
          userId={user?.id}
          members={members}
        />
      )}

      {/* Command Palette */}
      <CommandPalette 
        open={isCommandPaletteOpen} 
        onOpenChange={(o) => toggleCommandPalette(o)} 
      />

      {/* Confetti on completions */}
      <Confetti trigger={celebrationTrigger} />

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
          onClose={closeTaskModal}
          workspaceDeepLink={
            homeTaskModalContext && homeTaskModalContext.taskId === selectedTask.id
              ? {
                  workspaceName: homeTaskModalContext.workspaceName,
                  onNavigate: () =>
                    navigateToTaskInWorkspace(
                      homeTaskModalContext.workspaceId,
                      homeTaskModalContext.taskId,
                    ),
                }
              : undefined
          }
        />
      )}

      <HomeListModal
        target={homeListModal}
        isOpen={!!homeListModal}
        onClose={() => {
          refreshHomeListAggregatesFromStore();
          setHomeListModal(null);
        }}
        onItemsChanged={() => refreshHomeListAggregatesFromStore()}
        onOpenInWorkspace={
          homeListModal
            ? () =>
                navigateToListInWorkspace(homeListModal.workspaceId, homeListModal.listId)
            : undefined
        }
      />

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
                  { key: "1", desc: "Go to All Tasks view" },
                  { key: "2", desc: "Go to Notes view" },
                  { key: "3", desc: "Go to Lists view" },
                  { key: "4", desc: "Go to Team" },
                  { key: "5", desc: "Go to Workspace Settings" },
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
        onOpenNote={setSelectedNoteId}
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

      <ConfirmationModal
        open={pendingSignOut}
        onOpenChange={setPendingSignOut}
        title="Sign out?"
        description="You will return to the landing page. Your data stays saved in your account for next time you sign in."
        confirmText="Sign out"
        variant="destructive"
        isLoading={isSigningOut}
        onConfirm={signOut}
      />

    </div>
  );
}

