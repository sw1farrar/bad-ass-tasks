"use client";

import { useEffect, useState } from "react";
import { Repeat } from "lucide-react";
import { toast } from "sonner";
import { DateTimePicker } from "@/components/DateTimePicker";
import {
  cn,
  formatRecurrenceUntilForInput,
  generateRecurringRule,
  getNextRecurringDue,
  getRecurrenceEndDescription,
  getRecurringLabel,
  getUpcomingRecurrencesPreview,
  isDueDatePast,
  normalizeExceptionKey,
  parseRecurringRule,
  resolveRecurrenceSeriesAnchor,
  toDueDateStorage,
  type RecurrenceFreq,
  type RecurrencePattern,
  type WeekDay,
} from "@/lib/utils";
import { parseLocalDate, safeFormatDate } from "@/lib/datetime";
import { buildSkipOccurrenceUpdates } from "@/features/tasks/lib/recurrenceTaskState";
import type { Task } from "@/types";

export interface TaskRecurrenceEditorProps {
  localTask: Task;
  save: (updates: Partial<Task>) => void;
  compact?: boolean;
  datePickerInlinePlacement?: "popover" | "modal" | "embedded";
  /** True when "Until date" is selected but no last day is set yet. */
  onEndIncompleteChange?: (incomplete: boolean) => void;
}

