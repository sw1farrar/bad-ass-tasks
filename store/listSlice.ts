import type { ListItem, WorkspaceList } from "@/types";
import {
  computeFlatListReorder,
  computeIndentUpdate,
  computeOutdentUpdate,
  flattenListItems,
  getIndentParentId,
  firstSortOrderAmongSiblings,
  sortOrderForInsertAfter,
} from "@/lib/lists/listItemTree";
import { generateId, triggerHaptic } from "@/lib/utils";
import {
  createListItem as createListItemSupabase,
  createWorkspaceList as createWorkspaceListSupabase,
  normalizeListEntityId,
  deleteListItem as deleteListItemSupabase,
  deleteWorkspaceList as deleteWorkspaceListSupabase,
  ensureWorkspaceListPersistenceReady,
  generateClientId,
  isSupabaseLive,
  isWorkspaceListPersistenceEnabled,
  updateListItem as updateListItemSupabase,
  updateWorkspaceList as updateWorkspaceListSupabase,
} from "@/lib/data/hybridStore";

export const LIST_COLORS = [
  { id: "default", label: "Default", bg: "rgba(255,255,255,0.04)", border: "rgba(255,255,255,0.12)" },
  { id: "purple", label: "Purple", bg: "rgba(192,132,252,0.12)", border: "rgba(192,132,252,0.35)" },
  { id: "pink", label: "Pink", bg: "rgba(255,51,102,0.1)", border: "rgba(255,51,102,0.3)" },
  { id: "green", label: "Green", bg: "rgba(0,255,159,0.08)", border: "rgba(0,255,159,0.28)" },
  { id: "amber", label: "Amber", bg: "rgba(250,204,21,0.1)", border: "rgba(250,204,21,0.3)" },
  { id: "blue", label: "Blue", bg: "rgba(96,165,250,0.1)", border: "rgba(96,165,250,0.3)" },
] as const;

export type ListColorId = (typeof LIST_COLORS)[number]["id"];

export function getListColorStyle(colorId: string) {
  return LIST_COLORS.find((c) => c.id === colorId) ?? LIST_COLORS[0];
}

