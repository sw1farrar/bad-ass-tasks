import { toast } from "sonner";
import type { Task } from "@/types";
import { formatLocalDateShort, triggerHaptic } from "@/lib/utils";

export type TaskCompletionUndoContext = {
  task: Task;
  workspaceId: string;
  workspaceName: string;
};

export function buildTaskCompletionUndoContext(
  task: Task,
  workspaceName: string,
): TaskCompletionUndoContext {
  return {
    task,
    workspaceId: task.workspaceId,
    workspaceName,
  };
}

export function showTaskCompletionFeedback(
  result: "advanced" | "completed",
  taskBeforeComplete: Task,
  opts: {
    undoTaskCompletion: (id: string, fallback: TaskCompletionUndoContext) => Promise<boolean>;
    undoFallback: TaskCompletionUndoContext;
    triggerCelebration?: () => void;
    onCompleted?: () => void;
    advancedTask?: Task | null;
  },
): void {
  const undoAction = {
    label: "Undo",
    onClick: () => {
      void opts.undoTaskCompletion(taskBeforeComplete.id, opts.undoFallback).then((ok) => {
        if (ok) {
          triggerHaptic("light");
        } else {
          toast.error("Could not undo", { description: "Try reopening the task manually." });
        }
      });
    },
  };

  // Same confetti for one-time completes and recurring advances
  opts.triggerCelebration?.();

  if (result === "advanced") {
    const nextLabel = opts.advancedTask?.dueDate
      ? formatLocalDateShort(opts.advancedTask.dueDate)
      : "";
    toast.success("Completed", {
      description: `${taskBeforeComplete.title} saved to Completed${nextLabel ? ` · next ${nextLabel}` : ""}`,
      duration: 10000,
      action: undoAction,
    });
    return;
  }

  toast.success("Task completed", {
    description: taskBeforeComplete.title,
    duration: 10000,
    action: undoAction,
  });
  opts.onCompleted?.();
}