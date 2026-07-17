import type {
  Notebook,
  NotebookCompetitor,
  NotebookCompetitorNote,
  NotebookCustomer,
  NotebookCustomerNote,
  NotebookInvestment,
  NotebookInvestmentNote,
  NotebookTask,
  NotebookTaskProgress,
} from "@/types";
import type { NotebookSectionTab } from "@/lib/notebooks/notebookSections";
import { generateId, triggerHaptic } from "@/lib/utils";
import { generateClientId, isSupabaseLive, updateNotebook } from "@/lib/data/hybridStore";
import { sortProgressEntriesNewestFirst } from "@/lib/notebooks/progressEntries";
import {
  createNotebookCompetitor as createCompetitorDb,
  createNotebookCompetitorNote as createCompetitorNoteDb,
  createNotebookCustomer as createCustomerDb,
  createNotebookCustomerNote as createCustomerNoteDb,
  createNotebookInvestmentNote as createInvestmentNoteDb,
  createNotebookInvestment as createInvestmentDb,
  createNotebookTask as createTaskDb,
  createNotebookTaskProgress as createTaskProgressDb,
  deleteNotebookCompetitorNote as deleteCompetitorNoteDb,
  deleteNotebookCustomerNote as deleteCustomerNoteDb,
  deleteNotebookInvestmentNote as deleteInvestmentNoteDb,
  deleteNotebookTaskProgress as deleteTaskProgressDb,
  deleteNotebookCompetitor as deleteCompetitorDb,
  deleteNotebookCustomer as deleteCustomerDb,
  deleteNotebookInvestment as deleteInvestmentDb,
  deleteNotebookTask as deleteTaskDb,
  ensureNotebookSectionPersistenceReady,
  isNotebookSectionPersistenceEnabled,
  updateNotebookCompetitor as updateCompetitorDb,
  updateNotebookCustomer as updateCustomerDb,
  updateNotebookInvestment as updateInvestmentDb,
  updateNotebookCompetitorNote as updateCompetitorNoteDb,
  updateNotebookCustomerNote as updateCustomerNoteDb,
  updateNotebookInvestmentNote as updateInvestmentNoteDb,
  updateNotebookTaskProgress as updateTaskProgressDb,
  updateNotebookOurSales as updateOurSalesDb,
  updateNotebookTask as updateTaskDb,
} from "@/lib/data/notebookSectionsStore";

