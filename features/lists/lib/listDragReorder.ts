import type { WorkspaceList } from "@/types";

/** Commit a multi-step drag to a single store reorder(activeId, overId). */
export function resolveListReorderAfterDrag(
  originalLists: WorkspaceList[],
  finalOrderIds: string[],
  activeId: string,
): { shouldReorder: boolean; overId?: string } {
  const originalIds = originalLists.map((list) => list.id);
  const newIndex = finalOrderIds.indexOf(activeId);
  const oldIndex = originalIds.indexOf(activeId);
  if (newIndex < 0 || oldIndex < 0 || newIndex === oldIndex) {
    return { shouldReorder: false };
  }
  const overId = originalLists[newIndex]?.id;
  if (!overId || overId === activeId) {
    return { shouldReorder: false };
  }
  return { shouldReorder: true, overId };
}