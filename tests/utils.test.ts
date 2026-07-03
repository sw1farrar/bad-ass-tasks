import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  parseNaturalLanguage,
  formatDueDate,
  getPriorityColor,
  cn,
  parseRecurringRule,
  generateRecurringRule,
  getRecurringLabel,
  getNextRecurringDue,
  getOccurrencesInRange,
  normalizeExceptionKey,
  toLocalDateString,
  getRecurrenceEndDescription,
  applyTaskUpdateSideEffects,
  formatRecurrenceUntilForInput,
  triggerHaptic,
  getNameInitials,
} from '@/lib/utils';
import type { Priority } from '@/types';

describe('utils — core pure functions (production reliability)', () => {
  describe('parseNaturalLanguage', () => {
    it('parses basic title and default priority', () => {
      const res = parseNaturalLanguage('Buy groceries');
      expect(res.title).toBe('Buy groceries');
      expect(res.priority).toBe('P2');
    });

    it('detects P0/urgent/ASAP priority', () => {
      expect(parseNaturalLanguage('Fix bug ASAP').priority).toBe('P0');
      expect(parseNaturalLanguage('urgent deploy p0').priority).toBe('P0');
    });

    it('detects dates (today, tomorrow, friday, next week)', () => {
      const today = parseNaturalLanguage('do thing today');
      expect(today.dueDate).toBeDefined();

      const tmr = parseNaturalLanguage('Call mom tomorrow');
      expect(tmr.dueDate).toBeDefined();

      const next = parseNaturalLanguage('Review next week');
      expect(next.dueDate).toBeDefined();
    });

    it('extracts @tags and strips from title', () => {
      const res = parseNaturalLanguage('Ship feature @alice @team');
      expect(res.tags).toEqual(['alice', 'team']);
      expect(res.title).toBe('Ship feature');
    });
  });

  describe('formatDueDate', () => {
    it('returns null for falsy', () => {
      expect(formatDueDate(undefined)).toBeNull();
      expect(formatDueDate('')).toBeNull();
    });

    it('labels today correctly', async () => {
      const { toDueDateStorage, startOfLocalToday } = await import('@/lib/datetime');
      const res = formatDueDate(toDueDateStorage(startOfLocalToday()));
      expect(res?.label).toBe('Today');
      expect(res?.variant).toBe('today');
    });

    it('labels past as overdue with date', () => {
      const past = new Date(Date.now() - 86400000 * 2).toISOString();
      const res = formatDueDate(past);
      expect(res?.variant).toBe('overdue');
      expect(res?.label).not.toBe('Today');
    });

    it('returns null for invalid date strings without throwing', () => {
      expect(formatDueDate('not-a-date')).toBeNull();
      expect(formatDueDate('   ')).toBeNull();
    });
  });

  describe('getPriorityColor', () => {
    it('returns CSS var or color for each priority', () => {
      expect(getPriorityColor('P0')).toContain('--priority-p0');
      expect(getPriorityColor('P3')).toContain('neon-green'); // P3 uses neon-green per current impl
    });
  });

  describe('cn (tailwind-merge + clsx)', () => {
    it('merges classes correctly', () => {
      expect(cn('foo', 'bar', false && 'baz')).toBe('foo bar');
    });
  });

  describe('getNameInitials', () => {
    it('returns first and last initials for multi-word names', () => {
      expect(getNameInitials('Alex Rivera')).toBe('AR');
      expect(getNameInitials('Alex Rivera Smith')).toBe('AS');
    });

    it('returns first two letters for single-word names', () => {
      expect(getNameInitials('Alex')).toBe('AL');
    });

    it('returns empty string for missing names', () => {
      expect(getNameInitials('')).toBe('');
      expect(getNameInitials(undefined)).toBe('');
    });
  });
});

