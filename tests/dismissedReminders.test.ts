import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  dismissReminder,
  dismissReminders,
  isReminderDismissed,
  reminderKeyForTask,
} from "@/lib/notifications/dismissedReminders";

describe("dismissedReminders", () => {
  const userId = "user-123";
  const taskId = "task-abc";

  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("tracks dismissed reminder keys per user for the current day", () => {
    const key = reminderKeyForTask(taskId);
    expect(isReminderDismissed(userId, key)).toBe(false);

    dismissReminder(userId, key);
    expect(isReminderDismissed(userId, key)).toBe(true);
  });

  it("dismisses multiple keys in one write", () => {
    const keys = [reminderKeyForTask("a"), reminderKeyForTask("b")];
    dismissReminders(userId, keys);
    for (const key of keys) {
      expect(isReminderDismissed(userId, key)).toBe(true);
    }
  });
});