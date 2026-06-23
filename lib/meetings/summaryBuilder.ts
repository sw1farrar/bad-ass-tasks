import { format } from "date-fns";
import type { Meeting, MeetingAgendaEntry, MeetingAgendaItem, WorkspaceMember } from "@/types";
import { getMemberDisplayName } from "@/lib/assignee";
import { getMeetingDurationMinutes, meetingStatusLabel } from "@/lib/meetings/meetingLifecycle";
import { sortAgendaItems } from "@/lib/meetings/meetingFilters";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function memberName(members: WorkspaceMember[], userId: string | null | undefined, currentUserId?: string): string {
  if (!userId) return "Unassigned";
  const member = members.find((m) => m.userId === userId);
  return member ? getMemberDisplayName(member, currentUserId) : "Member";
}

export function buildMeetingSummaryHtml(input: {
  meeting: Meeting;
  items: MeetingAgendaItem[];
  entries: MeetingAgendaEntry[];
  members: WorkspaceMember[];
  workspaceName?: string;
  currentUserId?: string;
}): string {
  const { meeting, items, entries, members, workspaceName, currentUserId } = input;
  const sorted = sortAgendaItems(items);
  const duration = getMeetingDurationMinutes(meeting);
  const decisions = entries.filter((e) => e.isDecision || e.body.includes("#decision"));

  const attendeeList = meeting.attendeeIds
    .map((id) => memberName(members, id, currentUserId))
    .join(", ") || "—";

  let html = `<article class="meeting-summary-doc">`;
  if (workspaceName) {
    html += `<p class="meeting-summary-doc__workspace">${escapeHtml(workspaceName)}</p>`;
  }
  html += `<h1 class="meeting-summary-doc__title">${escapeHtml(meeting.title)}</h1>`;
  html += `<p class="meeting-summary-doc__meta">`;
  html += `${escapeHtml(meetingStatusLabel(meeting.status))}`;
  if (meeting.scheduledAt) {
    html += ` · ${escapeHtml(format(new Date(meeting.scheduledAt), "MMM d, yyyy h:mm a"))}`;
  }
  if (duration != null) html += ` · ${duration} min`;
  html += `</p>`;
  html += `<p class="meeting-summary-doc__attendees"><strong>Attendees:</strong> ${escapeHtml(attendeeList)}</p>`;

  if (decisions.length) {
    html += `<section class="meeting-summary-doc__section"><h2>Decisions</h2><ul>`;
    for (const d of decisions) {
      html += `<li>${escapeHtml(d.body.replace(/#decision/gi, "").trim())}</li>`;
    }
    html += `</ul></section>`;
  }

  html += `<section class="meeting-summary-doc__section"><h2>Topics</h2>`;
  for (const item of sorted) {
    const itemEntries = entries
      .filter((e) => e.agendaItemId === item.id)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    html += `<div class="meeting-summary-doc__topic">`;
    html += `<h3>${escapeHtml(item.title)} <span class="meeting-summary-doc__status">(${item.status})</span></h3>`;
    html += `<p class="meeting-summary-doc__owner">Owner: ${escapeHtml(memberName(members, item.ownerId, currentUserId))}</p>`;
    if (itemEntries.length) {
      html += `<ul class="meeting-summary-doc__entries">`;
      for (const entry of itemEntries) {
        const ts = format(new Date(entry.createdAt), "MMM d, h:mm a");
        const author = memberName(members, entry.authorId, currentUserId);
        html += `<li><time>${escapeHtml(ts)}</time> — ${escapeHtml(author)}: ${escapeHtml(entry.body)}</li>`;
      }
      html += `</ul>`;
    }
    html += `</div>`;
  }
  html += `</section>`;

  const carryOver = sorted.filter((i) => i.status === "continued");
  if (carryOver.length) {
    html += `<section class="meeting-summary-doc__section"><h2>Carry-over to next meeting</h2><ul>`;
    for (const item of carryOver) {
      html += `<li>${escapeHtml(item.title)} — ${escapeHtml(memberName(members, item.ownerId, currentUserId))}</li>`;
    }
    html += `</ul></section>`;
  }

  html += `</article>`;
  return html;
}

export function buildMeetingSummaryMarkdown(input: {
  meeting: Meeting;
  items: MeetingAgendaItem[];
  entries: MeetingAgendaEntry[];
  members: WorkspaceMember[];
  currentUserId?: string;
}): string {
  const html = buildMeetingSummaryHtml(input);
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/h[1-3]>/gi, "\n\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function buildMeetingAgendaHtml(input: {
  meeting: Meeting;
  items: MeetingAgendaItem[];
  members: WorkspaceMember[];
  workspaceName?: string;
  currentUserId?: string;
}): string {
  const { meeting, items, members, workspaceName, currentUserId } = input;
  const sorted = sortAgendaItems(items);

  let html = `<article class="meeting-agenda-doc">`;
  if (workspaceName) html += `<p class="meeting-agenda-doc__workspace">${escapeHtml(workspaceName)}</p>`;
  html += `<h1 class="meeting-agenda-doc__title">${escapeHtml(meeting.title)}</h1>`;
  if (meeting.scheduledAt) {
    html += `<p class="meeting-agenda-doc__date">${escapeHtml(format(new Date(meeting.scheduledAt), "EEEE, MMMM d, yyyy · h:mm a"))}</p>`;
  }
  const attendees = meeting.attendeeIds.map((id) => memberName(members, id, currentUserId)).join(", ");
  if (attendees) html += `<p class="meeting-agenda-doc__attendees"><strong>Attendees:</strong> ${escapeHtml(attendees)}</p>`;
  html += `<ol class="meeting-agenda-doc__topics">`;
  for (const item of sorted) {
    html += `<li><strong>${escapeHtml(item.title)}</strong>`;
    if (item.ownerId) html += ` — ${escapeHtml(memberName(members, item.ownerId, currentUserId))}`;
    if (item.timeBudgetMinutes) html += ` (${item.timeBudgetMinutes} min)`;
    if (item.description) html += `<p>${escapeHtml(item.description)}</p>`;
    html += `</li>`;
  }
  html += `</ol></article>`;
  return html;
}