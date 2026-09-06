"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, type PanInfo } from "framer-motion";
import { Check, SkipForward, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { DateTimePicker } from "@/components/DateTimePicker";
import { ConfirmationModal } from "@/components/ConfirmationModal";
import { useIsMobileViewport } from "@/lib/hooks/useIsMobileViewport";
import { useScrollLock } from "@/lib/hooks/useScrollLock";
import { cn, getRecurringLabel, getUpcomingRecurrencesPreview, triggerHaptic } from "@/lib/utils";
import type { Priority, Task } from "@/types";
import { TaskOrganizeFields } from "@/features/tasks/components/TaskOrganizeFields";
import { TaskRecurrenceEditor } from "@/features/tasks/components/TaskRecurrenceEditor";
import {
  buildDueDateUpdates,
  buildRecurringDueDateChange,
} from "@/features/tasks/lib/recurrenceTaskState";
import { useTaskStore } from "@/store/useTaskStore";
import { RemainingReviewMark } from "./RemainingReviewMark";
import {
  clearImportReviewSession,
  importReviewDrafts,
  readImportReviewSession,
  writeImportReviewSession,
} from "../lib/reviewSession";
import "../import.css";

const PRIORITIES: Priority[] = ["P0", "P1", "P2", "P3"];

interface ImportReviewDeckProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function cloneTask(task: Task): Task {
  return {
    ...task,
    tags: [...(task.tags || [])],
    linkedNoteIds: [...(task.linkedNoteIds || [])],
    exceptionDates: task.exceptionDates ? [...task.exceptionDates] : undefined,
  };
}

function reviewPatch(task: Task): Partial<Task> {
  return {
    title: task.title,
    description: task.description,
    recurringRule: task.recurringRule ?? null,
    folderId: task.folderId,
    starred: task.starred,
    priority: task.priority,
    exceptionDates: task.exceptionDates,
    dueDate: task.dueDate ?? null,
  };
}

export function ImportReviewDeck({ open, onOpenChange }: ImportReviewDeckProps) {
  const isMobile = useIsMobileViewport();
  const workspaceId = useTaskStore((s) => s.currentWorkspace.id);
  const tasks = useTaskStore((s) => s.tasks);
  const approveImportedTask = useTaskStore((s) => s.approveImportedTask);
  const approveRemainingImported = useTaskStore((s) => s.approveRemainingImported);
  const discardImportedTask = useTaskStore((s) => s.discardImportedTask);
  const discardRemainingImported = useTaskStore((s) => s.discardRemainingImported);

  const pending = useMemo(
    () =>
      tasks
        .filter(
          (t) => t.workspaceId === workspaceId && t.importStatus === "pending_review" && t.status !== "done",
        )
        .sort((a, b) => {
          const due = (a.dueDate || "").localeCompare(b.dueDate || "");
          if (due !== 0) return due;
          return a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
        }),
    [tasks, workspaceId],
  );

  const [index, setIndex] = useState(0);
  const [draft, setDraft] = useState<Task | null>(null);
  const [exiting, setExiting] = useState(false);
  const [bulkOpen, setBulkOpen] = useState<"approve" | "discard" | null>(null);
  const [mounted, setMounted] = useState(false);
  const startCountRef = useRef(0);
  const undoRef = useRef<Task | null>(null);
  const draftsRef = useRef<Map<string, Task>>(importReviewDrafts);
  const resumeAppliedRef = useRef(false);
  const titleRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => setMounted(true), []);
  useScrollLock(open);

  useEffect(() => {
    draftsRef.current.clear();
    resumeAppliedRef.current = false;
    setIndex(0);
  }, [workspaceId]);

  const current = pending[Math.min(index, Math.max(0, pending.length - 1))] ?? null;

  useEffect(() => {
    if (!open) {
      resumeAppliedRef.current = false;
      return;
    }
    const session = readImportReviewSession(workspaceId);
    startCountRef.current = Math.max(session.startCount, pending.length);
    if (!resumeAppliedRef.current) {
      const resumeIndex = session.resumeTaskId
        ? pending.findIndex((t) => t.id === session.resumeTaskId)
        : 0;
      setIndex(resumeIndex >= 0 ? resumeIndex : 0);
      resumeAppliedRef.current = true;
    }
    writeImportReviewSession(workspaceId, {
      resumeTaskId: session.resumeTaskId,
      startCount: startCountRef.current,
    });
  }, [open, workspaceId, pending.length]);

  useEffect(() => {
    if (!open) return;
    if (pending.length === 0) {
      clearImportReviewSession(workspaceId);
      return;
    }
    writeImportReviewSession(workspaceId, {
      resumeTaskId: current?.id ?? null,
      startCount: Math.max(startCountRef.current, pending.length),
    });
  }, [open, workspaceId, current?.id, pending.length]);

  useEffect(() => {
    if (!current) {
      setDraft(null);
      return;
    }
    const saved = draftsRef.current.get(current.id);
    setDraft(cloneTask(saved ?? current));
  }, [current?.id]);

  useEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${el.scrollHeight}px`;
  }, [draft?.id, draft?.title, open]);

  useEffect(() => {
    if (open && pending.length === 0) onOpenChange(false);
  }, [open, pending.length, onOpenChange]);

  const saveDraft = (updates: Partial<Task>) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...updates };
      draftsRef.current.set(next.id, next);
      return next;
    });
  };

  const remaining = pending.length;
  const reviewed = Math.max(0, startCountRef.current - remaining);
  const progress = startCountRef.current > 0 ? reviewed / startCountRef.current : 0;

  const approveCurrent = useCallback(async () => {
    if (!draft || exiting) return;
    setExiting(true);
    triggerHaptic("success");
    undoRef.current = current;
    const ok = await approveImportedTask(draft.id, reviewPatch(draft));
    if (ok !== false) draftsRef.current.delete(draft.id);
    setExiting(false);
  }, [approveImportedTask, current, draft, exiting]);

  const discardCurrent = useCallback(async () => {
    if (!draft || exiting) return;
    setExiting(true);
    triggerHaptic("medium");
    draftsRef.current.delete(draft.id);
    await discardImportedTask(draft.id);
    setExiting(false);
  }, [discardImportedTask, draft, exiting]);

  const skipCurrent = () => {
    if (pending.length <= 1) return;
    triggerHaptic("light");
    setIndex((i) => (i + 1) % pending.length);
  };
  const canSkip = pending.length > 1;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      if (e.key === "Escape") {
        onOpenChange(false);
        return;
      }
      if (typing) return;
      if (e.key === "Enter" || e.key.toLowerCase() === "a") {
        e.preventDefault();
        void approveCurrent();
      } else if (e.key.toLowerCase() === "s") {
        e.preventDefault();
        skipCurrent();
      } else if (e.key.toLowerCase() === "d") {
        e.preventDefault();
        void discardCurrent();
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        const prev = undoRef.current;
        if (prev) {
          void useTaskStore.getState().updateTask(prev.id, { importStatus: "pending_review" }, { silent: true });
          undoRef.current = null;
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, approveCurrent, discardCurrent, onOpenChange, pending.length]);

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x < -80 || info.velocity.x < -500) {
      void approveCurrent();
      return;
    }
    if (info.offset.x > 80 || info.velocity.x > 500) {
      void discardCurrent();
    }
  };

  if (!open || !mounted || typeof document === "undefined") return null;

  const peek = pending[index + 1] ?? pending[0];

  return createPortal(
    <div className="import-review-deck" role="dialog" aria-modal="true" aria-label="Review imported tasks">
      <button
        type="button"
        className="absolute inset-0 overlay-scrim backdrop-blur-md"
        onClick={() => onOpenChange(false)}
        aria-label="Close review"
      />
      <div className="relative z-10 flex items-center justify-between gap-3 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-2 flex-wrap">
        <div className="flex min-w-0 items-center gap-3">
          <RemainingReviewMark remaining={remaining} total={Math.max(startCountRef.current, remaining)} />
          <div className="min-w-0">
            <div className="text-sm font-semibold tabular-nums">
              {remaining.toLocaleString()} remaining
            </div>
            <div className="mt-1 h-1 w-36 max-w-full rounded-full bg-surface-hover overflow-hidden">
              <div className="h-full bg-neon-purple transition-all" style={{ width: `${Math.round(progress * 100)}%` }} />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="text-[11px] text-text-muted hover:text-text-primary px-2 py-1"
            onClick={() => setBulkOpen("approve")}
          >
            Approve remaining
          </button>
          <button
            type="button"
            className="text-[11px] text-text-muted hover:text-red-400 px-2 py-1"
            onClick={() => setBulkOpen("discard")}
          >
            Discard remaining
          </button>
          <button
            type="button"
            className="rounded-xl border border-border-glass px-3 py-1.5 text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-surface-hover min-h-[36px]"
            onClick={() => onOpenChange(false)}
          >
            Save & close
          </button>
          <button
            type="button"
            className="rounded-lg p-2 text-text-muted hover:text-text-primary hover:bg-surface-hover"
            onClick={() => onOpenChange(false)}
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="import-review-deck__stage">
        {peek && peek.id !== current?.id ? (
          <div
            className="import-review-card pointer-events-none"
            style={{ transform: "scale(0.96) translateY(14px)", opacity: 0.7, zIndex: 0 }}
          />
        ) : null}
        <AnimatePresence initial={false}>
          {draft ? (
            <motion.div
              key={draft.id}
              className="import-review-card"
              style={{ zIndex: 2, touchAction: "pan-y" }}
              initial={{ x: 48, opacity: 0, scale: 0.98 }}
              animate={{ x: 0, opacity: 1, scale: 1 }}
              exit={{ x: "-110%", opacity: 0, transition: { duration: 0.32, ease: [0.22, 1, 0.36, 1] } }}
              drag={isMobile ? "x" : false}
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.18}
              onPointerDownCapture={(e) => {
                const el = e.target as HTMLElement | null;
                if (el?.closest("input, textarea, button, [contenteditable='true']")) {
                  e.stopPropagation();
                }
              }}
              onDragEnd={handleDragEnd}
            >
              <div className="import-review-card__scroll space-y-3">
                <textarea
                  ref={titleRef}
                  value={draft.title}
                  rows={1}
                  onChange={(e) => saveDraft({ title: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) e.preventDefault();
                  }}
                  className="input import-review-card__title w-full font-semibold rounded-xl"
                  aria-label="Task title"
                />
                <textarea
                  value={draft.description}
                  onChange={(e) => saveDraft({ description: e.target.value })}
                  placeholder="Notes"
                  rows={6}
                  className="input w-full min-h-[8rem] px-3 py-2.5 rounded-xl text-sm resize-y"
                />
                <DateTimePicker
                  label="Due date"
                  value={draft.dueDate}
                  onChange={(dateStr) => {
                    if (!dateStr) {
                      saveDraft(buildDueDateUpdates(null));
                      return;
                    }
                    if (draft.recurringRule) {
                      saveDraft(buildRecurringDueDateChange(draft, dateStr, "series"));
                      return;
                    }
                    saveDraft(buildDueDateUpdates(dateStr));
                  }}
                  className="w-full"
                />
                <TaskOrganizeFields
                  starred={!!draft.starred}
                  folderId={draft.folderId}
                  layout="modal-row"
                  onStarredChange={(starred) => saveDraft({ starred })}
                  onFolderChange={(folderId) => saveDraft({ folderId })}
                />
                <div className="flex flex-wrap gap-1.5">
                  {PRIORITIES.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => saveDraft({ priority: p })}
                      className={cn(
                        "text-[11px] px-2.5 py-1 rounded-full border transition",
                        draft.priority === p
                          ? "bg-neon-purple text-[var(--on-accent)] border-neon-purple"
                          : "border-border-glass text-text-secondary hover:bg-surface-hover",
                      )}
                    >
                      {p}
                    </button>
                  ))}
                </div>
                <div className="rounded-2xl border border-border-glass p-3">
                  <div className="text-[11px] text-text-muted mb-2">
                    {(() => {
                      const upcoming = getUpcomingRecurrencesPreview(
                        draft.dueDate,
                        draft.recurringRule,
                        4,
                        draft.exceptionDates,
                      );
                      const label = getRecurringLabel(draft.recurringRule) || "No recurrence";
                      return upcoming.length ? `${label} · next ${upcoming.join(" · ")}` : label;
                    })()}
                  </div>
                  <TaskRecurrenceEditor localTask={draft} save={saveDraft} compact />
                </div>
              </div>
              <div className="import-review-card__footer">
                <button
                  type="button"
                  className="btn btn-secondary min-h-[44px] flex-1 inline-flex items-center justify-center gap-1.5 text-red-400 hover:text-red-300 hover:border-red-400/40 hover:bg-red-400/10"
                  onClick={() => void discardCurrent()}
                  disabled={exiting}
                >
                  <Trash2 className="h-4 w-4" />
                  Discard
                </button>
                <button
                  type="button"
                  className="btn btn-secondary min-h-[44px] flex-1 inline-flex items-center justify-center gap-1.5"
                  onClick={skipCurrent}
                  disabled={!canSkip || exiting}
                >
                  <SkipForward className="h-4 w-4" />
                  Skip
                </button>
                <button
                  type="button"
                  className="btn btn-primary min-h-[44px] flex-[1.4] inline-flex items-center justify-center gap-1.5"
                  onClick={() => void approveCurrent()}
                  disabled={exiting}
                >
                  <Check className="h-4 w-4" />
                  Approve
                </button>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      <ConfirmationModal
        open={bulkOpen === "approve"}
        onOpenChange={(next) => setBulkOpen(next ? "approve" : null)}
        onConfirm={async () => {
          if (draft) {
            draftsRef.current.delete(draft.id);
            await approveImportedTask(draft.id, reviewPatch(draft));
          }
          const n = await approveRemainingImported();
          clearImportReviewSession(workspaceId);
          draftsRef.current.clear();
          toast.success(`Approved ${n} task${n === 1 ? "" : "s"}`);
          setBulkOpen(null);
          onOpenChange(false);
        }}
        title="Approve remaining imported tasks?"
        description="Everything still in this deck will appear on Tasks with the mapped due dates, repeats, and notes."
        confirmText="Approve remaining"
      />
      <ConfirmationModal
        open={bulkOpen === "discard"}
        onOpenChange={(next) => setBulkOpen(next ? "discard" : null)}
        onConfirm={async () => {
          await discardRemainingImported();
          clearImportReviewSession(workspaceId);
          draftsRef.current.clear();
          setBulkOpen(null);
          onOpenChange(false);
        }}
        title="Discard remaining imported tasks?"
        description="Pending imported tasks that have not been approved will be deleted."
        confirmText="Discard remaining"
        variant="destructive"
      />
    </div>,
    document.body,
  );
}
