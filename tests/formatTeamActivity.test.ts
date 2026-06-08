import { describe, it, expect } from "vitest";
import { formatTeamActivityItem } from "@/features/teams/lib/formatTeamActivity";
import type { ActivityLog } from "@/types";

describe("formatTeamActivityItem", () => {
  const baseLog: ActivityLog = {
    id: "a1",
    workspaceId: "ws1",
    userId: "u1",
    actionType: "task.completed",
    targetType: "task",
    targetId: "t1",
    metadata: { title: "Ship feature" },
    createdAt: new Date(Date.now() - 3600000).toISOString(),
  };

  it("formats valid activity timestamps", () => {
    const item = formatTeamActivityItem(baseLog, []);
    expect(item?.timeLabel).toMatch(/ago$/);
  });

  it("does not throw when createdAt is missing or invalid", () => {
    expect(() =>
      formatTeamActivityItem({ ...baseLog, createdAt: "" }, []),
    ).not.toThrow();
    expect(() =>
      formatTeamActivityItem({ ...baseLog, createdAt: "not-a-date" }, []),
    ).not.toThrow();

    expect(formatTeamActivityItem({ ...baseLog, createdAt: "" }, [])?.timeLabel).toBe(
      "Recently",
    );
    expect(
      formatTeamActivityItem({ ...baseLog, createdAt: "not-a-date" }, [])?.timeLabel,
    ).toBe("Recently");
  });
});