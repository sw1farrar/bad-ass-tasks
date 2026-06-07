"use client";

import React, { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { cn, formatDueDate, getRecurringLabel } from "@/lib/utils";
import type { Task } from "@/types";
import { TaskRow } from "./TaskRow";

export interface TasksTableProps {
  tasks: Task[];
  taskLoadingStates?: Record<string, boolean>;
  onOpenTask: (task: Task) => void;
  onComplete: (id: string) => void;
  onAddTask: (title: string) => Promise<unknown>;
  onSwipeComplete?: (id: string) => void;
}

export function TasksTable({
  tasks,
  taskLoadingStates,
  onOpenTask,
  onComplete,
  onAddTask,
  onSwipeComplete,
}: TasksTableProps) {
  const [quickTitle, setQuickTitle] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const handleQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = quickTitle.trim();
    if (!title || isAdding) return;
    setIsAdding(true);
    try {
      await onAddTask(title);
      setQuickTitle("");
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 min-h-0">
      <form onSubmit={handleQuickAdd} className="flex flex-col sm:flex-row gap-2">
        <input
          id="task-quick-add"
          value={quickTitle}
          onChange={(e) => setQuickTitle(e.target.value)}
          placeholder="Add a task…"
          disabled={isAdding}
          className="input flex-1 px-4 py-2.5 rounded-xl text-sm min-h-[44px]"
          aria-label="Quick add task"
        />
        <button
          type="submit"
          disabled={isAdding || !quickTitle.trim()}
          className="btn btn-primary px-4 py-2.5 rounded-xl text-sm shrink-0 disabled:opacity-50 min-h-[44px] sm:w-auto w-full"
        >
          {isAdding ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
        </button>
      </form>

      <div className="md:hidden space-y-1">
        {tasks.length === 0 ? (
          <div className="p-8 text-center text-[#71717a] text-sm rounded-2xl border border-white/10 bg-white/[0.02]">
            No tasks yet.
          </div>
        ) : (
          tasks.map((task) => {
            const due = formatDueDate(task.dueDate);
            const isDone = task.status === "done";
            const loading = !!taskLoadingStates?.[task.id];
            return (
              <TaskRow
                key={task.id}
                task={task}
                isDone={isDone}
                isOpLoading={loading}
                due={due}
                onOpen={onOpenTask}
                onComplete={onComplete}
                onSwipeComplete={onSwipeComplete}
              />
            );
          })
        )}
      </div>

      <div className="hidden md:block rounded-2xl border border-white/10 overflow-hidden bg-white/[0.02]">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wide text-[#71717a] border-b border-white/10 bg-white/[0.03]">
                <th className="w-10 p-3 font-medium" scope="col" />
                <th className="p-3 font-medium min-w-[200px]" scope="col">
                  Title
                </th>
                <th className="p-3 font-medium w-24 hidden md:table-cell" scope="col">
                  Status
                </th>
                <th className="p-3 font-medium w-28 hidden lg:table-cell" scope="col">
                  Due
                </th>
                <th className="p-3 font-medium w-32 hidden xl:table-cell" scope="col">
                  Assignee
                </th>
              </tr>
            </thead>
            <tbody>
              {tasks.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-[#71717a] text-sm">
                    No tasks yet.
                  </td>
                </tr>
              ) : (
                tasks.map((task) => {
                  const due = formatDueDate(task.dueDate);
                  const isDone = task.status === "done";
                  const loading = !!taskLoadingStates?.[task.id];

                  return (
                    <tr
                      key={task.id}
                      onClick={() => onOpenTask(task)}
                      className={cn(
                        "border-b border-white/5 cursor-pointer transition-colors",
                        "hover:bg-white/[0.04]",
                        isDone && "opacity-60"
                      )}
                    >
                      <td className="p-3 align-middle" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => !loading && onComplete(task.id)}
                          disabled={loading}
                          className={cn(
                            "flex h-6 w-6 items-center justify-center rounded-full border transition",
                            isDone
                              ? "bg-[#00ff9f] border-[#c084fc] text-black"
                              : "border-[#3a3a42] hover:border-[#c084fc]"
                          )}
                          aria-label={isDone ? "Reopen task" : "Mark complete"}
                        >
                          {loading ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : isDone ? (
                            <Check className="h-3 w-3" />
                          ) : null}
                        </button>
                      </td>
                      <td className="p-3 align-middle min-w-0">
                        <div
                          className={cn(
                            "font-medium truncate",
                            isDone && "line-through text-[#71717a]"
                          )}
                        >
                          {task.title}
                        </div>
                        {task.recurringRule && (
                          <span
                            className="text-[10px] text-[#c084fc]/80 flex items-center gap-0.5"
                            title={getRecurringLabel(task.recurringRule)}
                          >
                            ↻ {getRecurringLabel(task.recurringRule)}
                          </span>
                        )}
                      </td>
                      <td className="p-3 align-middle hidden md:table-cell capitalize text-[#a1a1aa] text-xs">
                        {task.status}
                      </td>
                      <td className="p-3 align-middle hidden lg:table-cell">
                        {due ? (
                          <span
                            className={cn(
                              "text-xs font-medium",
                              due.variant === "overdue" && "text-[#ff3366]",
                              due.variant === "today" && "text-[#c084fc]"
                            )}
                          >
                            {due.label}
                          </span>
                        ) : (
                          <span className="text-[#71717a]">—</span>
                        )}
                      </td>
                      <td className="p-3 align-middle hidden xl:table-cell text-xs text-[#a1a1aa] truncate max-w-[8rem]">
                        {task.assignee ? (
                          <span className="inline-flex items-center gap-1.5">
                            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#c084fc]/15 text-[#c084fc] text-[10px] font-medium">
                              {task.assignee === "You" ? "Y" : task.assignee.charAt(0).toUpperCase()}
                            </span>
                            <span className="truncate">{task.assignee}</span>
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}