"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Check, ChevronLeft, Eye, EyeOff, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useIsMobileViewport } from "@/lib/hooks/useIsMobileViewport";
import type { NotebookTask, NotebookTaskProgress, WorkspaceMember } from "@/types";
import { NotebookProgressComposer } from "./NotebookProgressComposer";
import { NotebookProgressTimeline } from "./NotebookProgressTimeline";

interface NotebookTasksPanelProps {
  tasks: NotebookTask[];
  progress: NotebookTaskProgress[];
  members: WorkspaceMember[];
  currentUserId?: string;
  selectedTaskId: string | null;
  onSelectTask: (id: string | null) => void;
  onAddTask: (title?: string) => void | Promise<unknown>;
  onToggleTask: (id: string) => void | Promise<unknown>;
  onUpdateTask: (id: string, title: string) => void | Promise<unknown>;
  onSetShowOnWorkspace: (id: string, showOnWorkspace: boolean) => void | Promise<unknown>;
  onRequestDeleteTask: (id: string) => void;
  onAddProgress: (taskId: string, body: string) => void | Promise<unknown>;
  onUpdateProgress: (id: string, body: string) => void | Promise<unknown>;
  onRequestDeleteProgress: (id: string) => void;
}

export function NotebookTasksPanel({
  tasks,
  progress,
  members,
  currentUserId,
  selectedTaskId,
  onSelectTask,
  onAddTask,
  onToggleTask,
  onUpdateTask,
  onSetShowOnWorkspace,
  onRequestDeleteTask,
  onAddProgress,
  onUpdateProgress,
  onRequestDeleteProgress,
}: NotebookTasksPanelProps) {
  const isMobile = useIsMobileViewport();
  const [newTitle, setNewTitle] = useState("");
  const [showCompleted, setShowCompleted] = useState(false);

  const openTasks = useMemo(() => tasks.filter((t) => !t.completed), [tasks]);
  const completedTasks = useMemo(() => tasks.filter((t) => t.completed), [tasks]);
  const completedCount = completedTasks.length;

  const visibleTasks = useMemo(() => {
    if (!showCompleted) return openTasks;
    return [...openTasks, ...completedTasks];
  }, [showCompleted, openTasks, completedTasks]);

  const selectedTask = useMemo(
    () => tasks.find((t) => t.id === selectedTaskId) ?? null,
    [tasks, selectedTaskId],
  );
  const taskProgress = useMemo(
    () => (selectedTaskId ? progress.filter((p) => p.taskId === selectedTaskId) : []),
    [progress, selectedTaskId],
  );

  useEffect(() => {
    if (completedCount === 0 && showCompleted) setShowCompleted(false);
  }, [completedCount, showCompleted]);

  useEffect(() => {
    if (!selectedTaskId) return;
    const stillExists = tasks.some((t) => t.id === selectedTaskId);
    if (!stillExists) {
      onSelectTask(null);
      return;
    }
    if (!showCompleted) {
      const selected = tasks.find((t) => t.id === selectedTaskId);
      if (selected?.completed) onSelectTask(null);
    }
  }, [tasks, selectedTaskId, showCompleted, onSelectTask]);

  const handleAdd = () => {
    const title = newTitle.trim();
    if (!title) return;
    void onAddTask(title);
    setNewTitle("");
  };

  const handleToggle = async (task: NotebookTask) => {
    const completing = !task.completed;
    await onToggleTask(task.id);
    if (completing) {
      toast.success("Task completed", { description: task.title });
      if (!showCompleted && selectedTaskId === task.id) onSelectTask(null);
    } else {
      toast.success("Task reopened", { description: task.title });
    }
  };

  const showMobileDetail = isMobile && !!selectedTask;

  return (
    <div className="notebooks-section-panel flex flex-1 min-h-0 min-w-0">
      <div
        className={cn(
          "w-full md:w-72 lg:w-80 shrink-0 flex flex-col min-h-0 border-r border-border-glass bg-bg",
          showMobileDetail && "hidden",
        )}
      >
        <div className="shrink-0 p-3 border-b border-border-glass space-y-2">
          <div className="flex gap-2">
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAdd();
              }}
              placeholder="Quick add task…"
              className="flex-1 min-w-0 bg-bg-secondary border border-border-glass rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-neon-purple/40 placeholder:text-text-faint"
            />
            <button
              type="button"
              onClick={handleAdd}
              disabled={!newTitle.trim()}
              className="shrink-0 flex items-center justify-center rounded-xl border border-neon-purple/30 bg-neon-purple/10 min-h-[40px] min-w-[40px] text-neon-purple-tint disabled:opacity-40"
              aria-label="Add task"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
          {completedCount > 0 ? (
            <button
              type="button"
              onClick={() => setShowCompleted((v) => !v)}
              className={cn(
                "inline-flex w-full items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition",
                showCompleted
                  ? "border-neon-purple/40 bg-neon-purple/12 text-neon-purple-tint"
                  : "border-border-glass bg-surface-hover/60 text-text-secondary hover:text-text-primary hover:border-neon-purple/30",
              )}
              aria-pressed={showCompleted}
              aria-label={
                showCompleted
                  ? "Hide completed tasks"
                  : `Show ${completedCount} completed task${completedCount === 1 ? "" : "s"}`
              }
            >
              {showCompleted ? (
                <EyeOff className="h-3.5 w-3.5 shrink-0" aria-hidden />
              ) : (
                <Eye className="h-3.5 w-3.5 shrink-0" aria-hidden />
              )}
              <Check className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
              <span>
                {showCompleted
                  ? "Hide completed"
                  : `View ${completedCount} completed`}
              </span>
            </button>
          ) : null}
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto">
          {tasks.length === 0 ? (
            <p className="text-sm text-text-muted px-4 py-6 text-center">No tasks yet.</p>
          ) : visibleTasks.length === 0 ? (
            <p className="text-sm text-text-muted px-4 py-6 text-center">
              All caught up. View completed above if you need them.
            </p>
          ) : (
            <ul className="py-1">
              {visibleTasks.map((task) => {
                const isSelected = selectedTaskId === task.id;
                return (
                  <li key={task.id}>
                    <div
                      className={cn(
                        "files-list-item flex items-center gap-2 px-3 py-2.5 cursor-pointer transition relative",
                        isSelected && "files-list-item--selected",
                        !isSelected && "hover:bg-surface-hover",
                      )}
                      aria-selected={isSelected}
                      onClick={() => onSelectTask(task.id)}
                    >
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleToggle(task);
                        }}
                        className={cn(
                          "shrink-0 relative z-[1] h-5 w-5 rounded border flex items-center justify-center transition bg-bg",
                          task.completed
                            ? "bg-emerald-500/20 border-emerald-400/50 text-emerald-400"
                            : isSelected
                              ? "border-neon-purple/55 text-transparent"
                              : "border-border-glass text-transparent hover:border-neon-purple/40",
                        )}
                        aria-label={task.completed ? "Mark incomplete" : "Mark complete"}
                      >
                        <Check className="h-3 w-3" />
                      </button>
                      <span
                        className={cn(
                          "flex-1 min-w-0 text-sm truncate relative z-[1]",
                          task.completed && "line-through text-text-muted",
                        )}
                      >
                        {task.title}
                      </span>
                      {task.showOnWorkspace ? (
                        <span
                          className="shrink-0 relative z-[1] rounded-md border border-neon-purple/30 bg-neon-purple/10 px-1.5 py-0.5 text-[10px] font-semibold text-neon-purple-tint"
                          title="Shown on Tasks page"
                        >
                          Tasks
                        </span>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <div
        className={cn(
          "flex-1 flex-col min-h-0 min-w-0",
          selectedTask ? "flex" : "hidden md:flex",
        )}
      >
        {selectedTask ? (
          <>
            {isMobile && (
              <div className="shrink-0 px-2 py-2 border-b border-border-glass flex items-center">
                <button
                  type="button"
                  onClick={() => onSelectTask(null)}
                  className="flex items-center gap-1 rounded-xl px-3 py-2 text-sm font-medium text-text-secondary hover:bg-surface-hover min-h-[44px]"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Tasks
                </button>
              </div>
            )}
            <div className="shrink-0 px-4 py-3 border-b border-border-glass space-y-3">
              <div className="flex items-center gap-2">
                <input
                  defaultValue={selectedTask.title}
                  key={selectedTask.id}
                  onBlur={(e) => {
                    const next = e.target.value.trim() || selectedTask.title;
                    if (!e.target.value.trim()) e.target.value = selectedTask.title;
                    if (next !== selectedTask.title) void onUpdateTask(selectedTask.id, next);
                  }}
                  className="flex-1 min-w-0 bg-transparent text-lg font-semibold focus:outline-none text-text-primary"
                  aria-label="Task title"
                />
                <button
                  type="button"
                  onClick={() => onRequestDeleteTask(selectedTask.id)}
                  className="p-2 rounded-lg text-text-muted hover:text-red-400 hover:bg-surface-hover"
                  aria-label="Delete task"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={selectedTask.showOnWorkspace === true}
                  onChange={(e) => {
                    void onSetShowOnWorkspace(selectedTask.id, e.target.checked);
                  }}
                  className="h-4 w-4 accent-neon-purple"
                />
                <span className="text-sm text-text-secondary">
                  Show on workspace Tasks page
                </span>
              </label>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto">
              <NotebookProgressTimeline
                entries={taskProgress}
                members={members}
                currentUserId={currentUserId}
                onUpdateEntry={onUpdateProgress}
                onRequestDeleteEntry={onRequestDeleteProgress}
              />
            </div>
            <NotebookProgressComposer
              onSubmit={async (body) => {
                await onAddProgress(selectedTask.id, body);
              }}
            />
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-text-muted p-8 text-center">
            Select a task to log progress, or add one from the list.
          </div>
        )}
      </div>
    </div>
  );
}
