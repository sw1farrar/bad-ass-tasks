"use client";

import React, { useState } from "react";
import { Link as LinkIcon, X, Plus, Calendar, Repeat } from "lucide-react";
import { Note, Task } from "@/types";
import { cn, formatDueDate, getRecurringLabel } from "@/lib/utils";
import { ConfirmationModal } from "@/components/ConfirmationModal";

interface LinkedTasksPanelProps {
  selectedNote: Note;
  tasks: Task[];
  onLinkTaskToNote: (noteId: string, taskId: string) => Promise<void>;
  onUnlinkTaskFromNote: (noteId: string, taskId: string) => Promise<void>;
  onOpenTask?: (taskId: string) => void;
  /** Optional: create a brand new task and automatically link it to this note */
  onCreateTaskAndLink?: (noteId: string, title: string) => Promise<string | null>;
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
  onCreateTaskAndLink,
}: LinkedTasksPanelProps) {
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [pendingUnlink, setPendingUnlink] = useState<Task | null>(null);

  const linkedTaskIds = selectedNote.linkedTaskIds || [];
  const linkedTasks = linkedTaskIds
    .map(id => tasks.find(t => t.id === id))
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
      handleCreateTask();
    }
    if (e.key === "Escape") {
      setNewTaskTitle("");
    }
  };

  return (
    <div className="border-t border-white/10 px-6 py-3 bg-[#0a0a0f]/50">
      {/* Linked Tasks — primary management surface below the note editor */}
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-medium text-[#71717a] flex items-center gap-2">
          <LinkIcon className="h-3.5 w-3.5" />
          LINKED TASKS
        </div>
        <div className="text-[10px] text-[#c084fc] font-mono">
          {linkedTaskIds.length} linked
        </div>
      </div>

      {/* List of linked tasks */}
      <div className="space-y-1 mb-3">
        {linkedTasks.length === 0 ? (
          <div className="text-[11px] text-[#71717a] italic py-1">No tasks linked yet</div>
        ) : (
          linkedTasks.map((task) => {
            const due = formatDueDate(task.dueDate);
            const recurringLabel = task.recurringRule
              ? getRecurringLabel(task.recurringRule)
              : "";

            return (
            <div
              key={task.id}
              className="flex items-center justify-between text-sm group bg-white/5 rounded-lg px-3 py-2 hover:bg-white/[0.07] transition-colors"
            >
              <button
                type="button"
                onClick={() => onOpenTask?.(task.id)}
                disabled={!onOpenTask}
                className="flex-1 min-w-0 flex items-center gap-2 text-left hover:text-[#c084fc] transition-colors disabled:cursor-default disabled:hover:text-[#f4f4f5]"
                title={onOpenTask ? `Open task: ${task.title}` : task.title}
              >
                <span className="font-medium text-[#f4f4f5] truncate min-w-0 group-hover:text-[#c084fc]">
                  {task.title}
                </span>
                <span className="flex items-center gap-1 shrink-0">
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
                          "text-[#a1a1aa] border-white/10 bg-white/5"
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
                </span>
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

      {/* Link existing + Create new — side by side, compact */}
      <div className="flex flex-col gap-2">
        {/* Link existing task */}
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
            .filter(t => !linkedTaskIds.includes(t.id))
            .slice(0, 20)
            .map(t => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
        </select>

        {/* Create brand new task + link it immediately */}
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
            onClick={handleCreateTask}
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
