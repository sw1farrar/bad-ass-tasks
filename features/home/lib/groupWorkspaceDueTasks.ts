import {
  isDueDatePast,
  isDueDateToday,
  startOfLocalToday,
} from "@/lib/datetime";
import { isDueDateTomorrow } from "./buildUpcomingFocus";
import type { HomeFocusItem } from "./buildAttentionItems";

export type WorkspaceDueTaskGroups = {
  late: HomeFocusItem[];
  today: HomeFocusItem[];
  tomorrow: HomeFocusItem[];
  upcoming: HomeFocusItem[];
  undated: HomeFocusItem[];
};

export function groupWorkspaceDueTasks(
  items: HomeFocusItem[],
  reference = startOfLocalToday(),
): WorkspaceDueTaskGroups {
  const late: HomeFocusItem[] = [];
  const today: HomeFocusItem[] = [];
  const tomorrow: HomeFocusItem[] = [];
  const upcoming: HomeFocusItem[] = [];
  const undated: HomeFocusItem[] = [];

  for (const item of items) {
    const dueDate = item.task.dueDate;
    if (!dueDate) {
      undated.push(item);
      continue;
    }
    if (isDueDatePast(dueDate, reference)) late.push(item);
    else if (isDueDateToday(dueDate, reference)) today.push(item);
    else if (isDueDateTomorrow(dueDate, reference)) tomorrow.push(item);
    else upcoming.push(item);
  }

  return { late, today, tomorrow, upcoming, undated };
}

export function countDueTasks(groups: WorkspaceDueTaskGroups): number {
  return (
    groups.late.length +
    groups.today.length +
    groups.tomorrow.length +
    groups.upcoming.length +
    groups.undated.length
  );
}