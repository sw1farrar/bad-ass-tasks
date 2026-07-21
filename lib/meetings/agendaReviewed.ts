import type { MeetingAgendaItem } from "@/types";

/** Whether a topic has been marked reviewed for this meeting (survives complete/reopen). */
export function isAgendaItemReviewed(
  item: Pick<MeetingAgendaItem, "reviewed" | "status">,
): boolean {
  return item.reviewed === true || item.status === "continued";
}
