"use client";

import React, { useState } from "react";
import { Link as LinkIcon, X, Plus, Calendar, Repeat, Check, Loader2 } from "lucide-react";
import { Note, Task } from "@/types";
import { cn, formatDueDate, getRecurringLabel } from "@/lib/utils";
import { TaskAssigneeBadge } from "@/components/TaskAssigneeBadge";
import { ConfirmationModal } from "@/components/ConfirmationModal";
import { TaskRow } from "@/features/tasks/components/TaskRow";

interface LinkedTasksPanelProps {
  selectedNote: Note;
  tasks: Task[];
  onLinkTaskToNote: (noteId: string, taskId: string) => Promise<void>;
  onUnlinkTaskFromNote: (noteId: string, taskId: string) => Promise<void>;
  onOpenTask?: (taskId: string) => void;
  /** Checkbox: mark complete or reopen from the linked tasks list */
  onToggleTaskComplete?: (taskId: string) => Promise<void>;
  /** Optional: create a brand new task and automatically link it to this note */
  onCreateTaskAndLink?: (noteId: string, title: string) => Promise<string | null>;
  /** Mobile drawer layout */
  compact?: boolean;
}

/**
 * Extracted Linked Tasks management panel (M2 extraction).
 * Previously inline in NotesView below the TipTapEditor.
 * Handles displaying current links and adding new ones.
 */
