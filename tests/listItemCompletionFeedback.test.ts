import { describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import {
  LIST_ITEM_COMPLETION_TOAST_DURATION_MS,
  showListItemCompletionFeedback,
  showListItemPendingFeedback,
} from "@/features/lists/lib/listItemCompletionFeedback";
import type { ListItem } from "@/types";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/lib/utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/utils")>();
  return {
    ...actual,
    triggerHaptic: vi.fn(),
  };
});

const baseItem: ListItem = {
  id: "li-1",
  listId: "list-1",
  workspaceId: "ws-1",
  text: "Buy oat milk",
  completed: false,
  sortOrder: 0,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("listItemCompletionFeedback", () => {
  it("shows completed toast with undo action", () => {
    const undoListItemCompletion = vi.fn().mockResolvedValue(true);

    showListItemCompletionFeedback(baseItem, { undoListItemCompletion });

    expect(toast.success).toHaveBeenCalledWith(
      "Item completed",
      expect.objectContaining({
        description: "Buy oat milk",
        duration: LIST_ITEM_COMPLETION_TOAST_DURATION_MS,
        action: expect.objectContaining({ label: "Undo" }),
      }),
    );
  });

  it("shows pending toast with undo action", () => {
    const undoListItemPending = vi.fn().mockResolvedValue(true);

    showListItemPendingFeedback(baseItem, { undoListItemPending });

    expect(toast.success).toHaveBeenCalledWith(
      "Moved to pending",
      expect.objectContaining({
        description: "Buy oat milk",
        duration: LIST_ITEM_COMPLETION_TOAST_DURATION_MS,
        action: expect.objectContaining({ label: "Undo" }),
      }),
    );
  });
});