export const SAMPLE_WORKSPACE_LISTS: WorkspaceList[] = [
  {
    id: "list-groceries",
    workspaceId: "w1",
    title: "Groceries",
    color: "green",
    sortOrder: 0,
    pinned: true,
    createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "list-launch",
    workspaceId: "w1",
    title: "Launch checklist",
    color: "purple",
    sortOrder: 1000,
    createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "list-ideas",
    workspaceId: "w1",
    title: "Ideas",
    color: "amber",
    sortOrder: 2000,
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export const SAMPLE_LIST_ITEMS: ListItem[] = [
  { id: "li1", listId: "list-groceries", workspaceId: "w1", text: "Oat milk", completed: false, sortOrder: 0, createdAt: "", updatedAt: "" },
  { id: "li2", listId: "list-groceries", workspaceId: "w1", text: "Avocados", completed: true, sortOrder: 1000, completedAt: new Date().toISOString(), createdAt: "", updatedAt: "" },
  { id: "li3", listId: "list-groceries", workspaceId: "w1", text: "Coffee beans", completed: false, sortOrder: 2000, createdAt: "", updatedAt: "" },
  { id: "li4", listId: "list-launch", workspaceId: "w1", text: "Final QA pass", completed: false, sortOrder: 0, createdAt: "", updatedAt: "" },
  { id: "li5", listId: "list-launch", workspaceId: "w1", text: "Deploy staging", completed: true, sortOrder: 1000, completedAt: new Date().toISOString(), createdAt: "", updatedAt: "" },
  { id: "li6", listId: "list-launch", workspaceId: "w1", text: "Announce to team", completed: false, sortOrder: 2000, createdAt: "", updatedAt: "" },
  { id: "li7", listId: "list-ideas", workspaceId: "w1", text: "Home dashboard widgets", completed: false, sortOrder: 0, createdAt: "", updatedAt: "" },
  { id: "li8", listId: "list-ideas", workspaceId: "w1", text: "Shared list templates", completed: false, sortOrder: 1000, createdAt: "", updatedAt: "" },
].map((item) => ({
  ...item,
  createdAt: item.createdAt || new Date().toISOString(),
  updatedAt: item.updatedAt || new Date().toISOString(),
}));

type ListStoreSlice = {
  workspaceLists: WorkspaceList[];
  listItems: ListItem[];
};

type Get = () => ListStoreSlice & {
  currentWorkspace: { id: string };
  triggerCelebration: () => void;
};
type Set = (partial: Partial<ListStoreSlice> | ((state: ListStoreSlice) => Partial<ListStoreSlice>)) => void;

function sortLists(lists: WorkspaceList[]): WorkspaceList[] {
  return [...lists].sort((a, b) => {
    if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
    return a.sortOrder - b.sortOrder;
  });
}

function renormalizeSortOrders<T extends { sortOrder: number }>(items: T[]): T[] {
  return items.map((item, index) => ({ ...item, sortOrder: index * 1000 }));
}

function isLiveListWorkspace(workspaceId: string): boolean {
  return isSupabaseLive() && !!workspaceId && !["w1", "w2"].includes(workspaceId);
}

function shouldPersistLists(workspaceId: string): boolean {
  return isLiveListWorkspace(workspaceId) && isWorkspaceListPersistenceEnabled();
}

function newListEntityId(workspaceId: string): string {
  return isLiveListWorkspace(workspaceId) ? generateClientId() : generateId();
}

export function createListSliceActions(get: Get, set: Set) {
  const wsId = () => get().currentWorkspace.id;

  return {
    getWorkspaceLists: (): WorkspaceList[] => {
      return sortLists(get().workspaceLists.filter((l) => l.workspaceId === wsId()));
    },

    getListItemsForList: (listId: string): ListItem[] => {
      const items = get().listItems.filter(
        (i) => i.listId === listId && i.workspaceId === wsId(),
      );
      return flattenListItems(items);
    },

    getListSummary: (listId: string) => {
      const items = flattenListItems(
        get().listItems.filter((i) => i.listId === listId),
      );
      const open = items.filter((i) => !i.completed);
      return { total: items.length, open: open.length, preview: open.slice(0, 3).map((i) => i.text) };
    },

    addList: async (title = "Untitled list", color: ListColorId = "default") => {
      const workspaceId = wsId();
      const now = new Date().toISOString();
      const maxOrder = get().workspaceLists
        .filter((l) => l.workspaceId === workspaceId)
        .reduce((max, l) => Math.max(max, l.sortOrder), -1000);
      const list: WorkspaceList = {
        id: newListEntityId(workspaceId),
        workspaceId,
        title: title.trim() || "Untitled list",
        color,
        sortOrder: maxOrder + 1000,
        createdAt: now,
        updatedAt: now,
      };
      set((state) => ({ workspaceLists: [...state.workspaceLists, list] }));
      if (isLiveListWorkspace(workspaceId)) {
        void (async () => {
          if (!(await ensureWorkspaceListPersistenceReady())) return;
          await createWorkspaceListSupabase({
            id: normalizeListEntityId(list.id),
            workspaceId,
            title: list.title,
            color: list.color,
            sortOrder: list.sortOrder,
            pinned: list.pinned,
          });
        })();
      }
      return list;
    },

    updateList: async (id: string, updates: Partial<WorkspaceList>) => {
      const now = new Date().toISOString();
      const workspaceId = get().workspaceLists.find((l) => l.id === id)?.workspaceId ?? wsId();
      set((state) => ({
        workspaceLists: state.workspaceLists.map((l) =>
          l.id === id ? { ...l, ...updates, updatedAt: now } : l
        ),
      }));
      if (workspaceId && shouldPersistLists(workspaceId)) {
        void updateWorkspaceListSupabase(normalizeListEntityId(id), workspaceId, updates);
      }
      return true;
    },

    deleteList: async (id: string) => {
      const workspaceId = get().workspaceLists.find((l) => l.id === id)?.workspaceId ?? wsId();
      set((state) => ({
        workspaceLists: state.workspaceLists.filter((l) => l.id !== id),
        listItems: state.listItems.filter((i) => i.listId !== id),
      }));
      if (workspaceId && shouldPersistLists(workspaceId)) {
        void deleteWorkspaceListSupabase(normalizeListEntityId(id), workspaceId);
      }
      return true;
    },

    reorderLists: (activeId: string, overId: string) => {
      const workspaceId = wsId();
      const lists = sortLists(get().workspaceLists.filter((l) => l.workspaceId === workspaceId));
      const oldIndex = lists.findIndex((l) => l.id === activeId);
      const newIndex = lists.findIndex((l) => l.id === overId);
      if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return;
      const reordered = [...lists];
      const [moved] = reordered.splice(oldIndex, 1);
      reordered.splice(newIndex, 0, moved);
      const normalized = renormalizeSortOrders(reordered);
      const idToOrder = new Map(normalized.map((l) => [l.id, l.sortOrder]));
      const now = new Date().toISOString();
      set((state) => ({
        workspaceLists: state.workspaceLists.map((l) =>
          idToOrder.has(l.id) ? { ...l, sortOrder: idToOrder.get(l.id)!, updatedAt: now } : l
        ),
      }));
      if (shouldPersistLists(workspaceId)) {
        for (const [listId, sortOrder] of idToOrder) {
          void updateWorkspaceListSupabase(normalizeListEntityId(listId), workspaceId, { sortOrder });
        }
      }
    },

    toggleListPinned: async (id: string) => {
      const list = get().workspaceLists.find((l) => l.id === id);
      if (!list) return false;
      return createListSliceActions(get, set).updateList(id, { pinned: !list.pinned });
    },

    addListItem: async (
      listId: string,
      text: string,
      options?: { parentItemId?: string | null; afterItemId?: string },
    ) => {
      const trimmed = text.trim();
      const allowEmpty = Boolean(options?.afterItemId);
      if (!trimmed && !allowEmpty) return null;
      const list = get().workspaceLists.find((l) => l.id === listId);
      const workspaceId = list?.workspaceId ?? wsId();
      const now = new Date().toISOString();
      const allItems = get().listItems;

      let parentItemId = options?.parentItemId ?? null;
      let sortOrder = firstSortOrderAmongSiblings(allItems, listId, parentItemId);

      if (options?.afterItemId) {
        const placement = sortOrderForInsertAfter(allItems, options.afterItemId);
        if (placement) {
          parentItemId = placement.parentItemId;
          sortOrder = placement.sortOrder;
        }
      }

      const item: ListItem = {
        id: newListEntityId(workspaceId),
        listId,
        workspaceId,
        text: trimmed,
        completed: false,
        sortOrder,
        parentItemId: parentItemId ?? undefined,
        createdAt: now,
        updatedAt: now,
      };
      set((state) => ({
        listItems: [...state.listItems, item],
        workspaceLists: state.workspaceLists.map((l) =>
          l.id === listId ? { ...l, updatedAt: now } : l
        ),
      }));
      if (isLiveListWorkspace(workspaceId)) {
        void (async () => {
          if (!(await ensureWorkspaceListPersistenceReady())) return;
          await createListItemSupabase({
            id: item.id,
            listId: normalizeListEntityId(listId),
            workspaceId,
            text: item.text,
            sortOrder: item.sortOrder,
            parentItemId: item.parentItemId,
          });
        })();
      }
      return item;
    },

    toggleListItem: async (id: string) => {
      const now = new Date().toISOString();
      const current = get().listItems.find((i) => i.id === id);
      if (!current) return false;

      const completing = !current.completed;
      set((state) => ({
        listItems: state.listItems.map((i) => {
          if (i.id !== id) return i;
          return {
            ...i,
            completed: completing,
            completedAt: completing ? now : undefined,
            updatedAt: now,
          };
        }),
      }));

      if (completing) {
        triggerHaptic("success");
        get().triggerCelebration();
      } else {
        triggerHaptic("light");
      }

      if (shouldPersistLists(current.workspaceId)) {
        void updateListItemSupabase(normalizeListEntityId(id), current.workspaceId, {
          completed: completing,
          completedAt: completing ? now : undefined,
        });
      }
      return true;
    },

    updateListItem: async (id: string, updates: Partial<Pick<ListItem, "text" | "completed">>) => {
      const now = new Date().toISOString();
      const current = get().listItems.find((i) => i.id === id);
      set((state) => ({
        listItems: state.listItems.map((i) =>
          i.id === id
            ? {
                ...i,
                ...updates,
                completedAt:
                  updates.completed === true
                    ? now
                    : updates.completed === false
                      ? undefined
                      : i.completedAt,
                updatedAt: now,
              }
            : i
        ),
      }));
      if (current && shouldPersistLists(current.workspaceId)) {
        void updateListItemSupabase(normalizeListEntityId(id), current.workspaceId, {
          ...updates,
          completedAt:
            updates.completed === true
              ? now
              : updates.completed === false
                ? undefined
                : current.completedAt,
        });
      }
      return true;
    },

    deleteListItem: async (id: string) => {
      const current = get().listItems.find((i) => i.id === id);
      if (!current) return false;

      const reparentTo = current.parentItemId ?? null;
      const now = new Date().toISOString();
      const childIds = get()
        .listItems.filter((i) => i.parentItemId === id)
        .map((i) => i.id);

      set((state) => ({
        listItems: state.listItems
          .filter((i) => i.id !== id)
          .map((i) =>
            i.parentItemId === id
              ? {
                  ...i,
                  parentItemId: reparentTo ?? undefined,
                  updatedAt: now,
                }
              : i,
          ),
      }));

      if (shouldPersistLists(current.workspaceId)) {
        void deleteListItemSupabase(normalizeListEntityId(id), current.workspaceId);
        for (const childId of childIds) {
          void updateListItemSupabase(normalizeListEntityId(childId), current.workspaceId, {
            parentItemId: reparentTo,
          });
        }
      }
      return true;
    },

    reorderListItems: (listId: string, activeId: string, overId: string) => {
      const allItems = get().listItems.filter((i) => i.listId === listId);
      const active = allItems.find((i) => i.id === activeId);
      const over = allItems.find((i) => i.id === overId);
      if (!active || !over) return;

      const result = computeFlatListReorder(allItems, activeId, overId);
      if (!result) return;

      const now = new Date().toISOString();
      const workspaceId = active.workspaceId ?? wsId();
      set((state) => ({
        listItems: state.listItems.map((i) => {
          const update = result.updates.get(i.id);
          if (!update) return i;
          return {
            ...i,
            parentItemId:
              update.parentItemId === null
                ? undefined
                : update.parentItemId === undefined
                  ? i.parentItemId
                  : update.parentItemId,
            sortOrder: update.sortOrder,
            updatedAt: now,
          };
        }),
      }));

      if (workspaceId && shouldPersistLists(workspaceId)) {
        for (const [itemId, update] of result.updates) {
          void updateListItemSupabase(normalizeListEntityId(itemId), workspaceId, {
            sortOrder: update.sortOrder,
            ...(itemId === activeId ? { parentItemId: update.parentItemId } : {}),
          });
        }
      }
    },

    indentListItem: async (id: string) => {
      const current = get().listItems.find((i) => i.id === id);
      if (!current) return false;

      const listItems = get().listItems.filter(
        (i) => i.listId === current.listId && i.workspaceId === current.workspaceId,
      );
      const update = computeIndentUpdate(listItems, id);
      if (!update) return false;

      const now = new Date().toISOString();
      set((state) => ({
        listItems: state.listItems.map((i) => {
          const sortOrder = update.siblingSortOrders.get(i.id);
          const promotedParent =
            update.parentPromotion?.itemId === i.id
              ? update.parentPromotion.parentItemId
              : undefined;

          if (sortOrder === undefined && promotedParent === undefined) return i;

          if (i.id === id) {
            return {
              ...i,
              parentItemId: update.parentItemId,
              ...(sortOrder !== undefined ? { sortOrder } : {}),
              updatedAt: now,
            };
          }

          return {
            ...i,
            ...(sortOrder !== undefined ? { sortOrder } : {}),
            ...(promotedParent !== undefined ? { parentItemId: promotedParent } : {}),
            updatedAt: now,
          };
        }),
      }));

      if (shouldPersistLists(current.workspaceId)) {
        for (const [itemId, sortOrder] of update.siblingSortOrders) {
          const promotedParent =
            update.parentPromotion?.itemId === itemId
              ? update.parentPromotion.parentItemId
              : undefined;
          void updateListItemSupabase(normalizeListEntityId(itemId), current.workspaceId, {
            ...(itemId === id
              ? {
                  parentItemId: normalizeListEntityId(update.parentItemId),
                  sortOrder,
                }
              : promotedParent !== undefined
                ? {
                    parentItemId: normalizeListEntityId(promotedParent),
                    sortOrder,
                  }
                : { sortOrder }),
          });
        }

        if (
          update.parentPromotion &&
          !update.siblingSortOrders.has(update.parentPromotion.itemId)
        ) {
          void updateListItemSupabase(
            normalizeListEntityId(update.parentPromotion.itemId),
            current.workspaceId,
            {
              parentItemId: normalizeListEntityId(update.parentPromotion.parentItemId),
            },
          );
        }
      }
      return true;
    },

    outdentListItem: async (id: string) => {
      const current = get().listItems.find((i) => i.id === id);
      if (!current?.parentItemId) return false;

      const listItems = get().listItems.filter(
        (i) => i.listId === current.listId && i.workspaceId === current.workspaceId,
      );
      const update = computeOutdentUpdate(listItems, id);
      if (!update) return false;

      const now = new Date().toISOString();
      set((state) => ({
        listItems: state.listItems.map((i) => {
          const sortOrder = update.siblingSortOrders.get(i.id);
          if (sortOrder === undefined) return i;
          if (i.id === id) {
            return {
              ...i,
              parentItemId: update.parentItemId ?? undefined,
              sortOrder,
              updatedAt: now,
            };
          }
          return { ...i, sortOrder, updatedAt: now };
        }),
      }));

      if (shouldPersistLists(current.workspaceId)) {
        for (const [itemId, sortOrder] of update.siblingSortOrders) {
          void updateListItemSupabase(normalizeListEntityId(itemId), current.workspaceId, {
            ...(itemId === id
              ? {
                  parentItemId:
                    update.parentItemId == null
                      ? null
                      : normalizeListEntityId(update.parentItemId),
                  sortOrder,
                }
              : { sortOrder }),
          });
        }
      }
      return true;
    },

    clearCompletedListItems: async (listId: string) => {
      const completedIds = get()
        .listItems.filter((i) => i.listId === listId && i.completed)
        .map((i) => i.id);
      const workspaceId = get().listItems.find((i) => i.listId === listId)?.workspaceId ?? wsId();
      set((state) => ({
        listItems: state.listItems.filter((i) => !(i.listId === listId && i.completed)),
      }));
      if (workspaceId && shouldPersistLists(workspaceId)) {
        await Promise.all(
          completedIds.map((id) => deleteListItemSupabase(normalizeListEntityId(id), workspaceId)),
        );
      }
      return true;
    },
  };
}

export type ListSliceActions = ReturnType<typeof createListSliceActions>;