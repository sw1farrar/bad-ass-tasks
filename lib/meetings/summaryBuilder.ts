import { format } from "date-fns";
import type {
  AgendaItemStatus,
  Meeting,
  MeetingAgendaEntry,
  MeetingAgendaItem,
  WorkspaceMember,
} from "@/types";
import { getAgendaItemOwnerLabel } from "@/lib/meetings/agendaOwners";
import { getMeetingDurationMinutes } from "@/lib/meetings/meetingLifecycle";
import { formatAgendaEntryTimestamp } from "@/lib/meetings/agendaEntryLabels";
import {
  sortAgendaItems,
  sortMeetingEntriesChronological,
  sortMeetingEntriesNewestFirst,
} from "@/lib/meetings/meetingFilters";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function topicOutcomeLabel(status: AgendaItemStatus): string {
  switch (status) {
    case "completed":
      return "Done";
    case "continued":
      return "Deferred";
    case "in_progress":
      return "In progress";
    default:
      return "Open";
  }
}

function topicOutcomeModifier(status: AgendaItemStatus): string {
  switch (status) {
    case "completed":
      return "done";
    case "continued":
      return "deferred";
    case "in_progress":
      return "active";
    default:
      return "open";
  }
}

function renderSummaryTopicArticle(
  item: MeetingAgendaItem,
  entries: MeetingAgendaEntry[],
  members: WorkspaceMember[],
  currentUserId?: string,
): string {
  const itemEntries = sortMeetingEntriesChronological(
    entries.filter((e) => e.agendaItemId === item.id),
  );
  const owner = getAgendaItemOwnerLabel(item, members, currentUserId);
  const modifier = topicOutcomeModifier(item.status);

  let html = `<article class="meeting-summary-doc__topic" data-outcome="${modifier}">`;
  html += `<div class="meeting-summary-doc__topic-head">`;
  html += `<h3 class="meeting-summary-doc__topic-title">${escapeHtml(item.title)}</h3>`;
  html += `<div class="meeting-summary-doc__topic-meta">`;
  html += `<span class="meeting-summary-doc__badge meeting-summary-doc__badge--${modifier}">${topicOutcomeLabel(item.status)}</span>`;
  if (owner) {
    html += `<span class="meeting-summary-doc__owner">${escapeHtml(owner)}</span>`;
  }
  html += `</div></div>`;

  if (item.description?.trim()) {
    html += `<p class="meeting-summary-doc__topic-context">${escapeHtml(item.description.trim())}</p>`;
  }

  if (itemEntries.length) {
    html += `<ul class="meeting-summary-doc__notes">`;
    for (const entry of itemEntries) {
      html += `<li class="meeting-summary-doc__note">`;
      html += `<p class="meeting-summary-doc__note-body">${escapeHtml(entry.body)}</p>`;
      html += `<span class="meeting-summary-doc__note-meta">${escapeHtml(
        formatAgendaEntryTimestamp(entry.createdAt),
      )}</span>`;
      html += `</li>`;
    }
    html += `</ul>`;
  } else {
    html += `<p class="meeting-summary-doc__topic-empty">No notes recorded.</p>`;
  }
  html += `</article>`;
  return html;
}

function appendSummaryTopicMarkdown(
  lines: string[],
  item: MeetingAgendaItem,
  entries: MeetingAgendaEntry[],
  members: WorkspaceMember[],
  currentUserId?: string,
): void {
  const owner = getAgendaItemOwnerLabel(item, members, currentUserId);
  const suffix = owner ? ` · ${owner}` : "";
  lines.push(`### ${item.title} (${topicOutcomeLabel(item.status)}${suffix})`, "");
  if (item.description?.trim()) {
    lines.push(item.description.trim(), "");
  }
  const itemEntries = sortMeetingEntriesChronological(
    entries.filter((e) => e.agendaItemId === item.id),
  );
  for (const entry of itemEntries) {
    lines.push(entry.body);
    lines.push(formatAgendaEntryTimestamp(entry.createdAt));
  }
  if (itemEntries.length === 0) lines.push("_No notes recorded._");
  lines.push("");
}

