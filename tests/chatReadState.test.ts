import { describe, it, expect, beforeEach } from "vitest";
import {
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
    expect(hasUnreadChatActivity("me", "ws-1", [{ userId: "me", createdAt: "2026-06-05T13:00:00.000Z" }], [])).toBe(false);
  });
});