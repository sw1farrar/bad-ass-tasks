import { format } from "date-fns";
import type { Meeting, MeetingAgendaEntry, MeetingAgendaItem, WorkspaceMember } from "@/types";
import {
  appendAgendaEntryGroupsPlainText,
  buildAgendaEntryGroupsClipboardHtml,
} from "@/lib/meetings/agendaEntryGroups";
import {
  agendaEntryHasDecisionTag,
  stripAgendaDecisionTag,
} from "@/lib/meetings/agendaEntryBody";
import { getAgendaItemOwnerLabel } from "@/lib/meetings/agendaOwners";
import { sortAgendaItems } from "@/lib/meetings/meetingFilters";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type MeetingSummaryDocumentInput = {
  meeting: Meeting;
  items: MeetingAgendaItem[];
  entries: MeetingAgendaEntry[];
  members: WorkspaceMember[];
  currentUserId?: string;
};

function appendSummaryTopicClipboardHtml(
  html: string[],
  item: MeetingAgendaItem,
  entries: MeetingAgendaEntry[],
  members: WorkspaceMember[],
  currentUserId?: string,
): void {
  const itemEntries = entries.filter((e) => e.agendaItemId === item.id);
  const owner = getAgendaItemOwnerLabel(item, members, currentUserId);

  html.push(`<div style="margin: 0 0 8px; padding: 8px 10px; border: 1px solid #cccccc;">`);
  html.push(`<p style="margin: 0 0 2px; font-size: 11pt; font-weight: 700; color: #000000;">${escapeHtml(item.title)}</p>`);
  if (owner) {
    html.push(`<p style="margin: 0 0 4px; font-size: 9pt; color: #000000;">${escapeHtml(owner)}</p>`);
  }
  if (item.description?.trim()) {
    html.push(`<p style="margin: 0 0 4px; font-size: 10pt; color: #000000;">${escapeHtml(item.description.trim())}</p>`);
  }
  if (itemEntries.length) {
    html.push(buildAgendaEntryGroupsClipboardHtml(itemEntries, escapeHtml));
  } else {
    html.push(`<p style="margin: 4px 0 0; font-size: 9pt; font-style: italic; color: #000000;">No notes recorded.</p>`);
  }
  html.push(`</div>`);
}

function appendSummaryTopicPlainText(
  lines: string[],
  item: MeetingAgendaItem,
  entries: MeetingAgendaEntry[],
  members: WorkspaceMember[],
  currentUserId?: string,
): void {
  const owner = getAgendaItemOwnerLabel(item, members, currentUserId);
  lines.push(owner ? `${item.title} (${owner})` : item.title);
  if (item.description?.trim()) lines.push(item.description.trim());
  const itemEntries = entries.filter((e) => e.agendaItemId === item.id);
  if (itemEntries.length > 0) {
    appendAgendaEntryGroupsPlainText(lines, itemEntries, "  ");
  } else {
    lines.push("  No notes recorded.");
  }
  lines.push("");
}

