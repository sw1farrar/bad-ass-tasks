import { describe, it, expect } from 'vitest';
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
  getRecurrenceEndDescription,
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

    it('labels today correctly', () => {
      const todayISO = new Date().toISOString();
      const res = formatDueDate(todayISO);
      expect(res?.label).toBe('Today');
      expect(res?.variant).toBe('today');
    });

    it('labels past as overdue with date', () => {
      const past = new Date(Date.now() - 86400000 * 2).toISOString();
      const res = formatDueDate(past);
      expect(res?.variant).toBe('overdue');
      expect(res?.label).not.toBe('Today');
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
      expect(parseRecurringRule('FOO=BAR')).toBeTruthy(); // still parses with default
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
      const ex = [normalizeExceptionKey(new Date('2026-01-06'))];
      const next = getNextRecurringDue('FREQ=DAILY', new Date('2026-01-05'), anchor, ex);
      // Should skip the exception day
      expect(next?.toISOString().slice(0,10)).not.toBe('2026-01-06');
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
      const anchor = new Date('2026-01-01').toISOString();
      const occ = getOccurrencesInRange(anchor, 'FREQ=DAILY;COUNT=5', new Date('2026-01-01'), new Date('2026-01-10'), 20);
      expect(occ.length).toBeLessThanOrEqual(5);
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
