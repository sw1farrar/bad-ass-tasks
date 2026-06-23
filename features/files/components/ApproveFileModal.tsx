"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CheckSquare, Link2, Loader2, Pencil, Plus, Tag, X } from "lucide-react";
import { useIsMobileViewport } from "@/lib/hooks/useIsMobileViewport";
import { useScrollLock } from "@/lib/hooks/useScrollLock";
import { DateTimePicker } from "@/components/DateTimePicker";
import { TaskAssigneeBadge } from "@/components/TaskAssigneeBadge";
import { TaskAssigneePicker } from "@/components/TaskAssigneePicker";
import { isSharedWorkspace } from "@/lib/assignee";
import { hasUserFilingTags } from "@/lib/files/fileFilters";
import { FILE_RECORD_TYPES, recordTypeLabel } from "@/lib/files/fileTypes";
import type { CreateTaskAndLinkOptions } from "@/features/notes/hooks";
import { defaultTaskDueDateInput, dueDateFromUserInput } from "@/lib/datetime";
import { cn, defaultTaskDueDate, formatDueDate } from "@/lib/utils";
import type { FileRecordType, Note, Task, WorkspaceMember } from "@/types";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api/apiFetch";
import { TagPicker } from "./TagPicker";
import { FileBookmarkButton } from "./FileBookmarkButton";
import {
  buildReceiptItemDrafts,
  ReceiptItemsReviewPanel,
  type ReceiptItemDraft,
} from "./ReceiptItemsReviewPanel";
import { SuggestArchiveTitleButton, type ArchiveTitleSuggestion } from "./SuggestArchiveTitleButton";
import { MobileDrawerShell } from "@/components/MobileDrawerShell";
import {
  fileAiSuggestionToArchivePayload,
  isActionableFileAiSuggestion,
} from "@/lib/files/fileAiSuggestion";

export type ApproveFileResult = "close" | "next";

interface ApproveFileModalProps {
  file: Note | null;
  isOpen: boolean;
  onClose: () => void;
  workspaceTags: string[];
  remainingInQueue: number;
  onApprove: (
    input: {
      title: string;
      tags: string[];
      memo: string;
      recordType: FileRecordType;
    },
    result: ApproveFileResult,
  ) => Promise<void>;
  onEdit?: () => void;
  onToggleBookmark?: (noteId: string, bookmarked: boolean) => void | Promise<void>;
  tasks?: Task[];
  members?: WorkspaceMember[];
  currentUserId?: string;
  onCreateTaskAndLink?: (
    noteId: string,
    title: string,
    options?: CreateTaskAndLinkOptions,
  ) => Promise<string | null>;
  onOpenTask?: (taskId: string) => void;
  /** Wipe preemptive AI suggestion when the user dismisses review without filing. */
  onClearAiSuggestion?: (noteId: string) => Promise<void>;
}

function applyArchiveSuggestion(
  noteId: string,
  suggestion: ArchiveTitleSuggestion,
  setters: {
    setTitle: (v: string) => void;
    setMemo: (v: string) => void;
    setTags: (v: string[]) => void;
    setRecordType: (v: FileRecordType) => void;
    setReceiptItemDrafts: (v: ReceiptItemDraft[]) => void;
    setTagNudgeVisible: (v: boolean) => void;
  },
) {
  setters.setTitle(suggestion.title);
  if (suggestion.memo) setters.setMemo(suggestion.memo);
  if (suggestion.tags?.length) {
    setters.setTags(suggestion.tags);
    setters.setTagNudgeVisible(false);
  }
  if (suggestion.isReceipt) {
    setters.setRecordType("receipt");
  }
  if (suggestion.receiptLineItems?.length) {
    setters.setReceiptItemDrafts(
      buildReceiptItemDrafts(noteId, suggestion.receiptLineItems),
    );
  } else {
    setters.setReceiptItemDrafts([]);
  }
}

