import type {
  Meeting,
  MeetingAgendaEntry,
  MeetingAgendaItem,
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
import {
  cloneMeetingAgendaEntriesForDuplicate,
  cloneMeetingAgendaItemsForDuplicate,
  DEFAULT_DUPLICATE_MEETING_OPTIONS,
  DUPLICATE_MEETING_TITLE,
  selectAgendaItemsForDuplicate,
  type DuplicateMeetingOptions,
} from "@/lib/meetings/duplicateMeeting";
import { getMeetingTemplate, type MeetingTemplate } from "@/lib/meetings/agendaTemplates";
import { getNextActiveAgendaItemId } from "@/lib/meetings/agendaNavigation";
import {
  sortAgendaItems,
  sortMeetingEntriesNewestFirst,
  sortMeetings,
} from "@/lib/meetings/meetingFilters";
import { shouldAutoDeferAgendaItem } from "@/lib/meetings/meetingLifecycle";
import { buildMeetingSummaryHtml } from "@/lib/meetings/summaryBuilder";
import {
  agendaEntryHasDecisionTag,
  isEmptyAgendaEntryBody,
} from "@/lib/meetings/agendaEntryBody";
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

export const SAMPLE_MEETINGS: Meeting[] = [
  {
    id: "mtg-demo-1",
    workspaceId: "w1",
    title: "Weekly Team Sync — Jun 16, 2026",
    description: "Standup + blocker review for the notes workspace.",
    status: "completed",
    scheduledAt: new Date(Date.now() - 86400000 * 7).toISOString(),
    startedAt: new Date(Date.now() - 86400000 * 7).toISOString(),
    completedAt: new Date(Date.now() - 86400000 * 7 + 3600000).toISOString(),
    attendeeIds: [],
    attendees: [],
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
    reviewed: true,
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
    description?: string | null;
    scheduledAt?: string | null;
    templateId?: string;
    previousMeetingId?: string | null;
    attendeeIds?: string[];
    attendees?: string[];
  }) => Promise<{ meeting: Meeting; agendaItems: MeetingAgendaItem[] }>;
};

type Get = () => MeetingStoreSlice & MeetingSliceActionsInternal;
type Set = (
  partial:
    | Partial<MeetingStoreSlice>
    | ((state: MeetingStoreSlice) => Partial<MeetingStoreSlice>),
) => void;

function isLiveMeetingWorkspace(workspaceId: string): boolean {
  return isSupabaseLive() && !!workspaceId && !["", "w1", "w2"].includes(workspaceId);
}

function shouldPersistMeetings(workspaceId: string): boolean {
  return isLiveMeetingWorkspace(workspaceId) && isMeetingPersistenceEnabled();
}

function newMeetingId(workspaceId: string): string {
  return isLiveMeetingWorkspace(workspaceId) ? generateClientId() : generateId();
}

/** Serialize remote meeting writes so full-array fields (attendees) cannot land out of order. */
const meetingPersistChains = new Map<string, Promise<void>>();

function enqueueMeetingPersist(meetingId: string, task: () => Promise<void>): Promise<void> {
  const previous = meetingPersistChains.get(meetingId) ?? Promise.resolve();
  const next = previous.catch(() => undefined).then(task);
  meetingPersistChains.set(
    meetingId,
    next.catch(() => undefined).then(() => {
      if (meetingPersistChains.get(meetingId) === next) {
        meetingPersistChains.delete(meetingId);
      }
    }),
  );
  return next;
}

const startNextInFlight = new Set<string>();

