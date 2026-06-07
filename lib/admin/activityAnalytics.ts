import type { PlatformActivityRow, PlatformAnalytics } from "@/lib/admin/platformData";

export const EXCLUDED_ACTIVITY_ACTION_TYPES = ["workspace.switched"] as const;

export type ActivityMixKey = "tasks" | "notes" | "comments" | "collaboration" | "other";

export type DailyEngagementPoint = {
  date: string;
  label: string;
  events: number;
  uniqueUsers: number;
};

export type DailyCountPoint = {
  date: string;
  label: string;
  count: number;
};

export type ActivityMixSlice = {
  key: ActivityMixKey;
  label: string;
  count: number;
  color: string;
};

export const ACTIVITY_MIX_COLORS: Record<ActivityMixKey, string> = {
  tasks: "#c084fc",
  notes: "#60a5fa",
  comments: "#fbbf24",
  collaboration: "#34d399",
  other: "#71717a",
};

export function isExcludedPlatformActivity(actionType: string): boolean {
  return actionType === "workspace.switched" || actionType.startsWith("admin.");
}

export function categorizeActivityAction(actionType: string): ActivityMixKey {
  if (actionType.startsWith("task.")) return "tasks";
  if (actionType.startsWith("note.")) return "notes";
  if (actionType === "comment.added") return "comments";
  if (
    actionType.startsWith("invite.") ||
    actionType.startsWith("member.")
  ) {
    return "collaboration";
  }
  return "other";
}

export function buildDayBuckets(days: number, now = new Date()): DailyCountPoint[] {
  const buckets: DailyCountPoint[] = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - offset);
    const date = d.toISOString().slice(0, 10);
    let label: string;
    if (offset === 0) label = "Today";
    else if (offset === 1) label = "Yesterday";
    else {
      label = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
    }
    buckets.push({ date, label, count: 0 });
  }
  return buckets;
}

export function buildEngagementSeries(
  logs: Array<{ createdAt: string; userId: string | null }>,
  days = 14,
  now = new Date(),
): DailyEngagementPoint[] {
  const buckets = buildDayBuckets(days, now);
  const usersByDay = new Map<string, Set<string>>();

  for (const log of logs) {
    const date = log.createdAt.slice(0, 10);
    const bucket = buckets.find((b) => b.date === date);
    if (!bucket) continue;
    bucket.count += 1;
    if (log.userId) {
      if (!usersByDay.has(date)) usersByDay.set(date, new Set());
      usersByDay.get(date)!.add(log.userId);
    }
  }

  return buckets.map((bucket) => ({
    date: bucket.date,
    label: bucket.label,
    events: bucket.count,
    uniqueUsers: usersByDay.get(bucket.date)?.size ?? 0,
  }));
}

export function buildSignupSeries(
  signups: Array<{ createdAt: string | null }>,
  days = 14,
  now = new Date(),
): DailyCountPoint[] {
  const buckets = buildDayBuckets(days, now);
  for (const signup of signups) {
    if (!signup.createdAt) continue;
    const date = signup.createdAt.slice(0, 10);
    const bucket = buckets.find((b) => b.date === date);
    if (bucket) bucket.count += 1;
  }
  return buckets;
}

export function buildActivityMix(
  logs: Array<{ actionType: string }>,
): ActivityMixSlice[] {
  const counts: Record<ActivityMixKey, number> = {
    tasks: 0,
    notes: 0,
    comments: 0,
    collaboration: 0,
    other: 0,
  };

  for (const log of logs) {
    if (isExcludedPlatformActivity(log.actionType)) continue;
    counts[categorizeActivityAction(log.actionType)] += 1;
  }

  const labels: Record<ActivityMixKey, string> = {
    tasks: "Tasks",
    notes: "Notes",
    comments: "Comments",
    collaboration: "Team",
    other: "Other",
  };

  return (Object.keys(counts) as ActivityMixKey[])
    .map((key) => ({
      key,
      label: labels[key],
      count: counts[key],
      color: ACTIVITY_MIX_COLORS[key],
    }))
    .filter((slice) => slice.count > 0)
    .sort((a, b) => b.count - a.count);
}

export function metaTitle(metadata: Record<string, unknown>): string | undefined {
  const title = metadata.title;
  return typeof title === "string" && title.trim() ? title.trim() : undefined;
}

export function formatPlatformActivityHeadline(item: PlatformActivityRow): string {
  const who = item.userName || item.userEmail || "Someone";
  switch (item.actionType) {
    case "task.created":
      return `${who} created a task`;
    case "task.completed":
      return `${who} completed a task`;
    case "task.updated":
      return `${who} updated a task`;
    case "note.created":
      return `${who} created a note`;
    case "note.updated":
      return `${who} updated a note`;
    case "comment.added":
      return `${who} left a comment`;
    case "invite.sent":
      return `${who} sent an invite`;
    case "member.joined":
      return `${who} joined a workspace`;
    case "member.removed":
      return `${who} removed a member`;
    default:
      if (item.actionType.includes("task")) return `${who} — task activity`;
      if (item.actionType.includes("note")) return `${who} — note activity`;
      return `${who} — ${item.actionType.replace(/\./g, " ")}`;
  }
}

export function formatPlatformActivityDetail(item: PlatformActivityRow): string | undefined {
  const subject = metaTitle(item.metadata);
  if (subject) return subject;
  if (item.actionType === "comment.added") {
    const preview = item.metadata.preview;
    return typeof preview === "string" && preview.trim() ? preview.trim() : undefined;
  }
  return undefined;
}

export function activityIconColor(actionType: string): string {
  const key = categorizeActivityAction(actionType);
  return ACTIVITY_MIX_COLORS[key];
}

/** Safe fallback when analytics cannot be loaded — keeps charts rendering. */
export function createEmptyPlatformAnalytics(): PlatformAnalytics {
  const activityByDay = buildDayBuckets(14).map((bucket) => ({
    ...bucket,
    events: 0,
    uniqueUsers: 0,
  }));

  return {
    activityByDay,
    signupsByDay: buildDayBuckets(14),
    activityMix: [],
    engagementRate7d: 0,
    contentEvents7d: 0,
    avgDailyActiveUsers7d: 0,
    peakDay: null,
    generatedAt: new Date().toISOString(),
  };
}