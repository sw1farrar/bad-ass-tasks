import type {
  Meeting,
  MeetingAgendaEntry,
  MeetingAgendaItem,
  NotesPageMode,
  Workspace,
  WorkspaceMember,
} from "@/types";
import { generateId } from "@/lib/utils";
import {
  buildNextMeetingTitle,
  cloneCarryOverEntries,
  cloneCarryOverItems,
  DEFAULT_CARRY_OVER_OPTIONS,
  getCarryOverSourceItems,
  hasMeetingBeenCarriedForward,
  type CarryOverOptions,
} from "@/lib/meetings/carryOver";
import { getMeetingTemplate, type MeetingTemplate } from "@/lib/meetings/agendaTemplates";
import { getFirstAgendaItemId, getNextActiveAgendaItemId } from "@/lib/meetings/agendaNavigation";
import {
  sortAgendaItems,
  sortMeetingEntriesNewestFirst,
  sortMeetings,
} from "@/lib/meetings/meetingFilters";
import { buildMeetingSummaryHtml } from "@/lib/meetings/summaryBuilder";
import {
  createMeeting as createMeetingSupabase,
  createMeetingAgendaItem as createAgendaItemSupabase,
  createMeetingAgendaEntry as createAgendaEntrySupabase,
  updateMeetingAgendaEntry as updateAgendaEntrySupabase,
  deleteMeetingAgendaEntry as deleteAgendaEntrySupabase,
  deleteMeeting as deleteMeetingSupabase,
  ensureMeetingPersistenceReady,
  generateClientId,
  isMeetingPersistenceEnabled,
  isSupabaseLive,
  updateMeeting as updateMeetingSupabase,
  updateMeetingAgendaItem as updateAgendaItemSupabase,
  deleteMeetingAgendaItem as deleteAgendaItemSupabase,
} from "@/lib/data/hybridStore";

const NOTES_PAGE_MODE_KEY = "badazz-notes-page-mode";

export const SAMPLE_MEETINGS: Meeting[] = [
  {
    id: "mtg-demo-1",
    workspaceId: "w1",
    title: "Weekly Team Sync — Jun 16, 2026",
    status: "completed",
    scheduledAt: new Date(Date.now() - 86400000 * 7).toISOString(),
    startedAt: new Date(Date.now() - 86400000 * 7).toISOString(),
    completedAt: new Date(Date.now() - 86400000 * 7 + 3600000).toISOString(),
    attendeeIds: [],
    sortOrder: 0,
    createdAt: new Date(Date.now() - 86400000 * 8).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 7).toISOString(),
  },
];

export const SAMPLE_AGENDA_ITEMS: MeetingAgendaItem[] = [
  {
    id: "agi-demo-1",
    meetingId: "mtg-demo-1",
    title: "Project updates",
    sortOrder: 0,
    status: "completed",
    linkedTaskIds: [],
    completedAt: new Date(Date.now() - 86400000 * 7).toISOString(),
    createdAt: new Date(Date.now() - 86400000 * 8).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 7).toISOString(),
  },
  {
    id: "agi-demo-2",
    meetingId: "mtg-demo-1",
    title: "Budget review",
    sortOrder: 1000,
    status: "continued",
    linkedTaskIds: [],
    createdAt: new Date(Date.now() - 86400000 * 8).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 7).toISOString(),
  },
];

export const SAMPLE_AGENDA_ENTRIES: MeetingAgendaEntry[] = [
  {
    id: "age-demo-1",
    agendaItemId: "agi-demo-1",
    body: "Shipped the new notes editor.",
    createdAt: new Date(Date.now() - 86400000 * 7).toISOString(),
  },
];

type MeetingStoreSlice = {
  meetings: Meeting[];
  meetingAgendaItems: MeetingAgendaItem[];
  meetingAgendaEntries: MeetingAgendaEntry[];
  notesPageMode: NotesPageMode;
  selectedMeetingId: string | null;
  selectedAgendaItemId: string | null;
  selectedNotebookId: string | null;
  selectedNotebookNoteId: string | null;
  members: WorkspaceMember[];
  user: { id: string } | null;
  currentWorkspace: Workspace;
};

type MeetingSliceActionsInternal = {
  updateMeeting: (id: string, updates: Partial<Meeting>) => Promise<boolean>;
  updateAgendaItem: (id: string, updates: Partial<MeetingAgendaItem>) => Promise<boolean>;
  addMeeting: (input?: {
    title?: string;
    scheduledAt?: string | null;
    templateId?: string;
    previousMeetingId?: string | null;
    attendeeIds?: string[];
  }) => Promise<{ meeting: Meeting; agendaItems: MeetingAgendaItem[] }>;
};

