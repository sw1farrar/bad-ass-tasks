import type { Notebook, NotebookTask, NotebookTaskProgress } from "@/types";
import type { NotebookSectionTab } from "@/lib/notebooks/notebookSections";
import { generateId, triggerHaptic } from "@/lib/utils";
import { generateClientId, isSupabaseLive } from "@/lib/data/hybridStore";
import { sortProgressEntriesNewestFirst } from "@/lib/notebooks/progressEntries";
import {
  createNotebookTask as createTaskDb,
  createNotebookTaskProgress as createTaskProgressDb,
  deleteNotebookTaskProgress as deleteTaskProgressDb,
  deleteNotebookTask as deleteTaskDb,
  ensureNotebookSectionPersistenceReady,
  isNotebookSectionPersistenceEnabled,
  updateNotebookTaskProgress as updateTaskProgressDb,
  updateNotebookTask as updateTaskDb,
} from "@/lib/data/notebookSectionsStore";

function newId(workspaceId: string): string {
  return isLiveWorkspace(workspaceId) ? generateClientId() : generateId();
}

function isLiveWorkspace(workspaceId: string): boolean {
  return isSupabaseLive() && !!workspaceId && !["", "w1", "w2"].includes(workspaceId);
}

function shouldPersist(workspaceId: string): boolean {
  return isLiveWorkspace(workspaceId) && isNotebookSectionPersistenceEnabled();
}

function sortByOrder<T extends { sortOrder: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.sortOrder - b.sortOrder);
}

type SectionStoreSlice = {
  notebookTasks: NotebookTask[];
  notebookTaskProgress: NotebookTaskProgress[];
  notebooks: Notebook[];
  selectedNotebookTaskId: string | null;
  selectedNotebookSectionTab?: NotebookSectionTab;
};

type Get = () => SectionStoreSlice & {
  currentWorkspace: { id: string };
  user: { id: string } | null;
  broadcastLiveNotebookTaskToggle?: (
    taskId: string,
    completed: boolean,
    completedAt?: string | null,
  ) => void;
  triggerCelebration?: () => void;
};
type Set = (
  partial: Partial<SectionStoreSlice> | ((state: SectionStoreSlice) => Partial<SectionStoreSlice>),
) => void;

