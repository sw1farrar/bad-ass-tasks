function startOfLocalDay(date = new Date()): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function storageKey(userId: string): string {
  const day = startOfLocalDay().toISOString().slice(0, 10);
  return `bat_dismissed_reminders_${userId}_${day}`;
}

/** Same key format used by processDeadlineReminders when delivering deadline notifications. */
export function reminderKeyForTask(taskId: string): string {
  const day = startOfLocalDay().toISOString().slice(0, 10);
  return `deadline:${taskId}:${day}`;
}

function readDismissed(userId: string): Set<string> {
  if (typeof window === "undefined" || !userId) return new Set();
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((k) => typeof k === "string"));
  } catch {
    return new Set();
  }
}

function writeDismissed(userId: string, keys: Set<string>): void {
  if (typeof window === "undefined" || !userId) return;
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify([...keys]));
  } catch {
    /* ignore quota / private mode */
  }
}

export function isReminderDismissed(userId: string, reminderKey: string): boolean {
  if (!userId || !reminderKey) return false;
  return readDismissed(userId).has(reminderKey);
}

export function dismissReminder(userId: string, reminderKey: string): void {
  if (!userId || !reminderKey) return;
  const keys = readDismissed(userId);
  keys.add(reminderKey);
  writeDismissed(userId, keys);
}

export function dismissReminders(userId: string, reminderKeys: string[]): void {
  if (!userId || reminderKeys.length === 0) return;
  const keys = readDismissed(userId);
  for (const key of reminderKeys) {
    if (key) keys.add(key);
  }
  writeDismissed(userId, keys);
}