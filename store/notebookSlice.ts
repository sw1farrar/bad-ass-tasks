import type { Note, Notebook } from "@/types";
import { generateId } from "@/lib/utils";
import { filterNotebookNotes, sortNotebookNotes } from "@/lib/notebooks/notebookFilters";
import {
  createNotebook as createNotebookSupabase,
  deleteNotebook as deleteNotebookSupabase,
  ensureNotebookPersistenceReady,
  generateClientId,
  isNotebookPersistenceEnabled,
  isSupabaseLive,
  updateNotebook as updateNotebookSupabase,
} from "@/lib/data/hybridStore";

export const SAMPLE_NOTEBOOKS: Notebook[] = [
  {
    id: "nb-demo-1",
    workspaceId: "w1",
    name: "Personal",
    sortOrder: 0,
    createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "nb-demo-2",
    workspaceId: "w1",
    name: "Projects",
    sortOrder: 1000,
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

type NotebookStoreSlice = {
  notebooks: Notebook[];
  notes: Note[];
  selectedNotebookId: string | null;
  selectedNotebookNoteId: string | null;
  selectedNoteId: string | null;
  selectedTaskId: string | null;
};

type Get = () => NotebookStoreSlice & { currentWorkspace: { id: string } };
type Set = (
  partial:
    | Partial<NotebookStoreSlice>
    | ((state: NotebookStoreSlice) => Partial<NotebookStoreSlice>),
) => void;

function sortNotebooks(notebooks: Notebook[]): Notebook[] {
  return [...notebooks].sort((a, b) => a.sortOrder - b.sortOrder);
}

function isLiveNotebookWorkspace(workspaceId: string): boolean {
  return isSupabaseLive() && !!workspaceId && !["", "w1", "w2"].includes(workspaceId);
}

function shouldPersistNotebooks(workspaceId: string): boolean {
  return isLiveNotebookWorkspace(workspaceId) && isNotebookPersistenceEnabled();
}

function newNotebookId(workspaceId: string): string {
  return isLiveNotebookWorkspace(workspaceId) ? generateClientId() : generateId();
}

export function createNotebookSliceActions(get: Get, set: Set) {
  const wsId = () => get().currentWorkspace.id;

  return {
    getNotebooks: (): Notebook[] => {
      return sortNotebooks(get().notebooks.filter((nb) => nb.workspaceId === wsId()));
    },

    getNotebookNotes: (notebookId: string | null): Note[] => {
      if (!notebookId) return [];
      return sortNotebookNotes(filterNotebookNotes(get().notes, notebookId));
    },

    setSelectedNotebookId: (id: string | null) => {
      set({
        selectedNotebookId: id,
        selectedNotebookNoteId: null,
        ...(id ? { selectedNoteId: null, selectedTaskId: null } : {}),
      });
    },

    setSelectedNotebookNoteId: (id: string | null) => {
      set({
        selectedNotebookNoteId: id,
        ...(id ? { selectedNoteId: null, selectedTaskId: null } : {}),
      });
    },

    addNotebook: async (name = "Untitled notebook") => {
      const workspaceId = wsId();
      const now = new Date().toISOString();
      const maxOrder = get()
        .notebooks.filter((nb) => nb.workspaceId === workspaceId)
        .reduce((max, nb) => Math.max(max, nb.sortOrder), -1000);
      const notebook: Notebook = {
        id: newNotebookId(workspaceId),
        workspaceId,
        name: name.trim() || "Untitled notebook",
        sortOrder: maxOrder + 1000,
        createdAt: now,
        updatedAt: now,
      };
      set((state) => ({ notebooks: [...state.notebooks, notebook] }));
      if (isLiveNotebookWorkspace(workspaceId)) {
        const ready = await ensureNotebookPersistenceReady();
        if (!ready) {
          throw new Error("Notebook storage is not available");
        }
        const persisted = await createNotebookSupabase({
          id: notebook.id,
          workspaceId,
          name: notebook.name,
          sortOrder: notebook.sortOrder,
          createdAt: notebook.createdAt,
          updatedAt: notebook.updatedAt,
        });
        if (!persisted) {
          throw new Error("Could not save notebook");
        }
      }
      return notebook;
    },

    updateNotebook: async (id: string, updates: Partial<Pick<Notebook, "name" | "sortOrder">>) => {
      const now = new Date().toISOString();
      const workspaceId = get().notebooks.find((nb) => nb.id === id)?.workspaceId ?? wsId();
      set((state) => ({
        notebooks: state.notebooks.map((nb) =>
          nb.id === id ? { ...nb, ...updates, updatedAt: now } : nb,
        ),
      }));
      if (workspaceId && shouldPersistNotebooks(workspaceId)) {
        void updateNotebookSupabase(id, workspaceId, updates);
      }
      return true;
    },

    deleteNotebook: async (id: string) => {
      const workspaceId = get().notebooks.find((nb) => nb.id === id)?.workspaceId ?? wsId();
      set((state) => ({
        notebooks: state.notebooks.filter((nb) => nb.id !== id),
        notes: state.notes.filter((n) => n.notebookId !== id),
        selectedNotebookId:
          state.selectedNotebookId === id ? null : state.selectedNotebookId,
        selectedNotebookNoteId:
          state.selectedNotebookNoteId &&
          state.notes.find((n) => n.id === state.selectedNotebookNoteId)?.notebookId === id
            ? null
            : state.selectedNotebookNoteId,
      }));
      if (workspaceId && shouldPersistNotebooks(workspaceId)) {
        void deleteNotebookSupabase(id, workspaceId);
      }
      return true;
    },
  };
}

export type NotebookSliceActions = ReturnType<typeof createNotebookSliceActions>;