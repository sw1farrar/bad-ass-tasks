import type { Meeting, MeetingAgendaItem, Note, Task } from "@/types";

type WorkspaceSlice = {
  tasks: Task[];
  notes: Note[];
  currentWorkspace: { id: string };
};

type MeetingWorkspaceSlice = {
  meetings: Meeting[];
  meetingAgendaItems: MeetingAgendaItem[];
  currentWorkspace: { id: string };
};

/** Comments table has no workspace_id — scope via linked task/note in the active workspace. */
export function commentBelongsToWorkspace(
  state: WorkspaceSlice,
  row: { task_id?: string | null; note_id?: string | null } | null | undefined,
): boolean {
  if (!row) return false;
  const wsId = state.currentWorkspace.id;
  if (row.task_id) {
    return state.tasks.some((t) => t.id === row.task_id && t.workspaceId === wsId);
  }
  if (row.note_id) {
    return state.notes.some((n) => n.id === row.note_id && n.workspaceId === wsId);
  }
  return false;
}

/** Agenda items have meeting_id only — scope via parent meeting in the active workspace. */
export function agendaItemBelongsToWorkspace(
  state: MeetingWorkspaceSlice,
  row: { meeting_id?: string | null } | null | undefined,
): boolean {
  if (!row?.meeting_id) return false;
  const wsId = state.currentWorkspace.id;
  return state.meetings.some((m) => m.id === row.meeting_id && m.workspaceId === wsId);
}

/** Agenda entries have agenda_item_id only — scope via known agenda item + meeting. */
export function agendaEntryBelongsToWorkspace(
  state: MeetingWorkspaceSlice,
  row: { agenda_item_id?: string | null } | null | undefined,
): boolean {
  if (!row?.agenda_item_id) return false;
  const wsId = state.currentWorkspace.id;
  const item = state.meetingAgendaItems.find((i) => i.id === row.agenda_item_id);
  if (!item) return false;
  return state.meetings.some((m) => m.id === item.meetingId && m.workspaceId === wsId);
}