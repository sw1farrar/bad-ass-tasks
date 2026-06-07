import type { BrevoInboundEmailItem } from "./inboundTypes";
import { extractInboundPlainBody } from "./inboundNoteContent";
import { buildInboundTaskDescription, parseInboundTaskDueDate } from "./parseInboundTaskDueDate";

export function buildInboundTaskTitle(item: BrevoInboundEmailItem): string {
  const subject = item.Subject?.trim();
  if (subject) return subject.slice(0, 500);
  return "Untitled task";
}

export function buildInboundTaskFields(
  item: BrevoInboundEmailItem,
  reference = new Date(),
): {
  title: string;
  description: string;
  dueDate?: string;
} {
  const body = extractInboundPlainBody(item);
  const parsedDue = parseInboundTaskDueDate(body, reference);
  const sender = item.From?.Address?.trim();

  return {
    title: buildInboundTaskTitle(item),
    description: buildInboundTaskDescription(body, sender || undefined),
    dueDate: parsedDue?.dueDate,
  };
}