// Re-export generateClientId from hybridStore for live workspaces
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
  notebookInvestments: NotebookInvestment[];
  notebookInvestmentNotes: NotebookInvestmentNote[];
  notebookCustomers: NotebookCustomer[];
  notebookCustomerNotes: NotebookCustomerNote[];
  notebookCompetitors: NotebookCompetitor[];
  notebookCompetitorNotes: NotebookCompetitorNote[];
  notebooks: Notebook[];
  selectedNotebookTaskId: string | null;
  selectedNotebookInvestmentId: string | null;
  selectedNotebookCustomerId: string | null;
  selectedNotebookCompetitorId: string | null;
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

    getNotebookInvestments: (notebookId: string | null): NotebookInvestment[] => {
      if (!notebookId) return [];
      return sortByOrder(get().notebookInvestments.filter((i) => i.notebookId === notebookId));
    },

    getNotebookInvestmentNotes: (investmentId: string | null): NotebookInvestmentNote[] => {
      if (!investmentId) return [];
      return sortProgressEntriesNewestFirst(
        get().notebookInvestmentNotes.filter((n) => n.investmentId === investmentId),
      );
    },

    getNotebookCustomers: (notebookId: string | null): NotebookCustomer[] => {
      if (!notebookId) return [];
      return [...get().notebookCustomers.filter((c) => c.notebookId === notebookId)].sort((a, b) =>
        a.accountName.localeCompare(b.accountName),
      );
    },

    getNotebookCustomerNotes: (customerId: string | null): NotebookCustomerNote[] => {
      if (!customerId) return [];
      return sortProgressEntriesNewestFirst(
        get().notebookCustomerNotes.filter((n) => n.customerId === customerId),
      );
    },

    getNotebookCompetitors: (notebookId: string | null): NotebookCompetitor[] => {
      if (!notebookId) return [];
      return sortByOrder(get().notebookCompetitors.filter((c) => c.notebookId === notebookId));
    },

    getNotebookCompetitorNotes: (competitorId: string | null): NotebookCompetitorNote[] => {
      if (!competitorId) return [];
      return sortProgressEntriesNewestFirst(
        get().notebookCompetitorNotes.filter((n) => n.competitorId === competitorId),
      );
    },

    setSelectedNotebookTaskId: (id: string | null) =>
      set({
        selectedNotebookTaskId: id,
        ...(id ? { selectedNotebookSectionTab: "tasks" } : {}),
      }),
    setSelectedNotebookInvestmentId: (id: string | null) =>
      set({
        selectedNotebookInvestmentId: id,
        ...(id ? { selectedNotebookSectionTab: "investments" } : {}),
      }),
    setSelectedNotebookCustomerId: (id: string | null) =>
      set({
        selectedNotebookCustomerId: id,
        ...(id ? { selectedNotebookSectionTab: "customers" } : {}),
      }),
    setSelectedNotebookCompetitorId: (id: string | null) =>
      set({
        selectedNotebookCompetitorId: id,
        ...(id ? { selectedNotebookSectionTab: "competitors" } : {}),
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

    toggleNotebookTask: async (id: string) => {
      const task = get().notebookTasks.find((t) => t.id === id);
      if (!task) return;
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
      if (completed) {
        triggerHaptic("success");
        get().triggerCelebration?.();
      } else {
        triggerHaptic("light");
      }
      if (shouldPersist(task.workspaceId)) {
        void updateTaskDb(id, task.workspaceId, {
          completed,
          completedAt: completed ? now : null,
        });
      }
    },

    updateNotebookTask: async (
      id: string,
      updates: Partial<Pick<NotebookTask, "title" | "showOnWorkspace">>,
    ) => {
      const task = get().notebookTasks.find((t) => t.id === id);
      if (!task) return;
      const now = new Date().toISOString();
      set((state) => ({
        notebookTasks: state.notebookTasks.map((t) =>
          t.id === id ? { ...t, ...updates, updatedAt: now } : t,
        ),
      }));
      if (shouldPersist(task.workspaceId)) {
        void updateTaskDb(id, task.workspaceId, updates);
      }
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

    addNotebookInvestment: async (notebookId: string, title = "New investment") => {
      const workspaceId = wsId();
      const now = new Date().toISOString();
      const maxOrder = get()
        .notebookInvestments.filter((i) => i.notebookId === notebookId)
        .reduce((max, i) => Math.max(max, i.sortOrder), -1000);
      const investment: NotebookInvestment = {
        id: newId(workspaceId),
        notebookId,
        workspaceId,
        title: title.trim() || "New investment",
        completed: false,
        sortOrder: maxOrder + 1000,
        createdAt: now,
        updatedAt: now,
      };
      set((state) => ({ notebookInvestments: [...state.notebookInvestments, investment] }));
      if (isLiveWorkspace(workspaceId)) {
        await ensureNotebookSectionPersistenceReady();
        await createInvestmentDb({
          id: investment.id,
          notebookId,
          workspaceId,
          title: investment.title,
          sortOrder: investment.sortOrder,
        });
      }
      return investment;
    },

    updateNotebookInvestment: async (
      id: string,
      updates: Partial<Pick<NotebookInvestment, "title" | "sortOrder" | "completed" | "completedAt">>,
    ) => {
      const item = get().notebookInvestments.find((i) => i.id === id);
      if (!item) return;
      const now = new Date().toISOString();
      set((state) => ({
        notebookInvestments: state.notebookInvestments.map((i) =>
          i.id === id ? { ...i, ...updates, updatedAt: now } : i,
        ),
      }));
      if (shouldPersist(item.workspaceId)) {
        void updateInvestmentDb(id, item.workspaceId, updates);
      }
    },

    toggleNotebookInvestment: async (id: string) => {
      const item = get().notebookInvestments.find((i) => i.id === id);
      if (!item) return;
      const completed = !item.completed;
      const now = new Date().toISOString();
      set((state) => ({
        notebookInvestments: state.notebookInvestments.map((i) =>
          i.id === id
            ? {
                ...i,
                completed,
                completedAt: completed ? now : null,
                updatedAt: now,
              }
            : i,
        ),
      }));
      if (completed) {
        triggerHaptic("success");
        get().triggerCelebration?.();
      } else {
        triggerHaptic("light");
      }
      if (shouldPersist(item.workspaceId)) {
        void updateInvestmentDb(id, item.workspaceId, {
          completed,
          completedAt: completed ? now : null,
        });
      }
    },

    reorderNotebookInvestments: async (notebookId: string, orderedIds: string[]) => {
      const workspaceId = wsId();
      const now = new Date().toISOString();
      set((state) => ({
        notebookInvestments: state.notebookInvestments.map((item) => {
          if (item.notebookId !== notebookId) return item;
          const index = orderedIds.indexOf(item.id);
          if (index < 0) return item;
          return { ...item, sortOrder: index * 1000, updatedAt: now };
        }),
      }));
      if (shouldPersist(workspaceId)) {
        for (let i = 0; i < orderedIds.length; i++) {
          void updateInvestmentDb(orderedIds[i], workspaceId, { sortOrder: i * 1000 });
        }
      }
    },

    deleteNotebookInvestment: async (id: string) => {
      const item = get().notebookInvestments.find((i) => i.id === id);
      set((state) => ({
        notebookInvestments: state.notebookInvestments.filter((i) => i.id !== id),
        notebookInvestmentNotes: state.notebookInvestmentNotes.filter((n) => n.investmentId !== id),
        selectedNotebookInvestmentId:
          state.selectedNotebookInvestmentId === id ? null : state.selectedNotebookInvestmentId,
      }));
      if (item && shouldPersist(item.workspaceId)) {
        void deleteInvestmentDb(id, item.workspaceId);
      }
    },

    addNotebookInvestmentNote: async (investmentId: string, body: string) => {
      const trimmed = body.trim();
      if (!trimmed) return;
      const investment = get().notebookInvestments.find((i) => i.id === investmentId);
      if (!investment) return;
      const entry: NotebookInvestmentNote = {
        id: newId(investment.workspaceId),
        investmentId,
        body: trimmed,
        authorId: get().user?.id ?? null,
        createdAt: new Date().toISOString(),
      };
      set((state) => ({
        notebookInvestmentNotes: [...state.notebookInvestmentNotes, entry],
      }));
      if (isLiveWorkspace(investment.workspaceId)) {
        await ensureNotebookSectionPersistenceReady();
        void createInvestmentNoteDb({
          id: entry.id,
          investmentId,
          body: trimmed,
          authorId: entry.authorId,
        });
      }
    },

    updateNotebookInvestmentNote: async (id: string, body: string) => {
      const trimmed = body.trim();
      if (!trimmed) return;
      const entry = get().notebookInvestmentNotes.find((n) => n.id === id);
      if (!entry || entry.body === trimmed) return;
      set((state) => ({
        notebookInvestmentNotes: state.notebookInvestmentNotes.map((n) =>
          n.id === id ? { ...n, body: trimmed } : n,
        ),
      }));
      if (isLiveWorkspace(get().currentWorkspace.id)) {
        void updateInvestmentNoteDb(id, trimmed);
      }
    },

    deleteNotebookInvestmentNote: async (id: string) => {
      const entry = get().notebookInvestmentNotes.find((n) => n.id === id);
      if (!entry) return;
      set((state) => ({
        notebookInvestmentNotes: state.notebookInvestmentNotes.filter((n) => n.id !== id),
      }));
      if (isLiveWorkspace(get().currentWorkspace.id)) {
        void deleteInvestmentNoteDb(id);
      }
    },

    addNotebookCustomer: async (notebookId: string, accountName: string) => {
      const workspaceId = wsId();
      const name = accountName.trim();
      if (!name) throw new Error("Customer name is required");
      const now = new Date().toISOString();
      const customer: NotebookCustomer = {
        id: newId(workspaceId),
        notebookId,
        workspaceId,
        accountName: name,
        createdAt: now,
        updatedAt: now,
      };
      const duplicate = get().notebookCustomers.some(
        (c) =>
          c.notebookId === notebookId &&
          c.accountName.localeCompare(name, undefined, { sensitivity: "accent" }) === 0,
      );
      if (duplicate) throw new Error("This customer already exists in this notebook");

      set((state) => ({ notebookCustomers: [...state.notebookCustomers, customer] }));
      if (isLiveWorkspace(workspaceId)) {
        await ensureNotebookSectionPersistenceReady();
        const ok = await createCustomerDb({
          id: customer.id,
          notebookId,
          workspaceId,
          accountName: name,
        });
        if (!ok) {
          set((state) => ({
            notebookCustomers: state.notebookCustomers.filter((c) => c.id !== customer.id),
          }));
          throw new Error("Could not save customer — name may already exist");
        }
      }
      return customer;
    },

    updateNotebookCustomer: async (
      id: string,
      updates: Partial<Pick<NotebookCustomer, "accountName">>,
    ) => {
      const customer = get().notebookCustomers.find((c) => c.id === id);
      if (!customer) return;
      const normalized = { ...updates };
      if (normalized.accountName !== undefined) {
        const name = normalized.accountName.trim();
        if (!name) throw new Error("Customer name is required");
        const duplicate = get().notebookCustomers.some(
          (c) =>
            c.id !== id &&
            c.notebookId === customer.notebookId &&
            c.accountName.localeCompare(name, undefined, { sensitivity: "accent" }) === 0,
        );
        if (duplicate) throw new Error("This customer already exists in this notebook");
        normalized.accountName = name;
      }
      const now = new Date().toISOString();
      set((state) => ({
        notebookCustomers: state.notebookCustomers.map((c) =>
          c.id === id ? { ...c, ...normalized, updatedAt: now } : c,
        ),
      }));
      if (shouldPersist(customer.workspaceId)) {
        void updateCustomerDb(id, customer.workspaceId, normalized);
      }
    },

    deleteNotebookCustomer: async (id: string) => {
      const customer = get().notebookCustomers.find((c) => c.id === id);
      set((state) => ({
        notebookCustomers: state.notebookCustomers.filter((c) => c.id !== id),
        notebookCustomerNotes: state.notebookCustomerNotes.filter((n) => n.customerId !== id),
        selectedNotebookCustomerId:
          state.selectedNotebookCustomerId === id ? null : state.selectedNotebookCustomerId,
      }));
      if (customer && shouldPersist(customer.workspaceId)) {
        void deleteCustomerDb(id, customer.workspaceId);
      }
    },

    addNotebookCustomerNote: async (customerId: string, body: string) => {
      const trimmed = body.trim();
      if (!trimmed) return;
      const customer = get().notebookCustomers.find((c) => c.id === customerId);
      if (!customer) return;
      const entry: NotebookCustomerNote = {
        id: newId(customer.workspaceId),
        customerId,
        body: trimmed,
        authorId: get().user?.id ?? null,
        createdAt: new Date().toISOString(),
      };
      set((state) => ({
        notebookCustomerNotes: [...state.notebookCustomerNotes, entry],
      }));
      if (isLiveWorkspace(customer.workspaceId)) {
        await ensureNotebookSectionPersistenceReady();
        void createCustomerNoteDb({
          id: entry.id,
          customerId,
          body: trimmed,
          authorId: entry.authorId,
        });
      }
    },

    updateNotebookCustomerNote: async (id: string, body: string) => {
      const trimmed = body.trim();
      if (!trimmed) return;
      const entry = get().notebookCustomerNotes.find((n) => n.id === id);
      if (!entry || entry.body === trimmed) return;
      set((state) => ({
        notebookCustomerNotes: state.notebookCustomerNotes.map((n) =>
          n.id === id ? { ...n, body: trimmed } : n,
        ),
      }));
      if (isLiveWorkspace(get().currentWorkspace.id)) {
        void updateCustomerNoteDb(id, trimmed);
      }
    },

    deleteNotebookCustomerNote: async (id: string) => {
      const entry = get().notebookCustomerNotes.find((n) => n.id === id);
      if (!entry) return;
      set((state) => ({
        notebookCustomerNotes: state.notebookCustomerNotes.filter((n) => n.id !== id),
      }));
      if (isLiveWorkspace(get().currentWorkspace.id)) {
        void deleteCustomerNoteDb(id);
      }
    },

    addNotebookCompetitor: async (notebookId: string, name: string, salesPotential = 0) => {
      const workspaceId = wsId();
      const trimmed = name.trim();
      if (!trimmed) throw new Error("Competitor name is required");
      const now = new Date().toISOString();
      const maxOrder = get()
        .notebookCompetitors.filter((c) => c.notebookId === notebookId)
        .reduce((max, c) => Math.max(max, c.sortOrder), -1000);
      const competitor: NotebookCompetitor = {
        id: newId(workspaceId),
        notebookId,
        workspaceId,
        name: trimmed,
        salesPotential: Math.max(0, salesPotential),
        sortOrder: maxOrder + 1000,
        createdAt: now,
        updatedAt: now,
      };
      set((state) => ({ notebookCompetitors: [...state.notebookCompetitors, competitor] }));
      if (isLiveWorkspace(workspaceId)) {
        await ensureNotebookSectionPersistenceReady();
        await createCompetitorDb({
          id: competitor.id,
          notebookId,
          workspaceId,
          name: trimmed,
          salesPotential: competitor.salesPotential,
          sortOrder: competitor.sortOrder,
        });
      }
      return competitor;
    },

    updateNotebookCompetitor: async (
      id: string,
      updates: Partial<Pick<NotebookCompetitor, "name" | "salesPotential" | "sortOrder">>,
    ) => {
      const item = get().notebookCompetitors.find((c) => c.id === id);
      if (!item) return;
      const now = new Date().toISOString();
      const normalized = { ...updates };
      if (normalized.salesPotential !== undefined) {
        normalized.salesPotential = Math.max(0, normalized.salesPotential);
      }
      set((state) => ({
        notebookCompetitors: state.notebookCompetitors.map((c) =>
          c.id === id ? { ...c, ...normalized, updatedAt: now } : c,
        ),
      }));
      if (shouldPersist(item.workspaceId)) {
        void updateCompetitorDb(id, item.workspaceId, normalized);
      }
    },

    deleteNotebookCompetitor: async (id: string) => {
      const item = get().notebookCompetitors.find((c) => c.id === id);
      set((state) => ({
        notebookCompetitors: state.notebookCompetitors.filter((c) => c.id !== id),
        notebookCompetitorNotes: state.notebookCompetitorNotes.filter((n) => n.competitorId !== id),
        selectedNotebookCompetitorId:
          state.selectedNotebookCompetitorId === id ? null : state.selectedNotebookCompetitorId,
      }));
      if (item && shouldPersist(item.workspaceId)) {
        void deleteCompetitorDb(id, item.workspaceId);
      }
    },

    addNotebookCompetitorNote: async (competitorId: string, body: string) => {
      const trimmed = body.trim();
      if (!trimmed) return;
      const competitor = get().notebookCompetitors.find((c) => c.id === competitorId);
      if (!competitor) return;
      const entry: NotebookCompetitorNote = {
        id: newId(competitor.workspaceId),
        competitorId,
        body: trimmed,
        authorId: get().user?.id ?? null,
        createdAt: new Date().toISOString(),
      };
      set((state) => ({
        notebookCompetitorNotes: [...state.notebookCompetitorNotes, entry],
      }));
      if (isLiveWorkspace(competitor.workspaceId)) {
        await ensureNotebookSectionPersistenceReady();
        void createCompetitorNoteDb({
          id: entry.id,
          competitorId,
          body: trimmed,
          authorId: entry.authorId,
        });
      }
    },

    updateNotebookCompetitorNote: async (id: string, body: string) => {
      const trimmed = body.trim();
      if (!trimmed) return;
      const entry = get().notebookCompetitorNotes.find((n) => n.id === id);
      if (!entry || entry.body === trimmed) return;
      set((state) => ({
        notebookCompetitorNotes: state.notebookCompetitorNotes.map((n) =>
          n.id === id ? { ...n, body: trimmed } : n,
        ),
      }));
      if (isLiveWorkspace(get().currentWorkspace.id)) {
        void updateCompetitorNoteDb(id, trimmed);
      }
    },

    deleteNotebookCompetitorNote: async (id: string) => {
      const entry = get().notebookCompetitorNotes.find((n) => n.id === id);
      if (!entry) return;
      set((state) => ({
        notebookCompetitorNotes: state.notebookCompetitorNotes.filter((n) => n.id !== id),
      }));
      if (isLiveWorkspace(get().currentWorkspace.id)) {
        void deleteCompetitorNoteDb(id);
      }
    },

    setNotebookOurSales: async (notebookId: string, ourSales: number) => {
      const workspaceId = wsId();
      const value = Math.max(0, ourSales);
      const now = new Date().toISOString();
      set((state) => ({
        notebooks: state.notebooks.map((nb) =>
          nb.id === notebookId ? { ...nb, ourSales: value, updatedAt: now } : nb,
        ),
      }));
      if (isLiveWorkspace(workspaceId)) {
        void updateOurSalesDb(notebookId, workspaceId, value);
        void updateNotebook(notebookId, workspaceId, { ourSales: value });
      }
    },
  };
}

export type NotebookSectionSliceActions = ReturnType<typeof createNotebookSectionSliceActions>;