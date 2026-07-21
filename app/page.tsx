"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Plus,
  Command,
  Users,
  Settings,
  ChevronDown,
  Clock,
  Star,
  ListChecks,
  Shield,
  Loader2,
  User,
  LogOut,
  X,
  Bell,
  Home,
  MessageCircle,
  Zap,
  Repeat,
  FolderOpen,
  Notebook,
  Trash2,
  Search,
  Download,
  KeyRound,
  Lock,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

import { useTaskStore } from "@/store/useTaskStore";
import { Task, Notification } from "@/types";
import { cn, triggerHaptic, getUserGreetingName, getNameInitials } from "@/lib/utils";
import {
  buildTaskCompletionUndoContext,
  showTaskCompletionFeedback,
} from "@/features/tasks/lib/taskCompletionFeedback";
import {
  showListItemCompletionFeedback,
  showListItemPendingFeedback,
} from "@/features/lists/lib/listItemCompletionFeedback";
import { apiFetch, registerDualAuthRequiredHandler } from "@/lib/api/apiFetch";
import { useIsMobileViewport } from "@/lib/hooks/useIsMobileViewport";
import { usePullToRefresh } from "@/lib/hooks/usePullToRefresh";
import { isStandalonePwa } from "@/lib/pwa/isStandalonePwa";
import { useScrollLock } from "@/lib/hooks/useScrollLock";
import { isDueDatePast } from "@/lib/datetime";
import { formatRoleLabel, type WorkspaceRole } from "@/lib/roles";

import { CommandPalette } from "@/components/CommandPalette";
import { ConfirmationModal } from "@/components/ConfirmationModal";
import { Confetti } from "@/components/Confetti";
import { SupabaseSetupBanner } from "@/components/SupabaseSetupBanner";
import {
  applyDualAuthBootstrap,
  consumeDualAuthBootstrap,
  fetchDualAuthStatus,
} from "@/lib/auth/dualAuthClient";
import { isSupabaseConfigured } from "@/lib/supabase/client";

import { CreateWorkspaceGate } from "@/components/CreateWorkspaceGate";
import { DualAuthGate } from "@/components/DualAuthGate";
import { LandingPage } from "@/components/LandingPage";
import { TaskModal } from "@/components/TaskModal";
import { BrandLogo } from "@/components/BrandLogo";
import { ChangePasswordModal } from "@/components/ChangePasswordModal";
import { ListShareAcceptModal } from "@/components/ListShareAcceptModal";
import { LoginActivityModal } from "@/components/LoginActivityModal";
import { isValidListShareId } from "@/lib/list-share/getListSharePreview";
import { FilesView } from "@/features/files";
import { NotebooksView } from "@/features/notebooks";
import { MeetingsView } from "@/features/meetings";
import { HealthView } from "@/features/health";
import { getBottomNavViews } from "@/lib/nav/workspaceViews";
import {
  CaptureFileModal,
  type CaptureFileInput,
  type CaptureFileSubmitMode,
} from "@/features/files/components/CaptureFileModal";
import { collectWorkspaceTags, hasUserFilingTags, isFiledNote } from "@/lib/files/fileFilters";
import "@/features/files/files-workspace.css";
import { useNoteOperations } from "@/features/notes/hooks";
import { useNoteKeyboard } from "@/features/notes/hooks";
import { hasOpenOverlay } from "@/lib/dom/hasOpenOverlay";
import { HomeView, getGreeting } from "@/features/home";
import { ListDetailModal } from "@/features/lists/components/ListDetailModal";
import { getIncompleteSubtreeItems } from "@/lib/lists/listItemTree";
import { CollapsibleSidebar } from "@/components/CollapsibleSidebar";
import {
  AnimatedBottomNavItemContent,
  AnimatedWorkspaceName,
  WorkspaceSwitchEffects,
} from "@/components/WorkspaceSwitchEffects";
import { WorkspaceViewHeader } from "@/components/WorkspaceViewHeader";
import { ThemeToggleSegmented } from "@/components/ThemeToggle";
import { TasksNavIndicator } from "@/components/TasksNavIndicator";
import { FilesNavIndicator } from "@/components/FilesNavIndicator";
import { filterPendingReview, sortFiledNotes } from "@/lib/files/fileFilters";
import {
  getWorkspaceNavTaskCounts,
  getWorkspacePendingReviewCount,
} from "@/lib/nav/workspaceNavCounts";
import { getSearchResultDisplayName, isSharedWorkspace } from "@/lib/assignee";
import { ListsView } from "@/features/lists";
import { SiteAdminView } from "@/features/admin";
import "@/features/lists/lists-workspace.css";
import type { HomeFocusItem } from "@/features/home/lib/buildAttentionItems";
import {
  countWorkspaceBadgeUnread,
  getBellPanelNotifications,
  getPendingInviteNotifications,
  getPendingListShareNotifications,
  isBellUnread,
} from "@/lib/notifications/notificationSelectors";
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
import {
  type TasksStatusFilterMode,
} from "@/features/tasks/components/TasksStatusFilter";
import {
  type TasksRecurrenceFilterMode,
} from "@/features/tasks/components/TasksRecurrenceFilter";
import { TasksOrganizeBar } from "@/features/tasks/components/TasksOrganizeBar";
import { TasksMobileOrganizeDisclosure } from "@/features/tasks/components/TasksMobileOrganizeDisclosure";
import {
  findWorkspaceByRef,
  getPreferredWorkspaceRefFromUrl,
  workspaceUrlRef,
} from "@/lib/workspacePersistence";
import "@/features/tasks/tasks-workspace.css";
import "@/features/teams/teams-workspace.css";