export function createNotebookSectionSliceActions(get: Get, set: Set) {
  const wsId = () => get().currentWorkspace.id;

  return {
    getNotebookTasks: (notebookId: string | null): NotebookTask[] => {
      if (!notebookId) return [];
      return sortByOrder(get().notebookTasks.filter((t) => t.notebookId === notebookId));
    },

    getNotebookTaskProgress: (taskId: string | null): NotebookTaskProgress[] => {
      if (!taskId) return [];
      return sortProgressEntriesNewestFirst(
        get().notebookTaskProgress.filter((p) => p.taskId === taskId),
      );
    },

    setSelectedNotebookTaskId: (id: string | null) =>
      set({
        selectedNotebookTaskId: id,
        ...(id ? { selectedNotebookSectionTab: "tasks" } : {}),
      }),

    addNotebookTask: async (notebookId: string, title = "New task") => {
      const workspaceId = wsId();
      const now = new Date().toISOString();
      const maxOrder = get()
        .notebookTasks.filter((t) => t.notebookId === notebookId)
        .reduce((max, t) => Math.max(max, t.sortOrder), -1000);
      const task: NotebookTask = {
        id: newId(workspaceId),
        notebookId,
        workspaceId,
        title: title.trim() || "New task",
        completed: false,
        showOnWorkspace: false,
        sortOrder: maxOrder + 1000,
        createdAt: now,
        updatedAt: now,
      };
      set((state) => ({ notebookTasks: [...state.notebookTasks, task] }));
      if (isLiveWorkspace(workspaceId)) {
        await ensureNotebookSectionPersistenceReady();
        await createTaskDb({
          id: task.id,
          notebookId,
          workspaceId,
          title: task.title,
          sortOrder: task.sortOrder,
        });
      }
      return task;
    },

    toggleNotebookTask: async (id: string): Promise<boolean> => {
      const task = get().notebookTasks.find((t) => t.id === id);
      if (!task) return false;
      const previous = { ...task };
      const completed = !task.completed;
      const now = new Date().toISOString();
      set((state) => ({
        notebookTasks: state.notebookTasks.map((t) =>
          t.id === id
            ? {
                ...t,
                completed,
                completedAt: completed ? now : null,
                updatedAt: now,
              }
            : t,
        ),
      }));
      get().broadcastLiveNotebookTaskToggle?.(id, completed, completed ? now : null);

      if (shouldPersist(task.workspaceId)) {
        const ok = await updateTaskDb(id, task.workspaceId, {
          completed,
          completedAt: completed ? now : null,
        });
        if (!ok) {
          set((state) => ({
            notebookTasks: state.notebookTasks.map((t) => (t.id === id ? previous : t)),
          }));
          get().broadcastLiveNotebookTaskToggle?.(
            id,
            previous.completed,
            previous.completedAt ?? null,
          );
          return false;
        }
      }

      if (completed) {
        triggerHaptic("success");
        get().triggerCelebration?.();
      } else {
        triggerHaptic("light");
      }
      return true;
    },

    updateNotebookTask: async (
      id: string,
      updates: Partial<Pick<NotebookTask, "title" | "showOnWorkspace">>,
    ): Promise<boolean> => {
      const task = get().notebookTasks.find((t) => t.id === id);
      if (!task) return false;
      const previous = { ...task };
      const now = new Date().toISOString();
      set((state) => ({
        notebookTasks: state.notebookTasks.map((t) =>
          t.id === id ? { ...t, ...updates, updatedAt: now } : t,
        ),
      }));
      if (shouldPersist(task.workspaceId)) {
        const ok = await updateTaskDb(id, task.workspaceId, updates);
        if (!ok) {
          set((state) => ({
            notebookTasks: state.notebookTasks.map((t) => (t.id === id ? previous : t)),
          }));
          return false;
        }
      }
      return true;
    },

    setNotebookTaskShowOnWorkspace: async (id: string, showOnWorkspace: boolean) => {
      const task = get().notebookTasks.find((t) => t.id === id);
      if (!task || task.showOnWorkspace === showOnWorkspace) return;
      const now = new Date().toISOString();
      set((state) => ({
        notebookTasks: state.notebookTasks.map((t) =>
          t.id === id ? { ...t, showOnWorkspace, updatedAt: now } : t,
        ),
      }));
      if (shouldPersist(task.workspaceId)) {
        void updateTaskDb(id, task.workspaceId, { showOnWorkspace });
      }
    },

    deleteNotebookTask: async (id: string) => {
      const task = get().notebookTasks.find((t) => t.id === id);
      set((state) => ({
        notebookTasks: state.notebookTasks.filter((t) => t.id !== id),
        notebookTaskProgress: state.notebookTaskProgress.filter((p) => p.taskId !== id),
        selectedNotebookTaskId:
          state.selectedNotebookTaskId === id ? null : state.selectedNotebookTaskId,
      }));
      if (task && shouldPersist(task.workspaceId)) {
        void deleteTaskDb(id, task.workspaceId);
      }
    },

    addNotebookTaskProgress: async (taskId: string, body: string) => {
      const trimmed = body.trim();
      if (!trimmed) return;
      const task = get().notebookTasks.find((t) => t.id === taskId);
      if (!task) return;
      const entry: NotebookTaskProgress = {
        id: newId(task.workspaceId),
        taskId,
        body: trimmed,
        authorId: get().user?.id ?? null,
        createdAt: new Date().toISOString(),
      };
      set((state) => ({
        notebookTaskProgress: [...state.notebookTaskProgress, entry],
      }));
      if (isLiveWorkspace(task.workspaceId)) {
        await ensureNotebookSectionPersistenceReady();
        void createTaskProgressDb({
          id: entry.id,
          taskId,
          body: trimmed,
          authorId: entry.authorId,
        });
      }
    },

    updateNotebookTaskProgress: async (id: string, body: string) => {
      const trimmed = body.trim();
      if (!trimmed) return;
      const entry = get().notebookTaskProgress.find((p) => p.id === id);
      if (!entry || entry.body === trimmed) return;
      set((state) => ({
        notebookTaskProgress: state.notebookTaskProgress.map((p) =>
          p.id === id ? { ...p, body: trimmed } : p,
        ),
      }));
      if (isLiveWorkspace(get().currentWorkspace.id)) {
        void updateTaskProgressDb(id, trimmed);
      }
    },

    deleteNotebookTaskProgress: async (id: string) => {
      const entry = get().notebookTaskProgress.find((p) => p.id === id);
      if (!entry) return;
      set((state) => ({
        notebookTaskProgress: state.notebookTaskProgress.filter((p) => p.id !== id),
      }));
      if (isLiveWorkspace(get().currentWorkspace.id)) {
        void deleteTaskProgressDb(id);
      }
    },
  };
}

export type NotebookSectionSliceActions = ReturnType<typeof createNotebookSectionSliceActions>;
