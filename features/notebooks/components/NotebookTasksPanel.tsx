"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Check, ChevronLeft, Plus, Trash2 } from "lucide-react";
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
  onRequestDeleteTask,
  onAddProgress,
  onUpdateProgress,
  onRequestDeleteProgress,
}: NotebookTasksPanelProps) {
  const isMobile = useIsMobileViewport();
  const [newTitle, setNewTitle] = useState("");
  const selectedTask = useMemo(
    () => tasks.find((t) => t.id === selectedTaskId) ?? null,
    [tasks, selectedTaskId],
  );
  const taskProgress = useMemo(
    () => (selectedTaskId ? progress.filter((p) => p.taskId === selectedTaskId) : []),
    [progress, selectedTaskId],
  );

  useEffect(() => {
    if (selectedTaskId && !tasks.some((t) => t.id === selectedTaskId)) {
      onSelectTask(null);
    }
  }, [tasks, selectedTaskId, onSelectTask]);

  const handleAdd = () => {
    const title = newTitle.trim();
    if (!title) return;
    void onAddTask(title);
    setNewTitle("");
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
        <div className="shrink-0 p-3 border-b border-border-glass">
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
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto">
          {tasks.length === 0 ? (
            <p className="text-sm text-text-muted px-4 py-6 text-center">No tasks yet.</p>
          ) : (
            <ul className="py-1">
              {tasks.map((task) => (
                <li key={task.id}>
                  <div
                    className={cn(
                      "flex items-center gap-2 px-3 py-2.5 cursor-pointer transition",
                      selectedTaskId === task.id
                        ? "bg-neon-purple/10"
                        : "hover:bg-surface-hover",
                    )}
                    onClick={() => onSelectTask(task.id)}
                  >
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        void onToggleTask(task.id);
                      }}
                      className={cn(
                        "shrink-0 h-5 w-5 rounded border flex items-center justify-center transition",
                        task.completed
                          ? "bg-emerald-500/20 border-emerald-400/50 text-emerald-400"
                          : "border-border-glass text-transparent hover:border-neon-purple/40",
                      )}
                      aria-label={task.completed ? "Mark incomplete" : "Mark complete"}
                    >
                      <Check className="h-3 w-3" />
                    </button>
                    <span
                      className={cn(
                        "flex-1 min-w-0 text-sm truncate",
                        task.completed && "line-through text-text-muted",
                      )}
                    >
                      {task.title}
                    </span>
                  </div>
                </li>
              ))}
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
            <div className="shrink-0 px-4 py-3 border-b border-border-glass flex items-center gap-2">
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