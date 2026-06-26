import { format } from "date-fns";
import type { Meeting, MeetingAgendaEntry, MeetingAgendaItem, WorkspaceMember } from "@/types";
import {
  appendAgendaEntryGroupsPlainText,
  buildAgendaEntryGroupsClipboardHtml,
} from "@/lib/meetings/agendaEntryGroups";
import {
  appendIndentedPlainTextBlock,
  formatClipboardHtmlText,
} from "@/lib/meetings/agendaEntryLabels";
import { getAgendaItemOwnerLabel } from "@/lib/meetings/agendaOwners";
import { sortAgendaItems } from "@/lib/meetings/meetingFilters";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type MeetingAgendaDocumentInput = {
  meeting: Meeting;
  items: MeetingAgendaItem[];
  entries?: MeetingAgendaEntry[];
  members: WorkspaceMember[];
  currentUserId?: string;
  includeComments?: boolean;
};

function topicMetaParts(
  item: MeetingAgendaItem,
  members: WorkspaceMember[],
  currentUserId?: string,
): string[] {
  const parts: string[] = [];
  const owner = getAgendaItemOwnerLabel(item, members, currentUserId);
  if (owner) parts.push(owner);
  return parts;
}

/** Inline-styled HTML for email / Word paste (clipboard). */
export function buildMeetingAgendaClipboardHtml(input: MeetingAgendaDocumentInput): string {
  const { meeting, items, entries = [], members, currentUserId, includeComments = false } = input;
  const sorted = sortAgendaItems(items);

  let html = `<div style="font-family: Calibri, 'Segoe UI', Arial, sans-serif; font-size: 11pt; color: #000000; line-height: 1.35;">`;
  html += `<p style="margin: 0 0 2px; font-size: 14pt; font-weight: 700; color: #000000;">${escapeHtml(meeting.title)}</p>`;
  if (meeting.scheduledAt) {
    html += `<p style="margin: 0 0 10px; font-size: 10pt; color: #000000;">${escapeHtml(format(new Date(meeting.scheduledAt), "EEEE, MMMM d, yyyy"))}</p>`;
  }
  html += `<p style="margin: 0 0 8px; font-size: 9pt; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: #000000;">Agenda</p>`;

  if (sorted.length === 0) {
    html += `<p style="margin: 0; font-size: 10pt; color: #000000;">No topics on the agenda yet.</p>`;
  } else {
    html += `<ol style="margin: 0; padding-left: 22px;">`;
    for (const item of sorted) {
      const meta = topicMetaParts(item, members, currentUserId);
      const itemEntries = includeComments
        ? entries.filter((e) => e.agendaItemId === item.id)
        : [];

      html += `<li style="margin: 0 0 6px; padding: 0;">`;
      html += `<span style="font-weight: 700; color: #000000;">${escapeHtml(item.title)}</span>`;
      if (meta.length) {
        html += `<span style="color: #000000;"> — ${escapeHtml(meta.join(" · "))}</span>`;
      }
      if (item.description?.trim()) {
        html += `<br><span style="display: block; margin-top: 2px; font-size: 10pt; color: #000000;">${formatClipboardHtmlText(item.description.trim(), escapeHtml)}</span>`;
      }
      if (itemEntries.length > 0) {
        html += buildAgendaEntryGroupsClipboardHtml(itemEntries, escapeHtml);
      }
      html += `</li>`;
    }
    html += `</ol>`;
  }

  html += `</div>`;
  return html;
}

export function buildMeetingAgendaPlainText(input: MeetingAgendaDocumentInput): string {
  const { meeting, items, entries = [], members, currentUserId, includeComments = false } = input;
  const sorted = sortAgendaItems(items);
  const lines: string[] = [meeting.title, ""];

  if (meeting.scheduledAt) {
    lines.push(format(new Date(meeting.scheduledAt), "EEEE, MMMM d, yyyy"), "");
  }

  lines.push("AGENDA", "");

  if (sorted.length === 0) {
    lines.push("No topics on the agenda yet.");
  } else {
    sorted.forEach((item, index) => {
      const meta = topicMetaParts(item, members, currentUserId);
      const suffix = meta.length ? ` — ${meta.join(" · ")}` : "";
      const itemEntries = includeComments
        ? entries.filter((e) => e.agendaItemId === item.id)
        : [];

      lines.push(`${index + 1}. ${item.title}${suffix}`);
      if (item.description?.trim()) {
        appendIndentedPlainTextBlock(lines, item.description.trim(), "   ");
      }
      if (itemEntries.length > 0) {
        appendAgendaEntryGroupsPlainText(lines, itemEntries);
      }
    });
  }

  return lines.join("\n").trim();
}

function wrapClipboardHtml(fragment: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body><!--StartFragment-->${fragment}<!--EndFragment--></body></html>`;
}

export async function copyMeetingAgendaToClipboard(
  fragmentHtml: string,
  plainText: string,
): Promise<void> {
  const wrapped = wrapClipboardHtml(fragmentHtml);

  if (typeof navigator !== "undefined" && navigator.clipboard?.write) {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": new Blob([wrapped], { type: "text/html" }),
          "text/plain": new Blob([plainText], { type: "text/plain" }),
        }),
      ]);
      return;
    } catch {
      // Fall through to plain text.
    }
  }

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(plainText);
    return;
  }

  throw new Error("Clipboard unavailable");
}