export function LinkedTasksPanel({
  selectedNote,
  tasks,
  onLinkTaskToNote,
  onUnlinkTaskFromNote,
  onOpenTask,
  onToggleTaskComplete,
  onCreateTaskAndLink,
  compact = false,
}: LinkedTasksPanelProps) {
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [pendingUnlink, setPendingUnlink] = useState<Task | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const linkedTaskIds = selectedNote.linkedTaskIds || [];
  const linkedTasks = linkedTaskIds
    .map((id) => tasks.find((t) => t.id === id))
    .filter(Boolean) as Task[];

  const handleCreateTask = async () => {
    const title = newTaskTitle.trim();
    if (!title || !onCreateTaskAndLink || isCreating) return;

    setIsCreating(true);
    try {
      const newTaskId = await onCreateTaskAndLink(selectedNote.id, title);
      if (newTaskId) {
        setNewTaskTitle("");
      }
    } finally {
      setIsCreating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      void handleCreateTask();
    }
    if (e.key === "Escape") {
      setNewTaskTitle("");
    }
  };

  const handleToggleComplete = async (task: Task) => {
    if (!onToggleTaskComplete || togglingId) return;
    setTogglingId(task.id);
    try {
      await onToggleTaskComplete(task.id);
    } finally {
      setTogglingId(null);
    }
  };

  const canAdd = !!newTaskTitle.trim();

  return (
    <div
      className={cn(
        "linked-tasks-panel border-t border-white/10 bg-[#0a0a0f]/50",
        compact ? "px-0 py-3" : "px-4 md:px-6 py-3",
      )}
    >
      <div className={cn("flex items-center mb-2", compact ? "mb-1.5" : "justify-between")}>
        <div className="text-xs font-medium text-[#71717a] flex items-center gap-2">
          <LinkIcon className="h-3.5 w-3.5" />
          LINKED TASKS
        </div>
        {!compact && (
          <div className="text-[10px] text-[#c084fc] font-mono">
            {linkedTaskIds.length} linked
          </div>
        )}
      </div>

      <div className={cn("mb-3", compact ? "space-y-0 mb-2" : "space-y-1")}>
        {linkedTasks.length === 0 ? (
          <div className="text-[11px] text-[#71717a] italic py-1">No tasks linked yet</div>
        ) : compact ? (
          linkedTasks.map((task) => {
            const due = formatDueDate(task.dueDate ?? undefined);
            const isDone = task.status === "done";
            return (
              <TaskRow
                key={task.id}
                task={task}
                isDone={isDone}
                isOpLoading={togglingId === task.id}
                due={due}
                showAssignee
                onOpen={() => onOpenTask?.(task.id)}
                onComplete={() => void handleToggleComplete(task)}
              />
            );
          })
        ) : (
          linkedTasks.map((task) => {
            const due = formatDueDate(task.dueDate ?? undefined);
            const recurringLabel = task.recurringRule
              ? getRecurringLabel(task.recurringRule)
              : "";
            const isDone = task.status === "done";
            const isToggling = togglingId === task.id;

            return (
              <div
                key={task.id}
                className={cn(
                  "flex items-center gap-2 text-sm group rounded-lg px-2 py-2 transition-colors",
                  isDone ? "bg-white/[0.03] opacity-80" : "bg-white/5 hover:bg-white/[0.07]",
                )}
              >
                <button
                  type="button"
                  onClick={() => void handleToggleComplete(task)}
                  disabled={!onToggleTaskComplete || isToggling}
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-all active:scale-90 disabled:opacity-60",
                    isDone
                      ? "bg-[#00ff9f] border-[#c084fc] text-black"
                      : "border-[#3a3a42] hover:border-[#c084fc] group-hover:border-[#c084fc]/70",
                  )}
                  aria-label={
                    isDone
                      ? `Reopen task: ${task.title}`
                      : isToggling
                        ? "Updating task"
                        : `Mark complete: ${task.title}`
                  }
                  title={isDone ? "Mark incomplete" : "Mark complete"}
                >
                  {isToggling ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : isDone ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : null}
                </button>

                <button
                  type="button"
                  onClick={() => onOpenTask?.(task.id)}
                  disabled={!onOpenTask}
                  className="flex-1 min-w-0 text-left disabled:cursor-default"
                  title={onOpenTask ? `Open task: ${task.title}` : task.title}
                >
                  <div
                    className={cn(
                      "font-medium text-[#f4f4f5] truncate",
                      isDone && "line-through opacity-60",
                      onOpenTask && "hover:text-[#c084fc] transition-colors",
                    )}
                  >
                    {task.title}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    {task.assignee ? (
                      <TaskAssigneeBadge label={task.assignee} />
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[10px] text-[#71717a]">
                        Unassigned
                      </span>
                    )}
                    {due && (
                      <span
                        className={cn(
                          "inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-md border whitespace-nowrap",
                          due.variant === "overdue" &&
                            "text-[#ff3366] border-[#ff3366]/30 bg-[#ff3366]/10",
                          due.variant === "today" &&
                            "text-[#c084fc] border-[#c084fc]/30 bg-[#c084fc]/10",
                          due.variant === "soon" &&
                            "text-[#fbbf24] border-[#fbbf24]/30 bg-[#fbbf24]/10",
                          due.variant === "default" &&
                            "text-[#a1a1aa] border-white/10 bg-white/5",
                        )}
                      >
                        <Calendar className="h-2.5 w-2.5" />
                        {due.label}
                      </span>
                    )}
                    {recurringLabel && (
                      <span
                        className="inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-md border border-[#c084fc]/30 bg-[#c084fc]/10 text-[#c084fc] whitespace-nowrap max-w-[100px]"
                        title={recurringLabel}
                      >
                        <Repeat className="h-2.5 w-2.5 shrink-0" />
                        <span className="truncate">{recurringLabel}</span>
                      </span>
                    )}
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setPendingUnlink(task)}
                  className="opacity-70 group-hover:opacity-100 group-focus-within:opacity-100 p-2 hover:text-[#ff3366] focus-visible:text-[#ff3366] rounded hover:bg-white/10 touch-manipulation min-w-[40px] min-h-[40px] flex items-center justify-center shrink-0"
                  title="Unlink task"
                  aria-label={`Unlink task ${task.title}`}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            );
          })
        )}
      </div>

      <div className={cn("flex flex-col", compact ? "gap-2" : "gap-2")}>
        <select
          className="w-full text-sm bg-[#111114] border border-white/10 rounded-lg px-3 py-2 focus:outline-none focus:border-[#c084fc]/50 focus:ring-1 focus:ring-[#c084fc]/30 touch-manipulation"
          onChange={async (e) => {
            const taskId = e.target.value;
            if (taskId) {
              await onLinkTaskToNote(selectedNote.id, taskId);
              e.target.value = "";
            }
          }}
          defaultValue=""
        >
          <option value="">+ Link existing task...</option>
          {tasks
            .filter((t) => !linkedTaskIds.includes(t.id))
            .slice(0, 20)
            .map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
        </select>

        {compact ? (
          <div className="space-y-2">
            <input
              type="text"
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Create new task for this note…"
              className="input w-full text-sm px-3 py-2.5 rounded-xl min-h-0"
              disabled={isCreating || !onCreateTaskAndLink}
              aria-label="New task title"
            />
            {newTaskTitle.length > 0 && (
              <button
                type="button"
                onClick={() => void handleCreateTask()}
                disabled={!canAdd || isCreating || !onCreateTaskAndLink}
                className={cn(
                  "w-full rounded-xl text-sm font-medium px-4 py-2.5 transition",
                  canAdd && !isCreating ? "btn btn-primary" : "btn btn-secondary opacity-45",
                )}
              >
                {isCreating ? "Adding…" : "Add"}
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="flex gap-2">
              <input
                type="text"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Create new task for this note..."
                className="flex-1 text-sm bg-[#111114] border border-white/10 rounded-lg px-3 py-2 focus:outline-none focus:border-[#c084fc]/50 focus:ring-1 focus:ring-[#c084fc]/30 placeholder:text-[#52525b] touch-manipulation"
                disabled={isCreating || !onCreateTaskAndLink}
              />
              <button
                onClick={() => void handleCreateTask()}
                disabled={!newTaskTitle.trim() || isCreating || !onCreateTaskAndLink}
                className="btn btn-primary text-xs px-4 py-2 flex items-center gap-1.5 disabled:opacity-50 touch-manipulation"
                title="Create and link new task"
              >
                <Plus className="h-3.5 w-3.5" />
                Add
              </button>
            </div>
            <div className="text-[10px] text-[#52525b] px-1">
              Press Enter to create instantly
            </div>
          </>
        )}
      </div>

      <ConfirmationModal
        open={!!pendingUnlink}
        onOpenChange={(open) => !open && setPendingUnlink(null)}
        title="Unlink task from note?"
        highlight={pendingUnlink?.title}
        description="The task will remain in your workspace — only the link to this note is removed."
        confirmText="Unlink"
        variant="destructive"
        onConfirm={async () => {
          if (!pendingUnlink) return;
          await onUnlinkTaskFromNote(selectedNote.id, pendingUnlink.id);
          setPendingUnlink(null);
        }}
      />
    </div>
  );
}