/** Inline-styled HTML for email / Word paste (clipboard). */
export function buildMeetingSummaryClipboardHtml(input: MeetingSummaryDocumentInput): string {
  const { meeting, items, entries, members, currentUserId } = input;
  const sorted = sortAgendaItems(items);
  const decisions = entries.filter((e) => e.isDecision || agendaEntryHasDecisionTag(e.body));
  const discussionItems = sorted.filter((i) => i.status !== "continued");
  const followUps = sorted.filter((i) => i.status === "continued");

  let html = `<div style="font-family: Calibri, 'Segoe UI', Arial, sans-serif; font-size: 11pt; color: #000000; line-height: 1.35;">`;
  html += `<p style="margin: 0 0 4px; font-size: 9pt; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: #000000;">Meeting summary</p>`;
  html += `<p style="margin: 0 0 4px; font-size: 14pt; font-weight: 700; color: #000000;">${escapeHtml(meeting.title)}</p>`;
  if (meeting.description?.trim()) {
    html += `<p style="margin: 0 0 8px; font-size: 10pt; color: #000000;">${escapeHtml(meeting.description.trim())}</p>`;
  }

  const facts: string[] = [];
  if (meeting.scheduledAt) {
    facts.push(
      `<span><strong>When:</strong> ${escapeHtml(format(new Date(meeting.scheduledAt), "EEEE, MMMM d, yyyy"))}</span>`,
    );
  }
  if (discussionItems.length > 0 || followUps.length > 0) {
    facts.push(`<span><strong>Topics:</strong> ${discussionItems.length + followUps.length}</span>`);
  }
  if (decisions.length > 0) {
    facts.push(`<span><strong>Decisions:</strong> ${decisions.length}</span>`);
  }
  if (facts.length) {
    html += `<p style="margin: 0 0 12px; font-size: 10pt; color: #000000;">${facts.join(" &nbsp;·&nbsp; ")}</p>`;
  }

  if (decisions.length) {
    html += `<p style="margin: 0 0 6px; font-size: 9pt; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: #000000;">Decisions</p>`;
    html += `<ul style="margin: 0 0 12px; padding-left: 22px;">`;
    for (const d of decisions) {
      html += `<li style="margin: 0 0 4px;">${escapeHtml(stripAgendaDecisionTag(d.body))}</li>`;
    }
    html += `</ul>`;
  }

  const topicBlocks: string[] = [];

  if (discussionItems.length) {
    html += `<p style="margin: 0 0 6px; font-size: 9pt; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: #000000;">Discussion</p>`;
    for (const item of discussionItems) {
      appendSummaryTopicClipboardHtml(topicBlocks, item, entries, members, currentUserId);
    }
    html += topicBlocks.join("");
    topicBlocks.length = 0;
  }

  if (followUps.length) {
    html += `<p style="margin: 12px 0 6px; font-size: 9pt; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: #000000;">Follow-ups for next time</p>`;
    for (const item of followUps) {
      appendSummaryTopicClipboardHtml(topicBlocks, item, entries, members, currentUserId);
    }
    html += topicBlocks.join("");
  }

  html += `</div>`;
  return html;
}

export function buildMeetingSummaryPlainText(input: MeetingSummaryDocumentInput): string {
  const { meeting, items, entries, members, currentUserId } = input;
  const sorted = sortAgendaItems(items);
  const decisions = entries.filter((e) => e.isDecision || agendaEntryHasDecisionTag(e.body));
  const discussionItems = sorted.filter((i) => i.status !== "continued");
  const followUps = sorted.filter((i) => i.status === "continued");

  const lines: string[] = [meeting.title, "", "MEETING SUMMARY", ""];

  if (meeting.description?.trim()) {
    lines.push(meeting.description.trim(), "");
  }

  if (meeting.scheduledAt) {
    lines.push(`When: ${format(new Date(meeting.scheduledAt), "EEEE, MMMM d, yyyy")}`);
  }
  lines.push("");

  if (decisions.length) {
    lines.push("DECISIONS", "");
    for (const d of decisions) {
      lines.push(`• ${stripAgendaDecisionTag(d.body)}`);
    }
    lines.push("");
  }

  if (discussionItems.length) {
    lines.push("DISCUSSION", "");
    for (const item of discussionItems) {
      appendSummaryTopicPlainText(lines, item, entries, members, currentUserId);
    }
  }

  if (followUps.length) {
    lines.push("FOLLOW-UPS FOR NEXT TIME", "");
    for (const item of followUps) {
      appendSummaryTopicPlainText(lines, item, entries, members, currentUserId);
    }
  }

  return lines.join("\n").trim();
}

function wrapClipboardHtml(fragment: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body><!--StartFragment-->${fragment}<!--EndFragment--></body></html>`;
}

export async function copyMeetingSummaryToClipboard(
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