import { describe, it, expect } from "vitest";
import {
  getMemberDisplayName,
  getMemberMentionHandle,
  getSearchResultDisplayName,
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

  it("falls back to email local part in search results", () => {
    expect(getSearchResultDisplayName({ email: "riley@example.com" })).toBe("riley");
    expect(getSearchResultDisplayName({ fullName: "Riley Park", email: "r@x.com" })).toBe("Riley Park");
  });

  it("matches mention queries by full name", () => {
    const m = member({ fullName: "Jordan Lee", username: "jlee" });
    expect(memberMatchesMentionQuery(m, "jord")).toBe(true);
    expect(memberMatchesMentionQuery(m, "jlee")).toBe(true);
    expect(memberMatchesMentionQuery(m, "sam")).toBe(false);
  });
});