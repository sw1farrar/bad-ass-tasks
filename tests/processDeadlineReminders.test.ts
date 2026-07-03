import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/notifications/deliverNotification', () => ({
  deliverNotification: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/notifications/dismissedReminders', () => ({
  isReminderDismissed: vi.fn(() => false),
  reminderKeyForTask: vi.fn((taskId: string) => `deadline:${taskId}`),
}));

import { processDeadlineReminders } from '@/lib/notifications/processDeadlineReminders';
import { deliverNotification } from '@/lib/notifications/deliverNotification';
import { toDueDateStorage } from '@/lib/datetime';

describe('processDeadlineReminders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reminds for tasks due today', async () => {
    const today = toDueDateStorage(new Date());
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'tasks') {
          return {
            select: () => ({
              contains: () => ({
                not: () => ({
                  neq: async () => ({
                    data: [
                      {
                        id: 't1',
                        title: 'Due today',
                        due_date: today,
                        recurring_rule: null,
                        workspace_id: 'w1',
                        assignee_ids: ['u1'],
                      },
                    ],
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        if (table === 'workspaces') {
          return {
            select: () => ({
              in: async () => ({
                data: [{ id: 'w1', name: 'Workspace' }],
                error: null,
              }),
            }),
          };
        }
        if (table === 'notifications') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  contains: () => ({
                    limit: async () => ({ data: [], error: null }),
                  }),
                }),
              }),
            }),
          };
        }
        throw new Error(`Unexpected table ${table}`);
      }),
    };

    await processDeadlineReminders('u1', supabase as any);

    expect(deliverNotification).toHaveBeenCalledTimes(1);
    expect(deliverNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'deadline',
        title: 'Task due today',
      }),
    );
  });

  it('reminds for overdue recurring tasks but not overdue one-time tasks', async () => {
    const overdue = toDueDateStorage(new Date(Date.now() - 86400000 * 3));
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'tasks') {
          return {
            select: () => ({
              contains: () => ({
                not: () => ({
                  neq: async () => ({
                    data: [
                      {
                        id: 'recurring',
                        title: 'Weekly sync',
                        due_date: overdue,
                        recurring_rule: 'FREQ=WEEKLY;BYDAY=MO',
                        workspace_id: 'w1',
                        assignee_ids: ['u1'],
                      },
                      {
                        id: 'one-time',
                        title: 'Old task',
                        due_date: overdue,
                        recurring_rule: null,
                        workspace_id: 'w1',
                        assignee_ids: ['u1'],
                      },
                    ],
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        if (table === 'workspaces') {
          return {
            select: () => ({
              in: async () => ({
                data: [{ id: 'w1', name: 'Workspace' }],
                error: null,
              }),
            }),
          };
        }
        if (table === 'notifications') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  contains: () => ({
                    limit: async () => ({ data: [], error: null }),
                  }),
                }),
              }),
            }),
          };
        }
        throw new Error(`Unexpected table ${table}`);
      }),
    };

    await processDeadlineReminders('u1', supabase as any);

    expect(deliverNotification).toHaveBeenCalledTimes(1);
    expect(deliverNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Recurring task overdue',
        metadata: expect.objectContaining({ task_id: 'recurring' }),
      }),
    );
  });
});