import { describe, it, expect } from 'vitest';
import { buildDueDateUpdates, mergeRecurrenceTaskState } from '@/features/tasks/lib/recurrenceTaskState';
import type { Task } from '@/types';

describe('recurrenceTaskState', () => {
  const baseTask: Task = {
    id: 't1',
    workspaceId: 'w1',
    title: 'Test',
    status: 'todo',
    priority: 'P2',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    dueDate: '2026-06-10T00:00:00.000Z',
    recurringRule: 'FREQ=WEEKLY;BYDAY=MO',
    exceptionDates: ['2026-06-17'],
  };

  it('buildDueDateUpdates clears recurrence when due date is removed', () => {
    expect(buildDueDateUpdates(null)).toEqual({
      dueDate: undefined,
      recurringRule: null,
      exceptionDates: undefined,
    });
  });

  it('buildDueDateUpdates keeps recurrence when due date is set', () => {
    const updates = buildDueDateUpdates('2026-07-01');
    expect(updates.dueDate).toBeTruthy();
    expect(updates).not.toHaveProperty('recurringRule');
  });

  it('mergeRecurrenceTaskState clears recurrence fields together', () => {
    const merged = mergeRecurrenceTaskState(baseTask, { recurringRule: null });
    expect(merged.recurringRule).toBeUndefined();
    expect(merged.exceptionDates).toBeUndefined();
  });

  it('mergeRecurrenceTaskState preserves exceptions when explicitly updated', () => {
    const merged = mergeRecurrenceTaskState(baseTask, {
      exceptionDates: ['2026-06-24'],
    });
    expect(merged.exceptionDates).toEqual(['2026-06-24']);
    expect(merged.recurringRule).toBe('FREQ=WEEKLY;BYDAY=MO');
  });
});