import { describe, it, expect } from "vitest";
import {
  getMemberDisplayName,
  getMemberMentionHandle,
  memberMatchesMentionQuery,
} from "@/lib/assignee";
import type { WorkspaceMember } from "@/types";

const member = (overrides: Partial<WorkspaceMember>): WorkspaceMember => ({
  workspaceId: "ws1",
  userId: "u1",
  role: "member",
  joinedAt: "2026-01-01",
  ...overrides,
});

describe("assignee mention helpers", () => {
  it("shows display names instead of usernames in labels", () => {
    const m = member({ fullName: "Alex Rivera", username: "arivera" });
    expect(getMemberDisplayName(m)).toBe("Alex Rivera");
    expect(getMemberMentionHandle(m)).toBe("arivera");
  });

  it("matches mention queries by full name", () => {
    const m = member({ fullName: "Jordan Lee", username: "jlee" });
    expect(memberMatchesMentionQuery(m, "jord")).toBe(true);
    expect(memberMatchesMentionQuery(m, "jlee")).toBe(true);
    expect(memberMatchesMentionQuery(m, "sam")).toBe(false);
  });
});