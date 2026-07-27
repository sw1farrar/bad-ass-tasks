import { describe, it, expect, beforeEach } from "vitest";
import {
  computeChatReadWatermark,
  getChatLastReadAt,
  setChatLastReadAt,
  hasUnreadChatActivity,
} from "@/lib/chatReadState";

describe("chatReadState", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("persists and reads last-read timestamp per user/workspace", () => {
    setChatLastReadAt("user-1", "ws-1", "2026-06-05T12:00:00.000Z");
    expect(getChatLastReadAt("user-1", "ws-1")).toBe("2026-06-05T12:00:00.000Z");
    expect(getChatLastReadAt("user-1", "ws-2")).toBeNull();
  });

  it("detects unread messages and reactions from others", () => {
    const messages = [
      { userId: "other", createdAt: "2026-06-05T13:00:00.000Z" },
    ];
    const reactions = [
      { userId: "other", createdAt: "2026-06-05T14:00:00.000Z" },
    ];
    setChatLastReadAt("me", "ws-1", "2026-06-05T12:00:00.000Z");

    expect(hasUnreadChatActivity("me", "ws-1", messages, [])).toBe(true);
    expect(hasUnreadChatActivity("me", "ws-1", [], reactions)).toBe(true);
    expect(
      hasUnreadChatActivity(
        "me",
        "ws-1",
        [{ userId: "me", createdAt: "2026-06-05T13:00:00.000Z" }],
        [],
      ),
    ).toBe(false);
  });

  it("watermark covers all loaded activity so viewed messages stay read", () => {
    const messages = [
      { createdAt: "2026-06-06T10:00:00.000Z" },
      { createdAt: "2026-06-06T10:00:01.000Z" },
    ];
    const reactions = [{ createdAt: "2026-06-06T10:00:02.000Z" }];
    const watermark = computeChatReadWatermark(messages, reactions);
    expect(watermark).toBeTruthy();
    setChatLastReadAt("me", "ws-1", watermark!);

    expect(
      hasUnreadChatActivity(
        "me",
        "ws-1",
        [{ userId: "other", createdAt: "2026-06-06T10:00:02.000Z" }],
        [{ userId: "other", createdAt: "2026-06-06T10:00:02.000Z" }],
      ),
    ).toBe(false);
  });

  it("does not invent a watermark for empty activity", () => {
    expect(computeChatReadWatermark([], [])).toBeNull();
  });

  it("tracks channel watermarks separately from general", () => {
    setChatLastReadAt("me", "ws-1", "2026-06-05T12:00:00.000Z", { kind: "general" });
    setChatLastReadAt("me", "ws-1", "2026-06-05T15:00:00.000Z", {
      kind: "channel",
      conversationId: "11111111-1111-1111-1111-111111111111",
    });
    expect(getChatLastReadAt("me", "ws-1", { kind: "general" })).toBe(
      "2026-06-05T12:00:00.000Z",
    );
    expect(
      getChatLastReadAt("me", "ws-1", {
        kind: "channel",
        conversationId: "11111111-1111-1111-1111-111111111111",
      }),
    ).toBe("2026-06-05T15:00:00.000Z");
  });
});
