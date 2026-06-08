import type { ListItem, WorkspaceList } from "@/types";
import {
  canIndentListItem,
  canOutdentListItem,
  flattenListItems,
  getIndentParentId,
  getOutdentParentId,
  nextSortOrderAmongSiblings,
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
      options?: { parentItemId?: string | null },
    ) => {
      const trimmed = text.trim();
      if (!trimmed) return null;
      const list = get().workspaceLists.find((l) => l.id === listId);
      const workspaceId = list?.workspaceId ?? wsId();
      const now = new Date().toISOString();
      const parentItemId = options?.parentItemId ?? null;
      const sortOrder = nextSortOrderAmongSiblings(
        get().listItems,
        listId,
        parentItemId,
      );
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
      set((state) => ({ listItems: state.listItems.filter((i) => i.id !== id) }));
      if (current && shouldPersistLists(current.workspaceId)) {
        void deleteListItemSupabase(normalizeListEntityId(id), current.workspaceId);
      }
      return true;
    },

    reorderListItems: (listId: string, activeId: string, overId: string) => {
      const allItems = get().listItems.filter((i) => i.listId === listId);
      const active = allItems.find((i) => i.id === activeId);
      const over = allItems.find((i) => i.id === overId);
      if (!active || !over) return;
      if ((active.parentItemId ?? null) !== (over.parentItemId ?? null)) return;

      const siblings = allItems
        .filter((i) => (i.parentItemId ?? null) === (active.parentItemId ?? null))
        .sort((a, b) => a.sortOrder - b.sortOrder);
      const oldIndex = siblings.findIndex((i) => i.id === activeId);
      const newIndex = siblings.findIndex((i) => i.id === overId);
      if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return;

      const reordered = [...siblings];
      const [moved] = reordered.splice(oldIndex, 1);
      reordered.splice(newIndex, 0, moved);
      const normalized = renormalizeSortOrders(reordered);
      const idToOrder = new Map(normalized.map((i) => [i.id, i.sortOrder]));
      const now = new Date().toISOString();
      const workspaceId = active.workspaceId ?? wsId();
      set((state) => ({
        listItems: state.listItems.map((i) =>
          idToOrder.has(i.id) ? { ...i, sortOrder: idToOrder.get(i.id)!, updatedAt: now } : i
        ),
      }));
      if (workspaceId && shouldPersistLists(workspaceId)) {
        for (const [itemId, sortOrder] of idToOrder) {
          void updateListItemSupabase(normalizeListEntityId(itemId), workspaceId, { sortOrder });
        }
      }
    },

    indentListItem: async (id: string) => {
      const allItems = get().listItems;
      const current = allItems.find((i) => i.id === id);
      if (!current || !canIndentListItem(id, allItems.filter((i) => i.listId === current.listId))) {
        return false;
      }

      const parentId = getIndentParentId(id, allItems.filter((i) => i.listId === current.listId));
      if (!parentId) return false;

      const now = new Date().toISOString();
      const sortOrder = nextSortOrderAmongSiblings(allItems, current.listId, parentId);
      set((state) => ({
        listItems: state.listItems.map((i) =>
          i.id === id
            ? { ...i, parentItemId: parentId, sortOrder, updatedAt: now }
            : i,
        ),
      }));

      if (shouldPersistLists(current.workspaceId)) {
        void updateListItemSupabase(normalizeListEntityId(id), current.workspaceId, {
          parentItemId: parentId,
          sortOrder,
        });
      }
      return true;
    },

    outdentListItem: async (id: string) => {
      const allItems = get().listItems;
      const current = allItems.find((i) => i.id === id);
      if (!current || !canOutdentListItem(id, allItems)) return false;

      const listItems = allItems.filter((i) => i.listId === current.listId);
      const newParentId = getOutdentParentId(id, listItems);
      if (newParentId === undefined) return false;

      const now = new Date().toISOString();
      const sortOrder = nextSortOrderAmongSiblings(allItems, current.listId, newParentId);
      set((state) => ({
        listItems: state.listItems.map((i) =>
          i.id === id
            ? {
                ...i,
                parentItemId: newParentId ?? undefined,
                sortOrder,
                updatedAt: now,
              }
            : i,
        ),
      }));

      if (shouldPersistLists(current.workspaceId)) {
        void updateListItemSupabase(normalizeListEntityId(id), current.workspaceId, {
          parentItemId: newParentId,
          sortOrder,
        });
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