// ====================================================================
// Agent 33: Expanded production tests for critical pure logic
// Recurring engine (high value, zero side-effects, used in calendar/Today/views)
// ====================================================================
describe('utils — recurring engine (production reliability + edge cases)', () => {
  describe('parseRecurringRule / generateRecurringRule roundtrip', () => {
    it('parses weekly with BYDAY and count', () => {
      const rule = 'FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,FR;COUNT=10';
      const parsed = parseRecurringRule(rule);
      expect(parsed?.freq).toBe('WEEKLY');
      expect(parsed?.interval).toBe(2);
      expect(parsed?.byDay).toEqual(['MO', 'FR']);
      expect(parsed?.count).toBe(10);
      expect(generateRecurringRule(parsed!)).toBe(rule);
    });

    it('parses monthly until', () => {
      const rule = 'FREQ=MONTHLY;UNTIL=20261231';
      const parsed = parseRecurringRule(rule);
      expect(parsed?.freq).toBe('MONTHLY');
      expect(parsed?.until).toBe('2026-12-31');
    });

    it('returns null for invalid', () => {
      expect(parseRecurringRule(null as any)).toBeNull();
      expect(parseRecurringRule('')).toBeNull();
      expect(parseRecurringRule('FOO=BAR')).toBeNull();
      expect(parseRecurringRule('FREQ=WEEKLY;INTERVAL=0')).toBeNull();
      expect(parseRecurringRule('FREQ=DAILY;COUNT=0')).toBeNull();
      expect(parseRecurringRule('FREQ=WEEKLY;BYDAY=XX')).toBeNull();
    });
  });

  describe('getRecurringLabel', () => {
    it('produces human labels', () => {
      expect(getRecurringLabel('FREQ=WEEKLY;BYDAY=MO')).toContain('Weekly');
      expect(getRecurringLabel('FREQ=DAILY;INTERVAL=3')).toContain('Every 3 days');
      expect(getRecurringLabel(null)).toBe('');
    });
  });

  describe('getNextRecurringDue + exceptions + end conditions', () => {
    it('advances correctly for daily', () => {
      const anchor = new Date('2026-01-01').toISOString();
      const next = getNextRecurringDue('FREQ=DAILY', new Date('2026-01-01'), anchor);
      expect(next).toBeTruthy();
    });

    it('respects exceptions', () => {
      const anchor = new Date('2026-01-05').toISOString();
      const ex = [normalizeExceptionKey('2026-01-06')];
      const next = getNextRecurringDue('FREQ=DAILY', new Date('2026-01-05'), anchor, ex);
      // Should skip the exception day
      expect(next ? toLocalDateString(next) : '').not.toBe('2026-01-06');
    });

    it('advances from current due when completing early (future due)', () => {
      const anchor = '2026-06-10';
      const next = getNextRecurringDue('FREQ=DAILY', anchor, anchor);
      expect(next ? toLocalDateString(next) : '').toBe('2026-06-11');
    });

    it('honors weekly INTERVAL with BYDAY', () => {
      const anchor = '2026-06-01'; // Monday
      const next = getNextRecurringDue(
        'FREQ=WEEKLY;INTERVAL=2;BYDAY=MO',
        anchor,
        anchor
      );
      expect(next ? toLocalDateString(next) : '').toBe('2026-06-15');
    });

    it('returns null when COUNT is exhausted', () => {
      const anchor = '2026-01-01';
      const next = getNextRecurringDue(
        'FREQ=DAILY;COUNT=3',
        '2026-01-03',
        anchor
      );
      expect(next).toBeNull();
    });
  });

  describe('getOccurrencesInRange (bounded, exceptions, COUNT)', () => {
    it('generates bounded occurrences', () => {
      const anchor = new Date('2026-05-01').toISOString();
      const occ = getOccurrencesInRange(anchor, 'FREQ=WEEKLY;BYDAY=MO', new Date('2026-05-01'), new Date('2026-06-01'), 10);
      expect(occ.length).toBeGreaterThan(0);
      expect(occ.length).toBeLessThanOrEqual(10);
    });

    it('honors COUNT end', () => {
      const anchor = '2026-01-01';
      const occ = getOccurrencesInRange(anchor, 'FREQ=DAILY;COUNT=5', new Date(2026, 0, 1), new Date(2026, 0, 10), 20);
      expect(occ.length).toBeLessThanOrEqual(5);
    });

    it('aligns weekly series to anchor weekday without BYDAY', () => {
      const anchor = '2026-01-15';
      const occ = getOccurrencesInRange(
        anchor,
        'FREQ=WEEKLY',
        new Date(2026, 0, 1),
        new Date(2026, 1, 28),
        10,
      );
      expect(occ.length).toBeGreaterThan(0);
      expect(toLocalDateString(occ[0])).toBe('2026-01-15');
      expect(toLocalDateString(occ[1])).toBe('2026-01-22');
    });

    it('aligns monthly series to anchor day-of-month', () => {
      const anchor = '2026-01-31';
      const occ = getOccurrencesInRange(
        anchor,
        'FREQ=MONTHLY',
        new Date(2026, 0, 1),
        new Date(2026, 5, 30),
        10,
      );
      expect(occ.length).toBeGreaterThan(0);
      expect(toLocalDateString(occ[0])).toBe('2026-01-31');
      expect(toLocalDateString(occ[1])).toBe('2026-02-28');
      expect(toLocalDateString(occ[2])).toBe('2026-03-31');
      expect(toLocalDateString(occ[3])).toBe('2026-04-30');
    });

    it('does not emit weekly BYDAY occurrences before anchor', () => {
      const anchor = '2026-06-10';
      const occ = getOccurrencesInRange(
        anchor,
        'FREQ=WEEKLY;BYDAY=MO',
        new Date(2026, 5, 1),
        new Date(2026, 5, 30),
        10,
      );
      expect(occ.every((d) => toLocalDateString(d) >= anchor)).toBe(true);
      expect(toLocalDateString(occ[0])).toBe('2026-06-15');
    });

    it('does not let skipped dates consume COUNT budget', () => {
      const anchor = '2026-01-01';
      const ex = [normalizeExceptionKey('2026-01-02')];
      const occ = getOccurrencesInRange(
        anchor,
        'FREQ=DAILY;COUNT=3',
        new Date(2026, 0, 1),
        new Date(2026, 0, 10),
        10,
        ex,
      );
      expect(occ.map((d) => toLocalDateString(d))).toEqual(['2026-01-01', '2026-01-03', '2026-01-04']);
    });
  });

  describe('formatRecurrenceUntilForInput', () => {
    it('preserves YYYY-MM-DD values', () => {
      expect(formatRecurrenceUntilForInput('2026-12-31')).toBe('2026-12-31');
    });

    it('converts compact YYYYMMDD values', () => {
      expect(formatRecurrenceUntilForInput('20261231')).toBe('2026-12-31');
    });
  });

  describe('local timezone helpers (lib/datetime)', () => {
    it('parseLocalDate preserves calendar day from stored ISO', async () => {
      const { parseLocalDate, toDueDateStorage, toLocalDateString } = await import('@/lib/datetime');
      const stored = toDueDateStorage(new Date(2026, 5, 15));
      expect(toLocalDateString(parseLocalDate(stored)!)).toBe('2026-06-15');
    });

    it('dueDateFromUserInput round-trips YYYY-MM-DD', async () => {
      const { dueDateFromUserInput, parseLocalDate, toLocalDateString } = await import('@/lib/datetime');
      const stored = dueDateFromUserInput('2026-03-20');
      expect(stored).toBeTruthy();
      expect(toLocalDateString(parseLocalDate(stored!)!)).toBe('2026-03-20');
    });

    it('isDueDatePast uses calendar today not clock time', async () => {
      const { isDueDatePast, toDueDateStorage, startOfLocalToday } = await import('@/lib/datetime');
      const todayStored = toDueDateStorage(startOfLocalToday());
      expect(isDueDatePast(todayStored)).toBe(false);
      const yesterday = toDueDateStorage(new Date(startOfLocalToday().getTime() - 86400000));
      expect(isDueDatePast(yesterday)).toBe(true);
    });
  });

  describe('triggerHaptic', () => {
    const vibrate = vi.fn();

    beforeEach(() => {
      vibrate.mockClear();
      Object.defineProperty(navigator, 'vibrate', {
        value: vibrate,
        configurable: true,
      });
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('skips vibrate before user gesture', () => {
      triggerHaptic('light');
      expect(vibrate).not.toHaveBeenCalled();
    });

    it('vibrates after a user gesture', () => {
      triggerHaptic('light');
      window.dispatchEvent(new Event('pointerdown'));
      triggerHaptic('light');
      expect(vibrate).toHaveBeenCalledWith(8);
    });
  });

  describe('applyTaskUpdateSideEffects', () => {
    it('clears recurrence when due date is removed', () => {
      const result = applyTaskUpdateSideEffects({
        dueDate: null,
        recurringRule: 'FREQ=WEEKLY',
        exceptionDates: ['2026-06-01'],
      });
      expect(result.recurringRule).toBeNull();
      expect(result.exceptionDates).toBeUndefined();
    });

    it('clears completedAt when status is not done', () => {
      const result = applyTaskUpdateSideEffects({
        status: 'todo',
      });
      expect(result.completedAt).toBeUndefined();
    });
  });

  describe('getRecurrenceEndDescription', () => {
    it('describes end conditions', () => {
      expect(getRecurrenceEndDescription('FREQ=WEEKLY;COUNT=12')).toContain('12');
      expect(getRecurrenceEndDescription('FREQ=MONTHLY;UNTIL=20261231')).toContain('2026-12-31');
      expect(getRecurrenceEndDescription(null)).toBe('No end');
    });
  });
});

// Basic smoke for new observability exports (logger side effects mocked via vitest env)
describe('observability foundation (Agent 33)', () => {
  it('logger has new production methods', async () => {
    const { logger, initErrorMonitoring, reportMetric, timeOperation } = await import('@/lib/logger');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.getErrorBuffer).toBe('function');
    expect(typeof logger.registerErrorReporter).toBe('function');
    expect(typeof logger.reportMetric).toBe('function');
    expect(typeof reportMetric).toBe('function');
    expect(typeof initErrorMonitoring).toBe('function');
    expect(typeof timeOperation).toBe('function');
    // Safe to call (idempotent, no crash in jsdom)
    initErrorMonitoring();
    reportMetric('test_metric', 123, { foo: 'bar' });
  });
});
