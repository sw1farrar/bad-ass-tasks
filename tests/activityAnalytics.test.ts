import { describe, expect, it } from "vitest";
import {
  buildActivityMix,
  buildDayBuckets,
  buildEngagementSeries,
  buildSignupSeries,
  createEmptyPlatformAnalytics,
  formatPlatformActivityHeadline,
  isExcludedPlatformActivity,
} from "@/lib/admin/activityAnalytics";

describe("activityAnalytics", () => {
  it("excludes workspace switches and admin actions", () => {
    expect(isExcludedPlatformActivity("workspace.switched")).toBe(true);
    expect(isExcludedPlatformActivity("admin.export.json")).toBe(true);
    expect(isExcludedPlatformActivity("task.created")).toBe(false);
  });

  it("builds engagement series by day", () => {
    const now = new Date("2026-06-07T12:00:00.000Z");
    const series = buildEngagementSeries(
      [
        { createdAt: "2026-06-07T10:00:00.000Z", userId: "u1" },
        { createdAt: "2026-06-07T11:00:00.000Z", userId: "u2" },
        { createdAt: "2026-06-07T12:00:00.000Z", userId: "u1" },
        { createdAt: "2026-06-06T09:00:00.000Z", userId: "u3" },
      ],
      3,
      now,
    );

    expect(series).toHaveLength(3);
    expect(series[2].events).toBe(3);
    expect(series[2].uniqueUsers).toBe(2);
    expect(series[1].events).toBe(1);
  });

  it("builds signup buckets", () => {
    const now = new Date("2026-06-07T12:00:00.000Z");
    const buckets = buildSignupSeries(
      [{ createdAt: "2026-06-07T08:00:00.000Z" }, { createdAt: "2026-06-07T09:00:00.000Z" }],
      2,
      now,
    );
    expect(buckets).toHaveLength(2);
    expect(buckets[1].count).toBe(2);
  });

  it("groups activity mix by category", () => {
    const mix = buildActivityMix([
      { actionType: "task.created" },
      { actionType: "task.completed" },
      { actionType: "note.created" },
      { actionType: "comment.added" },
      { actionType: "workspace.switched" },
    ]);

    const tasks = mix.find((slice) => slice.key === "tasks");
    const notes = mix.find((slice) => slice.key === "notes");
    expect(tasks?.count).toBe(2);
    expect(notes?.count).toBe(1);
    expect(mix.some((slice) => slice.key === "other" && slice.count > 0)).toBe(false);
  });

  it("formats readable activity headlines", () => {
    expect(
      formatPlatformActivityHeadline({
        id: "1",
        workspaceId: "w",
        workspaceName: "Acme",
        userId: "u1",
        userEmail: "a@example.com",
        userName: "Alex",
        actionType: "task.completed",
        targetType: "task",
        targetId: "t1",
        createdAt: "2026-06-07T10:00:00.000Z",
        metadata: {},
      }),
    ).toBe("Alex completed a task");
  });

  it("creates empty analytics fallback", () => {
    const empty = createEmptyPlatformAnalytics();
    expect(empty.activityByDay).toHaveLength(14);
    expect(empty.activityMix).toHaveLength(0);
    expect(empty.engagementRate7d).toBe(0);
  });

  it("creates stable day bucket labels", () => {
    const buckets = buildDayBuckets(2, new Date("2026-06-07T12:00:00.000Z"));
    expect(buckets).toHaveLength(2);
    expect(buckets[1].label).toBe("Today");
    expect(buckets[0].label).toBe("Yesterday");
  });
});