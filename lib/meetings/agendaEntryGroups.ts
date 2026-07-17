import { format, parseISO } from "date-fns";
import type { MeetingAgendaEntry } from "@/types";
import {
  appendIndentedPlainTextBlock,
} from "@/lib/meetings/agendaEntryLabels";
import {
  agendaEntryBodyToClipboardHtml,
  agendaEntryBodyToHtml,
  agendaEntryPlainText,
} from "@/lib/meetings/agendaEntryBody";
import { sortMeetingEntriesNewestFirst } from "@/lib/meetings/meetingFilters";

export type AgendaEntryDateGroup = {
  dateKey: string;
  dateLabel: string;
  entries: MeetingAgendaEntry[];
};

export function formatAgendaEntryDateHeading(createdAt: string): string {
  return format(parseISO(createdAt), "MMMM d, yyyy");
}

function getAgendaEntryDateKey(createdAt: string): string {
  return format(parseISO(createdAt), "yyyy-MM-dd");
}

/** Group notes by calendar date; newest dates first, newest notes first within each date. */
export function groupAgendaEntriesByDate(entries: MeetingAgendaEntry[]): AgendaEntryDateGroup[] {
  const sorted = sortMeetingEntriesNewestFirst(entries);
  const groups = new Map<string, MeetingAgendaEntry[]>();

  for (const entry of sorted) {
    const key = getAgendaEntryDateKey(entry.createdAt);
    const list = groups.get(key);
    if (list) list.push(entry);
    else groups.set(key, [entry]);
  }

  return Array.from(groups.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([dateKey, groupEntries]) => ({
      dateKey,
      dateLabel: formatAgendaEntryDateHeading(groupEntries[0].createdAt),
      entries: groupEntries,
    }));
}

export function buildAgendaEntryGroupsDocumentHtml(
  entries: MeetingAgendaEntry[],
  escapeHtml: (text: string) => string,
): string {
  const groups = groupAgendaEntriesByDate(entries);
  if (groups.length === 0) return "";

  let html = `<div class="meeting-agenda-doc__comments">`;
  for (const group of groups) {
    html += `<section class="meeting-agenda-doc__comment-date-section">`;
    html += `<h4 class="meeting-agenda-doc__comment-date-heading">${escapeHtml(group.dateLabel)}</h4>`;
    html += `<ul class="meeting-agenda-doc__comment-list">`;
    for (const entry of group.entries) {
      html += `<li class="meeting-agenda-doc__comment">`;
      html += `<div class="meeting-agenda-doc__comment-body">${agendaEntryBodyToHtml(entry.body, escapeHtml)}</div>`;
      html += `</li>`;
    }
    html += `</ul></section>`;
  }
  html += `</div>`;
  return html;
}

export function buildAgendaEntryGroupsClipboardHtml(
  entries: MeetingAgendaEntry[],
  escapeHtml: (text: string) => string,
): string {
  const groups = groupAgendaEntriesByDate(entries);
  if (groups.length === 0) return "";

  let html = `<div style="margin: 8px 0 0 0; padding: 0 0 0 14px; border-left: 2px solid #cccccc;">`;
  for (const group of groups) {
    html += `<section style="margin: 0 0 10px 10px; padding: 0;">`;
    html += `<p style="margin: 0 0 4px; font-size: 8pt; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: #000000;">${escapeHtml(group.dateLabel)}</p>`;
    html += `<ul style="margin: 0; padding: 0; list-style: none;">`;
    for (let i = 0; i < group.entries.length; i++) {
      const entry = group.entries[i];
      const isLast = i === group.entries.length - 1;
      const divider = isLast ? "" : "border-bottom: 1px solid #eeeeee;";
      html += `<li style="margin: 0; padding: 0 0 6px; ${divider}">`;
      html += `<div style="display: block; font-size: 10pt; color: #000000; line-height: 1.4;">${agendaEntryBodyToClipboardHtml(entry.body, escapeHtml)}</div>`;
      html += `</li>`;
    }
    html += `</ul></section>`;
  }
  html += `</div>`;
  return html;
}

export function buildAgendaEntryGroupsSummaryHtml(
  entries: MeetingAgendaEntry[],
  escapeHtml: (text: string) => string,
): string {
  const groups = groupAgendaEntriesByDate(entries);
  if (groups.length === 0) return "";

  let html = `<div class="meeting-summary-doc__notes">`;
  for (const group of groups) {
    html += `<section class="meeting-summary-doc__note-date-section">`;
    html += `<h4 class="meeting-summary-doc__note-date-heading">${escapeHtml(group.dateLabel)}</h4>`;
    html += `<ul class="meeting-summary-doc__note-list">`;
    for (const entry of group.entries) {
      html += `<li class="meeting-summary-doc__note">`;
      html += `<div class="meeting-summary-doc__note-body">${agendaEntryBodyToHtml(entry.body, escapeHtml)}</div>`;
      html += `</li>`;
    }
    html += `</ul></section>`;
  }
  html += `</div>`;
  return html;
}

export function appendAgendaEntryGroupsPlainText(
  lines: string[],
  entries: MeetingAgendaEntry[],
  indent = "   ",
): void {
  const groups = groupAgendaEntriesByDate(entries);
  groups.forEach((group, index) => {
    lines.push(`${indent}${group.dateLabel}`);
    for (let i = 0; i < group.entries.length; i++) {
      appendIndentedPlainTextBlock(
        lines,
        agendaEntryPlainText(group.entries[i].body),
        `${indent}  `,
      );
      if (i < group.entries.length - 1) lines.push("");
    }
    if (index < groups.length - 1) lines.push("");
  });
}