function workspaceAccessLabel(
  workspaceId: string,
  role: string | undefined,
  statsMemberCount: number | undefined,
  currentWorkspaceId: string,
  currentMembersCount: number
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
    isInitializing,
    isSiteAdmin,
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
    completeTask,
    undoTaskCompletion,
    taskLoadingStates,
    getFilteredTasks,
    getTaskFolders,
    addTaskFolder,
    updateTaskFolder,
    deleteTaskFolder,
    switchWorkspace,
    addNote,
    updateNote,
    deleteNote,
    getWorkspaceLists,
    getArchivedWorkspaceLists,
    getListItemsForList,
    addList,
    updateList,
    deleteList,
    nudgeList,
    toggleListPinned,
    addListItem,
    toggleListItem,
    completeListItemFamily,
    updateListItem,
    deleteListItem,
    nudgeListItem,
    moveListItemToList,
    indentListItem,
    outdentListItem,
    clearCompletedListItems,
    setListItemPending,
    restorePendingListItems,
    clearPendingListItems,
    createWorkspace,
    // C4 Phase A Home globals (separate slices)
    globalTodayFocus,
    globalOpenTaskFocus,
    globalWorkspaceStats,
    globalListHighlights,
    fetchGlobalHomeAggregates,
    refreshHomeListAggregatesFromStore,
    refreshHomeNoteAggregatesFromStore,
    clearWorkspaceUnreadChat,
    setWorkspaceUnreadChat,
    refreshHomeTaskFocusFromStore,
    hydrateWorkspaceListData,
    // Offline / sync (Agent 17 mobile polish — exposed from hybrid + store)
    isOnline,
    isSyncing,
    pendingSyncCount,
    syncPendingWrites,
    refreshOfflineStatus,
    // Phase 2 collab
    members,
    invites,
    onlineUsers,
    isLoadingMembers,
    fetchInvites,
    sendInvite,
    acceptInviteLink,
    changeMemberRole,
    removeWorkspaceMember,
    revokeInvite,
    resendInvite,
    declineReceivedInvite,
    declineReceivedListShare,
    acceptReceivedListShare,
    loadListShareWorkspaces,
    updateMyProfile, // self name + location profile editing
    searchPotentialTeammates, // new backend search for name/username/city in empty owner invite state
    myProfile,
    // Agent 31 notifications
    notifications,
    unreadNotifCount,
    bellUnreadOverflow,
    isLoadingNotifications,
    fetchNotifications,
    markNotifRead,
    markAllNotifsRead,
    deleteNotification,
    clearAllNotifications,
    exitWorkspace,
    filesOpenReview,
    setFilesOpenReview,
    filesOpenReviewNoteId,
    setFilesOpenReviewNoteId,
    filesSelectNoteId,
    setFilesSelectNoteId,
    filesCaptureOpen,
    setFilesCaptureOpen,
    getNotebooks,
    getArchivedNotebooks,
    getNotebookNotes,
    getNotebookTasks,
    getNotebookInvestments,
    getNotebookCustomers,
    getNotebookCompetitors,
    getMeetings,
    getArchivedMeetings,
    getMeetingAgendaItems,
    selectedNotebookId,
    selectedNotebookNoteId,
    selectedNotebookTaskId,
    selectedNotebookInvestmentId,
    selectedNotebookCustomerId,
    selectedNotebookCompetitorId,
    selectedMeetingId,
    selectedAgendaItemId,
    setSelectedNotebookId,
    setSelectedNotebookNoteId,
    setSelectedNotebookTaskId,
    setSelectedNotebookInvestmentId,
    setSelectedNotebookCustomerId,
    setSelectedNotebookCompetitorId,
    setSelectedMeetingId,
    setSelectedAgendaItemId,
    addNotebook,
    updateNotebook,
    deleteNotebook,
    addNotebookTask,
    toggleNotebookTask,
    updateNotebookTask,
    setNotebookTaskShowOnWorkspace,
    deleteNotebookTask,
    addNotebookTaskProgress,
    updateNotebookTaskProgress,
    deleteNotebookTaskProgress,
    addNotebookInvestment,
    toggleNotebookInvestment,
    updateNotebookInvestment,
    reorderNotebookInvestments,
    deleteNotebookInvestment,
    addNotebookInvestmentNote,
    updateNotebookInvestmentNote,
    deleteNotebookInvestmentNote,
    addNotebookCustomer,
    updateNotebookCustomer,
    deleteNotebookCustomer,
    addNotebookCustomerNote,
    updateNotebookCustomerNote,
    deleteNotebookCustomerNote,
    addNotebookCompetitor,
    updateNotebookCompetitor,
    deleteNotebookCompetitor,
    addNotebookCompetitorNote,
    updateNotebookCompetitorNote,
    deleteNotebookCompetitorNote,
    setNotebookOurSales,
    hydrateNoteDetail,
    addMeeting,
    updateMeeting,
    deleteMeeting,
    addAgendaItem,
    updateAgendaItem,
    reorderAgendaItems,
    addAgendaEntry,
    updateAgendaEntry,
    deleteAgendaEntry,
    completeAgendaItem,
    continueAgendaItem,
    unreviewAgendaItem,
    reopenAgendaItem,
    deleteAgendaItem,
    completeMeeting,
    reopenMeeting,
    startNextMeeting,
    duplicateMeeting,
    meetingAgendaItems,
    meetingAgendaEntries,
    notebookTaskProgress,
    notebookInvestmentNotes,
    notebookCustomerNotes,
    notebookCompetitors,
    notebookCompetitorNotes,
    notebookTasks,
    notebooks,
    healthProfiles,
    selectedHealthMemberId,
    healthSectionTab,
    getHealthReadings,
    setSelectedHealthMemberId,
    setHealthSectionTab,
    addHealthReading,
    deleteHealthReading,
    upsertHealthProfile,
  } = useTaskStore();

  const bottomNavViews = useMemo(() => getBottomNavViews(currentWorkspace), [currentWorkspace]);

  // Derive pending *received* workspace invites for the current user from the centralized notifications store.
  // This replaces the previous fragile direct-query + undefined-supabase pattern. Since fetchNotifications
  // now pulls ALL notifs for the user (cross-ws) and auto-runs on login/ws init, the banner + bell
  // will correctly surface specific "X invited you to Y" data as soon as the sender creates the invite
  // (once the notifications INSERT RLS policy allows pre-membership targets).
  const pendingReceivedInvites = useMemo(
    () => getPendingInviteNotifications(notifications || []),
    [notifications]
  );

  const pendingReceivedListShares = useMemo(
    () => getPendingListShareNotifications(notifications || []),
    [notifications]
  );

  // Role/permission flags — hoisted early so they are available before any useEffect
  // or logic that depends on them. (The old `isEmptyOwnerState` identifier has been fully
  // inlined to eliminate all TDZ risk.)
  const myRole = currentWorkspace.role;
  const isWorkspaceOwner = myRole === "owner";
  const canManage = ["owner", "admin"].includes(myRole);
  const isLiveWorkspace = isSupabaseConfigured() && !["w1", "w2"].includes(currentWorkspace.id);
  const isDemoWs = ["w1", "w2"].includes(currentWorkspace.id);
  const isSingleOwnerWorkspace =
    myRole === "owner" && members.length <= 1 && isLiveWorkspace && !isDemoWs;
  const showWorkspaceChat = isSharedWorkspace(members);

  const [chatOpen, setChatOpen] = useState(false);
  const [isLiveBootstrapping, setIsLiveBootstrapping] = useState(false);
  const [liveBootstrapFinished, setLiveBootstrapFinished] = useState(false);

  const workspaceChat = useWorkspaceChat({
    workspaceId: currentWorkspace.id,
    userId: user?.id,
    members,
    isOpen: chatOpen,
  });
  const markChatReadRef = useRef(workspaceChat.markRead);
  markChatReadRef.current = workspaceChat.markRead;
  const chatOpenRef = useRef(chatOpen);
  chatOpenRef.current = chatOpen;

  const closeChat = useCallback(() => {
    markChatReadRef.current();
    clearWorkspaceUnreadChat(currentWorkspace.id);
    setChatOpen(false);
  }, [clearWorkspaceUnreadChat, currentWorkspace.id]);

  const toggleChat = () => {
    triggerHaptic("light");
    if (chatOpen) {
      closeChat();
      return;
    }
    setShowNotifications(false);
    setShowProfilePopover(false);
    setChatOpen(true);
  };

  // Messages panel collapsed by default; close when switching workspace or chat unavailable.
  useEffect(() => {
    if (chatOpenRef.current) {
      markChatReadRef.current();
      clearWorkspaceUnreadChat(currentWorkspace.id);
    }
    setChatOpen(false);
  }, [currentWorkspace.id, showWorkspaceChat, clearWorkspaceUnreadChat]);

  const [showWorkspaceMenu, setShowWorkspaceMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfilePopover, setShowProfilePopover] = useState(false);
  const [showLoginActivity, setShowLoginActivity] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const isMobileViewport = useIsMobileViewport();
  useScrollLock((showNotifications || showProfilePopover) && isMobileViewport);
  const [showFullTaskModal, setShowFullTaskModal] = useState(false);
  const [modalTask, setModalTask] = useState<Task | null>(null);
  const [listDetailTarget, setListDetailTarget] = useState<{
    listId: string;
    workspaceId: string;
    discardIfEmpty?: boolean;
  } | null>(null);
  const workspaceLists = useTaskStore((s) => s.workspaceLists);
  const listItems = useTaskStore((s) => s.listItems);
  const [homeTaskModalContext, setHomeTaskModalContext] = useState<{
    workspaceId: string;
    workspaceName: string;
    taskId: string;
  } | null>(null);
  const [pendingWorkspaceNav, setPendingWorkspaceNav] = useState<
    | { kind: "task"; workspaceId: string; taskId: string }
    | { kind: "list"; workspaceId: string; listId: string }
    | { kind: "review"; workspaceId: string }
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
  const [pendingListShareAcceptId, setPendingListShareAcceptId] = useState<string | null>(null);
  // Workspace creation UI state (inline in switcher dropdown — production real DB)
  const [isCreatingWorkspace, setIsCreatingWorkspace] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [isCreatingLoading, setIsCreatingLoading] = useState(false);
  const router = useRouter();
  const [dualAuthChecked, setDualAuthChecked] = useState(false);
  const [dualAuthRequired, setDualAuthRequired] = useState(false);
  const [dualAuthVerified, setDualAuthVerified] = useState(false);
  const [dualAuthEmail, setDualAuthEmail] = useState("");

  // Modern confirmation modals state
  const [pendingDeleteNote, setPendingDeleteNote] = useState<string | null>(null);
  const [pendingRemoveMember, setPendingRemoveMember] = useState<{
    userId: string;
    label: string;
  } | null>(null);
  const [pendingRevokeInvite, setPendingRevokeInvite] = useState<{
    inviteId: string;
    label: string;
  } | null>(null);
  const [pendingResendInvite, setPendingResendInvite] = useState<{
    inviteId: string;
    label: string;
  } | null>(null);
  const [pendingLeaveWorkspace, setPendingLeaveWorkspace] = useState(false);
  const [pendingClearNotifications, setPendingClearNotifications] = useState(false);
  const [pendingSignOut, setPendingSignOut] = useState(false);

  const pendingDeleteNoteRecord = pendingDeleteNote
    ? notes.find((n) => n.id === pendingDeleteNote)
    : null;
  const pendingDeleteIsFile = pendingDeleteNoteRecord
    ? isFiledNote(pendingDeleteNoteRecord)
    : false;
  const pendingDeleteNoteTitle =
    pendingDeleteNoteRecord?.title || (pendingDeleteIsFile ? "Untitled file" : "Untitled Note");

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

  const handleDismissNotification = async (id: string) => {
    const notif = notifications.find((n) => n.id === id);
    if (notif?.type === "invite") {
      toast.info("Use Accept or Decline on the invitation banner to respond.");
      return;
    }
    if (notif?.type === "list_share") {
      toast.info("Use Accept or Decline on the shared list banner to respond.");
      return;
    }
    await deleteNotification?.(id);
    if (selectedNotification?.id === id) {
      setSelectedNotification(null);
    }
  };

  const bellPanelNotifications = useMemo(
    () => getBellPanelNotifications(notifications || [], 20),
    [notifications]
  );

  const handleConfirmClearNotifications = async () => {
    await clearAllNotifications?.();
    setPendingClearNotifications(false);
    setSelectedNotification(null);
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
        !isMobileViewport &&
        profilePopoverRef.current &&
        !profilePopoverRef.current.contains(event.target as Node)
      ) {
        setShowProfilePopover(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showProfilePopover, showWorkspaceMenu, showNotifications, isMobileViewport]);

  // Shrink workspace name on phones only when it overflows — skip until layout has width
  const fitWorkspaceName = React.useCallback((): boolean => {
    const el = workspaceNameRef.current;
    if (!el) return true;
    const isMobile = window.matchMedia("(max-width: 767px)").matches;
    if (!isMobile) {
      el.style.fontSize = "";
      return true;
    }
    if (el.clientWidth < 8) return false;

    const maxSize = 22;
    const minSize = 16;
    let size = maxSize;
    el.style.fontSize = `${size}px`;
    while (el.scrollWidth > el.clientWidth && size > minSize) {
      size -= 0.5;
      el.style.fontSize = `${size}px`;
    }
    return true;
  }, []);

  const scheduleFitWorkspaceName = React.useCallback(() => {
    let attempts = 0;
    const tick = () => {
      if (fitWorkspaceName()) return;
      if (attempts < 24) {
        attempts += 1;
        requestAnimationFrame(tick);
      }
    };
    tick();
  }, [fitWorkspaceName]);

  React.useLayoutEffect(() => {
    scheduleFitWorkspaceName();
    const t = window.setTimeout(scheduleFitWorkspaceName, 400);

    const el = workspaceNameRef.current;
    const parent = el?.parentElement;
    const ro =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => scheduleFitWorkspaceName())
        : null;
    if (el) ro?.observe(el);
    if (parent) ro?.observe(parent);

    window.addEventListener("resize", scheduleFitWorkspaceName);
    return () => {
      window.clearTimeout(t);
      ro?.disconnect();
      window.removeEventListener("resize", scheduleFitWorkspaceName);
    };
  }, [scheduleFitWorkspaceName, currentWorkspace.id, currentWorkspace.name, showWorkspaceMenu]);

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

  const selectedNoteId = useTaskStore((s) => s.selectedNoteId);
  const setSelectedNoteId = useTaskStore((s) => s.setSelectedNoteId);

  // Extracted note keyboard (M2 extraction - reduces monolith)
  useNoteKeyboard({
    selectedNoteId,
    setSelectedNoteId,
    isTyping: false, // simplified; in full extraction would use stable isInputActive
  });

  useEffect(() => {
    if (!filesSelectNoteId) return;
    setSelectedNoteId(filesSelectNoteId);
    setFilesSelectNoteId(null);
  }, [filesSelectNoteId, setFilesSelectNoteId]);

  // Client-only state for the mobile sync indicator to prevent hydration mismatch.
  // These values can differ between server render and client (navigator.onLine + queue rehydration).
  const [syncDisplay, setSyncDisplay] = useState({
    isOnline: true,
    isSyncing: false,
    pendingSyncCount: 0,
  });

  useEffect(() => {
    setSyncDisplay({ isOnline, isSyncing, pendingSyncCount });
  }, [isOnline, isSyncing, pendingSyncCount]);

  const listDetailOpenRef = useRef(false);
  const [pwaStandalone, setPwaStandalone] = useState(false);

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
    const isEmpty = myRole === "owner" && members.length <= 1 && isLiveWorkspace && !isDemoWs;
    if (!isEmpty) {
      hasFetchedInvitesForEmptyState.current = false;
    }
  }, [myRole, members, isLiveWorkspace, isDemoWs]);

  // One-time fetch of pending *sent* invites when entering the special empty-owner invite view.
  useEffect(() => {
    const isEmpty = myRole === "owner" && members.length <= 1 && isLiveWorkspace && !isDemoWs;
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
    [getFilteredTasks, tasks, notebookTasks, notebooks, taskFilter, currentWorkspace.id]
  );

  const currentWorkspaceTaskCounts = useMemo(
    () =>
      getWorkspaceNavTaskCounts({
        workspaceId: currentWorkspace.id,
        tasks,
        globalTodayFocus,
        globalOpenTaskFocus,
        globalWorkspaceStats,
        preferLocalTasks: !isInitializing && !isAuthLoading,
      }),
    [
      tasks,
      globalTodayFocus,
      globalOpenTaskFocus,
      currentWorkspace.id,
      globalWorkspaceStats,
      isInitializing,
      isAuthLoading,
    ]
  );

  const pendingReviewCount = useMemo(
    () => getWorkspacePendingReviewCount(notes, currentWorkspace.id),
    [notes, currentWorkspace.id]
  );

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
    // Drain durable outbox before authoritative hydrate so check-offs aren't wiped.
    await store.syncPendingWrites().catch(() => undefined);
    await store.initializeFromSupabase();
    await Promise.all([store.fetchSiteAdminStatus(), store.fetchMyProfile()]);
    if (user?.id && isSupabaseConfigured()) {
      (
        store as { _setupUserNotificationsRealtime?: (id: string) => void }
      )._setupUserNotificationsRealtime?.(user.id);
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

    const bootstrap = consumeDualAuthBootstrap();
    if (bootstrap) {
      const status = applyDualAuthBootstrap(bootstrap);
      setDualAuthRequired(!!status.required);
      setDualAuthVerified(!!status.verified);
      setDualAuthEmail(status.email || user.email || "your email");
      setDualAuthChecked(true);
      return;
    }

    let cancelled = false;
    void (async () => {
      const maxAttempts = 8;
      let deferChecked = false;
      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        if (cancelled) return;
        try {
          const payload = await fetchDualAuthStatus();
          const unauthorized = payload.error === "Unauthorized";

          if (unauthorized && attempt < maxAttempts - 1) {
            await new Promise((resolve) => setTimeout(resolve, 300 * (attempt + 1)));
            continue;
          }

          if (cancelled) return;

          if (unauthorized || payload.error) {
            // Keep session gate up and never pretend dual-auth passed on a status error.
            // Optimistic "verified" triggered protected API calls that amplified cookie drops.
            setDualAuthRequired(false);
            setDualAuthVerified(false);
            setDualAuthEmail(user.email || "your email");
            deferChecked = true;

            window.setTimeout(() => {
              if (cancelled) return;
              void fetchDualAuthStatus().then((retry) => {
                if (cancelled) return;
                if (retry.error) {
                  // Still unresolved — leave checked so UI can recover (login / retry).
                  setDualAuthRequired(false);
                  setDualAuthVerified(false);
                  setDualAuthChecked(true);
                  return;
                }
                setDualAuthRequired(!!retry.required);
                setDualAuthVerified(!!retry.verified);
                setDualAuthEmail(retry.email || user.email || "your email");
                setDualAuthChecked(true);
              });
            }, 2000);
            break;
          }

          setDualAuthRequired(!!payload.required);
          setDualAuthVerified(!!payload.verified);
          setDualAuthEmail(payload.email || user.email || "your email");
          break;
        } catch {
          if (cancelled) return;
          if (attempt < maxAttempts - 1) {
            await new Promise((resolve) => setTimeout(resolve, 300 * (attempt + 1)));
            continue;
          }
          // Transient network blip (not an auth rejection): allow the app to load.
          // Unauthorized is handled above and must not take this path.
          setDualAuthRequired(false);
          setDualAuthVerified(true);
          setDualAuthEmail(user.email || "your email");
        }
      }

      if (!cancelled && !deferChecked) setDualAuthChecked(true);
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

  // Honor ?workspace=id|slug|name after workspaces load (PWA bookmarks, invite links).
  // Keep the param in the URL so iOS home-screen icons reopen the same workspace.
  const appliedWorkspaceUrlRef = useRef<string | null>(null);
  useEffect(() => {
    if (!user || !liveBootstrapFinished || workspaces.length === 0) return;
    const ref = getPreferredWorkspaceRefFromUrl();
    if (!ref) return;
    if (appliedWorkspaceUrlRef.current === ref) return;

    const match = findWorkspaceByRef(workspaces, ref);
    if (!match) return;

    appliedWorkspaceUrlRef.current = ref;
    if (match.id !== currentWorkspace.id) {
      void switchWorkspace(match.id);
    }
  }, [
    user,
    liveBootstrapFinished,
    workspaces,
    currentWorkspace.id,
    switchWorkspace,
  ]);

  // Legacy ?signin=1 links → bookmarkable /login page
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("signin") !== "1") return;
    const next = params.get("next");
    const target = new URL("/login", window.location.origin);
    if (next && next.startsWith("/") && !next.startsWith("//")) {
      target.searchParams.set("next", next);
    }
    router.replace(`${target.pathname}${target.search}`);
  }, [router]);

  // Deep links for PWA shortcuts + shareable views: ?view=home|tasks|notes|teams
  // Initializes from manifest shortcuts (?view=...&source=pwa). Syncs on change for back/forward + share.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const rawView = params.get("view");
    const urlView =
      rawView === "calendar" || rawView === "today"
        ? "home"
        : rawView === "files"
          ? "notes"
          : rawView;
    const validViews = getBottomNavViews(currentWorkspace).map((v) => v.id);
    if (
      urlView &&
      validViews.includes(urlView as (typeof validViews)[number]) &&
      urlView !== currentView
    ) {
      setView(urlView as typeof currentView);
    }
  }, []); // one-time init on mount

  // Keep URL in sync when view / workspace changes (replaceState — bookmarkable for PWA)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    let changed = false;

    if (url.searchParams.get("view") !== currentView) {
      url.searchParams.set("view", currentView);
      changed = true;
    }

    const realWorkspace =
      !!currentWorkspace.id &&
      currentWorkspace.id !== "" &&
      !["w1", "w2"].includes(currentWorkspace.id) &&
      liveBootstrapFinished;

    if (realWorkspace) {
      const value = workspaceUrlRef(currentWorkspace);
      const existing = url.searchParams.get("workspace");
      if (existing !== value && existing !== currentWorkspace.id) {
        url.searchParams.set("workspace", value);
        appliedWorkspaceUrlRef.current = value;
        changed = true;
      }
    }

    if (changed) {
      window.history.replaceState({}, "", url.toString());
    }
  }, [
    currentView,
    currentWorkspace.id,
    currentWorkspace.slug,
    liveBootstrapFinished,
  ]);

  useEffect(() => {
    listDetailOpenRef.current = !!listDetailTarget;
  }, [listDetailTarget]);

  useEffect(() => {
    setPwaStandalone(isStandalonePwa());
  }, []);

  const handlePullRefresh = useCallback(async () => {
    triggerHaptic("medium");
    const store = useTaskStore.getState();
    try {
      await store.syncPendingWrites?.().catch(() => undefined);
      await store.initializeFromSupabase?.().catch(() => undefined);
      await Promise.all([
        store.fetchNotifications?.(false).catch(() => undefined),
        store.refreshRecentActivity?.().catch(() => undefined),
      ]);
      if (currentView === "home") {
        await store.fetchGlobalHomeAggregates?.().catch(() => undefined);
      }
      toast.success("Refreshed", { description: "Your workspace data is up to date." });
    } catch {
      toast.error("Could not refresh");
    }
  }, [currentView]);

  const canStartPullToRefresh = useCallback(() => {
    if (listDetailOpenRef.current) return false;
    if (filesCaptureOpen) return false;
    if (showFullTaskModal) return false;
    return true;
  }, [filesCaptureOpen, showFullTaskModal]);

  const { pullDistance, isRefreshing: isPullRefreshing } = usePullToRefresh({
    enabled: isMobileViewport && pwaStandalone,
    onRefresh: handlePullRefresh,
    canStartPull: canStartPullToRefresh,
  });

  const isConfigured = isSupabaseConfigured();
  const isTrulyLive = isConfigured && !!user && dualAuthVerified;

  const captureWorkspaceTags = useMemo(() => collectWorkspaceTags(notes || []), [notes]);

  const handleCreateCaptureDraft = useCallback(async () => {
    const emptyDoc = JSON.stringify({ type: "doc", content: [{ type: "paragraph" }] });
    return addNote("Untitled", emptyDoc, {
      tags: [],
      reviewStatus: "pending_review",
    });
  }, [addNote]);

  const handleDeleteCaptureDraft = useCallback(
    async (noteId: string) => {
      await deleteNote(noteId);
    },
    [deleteNote]
  );

  const isMarketingCapture =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("capture") === "1";

  const showSessionGate =
    isConfigured && (isAuthLoading || isSigningOut || (!!user && !dualAuthChecked));
  const showLandingGate = isConfigured && !user && !isSigningOut && !isMarketingCapture;
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
        toast.success("Thanks for installing!", {
          description: "Badazz Tasks is now on your home screen.",
        });
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
    undoContext?: { task: Task; workspaceId: string; workspaceName: string }
  ) => {
    const notebookTask = notebookTasks.find((t) => t.id === id);
    if (notebookTask) {
      const wasCompleted = notebookTask.completed;
      const ok = await toggleNotebookTask(id);
      if (!ok) {
        toast.error("Couldn't save task change", {
          description: "Check your connection and try again.",
        });
        return;
      }
      toast.success(wasCompleted ? "Task reopened" : "Task completed", {
        description: notebookTask.title,
      });
      return;
    }

    triggerHaptic("success");
    const task = resolveTaskById(id);
    if (!task || taskLoadingStates?.[id]) return;

    if (task.status === "done") {
      const reopened = await updateTask(id, { status: "todo", completedAt: undefined });
      refreshHomeTaskFocusFromStore();
      if (reopened === null) return;
      toast.success("Task reopened", { description: task.title });
      return;
    }

    const undoFallback =
      undoContext ??
      buildTaskCompletionUndoContext(
        task,
        workspaces.find((w) => w.id === task.workspaceId)?.name ?? "Workspace"
      );

    const result = await completeTask(id);
    if (result === "advanced") {
      showTaskCompletionFeedback("advanced", task, {
        undoTaskCompletion,
        undoFallback,
        triggerCelebration,
        advancedTask: resolveTaskById(id),
      });
      return;
    }
    if (result === "queued") {
      // Optimistic UI already updated; confirm durable queue, not DB yet.
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
    if (task.notebookId) {
      setSelectedNotebookId(task.notebookId);
      setSelectedNotebookTaskId(task.id);
      setView("notebooks");
      return;
    }
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

  const listDetailList = useMemo(() => {
    if (!listDetailTarget) return null;
    return (
      workspaceLists.find(
        (l) => l.id === listDetailTarget.listId && l.workspaceId === listDetailTarget.workspaceId
      ) ?? null
    );
  }, [listDetailTarget, workspaceLists]);

  const listDetailItems = useMemo(() => {
    if (!listDetailTarget) return [];
    // Shared-aware + workspace-scoped: shared items keep source workspaceId.
    return getListItemsForList(listDetailTarget.listId, listDetailTarget.workspaceId);
  }, [listDetailTarget, getListItemsForList, listItems]);

  const closeListDetail = useCallback(() => {
    setListDetailTarget((current) => {
      if (current?.discardIfEmpty) {
        const hasItems = getListItemsForList(current.listId, current.workspaceId).length > 0;
        if (!hasItems) {
          void deleteList(current.listId);
        }
      }
      return null;
    });
    refreshHomeListAggregatesFromStore();
  }, [deleteList, getListItemsForList, refreshHomeListAggregatesFromStore]);

  const handleToggleListItem = useCallback(
    async (id: string) => {
      const item = listItems.find((i) => i.id === id);
      if (!item) return;

      const markingComplete = !item.completed;
      const result = await toggleListItem(id);
      if (result === false) {
        toast.error("Couldn't save list change", {
          description: "Check your connection and try again.",
        });
        return;
      }
      if (!markingComplete) return;

      if (result === "queued") {
        toast.info("Saved on this device", {
          description: "Will sync when you're back online.",
          duration: 4000,
        });
        return;
      }

      showListItemCompletionFeedback(item, {
        undoListItemCompletion: async (itemId) => {
          const current = useTaskStore.getState().listItems.find((i) => i.id === itemId);
          if (!current?.completed) return false;
          return (await toggleListItem(itemId)) !== false;
        },
      });
    },
    [listItems, toggleListItem]
  );

  const handleCompleteListItemFamily = useCallback(
    async (id: string) => {
      const item = listItems.find((i) => i.id === id);
      if (!item) return;

      const listScopedItems = listItems.filter(
        (i) => i.listId === item.listId && i.workspaceId === item.workspaceId
      );
      const completedSnapshot = getIncompleteSubtreeItems(id, listScopedItems);
      const result = await completeListItemFamily(id);
      if (result === false) {
        toast.error("Couldn't save list change", {
          description: "Check your connection and try again.",
        });
        return;
      }

      if (result === "queued") {
        toast.info("Saved on this device", {
          description: "Will sync when you're back online.",
          duration: 4000,
        });
        return;
      }

      showListItemCompletionFeedback(item, {
        undoListItemCompletion: async () => {
          let allOk = true;
          for (const snapshotItem of completedSnapshot) {
            const current = useTaskStore.getState().listItems.find((i) => i.id === snapshotItem.id);
            if (!current?.completed) continue;
            const undone = await toggleListItem(snapshotItem.id);
            if (undone === false) allOk = false;
          }
          return allOk;
        },
      });
    },
    [completeListItemFamily, listItems, toggleListItem]
  );

  const handleSetListItemPending = useCallback(
    async (id: string, pending: boolean) => {
      const item = listItems.find((i) => i.id === id);
      if (!item) return;

      const markingPending = pending && !item.pending;
      const result = await setListItemPending(id, pending);
      if (result === false) {
        toast.error("Couldn't save list change", {
          description: "Check your connection and try again.",
        });
        return;
      }
      if (!markingPending) return;

      if (result === "queued") {
        toast.info("Saved on this device", {
          description: "Will sync when you're back online.",
          duration: 4000,
        });
        return;
      }

      showListItemPendingFeedback(item, {
        undoListItemPending: async (itemId) => {
          const current = useTaskStore.getState().listItems.find((i) => i.id === itemId);
          if (!current?.pending) return false;
          return (await setListItemPending(itemId, false)) !== false;
        },
      });
    },
    [listItems, setListItemPending]
  );

  const openListDetail = useCallback(
    (listId: string, workspaceId: string, options?: { discardIfEmpty?: boolean }) => {
      void hydrateWorkspaceListData(workspaceId);
      setListDetailTarget({
        listId,
        workspaceId,
        discardIfEmpty: options?.discardIfEmpty,
      });
    },
    [hydrateWorkspaceListData]
  );

  const openWorkspaceReview = useCallback(
    (workspaceId: string) => {
      const pending = sortFiledNotes(
        filterPendingReview((notes || []).filter((n) => n.workspaceId === workspaceId))
      );
      const first = pending[0];
      if (!first) {
        toast.info("No files in Review for this workspace");
        setFilesOpenReview(false);
        setFilesOpenReviewNoteId(null);
        return;
      }
      setSelectedNoteId(first.id);
      setFilesOpenReview(true);
      setFilesOpenReviewNoteId(first.id);
      setView("notes");
    },
    [notes, setFilesOpenReview, setFilesOpenReviewNoteId, setView]
  );

  const handleHomeOpenWorkspaceReview = useCallback(
    (workspaceId: string) => {
      if (currentWorkspace.id !== workspaceId) {
        setPendingWorkspaceNav({ kind: "review", workspaceId });
        setFilesOpenReview(true);
        setView("notes");
        switchWorkspace(workspaceId);
        return;
      }
      openWorkspaceReview(workspaceId);
    },
    [currentWorkspace.id, switchWorkspace, openWorkspaceReview, setFilesOpenReview, setView]
  );

  const handleHomeOpenList = (listId: string, workspaceId: string) => {
    openListDetail(listId, workspaceId);
  };

  const handleHomeNavigateDue = useCallback(
    (workspaceId: string) => {
      setView("tasks");
      if (currentWorkspace.id !== workspaceId) {
        switchWorkspace(workspaceId);
      }
    },
    [currentWorkspace.id, setView, switchWorkspace]
  );

  const handleHomeNavigateLists = useCallback(
    (workspaceId: string) => {
      const lists = (globalListHighlights || []).filter((l) => l.workspaceId === workspaceId);
      const listId = lists.length === 1 ? lists[0].id : undefined;
      setView("lists");
      if (currentWorkspace.id !== workspaceId) {
        if (listId) {
          setPendingWorkspaceNav({ kind: "list", workspaceId, listId });
        }
        switchWorkspace(workspaceId);
        return;
      }
      if (listId) {
        void hydrateWorkspaceListData(workspaceId).then(() => setHighlightListId(listId));
      }
    },
    [globalListHighlights, currentWorkspace.id, setView, switchWorkspace, hydrateWorkspaceListData]
  );

  const handleHomeNavigateReview = useCallback(
    (workspaceId: string) => {
      if (currentWorkspace.id !== workspaceId) {
        setPendingWorkspaceNav({ kind: "review", workspaceId });
        setFilesOpenReview(true);
        setView("notes");
        switchWorkspace(workspaceId);
        return;
      }
      openWorkspaceReview(workspaceId);
    },
    [currentWorkspace.id, openWorkspaceReview, setFilesOpenReview, setView, switchWorkspace]
  );

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
              openCount: wasDone ? stats.openCount + 1 : Math.max(0, stats.openCount - 1),
              doneCount: wasDone ? Math.max(0, stats.doneCount - 1) : stats.doneCount + 1,
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
        useTaskStore
          .getState()
          .fetchUserWorkspaces?.()
          .catch(() => {}),
        fetchGlobalHomeAggregates(),
      ]);
    }
  };

  const handleHomeDeclineInvite = async (inviteId: string) => {
    await declineReceivedInvite(inviteId);
    await fetchNotifications?.().catch(() => {});
    fetchGlobalHomeAggregates();
  };

  const resolveListShareId = useCallback((shareId: string | undefined, link?: string) => {
    const trimmed = shareId?.trim();
    if (trimmed && isValidListShareId(trimmed)) return trimmed;

    if (link) {
      const match = link.match(/\/list-share\/([0-9a-f-]{36})/i);
      if (match?.[1] && isValidListShareId(match[1])) return match[1];
    }

    return null;
  }, []);

  const handleHomeAcceptListShare = (shareId: string, link?: string) => {
    const resolvedShareId = resolveListShareId(shareId, link);
    if (!resolvedShareId) {
      toast.error("Could not open shared list", {
        description:
          "This notification is missing a valid share link. Ask the sender to share again.",
      });
      return;
    }

    setShowNotifications(false);
    setSelectedNotification(null);
    setPendingListShareAcceptId(resolvedShareId);
  };

  const handleListShareAccepted = async (result: { listId: string; targetWorkspaceId: string }) => {
    setView("lists");
    setHighlightListId(result.listId);
    await Promise.all([
      fetchNotifications?.().catch(() => {}),
      fetchGlobalHomeAggregates(),
      refreshHomeListAggregatesFromStore?.(),
    ]);
  };

  const handleHomeDeclineListShare = async (shareId: string) => {
    await declineReceivedListShare(shareId);
    await fetchNotifications?.().catch(() => {});
    fetchGlobalHomeAggregates();
  };

  const handleHomeOpenNotification = (notification: Notification) => {
    setSelectedNotification(notification);
    if (
      !notification.readAt &&
      notification.type !== "invite" &&
      notification.type !== "list_share"
    ) {
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

  const renderProfileEditorContent = () => {
    if (!user) return null;

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
      <div className="profile-popover-panel__body p-3 text-sm space-y-2.5">
        <div className="space-y-2">
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-text-muted mb-1">
              Signed in as
            </label>
            <p
              className="profile-popover-email px-2.5 py-1.5 text-xs rounded-lg bg-surface-hover border border-border-glass text-text-primary truncate"
              title={user.email ?? undefined}
            >
              {user.email || "No email on this account"}
            </p>
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-text-muted mb-1">
              Full name
            </label>
            <input
              type="text"
              value={nameVal}
              onChange={(e) => setProfileFullName(e.target.value)}
              placeholder="Alex Rivera"
              className="input w-full px-2.5 py-1.5 text-sm rounded-lg min-h-[36px]"
              disabled={profileDisabled}
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-text-muted mb-1">
              Username / handle
            </label>
            <div className="flex items-center gap-1">
              <span className="text-text-secondary px-1.5 text-sm">@</span>
              <input
                type="text"
                value={userVal}
                onChange={(e) =>
                  setProfileUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))
                }
                placeholder="alexr"
                className="input flex-1 px-2.5 py-1.5 text-sm rounded-lg font-mono min-h-[36px]"
                disabled={profileDisabled}
              />
            </div>
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-text-muted mb-1">
              Where you&apos;re from
            </label>
            <input
              type="text"
              value={locVal}
              onChange={(e) => setProfileLocation(e.target.value)}
              placeholder="San Francisco, CA or Remote"
              className="input w-full px-2.5 py-1.5 text-sm rounded-lg min-h-[36px]"
              disabled={profileDisabled}
            />
          </div>
        </div>

        <div className="border-t border-border-glass pt-2 grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={() => {
              setShowProfilePopover(false);
              setShowChangePassword(true);
            }}
            className="min-h-[36px] flex items-center justify-center gap-1.5 rounded-lg transition text-xs font-medium text-text-primary hover:bg-surface-hover border border-border-glass"
          >
            <Lock className="h-3.5 w-3.5 text-neon-purple shrink-0" />
            Password
          </button>
          <button
            type="button"
            onClick={() => {
              setShowProfilePopover(false);
              setShowLoginActivity(true);
            }}
            className="min-h-[36px] flex items-center justify-center gap-1.5 rounded-lg transition text-xs font-medium text-text-primary hover:bg-surface-hover border border-border-glass"
          >
            <KeyRound className="h-3.5 w-3.5 text-neon-purple shrink-0" />
            Activity
          </button>
        </div>

        <div className="border-t border-border-glass pt-2 space-y-1.5">
          <div className="text-[10px] uppercase tracking-widest text-text-muted">Appearance</div>
          <ThemeToggleSegmented onThemeChange={() => setShowProfilePopover(false)} />
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setShowProfilePopover(false)}
            className="btn btn-ghost flex-1 min-h-[36px] text-sm py-1.5"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={profileDisabled}
            className="btn btn-primary flex-1 min-h-[36px] text-sm py-1.5 disabled:opacity-50"
          >
            {isSavingProfile ? "Saving..." : "Save"}
          </button>
        </div>
        {!isLiveWorkspace && (
          <p className="text-[10px] text-neon-purple text-center -mt-1">
            Live connection required to save
          </p>
        )}
        {isSiteAdmin && (
          <div className="border-t border-border-glass pt-2 md:hidden">
            <button
              type="button"
              onClick={() => {
                setShowProfilePopover(false);
                setView("admin");
              }}
              className={cn(
                "w-full min-h-[36px] flex items-center justify-center gap-2 rounded-lg transition text-sm font-medium",
                currentView === "admin"
                  ? "text-neon-purple bg-neon-purple/10"
                  : "text-text-primary hover:bg-surface-hover"
              )}
            >
              <Shield className="h-4 w-4 text-neon-purple" />
              Admin
            </button>
          </div>
        )}
        <div className="border-t border-border-glass pt-2">
          <button
            type="button"
            onClick={() => {
              setShowProfilePopover(false);
              setPendingSignOut(true);
            }}
            className="profile-popover-sign-out w-full min-h-[36px] flex items-center justify-center gap-2 text-[var(--priority-p0)] hover:opacity-90 hover:bg-red-500/10 rounded-lg transition text-sm font-medium"
          >
            <LogOut className="h-3.5 w-3.5 text-[var(--priority-p0)]" />
            Log out
          </button>
        </div>
      </div>
    );
  };

  const taskStatusFilterMode = (taskFilter.statusMode ??
    (taskFilter.recurring === "completed"
      ? "completed"
      : taskFilter.recurring === "all"
        ? "all"
        : "incomplete")) as TasksStatusFilterMode;
  const taskRecurrenceFilterMode = (taskFilter.recurrenceMode ??
    (taskFilter.recurring === "only"
      ? "only"
      : taskFilter.recurring === "none"
        ? "none"
        : "all")) as TasksRecurrenceFilterMode;
  const taskStarredFilterMode = taskFilter.starred ?? "all";
  const taskFolderFilterMode = taskFilter.folderFilter ?? "all";
  const workspaceTaskCount = tasks.filter(
    (t) => t.workspaceId === currentWorkspace.id
  ).length;
  const hasActiveTaskFilters =
    Boolean(
      taskFilter.search ||
        taskStatusFilterMode !== "incomplete" ||
        taskRecurrenceFilterMode !== "all" ||
        taskStarredFilterMode !== "all" ||
        taskFolderFilterMode !== "all"
    ) ||
    // Incomplete (default) can hide every row when all tasks are done — don't lie with "No tasks yet."
    (filteredTasks.length === 0 && workspaceTaskCount > 0);
  const taskFolders = getTaskFolders();
  const renderTasksView = () => (
    <div className="tasks-root flex flex-col flex-1 min-h-0">
      <div className="tasks-workspace flex flex-col flex-1 min-h-0 w-full">
        <WorkspaceViewHeader
          variant="inline"
          title="Tasks"
          workspaceName={currentWorkspace.name}
          icon={<Check className="h-6 w-6" />}
          hideWorkspaceLabelOnMobile
          hideWorkspaceNameOnMobile
          className="tasks-desktop-page-header mb-1"
        />

        {/* Mobile — search + compact filter trigger (status/type/folders open on demand) */}
        <div className="tasks-toolbar-mobile grid grid-cols-[minmax(0,1fr)_auto] gap-x-2 gap-y-1.5 mb-1 md:hidden">
          <input
            value={taskFilter.search || ""}
            onChange={(e) => setTaskFilter({ search: e.target.value })}
            placeholder="Search tasks"
            className="tasks-page-search input col-start-1 row-start-1 px-3 py-2.5 text-sm w-full min-h-[40px]"
          />
          <TasksMobileOrganizeDisclosure
            folders={taskFolders}
            starredFilter={taskStarredFilterMode}
            folderFilter={taskFolderFilterMode}
            onStarredFilterChange={(starred) => setTaskFilter({ starred })}
            onFolderFilterChange={(folderFilter) => setTaskFilter({ folderFilter })}
            onAddFolder={(name) => addTaskFolder(name)}
            onRenameFolder={(id, name) => updateTaskFolder(id, { name })}
            onDeleteFolder={async (id) => {
              await deleteTaskFolder(id);
              if (taskFolderFilterMode === id) setTaskFilter({ folderFilter: "all" });
            }}
            statusFilter={taskStatusFilterMode}
            onStatusFilterChange={(mode) => setTaskFilter({ statusMode: mode })}
            recurrenceFilter={taskRecurrenceFilterMode}
            onRecurrenceFilterChange={(mode) => setTaskFilter({ recurrenceMode: mode })}
          />
        </div>

        <TasksOrganizeBar
          className="tasks-organize-bar--desktop hidden md:block"
          showStatusFilter
          statusFilter={taskStatusFilterMode}
          onStatusFilterChange={(mode) => setTaskFilter({ statusMode: mode })}
          showRecurrenceFilter
          recurrenceFilter={taskRecurrenceFilterMode}
          onRecurrenceFilterChange={(mode) => setTaskFilter({ recurrenceMode: mode })}
          folders={taskFolders}
          starredFilter={taskStarredFilterMode}
          folderFilter={taskFolderFilterMode}
          onStarredFilterChange={(starred) => setTaskFilter({ starred })}
          onFolderFilterChange={(folderFilter) => setTaskFilter({ folderFilter })}
          onAddFolder={(name) => addTaskFolder(name)}
          onRenameFolder={(id, name) => updateTaskFolder(id, { name })}
          onDeleteFolder={async (id) => {
            await deleteTaskFolder(id);
            if (taskFolderFilterMode === id) setTaskFilter({ folderFilter: "all" });
          }}
        />

        <TasksTable
          className="tasks-table-host"
          tasks={filteredTasks}
          taskLoadingStates={taskLoadingStates}
          onOpenTask={openTask}
          onComplete={handleComplete}
          onAddTask={addTask}
          onSwipeComplete={handleComplete}
          showAssignee={isSharedWorkspace(members)}
          searchValue={taskFilter.search || ""}
          onSearchChange={(search) => setTaskFilter({ search })}
          resultCount={filteredTasks.length}
          isLoading={isInitializing}
          hasActiveFilters={hasActiveTaskFilters}
          onClearFilters={() =>
            setTaskFilter({
              search: "",
              statusMode: "incomplete",
              recurrenceMode: "all",
              starred: "all",
              folderFilter: "all",
            })
          }
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

      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "n") {
        if (typing || paletteOpen) return;
        e.preventDefault();
        setSelectedNoteId(null);
        setFilesCaptureOpen(true);
        setView("notes");
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "n" && !e.shiftKey) {
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

      if (
        !typing &&
        !paletteOpen &&
        !showFullTaskModal &&
        !listDetailTarget &&
        !isKeyboardCheatsheetOpen
      ) {
        if (e.key === "1") {
          setView("tasks");
          return;
        }
        if (e.key === "2") {
          setView("notes");
          return;
        }
        if (e.key === "3") {
          setView("lists");
          return;
        }
        if (e.key === "4") {
          setView("teams");
          return;
        }
        if (e.key === "5") {
          setView("settings");
          return;
        }
      }

      if (e.key === "Escape") {
        if (filesCaptureOpen) {
          setFilesCaptureOpen(false);
          return;
        }
        if (isKeyboardCheatsheetOpen) {
          toggleKeyboardCheatsheet(false);
          return;
        }
        if (showFullTaskModal) {
          return;
        }
        if (listDetailTarget) {
          closeListDetail();
          return;
        }
        if (selectedTaskId) {
          selectTask(null);
          return;
        }
        if (selectedNoteId && !hasOpenOverlay()) {
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
    listDetailTarget,
    closeListDetail,
    setView,
    filesCaptureOpen,
    setFilesCaptureOpen,
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
  }, [
    currentView,
    fetchGlobalHomeAggregates,
    refreshHomeNoteAggregatesFromStore,
    fetchNotifications,
  ]);

  // Patch the home pulse directly — do not refetch aggregates (that raced mark-as-read).
  useEffect(() => {
    if (!currentWorkspace.id) return;
    if (workspaceChat.hasUnread) {
      setWorkspaceUnreadChat(currentWorkspace.id, true);
    } else {
      clearWorkspaceUnreadChat(currentWorkspace.id);
    }
  }, [
    workspaceChat.hasUnread,
    currentWorkspace.id,
    setWorkspaceUnreadChat,
    clearWorkspaceUnreadChat,
  ]);

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

    if (pendingWorkspaceNav.kind === "review") {
      if (currentView !== "notes") return;
      if (isInitializing) return;
      openWorkspaceReview(pendingWorkspaceNav.workspaceId);
      setPendingWorkspaceNav(null);
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
    isInitializing,
    tasks,
    globalTodayFocus,
    globalOpenTaskFocus,
    hydrateWorkspaceListData,
    openWorkspaceReview,
  ]);

  const renderHomeView = () => {
    const workspacePulse = (workspaces || []).map((ws) => {
      const wsFocus = (globalTodayFocus || []).filter((f) => f.workspaceId === ws.id);
      const stats = globalWorkspaceStats?.[ws.id];
      const overdue =
        stats?.overdueCount ??
        wsFocus.filter((f) => {
          if (!f.task.dueDate) return false;
          return isDueDatePast(f.task.dueDate);
        }).length;

      const assignedToYou = wsFocus.filter(
        (f) => f.task.assigneeIds?.[0] === user?.id || f.task.assignee === "You"
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
        unreadNotifications: countWorkspaceBadgeUnread(notifications || [], ws.id),
        unreadChat: stats?.unreadChat ?? false,
        isCurrent: currentWorkspace.id === ws.id,
        onlineCount: currentWorkspace.id === ws.id ? (onlineUsers || []).length : undefined,
        listCount: stats?.listCount ?? 0,
        openListItemsCount: stats?.openListItemsCount ?? 0,
        noteCount: stats?.noteCount ?? 0,
        pendingReviewCount: stats?.pendingReviewCount ?? 0,
        taskCount:
          stats?.totalTaskCount ?? (tasks || []).filter((t) => t.workspaceId === ws.id).length,
        memberCount: stats?.memberCount,
      };
    });

    return (
      <HomeView
        userDisplayName={homeUserDisplayName}
        workspaces={workspaces}
        switchWorkspace={switchWorkspace}
        tasks={tasks}
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
        pendingReviewTotal={Object.values(globalWorkspaceStats || {}).reduce(
          (sum, s) => sum + (s.pendingReviewCount ?? 0),
          0
        )}
        onOpenWorkspaceReview={handleHomeOpenWorkspaceReview}
        onNavigateDue={handleHomeNavigateDue}
        onNavigateLists={handleHomeNavigateLists}
        onNavigateReview={handleHomeNavigateReview}
        showTaskAssignee={workspaces.some(
          (ws) => (globalWorkspaceStats?.[ws.id]?.memberCount ?? 1) > 1
        )}
        members={members}
        currentUserId={user?.id}
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

  const handleCaptureFile = useCallback(
    async (input: CaptureFileInput, mode: CaptureFileSubmitMode, draftNoteId?: string) => {
      const reviewStatus = mode === "review" ? ("pending_review" as const) : ("filed" as const);
      const tags = input.tags.length > 0 ? input.tags : mode === "file" ? ["uncategorized"] : [];

      let noteId = draftNoteId ?? null;

      if (noteId) {
        await updateNote(noteId, {
          title: input.title,
          content: input.content,
          tags,
          memo: input.memo || null,
          recordType: input.recordType,
          reviewStatus,
        });
      } else {
        const created = await addNote(input.title, input.content, {
          tags,
          memo: input.memo || null,
          recordType: input.recordType,
          reviewStatus,
        });
        noteId = created?.id ?? null;
      }

      if (!noteId) {
        toast.error("Could not capture file");
        return;
      }

      if (mode === "file") {
        await updateNote(noteId, {
          workspaceId: currentWorkspace.id,
          reviewedBy: user?.id ?? null,
          filedAt: new Date().toISOString(),
        });
      }

      for (const taskTitle of input.pendingTaskTitles ?? []) {
        await noteOps.onCreateTaskAndLink(noteId, taskTitle);
      }

      setView("notes");
      setSelectedNoteId(noteId);
      if (mode === "review") {
        setFilesOpenReview(true);
        toast.success("Added to Review");
      } else {
        toast.success("Filed to library");
      }
    },
    [
      addNote,
      updateNote,
      noteOps.onCreateTaskAndLink,
      currentWorkspace.id,
      user?.id,
      setView,
      setFilesOpenReview,
    ]
  );

  const renderListsView = () => {
    const lists = getWorkspaceLists();
    const archivedLists = getArchivedWorkspaceLists();
    return (
      <div className="lists-root flex flex-col min-h-0 flex-1">
        <ListsView
          workspaceName={currentWorkspace.name}
          lists={lists}
          archivedLists={archivedLists}
          getItemsForList={getListItemsForList}
          onAddList={(title) => addList(title)}
          onUpdateList={(id, updates) => {
            void updateList(id, updates);
          }}
          onDeleteList={(id) => {
            void deleteList(id);
          }}
          onTogglePinned={(id) => {
            void toggleListPinned(id);
          }}
          onArchiveList={(id) => {
            void updateList(id, { archived: true, pinned: false });
            if (listDetailTarget?.listId === id) closeListDetail();
          }}
          onUnarchiveList={(id) => {
            void updateList(id, { archived: false });
          }}
          onAddItem={(listId, text, options) =>
            addListItem(listId, text, options).then((item) => item?.id ?? null)
          }
          onToggleItem={(id) => {
            void handleToggleListItem(id);
          }}
          onCompleteItemFamily={(id) => {
            void handleCompleteListItemFamily(id);
          }}
          onUpdateItem={(id, text) => {
            void updateListItem(id, { text });
          }}
          onDeleteItem={(id) => {
            void deleteListItem(id);
          }}
          onNudgeList={nudgeList}
          onIndentItem={(id) => {
            void indentListItem(id);
          }}
          onOutdentItem={(id) => {
            void outdentListItem(id);
          }}
          onClearCompleted={(listId) => {
            void clearCompletedListItems(listId);
          }}
          onSetListItemPending={(id, pending) => {
            void handleSetListItemPending(id, pending);
          }}
          onRestorePending={(listId) => {
            void restorePendingListItems(listId);
          }}
          onClearPending={(listId) => {
            void clearPendingListItems(listId);
          }}
          highlightListId={highlightListId}
          onOpenDetail={(listId, options) => openListDetail(listId, currentWorkspace.id, options)}
          canShareList={canManage && isTrulyLive && !["w1", "w2"].includes(currentWorkspace.id)}
        />
      </div>
    );
  };

  const renderNotesView = () => {
    return (
      <FilesView
        notes={notes}
        tasks={tasks}
        workspaceId={currentWorkspace.id}
        selectedNoteId={selectedNoteId}
        onSelectNote={setSelectedNoteId}
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
        onLinkNoteToNote={noteOps.onLinkNoteToNote}
        onUnlinkNoteFromNote={noteOps.onUnlinkNoteFromNote}
        onOpenNote={(noteId) => setSelectedNoteId(noteId)}
        onPersistSnapshot={noteOps.onPersistSnapshot}
        requestSnapshot={noteOps.requestSnapshot}
        requestTitleSnapshot={noteOps.requestTitleSnapshot}
        isLive={isTrulyLive}
        onMentionLinked={noteOps.onMentionLinked}
        onRemoveLinked={noteOps.onRemoveLinked}
        onRemoveBacklink={noteOps.onRemoveLinked}
        onMentionsChanged={undefined}
        onApproveFile={async (id, input) => {
          if (!hasUserFilingTags(input.tags)) {
            toast.error("Add a tag before filing");
            return;
          }
          await noteOps.onUpdateNote(id, {
            workspaceId: currentWorkspace.id,
            title: input.title,
            tags: input.tags,
            memo: input.memo,
            recordType: input.recordType,
            reviewStatus: "filed",
            filedAt: new Date().toISOString(),
            reviewedBy: user?.id ?? null,
            aiSuggestion: null,
          });
          try {
            await apiFetch("/api/ai/clear-review-suggestion", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ noteId: id, status: "approved" }),
            });
          } catch {
            // filed locally even if server clear fails
          }
        }}
        openReviewOnMount={filesOpenReview}
        onOpenReviewConsumed={() => setFilesOpenReview(false)}
        openReviewNoteIdOnMount={filesOpenReviewNoteId}
        onOpenReviewNoteConsumed={() => setFilesOpenReviewNoteId(null)}
        onOpenCapture={() => {
          setSelectedNoteId(null);
          setFilesCaptureOpen(true);
        }}
        members={members}
        currentUserId={user?.id}
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
              toast.success("Invite sent & link copied!", {
                description: "They can join via the link.",
              });
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
        panelClassName="glass modal-panel team-invite-modal"
        mobileLayout="sheet"
        showClose
        showDragHandle
        enableDragDismiss
        dragMode="handle"
      >
        {isMobileViewport ? (
          <div className="team-invite-sheet p-5 space-y-4">
            <div>
              <label
                htmlFor="team-invite-email"
                className="text-xs text-text-secondary block mb-1.5"
              >
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
                className="w-full bg-bg-secondary border border-border-glass focus:border-neon-purple rounded-xl px-4 py-3 text-base outline-none min-h-[48px]"
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
              <label className="text-xs text-text-secondary block mb-1.5">Email (optional)</label>
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="teammate@company.com (leave blank for link-only)"
                className="w-full bg-bg-secondary border border-border-glass focus:border-neon-purple rounded-xl px-4 py-3 text-sm outline-none min-h-[44px]"
                disabled={isSendingInvite}
              />
            </div>
            <div>
              <label className="text-xs text-text-secondary block mb-1.5">Role</label>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as WorkspaceRole)}
                className="w-full bg-bg-secondary border border-border-glass rounded-xl px-4 py-3 text-sm min-h-[44px]"
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
    if (myRole === "owner" && members.length <= 1 && isLiveWorkspace && !isDemoWs) {
      return (
        <div className="teams-root">
          <div className="teams-workspace teams-workspace--empty max-w-2xl mx-auto pt-4 md:pt-12 pb-8 md:pb-20">
            <div className="team-empty-hero text-center mb-6 md:mb-10">
              <div className="mx-auto mb-4 md:mb-6 h-14 w-14 md:h-20 md:w-20 rounded-2xl md:rounded-3xl bg-gradient-to-br from-neon-purple to-neon-purple-dark flex items-center justify-center">
                <Users className="h-7 w-7 md:h-10 md:w-10 text-accent-on" />
              </div>
              <div className="text-2xl md:text-4xl font-semibold tracking-tighter mb-2">Team</div>
              <div className="hidden md:inline-flex max-w-full items-center rounded-lg border border-neon-purple/25 bg-neon-purple/8 px-3 py-1 text-sm font-semibold tracking-tight text-neon-purple-tint mb-3 truncate">
                {currentWorkspace.name}
              </div>
              <p className="team-empty-private-notice text-sm text-text-secondary max-w-md mx-auto leading-relaxed px-3 md:px-0">
                You&apos;re in a private workspace and don&apos;t have teammates yet. Search below
                to find people and invite them.
              </p>

              {/* Recipient context — only show for non-owners of this workspace */}
              {currentWorkspace.role && currentWorkspace.role !== "owner" && (
                <div className="mt-4 mb-2 text-sm text-neon-purple bg-neon-purple/10 border border-neon-purple/20 rounded-xl px-4 py-2 inline-block">
                  You were invited to this workspace.
                </div>
              )}
            </div>

            {/* === "Invites sent" — primary focus once any exist (world-class simple feedback) === */}
            {invites.length > 0 && (
              <div className="team-empty-card glass rounded-2xl md:rounded-3xl p-4 md:p-8 border border-border-glass mb-4 md:mb-8">
                <div className="flex items-center justify-between mb-4 md:mb-6">
                  <div className="flex items-center gap-2 md:gap-3 min-w-0">
                    <div className="font-semibold text-base md:text-xl tracking-tight">
                      Invites sent
                    </div>
                    <div className="px-3 py-0.5 rounded-full bg-neon-purple/20 text-sm font-mono text-neon-purple border border-neon-purple/30">
                      {invites.length}
                    </div>
                  </div>
                  <div className="text-xs text-text-muted font-mono">Pending</div>
                </div>

                <div className="space-y-2 md:space-y-3">
                  {invites.map((inv, index) => (
                    <div
                      key={inv.id}
                      className="team-invite-sent-row flex items-center justify-between p-3 md:p-4 rounded-xl md:rounded-2xl bg-surface-hover border border-border-glass hover:bg-surface-hover transition group"
                    >
                      <div className="min-w-0">
                        {/* Privacy: never show the recipient's email in the sender's "Invites sent" list.
                          Prefer name + @username (populated when invite came via search). */}
                        <div className="font-medium truncate">
                          {inv.invitedFullName ||
                            (inv.invitedUsername ? `@${inv.invitedUsername}` : "Pending teammate")}
                        </div>
                        <div className="text-xs text-text-muted font-mono mt-0.5">
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
                            const label =
                              inv.invitedFullName ||
                              (inv.invitedUsername
                                ? `@${inv.invitedUsername}`
                                : inv.email || "link-only");
                            handleResendInvite(inv.id, label);
                          }}
                          className="btn btn-secondary text-xs px-3 py-1.5 flex items-center gap-1"
                          disabled={!isLive}
                        >
                          <Repeat className="h-3 w-3" /> Resend
                        </button>
                        <button
                          onClick={() => {
                            const label =
                              inv.invitedFullName ||
                              (inv.invitedUsername
                                ? `@${inv.invitedUsername}`
                                : inv.email || "link-only");
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
            <div className="team-empty-card glass rounded-2xl md:rounded-3xl p-4 md:p-8 border border-border-glass mb-4 md:mb-8">
              <div className="font-semibold text-base md:text-lg mb-3 md:mb-4 flex items-center gap-2">
                <Search className="h-5 w-5 text-neon-purple shrink-0" /> Find people
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
                        const results = await searchPotentialTeammates(
                          q.trim(),
                          currentWorkspace.id
                        );
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
                    className="team-empty-search-clear absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
                    aria-label="Clear search"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {isSearchingTeam && (
                <div className="flex items-center gap-2 text-sm text-text-secondary mb-3 px-1">
                  <Loader2 className="h-4 w-4 animate-spin" /> Searching directory...
                </div>
              )}

              {!isSearchingTeam && teamSearchResults.length > 0 && (
                <div className="space-y-2 mb-4">
                  {teamSearchResults.map((result, idx) => {
                    const initial = (result.fullName || result.username || result.email || "?")
                      .toString()[0]
                      .toUpperCase();
                    const displayName = getSearchResultDisplayName(result);
                    return (
                      <div
                        key={result.id || idx}
                        className="team-invite-result-row flex items-center justify-between p-3 md:p-4 rounded-xl md:rounded-2xl bg-surface-hover border border-border-glass hover:bg-surface-hover transition"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {result.avatarUrl ? (
                            <img
                              src={result.avatarUrl}
                              alt=""
                              className="h-10 w-10 rounded-full object-cover border border-border-glass"
                            />
                          ) : (
                            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-neon-purple/80 to-neon-purple-dark/80 flex items-center justify-center text-accent-on font-bold flex-shrink-0">
                              {initial}
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="font-medium truncate">{displayName}</div>
                            {result.username && (
                              <div className="text-xs text-neon-purple font-mono">
                                @{result.username}
                              </div>
                            )}
                            {result.location && (
                              <div className="text-xs text-text-muted truncate">
                                ≡ƒôì {result.location}
                              </div>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={async () => {
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
                                description: "They will receive an email notification.",
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

              {!isSearchingTeam &&
                teamSearchQuery.trim() &&
                teamSearchResults.length === 0 &&
                (isMobileViewport ? (
                  <div className="team-search-not-found rounded-2xl border border-border-glass bg-surface-overlay px-4 py-6 text-center mb-2">
                    <div className="mx-auto mb-3 h-12 w-12 rounded-full bg-neon-purple/10 border border-neon-purple/30 flex items-center justify-center">
                      <User className="h-5 w-5 text-neon-purple" />
                    </div>
                    <p className="text-base font-semibold tracking-tight text-text-primary mb-5">
                      User not found
                    </p>
                    <button
                      type="button"
                      onClick={openEmailInviteSheet}
                      className="w-full btn btn-primary min-h-[48px] text-sm font-semibold"
                    >
                      Invite
                    </button>
                  </div>
                ) : (
                  <div className="text-sm text-text-muted mb-4 px-1">
                    No matches in the directory.
                  </div>
                ))}
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
      (onlineUsers || []).map((u) => u.userId).filter((id): id is string => !!id)
    );

    return (
      <div className="teams-root">
        <div className="teams-workspace flex flex-col gap-3 md:gap-8 pb-8 md:pb-12">
          <div className="teams-workspace-header">
            <WorkspaceViewHeader
              variant="inline"
              title="Team"
              workspaceName={currentWorkspace.name}
              icon={<Users className="h-6 w-6" />}
              meta={`${members.length} member${members.length === 1 ? "" : "s"}${onlineUsers.length > 0 ? ` · ${onlineUsers.length} online` : ""}`}
              hideWorkspaceLabelOnMobile
              hideWorkspaceNameOnMobile
              hideMetaOnMobile
              className="mb-0"
              actions={
                canManage && isLive && !isDemoWs ? (
                  <button
                    onClick={() => setShowInviteDialog(true)}
                    className="teams-invite-btn btn btn-primary text-sm flex items-center gap-2 min-h-[40px] md:min-h-[44px]"
                  >
                    <Plus className="h-4 w-4" /> Invite
                  </button>
                ) : undefined
              }
            />
          </div>

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
                      className="bg-bg-secondary border border-border-glass rounded px-2 py-1 text-xs font-mono focus:outline-none focus:border-neon-purple"
                      disabled={!isLive}
                    >
                      <option value="member">Member</option>
                      <option value="admin">Admin</option>
                      <option value="owner">Owner</option>
                    </select>
                    <button
                      onClick={() => {
                        const display =
                          m.fullName || (m.username ? `@${m.username}` : "this teammate");
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
                    className="px-3 py-1 text-xs rounded-xl border border-border-glass hover:bg-surface-hover text-text-secondary disabled:opacity-50"
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
            <div className="team-pending-panel glass rounded-2xl border border-border-glass overflow-hidden">
              <div className="team-pending-header px-5 py-3 border-b border-border-glass flex items-center justify-between bg-surface-hover">
                <div className="font-medium text-sm md:text-base">
                  Pending invites ({invites.length})
                </div>
              </div>
              {invites.length === 0 ? (
                <div className="p-4 md:p-6 text-sm text-text-muted">None</div>
              ) : (
                <div className="divide-y divide-border-glass text-sm">
                  {invites.map((inv) => (
                    <div key={inv.id} className="team-pending-row flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">
                          {inv.invitedFullName ||
                            (inv.invitedUsername ? `@${inv.invitedUsername}` : "Link-only invite")}
                        </div>
                        <div className="text-[11px] text-text-muted font-mono">
                          {formatRoleLabel(inv.role)}
                        </div>
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
                            const label =
                              inv.invitedFullName ||
                              (inv.invitedUsername
                                ? `@${inv.invitedUsername}`
                                : inv.email || "link-only");
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
                            const label =
                              inv.invitedFullName ||
                              (inv.invitedUsername
                                ? `@${inv.invitedUsername}`
                                : inv.email || "link-only");
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
      case "home":
        return renderHomeView();
      case "tasks":
        return renderTasksView();
      case "notes":
        return renderNotesView();
      case "notebooks":
        return (
          <NotebooksView
            workspaceId={currentWorkspace.id}
            workspaceName={currentWorkspace.name}
            notebooks={getNotebooks()}
            archivedNotebooks={getArchivedNotebooks()}
            notes={getNotebookNotes(selectedNotebookId)}
            notebookTasks={getNotebookTasks(selectedNotebookId)}
            notebookTaskProgress={notebookTaskProgress.filter((p) =>
              getNotebookTasks(selectedNotebookId).some((t) => t.id === p.taskId)
            )}
            notebookInvestments={getNotebookInvestments(selectedNotebookId)}
            notebookInvestmentNotes={notebookInvestmentNotes.filter((n) =>
              getNotebookInvestments(selectedNotebookId).some((i) => i.id === n.investmentId)
            )}
            notebookCustomers={getNotebookCustomers(selectedNotebookId)}
            notebookCustomerNotes={notebookCustomerNotes.filter((n) =>
              getNotebookCustomers(selectedNotebookId).some((c) => c.id === n.customerId)
            )}
            notebookCompetitors={getNotebookCompetitors(selectedNotebookId)}
            workspaceCompetitors={notebookCompetitors}
            notebookCompetitorNotes={notebookCompetitorNotes.filter((n) =>
              getNotebookCompetitors(selectedNotebookId).some((c) => c.id === n.competitorId)
            )}
            workspaceCompetitorNotes={notebookCompetitorNotes}
            members={members}
            currentUserId={user?.id}
            selectedNotebookId={selectedNotebookId}
            selectedNoteId={selectedNotebookNoteId}
            selectedNotebookTaskId={selectedNotebookTaskId}
            selectedNotebookInvestmentId={selectedNotebookInvestmentId}
            selectedNotebookCustomerId={selectedNotebookCustomerId}
            selectedNotebookCompetitorId={selectedNotebookCompetitorId}
            isLive={isSupabaseConfigured()}
            onSelectNotebook={(id) => {
              setSelectedNotebookId(id);
              setSelectedNotebookTaskId(null);
              setSelectedNotebookInvestmentId(null);
              setSelectedNotebookCustomerId(null);
            }}
            onSelectNote={setSelectedNotebookNoteId}
            onSelectNotebookTask={setSelectedNotebookTaskId}
            onSelectNotebookInvestment={setSelectedNotebookInvestmentId}
            onSelectNotebookCustomer={setSelectedNotebookCustomerId}
            onSelectNotebookCompetitor={setSelectedNotebookCompetitorId}
            onAddNotebook={addNotebook}
            onUpdateNotebook={updateNotebook}
            onDeleteNotebook={deleteNotebook}
            onCreateNote={addNote}
            onUpdateNote={updateNote}
            onDeleteNote={deleteNote}
            onHydrateNote={hydrateNoteDetail}
            onAddNotebookTask={(title) =>
              selectedNotebookId ? addNotebookTask(selectedNotebookId, title) : undefined
            }
            onToggleNotebookTask={toggleNotebookTask}
            onUpdateNotebookTask={(id, title) => updateNotebookTask(id, { title })}
            onSetNotebookTaskShowOnWorkspace={setNotebookTaskShowOnWorkspace}
            onDeleteNotebookTask={deleteNotebookTask}
            onAddNotebookTaskProgress={addNotebookTaskProgress}
            onUpdateNotebookTaskProgress={updateNotebookTaskProgress}
            onDeleteNotebookTaskProgress={deleteNotebookTaskProgress}
            onAddNotebookInvestment={(title) =>
              selectedNotebookId ? addNotebookInvestment(selectedNotebookId, title) : undefined
            }
            onToggleNotebookInvestment={toggleNotebookInvestment}
            onUpdateNotebookInvestment={(id, title) => updateNotebookInvestment(id, { title })}
            onReorderNotebookInvestments={(orderedIds) =>
              selectedNotebookId
                ? reorderNotebookInvestments(selectedNotebookId, orderedIds)
                : undefined
            }
            onDeleteNotebookInvestment={deleteNotebookInvestment}
            onAddNotebookInvestmentNote={addNotebookInvestmentNote}
            onUpdateNotebookInvestmentNote={updateNotebookInvestmentNote}
            onDeleteNotebookInvestmentNote={deleteNotebookInvestmentNote}
            onAddNotebookCustomer={(accountName) =>
              selectedNotebookId ? addNotebookCustomer(selectedNotebookId, accountName) : undefined
            }
            onUpdateNotebookCustomer={(id, accountName) =>
              updateNotebookCustomer(id, { accountName })
            }
            onDeleteNotebookCustomer={deleteNotebookCustomer}
            onAddNotebookCustomerNote={addNotebookCustomerNote}
            onUpdateNotebookCustomerNote={updateNotebookCustomerNote}
            onDeleteNotebookCustomerNote={deleteNotebookCustomerNote}
            onAddNotebookCompetitor={(name, salesPotential) =>
              selectedNotebookId
                ? addNotebookCompetitor(selectedNotebookId, name, salesPotential)
                : undefined
            }
            onUpdateNotebookCompetitor={updateNotebookCompetitor}
            onDeleteNotebookCompetitor={deleteNotebookCompetitor}
            onAddNotebookCompetitorNote={addNotebookCompetitorNote}
            onUpdateNotebookCompetitorNote={updateNotebookCompetitorNote}
            onDeleteNotebookCompetitorNote={deleteNotebookCompetitorNote}
            onSetNotebookOurSales={(value) =>
              selectedNotebookId ? setNotebookOurSales(selectedNotebookId, value) : undefined
            }
            getNotebookDeleteSummary={(notebookId) => {
              const tasks = getNotebookTasks(notebookId);
              const taskIds = new Set(tasks.map((t) => t.id));
              const investments = getNotebookInvestments(notebookId);
              const investmentIds = new Set(investments.map((i) => i.id));
              const customers = getNotebookCustomers(notebookId);
              const customerIds = new Set(customers.map((c) => c.id));
              const competitors = getNotebookCompetitors(notebookId);
              const competitorIds = new Set(competitors.map((c) => c.id));
              return {
                noteCount: getNotebookNotes(notebookId).length,
                taskCount: tasks.length,
                taskProgressCount: notebookTaskProgress.filter((p) => taskIds.has(p.taskId)).length,
                investmentCount: investments.length,
                investmentNoteCount: notebookInvestmentNotes.filter((n) =>
                  investmentIds.has(n.investmentId)
                ).length,
                customerCount: customers.length,
                customerNoteCount: notebookCustomerNotes.filter((n) =>
                  customerIds.has(n.customerId)
                ).length,
                competitorCount: competitors.length,
                competitorNoteCount: notebookCompetitorNotes.filter((n) =>
                  competitorIds.has(n.competitorId)
                ).length,
              };
            }}
          />
        );
      case "meetings":
        return (
          <MeetingsView
            workspaceId={currentWorkspace.id}
            workspaceName={currentWorkspace.name}
            meetings={getMeetings()}
            archivedMeetings={getArchivedMeetings()}
            meetingAgendaItems={meetingAgendaItems}
            meetingAgendaEntries={meetingAgendaEntries}
            members={members}
            currentUserId={user?.id}
            selectedMeetingId={selectedMeetingId}
            selectedAgendaItemId={selectedAgendaItemId}
            onSelectMeeting={setSelectedMeetingId}
            onSelectAgendaItem={setSelectedAgendaItemId}
            onAddMeeting={addMeeting}
            onUpdateMeeting={updateMeeting}
            onDeleteMeeting={deleteMeeting}
            onAddAgendaItem={addAgendaItem}
            onUpdateAgendaItem={updateAgendaItem}
            onReorderAgendaItems={reorderAgendaItems}
            onAddAgendaEntry={addAgendaEntry}
            onUpdateAgendaEntry={updateAgendaEntry}
            onDeleteAgendaEntry={deleteAgendaEntry}
            onCompleteAgendaItem={completeAgendaItem}
            onContinueAgendaItem={continueAgendaItem}
            onUnreviewAgendaItem={unreviewAgendaItem}
            onReopenAgendaItem={reopenAgendaItem}
            onDeleteAgendaItem={deleteAgendaItem}
            onCompleteMeeting={completeMeeting}
            onReopenMeeting={reopenMeeting}
            onStartNextMeeting={startNextMeeting}
            onDuplicateMeeting={duplicateMeeting}
            onSaveSummaryAsNote={async (meeting) => {
              const items = getMeetingAgendaItems(meeting.id);
              const itemIds = new Set(items.map((i) => i.id));
              const entries = meetingAgendaEntries.filter((e) => itemIds.has(e.agendaItemId));
              const { buildMeetingSummaryMarkdown } = await import("@/lib/meetings/summaryBuilder");
              const md = buildMeetingSummaryMarkdown({
                meeting,
                items,
                entries,
                members,
                currentUserId: user?.id,
              });
              const content = JSON.stringify({
                type: "doc",
                content: [{ type: "paragraph", content: [{ type: "text", text: md }] }],
              });
              const targetNotebookId =
                meeting.notebookId ?? selectedNotebookId ?? getNotebooks()[0]?.id;
              if (!targetNotebookId) {
                toast.error("Create a notebook first to save the summary");
                return;
              }
              const created = await addNote(`${meeting.title} — Summary`, content, {
                notebookId: targetNotebookId,
              });
              if (created) {
                if (created.notebookId) setSelectedNotebookId(created.notebookId);
                setSelectedNotebookNoteId(created.id);
                setView("notebooks");
                toast.success("Summary saved to notebook");
              } else {
                toast.error("Could not save summary as note");
              }
            }}
          />
        );
      case "lists":
        return renderListsView();
      case "health":
        return (
          <HealthView
            workspaceId={currentWorkspace.id}
            workspaceName={currentWorkspace.name}
            readings={getHealthReadings()}
            profiles={healthProfiles.filter((p) => p.workspaceId === currentWorkspace.id)}
            members={members}
            currentUserId={user?.id}
            activeTab={healthSectionTab}
            selectedMemberId={selectedHealthMemberId}
            onTabChange={setHealthSectionTab}
            onMemberChange={setSelectedHealthMemberId}
            onAddReading={addHealthReading}
            onDeleteReading={deleteHealthReading}
            onUpdateProfile={upsertHealthProfile}
          />
        );
      case "teams":
        return renderTeamsView();
      case "settings":
        return <WorkspaceSettingsView />;
      case "admin":
        return isSiteAdmin ? <SiteAdminView /> : renderHomeView();
      default:
        return renderHomeView();
    }
  };

  // Hold UI until auth bootstrap or sign-out finishes — prevents flash of app chrome or stale data.
  if (showSessionGate) {
    return (
      <div className="fixed inset-0 z-[150] flex items-center justify-center bg-bg text-text-primary">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-neon-purple" aria-hidden="true" />
          <p className="text-sm text-text-muted">{isSigningOut ? "Signing out…" : "Loading…"}</p>
        </div>
      </div>
    );
  }

  if (showLandingGate) {
    return (
      <>
        <LandingPage onSignIn={() => router.push("/login")} isCheckingSession={false} />
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
      <div className="fixed inset-0 z-[150] flex items-center justify-center bg-bg text-text-primary">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-neon-purple" aria-hidden="true" />
          <p className="text-sm text-text-muted">Loading your workspaces…</p>
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
    <div className="flex h-screen flex-col overflow-hidden bg-bg text-text-primary">
      {/* Top Bar — mobile: row 1 brand + actions, row 2 edge-to-edge workspace */}
      <div className="top-bar relative md:min-h-16 md:flex md:items-center border-b border-border-glass z-50 bg-bg">
        <div className="top-bar-layout w-full md:px-5 md:flex md:items-center md:justify-between md:gap-4">
          <div className="top-bar-leading md:flex md:items-center md:gap-4 md:min-w-0 md:flex-1">
            <div className="top-bar-brand flex items-center gap-2 min-w-0 overflow-hidden">
              <BrandLogo size="sm" className="md:hidden" priority />
              <BrandLogo size="md" className="hidden md:block" priority />
              <div className="min-w-0 flex-1">
                <div className="font-semibold tracking-[-0.3px] text-sm md:text-[17px] leading-none truncate">
                  Badazz Tasks
                </div>
              </div>
            </div>

            {/* Workspace Switcher — full-bleed second row on mobile; greeting sits to its right on home desktop */}
            <div className="top-bar-workspace-row max-md:contents md:flex md:items-center md:gap-5 md:min-w-0 md:flex-1">
              <div
                ref={workspaceMenuRef}
                className="top-bar-workspace relative min-w-0 md:shrink-0"
              >
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
                  className="group relative flex items-center gap-2 text-base px-4 py-3 md:px-4 md:py-2 rounded-none md:rounded-xl hover:bg-surface-hover border-0 border-t md:border border-border-glass workspace-switcher w-full md:w-[28rem] max-md:grid max-md:grid-cols-[auto_minmax(0,1fr)] max-md:items-center md:justify-between max-md:pl-3 max-md:pr-0 max-md:overflow-hidden"
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
                      "max-md:col-start-1",
                      showWorkspaceMenu
                        ? "bg-neon-purple/15 border-neon-purple/40 text-neon-purple shadow-[0_0_14px_rgba(192,132,252,0.22)]"
                        : "bg-surface-hover border-border-glass text-text-muted group-hover:bg-neon-purple/10 group-hover:border-neon-purple/25 group-hover:text-neon-purple"
                    )}
                    aria-hidden
                  >
                    <ChevronDown
                      className={cn(
                        "transition-transform duration-200 ease-out",
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
                        onAnimationComplete={scheduleFitWorkspaceName}
                        className="workspace-name-label workspace-header-name block w-full whitespace-nowrap text-center leading-tight"
                      />
                    </span>
                    <span className="workspace-header-name hidden md:block truncate text-left leading-tight">
                      {currentWorkspace.name}
                    </span>
                    {!isSingleOwnerWorkspace && (
                      <span className="hidden md:inline text-[9px] px-1 py-px rounded bg-surface-hover text-text-secondary font-mono tracking-widest shrink-0">
                        {formatRoleLabel(currentWorkspace.role)}
                      </span>
                    )}
                  </span>
                </button>

                <AnimatePresence>
                  {showWorkspaceMenu && (
                    <div className="workspace-menu-panel absolute top-full left-0 right-0 md:right-auto mt-2 top-bar-menu-panel glass rounded-2xl py-2 w-full md:w-[28rem] shadow-xl z-50 border border-border-glass">
                      {workspaces.map((ws) => {
                        const accessLabel = workspaceAccessLabel(
                          ws.id,
                          ws.role,
                          globalWorkspaceStats?.[ws.id]?.memberCount,
                          currentWorkspace.id,
                          members.length
                        );
                        return (
                          <button
                            key={ws.id}
                            onClick={() => {
                              switchWorkspace(ws.id);
                              setShowWorkspaceMenu(false);
                            }}
                            className={cn(
                              "workspace-menu-item w-full text-left px-4 py-3 md:py-2 hover:bg-surface-hover flex justify-between items-center gap-3",
                              ws.id === currentWorkspace.id &&
                                "workspace-menu-item--active text-neon-purple"
                            )}
                          >
                            <span className="flex items-center gap-2 min-w-0 flex-1">
                              <span className="workspace-menu-item__name truncate">{ws.name}</span>
                              <span
                                className={cn(
                                  "md:hidden text-[9px] px-1.5 py-px rounded shrink-0 font-semibold uppercase tracking-wide",
                                  accessLabel === "Private"
                                    ? "bg-surface-hover text-text-muted"
                                    : "bg-surface-hover text-text-secondary"
                                )}
                              >
                                {accessLabel}
                              </span>
                              <span className="hidden md:inline text-[10px] px-1.5 py-px rounded bg-surface-hover text-text-muted font-mono tracking-widest shrink-0">
                                {accessLabel}
                              </span>
                            </span>
                            {ws.id === currentWorkspace.id && (
                              <Check className="h-4 w-4 shrink-0" aria-hidden />
                            )}
                          </button>
                        );
                      })}
                      <div className="border-t border-border-glass my-1" />

                      {/* Production workspace creation (real DB via RPC when LIVE; role=owner on create). Inline for zero-friction multi-ws. */}
                      {!isCreatingWorkspace ? (
                        <button
                          onClick={() => {
                            setIsCreatingWorkspace(true);
                            setNewWorkspaceName("");
                          }}
                          className="w-full text-left px-4 py-2 text-xs text-neon-purple hover:bg-surface-hover flex items-center gap-2"
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
                            className="w-full bg-bg border border-border-glass rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-neon-purple/60 mb-2"
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
                              className="flex-1 text-xs py-1.5 rounded-lg border border-border-glass hover:bg-surface-hover"
                            >
                              Cancel
                            </button>
                          </div>
                          <div className="text-[10px] text-text-muted mt-1.5 px-1">
                            {isSupabaseConfigured()
                              ? "Saved to your Supabase account"
                              : "Demo only (local)"}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </AnimatePresence>
              </div>

              {currentView === "home" && user && (
                <div className="top-bar-greeting hidden md:flex items-center min-w-0 flex-1 justify-end">
                  <span className="text-lg lg:text-xl font-semibold tracking-tight truncate text-text-primary">
                    {getGreeting()}
                    {homeUserDisplayName ? `, ${homeUserDisplayName}` : ""}
                  </span>
                </div>
              )}
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
                  }
                }}
                className="btn btn-ghost h-11 w-11 min-h-[44px] min-w-[44px] p-0 flex items-center justify-center rounded-full hover:bg-surface-hover border border-border-glass relative transition"
                title="Notifications"
                aria-label="Notifications"
              >
                <Bell className="h-4 w-4" />
                {unreadNotifCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-[var(--priority-p0)] text-[10px] font-mono text-accent-on flex items-center justify-center ring-1 ring-bg">
                    {unreadNotifCount > 9 ? "9+" : unreadNotifCount}
                  </span>
                )}
              </button>
              <AnimatePresence>
                {showNotifications && (
                  <>
                    <motion.div
                      key="notifications-backdrop"
                      className="fixed inset-0 z-[255] overlay-scrim md:bg-surface-elevated"
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
                      className="notifications-panel md:!absolute md:!right-0 md:!top-12 md:!left-auto md:!w-80 md:max-w-[min(20rem,calc(100vw-2rem))] md:glass-strong md:rounded-2xl md:border md:border-border-glass md:shadow-2xl z-[260] overflow-hidden bg-bg-secondary"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="notifications-panel__header px-4 py-3 border-b border-border-glass flex items-center justify-between bg-bg">
                        <div className="font-semibold text-sm tracking-tight flex items-center gap-2">
                          <Bell className="h-4 w-4" /> Notifications
                        </div>
                        <div className="flex items-center gap-2">
                          {unreadNotifCount > 0 && (
                            <button
                              onClick={() => markAllNotifsRead?.()}
                              className="text-[10px] px-2 py-0.5 rounded bg-surface-elevated hover:bg-surface-elevated text-neon-purple"
                            >
                              Mark all read
                            </button>
                          )}
                          {notifications.length > 0 && (
                            <button
                              onClick={() => setPendingClearNotifications(true)}
                              className="text-[10px] px-2 py-0.5 rounded bg-surface-elevated hover:bg-surface-elevated text-red-400 hover:text-red-500"
                            >
                              Clear all
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setShowNotifications(false)}
                            className="text-xs font-semibold px-2.5 py-1 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-hover transition shrink-0"
                          >
                            Close
                          </button>
                        </div>
                      </div>
                      <div className="notifications-panel__list max-h-[320px] overflow-auto p-1 text-sm">
                        {isLoadingNotifications ? (
                          <div className="p-4 text-center text-text-muted text-xs">LoadingΓÇª</div>
                        ) : notifications.length === 0 ? (
                          <div className="p-6 text-center text-text-muted text-xs">
                            All clear. No notifications yet.
                            <br />
                            @mentions, comments &amp; invites will appear here.
                          </div>
                        ) : (
                          bellPanelNotifications.map((n: Notification) => (
                            <div
                              key={n.id}
                              onClick={() => {
                                if (isBellUnread(n)) markNotifRead?.(n.id);
                                setSelectedNotification(n);
                                setShowNotifications(false);
                              }}
                              className={cn(
                                "px-3 py-2.5 rounded-xl m-1 cursor-pointer border border-border-glass bg-bg-panel hover:bg-bg-tertiary flex gap-2 transition-colors",
                                isBellUnread(n) && "bg-neon-purple/10 border-neon-purple/30"
                              )}
                            >
                              <div className="mt-0.5 text-neon-purple/80 shrink-0">
                                {n.type === "mention" && <Zap className="h-3.5 w-3.5" />}
                                {n.type === "comment" && <Star className="h-3.5 w-3.5" />}
                                {n.type === "invite" && <Users className="h-3.5 w-3.5" />}
                                {n.type === "list_share" && <ListChecks className="h-3.5 w-3.5" />}
                                {n.type === "task_assigned" && <Check className="h-3.5 w-3.5" />}
                                {n.type === "deadline" && <Clock className="h-3.5 w-3.5" />}
                                {n.type === "activity" && <Zap className="h-3.5 w-3.5" />}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="font-medium text-xs truncate">{n.title}</div>
                                <div className="text-[11px] text-text-secondary line-clamp-2">
                                  {n.message}
                                </div>
                                {n.type === "list_share" && !n.readAt && (
                                  <div className="flex gap-1.5 mt-2">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const shareId = n.metadata?.list_share_id as
                                          | string
                                          | undefined;
                                        if (shareId) handleHomeAcceptListShare(shareId, n.link);
                                      }}
                                      className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-neon-purple/20 text-neon-purple hover:bg-neon-purple/30"
                                    >
                                      Accept
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const shareId = n.metadata?.list_share_id as
                                          | string
                                          | undefined;
                                        if (shareId) void handleHomeDeclineListShare(shareId);
                                      }}
                                      className="text-[10px] font-medium px-2 py-0.5 rounded-md border border-border-glass text-text-secondary hover:bg-surface-hover"
                                    >
                                      Decline
                                    </button>
                                  </div>
                                )}
                                <div className="text-[9px] text-text-muted mt-0.5">
                                  {new Date(n.createdAt).toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </div>
                              </div>
                              {isBellUnread(n) && (
                                <div className="w-1.5 h-1.5 mt-1.5 rounded-full bg-neon-purple shrink-0" />
                              )}
                              {n.type !== "invite" && n.type !== "list_share" && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    void handleDismissNotification(n.id);
                                  }}
                                  className="ml-1 p-1 text-text-muted hover:text-text-primary rounded hover:bg-surface-hover"
                                  aria-label="Remove notification"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                      <div className="notifications-panel__footer p-2 border-t border-border-glass bg-bg text-[10px] text-center text-text-muted">
                        {bellUnreadOverflow > 0
                          ? `+${bellUnreadOverflow} more unread not shown`
                          : "Timely • Non-intrusive • Powered by activity logs"}
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            {showWorkspaceChat && (
              <button
                type="button"
                onClick={() => {
                  setShowNotifications(false);
                  setShowProfilePopover(false);
                  toggleChat();
                }}
                className={cn(
                  "relative flex items-center justify-center h-11 w-11 min-h-[44px] min-w-[44px] rounded-full md:rounded-xl border transition",
                  chatOpen
                    ? "border-neon-purple/50 bg-neon-purple/10 text-neon-purple"
                    : "border-border-glass text-text-secondary hover:text-text-primary hover:border-neon-purple/40 hover:bg-surface-hover"
                )}
                title="Messages"
                aria-label={chatOpen ? "Collapse messages" : "Open messages"}
                aria-expanded={chatOpen}
              >
                <MessageCircle className="h-4 w-4" />
                {workspaceChat.hasUnread && !chatOpen && (
                  <span
                    className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-[var(--priority-p0)] ring-2 ring-bg"
                    aria-label="Unread messages"
                  />
                )}
              </button>
            )}

            {/* Polished Auth + User Area (Phase 1 UX track) */}
            <div ref={profilePopoverRef} className="relative">
              {isAuthLoading ? (
                <div className="flex items-center gap-2 rounded-full bg-surface-hover border border-border-glass px-3 py-1.5 text-xs text-text-muted">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-neon-purple" />
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
                        "profile-avatar-trigger group flex items-center justify-center min-h-[44px] min-w-[44px] cursor-pointer active:scale-[0.985] transition-all",
                        "p-0 rounded-full max-md:bg-transparent max-md:border-0",
                        "md:bg-surface-hover md:border md:p-1",
                        showProfilePopover
                          ? "md:border-neon-purple/40 md:bg-neon-purple/10 max-md:ring-2 max-md:ring-neon-purple/40"
                          : "md:border-border-glass md:hover:border-neon-purple/40"
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
                      <div className="profile-avatar-badge h-9 w-9 flex-shrink-0 rounded-full bg-gradient-to-br from-neon-purple to-neon-purple-dark flex items-center justify-center text-xs font-bold text-[var(--on-accent)] ring-1 ring-inset ring-white/30 shadow-sm">
                        {avatarInitials || <User className="h-4 w-4" />}
                      </div>
                    </div>
                  </div>

                  <AnimatePresence>
                    {showProfilePopover && user && !isMobileViewport && (
                      <motion.div
                        initial={{ opacity: 0, y: -6, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -6, scale: 0.98 }}
                        transition={{ duration: 0.15, ease: "easeOut" }}
                        className="profile-popover-panel absolute right-0 top-full mt-2 z-[260] w-[min(20rem,calc(100vw-1.5rem))] top-bar-menu-panel glass rounded-2xl border border-border-glass shadow-2xl overflow-hidden flex flex-col"
                        role="dialog"
                        aria-label="Your profile"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="profile-popover-panel__header shrink-0 px-3 py-2 border-b border-border-glass flex items-center justify-between gap-2">
                          <h2 className="font-semibold text-sm tracking-tight text-text-primary">
                            Your profile
                          </h2>
                          <button
                            type="button"
                            onClick={() => setShowProfilePopover(false)}
                            className="shrink-0 p-1 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-hover transition"
                            aria-label="Close profile editor"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                        {renderProfileEditorContent()}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </>
              ) : (
                <>
                  <button
                    onClick={() => router.push("/login")}
                    className="btn btn-secondary text-xs px-4 py-2 hidden md:flex items-center gap-1.5 min-h-[44px]"
                  >
                    <User className="h-3.5 w-3.5" /> Sign in
                  </button>
                  <button
                    onClick={() => router.push("/login")}
                    className="md:hidden min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border border-border-glass text-text-secondary hover:text-text-primary hover:border-neon-purple/40 transition"
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
                  triggerHaptic("light");
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
            {(syncDisplay.pendingSyncCount > 0 ||
              !syncDisplay.isOnline ||
              syncDisplay.isSyncing) && (
              <button
                onClick={async () => {
                  triggerHaptic("light");
                  if (syncPendingWrites) {
                    await syncPendingWrites();
                  } else if (refreshOfflineStatus) {
                    refreshOfflineStatus();
                  }
                  toast(
                    syncDisplay.isOnline
                      ? syncDisplay.pendingSyncCount > 0
                        ? "Syncing pending writes..."
                        : "Already in sync"
                      : "Offline — changes will queue",
                    {
                      description:
                        syncDisplay.pendingSyncCount > 0
                          ? `${syncDisplay.pendingSyncCount} operation${syncDisplay.pendingSyncCount === 1 ? "" : "s"} pending`
                          : undefined,
                    }
                  );
                }}
                className={cn(
                  "sync-indicator top-bar-sync-mobile text-[10px] px-2.5 py-1 active:scale-95 max-md:hidden md:hidden",
                  !syncDisplay.isOnline
                    ? "offline"
                    : syncDisplay.isSyncing
                      ? "syncing"
                      : syncDisplay.pendingSyncCount > 0
                        ? "offline"
                        : "online"
                )}
                title={
                  syncDisplay.isOnline ? `${syncDisplay.pendingSyncCount} pending` : "Offline mode"
                }
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

      <div className="flex flex-1 min-h-0 overflow-hidden">
        <CollapsibleSidebar
          currentView={
            currentView as
              | "home"
              | "tasks"
              | "notes"
              | "notebooks"
              | "meetings"
              | "lists"
              | "health"
              | "teams"
              | "settings"
              | "admin"
          }
          onNavigate={(view) => setView(view as typeof currentView)}
          workspace={currentWorkspace}
          openTaskCount={currentWorkspaceTaskCounts.openCount}
          overdueTaskCount={currentWorkspaceTaskCounts.overdueCount}
          reviewCount={pendingReviewCount}
          isSiteAdmin={!!(isSiteAdmin && user)}
        />

        {/* Main Content — mobile gets extra pb via .main-content + globals.css for bottom nav. a11y: main landmark */}
        <main
          className={cn(
            "main-content relative flex-1 overflow-auto p-6 lg:p-8",
            pwaStandalone && isMobileViewport && "main-content--pwa-standalone"
          )}
        >
          {(pullDistance > 4 || isPullRefreshing) && (
            <div
              className={cn(
                "pull-to-refresh-indicator",
                (pullDistance > 4 || isPullRefreshing) && "visible",
                isPullRefreshing && "refreshing"
              )}
              style={{
                transform: `translateX(-50%) translateY(${Math.min(pullDistance * 0.6, 18)}px)`,
              }}
              aria-live="polite"
            >
              {isPullRefreshing ? (
                <>
                  <span className="spinner" /> Refreshing…
                </>
              ) : pullDistance > 52 ? (
                "Release to refresh"
              ) : (
                "Pull to refresh"
              )}
            </div>
          )}

          {/* Persistent received workspace invite banner (distinct from bell notifications).
             - Cannot be dismissed or marked read from here (only Accept/Decline removes it).
             - Shows full "Name (@username) invited you to join 'Workspace Name'".
             - Has direct Accept / Decline actions.
             - Stays visible across pages until action is taken.
          */}
          {user && pendingReceivedListShares.length > 0 && (
            <div className="home-global-list-share-banner mb-6 border border-neon-purple/50 bg-neon-purple/10 rounded-2xl p-5 flex flex-col gap-4">
              <div className="text-sm font-medium text-neon-purple">
                You have pending shared list{pendingReceivedListShares.length > 1 ? "s" : ""}.
              </div>

              <div className="space-y-3">
                {pendingReceivedListShares.slice(0, 2).map((n: Notification) => {
                  const meta = (n.metadata || {}) as Record<string, string | undefined>;
                  const sharerName = meta.shared_by_name || "Someone";
                  const listTitle = meta.list_title || "a list";
                  const wsName = meta.source_workspace_name || "a workspace";
                  return (
                    <div key={n.id} className="text-sm text-text-soft">
                      <span className="font-medium">{sharerName}</span> shared{" "}
                      <span className="font-semibold">&quot;{listTitle}&quot;</span> from{" "}
                      <span className="font-semibold">&quot;{wsName}&quot;</span>.
                    </div>
                  );
                })}
                {pendingReceivedListShares.length > 2 && (
                  <div className="text-xs text-text-secondary">
                    +{pendingReceivedListShares.length - 2} more
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => {
                    const first = pendingReceivedListShares[0];
                    const shareId = first?.metadata?.list_share_id as string | undefined;
                    if (shareId) handleHomeAcceptListShare(shareId, first?.link);
                  }}
                  className="btn btn-primary text-sm px-5 py-2"
                >
                  Accept
                </button>

                <button
                  onClick={async () => {
                    const first = pendingReceivedListShares[0];
                    const shareId = first?.metadata?.list_share_id as string | undefined;
                    if (shareId) {
                      await handleHomeDeclineListShare(shareId);
                    }
                  }}
                  className="px-4 py-2 text-sm rounded-xl border border-border-glass hover:bg-surface-hover text-text-secondary"
                >
                  Decline
                </button>
              </div>
            </div>
          )}

          {user && pendingReceivedInvites.length > 0 && (
            <div className="home-global-invite-banner mb-6 border border-neon-purple/50 bg-neon-purple/10 rounded-2xl p-5 flex flex-col gap-4">
              <div className="text-sm font-medium text-neon-purple">
                You have pending workspace invitation{pendingReceivedInvites.length > 1 ? "s" : ""}.
              </div>

              <div className="space-y-3">
                {pendingReceivedInvites.slice(0, 2).map((n: any) => {
                  const meta = n.metadata || {};
                  const fullName = meta.invited_by_full_name || meta.invited_by_name || "Someone";
                  const username = meta.invited_by_username
                    ? ` (@${meta.invited_by_username})`
                    : "";
                  const wsName = meta.workspace_name || "a workspace";
                  return (
                    <div key={n.id} className="text-sm text-text-soft">
                      <span className="font-medium">{fullName}</span>
                      {username} invited you to join{" "}
                      <span className="font-semibold">"{wsName}"</span>.
                    </div>
                  );
                })}
                {pendingReceivedInvites.length > 2 && (
                  <div className="text-xs text-text-secondary">
                    +{pendingReceivedInvites.length - 2} more
                  </div>
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
                  className="px-4 py-2 text-sm rounded-xl border border-border-glass hover:bg-surface-hover text-text-secondary"
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
              className="mb-6 rounded-2xl bg-bg-secondary border border-neon-purple/20 px-5 py-3 text-sm flex items-center gap-3"
            >
              <div className="text-neon-purple">⚠</div>
              <div className="flex-1 text-text-secondary">
                Demo mode — all data lives in your browser for now.
              </div>
              <button
                onClick={() => window.open("docs/MILESTONE-1-SUPABASE-ACTIVATION.md", "_blank")}
                className="text-xs underline text-neon-purple whitespace-nowrap"
              >
                Connect Supabase
              </button>
            </div>
          )}

          {currentViewComponent()}
        </main>

        {showWorkspaceChat && (
          <motion.aside
            className={cn(
              "workspace-chat-aside hidden xl:flex flex-col bg-bg min-h-0 overflow-hidden shrink-0",
              chatOpen && "border-l border-border-glass"
            )}
            initial={false}
            animate={{
              width: chatOpen ? 320 : 0,
              opacity: chatOpen ? 1 : 0,
            }}
            transition={{ type: "spring", stiffness: 400, damping: 38, mass: 0.85 }}
            aria-hidden={!chatOpen}
          >
            <div className="workspace-chat-panel-inner w-80 h-full p-4 flex flex-col min-h-0">
              <WorkspaceChatPanel
                workspaceId={currentWorkspace.id}
                workspaceName={currentWorkspace.name}
                userId={user?.id}
                members={members}
                chat={workspaceChat}
                onCollapse={closeChat}
              />
            </div>
          </motion.aside>
        )}
      </div>

      {/* Mobile Bottom Navigation — native iOS/Android style, only <md via CSS + md:hidden
          Reuses existing VIEWS + setView from store. No desktop impact. Touch-optimized via globals.css
      */}
      <nav
        className="bottom-nav md:hidden border-t border-border-glass"
        aria-label="Primary navigation"
      >
        <WorkspaceSwitchEffects workspaceId={currentWorkspace.id} variant="bottom-nav" />
        {bottomNavViews.map((v, navIndex) => {
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
                triggerHaptic("light");
                setView(v.id as any);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  triggerHaptic("light");
                  setView(v.id as any);
                }
              }}
              className={cn(
                "bottom-nav-item relative z-[1]",
                v.id === "home" && "bottom-nav-item--home",
                v.id === "lists" && "bottom-nav-item--lists",
                isActive && "active"
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
                  {v.id === "notes" && (
                    <FilesNavIndicator reviewCount={pendingReviewCount} variant="bottom" />
                  )}
                </span>
                <span className="bottom-nav-item__label font-medium tracking-tight">{label}</span>
              </AnimatedBottomNavItemContent>
            </div>
          );
        })}
      </nav>

      {showWorkspaceChat && (
        <ChatDrawer
          open={chatOpen}
          onClose={closeChat}
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
        onOpenTask={(task) => {
          const full = tasks.find((t) => t.id === task.id);
          if (full) openTask(full);
        }}
      />

      <CaptureFileModal
        isOpen={filesCaptureOpen}
        onClose={() => setFilesCaptureOpen(false)}
        workspaceTags={captureWorkspaceTags}
        isLive={isTrulyLive}
        onSubmit={handleCaptureFile}
        onCreateDraftNote={handleCreateCaptureDraft}
        onDeleteDraftNote={handleDeleteCaptureDraft}
        tasks={tasks}
        onCreateTaskAndLink={noteOps.onCreateTaskAndLink}
        onOpenTask={(taskId) => {
          const t = tasks.find((x) => x.id === taskId);
          if (t) openTask(t);
        }}
      />

      {/* Confetti on completions */}
      <Confetti trigger={celebrationTrigger} />

      {/* Supabase connection helper (self-gating; only renders in !live demo mode) */}
      <SupabaseSetupBanner />

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
                      homeTaskModalContext.taskId
                    ),
                }
              : undefined
          }
        />
      )}

      <ListDetailModal
        list={listDetailList}
        items={listDetailItems}
        isOpen={!!listDetailTarget && !!listDetailList}
        focusAddItemOnOpen={!!listDetailTarget?.discardIfEmpty}
        onClose={closeListDetail}
        onUpdateList={(id, updates) => {
          void updateList(id, updates);
        }}
        onDeleteList={(id) => {
          void deleteList(id);
          closeListDetail();
        }}
        onTogglePinned={(id) => {
          void toggleListPinned(id);
        }}
        onAddItem={(listId, text, options) =>
          addListItem(listId, text, options).then((item) => item?.id ?? null)
        }
        onToggleItem={(id) => {
          void handleToggleListItem(id);
        }}
        onCompleteItemFamily={(id) => {
          void handleCompleteListItemFamily(id);
        }}
        onUpdateItem={(id, text) => {
          void updateListItem(id, { text });
        }}
        onDeleteItem={(id) => {
          void deleteListItem(id);
        }}
        onIndentItem={(id) => {
          void indentListItem(id);
        }}
        onOutdentItem={(id) => {
          void outdentListItem(id);
        }}
        onNudgeListItem={nudgeListItem}
        onMoveItemToList={(itemId, targetListId) => {
          void moveListItemToList(itemId, targetListId);
        }}
        onClearCompleted={(listId) => {
          void clearCompletedListItems(listId);
        }}
        onSetListItemPending={(id, pending) => {
          void handleSetListItemPending(id, pending);
        }}
        onRestorePending={(listId) => {
          void restorePendingListItems(listId);
        }}
        onClearPending={(listId) => {
          void clearPendingListItems(listId);
        }}
      />

      {/* Note: rich detail is now inline inside renderNotesView() using TipTapEditor (legacy modal removed) */}

      {/* Profile menu — full mobile drawer, desktop popover in top bar */}
      <BottomSheet
        open={showProfilePopover && !!user && isMobileViewport}
        onClose={() => setShowProfilePopover(false)}
        title="Your profile"
        zIndex={260}
        panelClassName="glass modal-panel profile-popover-panel profile-popover-drawer"
        mobileLayout="sheet"
        showClose
        showDragHandle
        enableDragDismiss
        dragMode="handle"
      >
        {renderProfileEditorContent()}
      </BottomSheet>

      {/* Keyboard Cheatsheet - full mobile drawer, centered dialog on desktop */}
      <BottomSheet
        open={isKeyboardCheatsheetOpen}
        onClose={() => toggleKeyboardCheatsheet(false)}
        zIndex={110}
        showClose={false}
        showDragHandle
        enableDragDismiss
        dragMode="handle"
        desktopMaxWidth="max-w-[720px]"
        panelClassName="glass-strong modal-panel shadow-2xl"
        ariaLabel="Keyboard shortcuts"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-glass shrink-0">
          <div className="flex items-center gap-3">
            <div className="text-neon-purple">
              <Command className="h-5 w-5" />
            </div>
            <div>
              <div className="font-semibold tracking-tighter text-xl">Keyboard Shortcuts</div>
              <div className="text-xs text-text-muted">
                Master these. Move at the speed of thought.
              </div>
            </div>
          </div>
          <button
            onClick={() => toggleKeyboardCheatsheet(false)}
            className="text-text-muted hover:text-text-primary px-3 py-1 text-xs font-mono rounded bg-surface-hover hover:bg-surface-hover"
          >
            ESC
          </button>
        </div>

        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6 text-sm">
          {[
            {
              cat: "Global Power",
              items: [
                { key: "⌘K / Ctrl+K", desc: "Open / close Command Palette (your command center)" },
                { key: "?", desc: "Open this keyboard cheatsheet from anywhere" },
                { key: "⌘N / Ctrl+N", desc: "Focus task quick-add" },
                { key: "⌘⇧N / Ctrl+Shift+N", desc: "Open Capture file modal" },
                { key: "ESC", desc: "Close any modal, sheet, or selection" },
              ],
            },
            {
              cat: "Files",
              items: [
                { key: "⌘⇧N", desc: "Capture file (tags, notes, attachments)" },
                { key: "⌘K → Capture file", desc: "Same from command palette" },
                { key: "⌘K → Open Files Review", desc: "Jump to Review queue" },
              ],
            },
            {
              cat: "Navigation",
              items: [
                { key: "1", desc: "Go to All Tasks view" },
                { key: "2", desc: "Go to Files view" },
                { key: "3", desc: "Go to Lists view" },
                { key: "4", desc: "Go to Team" },
                { key: "5", desc: "Go to Workspace Settings" },
              ],
            },
            {
              cat: "Tasks & Action",
              items: [
                { key: "Space", desc: "Complete currently selected task (in list)" },
                { key: "Click row", desc: "Open full task detail modal" },
                { key: "ΓîÿN in palette", desc: "Create task directly from command palette" },
              ],
            },
            {
              cat: "Command Palette",
              items: [
                { key: "Γåæ Γåô", desc: "Navigate results inside palette" },
                { key: "Enter", desc: "Execute selected command or jump" },
                { key: "Type anything", desc: "Fuzzy search commands, workspaces, tasks, notes" },
                { key: "ESC", desc: "Close palette (or ? inside for this sheet)" },
              ],
            },
          ].map((section) => (
            <div key={section.cat}>
              <div className="uppercase tracking-[2px] text-[10px] font-semibold text-neon-purple mb-2.5">
                {section.cat}
              </div>
              <div className="space-y-1.5">
                {section.items.map((it, idx) => (
                  <div
                    key={idx}
                    className="flex justify-between items-baseline gap-4 py-0.5 text-text-soft"
                  >
                    <div className="font-mono text-xs bg-surface-hover px-2 py-px rounded text-neon-purple whitespace-nowrap">
                      {it.key}
                    </div>
                    <div className="text-right text-text-secondary text-[13px] leading-tight">
                      {it.desc}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="px-6 py-3.5 bg-black/30 text-[11px] text-text-muted border-t border-border-glass flex items-center justify-between shrink-0">
          <div>
            Pro tip: Open palette with ⌘K and type ΓÇ£workspaceΓÇ¥, ΓÇ£noteΓÇ¥, or a task name to
            jump instantly.
          </div>
          <div className="font-mono text-neon-purple">Badazz Tasks</div>
        </div>
      </BottomSheet>

      <ListShareAcceptModal
        open={!!pendingListShareAcceptId}
        shareId={pendingListShareAcceptId}
        onOpenChange={(open) => {
          if (!open) setPendingListShareAcceptId(null);
        }}
        onLoadWorkspaces={loadListShareWorkspaces}
        onAccept={acceptReceivedListShare}
        onAccepted={handleListShareAccepted}
      />

      <NotificationDetailModal
        notification={selectedNotification}
        onClose={() => setSelectedNotification(null)}
        onMarkRead={markNotifRead}
        onDismiss={handleDismissNotification}
        onViewChange={setView}
        onOpenNote={setSelectedNoteId}
        onAcceptListShare={(shareId) => {
          handleHomeAcceptListShare(shareId, selectedNotification?.link);
        }}
        onDeclineListShare={handleHomeDeclineListShare}
      />

      <ConfirmationModal
        open={!!pendingDeleteNote}
        onOpenChange={(open) => !open && setPendingDeleteNote(null)}
        title={pendingDeleteIsFile ? "Delete this file?" : "Delete this note?"}
        highlight={pendingDeleteNoteTitle}
        description={
          pendingDeleteIsFile
            ? "This file and its content will be permanently removed. Linked tasks will stay in your workspace."
            : "This note and its content will be permanently removed. Linked tasks will stay in your workspace."
        }
        confirmText={pendingDeleteIsFile ? "Delete file" : "Delete note"}
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

      <LoginActivityModal
        open={showLoginActivity}
        onOpenChange={setShowLoginActivity}
        enabled={isTrulyLive}
      />

      <ChangePasswordModal
        open={showChangePassword}
        onOpenChange={setShowChangePassword}
        enabled={isTrulyLive}
        user={user}
      />
    </div>
  );
}
