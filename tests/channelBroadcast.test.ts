import { describe, expect, it, vi } from "vitest";
import {
  flushPendingBroadcasts,
  sendChannelBroadcast,
} from "@/lib/realtime/channelBroadcast";

function makeChannel({
  connected = true,
  state = "joined",
}: {
  connected?: boolean;
  state?: string;
} = {}) {
  return {
    state,
    socket: { isConnected: () => connected },
    send: vi.fn().mockResolvedValue("ok"),
    httpSend: vi.fn().mockResolvedValue({ success: true }),
  };
}

describe("sendChannelBroadcast", () => {
  it("uses WebSocket send when the channel is joined and connected", () => {
    const channel = makeChannel();
    sendChannelBroadcast(channel, "live-task-edit", { taskId: "t1" });

    expect(channel.send).toHaveBeenCalledWith({
      type: "broadcast",
      event: "live-task-edit",
      payload: { taskId: "t1" },
    });
    expect(channel.httpSend).not.toHaveBeenCalled();
  });

  it("uses httpSend when the socket is disconnected", () => {
    const channel = makeChannel({ connected: false });
    sendChannelBroadcast(channel, "cursor-update", { userId: "u1" });

    expect(channel.httpSend).toHaveBeenCalledWith("cursor-update", { userId: "u1" });
    expect(channel.send).not.toHaveBeenCalled();
  });

  it("uses httpSend when the channel is closed", () => {
    const channel = makeChannel({ state: "closed" });
    sendChannelBroadcast(channel, "cursor-clear", { userId: "u1" });

    expect(channel.httpSend).toHaveBeenCalledWith("cursor-clear", { userId: "u1" });
    expect(channel.send).not.toHaveBeenCalled();
  });

  it("no-ops for a missing channel", () => {
    expect(() => sendChannelBroadcast(null, "live-note-content", {})).not.toThrow();
  });

  it("queues broadcasts while joining and flushes over WebSocket when ready", () => {
    vi.useFakeTimers();
    const channel = makeChannel({ state: "joining" });
    sendChannelBroadcast(channel, "live-task-edit", { taskId: "t1" });

    expect(channel.send).not.toHaveBeenCalled();
    expect(channel.httpSend).not.toHaveBeenCalled();

    channel.state = "joined";
    flushPendingBroadcasts(channel);

    expect(channel.send).toHaveBeenCalledWith({
      type: "broadcast",
      event: "live-task-edit",
      payload: { taskId: "t1" },
    });
    vi.useRealTimers();
  });
});