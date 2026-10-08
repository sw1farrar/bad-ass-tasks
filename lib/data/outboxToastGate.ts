/** Same stuck count must not toast again while the phone keeps waking. */
const PENDING_REPEAT_MS = 60_000;

let lastPendingCount = -1;
let lastPendingAt = 0;

/**
 * Manual refresh may say a backlog is stuck. Background retries must not.
 * Repeating the same count inside the window is what made the toast flash.
 */
export function claimPendingToast(count: number, now = Date.now()): boolean {
  if (count <= 0) {
    lastPendingCount = -1;
    lastPendingAt = 0;
    return false;
  }
  if (lastPendingCount === count && now - lastPendingAt < PENDING_REPEAT_MS) {
    return false;
  }
  lastPendingCount = count;
  lastPendingAt = now;
  return true;
}

export function resetOutboxToastGate(): void {
  lastPendingCount = -1;
  lastPendingAt = 0;
}
