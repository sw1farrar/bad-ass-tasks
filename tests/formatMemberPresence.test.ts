import { describe, expect, it } from "vitest";
import {
  buildActivityLastSeenMap,
  isStaleLastActiveEchoingJoin,
  latestTimestamp,
  resolveMemberLastActiveAt,
} from "@/features/teams/lib/formatMemberPresence";
import type { WorkspaceMember } from "@/types";

describe("resolveMemberLastActiveAt", () => {
  const member: WorkspaceMember = {
    userId: "rachel",
    role: "member",
    joinedAt: "2026-05-01T12:00:00.000Z",
    lastActiveAt: "2026-05-01T12:05:00.000Z",
    fullName: "Rachel Farrar",
  } as WorkspaceMember;

  it("prefers activity log over stale join-echo last_active_at", () => {
    const activity = buildActivityLastSeenMap([
      {
        id: "1",
        workspaceId: "w",
        userId: "rachel",
        actionType: "task.completed",
        targetType: "task",
        metadata: {},
        createdAt: "2026-07-20T15:00:00.000Z",
      },
    ]);
    expect(resolveMemberLastActiveAt(member, activity)).toBe(
      "2026-07-20T15:00:00.000Z",
    );
  });

  it("hides join-echo last_active when no fresher signal", () => {
    expect(resolveMemberLastActiveAt(member)).toBeUndefined();
    expect(isStaleLastActiveEchoingJoin(member.lastActiveAt, member.joinedAt)).toBe(
      true,
    );
  });

  it("latestTimestamp picks the max", () => {
    expect(
      latestTimestamp(
        "2026-01-01T00:00:00.000Z",
        "2026-06-01T00:00:00.000Z",
        "2026-03-01T00:00:00.000Z",
      ),
    ).toBe("2026-06-01T00:00:00.000Z");
  });
});
