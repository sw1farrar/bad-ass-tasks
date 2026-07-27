import { describe, expect, it } from "vitest";
import {
  buildMemberOnlineUserIds,
  onlineUsersSignature,
} from "@/features/teams/lib/memberOnlineIds";

describe("buildMemberOnlineUserIds", () => {
  const members = [{ userId: "me" }, { userId: "rachel" }];

  it("intersects presence with workspace members only", () => {
    const online = buildMemberOnlineUserIds(
      [{ userId: "me" }, { userId: "ghost" }, { userId: "rachel" }],
      members,
      "me",
    );
    expect([...online].sort()).toEqual(["me", "rachel"]);
  });

  it("always treats the signed-in member as online", () => {
    const online = buildMemberOnlineUserIds([], members, "me");
    expect(online.has("me")).toBe(true);
    expect(online.has("rachel")).toBe(false);
    expect(online.size).toBe(1);
  });

  it("ignores current user if they are not a member", () => {
    const online = buildMemberOnlineUserIds([], members, "outsider");
    expect(online.size).toBe(0);
  });
});

describe("onlineUsersSignature", () => {
  it("is stable regardless of order", () => {
    const a = onlineUsersSignature([
      { userId: "b", view: "tasks" },
      { userId: "a", view: "home" },
    ]);
    const b = onlineUsersSignature([
      { userId: "a", view: "home" },
      { userId: "b", view: "tasks" },
    ]);
    expect(a).toBe(b);
  });
});