export function buildMeetingSummaryHtml(input: {
  meeting: Meeting;
  items: MeetingAgendaItem[];
  entries: MeetingAgendaEntry[];
  members: WorkspaceMember[];
  workspaceName?: string;
  currentUserId?: string;
}): string {
  const { meeting, items, entries, members, currentUserId } = input;
  const sorted = sortAgendaItems(items);
  const duration = getMeetingDurationMinutes(meeting);
  const decisions = entries.filter((e) => e.isDecision || /#decision/i.test(e.body));
  const discussionItems = sorted.filter((i) => i.status !== "continued");
  const followUps = sorted.filter((i) => i.status === "continued");

  let html = `<article class="meeting-summary-doc">`;

  html += `<header class="meeting-summary-doc__header">`;
  html += `<p class="meeting-summary-doc__eyebrow">Meeting summary</p>`;
  html += `<h1 class="meeting-summary-doc__title">${escapeHtml(meeting.title)}</h1>`;
  html += `<dl class="meeting-summary-doc__facts">`;
  if (meeting.scheduledAt) {
    html += `<div class="meeting-summary-doc__fact">`;
    html += `<dt>When</dt>`;
    html += `<dd>${escapeHtml(format(new Date(meeting.scheduledAt), "EEEE, MMMM d, yyyy"))}</dd>`;
    html += `</div>`;
  }
  if (duration != null) {
    html += `<div class="meeting-summary-doc__fact">`;
    html += `<dt>Duration</dt>`;
    html += `<dd>${duration} min</dd>`;
    html += `</div>`;
  }
  if (discussionItems.length > 0 || followUps.length > 0) {
    html += `<div class="meeting-summary-doc__fact">`;
    html += `<dt>Topics</dt>`;
    html += `<dd>${discussionItems.length + followUps.length}</dd>`;
    html += `</div>`;
  }
  if (decisions.length > 0) {
    html += `<div class="meeting-summary-doc__fact">`;
    html += `<dt>Decisions</dt>`;
    html += `<dd>${decisions.length}</dd>`;
    html += `</div>`;
  }
  html += `</dl></header>`;

  if (decisions.length) {
    html += `<section class="meeting-summary-doc__section meeting-summary-doc__section--decisions">`;
    html += `<h2 class="meeting-summary-doc__section-title">Decisions</h2>`;
    html += `<ul class="meeting-summary-doc__decision-list">`;
    for (const d of decisions) {
      html += `<li>${escapeHtml(d.body.replace(/#decision/gi, "").trim())}</li>`;
    }
    html += `</ul></section>`;
  }

  if (discussionItems.length) {
    html += `<section class="meeting-summary-doc__section">`;
    html += `<h2 class="meeting-summary-doc__section-title">Discussion</h2>`;
    html += `<div class="meeting-summary-doc__topic-list">`;
    for (const item of discussionItems) {
      html += renderSummaryTopicArticle(item, entries, members, currentUserId);
    }
    html += `</div></section>`;
  }

  if (followUps.length) {
    html += `<section class="meeting-summary-doc__section meeting-summary-doc__section--followups">`;
    html += `<h2 class="meeting-summary-doc__section-title">Follow-ups for next time</h2>`;
    html += `<div class="meeting-summary-doc__topic-list">`;
    for (const item of followUps) {
      html += renderSummaryTopicArticle(item, entries, members, currentUserId);
    }
    html += `</div></section>`;
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
  const { meeting, items, entries, members, currentUserId } = input;
  const sorted = sortAgendaItems(items);
  const duration = getMeetingDurationMinutes(meeting);
  const decisions = entries.filter((e) => e.isDecision || /#decision/i.test(e.body));
  const discussionItems = sorted.filter((i) => i.status !== "continued");
  const followUps = sorted.filter((i) => i.status === "continued");

  const lines: string[] = [`# ${meeting.title}`, "", "*Meeting summary*", ""];

  if (meeting.scheduledAt) {
    lines.push(`**When:** ${format(new Date(meeting.scheduledAt), "EEEE, MMMM d, yyyy")}`);
  }
  if (duration != null) lines.push(`**Duration:** ${duration} min`);
  lines.push("");

  if (decisions.length) {
    lines.push("## Decisions", "");
    for (const d of decisions) {
      lines.push(`- ${d.body.replace(/#decision/gi, "").trim()}`);
    }
    lines.push("");
  }

  if (discussionItems.length) {
    lines.push("## Discussion", "");
    for (const item of discussionItems) {
      appendSummaryTopicMarkdown(lines, item, entries, members, currentUserId);
    }
  }

  if (followUps.length) {
    lines.push("## Follow-ups for next time", "");
    for (const item of followUps) {
      appendSummaryTopicMarkdown(lines, item, entries, members, currentUserId);
    }
  }

  return lines.join("\n").trim();
}

function agendaTopicMetaParts(
  item: MeetingAgendaItem,
  members: WorkspaceMember[],
  currentUserId?: string,
): string[] {
  const parts: string[] = [];
  const owner = getAgendaItemOwnerLabel(item, members, currentUserId);
  if (owner) parts.push(owner);
  return parts;
}

export function buildMeetingAgendaHtml(input: {
  meeting: Meeting;
  items: MeetingAgendaItem[];
  entries?: MeetingAgendaEntry[];
  members: WorkspaceMember[];
  workspaceName?: string;
  currentUserId?: string;
  includeComments?: boolean;
}): string {
  const { meeting, items, entries = [], members, currentUserId, includeComments = false } = input;
  const sorted = sortAgendaItems(items);

  let html = `<article class="meeting-agenda-doc">`;
  html += `<h1 class="meeting-agenda-doc__title">${escapeHtml(meeting.title)}</h1>`;
  if (meeting.scheduledAt) {
    html += `<p class="meeting-agenda-doc__date">${escapeHtml(format(new Date(meeting.scheduledAt), "EEEE, MMMM d, yyyy"))}</p>`;
  }
  html += `<p class="meeting-agenda-doc__label">Agenda</p>`;

  if (sorted.length === 0) {
    html += `<p class="meeting-agenda-doc__empty">No topics on the agenda yet.</p>`;
  } else {
    html += `<ol class="meeting-agenda-doc__list">`;
    for (const item of sorted) {
      const meta = agendaTopicMetaParts(item, members, currentUserId);
      const itemEntries = includeComments
        ? sortMeetingEntriesNewestFirst(entries.filter((e) => e.agendaItemId === item.id))
        : [];

      html += `<li class="meeting-agenda-doc__item">`;
      html += `<span class="meeting-agenda-doc__item-title">${escapeHtml(item.title)}</span>`;
      if (meta.length) {
        html += `<span class="meeting-agenda-doc__item-meta"> — ${escapeHtml(meta.join(" · "))}</span>`;
      }
      if (item.description?.trim()) {
        html += `<p class="meeting-agenda-doc__item-desc">${escapeHtml(item.description.trim())}</p>`;
      }
      if (itemEntries.length > 0) {
        html += `<ul class="meeting-agenda-doc__comments">`;
        for (const entry of itemEntries) {
          html += `<li class="meeting-agenda-doc__comment">`;
          html += `<p class="meeting-agenda-doc__comment-body">${escapeHtml(entry.body)}</p>`;
          html += `<span class="meeting-agenda-doc__comment-meta">${escapeHtml(
            formatAgendaEntryTimestamp(entry.createdAt),
          )}</span>`;
          html += `</li>`;
        }
        html += `</ul>`;
      }
      html += `</li>`;
    }
    html += `</ol>`;
  }

  html += `</article>`;
  return html;
}