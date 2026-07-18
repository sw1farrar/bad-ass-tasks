import { describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import {
  buildTaskCompletionUndoContext,
  showTaskCompletionFeedback,
} from "@/features/tasks/lib/taskCompletionFeedback";
import type { Task } from "@/types";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
  },
}));

vi.mock("@/lib/utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/utils")>();
  return {
    ...actual,
    triggerHaptic: vi.fn(),
  };
});

const baseTask: Task = {
  id: "task-1",
  workspaceId: "ws-1",
  title: "Ship undo toast",
  description: "",
  status: "todo",
  priority: "P3",
  tags: [],
  linkedNoteIds: [],
  createdAt: "2026-01-01T00:00:00.000Z",
};

describe("taskCompletionFeedback", () => {
  it("buildTaskCompletionUndoContext captures workspace metadata", () => {
    expect(buildTaskCompletionUndoContext(baseTask, "Acme")).toEqual({
      task: baseTask,
      workspaceId: "ws-1",
      workspaceName: "Acme",
    });
  });

  it("shows completed toast with undo action", () => {
    const undoTaskCompletion = vi.fn().mockResolvedValue(true);
    const undoFallback = buildTaskCompletionUndoContext(baseTask, "Acme");
    const triggerCelebration = vi.fn();
    const onCompleted = vi.fn();

    showTaskCompletionFeedback("completed", baseTask, {
      undoTaskCompletion,
      undoFallback,
      triggerCelebration,
      onCompleted,
    });

    expect(triggerCelebration).toHaveBeenCalledOnce();
    expect(onCompleted).toHaveBeenCalledOnce();
    expect(toast.success).toHaveBeenCalledWith(
      "Task completed",
      expect.objectContaining({
        description: "Ship undo toast",
        duration: 10000,
        action: expect.objectContaining({ label: "Undo" }),
      }),
    );
  });

  it("fires confetti when a recurring task advances", () => {
    const undoTaskCompletion = vi.fn().mockResolvedValue(true);
    const undoFallback = buildTaskCompletionUndoContext(baseTask, "Acme");
    const triggerCelebration = vi.fn();
    const advancedTask: Task = {
      ...baseTask,
      dueDate: "2026-07-25",
      recurringRule: "FREQ=WEEKLY",
    };

    showTaskCompletionFeedback("advanced", baseTask, {
      undoTaskCompletion,
      undoFallback,
      triggerCelebration,
      advancedTask,
    });

    expect(triggerCelebration).toHaveBeenCalledOnce();
    expect(toast.success).toHaveBeenCalledWith(
      "Recurrence advanced",
      expect.objectContaining({
        duration: 10000,
        action: expect.objectContaining({ label: "Undo" }),
      }),
    );
  });
});