import { format, parseISO } from "date-fns";

export function formatAgendaEntryTimestamp(createdAt: string): string {
  return format(parseISO(createdAt), "MMM d, h:mm a");
}