type Get = () => MeetingStoreSlice & MeetingSliceActionsInternal;
type Set = (
  partial:
    | Partial<MeetingStoreSlice>
    | ((state: MeetingStoreSlice) => Partial<MeetingStoreSlice>),
) => void;

function readNotesPageMode(): NotesPageMode {
  if (typeof window === "undefined") return "notes";
  try {
    const v = sessionStorage.getItem(NOTES_PAGE_MODE_KEY);
    return v === "meetings" ? "meetings" : "notes";
  } catch {
    return "notes";
  }
}

function writeNotesPageMode(mode: NotesPageMode): void {
  try {
    sessionStorage.setItem(NOTES_PAGE_MODE_KEY, mode);
  } catch {
    /* ignore */
  }
}

function isLiveMeetingWorkspace(workspaceId: string): boolean {
  return isSupabaseLive() && !!workspaceId && !["", "w1", "w2"].includes(workspaceId);
}

function shouldPersistMeetings(workspaceId: string): boolean {
  return isLiveMeetingWorkspace(workspaceId) && isMeetingPersistenceEnabled();
}

function newMeetingId(workspaceId: string): string {
  return isLiveMeetingWorkspace(workspaceId) ? generateClientId() : generateId();
}

export function createMeetingSliceActions(get: Get, set: Set) {
  const wsId = () => get().currentWorkspace.id;

  const actions = {
    getMeetings: (): Meeting[] => {
      return sortMeetings(get().meetings.filter((m) => m.workspaceId === wsId()));
    },

    getMeetingAgendaItems: (meetingId: string | null): MeetingAgendaItem[] => {
      if (!meetingId) return [];
      return sortAgendaItems(get().meetingAgendaItems.filter((i) => i.meetingId === meetingId));
    },

    getMeetingAgendaEntries: (agendaItemId: string | null): MeetingAgendaEntry[] => {
      if (!agendaItemId) return [];
      return sortMeetingEntriesNewestFirst(
        get().meetingAgendaEntries.filter((e) => e.agendaItemId === agendaItemId),
      );
    },

    setNotesPageMode: (mode: NotesPageMode) => {
      writeNotesPageMode(mode);
      set({
        notesPageMode: mode,
        ...(mode === "meetings"
          ? { selectedNotebookNoteId: null }
          : { selectedMeetingId: null, selectedAgendaItemId: null }),
      });
    },

    setSelectedMeetingId: (id: string | null) => {
      const nextAgendaId = id
        ? getFirstAgendaItemId(
            get().meetingAgendaItems.filter((i) => i.meetingId === id),
          )
        : null;
      set({
        selectedMeetingId: id,
        selectedAgendaItemId: nextAgendaId,
        ...(id ? { selectedNotebookNoteId: null } : {}),
      });
    },

    setSelectedAgendaItemId: (id: string | null) => {
      set({ selectedAgendaItemId: id });
    },

    addMeeting: async (input?: {
      title?: string;
      scheduledAt?: string | null;
      templateId?: string;
      previousMeetingId?: string | null;
      attendeeIds?: string[];
      carryOverFromMeetingId?: string | null;
      carryOver?: CarryOverOptions;
    }) => {
      const workspaceId = wsId();
      const now = new Date().toISOString();
      const maxOrder = get()
        .meetings.filter((m) => m.workspaceId === workspaceId)
        .reduce((max, m) => Math.max(max, m.sortOrder), -1000);

      const template: MeetingTemplate | undefined = input?.templateId
        ? getMeetingTemplate(input.templateId)
        : undefined;

      const meetingId = newMeetingId(workspaceId);
      const agendaItems: MeetingAgendaItem[] = (template?.topics ?? []).map((topic, index) => ({
        id: isLiveMeetingWorkspace(workspaceId) ? generateClientId() : generateId(),
        meetingId,
        title: topic.title,
        sortOrder: index * 1000,
        status: "open" as const,
        linkedTaskIds: [],
        createdAt: now,
        updatedAt: now,
      }));

      const carrySourceMeetingId = input?.carryOverFromMeetingId ?? null;
      const carryOptions = input?.carryOver ?? DEFAULT_CARRY_OVER_OPTIONS;
      let carryItems: MeetingAgendaItem[] = [];
      let carryEntries: MeetingAgendaEntry[] = [];
      let previousMeetingId = input?.previousMeetingId ?? null;

      if (
        carrySourceMeetingId &&
        !hasMeetingBeenCarriedForward(carrySourceMeetingId, get().meetings)
      ) {
        const sourceItems = get().meetingAgendaItems.filter(
          (i) => i.meetingId === carrySourceMeetingId,
        );
        const picked = getCarryOverSourceItems(sourceItems, carryOptions);
        if (picked.length > 0) {
          previousMeetingId = carrySourceMeetingId;
          const idFn = isLiveMeetingWorkspace(workspaceId) ? generateClientId : generateId;
          carryItems = cloneCarryOverItems(
            picked,
            meetingId,
            agendaItems.length * 1000,
            idFn,
          );
          const sourceItemIds = new Set(picked.map((item) => item.id));
          const sourceEntries = get().meetingAgendaEntries.filter((entry) =>
            sourceItemIds.has(entry.agendaItemId),
          );
          carryEntries = cloneCarryOverEntries(sourceEntries, carryItems, idFn);
        }
      }

      const meeting: Meeting = {
        id: meetingId,
        workspaceId,
        title: input?.title?.trim() || "Untitled meeting",
        status: input?.scheduledAt ? "scheduled" : "draft",
        scheduledAt: input?.scheduledAt ?? null,
        attendeeIds: input?.attendeeIds ?? [],
        previousMeetingId,
        sortOrder: maxOrder + 1000,
        createdAt: now,
        updatedAt: now,
      };

      const allAgendaItems = [...agendaItems, ...carryItems];

      set((state) => ({
        meetings: [...state.meetings, meeting],
        meetingAgendaItems: [...state.meetingAgendaItems, ...allAgendaItems],
        meetingAgendaEntries: [...state.meetingAgendaEntries, ...carryEntries],
      }));

      if (isLiveMeetingWorkspace(workspaceId)) {
        void (async () => {
          const ready = await ensureMeetingPersistenceReady();
          if (!ready) return;
          const ok = await createMeetingSupabase(meeting);
          if (!ok) return;
          for (const item of allAgendaItems) {
            await createAgendaItemSupabase(item);
          }
          for (const entry of carryEntries) {
            await createAgendaEntrySupabase(entry);
          }
        })();
      }

      return { meeting, agendaItems: allAgendaItems };
    },

    updateMeeting: async (id: string, updates: Partial<Meeting>) => {
      const now = new Date().toISOString();
      const workspaceId = get().meetings.find((m) => m.id === id)?.workspaceId ?? wsId();
      set((state) => ({
        meetings: state.meetings.map((m) =>
          m.id === id ? { ...m, ...updates, updatedAt: now } : m,
        ),
      }));
      if (workspaceId && shouldPersistMeetings(workspaceId)) {
        void updateMeetingSupabase(id, workspaceId, updates);
      }
      return true;
    },

    deleteMeeting: async (id: string) => {
      const workspaceId = get().meetings.find((m) => m.id === id)?.workspaceId ?? wsId();
      const itemIds = get()
        .meetingAgendaItems.filter((i) => i.meetingId === id)
        .map((i) => i.id);
      set((state) => ({
        meetings: state.meetings.filter((m) => m.id !== id),
        meetingAgendaItems: state.meetingAgendaItems.filter((i) => i.meetingId !== id),
        meetingAgendaEntries: state.meetingAgendaEntries.filter(
          (e) => !itemIds.includes(e.agendaItemId),
        ),
        selectedMeetingId: state.selectedMeetingId === id ? null : state.selectedMeetingId,
        selectedAgendaItemId:
          state.selectedAgendaItemId &&
          itemIds.includes(state.selectedAgendaItemId)
            ? null
            : state.selectedAgendaItemId,
      }));
      if (workspaceId && shouldPersistMeetings(workspaceId)) {
        void deleteMeetingSupabase(id, workspaceId);
      }
      return true;
    },

    addAgendaItem: async (meetingId: string, title = "New topic") => {
      const workspaceId = wsId();
      const now = new Date().toISOString();
      const maxOrder = get()
        .meetingAgendaItems.filter((i) => i.meetingId === meetingId)
        .reduce((max, i) => Math.max(max, i.sortOrder), -1000);
      const item: MeetingAgendaItem = {
        id: isLiveMeetingWorkspace(workspaceId) ? generateClientId() : generateId(),
        meetingId,
        title: title.trim() || "New topic",
        sortOrder: maxOrder + 1000,
        status: "open",
        linkedTaskIds: [],
        createdAt: now,
        updatedAt: now,
      };
      set((state) => ({ meetingAgendaItems: [...state.meetingAgendaItems, item] }));
      if (shouldPersistMeetings(workspaceId)) {
        void createAgendaItemSupabase(item);
      }
      return item;
    },

    updateAgendaItem: async (id: string, updates: Partial<MeetingAgendaItem>) => {
      const now = new Date().toISOString();
      const item = get().meetingAgendaItems.find((i) => i.id === id);
      const meeting = item ? get().meetings.find((m) => m.id === item.meetingId) : null;
      const workspaceId = meeting?.workspaceId ?? wsId();
      set((state) => ({
        meetingAgendaItems: state.meetingAgendaItems.map((i) =>
          i.id === id ? { ...i, ...updates, updatedAt: now } : i,
        ),
      }));
      if (shouldPersistMeetings(workspaceId)) {
        void updateAgendaItemSupabase(id, updates);
      }
      return true;
    },

    deleteAgendaItem: async (id: string) => {
      const workspaceId = wsId();
      set((state) => ({
        meetingAgendaItems: state.meetingAgendaItems.filter((i) => i.id !== id),
        meetingAgendaEntries: state.meetingAgendaEntries.filter((e) => e.agendaItemId !== id),
        selectedAgendaItemId: state.selectedAgendaItemId === id ? null : state.selectedAgendaItemId,
      }));
      if (shouldPersistMeetings(workspaceId)) {
        void deleteAgendaItemSupabase(id);
      }
      return true;
    },

    reorderAgendaItems: async (meetingId: string, orderedIds: string[]) => {
      const now = new Date().toISOString();
      const workspaceId = wsId();
      set((state) => ({
        meetingAgendaItems: state.meetingAgendaItems.map((item) => {
          if (item.meetingId !== meetingId) return item;
          const index = orderedIds.indexOf(item.id);
          if (index < 0) return item;
          return { ...item, sortOrder: index * 1000, updatedAt: now };
        }),
      }));
      if (shouldPersistMeetings(workspaceId)) {
        for (let i = 0; i < orderedIds.length; i++) {
          void updateAgendaItemSupabase(orderedIds[i], { sortOrder: i * 1000 });
        }
      }
    },

    addAgendaEntry: async (agendaItemId: string, body: string) => {
      const trimmed = body.trim();
      if (!trimmed) return null;
      const workspaceId = wsId();
      const now = new Date().toISOString();
      const isDecision = /#decision/i.test(trimmed);
      const entry: MeetingAgendaEntry = {
        id: isLiveMeetingWorkspace(workspaceId) ? generateClientId() : generateId(),
        agendaItemId,
        body: trimmed,
        authorId: get().user?.id ?? null,
        isDecision,
        createdAt: now,
      };
      set((state) => ({ meetingAgendaEntries: [...state.meetingAgendaEntries, entry] }));
      if (shouldPersistMeetings(workspaceId)) {
        void createAgendaEntrySupabase(entry);
      }
      return entry;
    },

    updateAgendaEntry: async (id: string, body: string) => {
      const trimmed = body.trim();
      if (!trimmed) return;
      const entry = get().meetingAgendaEntries.find((e) => e.id === id);
      if (!entry || entry.body === trimmed) return;
      const isDecision = /#decision/i.test(trimmed);
      set((state) => ({
        meetingAgendaEntries: state.meetingAgendaEntries.map((e) =>
          e.id === id ? { ...e, body: trimmed, isDecision } : e,
        ),
      }));
      const workspaceId = wsId();
      if (shouldPersistMeetings(workspaceId)) {
        void updateAgendaEntrySupabase(id, { body: trimmed, isDecision });
      }
    },

    deleteAgendaEntry: async (id: string) => {
      const entry = get().meetingAgendaEntries.find((e) => e.id === id);
      if (!entry) return;
      set((state) => ({
        meetingAgendaEntries: state.meetingAgendaEntries.filter((e) => e.id !== id),
      }));
      const workspaceId = wsId();
      if (shouldPersistMeetings(workspaceId)) {
        void deleteAgendaEntrySupabase(id);
      }
    },

    completeMeeting: async (meetingId: string) => {
      const meeting = get().meetings.find((m) => m.id === meetingId);
      if (!meeting) return false;
      const items = get().meetingAgendaItems.filter((i) => i.meetingId === meetingId);
      const itemIds = new Set(items.map((i) => i.id));
      const entries = get().meetingAgendaEntries.filter((e) => itemIds.has(e.agendaItemId));
      const now = new Date().toISOString();
      const summaryHtml = buildMeetingSummaryHtml({
        meeting: { ...meeting, status: "completed", completedAt: now },
        items,
        entries,
        members: get().members,
        workspaceName: get().currentWorkspace.name,
        currentUserId: get().user?.id,
      });
      return actions.updateMeeting(meetingId, {
        status: "completed",
        completedAt: now,
        startedAt: meeting.startedAt ?? now,
        summaryHtml,
      });
    },

    reopenMeeting: async (meetingId: string) => {
      const meeting = get().meetings.find((m) => m.id === meetingId);
      return actions.updateMeeting(meetingId, {
        status: meeting?.scheduledAt ? "scheduled" : "draft",
        completedAt: null,
        summaryHtml: null,
      });
    },

    completeAgendaItem: async (itemId: string) => {
      const item = get().meetingAgendaItems.find((i) => i.id === itemId);
      await actions.updateAgendaItem(itemId, {
        status: "completed",
        completedAt: new Date().toISOString(),
      });
      if (item) {
        const nextId = getNextActiveAgendaItemId(
          get().meetingAgendaItems.filter((i) => i.meetingId === item.meetingId),
          itemId,
        );
        if (nextId) set({ selectedAgendaItemId: nextId });
      }
    },

    continueAgendaItem: async (itemId: string) => {
      const item = get().meetingAgendaItems.find((i) => i.id === itemId);
      await actions.updateAgendaItem(itemId, { status: "continued", completedAt: null });
      if (item) {
        const nextId = getNextActiveAgendaItemId(
          get().meetingAgendaItems.filter((i) => i.meetingId === item.meetingId),
          itemId,
        );
        if (nextId) set({ selectedAgendaItemId: nextId });
      }
    },

    reopenAgendaItem: async (itemId: string) => {
      return actions.updateAgendaItem(itemId, { status: "open", completedAt: null });
    },

    startNextMeeting: async (
      previousMeetingId: string,
      options: CarryOverOptions = DEFAULT_CARRY_OVER_OPTIONS,
    ) => {
      const previous = get().meetings.find((m) => m.id === previousMeetingId);
      if (!previous) throw new Error("Meeting not found");
      if (hasMeetingBeenCarriedForward(previousMeetingId, get().meetings)) {
        throw new Error("This meeting's topics were already carried forward");
      }
      const prevItems = get().meetingAgendaItems.filter((i) => i.meetingId === previousMeetingId);
      const sourceItems = sortAgendaItems(getCarryOverSourceItems(prevItems, options));
      const { meeting, agendaItems: templateItems } = await actions.addMeeting({
        title: buildNextMeetingTitle(previous),
        scheduledAt: new Date().toISOString(),
        previousMeetingId: previous.id,
        attendeeIds: [...previous.attendeeIds],
      });
      const idFn = isLiveMeetingWorkspace(meeting.workspaceId) ? generateClientId : generateId;
      const carryItems = cloneCarryOverItems(sourceItems, meeting.id, templateItems.length * 1000, idFn);
      const sourceItemIds = new Set(sourceItems.map((item) => item.id));
      const sourceEntries = get().meetingAgendaEntries.filter((entry) =>
        sourceItemIds.has(entry.agendaItemId),
      );
      const carryEntries = cloneCarryOverEntries(sourceEntries, carryItems, idFn);
      if (carryItems.length) {
        set((state) => ({
          meetingAgendaItems: [...state.meetingAgendaItems, ...carryItems],
          meetingAgendaEntries: [...state.meetingAgendaEntries, ...carryEntries],
        }));
        if (shouldPersistMeetings(meeting.workspaceId)) {
          for (const item of carryItems) {
            void createAgendaItemSupabase(item);
          }
          for (const entry of carryEntries) {
            void createAgendaEntrySupabase(entry);
          }
        }
      }
      return { meeting, agendaItems: [...templateItems, ...carryItems] };
    },
  };

  return actions;
}

export type MeetingSliceActions = ReturnType<typeof createMeetingSliceActions>;

export function getInitialNotesPageMode(): NotesPageMode {
  return readNotesPageMode();
}