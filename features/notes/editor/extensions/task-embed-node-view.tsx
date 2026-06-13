"use client";

import React from "react";
import { NodeViewWrapper } from "@tiptap/react";
import { CheckSquare, Clock, AlertCircle, Calendar, FolderOpen } from "lucide-react";
import { cn, dueDateFromUserInput, formatDueDate } from "@/lib/utils";
import { parseLocalDate, toLocalDateString } from "@/lib/datetime";
import { TaskFolderPicker } from "@/features/tasks/components/TaskFolderPicker";
import { TaskStarButton } from "@/features/tasks/components/TaskStarButton";
import { useTaskStore } from "@/store/useTaskStore";

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
  const getTaskFolders = useTaskStore((s) => s.getTaskFolders);
  const folders = getTaskFolders();
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
  const starred = !!liveTask?.starred;
  const folderId = liveTask?.folderId ?? null;
  const folderName = folders.find((f) => f.id === folderId)?.name;

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
      default: return "text-text-muted bg-surface-hover border-border-glass";
    }
  };

  const getStatusColor = (s?: string) => {
    if (s === "done") return "text-emerald-400";
    if (s === "doing") return "text-neon-purple";
    return "text-text-muted";
  };

  return (
    <NodeViewWrapper
      as="div"
      className={cn(
        "task-embed-node my-3 block overflow-hidden rounded-2xl border transition-all cursor-pointer",
        isDeleted 
          ? "bg-red-950/30 border-red-500/40 opacity-70" 
          : isDone 
            ? "bg-bg/70 border-emerald-500/30 opacity-80" 
            : "bg-bg border-border-glass hover:border-border-glass hover:bg-bg-secondary",
        selected && !isDone && !isDeleted && "border-neon-purple shadow-[0_0_0_1px_#c084fc]"
      )}
      data-task-id={taskId}
      onClick={handleClick}
    >
      <div className="flex items-start gap-3 p-4">
        {/* Icon */}
        <div className={cn("mt-0.5", isDone ? "text-emerald-400" : "text-neon-purple")}>
          {isDone ? <CheckSquare className="h-5 w-5" /> : <CheckSquare className="h-5 w-5" />}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div 
            className={cn(
              "font-semibold text-[15px] leading-tight tracking-[-0.2px] text-text-primary group/title",
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
                className="bg-transparent border border-neon-purple/50 rounded px-1 py-0.5 w-full text-inherit focus:outline-none focus:border-neon-purple"
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
                    className="ml-1 opacity-0 group-hover/title:opacity-50 hover:opacity-100 text-neon-purple text-[10px] cursor-pointer"
                  >
                    ✎
                  </span>
                )}
              </>
            )}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            {taskId && onUpdateTask ? (
              <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                <TaskStarButton
                  size="sm"
                  starred={starred}
                  onToggle={() => void onUpdateTask(taskId, { starred: !starred })}
                />
                {folders.length > 0 ? (
                  <TaskFolderPicker
                    compact
                    folders={folders}
                    value={folderId}
                    className="min-w-[7.5rem] max-w-[10rem]"
                    onChange={(nextFolderId) => void onUpdateTask(taskId, { folderId: nextFolderId })}
                  />
                ) : folderName ? (
                  <span className="inline-flex items-center gap-1 rounded-md border border-border-glass bg-surface-inset px-2 py-0.5 text-[10px] text-text-secondary">
                    <FolderOpen className="h-3 w-3 text-neon-purple/80" aria-hidden />
                    {folderName}
                  </span>
                ) : null}
              </div>
            ) : null}

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
              className="flex items-center gap-1 rounded-md px-2 py-0.5 border border-border-glass text-text-muted hover:border-border-glass cursor-pointer"
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
              <div className="flex items-center gap-1 rounded-md px-2 py-0.5 border border-border-glass text-neon-purple text-[10px]">
                📝 {linkedNoteCount}
              </div>
            )}

            {assignee && (
              <div
                className="flex items-center gap-1 rounded-md px-2 py-0.5 border border-border-glass text-text-muted text-[10px]"
                title={`Assigned to ${assignee}`}
              >
                👤 {assignee}
              </div>
            )}

            {taskId && (
              <div className="ml-auto text-[10px] font-mono text-text-muted opacity-60">
                #{taskId.slice(0, 8)}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer hint */}
      <div className="border-t border-border-glass bg-bg-secondary/60 px-4 py-2 text-[10px] text-text-muted flex items-center gap-2">
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
            <span className="text-neon-purple">(click card to open • click status to toggle • dbl-click title)</span>
          </>
        )}
      </div>
    </NodeViewWrapper>
  );
}