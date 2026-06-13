"use client";

import { useEffect, useState } from "react";
import { Repeat } from "lucide-react";
import { toast } from "sonner";
import { DateTimePicker } from "@/components/DateTimePicker";
import {
  cn,
  generateRecurringRule,
  getNextRecurringDue,
  getRecurrenceEndDescription,
  getRecurringLabel,
  getUpcomingRecurrencesPreview,
  isDueDatePast,
  normalizeExceptionKey,
  parseRecurringRule,
  type RecurrenceFreq,
  type RecurrencePattern,
  type WeekDay,
} from "@/lib/utils";
import { parseLocalDate, safeFormatDate } from "@/lib/datetime";
import type { Task } from "@/types";

export interface TaskRecurrenceEditorProps {
  localTask: Task;
  save: (updates: Partial<Task>) => void;
  compact?: boolean;
}

export function TaskRecurrenceEditor({
  localTask,
  save,
  compact = false,
}: TaskRecurrenceEditorProps) {
  const currentLabel = getRecurringLabel(localTask.recurringRule);
  const currentPattern = parseRecurringRule(localTask.recurringRule);
  const upcoming = getUpcomingRecurrencesPreview(
    localTask.dueDate,
    localTask.recurringRule,
    4,
    localTask.exceptionDates,
  );
  const endDesc = getRecurrenceEndDescription(localTask.recurringRule);

  const hasRule = !!localTask.recurringRule;
  const freq = currentPattern?.freq ?? "WEEKLY";
  const interval = currentPattern?.interval ?? 1;
  const byDays = currentPattern?.byDay || [];
  const currentUntil = currentPattern?.until || "";
  const currentCount = currentPattern?.count || 0;

  const [endMode, setEndMode] = useState<"never" | "count" | "until">(
    currentCount > 0 ? "count" : currentUntil ? "until" : "never",
  );
  const [localCount, setLocalCount] = useState(currentCount || 10);
  const [localUntil, setLocalUntil] = useState(
    currentUntil ? `${currentUntil.slice(0, 4)}-${currentUntil.slice(4, 6)}-${currentUntil.slice(6, 8)}` : "",
  );

  useEffect(() => {
    const mode = currentCount > 0 ? "count" : currentUntil ? "until" : "never";
    setEndMode(mode);
    if (currentCount) setLocalCount(currentCount);
    if (currentUntil) {
      setLocalUntil(`${currentUntil.slice(0, 4)}-${currentUntil.slice(4, 6)}-${currentUntil.slice(6, 8)}`);
    } else {
      setLocalUntil("");
    }
  }, [currentUntil, currentCount]);

  const weekDays: WeekDay[] = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"];
  const weekLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const applyEndCondition = (mode: "never" | "count" | "until", countVal?: number, untilVal?: string) => {
    const base: Omit<RecurrencePattern, "until" | "count"> = {
      freq: freq as RecurrenceFreq,
      interval: Math.max(1, interval),
      byDay: freq === "WEEKLY" ? (byDays.length ? byDays : undefined) : undefined,
    };
    let newPat: RecurrencePattern;
    if (mode === "count" && (countVal || localCount) > 0) {
      newPat = { ...base, count: countVal || localCount };
    } else if (mode === "until" && (untilVal || localUntil)) {
      const d = untilVal || localUntil;
      const compactUntil = d.replace(/-/g, "");
      newPat = { ...base, until: compactUntil };
    } else {
      newPat = base;
    }
    save({ recurringRule: generateRecurringRule(newPat) });
  };

  const toggleDay = (day: WeekDay) => {
    const nextBy = byDays.includes(day)
      ? byDays.filter((d) => d !== day)
      : [...byDays, day].sort((a, b) => weekDays.indexOf(a) - weekDays.indexOf(b));
    const newPattern: RecurrencePattern = {
      freq: freq as RecurrenceFreq,
      interval: Math.max(1, interval),
      byDay: nextBy.length ? (nextBy as WeekDay[]) : undefined,
      ...(endMode === "until" && localUntil ? { until: localUntil.replace(/-/g, "") } : {}),
      ...(endMode === "count" ? { count: localCount } : {}),
    };
    save({ recurringRule: generateRecurringRule(newPattern) });
  };

  const setFreq = (newFreq: RecurrenceFreq) => {
    if (!localTask.dueDate) {
      toast.info("Set a due date first", { description: "Recurrence needs an anchor date." });
      return;
    }
    const newPattern: RecurrencePattern = {
      freq: newFreq,
      interval: Math.max(1, interval),
      byDay: newFreq === "WEEKLY" ? (byDays.length ? byDays : undefined) : undefined,
      ...(endMode === "until" && localUntil ? { until: localUntil.replace(/-/g, "") } : {}),
      ...(endMode === "count" ? { count: localCount } : {}),
    };
    save({ recurringRule: generateRecurringRule(newPattern) });
  };

  const setIntervalVal = (val: number) => {
    const safe = Math.max(1, Math.min(99, val || 1));
    const newPattern: RecurrencePattern = {
      freq: freq as RecurrenceFreq,
      interval: safe,
      byDay: freq === "WEEKLY" ? (byDays.length ? byDays : undefined) : undefined,
      ...(endMode === "until" && localUntil ? { until: localUntil.replace(/-/g, "") } : {}),
      ...(endMode === "count" ? { count: localCount } : {}),
    };
    save({ recurringRule: generateRecurringRule(newPattern) });
  };

  const handleSkipOccurrence = () => {
    if (!localTask.recurringRule || !localTask.dueDate) {
      toast.info("Set a due date before skipping occurrences");
      return;
    }
    const isOverdue = isDueDatePast(localTask.dueDate);
    const skipTarget = isOverdue
      ? parseLocalDate(localTask.dueDate)
      : getNextRecurringDue(
          localTask.recurringRule,
          new Date(),
          localTask.dueDate,
          localTask.exceptionDates,
        );
    if (!skipTarget) {
      toast.info("No future occurrences (series may have ended)");
      return;
    }
    const exKey = normalizeExceptionKey(skipTarget);
    const currentEx = localTask.exceptionDates || [];
    if (currentEx.some((ex) => normalizeExceptionKey(ex) === exKey)) {
      toast.info("That occurrence is already skipped");
      return;
    }
    const nextEx = [...currentEx, exKey];
    save({ exceptionDates: nextEx });
    toast.success(isOverdue ? "This occurrence skipped" : "Next occurrence skipped", {
      description: `${safeFormatDate(skipTarget, "MMM d", "that date")} excluded from series`,
    });
  };

  const [showRaw, setShowRaw] = useState(false);
  const [rawRule, setRawRule] = useState(localTask.recurringRule || "");

  const applyRawRule = () => {
    const trimmed = rawRule.trim().toUpperCase();
    if (!trimmed) {
      clearRecurrence();
    } else {
      const parsed = parseRecurringRule(trimmed);
      if (!parsed?.freq) {
        toast.error("Invalid recurrence rule", {
          description: "Must include a valid FREQ (DAILY, WEEKLY, etc.).",
        });
        return;
      }
      if (!localTask.dueDate) {
        toast.info("Set a due date first", { description: "Recurrence needs an anchor date." });
        return;
      }
      save({ recurringRule: trimmed });
    }
    setShowRaw(false);
  };

  const clearRecurrence = () => {
    save({ recurringRule: undefined, exceptionDates: undefined });
  };

  return (
    <div className="space-y-3">
      {!compact && (
        <div className="flex items-center gap-2 flex-wrap">
          {currentLabel ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-neon-purple/10 text-neon-purple text-xs font-medium border border-neon-purple/30">
              <Repeat className="h-3 w-3" /> {currentLabel}
            </span>
          ) : (
            <span className="text-xs text-text-muted">No recurrence</span>
          )}
          {localTask.recurringRule ? (
            <button
              type="button"
              onClick={clearRecurrence}
              className="text-[10px] px-2 py-0.5 rounded bg-surface-hover hover:bg-surface-hover text-text-secondary transition"
            >
              Clear
            </button>
          ) : null}
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        {(["DAILY", "WEEKLY", "MONTHLY", "YEARLY"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFreq(f)}
            className={cn(
              "text-xs px-3 py-1 rounded-full border transition",
              hasRule && freq === f
                ? "bg-neon-purple text-[var(--on-accent)] border-neon-purple"
                : "border-border-glass hover:bg-surface-hover text-text-secondary",
            )}
          >
            {f === "DAILY" ? "Daily" : f === "WEEKLY" ? "Weekly" : f === "MONTHLY" ? "Monthly" : "Yearly"}
          </button>
        ))}
        <button
          type="button"
          onClick={clearRecurrence}
          className={cn(
            "text-xs px-3 py-1 rounded-full border transition",
            !hasRule
              ? "bg-neon-purple text-[var(--on-accent)] border-neon-purple"
              : "border-border-glass hover:bg-surface-hover text-text-muted",
          )}
        >
          None
        </button>
      </div>

      {localTask.recurringRule ? (
        <>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-text-muted">Every</span>
            <input
              type="number"
              min={1}
              max={99}
              value={interval}
              onChange={(e) => setIntervalVal(parseInt(e.target.value, 10))}
              className="input w-14 px-2 py-1 text-center text-sm"
            />
            <span className="text-text-muted">
              {freq.toLowerCase()}
              {interval > 1 ? "s" : ""}
            </span>
          </div>

          {freq === "WEEKLY" ? (
            <div className="flex flex-wrap gap-1">
              {weekDays.map((day, i) => (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleDay(day)}
                  className={cn(
                    "text-[10px] px-2 py-0.5 rounded-full border transition min-w-[34px]",
                    byDays.includes(day)
                      ? "bg-neon-purple text-[var(--on-accent)] border-neon-purple"
                      : "border-border-glass hover:bg-surface-hover text-text-secondary",
                  )}
                >
                  {weekLabels[i]}
                </button>
              ))}
            </div>
          ) : null}

          <div className="pt-1 space-y-2 border-t border-border-glass">
            <div className="text-[10px] text-text-muted flex items-center gap-1.5">
              <span>Ends</span>
              <div className="inline-flex rounded-full border border-border-glass overflow-hidden text-[10px]">
                {(["never", "count", "until"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      setEndMode(m);
                      applyEndCondition(m);
                    }}
                    className={cn(
                      "px-2.5 py-0.5 transition",
                      endMode === m
                        ? "bg-neon-purple text-[var(--on-accent)]"
                        : "hover:bg-surface-hover text-text-secondary",
                    )}
                  >
                    {m === "never" ? "Never" : m === "count" ? "After N" : "On date"}
                  </button>
                ))}
              </div>
            </div>

            {endMode === "count" ? (
              <div className="flex items-center gap-2 text-xs pl-1">
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={localCount}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10) || 1;
                    setLocalCount(v);
                    applyEndCondition("count", v);
                  }}
                  className="input w-16 px-2 py-0.5 text-center text-sm"
                />
                <span className="text-text-muted">occurrences</span>
                <button
                  type="button"
                  onClick={() => {
                    setEndMode("never");
                    applyEndCondition("never");
                  }}
                  className="text-[10px] text-text-secondary underline"
                >
                  or never
                </button>
              </div>
            ) : null}

            {endMode === "until" ? (
              <div className="flex items-center gap-2 text-xs pl-1">
                <DateTimePicker
                  value={localUntil}
                  onChange={(dateStr) => {
                    setLocalUntil(dateStr || "");
                    applyEndCondition("until", undefined, dateStr || "");
                  }}
                  className="flex-1"
                />
                <button
                  type="button"
                  onClick={() => {
                    setEndMode("never");
                    applyEndCondition("never");
                  }}
                  className="text-[10px] text-text-secondary underline"
                >
                  Never
                </button>
              </div>
            ) : null}

            {endMode === "never" && !compact ? (
              <div className="text-[10px] text-text-secondary pl-1">Open-ended series (continues forever)</div>
            ) : null}
          </div>
        </>
      ) : null}

      {localTask.recurringRule && upcoming.length > 0 ? (
        <div className="text-[10px] text-text-muted pt-1">Next: {upcoming.join(" • ")}</div>
      ) : null}

      {!compact && localTask.recurringRule ? (
        <div className="text-[9px] text-text-muted flex items-center gap-2">
          <span className="font-mono opacity-70">{localTask.recurringRule}</span>
          <button
            type="button"
            onClick={() => {
              setRawRule(localTask.recurringRule || "");
              setShowRaw(!showRaw);
            }}
            className="text-[9px] underline hover:text-neon-purple"
            title="Edit raw RRULE (advanced / custom)"
          >
            edit raw
          </button>
        </div>
      ) : null}

      {!compact && showRaw ? (
        <div className="space-y-1">
          <input
            value={rawRule}
            onChange={(e) => setRawRule(e.target.value)}
            className="input w-full px-2 py-1 font-mono text-xs"
            placeholder="FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE;COUNT=12"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={applyRawRule}
              className="text-[10px] px-2 py-0.5 bg-neon-purple/20 text-neon-purple rounded"
            >
              Apply RRULE
            </button>
            <button
              type="button"
              onClick={() => setShowRaw(false)}
              className="text-[10px] px-2 py-0.5 bg-surface-hover rounded"
            >
              Cancel
            </button>
          </div>
          <div className="text-[9px] text-text-secondary">
            Full RRULE strings supported (engine handles parse/generate + COUNT/UNTIL/exceptions).
          </div>
        </div>
      ) : null}

      {localTask.recurringRule ? (
        <div className="pt-2 border-t border-border-glass space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleSkipOccurrence}
              className="text-[10px] px-2 py-0.5 rounded bg-neon-purple/10 hover:bg-neon-purple/20 text-neon-purple border border-neon-purple/30 transition"
              title="Skip the current overdue occurrence or the next future one"
            >
              {localTask.dueDate && isDueDatePast(localTask.dueDate)
                ? "Skip this occurrence"
                : "Skip next occurrence"}
            </button>
            <span className="text-[9px] text-text-muted">{endDesc}</span>
          </div>

          {localTask.exceptionDates && localTask.exceptionDates.length > 0 ? (
            <div>
              <div className="text-[10px] text-text-secondary mb-1">Skipped dates (tap to restore):</div>
              <div className="flex flex-wrap gap-1">
                {localTask.exceptionDates.map((exDate, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      const nextEx = (localTask.exceptionDates || []).filter((_, i) => i !== idx);
                      save({ exceptionDates: nextEx.length ? nextEx : undefined });
                    }}
                    className="text-[10px] px-1.5 py-0.5 rounded bg-surface-hover hover:bg-surface-hover text-text-secondary border border-border-glass"
                    title="Click to un-skip this occurrence"
                  >
                    {exDate.slice(0, 10)} ✕
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}