export function createMeetingSliceActions(get: Get, set: Set) {
  const wsId = () => get().currentWorkspace.id;

  const actions = {
    getMeetings: (): Meeting[] => {
      return sortMeetings(
        get().meetings.filter((m) => m.workspaceId === wsId() && !m.archived),
      );
    },

    getArchivedMeetings: (): Meeting[] => {
      return sortMeetings(
        get().meetings.filter((m) => m.workspaceId === wsId() && !!m.archived),
      );
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

    setSelectedMeetingId: (id: string | null) => {
      set({
        selectedMeetingId: id,
        // Board UI opens topics on demand; do not auto-select an agenda item.
        selectedAgendaItemId: null,
        ...(id ? { selectedNotebookNoteId: null } : {}),
      });
    },

    setSelectedAgendaItemId: (id: string | null) => {
      set({ selectedAgendaItemId: id });
    },

    addMeeting: async (input?: {
      title?: string;
      description?: string | null;
      scheduledAt?: string | null;
      templateId?: string;
      previousMeetingId?: string | null;
      attendeeIds?: string[];
      attendees?: string[];
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
        reviewed: false,
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
        description: input?.description?.trim() || null,
        status: input?.scheduledAt ? "scheduled" : "draft",
        scheduledAt: input?.scheduledAt ?? null,
        attendeeIds: input?.attendeeIds ?? [],
        attendees: input?.attendees ?? [],
        previousMeetingId,
        sortOrder: maxOrder + 1000,
        archived: false,
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
        // Await the parent meeting insert before returning so follow-on agenda
        // writes (copy / carry-over) don't race RLS (meeting must exist first).
        const ready = await ensureMeetingPersistenceReady();
        if (ready) {
          const rollbackLocalMeeting = () => {
            const itemIds = new Set(allAgendaItems.map((item) => item.id));
            set((state) => ({
              meetings: state.meetings.filter((m) => m.id !== meetingId),
              meetingAgendaItems: state.meetingAgendaItems.filter((i) => i.meetingId !== meetingId),
              meetingAgendaEntries: state.meetingAgendaEntries.filter(
                (e) => !itemIds.has(e.agendaItemId),
              ),
            }));
          };

          const ok = await createMeetingSupabase(meeting);
          if (!ok) {
            rollbackLocalMeeting();
            throw new Error("Could not save meeting");
          }
          for (const item of allAgendaItems) {
            const itemOk = await createAgendaItemSupabase(item);
            if (!itemOk) {
              await deleteMeetingSupabase(meetingId, workspaceId);
              rollbackLocalMeeting();
              throw new Error("Could not save meeting topics");
            }
          }
          for (const entry of carryEntries) {
            const entryOk = await createAgendaEntrySupabase(entry);
            if (!entryOk) {
              await deleteMeetingSupabase(meetingId, workspaceId);
              rollbackLocalMeeting();
              throw new Error("Could not save meeting notes");
            }
          }
        }
      }

      return { meeting, agendaItems: allAgendaItems };
    },

    updateMeeting: async (id: string, updates: Partial<Meeting>) => {
      const now = new Date().toISOString();
      const workspaceId = get().meetings.find((m) => m.id === id)?.workspaceId ?? wsId();
      const willArchive = updates.archived === true;
      set((state) => ({
        meetings: state.meetings.map((m) =>
          m.id === id ? { ...m, ...updates, updatedAt: now } : m,
        ),
        ...(willArchive && state.selectedMeetingId === id
          ? { selectedMeetingId: null, selectedAgendaItemId: null }
          : {}),
      }));
      if (workspaceId && shouldPersistMeetings(workspaceId)) {
        await enqueueMeetingPersist(id, async () => {
          const latest = get().meetings.find((m) => m.id === id);
          const payload: Partial<Meeting> = { ...updates };
          // Always persist the latest attendees array so rapid chip edits cannot clobber.
          if (updates.attendees !== undefined && latest) {
            payload.attendees = latest.attendees ?? [];
          }
          await updateMeetingSupabase(id, workspaceId, payload);
        });
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
        reviewed: false,
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
      if (isEmptyAgendaEntryBody(trimmed)) return null;
      const workspaceId = wsId();
      const now = new Date().toISOString();
      const isDecision = agendaEntryHasDecisionTag(trimmed);
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
      if (isEmptyAgendaEntryBody(trimmed)) return;
      const entry = get().meetingAgendaEntries.find((e) => e.id === id);
      if (!entry || entry.body === trimmed) return;
      const isDecision = agendaEntryHasDecisionTag(trimmed);
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
      const meetingItems = get().meetingAgendaItems.filter((i) => i.meetingId === meetingId);
      const toDefer = meetingItems.filter(shouldAutoDeferAgendaItem);
      for (const item of toDefer) {
        await actions.updateAgendaItem(item.id, {
          status: "continued",
          reviewed: true,
          completedAt: null,
        });
      }
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
      await actions.updateAgendaItem(itemId, {
        status: "continued",
        reviewed: true,
        completedAt: null,
      });
      if (item) {
        const nextId = getNextActiveAgendaItemId(
          get().meetingAgendaItems.filter((i) => i.meetingId === item.meetingId),
          itemId,
        );
        if (nextId) set({ selectedAgendaItemId: nextId });
      }
    },

    unreviewAgendaItem: async (itemId: string) => {
      return actions.updateAgendaItem(itemId, {
        status: "open",
        reviewed: false,
        completedAt: null,
      });
    },

    reopenAgendaItem: async (itemId: string) => {
      const item = get().meetingAgendaItems.find((i) => i.id === itemId);
      if (!item) return false;

      // Undo review/defer while still in Active → clear reviewed.
      if (item.status === "continued") {
        return actions.updateAgendaItem(itemId, {
          status: "open",
          reviewed: false,
          completedAt: null,
        });
      }

      // Move out of Completed → keep reviewed and restore continued/open.
      const reviewed = item.reviewed === true;
      return actions.updateAgendaItem(itemId, {
        status: reviewed ? "continued" : "open",
        reviewed,
        completedAt: null,
      });
    },

    startNextMeeting: async (
      previousMeetingId: string,
      options: CarryOverOptions & {
        scheduledAt?: string | null;
        /** Optional custom title; defaults to buildNextMeetingTitle(previous, scheduledAt). */
        title?: string | null;
      } = DEFAULT_CARRY_OVER_OPTIONS,
    ) => {
      if (startNextInFlight.has(previousMeetingId)) {
        throw new Error("Next meeting is already being created");
      }
      startNextInFlight.add(previousMeetingId);
      try {
        const previous = get().meetings.find((m) => m.id === previousMeetingId);
        if (!previous) throw new Error("Meeting not found");
        if (hasMeetingBeenCarriedForward(previousMeetingId, get().meetings)) {
          throw new Error("This meeting's topics were already carried forward");
        }
        const prevItems = get().meetingAgendaItems.filter((i) => i.meetingId === previousMeetingId);
        const sourceItems = sortAgendaItems(getCarryOverSourceItems(prevItems, options));
        // Prefer explicit null (undated) over inventing "today" when callers omit the field.
        const scheduledAt = options.scheduledAt === undefined ? null : options.scheduledAt;
        const title =
          options.title?.trim() || buildNextMeetingTitle(previous, scheduledAt);
        const { meeting, agendaItems: templateItems } = await actions.addMeeting({
          title,
          scheduledAt,
          previousMeetingId: previous.id,
          attendeeIds: [...previous.attendeeIds],
          attendees: [...(previous.attendees ?? [])],
        });
        const idFn = isLiveMeetingWorkspace(meeting.workspaceId) ? generateClientId : generateId;
        const carryItems = cloneCarryOverItems(
          sourceItems,
          meeting.id,
          templateItems.length * 1000,
          idFn,
        );
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
              const itemOk = await createAgendaItemSupabase(item);
              if (!itemOk) {
                await actions.deleteMeeting(meeting.id);
                throw new Error("Could not save carry-over topics");
              }
            }
            for (const entry of carryEntries) {
              const entryOk = await createAgendaEntrySupabase(entry);
              if (!entryOk) {
                await actions.deleteMeeting(meeting.id);
                throw new Error("Could not save carry-over notes");
              }
            }
          }
        }
        // Completing → next meeting: archive the finished meeting so the library stays focused.
        if (!previous.archived) {
          await actions.updateMeeting(previousMeetingId, { archived: true });
        }
        return { meeting, agendaItems: [...templateItems, ...carryItems] };
      } finally {
        startNextInFlight.delete(previousMeetingId);
      }
    },

    duplicateMeeting: async (
      sourceMeetingId: string,
      options: DuplicateMeetingOptions = DEFAULT_DUPLICATE_MEETING_OPTIONS,
    ) => {
      const source = get().meetings.find((m) => m.id === sourceMeetingId);
      if (!source) throw new Error("Meeting not found");

      const title = options.title?.trim() || DUPLICATE_MEETING_TITLE;
      const scheduledAt =
        options.scheduledAt === undefined
          ? new Date().toISOString()
          : options.scheduledAt;
      const { meeting } = await actions.addMeeting({
        title,
        description: source.description ?? null,
        scheduledAt,
        attendeeIds: [...source.attendeeIds],
        attendees: [...(source.attendees ?? [])],
      });

      const idFn = isLiveMeetingWorkspace(meeting.workspaceId) ? generateClientId : generateId;
      const allSourceItems = get().meetingAgendaItems.filter((i) => i.meetingId === sourceMeetingId);
      const sourceItems = selectAgendaItemsForDuplicate(allSourceItems, options.agendaItemIds);
      const { items: clonedItems, idMap } = cloneMeetingAgendaItemsForDuplicate(
        sourceItems,
        meeting.id,
        idFn,
      );

      let clonedEntries: MeetingAgendaEntry[] = [];
      if (options.includeNotes && clonedItems.length > 0) {
        const sourceItemIds = new Set(sourceItems.map((item) => item.id));
        const sourceEntries = get().meetingAgendaEntries.filter((entry) =>
          sourceItemIds.has(entry.agendaItemId),
        );
        clonedEntries = cloneMeetingAgendaEntriesForDuplicate(sourceEntries, idMap, idFn);
      }

      if (clonedItems.length) {
        set((state) => ({
          meetingAgendaItems: [...state.meetingAgendaItems, ...clonedItems],
          meetingAgendaEntries: [...state.meetingAgendaEntries, ...clonedEntries],
        }));
        if (shouldPersistMeetings(meeting.workspaceId)) {
          for (const item of clonedItems) {
            const ok = await createAgendaItemSupabase(item);
            if (!ok) {
              throw new Error("Could not save copied agenda topics");
            }
          }
          for (const entry of clonedEntries) {
            const ok = await createAgendaEntrySupabase(entry);
            if (!ok) {
              throw new Error("Could not save copied agenda notes");
            }
          }
        }
      }

      return { meeting, agendaItems: clonedItems };
    },
  };

  return actions;
}

export type MeetingSliceActions = ReturnType<typeof createMeetingSliceActions>;