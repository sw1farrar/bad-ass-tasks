"use client";

import React from "react";
import { NodeViewWrapper } from "@tiptap/react";
import { CheckSquare, Clock, AlertCircle, Calendar } from "lucide-react";
import { cn, dueDateFromUserInput, formatDueDate } from "@/lib/utils";
import { parseLocalDate, toLocalDateString } from "@/lib/datetime";

interface TaskEmbedNodeViewProps {
  node: {
    attrs: {
      taskId?: string | null;
      title?: string;
      status?: string;
      priority?: string;
    };
  };
  updateAttributes: (attrs: Record<string, any>) => void;
  selected?: boolean;
  tasks?: any[]; // Live tasks passed from parent
  onClick?: (taskId: string) => void; // Open task modal
  onToggleStatus?: (taskId: string) => Promise<void>; // Inline status cycle
  onUpdateTask?: (taskId: string, updates: Partial<any>) => Promise<void>; // For inline title/due edits
}

/**
 * React NodeView for TaskEmbed (Milestone 2)
 *
 * Renders a rich, interactive task card inside the editor.
 * Currently uses stored attributes. Future step: receive live task data
 * from parent NotesView and enable inline editing + navigation.
 */
export function TaskEmbedNodeView({ node, selected, tasks = [], onClick, onToggleStatus, onUpdateTask }: TaskEmbedNodeViewProps) {
  const attrs = node.attrs;
  const taskId = attrs.taskId;

  // Prefer live task data if available (by taskId)
  const liveTask = taskId ? tasks.find((t: any) => t.id === taskId) : null;

  const isDeleted = !!taskId && !liveTask;

  const title = liveTask?.title ?? attrs.title;
  const status = liveTask?.status ?? attrs.status;
  const priority = liveTask?.priority ?? attrs.priority;
  const dueDate = liveTask?.dueDate ?? null;
  const linkedNoteCount = liveTask?.linkedNoteIds?.length ?? 0;
  const assignee = liveTask?.assignee ?? null;

  const isDone = status === "done";

  // Inline editing state for richer live cards
  const [isEditingTitle, setIsEditingTitle] = React.useState(false);
  const [editingTitle, setEditingTitle] = React.useState(title || "");

  // Harden two-way sync: if live title changes externally (e.g. TaskModal or another embed), reset local editor state
  React.useEffect(() => {
    if (!isEditingTitle) {
      setEditingTitle(title || "");
    }
  }, [title, isEditingTitle]);

  const handleClick = (e: React.MouseEvent) => {
    // If clicking the status badge, don't open the modal
    if ((e.target as HTMLElement).closest(".status-badge")) {
      return;
    }
    if (taskId && onClick) {
      onClick(taskId);
    }
  };

  const handleStatusClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (taskId && onToggleStatus) {
      await onToggleStatus(taskId);
    }
  };

  const getPriorityColor = (p?: string) => {
    switch (p) {
      case "P0": return "text-red-400 bg-red-500/10 border-red-500/30";
      case "P1": return "text-orange-400 bg-orange-500/10 border-orange-500/30";
      case "P2": return "text-yellow-400 bg-yellow-500/10 border-yellow-500/30";
      default: return "text-[#71717a] bg-white/5 border-white/20";
    }
  };

  const getStatusColor = (s?: string) => {
    if (s === "done") return "text-emerald-400";
    if (s === "doing") return "text-[#c084fc]";
    return "text-[#71717a]";
  };

  return (
    <NodeViewWrapper
      as="div"
      className={cn(
        "task-embed-node my-3 block overflow-hidden rounded-2xl border transition-all cursor-pointer",
        isDeleted 
          ? "bg-red-950/30 border-red-500/40 opacity-70" 
          : isDone 
            ? "bg-[#0a0a0f]/70 border-emerald-500/30 opacity-80" 
            : "bg-[#0a0a0f] border-white/10 hover:border-white/20 hover:bg-[#111114]",
        selected && !isDone && !isDeleted && "border-[#c084fc] shadow-[0_0_0_1px_#c084fc]"
      )}
      data-task-id={taskId}
      onClick={handleClick}
    >
      <div className="flex items-start gap-3 p-4">
        {/* Icon */}
        <div className={cn("mt-0.5", isDone ? "text-emerald-400" : "text-[#c084fc]")}>
          {isDone ? <CheckSquare className="h-5 w-5" /> : <CheckSquare className="h-5 w-5" />}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div 
            className={cn(
              "font-semibold text-[15px] leading-tight tracking-[-0.2px] text-[#f4f4f5] group/title",
              isDone && "line-through opacity-60"
            )}
            onDoubleClick={(e) => {
              e.stopPropagation();
              if (taskId && onUpdateTask && !isDone) {
                setIsEditingTitle(true);
                setEditingTitle(title || "");
              }
            }}
          >
            {isEditingTitle ? (
              <input
                type="text"
                value={editingTitle}
                onChange={(e) => setEditingTitle(e.target.value)}
                onBlur={async () => {
                  if (taskId && onUpdateTask && editingTitle.trim() !== (title || "")) {
                    await onUpdateTask(taskId, { title: editingTitle.trim() });
                  }
                  setIsEditingTitle(false);
                }}
                onKeyDown={async (e) => {
                  if (e.key === "Enter") {
                    if (taskId && onUpdateTask && editingTitle.trim() !== (title || "")) {
                      await onUpdateTask(taskId, { title: editingTitle.trim() });
                    }
                    setIsEditingTitle(false);
                  }
                  if (e.key === "Escape") {
                    setIsEditingTitle(false);
                    setEditingTitle(title || "");
                  }
                }}
                className="bg-transparent border border-[#c084fc]/50 rounded px-1 py-0.5 w-full text-inherit focus:outline-none focus:border-[#c084fc]"
                autoFocus
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <>
                {title || "Untitled Task"}
                {taskId && onUpdateTask && !isDone && (
                  <span 
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsEditingTitle(true);
                      setEditingTitle(title || "");
                    }}
                    className="ml-1 opacity-0 group-hover/title:opacity-50 hover:opacity-100 text-[#c084fc] text-[10px] cursor-pointer"
                  >
                    ✎
                  </span>
                )}
              </>
            )}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            {/* Status - now clickable */}
            <button
              onClick={handleStatusClick}
              className={cn(
                "status-badge flex items-center gap-1 rounded-md px-2 py-0.5 border transition hover:scale-[1.02] active:scale-[0.98]",
                getStatusColor(status)
              )}
            >
              <Clock className="h-3 w-3" />
              <span className="font-mono uppercase tracking-widest">{status || "todo"}</span>
            </button>

            {/* Priority - now inline editable (click to cycle) */}
            <div 
              className={cn("flex items-center gap-1 rounded-md px-2 py-0.5 border font-mono cursor-pointer hover:opacity-80", getPriorityColor(priority))}
              onClick={async (e) => {
                e.stopPropagation();
                if (!taskId || !onUpdateTask) return;
                const priorities = ["P0", "P1", "P2"];
                const current = priority || "P2";
                const next = priorities[(priorities.indexOf(current) + 1) % priorities.length];
                await onUpdateTask(taskId, { priority: next });
              }}
              title="Click to cycle priority"
            >
              <AlertCircle className="h-3 w-3" />
              {priority || "P2"}
            </div>

            {/* Due date - now editable */}
            <div 
              className="flex items-center gap-1 rounded-md px-2 py-0.5 border border-white/10 text-[#71717a] hover:border-white/30 cursor-pointer"
              onClick={async (e) => {
                e.stopPropagation();
                if (!taskId || !onUpdateTask) return;
                const newDue = prompt(
                  "Set due date (YYYY-MM-DD) or leave empty to clear:",
                  dueDate && parseLocalDate(dueDate) ? toLocalDateString(parseLocalDate(dueDate)!) : ""
                );
                if (newDue !== null) {
                  const updates: Record<string, string | null> = {};
                  if (newDue.trim() === "") {
                    updates.dueDate = null;
                  } else {
                    const stored = dueDateFromUserInput(newDue);
                    if (!stored) {
                      alert("Invalid date format. Use YYYY-MM-DD.");
                      return;
                    }
                    updates.dueDate = stored;
                  }
                  await onUpdateTask(taskId, updates);
                }
              }}
              title="Click to edit due date"
            >
              <Calendar className="h-3 w-3" />
              <span>{dueDate ? (formatDueDate(dueDate)?.label ?? "Set due") : "Set due"}</span>
            </div>

            {/* Linked notes count */}
            {linkedNoteCount > 0 && (
              <div className="flex items-center gap-1 rounded-md px-2 py-0.5 border border-white/10 text-[#c084fc] text-[10px]">
                📝 {linkedNoteCount}
              </div>
            )}

            {assignee && (
              <div
                className="flex items-center gap-1 rounded-md px-2 py-0.5 border border-white/10 text-[#71717a] text-[10px]"
                title={`Assigned to ${assignee}`}
              >
                👤 {assignee}
              </div>
            )}

            {taskId && (
              <div className="ml-auto text-[10px] font-mono text-[#71717a] opacity-60">
                #{taskId.slice(0, 8)}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer hint */}
      <div className="border-t border-white/10 bg-[#111114]/60 px-4 py-2 text-[10px] text-[#71717a] flex items-center gap-2">
        {isDeleted ? (
          <>
            <span className="text-red-400 font-semibold">⚠ Task deleted/archived</span>
            {onUpdateTask && taskId && (
              <button 
                onClick={(e) => { 
                  e.stopPropagation(); 
                  onUpdateTask(taskId, { linkedNoteIds: (liveTask?.linkedNoteIds || []).filter((id: string) => id !== (node.attrs as any).noteId) }); 
                }} 
                className="text-red-400 hover:underline ml-auto text-[9px] px-1 border border-red-500/30 rounded"
              >
                Unlink
              </button>
            )}
          </>
        ) : (
          <>
            <span>Embedded Task</span>
            <span className="text-[#c084fc]">(click card to open • click status to toggle • dbl-click title)</span>
          </>
        )}
      </div>
    </NodeViewWrapper>
  );
}