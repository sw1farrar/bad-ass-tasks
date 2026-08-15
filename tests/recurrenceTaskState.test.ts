import { describe, it, expect } from 'vitest';
import {
  buildDueDateUpdates,
  buildRecurringDueDateChange,
  buildSkipOccurrenceUpdates,
  mergeRecurrenceTaskState,
} from '@/features/tasks/lib/recurrenceTaskState';
import { normalizeExceptionKey, parseRecurringRule } from '@/lib/utils';
import type { Task } from '@/types';

describe('recurrenceTaskState', () => {
  const baseTask: Task = {
    id: 't1',
    workspaceId: 'w1',
    title: 'Test',
    description: '',
    status: 'todo',
    priority: 'P2',
    tags: [],
    linkedNoteIds: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    dueDate: '2026-06-10T00:00:00.000Z',
    recurringRule: 'FREQ=WEEKLY;BYDAY=MO;X-SERIES-ANCHOR=20260610',
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

  it('buildRecurringDueDateChange series re-anchors and clears exceptions', () => {
    const updates = buildRecurringDueDateChange(baseTask, '2026-07-01', 'series');
    const pattern = parseRecurringRule(updates.recurringRule as string);
    expect(pattern?.seriesAnchor).toBe('2026-07-01');
    expect(updates.exceptionDates).toBeUndefined();
  });

  it('buildRecurringDueDateChange occurrence keeps series anchor and exceptions old due', () => {
    const updates = buildRecurringDueDateChange(baseTask, '2026-06-12', 'occurrence');
    const pattern = parseRecurringRule(updates.recurringRule as string);
    expect(pattern?.seriesAnchor).toBe('2026-06-10');
    const oldKey = normalizeExceptionKey(baseTask.dueDate!);
    expect(updates.exceptionDates).toContain(oldKey);
  });

  it('buildSkipOccurrenceUpdates advances due when skipping the visible due date', () => {
    const overdue: Task = {
      ...baseTask,
      dueDate: '2020-01-06T00:00:00.000Z',
      recurringRule: 'FREQ=WEEKLY;BYDAY=MO;X-SERIES-ANCHOR=20200106',
      exceptionDates: undefined,
    };
    const result = buildSkipOccurrenceUpdates(overdue);
    expect(result).toBeTruthy();
    expect(result?.updates.exceptionDates).toEqual(['2020-01-06']);
    expect(result?.updates.dueDate ? normalizeExceptionKey(result.updates.dueDate) : '').toBe(
      '2020-01-13',
    );
  });

  it('skip of weekly Saturday due Aug 8 lands on Aug 15, not Aug 22', () => {
    const task: Task = {
      ...baseTask,
      dueDate: '2026-08-08T00:00:00.000Z',
      recurringRule: 'FREQ=WEEKLY;BYDAY=SA;X-SERIES-ANCHOR=20260808',
      exceptionDates: undefined,
    };
    const result = buildSkipOccurrenceUpdates(task);
    expect(result?.updates.exceptionDates).toEqual(['2026-08-08']);
    expect(result?.updates.dueDate ? normalizeExceptionKey(result.updates.dueDate) : '').toBe(
      '2026-08-15',
    );
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
    expect(merged.recurringRule).toBe('FREQ=WEEKLY;BYDAY=MO;X-SERIES-ANCHOR=20260610');
  });
});