export function TaskRecurrenceEditor({
  localTask,
  save,
  compact = false,
  datePickerInlinePlacement = "modal",
  onEndIncompleteChange,
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
  const fromCompletion = !!currentPattern?.fromCompletion;

  const [endMode, setEndMode] = useState<"never" | "count" | "until">(
    currentCount > 0 ? "count" : currentUntil ? "until" : "never",
  );
  const [localCount, setLocalCount] = useState(currentCount || 10);
  const [localUntil, setLocalUntil] = useState(formatRecurrenceUntilForInput(currentUntil));

  useEffect(() => {
    const mode = currentCount > 0 ? "count" : currentUntil ? "until" : "never";
    setEndMode(mode);
    if (currentCount) setLocalCount(currentCount);
    setLocalUntil(formatRecurrenceUntilForInput(currentUntil));
  }, [currentUntil, currentCount]);

  const endIncomplete =
    !!localTask.recurringRule && endMode === "until" && !formatRecurrenceUntilForInput(localUntil);

  useEffect(() => {
    onEndIncompleteChange?.(endIncomplete);
    return () => onEndIncompleteChange?.(false);
  }, [endIncomplete, onEndIncompleteChange]);

  const weekDays: WeekDay[] = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"];
  const weekLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const seriesAnchor =
    currentPattern?.seriesAnchor ??
    (localTask.dueDate ? normalizeExceptionKey(localTask.dueDate) : undefined);

  const withRuleMeta = (pattern: RecurrencePattern, rolling = fromCompletion): RecurrencePattern => {
    const next: RecurrencePattern = { ...pattern };
    if (rolling) next.fromCompletion = true;
    else delete next.fromCompletion;
    // Lock series seed when creating/editing so monthly DOM + COUNT survive advances
    if (seriesAnchor) next.seriesAnchor = seriesAnchor;
    else delete next.seriesAnchor;
    return next;
  };

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
      const d = formatRecurrenceUntilForInput(untilVal || localUntil);
      newPat = { ...base, until: d };
    } else {
      newPat = base;
    }
    save({ recurringRule: generateRecurringRule(withRuleMeta(newPat)) });
  };

  const toggleDay = (day: WeekDay) => {
    const nextBy = byDays.includes(day)
      ? byDays.filter((d) => d !== day)
      : [...byDays, day].sort((a, b) => weekDays.indexOf(a) - weekDays.indexOf(b));
    const newPattern: RecurrencePattern = {
      freq: freq as RecurrenceFreq,
      interval: Math.max(1, interval),
      byDay: nextBy.length ? (nextBy as WeekDay[]) : undefined,
      ...(endMode === "until" && localUntil ? { until: formatRecurrenceUntilForInput(localUntil) } : {}),
      ...(endMode === "count" ? { count: localCount } : {}),
    };
    save({ recurringRule: generateRecurringRule(withRuleMeta(newPattern)) });
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
      ...(endMode === "until" && localUntil ? { until: formatRecurrenceUntilForInput(localUntil) } : {}),
      ...(endMode === "count" ? { count: localCount } : {}),
    };
    save({ recurringRule: generateRecurringRule(withRuleMeta(newPattern)) });
  };

  const setIntervalVal = (val: number) => {
    const safe = Math.max(1, Math.min(99, val || 1));
    const newPattern: RecurrencePattern = {
      freq: freq as RecurrenceFreq,
      interval: safe,
      byDay: freq === "WEEKLY" ? (byDays.length ? byDays : undefined) : undefined,
      ...(endMode === "until" && localUntil ? { until: formatRecurrenceUntilForInput(localUntil) } : {}),
      ...(endMode === "count" ? { count: localCount } : {}),
    };
    save({ recurringRule: generateRecurringRule(withRuleMeta(newPattern)) });
  };

  const setFromCompletion = (rolling: boolean) => {
    if (!localTask.recurringRule || !currentPattern) return;
    const newPattern: RecurrencePattern = {
      freq: currentPattern.freq,
      interval: Math.max(1, currentPattern.interval),
      byDay: currentPattern.byDay,
      ...(currentPattern.until ? { until: currentPattern.until } : {}),
      ...(currentPattern.count ? { count: currentPattern.count } : {}),
    };
    save({ recurringRule: generateRecurringRule(withRuleMeta(newPattern, rolling)) });
  };

  const handleSkipOccurrence = () => {
    if (!localTask.recurringRule || !localTask.dueDate) {
      toast.info("Set a due date before skipping occurrences");
      return;
    }
    const result = buildSkipOccurrenceUpdates(localTask);
    if (!result) {
      toast.info("No future occurrences (series may have ended)");
      return;
    }
    save(result.updates);
    const skippedParsed = parseLocalDate(result.skippedKey);
    const skippedLabel = skippedParsed
      ? safeFormatDate(skippedParsed, "MMM d", result.skippedKey)
      : result.skippedKey;
    toast.success(result.isOverdue ? "This occurrence skipped" : "Occurrence skipped", {
      description: result.updates.dueDate
        ? `${skippedLabel} skipped · due moved forward`
        : `${skippedLabel} excluded from series`,
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
    <div className={cn(compact ? "space-y-2" : "space-y-3")}>
      {!compact && (
        <div className="flex items-center gap-2 flex-wrap">
          {currentLabel ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-neon-purple/10 text-neon-purple text-xs font-medium border border-neon-purple/30">
              <Repeat className="h-3 w-3" /> {currentLabel}
            </span>
          ) : (
            <span className="text-xs text-text-muted">No recurrence</span>
          )}
        </div>
      )}

      <div
        className={cn(
          "gap-1.5",
          compact ? "grid grid-cols-4" : "flex flex-wrap",
        )}
      >
        {(
          [
            { freq: "DAILY" as const, label: "Daily" },
            { freq: "WEEKLY" as const, label: "Weekly" },
            { freq: "MONTHLY" as const, label: "Monthly" },
            { freq: "YEARLY" as const, label: "Yearly" },
          ] as const
        ).map((opt) => (
          <button
            key={opt.freq}
            type="button"
            title={opt.label}
            onClick={() => setFreq(opt.freq)}
            className={cn(
              "text-xs rounded-full border transition text-center min-w-0",
              compact ? "px-1 py-1 truncate" : "px-3 py-1 whitespace-nowrap",
              hasRule && freq === opt.freq
                ? "bg-neon-purple text-[var(--on-accent)] border-neon-purple"
                : "border-border-glass hover:bg-surface-hover text-text-secondary",
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {hasRule ? (
        <button
          type="button"
          onClick={clearRecurrence}
          className={cn(
            "w-full rounded-lg border border-border-glass text-xs font-medium text-text-secondary hover:bg-surface-hover hover:text-text-primary transition",
            compact ? "min-h-[36px] px-2 py-1.5" : "min-h-[40px] px-3 py-2",
          )}
        >
          Clear repeat
        </button>
      ) : null}

      {localTask.recurringRule ? (
        <>
          <div className="flex items-center gap-2 text-xs whitespace-nowrap">
            <span className="text-text-muted shrink-0">Every</span>
            <input
              type="number"
              min={1}
              max={99}
              value={interval}
              onChange={(e) => setIntervalVal(parseInt(e.target.value, 10))}
              className={cn("input px-2 text-center text-sm shrink-0", compact ? "w-12 py-0.5" : "w-14 py-1")}
            />
            <span className="text-text-muted truncate">
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

          <div className="flex items-center justify-between gap-3 pt-1">
            <div className="min-w-0 flex-1">
              <label
                htmlFor="recurrence-from-completion"
                className={cn(
                  "text-xs text-text-primary cursor-pointer",
                  compact && "whitespace-nowrap block truncate",
                )}
              >
                {compact ? "From completion" : "Start recurrence from completion date"}
              </label>
              {!compact ? (
                <p
                  id="recurrence-from-completion-desc"
                  className="text-[10px] text-text-muted mt-0.5 leading-snug"
                >
                  {fromCompletion
                    ? "Next dates from when you finish"
                    : "Keeps the original schedule"}
                </p>
              ) : null}
            </div>
            <button
              id="recurrence-from-completion"
              type="button"
              role="switch"
              aria-checked={fromCompletion}
              aria-label="Start recurrence from completion date"
              aria-describedby={!compact ? "recurrence-from-completion-desc" : undefined}
              title={
                fromCompletion
                  ? "Next dates from when you finish"
                  : "Keeps the original schedule"
              }
              onClick={() => setFromCompletion(!fromCompletion)}
              className={cn(
                "inline-flex h-5 w-9 shrink-0 items-center rounded-full border-2 p-0.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-purple/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-primary,#0a0a0a)]",
                fromCompletion
                  ? "justify-end border-neon-purple bg-neon-purple"
                  : "justify-start border-text-muted/50 bg-transparent",
              )}
            >
              <span
                className={cn(
                  "pointer-events-none block h-3.5 w-3.5 rounded-full shadow",
                  fromCompletion ? "bg-white" : "bg-text-muted",
                )}
              />
            </button>
          </div>

          <div className="pt-1 space-y-2 border-t border-border-glass">
            <div className="space-y-1.5 w-full">
              <div
                className="flex flex-col gap-1.5 w-full"
                role="group"
                aria-label="When this repeat schedule ends"
              >
                <span className="text-[10px] text-text-muted text-center">Ends</span>
                <div className="flex w-full rounded-xl border border-border-glass overflow-hidden text-xs">
                  {(
                    [
                      {
                        mode: "never" as const,
                        label: compact ? "Forever" : "Never ends",
                        title: "Keep repeating with no end date",
                      },
                      {
                        mode: "count" as const,
                        label: compact ? "After times" : "After a number of times",
                        title: "Stop after a set number of completions",
                      },
                      {
                        mode: "until" as const,
                        label: compact ? "Until date" : "On an end date",
                        title: "Stop on a chosen calendar date",
                      },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.mode}
                      type="button"
                      title={opt.title}
                      aria-pressed={endMode === opt.mode}
                      onClick={() => {
                        setEndMode(opt.mode);
                        // Only persist when we have a value for count/until — avoid wiping COUNT on empty until
                        if (opt.mode === "never") {
                          applyEndCondition("never");
                        } else if (opt.mode === "count") {
                          applyEndCondition("count", localCount || 10);
                        } else if (localUntil) {
                          applyEndCondition("until", undefined, localUntil);
                        }
                      }}
                      className={cn(
                        "flex-1 min-w-0 px-2 py-2 font-medium whitespace-nowrap transition text-center",
                        endMode === opt.mode
                          ? "bg-neon-purple text-[var(--on-accent)]"
                          : "hover:bg-surface-hover text-text-secondary",
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-[10px] text-text-muted leading-snug text-center">
                {endMode === "never"
                  ? "Keeps repeating forever"
                  : endMode === "count"
                    ? "Ends after that many completions (skips don’t count)"
                    : "Stops on the last day you choose"}
              </p>
            </div>

            {endMode === "count" ? (
              <div className="flex items-center justify-center gap-2 text-xs whitespace-nowrap">
                <span className="text-text-muted shrink-0">End after</span>
                <input
                  type="number"
                  min={1}
                  max={365}
                  aria-label="Number of completions before the series ends"
                  value={localCount}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10) || 1;
                    setLocalCount(v);
                    applyEndCondition("count", v);
                  }}
                  className="input w-14 px-2 py-0.5 text-center text-sm shrink-0"
                />
                <span className="text-text-muted">completions</span>
              </div>
            ) : null}

            {endMode === "until" ? (
              <div className="flex items-center justify-center gap-2 text-xs min-w-0">
                <span className="text-text-muted shrink-0 whitespace-nowrap">Last day</span>
                <DateTimePicker
                  value={localUntil}
                  onChange={(dateStr) => {
                    setLocalUntil(dateStr || "");
                    if (!dateStr) {
                      // Cleared date → treat as no end (don't re-apply stale until)
                      applyEndCondition("never");
                      setEndMode("never");
                      return;
                    }
                    applyEndCondition("until", undefined, dateStr);
                  }}
                  className="min-w-0 max-w-[12rem]"
                  variant={datePickerInlinePlacement === "embedded" ? "inline" : "default"}
                  inlinePlacement={datePickerInlinePlacement}
                />
              </div>
            ) : null}
          </div>
        </>
      ) : null}

      {localTask.recurringRule && upcoming.length > 0 ? (
        <div
          className={cn(
            "text-[10px] text-text-muted pt-1",
            compact && "truncate whitespace-nowrap",
          )}
          title={
            fromCompletion
              ? `Rolling — ${upcoming.join(" • ")}`
              : `Next: ${upcoming.join(" • ")}`
          }
        >
          {fromCompletion ? (
            compact ? (
              <>Rolling · {upcoming.join(" · ")}</>
            ) : (
              <>
                <span className="text-text-secondary">Rolling schedule</span>
                {" — "}
                shifts after each completion
                {upcoming[0] ? ` (on-time template: ${upcoming.join(" • ")})` : null}
              </>
            )
          ) : (
            <>Next: {upcoming.join(" • ")}</>
          )}
        </div>
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
            placeholder="FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE;COUNT=12;FROMCOMPLETION=TRUE"
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