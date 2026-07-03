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

    updateNotebook: async (
      id: string,
      updates: Partial<Pick<Notebook, "name" | "sortOrder" | "ourSales">>,
    ) => {
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
      const state = get() as ReturnType<Get> & {
        notebookTasks?: Array<{ notebookId: string; id: string }>;
        notebookTaskProgress?: Array<{ taskId: string }>;
        notebookInvestments?: Array<{ notebookId: string; id: string }>;
        notebookInvestmentNotes?: Array<{ investmentId: string }>;
        notebookCustomers?: Array<{ notebookId: string; id: string }>;
        notebookCustomerNotes?: Array<{ customerId: string }>;
        notebookCompetitors?: Array<{ notebookId: string; id: string }>;
        notebookCompetitorNotes?: Array<{ competitorId: string }>;
        selectedNotebookTaskId?: string | null;
        selectedNotebookInvestmentId?: string | null;
        selectedNotebookCustomerId?: string | null;
        selectedNotebookCompetitorId?: string | null;
      };
      const removedTaskIds = new Set(
        (state.notebookTasks ?? []).filter((t) => t.notebookId === id).map((t) => t.id),
      );
      const removedInvestmentIds = new Set(
        (state.notebookInvestments ?? []).filter((i) => i.notebookId === id).map((i) => i.id),
      );
      const removedCustomerIds = new Set(
        (state.notebookCustomers ?? []).filter((c) => c.notebookId === id).map((c) => c.id),
      );
      const removedCompetitorIds = new Set(
        (state.notebookCompetitors ?? []).filter((c) => c.notebookId === id).map((c) => c.id),
      );
      set((s) => ({
        notebooks: s.notebooks.filter((nb) => nb.id !== id),
        notes: s.notes.filter((n) => n.notebookId !== id),
        notebookTasks: (s as typeof state).notebookTasks?.filter((t) => t.notebookId !== id) ?? [],
        notebookTaskProgress:
          (s as typeof state).notebookTaskProgress?.filter((p) => !removedTaskIds.has(p.taskId)) ??
          [],
        notebookInvestments:
          (s as typeof state).notebookInvestments?.filter((i) => i.notebookId !== id) ?? [],
        notebookInvestmentNotes:
          (s as typeof state).notebookInvestmentNotes?.filter(
            (n) => !removedInvestmentIds.has(n.investmentId),
          ) ?? [],
        notebookCustomers:
          (s as typeof state).notebookCustomers?.filter((c) => c.notebookId !== id) ?? [],
        notebookCustomerNotes:
          (s as typeof state).notebookCustomerNotes?.filter(
            (n) => !removedCustomerIds.has(n.customerId),
          ) ?? [],
        notebookCompetitors:
          (s as typeof state).notebookCompetitors?.filter((c) => c.notebookId !== id) ?? [],
        notebookCompetitorNotes:
          (s as typeof state).notebookCompetitorNotes?.filter(
            (n) => !removedCompetitorIds.has(n.competitorId),
          ) ?? [],
        selectedNotebookId: s.selectedNotebookId === id ? null : s.selectedNotebookId,
        selectedNotebookNoteId:
          s.selectedNotebookNoteId &&
          s.notes.find((n) => n.id === s.selectedNotebookNoteId)?.notebookId === id
            ? null
            : s.selectedNotebookNoteId,
        selectedNotebookTaskId: removedTaskIds.has((s as typeof state).selectedNotebookTaskId ?? "")
          ? null
          : (s as typeof state).selectedNotebookTaskId ?? null,
        selectedNotebookInvestmentId: removedInvestmentIds.has(
          (s as typeof state).selectedNotebookInvestmentId ?? "",
        )
          ? null
          : (s as typeof state).selectedNotebookInvestmentId ?? null,
        selectedNotebookCustomerId: removedCustomerIds.has(
          (s as typeof state).selectedNotebookCustomerId ?? "",
        )
          ? null
          : (s as typeof state).selectedNotebookCustomerId ?? null,
        selectedNotebookCompetitorId: removedCompetitorIds.has(
          (s as typeof state).selectedNotebookCompetitorId ?? "",
        )
          ? null
          : (s as typeof state).selectedNotebookCompetitorId ?? null,
      }));
      if (workspaceId && shouldPersistNotebooks(workspaceId)) {
        void deleteNotebookSupabase(id, workspaceId);
      }
      return true;
    },
  };
}

export type NotebookSliceActions = ReturnType<typeof createNotebookSliceActions>;