export function ApproveFileModal({
  file,
  isOpen,
  onClose,
  workspaceTags,
  remainingInQueue,
  onApprove,
  onEdit,
  onToggleBookmark,
  tasks = [],
  members = [],
  currentUserId,
  onCreateTaskAndLink,
  onOpenTask,
  onClearAiSuggestion,
}: ApproveFileModalProps) {
  const [title, setTitle] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [memo, setMemo] = useState("");
  const [recordType, setRecordType] = useState<FileRecordType>("note");
  const [saving, setSaving] = useState<ApproveFileResult | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDueDate, setNewTaskDueDate] = useState<string | null>(() =>
    defaultTaskDueDateInput(),
  );
  const [newTaskAssigneeId, setNewTaskAssigneeId] = useState<string | null>(null);
  const [creatingTask, setCreatingTask] = useState(false);
  const showAssigneePicker = isSharedWorkspace(members);
  const [tagNudgeVisible, setTagNudgeVisible] = useState(false);
  const [receiptItemDrafts, setReceiptItemDrafts] = useState<ReceiptItemDraft[]>([]);
  const [addingReceiptItems, setAddingReceiptItems] = useState(false);
  const [mounted, setMounted] = useState(false);
  const tagsSectionRef = useRef<HTMLDivElement>(null);
  const titleTouchedRef = useRef(false);
  const activeFileIdRef = useRef<string | null>(null);
  const appliedAiSuggestionAtRef = useRef<string | null>(null);
  const isMobile = useIsMobileViewport();

  useScrollLock(isOpen);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      activeFileIdRef.current = null;
      titleTouchedRef.current = false;
      return;
    }
    if (!file) return;

    const isNewFile = activeFileIdRef.current !== file.id;
    if (isNewFile) {
      activeFileIdRef.current = file.id;
      titleTouchedRef.current = false;
      appliedAiSuggestionAtRef.current = null;
      setTitle(file.title || "Untitled");
      setTags((file.tags ?? []).filter((t) => t !== "from-email").map((t) => t.toLowerCase()));
      setMemo(file.memo ?? "");
      setRecordType(file.recordType ?? "note");
      setNewTaskTitle("");
      setNewTaskDueDate(defaultTaskDueDateInput());
      setNewTaskAssigneeId(null);
      setTagNudgeVisible(false);
      setReceiptItemDrafts([]);
    }

    if (!titleTouchedRef.current) {
      setTitle(file.title || "Untitled");
    }

    const aiKey = file.aiSuggestion?.analyzedAt ?? file.aiSuggestion?.status ?? "";
    if (
      isActionableFileAiSuggestion(file.aiSuggestion) &&
      appliedAiSuggestionAtRef.current !== `${file.id}:${aiKey}`
    ) {
      appliedAiSuggestionAtRef.current = `${file.id}:${aiKey}`;
      titleTouchedRef.current = true;
      applyArchiveSuggestion(
        file.id,
        fileAiSuggestionToArchivePayload(file.aiSuggestion),
        {
          setTitle,
          setMemo,
          setTags,
          setRecordType,
          setReceiptItemDrafts,
          setTagNudgeVisible,
        },
      );
    }
  }, [file, isOpen]);

  useEffect(() => {
    if (hasUserFilingTags(tags)) setTagNudgeVisible(false);
  }, [tags]);

  const linkedTasks = useMemo(() => {
    const ids = file?.linkedTaskIds ?? [];
    return ids.map((id) => tasks.find((t) => t.id === id)).filter(Boolean) as Task[];
  }, [file?.linkedTaskIds, tasks]);

  if (!mounted || !isOpen || !file) return null;

  const canFile = hasUserFilingTags(tags);
  const aiAnalyzing = file.aiSuggestion?.status === "pending";
  const aiReady = isActionableFileAiSuggestion(file.aiSuggestion);

  const handleDismiss = () => {
    const noteId = file.id;
    const hadAiSuggestion =
      !!file.aiSuggestion &&
      (file.aiSuggestion.status === "ready" ||
        file.aiSuggestion.status === "pending" ||
        file.aiSuggestion.status === "failed");
    onClose();
    if (hadAiSuggestion && onClearAiSuggestion) {
      void onClearAiSuggestion(noteId);
    }
  };

  const handleCreateLinkedTask = async () => {
    const trimmed = newTaskTitle.trim();
    if (!trimmed || !file || !onCreateTaskAndLink || creatingTask || saving) return;

    setCreatingTask(true);
    try {
      const options: CreateTaskAndLinkOptions = {};
      const dueInput = newTaskDueDate ?? defaultTaskDueDateInput();
      options.dueDate =
        dueDateFromUserInput(dueInput) ?? defaultTaskDueDate();
      if (newTaskAssigneeId) options.assigneeId = newTaskAssigneeId;

      const taskId = await onCreateTaskAndLink(
        file.id,
        trimmed,
        Object.keys(options).length > 0 ? options : undefined,
      );
      if (taskId) {
        setNewTaskTitle("");
        setNewTaskDueDate(defaultTaskDueDateInput());
        setNewTaskAssigneeId(null);
      }
    } finally {
      setCreatingTask(false);
    }
  };

  const showTagRequiredNudge = () => {
    setTagNudgeVisible(true);
    tagsSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  const handleAddReceiptItemsToLedger = async () => {
    if (!file || addingReceiptItems || saving) return;
    const selected = receiptItemDrafts.filter((item) => item.selected);
    if (!selected.length) return;

    setAddingReceiptItems(true);
    try {
      const res = await apiFetch("/api/files/receipt-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId: file.workspaceId,
          noteId: file.id,
          items: selected.map(({ key: _key, selected: _selected, ...item }) => item),
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        inserted?: number;
        skipped?: number;
        error?: string;
      };
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? "persist_failed");
      }

      const inserted = data.inserted ?? 0;
      const skipped = data.skipped ?? 0;
      setReceiptItemDrafts((current) => current.filter((item) => !item.selected));

      if (inserted > 0) {
        toast.success(
          `Added ${inserted} item${inserted === 1 ? "" : "s"} to receipt ledger`,
          skipped > 0
            ? { description: `${skipped} duplicate${skipped === 1 ? "" : "s"} skipped` }
            : undefined,
        );
      } else if (skipped > 0) {
        toast.message("Receipt items already in ledger");
      }
    } catch {
      toast.error("Could not add receipt items", {
        description: "Try again or adjust your selection.",
      });
    } finally {
      setAddingReceiptItems(false);
    }
  };

  const handleApprove = async (result: ApproveFileResult) => {
    if (!canFile) {
      showTagRequiredNudge();
      return;
    }
    setSaving(result);
    try {
      await onApprove(
        {
          title: title.trim() || "Untitled",
          tags,
          memo: memo.trim(),
          recordType,
        },
        result,
      );
      if (result === "close") onClose();
    } finally {
      setSaving(null);
    }
  };

  const hasNext = remainingInQueue > 1;

  return createPortal(
    <MobileDrawerShell
      open={isOpen}
      onClose={handleDismiss}
      isMobile={isMobile}
      zIndex={280}
      panelClassName={cn(
        "approve-file-modal-shell",
        isMobile ? "sm:max-w-lg" : "sm:max-w-3xl",
        !isMobile && "max-h-[92dvh]",
      )}
      ariaLabelledBy="review-file-title"
    >
        <div
          className={cn(
            "flex-1 min-h-0 overflow-y-auto overscroll-contain capture-file-modal-body",
            isMobile
              ? "px-4 py-4 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]"
              : "p-5",
          )}
        >
        <div className="flex items-center justify-between gap-2 mb-1">
          <h2 id="review-file-title" className="text-lg font-semibold tracking-tight">
            Review file
          </h2>
          <div className="flex items-center gap-0.5 shrink-0">
            {file && onToggleBookmark && (
              <FileBookmarkButton
                bookmarked={!!file.bookmarked}
                disabled={!!saving}
                onToggle={() => void onToggleBookmark(file.id, !file.bookmarked)}
              />
            )}
            <button
              type="button"
              onClick={handleDismiss}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-surface-hover text-text-muted"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        {(remainingInQueue > 0 || aiAnalyzing || aiReady) && (
          <p className="text-xs text-text-muted mb-4">
            {remainingInQueue > 0 ? (
              <>
                {remainingInQueue} in queue
                {hasNext ? " — file & next keeps you moving" : ""}
              </>
            ) : null}
            {remainingInQueue > 0 && (aiAnalyzing || aiReady) ? " · " : null}
            {aiAnalyzing ? (
              <span className="inline-flex items-center gap-1 text-neon-purple-dark">
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                AI analyzing…
              </span>
            ) : aiReady ? (
              <span className="text-neon-purple-dark">AI suggestions ready — edit or file below</span>
            ) : null}
          </p>
        )}

        <div className="space-y-3">
          <div className="block text-xs text-text-secondary">
            <div className="flex items-center justify-between gap-2 mb-1">
              <span>Title</span>
              <SuggestArchiveTitleButton
                noteId={file.id}
                availableTags={workspaceTags}
                context={{
                  title: file.title,
                  searchPlain: file.searchPlain,
                  emailHtml: file.rawHtml,
                  noteContent: file.content,
                  memo: file.memo,
                  recordType: file.recordType,
                  createdAt: file.createdAt,
                }}
                disabled={!!saving}
                onSuggested={(suggestion) => {
                  titleTouchedRef.current = true;
                  appliedAiSuggestionAtRef.current = `${file.id}:manual`;
                  applyArchiveSuggestion(file.id, suggestion, {
                    setTitle,
                    setMemo,
                    setTags,
                    setRecordType,
                    setReceiptItemDrafts,
                    setTagNudgeVisible,
                  });
                }}
              />
            </div>
            <input
              value={title}
              onChange={(e) => {
                titleTouchedRef.current = true;
                setTitle(e.target.value);
              }}
              className="w-full input px-3 py-2 rounded-xl text-sm"
              aria-label="Archive title"
            />
          </div>

          <div
            ref={tagsSectionRef}
            className={cn(
              "rounded-xl transition-[box-shadow,background-color] duration-300",
              tagNudgeVisible && "review-tag-nudge-target p-3 -mx-3",
            )}
          >
            <div className="text-xs text-text-secondary mb-1">
              Tags <span className="text-neon-purple">(required)</span>
            </div>
            <TagPicker
              availableTags={workspaceTags}
              selected={tags}
              onChange={setTags}
              disabled={!!saving}
            />
          </div>

          {receiptItemDrafts.length > 0 ? (
            <ReceiptItemsReviewPanel
              items={receiptItemDrafts}
              onChange={setReceiptItemDrafts}
              onAddToLedger={() => void handleAddReceiptItemsToLedger()}
              adding={addingReceiptItems}
              disabled={!!saving}
            />
          ) : null}

          <label className="block text-xs text-text-secondary">
            Memo <span className="text-text-faint">(optional)</span>
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              rows={3}
              className="mt-1 w-full input px-3 py-2 rounded-xl text-sm resize-none"
              placeholder="e.g. March electric bill from PG&E for $142.18"
              aria-describedby="review-memo-hint"
            />
            <span id="review-memo-hint" className="mt-1 block text-[10px] text-text-faint leading-snug">
              One line shown under the title in your file list and included when you search files.
            </span>
          </label>

          <label className="block text-xs text-text-secondary">
            Type
            <select
              value={recordType}
              onChange={(e) => setRecordType(e.target.value as FileRecordType)}
              className="mt-1 w-full input px-3 py-2 rounded-xl text-sm"
            >
              {FILE_RECORD_TYPES.map((t) => (
                <option key={t} value={t}>
                  {recordTypeLabel(t)}
                </option>
              ))}
            </select>
          </label>

          {onCreateTaskAndLink && (
            <div
              className={cn(
                "capture-file-associated-tasks rounded-xl border border-border-glass bg-bg/60 space-y-3",
                isMobile ? "p-3" : "p-3 sm:p-4",
              )}
            >
              <div className="flex items-center justify-between gap-2 text-xs font-medium text-text-secondary">
                <span className="flex items-center gap-1.5 min-w-0">
                  <Link2 className="h-3.5 w-3.5 shrink-0 text-neon-purple" />
                  Associated tasks
                </span>
                {linkedTasks.length > 0 && (
                  <span className="text-[10px] font-mono text-neon-purple tabular-nums shrink-0">
                    {linkedTasks.length} linked
                  </span>
                )}
              </div>

              {linkedTasks.length > 0 && (
                <ul className="space-y-1.5">
                  {linkedTasks.map((task) => {
                    const due = formatDueDate(task.dueDate ?? undefined);
                    return (
                      <li key={task.id}>
                        <button
                          type="button"
                          onClick={() => onOpenTask?.(task.id)}
                          disabled={!onOpenTask}
                          className={cn(
                            "review-linked-task w-full rounded-xl border border-border-glass bg-bg-secondary px-3 py-2.5 text-left transition min-h-[44px]",
                            onOpenTask && "hover:border-neon-purple/30 hover:bg-surface-hover active:scale-[0.99]",
                            !onOpenTask && "cursor-default",
                          )}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <CheckSquare className="h-4 w-4 shrink-0 text-neon-purple" />
                            <span className="flex-1 min-w-0 truncate text-sm text-text-primary">
                              {task.title}
                            </span>
                          </div>
                          {(due || task.assignee) && (
                            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 pl-6">
                              {due && (
                                <span
                                  className={cn(
                                    "text-[10px] tabular-nums",
                                    due.variant === "overdue" && "text-[var(--priority-p0)]",
                                    due.variant === "today" && "text-neon-purple",
                                    due.variant === "soon" && "text-text-secondary",
                                    due.variant === "default" && "text-text-muted",
                                  )}
                                >
                                  {due.label}
                                </span>
                              )}
                              <TaskAssigneeBadge label={task.assignee} compact />
                            </div>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}

              <div className="review-task-quick-add space-y-2.5">
                <input
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void handleCreateLinkedTask();
                    }
                  }}
                  placeholder="Task title — e.g. Pay this invoice"
                  className={cn(
                    "w-full input px-3 rounded-xl",
                    isMobile ? "min-h-[44px] py-2.5 text-base" : "py-2 text-sm",
                  )}
                  disabled={!!saving || creatingTask}
                  aria-label="New task title"
                />

                <div
                  className={cn(
                    "grid gap-2.5",
                    isMobile || !showAssigneePicker ? "grid-cols-1" : "sm:grid-cols-2",
                  )}
                >
                  <DateTimePicker
                    value={newTaskDueDate}
                    onChange={(date) => setNewTaskDueDate(date ?? null)}
                    label="Due date"
                    placeholder="No due date"
                    className="min-w-0"
                  />
                  {showAssigneePicker && (
                    <TaskAssigneePicker
                      members={members}
                      currentUserId={currentUserId}
                      value={newTaskAssigneeId}
                      onChange={setNewTaskAssigneeId}
                      compact
                    />
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => void handleCreateLinkedTask()}
                  disabled={!!saving || creatingTask || !newTaskTitle.trim()}
                  className={cn(
                    "w-full flex items-center justify-center gap-1.5 text-sm font-semibold transition",
                    isMobile
                      ? "btn btn-primary min-h-[44px] rounded-xl px-4 py-2.5"
                      : "btn btn-ghost py-2 border border-border-glass rounded-xl",
                    isMobile && (!newTaskTitle.trim() || creatingTask) && "opacity-45",
                  )}
                >
                  {creatingTask ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Adding…
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4" />
                      Add linked task
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
        </div>

        <div
          className={cn(
            "shrink-0 space-y-3 border-t border-border-glass/60 bg-bg-panel",
            isMobile
              ? "p-4 pb-[max(1rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]"
              : "p-5",
          )}
        >
          {tagNudgeVisible && (
            <div
              role="alert"
              aria-live="polite"
              className="review-tag-nudge animate-in fade-in slide-in-from-bottom-2 duration-300"
            >
              <div className="review-tag-nudge__icon" aria-hidden>
                <Tag className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold tracking-tight text-text-primary">
                  Add a tag before you file
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-text-secondary">
                  Pick an existing tag or type a new one above — tags keep your archive organized and searchable.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setTagNudgeVisible(false)}
                className="review-tag-nudge__dismiss"
                aria-label="Dismiss"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          <div className={cn("flex gap-2", isMobile ? "flex-col" : "flex-col-reverse sm:flex-row")}>
          <button type="button" onClick={handleDismiss} className="btn btn-ghost flex-1 py-2.5 text-sm">
            Cancel
          </button>
          {onEdit && (
            <button
              type="button"
              onClick={onEdit}
              disabled={!!saving}
              className="btn btn-ghost flex-1 py-2.5 text-sm border border-border-glass flex items-center justify-center gap-1.5"
            >
              <Pencil className="h-3.5 w-3.5" />
              View/Edit
            </button>
          )}
          {hasNext && (
            <button
              type="button"
              onClick={() => void handleApprove("close")}
              disabled={!!saving}
              aria-disabled={!canFile}
              className={cn(
                "btn btn-ghost flex-1 py-2.5 text-sm border border-border-glass",
                saving === "close" && "opacity-60",
                !canFile && !saving && "opacity-80",
              )}
            >
              {saving === "close" ? "Filing…" : "File only"}
            </button>
          )}
          <button
            type="button"
            onClick={() => void handleApprove(hasNext ? "next" : "close")}
            disabled={!!saving}
            aria-disabled={!canFile}
            className={cn(
              "btn btn-primary flex-1 py-2.5 text-sm",
              (saving === "next" || saving === "close") && "opacity-60",
              !canFile && !saving && "opacity-90",
            )}
          >
            {saving
              ? "Filing…"
              : hasNext
                ? "File & next"
                : "File"}
          </button>
          </div>
        </div>
    </MobileDrawerShell>,
    document.body,
  );
}