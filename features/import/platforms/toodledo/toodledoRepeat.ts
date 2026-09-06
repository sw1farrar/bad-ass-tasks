import {
  generateRecurringRule,
  type RecurrencePattern,
  type WeekDay,
} from "@/lib/utils";

const NAMED_PATTERNS: Record<string, RecurrencePattern> = {
  daily: { freq: "DAILY", interval: 1 },
  weekly: { freq: "WEEKLY", interval: 1 },
  biweekly: { freq: "WEEKLY", interval: 2 },
  monthly: { freq: "MONTHLY", interval: 1 },
  bimonthly: { freq: "MONTHLY", interval: 2 },
  quarterly: { freq: "MONTHLY", interval: 3 },
  semiannually: { freq: "MONTHLY", interval: 6 },
  yearly: { freq: "YEARLY", interval: 1 },
  annually: { freq: "YEARLY", interval: 1 },
};

const DAY_ALIASES: Array<{ test: RegExp; day: WeekDay }> = [
  { test: /^mon(day)?$/i, day: "MO" },
  { test: /^tue(s|sday)?$/i, day: "TU" },
  { test: /^wed(nesday)?$/i, day: "WE" },
  { test: /^thu(r|rs|rsday)?$/i, day: "TH" },
  { test: /^fri(day)?$/i, day: "FR" },
  { test: /^sat(urday)?$/i, day: "SA" },
  { test: /^sun(day)?$/i, day: "SU" },
];

const NTH_WORDS: Record<string, number> = {
  last: -1,
  "1st": 1,
  first: 1,
  "2nd": 2,
  second: 2,
  "3rd": 3,
  third: 3,
  "4th": 4,
  fourth: 4,
};

function parseWeekDay(token: string): WeekDay | null {
  const trimmed = token.trim();
  for (const alias of DAY_ALIASES) {
    if (alias.test.test(trimmed)) return alias.day;
  }
  return null;
}

function parseWeekDays(list: string): WeekDay[] | null {
  const days = list
    .split(/,|&| and /i)
    .map((part) => parseWeekDay(part))
    .filter((d): d is WeekDay => !!d);
  return days.length ? days : null;
}

export type ToodledoRepeatResult = {
  pattern: RecurrencePattern | null;
  rule: string | null;
  fromCompletion: boolean;
  unmapped: boolean;
};

/**
 * Map a Toodledo REPEAT cell to our RecurrencePattern / RRULE string.
 * Returns unmapped: true when the string is non-empty but not recognized.
 */
export function parseToodledoRepeat(raw: string | null | undefined): ToodledoRepeatResult {
  const original = (raw ?? "").trim();
  if (!original) {
    return { pattern: null, rule: null, fromCompletion: false, unmapped: false };
  }

  let text = original.replace(/\s+/g, " ").trim();
  let fromCompletion = false;
  if (/\bfrom completion\b/i.test(text)) {
    fromCompletion = true;
    text = text.replace(/\bfrom completion\b/i, "").replace(/\s+/g, " ").trim();
  }

  const lower = text.toLowerCase();

  const named = NAMED_PATTERNS[lower];
  if (named) {
    const pattern: RecurrencePattern = { ...named };
    if (fromCompletion) pattern.fromCompletion = true;
    return { pattern, rule: generateRecurringRule(pattern), fromCompletion, unmapped: false };
  }

  const everyN = text.match(/^every\s+(\d+)\s+(days?|weeks?|months?|years?)$/i);
  if (everyN) {
    const n = parseInt(everyN[1], 10);
    const unit = everyN[2].toLowerCase();
    const freq: RecurrencePattern["freq"] = unit.startsWith("day")
      ? "DAILY"
      : unit.startsWith("week")
        ? "WEEKLY"
        : unit.startsWith("month")
          ? "MONTHLY"
          : "YEARLY";
    const pattern: RecurrencePattern = { freq, interval: n };
    if (fromCompletion) pattern.fromCompletion = true;
    return { pattern, rule: generateRecurringRule(pattern), fromCompletion, unmapped: false };
  }

  const nthMonth = text.match(
    /^the\s+(last|1st|2nd|3rd|4th|first|second|third|fourth)\s+([a-z]+)\s+of each month$/i,
  );
  if (nthMonth) {
    const nth = NTH_WORDS[nthMonth[1].toLowerCase()];
    const day = parseWeekDay(nthMonth[2]);
    if (nth && day) {
      const pattern: RecurrencePattern = {
        freq: "MONTHLY",
        interval: 1,
        byDay: [day],
        byMonthNth: nth,
      };
      if (fromCompletion) pattern.fromCompletion = true;
      return { pattern, rule: generateRecurringRule(pattern), fromCompletion, unmapped: false };
    }
  }

  const everyDays = text.match(/^every\s+(.+)$/i);
  if (everyDays) {
    const days = parseWeekDays(everyDays[1]);
    if (days) {
      const pattern: RecurrencePattern = {
        freq: "WEEKLY",
        interval: 1,
        byDay: days,
      };
      if (fromCompletion) pattern.fromCompletion = true;
      return { pattern, rule: generateRecurringRule(pattern), fromCompletion, unmapped: false };
    }
  }

  return { pattern: null, rule: null, fromCompletion, unmapped: true };
}
