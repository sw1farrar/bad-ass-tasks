import type { Task, TaskFolder } from "@/types";
import { generateId } from "@/lib/utils";
import {
  createTaskFolder as createTaskFolderSupabase,
  deleteTaskFolder as deleteTaskFolderSupabase,
  ensureTaskFolderPersistenceReady,
  generateClientId,
  isSupabaseLive,
  isTaskFolderPersistenceEnabled,
  updateTaskFolder as updateTaskFolderSupabase,
} from "@/lib/data/hybridStore";

export const SAMPLE_TASK_FOLDERS: TaskFolder[] = [
  {
    id: "tf-work",
    workspaceId: "w1",
    name: "Work",
    sortOrder: 0,
    createdAt: new Date(Date.now() - 86400000 * 4).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "tf-personal",
    workspaceId: "w1",
    name: "Personal",
    sortOrder: 1000,
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

type TaskFolderStoreSlice = {
  taskFolders: TaskFolder[];
  tasks: Task[];
};

type Get = () => TaskFolderStoreSlice & { currentWorkspace: { id: string } };
type Set = (
  partial:
    | Partial<TaskFolderStoreSlice>
    | ((state: TaskFolderStoreSlice) => Partial<TaskFolderStoreSlice>),
) => void;

function sortFolders(folders: TaskFolder[]): TaskFolder[] {
  return [...folders].sort((a, b) => a.sortOrder - b.sortOrder);
}

function isLiveTaskFolderWorkspace(workspaceId: string): boolean {
  return isSupabaseLive() && !!workspaceId && !["", "w1", "w2"].includes(workspaceId);
}

function shouldPersistTaskFolders(workspaceId: string): boolean {
  return isLiveTaskFolderWorkspace(workspaceId) && isTaskFolderPersistenceEnabled();
}

function newFolderId(workspaceId: string): string {
  return isLiveTaskFolderWorkspace(workspaceId) ? generateClientId() : generateId();
}

export function createTaskFolderSliceActions(get: Get, set: Set) {
  const wsId = () => get().currentWorkspace.id;

  return {
    getTaskFolders: (): TaskFolder[] => {
      return sortFolders(get().taskFolders.filter((f) => f.workspaceId === wsId()));
    },

    addTaskFolder: async (name = "New folder") => {
      const workspaceId = wsId();
      const now = new Date().toISOString();
      const maxOrder = get()
        .taskFolders.filter((f) => f.workspaceId === workspaceId)
        .reduce((max, f) => Math.max(max, f.sortOrder), -1000);
      const folder: TaskFolder = {
        id: newFolderId(workspaceId),
        workspaceId,
        name: name.trim() || "New folder",
        sortOrder: maxOrder + 1000,
        createdAt: now,
        updatedAt: now,
      };
      set((state) => ({ taskFolders: [...state.taskFolders, folder] }));
      if (isLiveTaskFolderWorkspace(workspaceId)) {
        void (async () => {
          if (!(await ensureTaskFolderPersistenceReady())) return;
          await createTaskFolderSupabase({
            id: folder.id,
            workspaceId,
            name: folder.name,
            sortOrder: folder.sortOrder,
            createdAt: folder.createdAt,
            updatedAt: folder.updatedAt,
          });
        })();
      }
      return folder;
    },

    updateTaskFolder: async (id: string, updates: Partial<Pick<TaskFolder, "name" | "sortOrder">>) => {
      const now = new Date().toISOString();
      const workspaceId = get().taskFolders.find((f) => f.id === id)?.workspaceId ?? wsId();
      set((state) => ({
        taskFolders: state.taskFolders.map((f) =>
          f.id === id ? { ...f, ...updates, updatedAt: now } : f,
        ),
      }));
      if (workspaceId && shouldPersistTaskFolders(workspaceId)) {
        void updateTaskFolderSupabase(id, workspaceId, updates);
      }
      return true;
    },

    deleteTaskFolder: async (id: string) => {
      const workspaceId = get().taskFolders.find((f) => f.id === id)?.workspaceId ?? wsId();
      set((state) => ({
        taskFolders: state.taskFolders.filter((f) => f.id !== id),
        tasks: state.tasks.map((t) => (t.folderId === id ? { ...t, folderId: null } : t)),
      }));
      if (workspaceId && shouldPersistTaskFolders(workspaceId)) {
        void deleteTaskFolderSupabase(id, workspaceId);
      }
      return true;
    },
  };
}

export type TaskFolderSliceActions = ReturnType<typeof createTaskFolderSliceActions>;