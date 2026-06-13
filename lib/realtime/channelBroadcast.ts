export type RealtimeBroadcastChannel = {
  state: string;
  socket: { isConnected(): boolean };
  send(args: {
    type: "broadcast";
    event: string;
    payload?: unknown;
  }): Promise<unknown>;
  httpSend(
    event: string,
    payload: unknown,
  ): Promise<{ success: boolean } | { success: false; status: number; error: string }>;
};

const JOINED_STATE = "joined";
const JOIN_RETRY_MS = 120;

type PendingBroadcast = { event: string; payload: Record<string, unknown> };

const pendingByChannel = new WeakMap<object, PendingBroadcast[]>();
const retryTimers = new WeakMap<object, ReturnType<typeof setTimeout>>();

function canPushBroadcast(channel: RealtimeBroadcastChannel): boolean {
  return channel.socket.isConnected() && channel.state === JOINED_STATE;
}

function deliverBroadcast(
  channel: RealtimeBroadcastChannel,
  event: string,
  payload: Record<string, unknown>,
): void {
  if (canPushBroadcast(channel)) {
    channel
      .send({
        type: "broadcast",
        event,
        payload,
      })
      .catch(() => {});
    return;
  }

  channel.httpSend(event, payload).catch(() => {});
}

function scheduleJoinRetry(channel: RealtimeBroadcastChannel): void {
  if (retryTimers.has(channel)) return;

  const timer = setTimeout(() => {
    retryTimers.delete(channel);
    flushPendingBroadcasts(channel);
  }, JOIN_RETRY_MS);
  retryTimers.set(channel, timer);
}

/** Flush any broadcasts queued while the channel was still joining. */
export function flushPendingBroadcasts(channel: RealtimeBroadcastChannel | null | undefined): void {
  if (!channel) return;

  const timer = retryTimers.get(channel);
  if (timer) {
    clearTimeout(timer);
    retryTimers.delete(channel);
  }

  const queue = pendingByChannel.get(channel);
  if (!queue?.length) return;

  pendingByChannel.set(channel, []);
  for (const item of queue) {
    deliverBroadcast(channel, item.event, item.payload);
  }
}

/** Call when the presence channel reaches SUBSCRIBED/joined. */
export function markBroadcastChannelReady(channel: RealtimeBroadcastChannel | null | undefined): void {
  flushPendingBroadcasts(channel);
}

/** Deliver a broadcast via WebSocket when joined, otherwise explicit REST (httpSend). */
export function sendChannelBroadcast(
  channel: RealtimeBroadcastChannel | null | undefined,
  event: string,
  payload: Record<string, unknown>,
): void {
  if (!channel) return;

  if (canPushBroadcast(channel)) {
    flushPendingBroadcasts(channel);
    deliverBroadcast(channel, event, payload);
    return;
  }

  // Brief join window: prefer WebSocket over REST for sub-second delivery.
  if (channel.state === "joining") {
    const queue = pendingByChannel.get(channel) ?? [];
    queue.push({ event, payload });
    pendingByChannel.set(channel, queue);
    scheduleJoinRetry(channel);
    return;
  }

  deliverBroadcast(channel, event, payload);
}