import { toast } from "sonner";
import type { ListItem } from "@/types";
import { triggerHaptic } from "@/lib/utils";

export const LIST_ITEM_COMPLETION_TOAST_DURATION_MS = 10_000;

function formatListItemToastDescription(text: string): string {
  const trimmed = text.trim() || "List item";
  if (trimmed.length <= 80) return trimmed;
  return `${trimmed.slice(0, 77)}…`;
}

export function showListItemCompletionFeedback(
  itemBeforeComplete: ListItem,
  opts: {
    undoListItemCompletion: (id: string) => Promise<boolean>;
  },
): void {
  toast.success("Item completed", {
    description: formatListItemToastDescription(itemBeforeComplete.text),
    duration: LIST_ITEM_COMPLETION_TOAST_DURATION_MS,
    action: {
      label: "Undo",
      onClick: () => {
        void opts.undoListItemCompletion(itemBeforeComplete.id).then((ok) => {
          if (ok) {
            triggerHaptic("light");
          } else {
            toast.error("Could not undo", {
              description: "Try checking the item again.",
            });
          }
        });
      },
    },
  });
}

export function showListItemPendingFeedback(
  itemBeforePending: ListItem,
  opts: {
    undoListItemPending: (id: string) => Promise<boolean>;
  },
): void {
  toast.success("Moved to pending", {
    description: formatListItemToastDescription(itemBeforePending.text),
    duration: LIST_ITEM_COMPLETION_TOAST_DURATION_MS,
    action: {
      label: "Undo",
      onClick: () => {
        void opts.undoListItemPending(itemBeforePending.id).then((ok) => {
          if (ok) {
            triggerHaptic("light");
          } else {
            toast.error("Could not undo", {
              description: "Try moving the item back from pending.",
            });
          }
        });
      },
    },
  });
}