"use client";

import { useState, useEffect, useLayoutEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { MessageSquare, Trash2, Loader2, Pencil, Check } from "lucide-react";
import { WorkspaceItemDeepLink } from "./WorkspaceItemDeepLink";
import {
  getMemberDisplayName,
  getMemberMentionHandle,
  memberMatchesMentionQuery,
} from "@/lib/assignee";
import { CollapsibleSection } from "./CollapsibleSection";
import { ConfirmationModal } from "./ConfirmationModal";
import { SheetDragHandle } from "./SheetDragHandle";
import { toast } from "sonner";
import { safeFormatDate, safeFormatTimestampIso } from "@/lib/datetime";
import { motion, AnimatePresence } from "framer-motion";
import { useTaskStore } from "@/store/useTaskStore";
import type { Comment, Task, WorkspaceMember } from "@/types";
import { getCommentAuthorLabel } from "@/features/tasks/lib/taskCommentIndicators";
import { TaskModalScheduleFields } from "@/features/tasks/components/TaskModalScheduleFields";
import { TaskStarButton } from "@/features/tasks/components/TaskStarButton";

import { triggerHaptic } from "@/lib/utils";
import { useScrollLock } from "@/lib/hooks/useScrollLock";
import { useMobileSheetDrag } from "@/lib/hooks/useMobileSheetDrag";
import {
  cn,
  applyTaskUpdateSideEffects,
  defaultTaskDueDate,
} from "@/lib/utils";
import { MOBILE_SHEET_HEIGHT_90_CLASS } from "@/lib/motion/sheet";

interface TaskModalProps {
  task: Task;
  isOpen: boolean;
  onClose: () => void;
  /** Shown when opened from the Home hub for a cross-workspace preview */
  workspaceDeepLink?: {
    workspaceName: string;
    onNavigate: () => void;
  };
}

function cloneTaskSnapshot(task: Task): Task {
  return {
    ...task,
    tags: [...task.tags],
    linkedNoteIds: [...task.linkedNoteIds],
    assigneeIds: task.assigneeIds ? [...task.assigneeIds] : undefined,
    exceptionDates: task.exceptionDates ? [...task.exceptionDates] : undefined,
    starred: !!task.starred,
    folderId: task.folderId ?? null,
  };
}

function taskRevertPatch(original: Task): Partial<Task> {
  return {
    title: original.title,
    description: original.description,
    dueDate: original.dueDate ?? null,
    assigneeIds: original.assigneeIds ? [...original.assigneeIds] : [],
    assignee: original.assignee,
    recurringRule: original.recurringRule ?? null,
    exceptionDates: original.exceptionDates,
    linkedNoteIds: [...(original.linkedNoteIds || [])],
    starred: !!original.starred,
    folderId: original.folderId ?? null,
  };
}

function taskHasUnsavedChanges(current: Task, original: Task | null): boolean {
  if (!original) return false;
  if (current.title !== original.title) return true;
  if (current.description !== original.description) return true;
  if ((current.dueDate ?? null) !== (original.dueDate ?? null)) return true;
  if ((current.recurringRule ?? null) !== (original.recurringRule ?? null)) return true;
  if ((current.assignee ?? "") !== (original.assignee ?? "")) return true;
  if (JSON.stringify(current.assigneeIds ?? []) !== JSON.stringify(original.assigneeIds ?? [])) {
    return true;
  }
  if (JSON.stringify(current.exceptionDates ?? []) !== JSON.stringify(original.exceptionDates ?? [])) {
    return true;
  }
  if (JSON.stringify(current.linkedNoteIds ?? []) !== JSON.stringify(original.linkedNoteIds ?? [])) {
    return true;
  }
  if (!!current.starred !== !!original.starred) return true;
  if ((current.folderId ?? null) !== (original.folderId ?? null)) return true;
  return false;
}

function isCommentAuthor(comment: Comment, currentUserId?: string | null) {
  const ownerId = currentUserId || "me";
  return comment.userId === ownerId;
}

function renderCommentContent(content: string) {
  return content.split(/(@\w+)/g).map((part: string, i: number) =>
    part.startsWith("@") ? (
      <span key={i} className="mention-pill">
        {part}
      </span>
    ) : (
      part
    ),
  );
}

function TaskMentionSuggestions({
  comment,
  members,
  currentUserId,
  onSelect,
}: {
  comment: string;
  members: WorkspaceMember[];
  currentUserId?: string | null;
  onSelect: (handle: string) => void;
}) {
  if (!comment.includes("@")) return null;

  const query = comment.split("@").pop() || "";
  if (!query.trim()) return null;

  const suggestions = members
    .filter((member) => memberMatchesMentionQuery(member, query, currentUserId ?? undefined))
    .slice(0, 6);

  if (suggestions.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {suggestions.map((member) => {
        const label = getMemberDisplayName(member, currentUserId ?? undefined);
        const handle = getMemberMentionHandle(member);
        return (
          <button
            key={member.userId}
            type="button"
            onClick={() => onSelect(handle)}
            className="mention-pill text-xs px-2.5 py-1 rounded-lg bg-neon-purple/10 text-neon-purple border border-neon-purple/30 hover:bg-neon-purple/25 min-h-[28px]"
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

function insertMention(comment: string, handle: string): string {
  const atIndex = comment.lastIndexOf("@");
  if (atIndex < 0) return `${comment}@${handle} `;
  return `${comment.slice(0, atIndex)}@${handle} `;
}

function TaskCommentCard({
  comment,
  currentUserId,
  isEditing,
  editDraft,
  isBusy,
  onEditDraftChange,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
  members = [],
  compact = false,
}: {
  comment: Comment;
  members?: WorkspaceMember[];
  currentUserId?: string | null;
  isEditing: boolean;
  editDraft: string;
  isBusy: boolean;
  onEditDraftChange: (value: string) => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onDelete: () => void;
  compact?: boolean;
}) {
  const canManage = isCommentAuthor(comment, currentUserId);
  const edited =
    comment.updatedAt &&
    new Date(comment.updatedAt).getTime() > new Date(comment.createdAt).getTime() + 1000;

  return (
    <div
      className={cn(
        "glass border border-border-glass",
        compact ? "rounded-lg px-2 py-1.5 text-sm" : "rounded-xl p-3 text-sm",
      )}
    >
      <div
        className={cn(
          "flex items-center w-full min-w-0",
          compact ? "gap-1 mb-0.5" : "items-start justify-between gap-2 mb-1",
        )}
      >
        <div
          className={cn(
            "flex items-center text-[10px] text-text-secondary min-w-0",
            compact ? "flex-1 gap-1 overflow-hidden" : "flex-wrap gap-2",
          )}
        >
          <span className={cn("font-medium text-neon-purple", compact ? "truncate min-w-0" : undefined)}>
            {getCommentAuthorLabel(comment, members)}
          </span>
          <span className="shrink-0">•</span>
          <span className="shrink-0 tabular-nums whitespace-nowrap">
            {new Date(comment.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
          {edited && <span className="text-text-muted shrink-0">(edited)</span>}
        </div>
        {canManage && !isEditing && (
          <div className={cn("flex items-center shrink-0", compact ? "gap-0 ml-auto" : "gap-0.5")}>
            <button
              type="button"
              onClick={onStartEdit}
              disabled={isBusy}
              className={cn(
                "rounded-lg flex items-center justify-center text-text-secondary hover:text-neon-purple hover:bg-surface-hover disabled:opacity-50",
                compact ? "h-7 w-7" : "h-8 w-8",
              )}
              aria-label="Edit comment"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={onDelete}
              disabled={isBusy}
              className={cn(
                "rounded-lg flex items-center justify-center text-text-secondary hover:text-red-400 hover:bg-red-500/10 disabled:opacity-50",
                compact ? "h-7 w-7" : "h-8 w-8",
              )}
              aria-label="Delete comment"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {isEditing ? (
        <div className="space-y-2">
          <textarea
            value={editDraft}
            onChange={(e) => onEditDraftChange(e.target.value)}
            className={cn(
              "input w-full p-3 text-sm resize-y outline-none",
              compact ? "min-h-[72px]" : "min-h-[80px]",
            )}
            rows={compact ? 3 : 4}
            autoFocus
            disabled={isBusy}
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onSaveEdit}
              disabled={isBusy || !editDraft.trim()}
              className="btn btn-primary text-xs px-3 py-1.5 min-h-[36px] disabled:opacity-50 flex items-center gap-1"
            >
              {isBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
              Save
            </button>
            <button
              type="button"
              onClick={onCancelEdit}
              disabled={isBusy}
              className="btn btn-secondary text-xs px-3 py-1.5 min-h-[36px] disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div
          className={cn(
            "text-text-primary whitespace-pre-wrap",
            compact ? "text-[13px] leading-snug" : "text-sm",
          )}
        >
          {renderCommentContent(comment.content)}
        </div>
      )}
    </div>
  );
}

export function TaskModal({ task, isOpen, onClose, workspaceDeepLink }: TaskModalProps) {
  const { 
    updateTask, deleteTask, taskLoadingStates, 
    comments, isLoadingComments, fetchComments, addComment, updateComment, deleteComment, markTaskCommentsRead, addTask,
    activeConflicts, resolveConflict, members,
    liveEditing, broadcastLiveTaskEdit, user,
    setView, setFilesSelectNoteId,
  } = useTaskStore();
  const [localTask, setLocalTask] = useState(task);
  const [newComment, setNewComment] = useState("");
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentDraft, setEditingCommentDraft] = useState("");
  const [commentActionId, setCommentActionId] = useState<string | null>(null);
  const [pendingDeleteCommentId, setPendingDeleteCommentId] = useState<string | null>(null);

  // Live collab: debounce refs for broadcasting while typing (lightweight, no extra deps)
  const liveBroadcastTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastBroadcastRef = useRef<{ title?: string; description?: string }>({});

  // Mobile bottom sheet detection + drag state (additive, only affects <768px)
  const [mounted] = useState(() => typeof window !== "undefined");
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.innerWidth < 768,
  );
  const mobileTitleRef = useRef<HTMLTextAreaElement>(null);
  const taskScrollRef = useRef<HTMLDivElement>(null);
  const taskPanelRef = useRef<HTMLDivElement>(null);
  const taskSheetOpenedRef = useRef(false);
  const openedTaskSnapshotRef = useRef<Task | null>(null);
  const prevIsOpenRef = useRef(false);

  const resizeMobileTitle = useCallback(() => {
    const el = mobileTitleRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  // State for the modern delete confirmation modal (house-cleaning item)
  const [pendingDeleteTask, setPendingDeleteTask] = useState(false);
  const [showUnsavedConfirm, setShowUnsavedConfirm] = useState(false);
  const [recurrenceEndIncomplete, setRecurrenceEndIncomplete] = useState(false);

  // Debounced live broadcast helper (250ms feels very live without spamming)
  const scheduleLiveBroadcast = (updates: { title?: string; description?: string }) => {
    if (!broadcastLiveTaskEdit) return;

    // Merge with last known values so we always send a coherent snapshot
    const next = {
      title: updates.title ?? lastBroadcastRef.current.title,
      description: updates.description ?? lastBroadcastRef.current.description,
    };
    lastBroadcastRef.current = next;

    if (liveBroadcastTimeoutRef.current) {
      clearTimeout(liveBroadcastTimeoutRef.current);
    }

    liveBroadcastTimeoutRef.current = setTimeout(() => {
      broadcastLiveTaskEdit(task.id, next);
    }, 250);
  };

  useEffect(() => {
    const checkMobile = () => setIsMobile(typeof window !== 'undefined' && window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Haptic on open for native confirmation feel (mobile)
  useEffect(() => {
    if (isOpen && isMobile) {
      triggerHaptic('light');
    }
  }, [isOpen, isMobile]);

  useScrollLock(isOpen);

  // Cleanup any pending live broadcast debounce when modal closes
  useEffect(() => {
    if (!isOpen) {
      if (liveBroadcastTimeoutRef.current) {
        clearTimeout(liveBroadcastTimeoutRef.current);
        liveBroadcastTimeoutRef.current = null;
      }
      lastBroadcastRef.current = {};
      setEditingCommentId(null);
      setEditingCommentDraft("");
      setCommentActionId(null);
      setPendingDeleteCommentId(null);
      setShowUnsavedConfirm(false);
      setRecurrenceEndIncomplete(false);
    }
  }, [isOpen]);

  // Agent 14: fetch comments realtime-backed when modal opens for task (optimistic + live via hybrid)
  useEffect(() => {
    if (isOpen && task?.id) {
      void fetchComments({ taskId: task.id }).then(() => {
        markTaskCommentsRead(task.id);
      });
    }
  }, [isOpen, task?.id, fetchComments, markTaskCommentsRead]);

  // Snapshot task when the drawer opens so Cancel can revert edits
  useEffect(() => {
    if (!isOpen) {
      openedTaskSnapshotRef.current = null;
      prevIsOpenRef.current = false;
      return;
    }

    const justOpened = !prevIsOpenRef.current;
    const switchedTask = openedTaskSnapshotRef.current?.id !== task.id;
    if (justOpened || switchedTask) {
      let nextTask = task;
      if (!task.dueDate && task.status !== "done") {
        const todayDue = defaultTaskDueDate();
        nextTask = { ...task, dueDate: todayDue };
        void updateTask(task.id, { dueDate: todayDue });
      }
      openedTaskSnapshotRef.current = cloneTaskSnapshot(nextTask);
      setLocalTask(nextTask);
    }
    prevIsOpenRef.current = isOpen;
  }, [isOpen, task, task.id, updateTask]);

  useEffect(() => {
    if (!isOpen || !isMobile) return;
    requestAnimationFrame(resizeMobileTitle);
  }, [isOpen, isMobile, localTask.title, resizeMobileTitle]);

  const taskComments = [...comments]
    .filter((c: { taskId?: string }) => c.taskId === task.id)
    .sort(
      (a: { createdAt: string }, b: { createdAt: string }) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

  const startEditingComment = (comment: Comment) => {
    setEditingCommentId(comment.id);
    setEditingCommentDraft(comment.content);
  };

  const cancelEditingComment = () => {
    setEditingCommentId(null);
    setEditingCommentDraft("");
  };

  const saveEditingComment = async () => {
    if (!editingCommentId || !editingCommentDraft.trim()) return;
    setCommentActionId(editingCommentId);
    const ok = await updateComment(editingCommentId, editingCommentDraft);
    setCommentActionId(null);
    if (ok) cancelEditingComment();
  };

  const requestDeleteComment = (commentId: string) => {
    triggerHaptic("light");
    setPendingDeleteCommentId(commentId);
  };

  const handleConfirmDeleteComment = async () => {
    if (!pendingDeleteCommentId) return;
    triggerHaptic("error");
    setCommentActionId(pendingDeleteCommentId);
    const ok = await deleteComment(pendingDeleteCommentId);
    setCommentActionId(null);
    if (ok) {
      if (editingCommentId === pendingDeleteCommentId) cancelEditingComment();
      setPendingDeleteCommentId(null);
    }
  };

  const pendingDeleteComment = pendingDeleteCommentId
    ? taskComments.find((c) => c.id === pendingDeleteCommentId)
    : null;

  const pendingDeleteCommentPreview = pendingDeleteComment
    ? pendingDeleteComment.content.replace(/\s+/g, " ").trim().slice(0, 120) +
      (pendingDeleteComment.content.trim().length > 120 ? "…" : "")
    : undefined;

  const save = async (updates: Partial<Task>) => {
    triggerHaptic('light');
    const normalized = applyTaskUpdateSideEffects(updates);
    if (
      Object.prototype.hasOwnProperty.call(normalized, "recurringRule") &&
      (normalized.recurringRule === null || normalized.recurringRule === undefined)
    ) {
      normalized.recurringRule = null;
      if (!Object.prototype.hasOwnProperty.call(normalized, "exceptionDates")) {
        normalized.exceptionDates = undefined;
      }
    }
    const newTask = { ...localTask, ...normalized };
    if (
      Object.prototype.hasOwnProperty.call(normalized, "dueDate") &&
      (normalized.dueDate === undefined || normalized.dueDate === null)
    ) {
      delete (newTask as Task).dueDate;
    }
    if (normalized.recurringRule === null) {
      delete (newTask as Task).recurringRule;
      if (normalized.exceptionDates === undefined) {
        delete (newTask as Task).exceptionDates;
      }
    }
    if (
      Object.prototype.hasOwnProperty.call(normalized, "completedAt") &&
      (normalized.completedAt === undefined || normalized.completedAt === null)
    ) {
      delete (newTask as Task).completedAt;
    }
    if (newTask.status !== "done") {
      delete (newTask as Task).completedAt;
    }
    if (
      Object.prototype.hasOwnProperty.call(normalized, "folderId") &&
      (normalized.folderId === undefined || normalized.folderId === null)
    ) {
      delete (newTask as Task).folderId;
    }
    setLocalTask(newTask);
    // Silent: avoid taskLoadingStates flicker on Save/Cancel while tuning recurrence, due, etc.
    // Keep openedTaskSnapshotRef at session-open values so Cancel / discard can revert.
    await updateTask(task.id, normalized, { silent: true });

    // Live collab: title/description only (due date etc. persist via DB + postgres_changes)
    if ("title" in updates || "description" in updates) {
      scheduleLiveBroadcast(updates);
    }
  };

  const handleDelete = async () => {
    triggerHaptic('error');
    setPendingDeleteTask(true); // Use modern modal
  };

  const handleConfirmDeleteTask = async () => {
    await deleteTask(task.id);
    setPendingDeleteTask(false);
    onClose();
  };

  const clearPendingLiveBroadcast = useCallback(() => {
    if (liveBroadcastTimeoutRef.current) {
      clearTimeout(liveBroadcastTimeoutRef.current);
      liveBroadcastTimeoutRef.current = null;
    }
    lastBroadcastRef.current = {};
  }, []);

  const blockCloseForIncompleteEnd = useCallback(() => {
    triggerHaptic("error");
    toast.info("Choose an end date", {
      description:
        "Until date needs a last day before you can close. Or pick Forever / After times.",
    });
  }, []);

  const finishClose = useCallback(() => {
    triggerHaptic("light");
    if (liveBroadcastTimeoutRef.current) {
      clearTimeout(liveBroadcastTimeoutRef.current);
      liveBroadcastTimeoutRef.current = null;
      if (broadcastLiveTaskEdit && lastBroadcastRef.current) {
        broadcastLiveTaskEdit(task.id, lastBroadcastRef.current);
      }
    }
    lastBroadcastRef.current = {};
    setShowUnsavedConfirm(false);
    onClose();
  }, [broadcastLiveTaskEdit, onClose, task.id]);

  const {
    sheetY,
    backdropOpacityMotion,
    isDragging,
    requestDismiss,
    animateEnter,
    setDismissTarget,
    resetDrag,
    startDrag,
    attachScrollDismiss,
  } = useMobileSheetDrag({
    enabled: isMobile && isOpen,
    onDismiss: finishClose,
    dragMode: "handle",
    dragEngine: "manual",
  });

  // Keep edits (already autosaved) and close
  const handleSheetClose = useCallback(() => {
    if (recurrenceEndIncomplete) {
      blockCloseForIncompleteEnd();
      return;
    }
    if (isMobile) {
      requestDismiss();
      return;
    }
    finishClose();
  }, [
    blockCloseForIncompleteEnd,
    finishClose,
    isMobile,
    recurrenceEndIncomplete,
    requestDismiss,
  ]);

  // Revert all edits made this session and close
  const handleCancel = useCallback(async () => {
    triggerHaptic("light");
    clearPendingLiveBroadcast();
    setShowUnsavedConfirm(false);
    setRecurrenceEndIncomplete(false);

    const original = openedTaskSnapshotRef.current;
    if (original) {
      setLocalTask(original);
      await updateTask(task.id, taskRevertPatch(original), { silent: true });
    }
    onClose();
  }, [clearPendingLiveBroadcast, onClose, task.id, updateTask]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (showUnsavedConfirm) {
        e.stopImmediatePropagation();
        setShowUnsavedConfirm(false);
        return;
      }
      if (pendingDeleteCommentId) {
        e.stopImmediatePropagation();
        setPendingDeleteCommentId(null);
        return;
      }
      const nestedDialogs = Array.from(
        document.querySelectorAll('[role="dialog"][aria-modal="true"]'),
      ).filter((el) => el !== taskPanelRef.current && !taskPanelRef.current?.contains(el));
      if (nestedDialogs.length > 0) return;
      e.stopImmediatePropagation();
      handleSheetClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleSheetClose, isOpen, showUnsavedConfirm, pendingDeleteCommentId]);

  useLayoutEffect(() => {
    if (!isOpen || !isMobile) {
      taskSheetOpenedRef.current = false;
      return;
    }
    const height = taskPanelRef.current?.offsetHeight ?? window.innerHeight;
    setDismissTarget(height);
    if (!taskSheetOpenedRef.current) {
      taskSheetOpenedRef.current = true;
      animateEnter();
    }
  }, [isOpen, isMobile, animateEnter, setDismissTarget]);

  useLayoutEffect(() => {
    if (!isOpen || !isMobile) return;
    return attachScrollDismiss(taskScrollRef.current, {
      getScrollEl: () => taskScrollRef.current,
      scrollGateSelector: ".task-sheet-scroll",
    });
  }, [attachScrollDismiss, isOpen, isMobile]);

  if (!mounted) return null;

  return createPortal(
    <>
      <AnimatePresence onExitComplete={resetDrag}>
      {isOpen && (
      <div
        className={cn(
          "fixed inset-0 z-[200]",
          isMobile ? "flex flex-col justify-end" : "flex items-center justify-center p-4"
        )}
      >
        <motion.div
          key="task-sheet-backdrop"
          className={cn("absolute inset-0", isMobile ? "sheet-backdrop" : "overlay-scrim")}
          initial={isMobile ? false : { opacity: 0 }}
          animate={isMobile ? undefined : { opacity: 1 }}
          style={isMobile ? { opacity: backdropOpacityMotion } : undefined}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          onClick={handleSheetClose}
          aria-hidden="true"
        />
        <motion.div
          ref={taskPanelRef}
          key="task-sheet-panel"
          className={cn(
            "task-detail-modal glass modal-panel w-full overflow-hidden flex flex-col",
            isMobile
              ? cn(
                  "task-drawer-sheet mobile-bottom-sheet mobile-bottom-sheet--90 relative flex flex-col rounded-t-3xl max-w-none",
                  MOBILE_SHEET_HEIGHT_90_CLASS,
                  isDragging && "bottom-sheet-panel--dragging",
                )
              : // Fixed desktop size so expanding Repeat / comments doesn't resize the shell
                "relative w-full max-w-5xl h-[min(92vh,880px)] rounded-2xl"
          )}
          onClick={e => e.stopPropagation()}
          initial={isMobile ? { opacity: 0.98 } : { scale: 0.96, opacity: 0 }}
          animate={isMobile ? { opacity: 1 } : { scale: 1, opacity: 1 }}
          exit={isMobile ? { opacity: 0 } : { scale: 0.96, opacity: 0 }}
          style={isMobile ? { y: sheetY, touchAction: "pan-y" } : undefined}
          role="dialog"
          aria-modal="true"
          aria-label={`Task: ${localTask.title}`}
        >
          {isMobile && <SheetDragHandle onPointerDown={startDrag} />}

          {/* Header — Revert restores the opening snapshot; Done keeps autosaved edits */}
          <div
            className={cn(
              "shrink-0 flex items-center border-b border-border-glass w-full",
              isMobile ? "task-sheet-header px-4 py-3 gap-2" : "px-5 py-3 gap-2",
            )}
          >
            <div className="flex items-center justify-between gap-3 w-full">
              {taskHasUnsavedChanges(localTask, openedTaskSnapshotRef.current) ? (
                <button
                  type="button"
                  onClick={() => setShowUnsavedConfirm(true)}
                  className="text-sm font-medium text-text-secondary hover:text-text-primary min-h-[44px] px-1 active:scale-[0.98] transition"
                  aria-label="Revert changes"
                >
                  Revert
                </button>
              ) : (
                <div aria-hidden="true" />
              )}
              <div className="flex items-center gap-1.5">
                <TaskStarButton
                  starred={!!localTask.starred}
                  onToggle={() => save({ starred: !localTask.starred })}
                />
                <button
                  type="button"
                  onClick={handleDelete}
                  className="task-modal-delete-icon-btn inline-flex shrink-0 items-center justify-center h-9 w-9 min-h-[44px] min-w-[44px] md:min-h-9 md:min-w-9 rounded-lg border transition active:scale-[0.98]"
                  aria-label="Delete task"
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={handleSheetClose}
                  className="btn btn-primary text-sm px-4 py-2 min-h-[44px] flex items-center gap-1.5 active:scale-[0.98]"
                  aria-label="Done"
                >
                  Done
                </button>
              </div>
            </div>
          </div>

        <div
          ref={taskScrollRef}
          className={cn(
            "task-sheet-scroll flex-1 min-h-0 overscroll-contain",
            isMobile ? "overflow-y-auto" : "overflow-hidden flex flex-col",
          )}
        >
        {isMobile ? (
        <div className="task-sheet-body p-4 space-y-4">
          {workspaceDeepLink && (
            <WorkspaceItemDeepLink
              workspaceName={workspaceDeepLink.workspaceName}
              destination="Tasks"
              onNavigate={workspaceDeepLink.onNavigate}
              className="inline-flex items-center gap-1.5 text-xs text-neon-purple hover:text-neon-purple-tint transition w-full text-left group"
            />
          )}

          <textarea
            ref={mobileTitleRef}
            value={localTask.title}
            onChange={(e) => {
              const title = e.target.value.replace(/\r?\n/g, " ");
              save({ title });
              e.target.style.height = "auto";
              e.target.style.height = `${e.target.scrollHeight}px`;
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.preventDefault();
            }}
            rows={1}
            className="w-full bg-transparent text-xl font-semibold tracking-tight outline-none resize-none overflow-hidden leading-snug"
          />

          {liveEditing?.[localTask.id] && liveEditing[localTask.id].userId !== (user?.id || "me") && (
            <div className="text-[10px] text-emerald-400/80 flex items-center gap-1.5 -mt-2">
              <span className="inline-block w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
              {liveEditing[localTask.id].email?.split("@")[0] || "Someone"} is typing…
            </div>
          )}

          {activeConflicts && activeConflicts[localTask.id] && (
            <div className="glass px-3 py-2 rounded-xl border border-amber-500/40 text-amber-400 text-xs flex flex-wrap items-center gap-2">
              <span>Conflict with {activeConflicts[localTask.id].remoteUser || "teammate"}</span>
              <button onClick={() => resolveConflict(localTask.id, false)} className="px-2 py-0.5 bg-surface-hover rounded text-[10px]">Theirs</button>
              <button onClick={() => resolveConflict(localTask.id, true)} className="px-2 py-0.5 bg-surface-hover rounded text-[10px]">Mine</button>
            </div>
          )}

          <textarea
            value={localTask.description}
            onChange={(e) => save({ description: e.target.value })}
            placeholder="Add notes…"
            className="input w-full min-h-[64px] max-h-[120px] p-3 text-sm resize-y outline-none"
            rows={2}
          />

          <div className="grid grid-cols-1 gap-3">
            <TaskModalScheduleFields
              localTask={localTask}
              save={save}
              members={members || []}
              currentUserId={user?.id}
              disabled={!!taskLoadingStates?.[task.id]}
              onEndIncompleteChange={setRecurrenceEndIncomplete}
              onOpenLinkedNote={(noteId) => {
                onClose();
                setFilesSelectNoteId(noteId);
                setView("notes");
              }}
            />
          </div>

          <CollapsibleSection
            title="Comments"
            icon={MessageSquare}
            badge={String(taskComments.length)}
            defaultOpen={taskComments.length > 0}
          >
            <div className="space-y-2 min-w-0">
              <div className="space-y-1.5 max-h-40 overflow-y-auto overflow-x-hidden pr-1">
                {taskComments.length === 0 ? (
                  <div className="text-xs text-text-muted">No comments yet.</div>
                ) : (
                  taskComments.map((c) => (
                    <TaskCommentCard
                      key={c.id}
                      comment={c}
                      members={members || []}
                      currentUserId={user?.id}
                      isEditing={editingCommentId === c.id}
                      editDraft={editingCommentId === c.id ? editingCommentDraft : c.content}
                      isBusy={commentActionId === c.id}
                      onEditDraftChange={setEditingCommentDraft}
                      onStartEdit={() => startEditingComment(c)}
                      onCancelEdit={cancelEditingComment}
                      onSaveEdit={() => void saveEditingComment()}
                      onDelete={() => requestDeleteComment(c.id)}
                      compact
                    />
                  ))
                )}
              </div>

              <div className="flex flex-col gap-1.5 min-w-0">
                <input
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      if (newComment.trim()) {
                        addComment(newComment, { taskId: task.id });
                        setNewComment("");
                      }
                    }
                  }}
                  placeholder="Add a comment…"
                  className="input w-full min-w-0 text-sm px-3 py-2"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (newComment.trim()) {
                      addComment(newComment, { taskId: task.id });
                      setNewComment("");
                    }
                  }}
                  className={cn(
                    "btn w-full min-h-[44px] text-sm px-4 py-2 rounded-xl transition-all duration-150",
                    newComment.trim()
                      ? "btn-primary shadow-[0_0_14px_rgba(192,132,252,0.4)]"
                      : "btn-secondary opacity-45",
                  )}
                  disabled={!newComment.trim() || isLoadingComments}
                >
                  Post comment
                </button>
              </div>

              <TaskMentionSuggestions
                comment={newComment}
                members={members || []}
                currentUserId={user?.id}
                onSelect={(handle) => setNewComment(insertMention(newComment, handle))}
              />
            </div>
          </CollapsibleSection>

          <div className="text-[10px] text-text-muted pt-1">
            Created {safeFormatTimestampIso(localTask.createdAt, "MMM d, yyyy", "—")}
            {localTask.status === "done" && localTask.completedAt && (
              <span> · Completed {safeFormatTimestampIso(localTask.completedAt, "MMM d, yyyy", "—")}</span>
            )}
          </div>

        </div>
        ) : (
        <div className="p-5 flex flex-col gap-5 min-h-0 h-full">
          <div className="flex flex-col lg:flex-row gap-5 min-h-0 flex-1 overflow-hidden">
          <div className="flex-1 min-w-0 min-h-0 overflow-y-auto space-y-4 pr-0.5">
            <input
              value={localTask.title}
              onChange={(e) => save({ title: e.target.value })}
              onFocus={(e) => e.currentTarget.select()}
              className={cn(
                "w-full min-w-0 bg-transparent text-2xl font-semibold tracking-tight outline-none",
                localTask.status === "done" && "line-through text-text-muted",
              )}
              aria-label="Task title"
            />

            {liveEditing?.[localTask.id] && liveEditing[localTask.id].userId !== (user?.id || "me") && (
              <div className="text-[10px] text-emerald-400/80 flex items-center gap-1.5 -mt-2">
                <span className="inline-block w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                {liveEditing[localTask.id].email?.split("@")[0] || "Someone"} is typing…
              </div>
            )}

            {activeConflicts && activeConflicts[localTask.id] && (
              <div className="glass px-3 py-2 rounded-xl border border-amber-500/40 text-amber-400 text-xs flex flex-wrap items-center gap-2">
                <span>Edited by {activeConflicts[localTask.id].remoteUser || "teammate"}</span>
                <button onClick={() => resolveConflict(localTask.id, false)} className="px-2 py-0.5 bg-surface-hover rounded text-[10px]">Theirs</button>
                <button onClick={() => resolveConflict(localTask.id, true)} className="px-2 py-0.5 bg-surface-hover rounded text-[10px]">Mine</button>
              </div>
            )}

            <textarea
              value={localTask.description}
              onChange={(e) => save({ description: e.target.value })}
              placeholder="Add notes…"
              className="input w-full min-h-[64px] max-h-[120px] p-3 text-sm resize-y outline-none"
              rows={2}
            />

            <div className="pt-3 border-t border-border-glass space-y-2">
              <div className="flex items-center gap-2 text-xs font-medium text-text-secondary">
                <MessageSquare className="h-3.5 w-3.5" />
                Comments
                {isLoadingComments ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <span className="text-text-muted">({taskComments.length})</span>
                )}
              </div>

              <div className="space-y-2 max-h-44 overflow-auto pr-1">
                {taskComments.length === 0 ? (
                  <div className="text-xs text-text-muted">No comments yet.</div>
                ) : (
                  taskComments.map((c) => (
                    <TaskCommentCard
                      key={c.id}
                      comment={c}
                      members={members || []}
                      currentUserId={user?.id}
                      isEditing={editingCommentId === c.id}
                      editDraft={editingCommentId === c.id ? editingCommentDraft : c.content}
                      isBusy={commentActionId === c.id}
                      onEditDraftChange={setEditingCommentDraft}
                      onStartEdit={() => startEditingComment(c)}
                      onCancelEdit={cancelEditingComment}
                      onSaveEdit={() => void saveEditingComment()}
                      onDelete={() => requestDeleteComment(c.id)}
                      compact
                    />
                  ))
                )}
              </div>

              <div className="flex gap-2">
                <input
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      if (newComment.trim()) {
                        addComment(newComment, { taskId: task.id });
                        setNewComment("");
                      }
                    }
                  }}
                  placeholder="Write a comment…"
                  className="input flex-1 text-sm px-3 py-2 min-h-[40px]"
                />
                <button
                  onClick={() => {
                    if (newComment.trim()) {
                      addComment(newComment, { taskId: task.id });
                      setNewComment("");
                    }
                  }}
                  className="btn btn-secondary px-3 text-sm shrink-0"
                  disabled={!newComment.trim() || isLoadingComments}
                >
                  Post
                </button>
              </div>

              <TaskMentionSuggestions
                comment={newComment}
                members={members || []}
                currentUserId={user?.id}
                onSelect={(handle) => setNewComment(insertMention(newComment, handle))}
              />
            </div>
          </div>

          <div className="task-detail-schedule-col lg:w-80 xl:w-[22rem] shrink-0 space-y-2.5 text-sm lg:border-l lg:border-border-glass lg:pl-5 min-w-0 min-h-0 overflow-y-auto">
            {workspaceDeepLink && (
              <WorkspaceItemDeepLink
                workspaceName={workspaceDeepLink.workspaceName}
                destination="Tasks"
                onNavigate={workspaceDeepLink.onNavigate}
                className="inline-flex items-center gap-1.5 text-xs text-neon-purple hover:text-neon-purple-tint transition w-full text-left group"
              />
            )}

            <TaskModalScheduleFields
              localTask={localTask}
              save={save}
              members={members || []}
              currentUserId={user?.id}
              disabled={!!taskLoadingStates?.[task.id]}
              onEndIncompleteChange={setRecurrenceEndIncomplete}
              onOpenLinkedNote={(noteId) => {
                onClose();
                setFilesSelectNoteId(noteId);
                setView("notes");
              }}
            />

            <div className="pt-3 border-t border-border-glass text-[11px] text-text-muted leading-relaxed">
              Created {safeFormatTimestampIso(localTask.createdAt, "MMM d, yyyy", "—")}
              {localTask.status === "done" && localTask.completedAt && (
                <div>Completed {safeFormatTimestampIso(localTask.completedAt, "MMM d, yyyy", "—")}</div>
              )}
            </div>
          </div>
          </div>

        </div>
        )}
        </div>
        {/* Close motion sheet + backdrop + AnimatePresence (mobile sheet structure) */}
      </motion.div>
    </div>
      )}
    </AnimatePresence>

    {showUnsavedConfirm && (
      <div className="fixed inset-0 z-[250] flex items-end md:items-center justify-center p-0 md:p-4">
        <div
          className="absolute inset-0 overlay-scrim backdrop-blur-[3px]"
          onClick={() => setShowUnsavedConfirm(false)}
          aria-hidden
        />
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="task-unsaved-title"
          aria-describedby="task-unsaved-desc"
          className={cn(
            "confirmation-modal confirmation-modal--unsaved task-unsaved-dialog relative w-full max-w-md bg-bg-panel border border-border-glass modal-panel shadow-2xl",
            "rounded-t-2xl md:rounded-2xl",
            "pb-[max(1rem,env(safe-area-inset-bottom))] md:pb-0",
            "animate-in fade-in slide-in-from-bottom-4 md:zoom-in-95 duration-200",
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-center pt-2.5 md:hidden">
            <div className="confirmation-modal__drag-handle h-1 w-10 rounded-full" aria-hidden />
          </div>
          <div className="p-5 pb-4">
            <h3 id="task-unsaved-title" className="text-lg font-semibold text-text-primary tracking-tight">
              Revert changes?
            </h3>
            <div id="task-unsaved-desc" className="mt-2 space-y-1.5">
              <p className="text-sm font-medium text-text-primary truncate">
                &ldquo;{localTask.title}&rdquo;
              </p>
              <p className="text-sm text-text-secondary leading-relaxed">
                This restores the task to how it was when you opened it. Edits made in this session will be undone.
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-2.5 px-5 pb-5">
            <button
              type="button"
              onClick={() => setShowUnsavedConfirm(false)}
              className="confirmation-modal__cancel w-full min-h-[44px] rounded-xl border border-border-glass px-4 py-2.5 text-sm font-medium text-text-primary hover:bg-surface-hover transition"
            >
              Keep editing
            </button>
            <button
              type="button"
              onClick={() => void handleCancel()}
              disabled={!!taskLoadingStates?.[task.id]}
              className="confirmation-modal__discard w-full min-h-[44px] rounded-xl border border-[var(--priority-p0)]/35 px-4 py-2.5 text-sm font-semibold text-[var(--priority-p0)]/70 hover:bg-[var(--priority-p0)]/15 disabled:opacity-50 transition"
            >
              Revert
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Modern confirmation modal (replaces raw confirm for task delete) */}
    <ConfirmationModal
      open={pendingDeleteTask}
      onOpenChange={setPendingDeleteTask}
      title={localTask.recurringRule ? "Delete recurring series?" : "Delete this task?"}
      highlight={localTask.title}
      description={
        localTask.recurringRule
          ? "This permanently deletes the entire recurring series and all future occurrences. Comments and links are also removed. This cannot be undone."
          : "The task, its comments, and any links will be permanently removed. This cannot be undone."
      }
      confirmText={localTask.recurringRule ? "Delete series" : "Delete task"}
      cancelText="Cancel"
      variant="destructive"
      onConfirm={handleConfirmDeleteTask}
    />

    <ConfirmationModal
      open={!!pendingDeleteCommentId}
      onOpenChange={(open) => {
        if (!open) setPendingDeleteCommentId(null);
      }}
      title="Delete this comment?"
      highlight={pendingDeleteCommentPreview}
      description="This comment will be permanently removed from the task. This cannot be undone."
      confirmText="Delete comment"
      cancelText="Keep comment"
      variant="destructive"
      onConfirm={handleConfirmDeleteComment}
      isLoading={!!pendingDeleteCommentId && commentActionId === pendingDeleteCommentId}
    />
  </>,
    document.body,
  );
}
