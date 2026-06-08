"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { MessageSquare, Trash2, Loader2, Repeat, ChevronDown, Pencil, Check } from "lucide-react";
import { WorkspaceItemDeepLink } from "./WorkspaceItemDeepLink";
import { TaskAssigneePicker } from "./TaskAssigneePicker";
import {
  getMemberDisplayName,
  getMemberMentionHandle,
  memberMatchesMentionQuery,
  resolveAssigneeLabel,
} from "@/lib/assignee";
import { DateTimePicker } from "./DateTimePicker";
import { ConfirmationModal } from "./ConfirmationModal";
import { toast } from "sonner";
import { safeFormatDate, safeFormatTimestampIso } from "@/lib/datetime";
import { motion, AnimatePresence, PanInfo, useDragControls } from "framer-motion";
import { useTaskStore } from "@/store/useTaskStore";
import type { Comment, Task, WorkspaceMember } from "@/types";
import { getCommentAuthorLabel } from "@/features/tasks/lib/taskCommentIndicators";

import { triggerHaptic } from "@/lib/utils";
import { useScrollLock } from "@/lib/hooks/useScrollLock";
import {
  cn,
  applyTaskUpdateSideEffects,
  getRecurringLabel,
  parseRecurringRule,
  generateRecurringRule,
  getUpcomingRecurrencesPreview,
  getNextRecurringDue,
  normalizeExceptionKey,
  toDueDateStorage,
  parseLocalDate,
  isDueDatePast,
  getRecurrenceEndDescription,
  type RecurrencePattern,
  type RecurrenceFreq,
  type WeekDay,
} from "@/lib/utils";

interface TaskModalProps {
  task: Task;
  isOpen: boolean;
  onClose: () => void;
  /** Shown when opened from the Home hub for a cross-workspace preview */
  workspaceDeepLink?: {
    workspaceName: string;
    onNavigate: () => void;
  };
}

const SHEET_SPRING = { type: "spring" as const, damping: 32, stiffness: 380, mass: 0.85 };

function cloneTaskSnapshot(task: Task): Task {
  return {
    ...task,
    tags: [...task.tags],
    linkedNoteIds: [...task.linkedNoteIds],
    assigneeIds: task.assigneeIds ? [...task.assigneeIds] : undefined,
    exceptionDates: task.exceptionDates ? [...task.exceptionDates] : undefined,
  };
}

function taskRevertPatch(original: Task): Partial<Task> {
  return {
    title: original.title,
    description: original.description,
    dueDate: original.dueDate ?? null,
    assigneeIds: original.assigneeIds ? [...original.assigneeIds] : [],
    assignee: original.assignee,
    recurringRule: original.recurringRule ?? null,
    exceptionDates: original.exceptionDates,
  };
}

function taskHasUnsavedChanges(current: Task, original: Task | null): boolean {
  if (!original) return false;
  if (current.title !== original.title) return true;
  if (current.description !== original.description) return true;
  if ((current.dueDate ?? null) !== (original.dueDate ?? null)) return true;
  if ((current.recurringRule ?? null) !== (original.recurringRule ?? null)) return true;
  if ((current.assignee ?? "") !== (original.assignee ?? "")) return true;
  if (JSON.stringify(current.assigneeIds ?? []) !== JSON.stringify(original.assigneeIds ?? [])) {
    return true;
  }
  if (JSON.stringify(current.exceptionDates ?? []) !== JSON.stringify(original.exceptionDates ?? [])) {
    return true;
  }
  return false;
}

function isCommentAuthor(comment: Comment, currentUserId?: string | null) {
  const ownerId = currentUserId || "me";
  return comment.userId === ownerId;
}

function renderCommentContent(content: string) {
  return content.split(/(@\w+)/g).map((part: string, i: number) =>
    part.startsWith("@") ? (
      <span key={i} className="mention-pill">
        {part}
      </span>
    ) : (
      part
    ),
  );
}

function buildDueDateUpdates(dateStr: string | null | undefined): Partial<Task> {
  if (!dateStr) {
    return { dueDate: undefined, recurringRule: null, exceptionDates: undefined };
  }
  const [y, m, d] = dateStr.split("-").map(Number);
  const localDate = new Date(y, m - 1, d);
  return { dueDate: toDueDateStorage(localDate) };
}

function TaskMentionSuggestions({
  comment,
  members,
  currentUserId,
  onSelect,
}: {
  comment: string;
  members: WorkspaceMember[];
  currentUserId?: string | null;
  onSelect: (handle: string) => void;
}) {
  if (!comment.includes("@")) return null;

  const query = comment.split("@").pop() || "";
  if (!query.trim()) return null;

  const suggestions = members
    .filter((member) => memberMatchesMentionQuery(member, query, currentUserId ?? undefined))
    .slice(0, 6);

  if (suggestions.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {suggestions.map((member) => {
        const label = getMemberDisplayName(member, currentUserId ?? undefined);
        const handle = getMemberMentionHandle(member);
        return (
          <button
            key={member.userId}
            type="button"
            onClick={() => onSelect(handle)}
            className="mention-pill text-xs px-2.5 py-1 rounded-lg bg-[#c084fc]/10 text-[#c084fc] border border-[#c084fc]/30 hover:bg-[#c084fc]/25 min-h-[28px]"
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

function insertMention(comment: string, handle: string): string {
  const atIndex = comment.lastIndexOf("@");
  if (atIndex < 0) return `${comment}@${handle} `;
  return `${comment.slice(0, atIndex)}@${handle} `;
}

function TaskCommentCard({
  comment,
  currentUserId,
  isEditing,
  editDraft,
  isBusy,
  onEditDraftChange,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
  members = [],
  compact = false,
}: {
  comment: Comment;
  members?: WorkspaceMember[];
  currentUserId?: string | null;
  isEditing: boolean;
  editDraft: string;
  isBusy: boolean;
  onEditDraftChange: (value: string) => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onDelete: () => void;
  compact?: boolean;
}) {
  const canManage = isCommentAuthor(comment, currentUserId);
  const edited =
    comment.updatedAt &&
    new Date(comment.updatedAt).getTime() > new Date(comment.createdAt).getTime() + 1000;

  return (
    <div
      className={cn(
        "glass border border-white/10",
        compact ? "rounded-lg px-2 py-1.5 text-sm" : "rounded-xl p-3 text-sm",
      )}
    >
      <div
        className={cn(
          "flex items-center w-full min-w-0",
          compact ? "gap-1 mb-0.5" : "items-start justify-between gap-2 mb-1",
        )}
      >
        <div
          className={cn(
            "flex items-center text-[10px] text-[#a1a1aa] min-w-0",
            compact ? "flex-1 gap-1 overflow-hidden" : "flex-wrap gap-2",
          )}
        >
          <span className={cn("font-medium text-[#c084fc]", compact ? "truncate min-w-0" : undefined)}>
            {getCommentAuthorLabel(comment, members)}
          </span>
          <span className="shrink-0">•</span>
          <span className="shrink-0 tabular-nums whitespace-nowrap">
            {new Date(comment.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
          {edited && <span className="text-[#71717a] shrink-0">(edited)</span>}
        </div>
        {canManage && !isEditing && (
          <div className={cn("flex items-center shrink-0", compact ? "gap-0 ml-auto" : "gap-0.5")}>
            <button
              type="button"
              onClick={onStartEdit}
              disabled={isBusy}
              className={cn(
                "rounded-lg flex items-center justify-center text-[#a1a1aa] hover:text-[#c084fc] hover:bg-white/5 disabled:opacity-50",
                compact ? "h-7 w-7" : "h-8 w-8",
              )}
              aria-label="Edit comment"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={onDelete}
              disabled={isBusy}
              className={cn(
                "rounded-lg flex items-center justify-center text-[#a1a1aa] hover:text-red-400 hover:bg-red-500/10 disabled:opacity-50",
                compact ? "h-7 w-7" : "h-8 w-8",
              )}
              aria-label="Delete comment"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {isEditing ? (
        <div className="space-y-2">
          <textarea
            value={editDraft}
            onChange={(e) => onEditDraftChange(e.target.value)}
            className={cn(
              "w-full bg-[#111114] rounded-xl p-3 text-sm resize-y outline-none border border-white/10",
              compact ? "min-h-[72px]" : "min-h-[80px]",
            )}
            rows={compact ? 3 : 4}
            autoFocus
            disabled={isBusy}
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onSaveEdit}
              disabled={isBusy || !editDraft.trim()}
              className="btn btn-primary text-xs px-3 py-1.5 min-h-[36px] disabled:opacity-50 flex items-center gap-1"
            >
              {isBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
              Save
            </button>
            <button
              type="button"
              onClick={onCancelEdit}
              disabled={isBusy}
              className="btn btn-secondary text-xs px-3 py-1.5 min-h-[36px] disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div
          className={cn(
            "text-[#e4e4e7] whitespace-pre-wrap",
            compact ? "text-[13px] leading-snug" : "text-sm",
          )}
        >
          {renderCommentContent(comment.content)}
        </div>
      )}
    </div>
  );
}

function CollapsibleSection({
  title,
  icon: Icon,
  badge,
  defaultOpen = false,
  children,
}: {
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  badge?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  useEffect(() => {
    setOpen(defaultOpen);
  }, [defaultOpen]);

  return (
    <div className="rounded-xl border border-white/10 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-sm text-[#a1a1aa] hover:bg-white/5 active:bg-white/[0.07] transition min-h-[44px]"
        aria-expanded={open}
      >
        <div className="flex items-center gap-2 min-w-0">
          {Icon && <Icon className="h-4 w-4 shrink-0" />}
          <span className="font-medium">{title}</span>
          {badge && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-[#71717a] truncate max-w-[140px]">
              {badge}
            </span>
          )}
        </div>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-[#71717a] transition-transform", open && "rotate-180")} />
      </button>
      {open && <div className="px-3 pb-3 pt-1 border-t border-white/10">{children}</div>}
    </div>
  );
}

/** Self-contained, beautifully styled recurrence editor (extracted to satisfy strict TS + keep modal clean)
 *  Production (Agent 25): full end conditions (Never / After N / Until date + COUNT/UNTIL), YEARLY preset,
 *  raw RRULE editor, smooth local state for end conds, Linear/Notion quality.
 */
function RecurrenceEditor({
  localTask,
  save,
  compact = false,
}: {
  localTask: Task;
  save: (updates: Partial<Task>) => void;
  compact?: boolean;
}) {
  const currentLabel = getRecurringLabel(localTask.recurringRule);
  const currentPattern = parseRecurringRule(localTask.recurringRule);
  const upcoming = getUpcomingRecurrencesPreview(localTask.dueDate, localTask.recurringRule, 4, localTask.exceptionDates);
  const endDesc = getRecurrenceEndDescription(localTask.recurringRule);

  const hasRule = !!localTask.recurringRule;
  const freq = currentPattern?.freq ?? "WEEKLY";
  const interval = currentPattern?.interval ?? 1;
  const byDays = currentPattern?.byDay || [];
  const currentUntil = currentPattern?.until || "";
  const currentCount = currentPattern?.count || 0;

  // Local UI state for buttery end-condition controls (Never/After N/On date)
  const [endMode, setEndMode] = useState<"never" | "count" | "until">(
    currentCount > 0 ? "count" : currentUntil ? "until" : "never"
  );
  const [localCount, setLocalCount] = useState(currentCount || 10);
  const [localUntil, setLocalUntil] = useState(currentUntil ? `${currentUntil.slice(0,4)}-${currentUntil.slice(4,6)}-${currentUntil.slice(6,8)}` : "");

  // Keep local end state in sync when task/pattern changes externally
  useEffect(() => {
    const mode = currentCount > 0 ? "count" : currentUntil ? "until" : "never";
    setEndMode(mode);
    if (currentCount) setLocalCount(currentCount);
    if (currentUntil) setLocalUntil(`${currentUntil.slice(0,4)}-${currentUntil.slice(4,6)}-${currentUntil.slice(6,8)}`);
    else setLocalUntil("");
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
      const compact = d.replace(/-/g, "");
      newPat = { ...base, until: compact };
    } else {
      newPat = base; // never
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
    const newRule = generateRecurringRule(newPattern);
    save({ recurringRule: newRule });
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
      : getNextRecurringDue(localTask.recurringRule, new Date(), localTask.dueDate, localTask.exceptionDates);
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

  // Advanced raw RRULE editor state (power-user / custom rules not covered by UI)
  const [showRaw, setShowRaw] = useState(false);
  const [rawRule, setRawRule] = useState(localTask.recurringRule || "");

  const applyRawRule = () => {
    const trimmed = rawRule.trim().toUpperCase();
    if (!trimmed) {
      clearRecurrence();
    } else {
      const parsed = parseRecurringRule(trimmed);
      if (!parsed?.freq) {
        toast.error("Invalid recurrence rule", { description: "Must include a valid FREQ (DAILY, WEEKLY, etc.)." });
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
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#c084fc]/10 text-[#c084fc] text-xs font-medium border border-[#c084fc]/30">
              <Repeat className="h-3 w-3" /> {currentLabel}
            </span>
          ) : (
            <span className="text-xs text-[#71717a]">No recurrence</span>
          )}
          {localTask.recurringRule && (
            <button
              onClick={clearRecurrence}
              className="text-[10px] px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 text-[#a1a1aa] transition"
            >
              Clear
            </button>
          )}
        </div>
      )}

      {/* Presets */}
      <div className="flex flex-wrap gap-1.5">
        {(["DAILY", "WEEKLY", "MONTHLY", "YEARLY"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFreq(f)}
            className={cn(
              "text-xs px-3 py-1 rounded-full border transition",
              hasRule && freq === f
                ? "bg-[#c084fc] text-black border-[#c084fc]"
                : "border-white/10 hover:bg-white/5 text-[#a1a1aa]"
            )}
          >
            {f === "DAILY" ? "Daily" : f === "WEEKLY" ? "Weekly" : f === "MONTHLY" ? "Monthly" : "Yearly"}
          </button>
        ))}
        <button
          onClick={clearRecurrence}
          className={cn(
            "text-xs px-3 py-1 rounded-full border transition",
            !hasRule
              ? "bg-[#c084fc] text-black border-[#c084fc]"
              : "border-white/10 hover:bg-white/5 text-[#71717a]"
          )}
        >
          None
        </button>
      </div>

      {localTask.recurringRule && (
        <>
      {/* Interval — only when a rule is active (prevents accidental re-apply after clear) */}
      <div className="flex items-center gap-2 text-xs">
        <span className="text-[#71717a]">Every</span>
        <input
          type="number"
          min={1}
          max={99}
          value={interval}
          onChange={(e) => setIntervalVal(parseInt(e.target.value))}
          className="input w-14 px-2 py-1 rounded text-center text-sm"
        />
        <span className="text-[#71717a]">{freq.toLowerCase()}{interval > 1 ? "s" : ""}</span>
      </div>

      {/* Weekly day picker */}
      {freq === "WEEKLY" && (
        <div className="flex flex-wrap gap-1">
          {weekDays.map((day, i) => (
            <button
              key={day}
              onClick={() => toggleDay(day)}
              className={cn(
                "text-[10px] px-2 py-0.5 rounded-full border transition min-w-[34px]",
                byDays.includes(day)
                  ? "bg-[#c084fc] text-black border-[#c084fc]"
                  : "border-white/10 hover:bg-white/5 text-[#a1a1aa]"
              )}
            >
              {weekLabels[i]}
            </button>
          ))}
        </div>
      )}

      {/* Production End Conditions UI: Never / After N / On date (drives COUNT or UNTIL) */}
        <div className="pt-1 space-y-2 border-t border-white/10">
          <div className="text-[10px] text-[#71717a] flex items-center gap-1.5">
            <span>Ends</span>
            <div className="inline-flex rounded-full border border-white/10 overflow-hidden text-[10px]">
              {(["never", "count", "until"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => { setEndMode(m); applyEndCondition(m); }}
                  className={cn(
                    "px-2.5 py-0.5 transition",
                    endMode === m ? "bg-[#c084fc] text-black" : "hover:bg-white/5 text-[#a1a1aa]"
                  )}
                >
                  {m === "never" ? "Never" : m === "count" ? "After N" : "On date"}
                </button>
              ))}
            </div>
          </div>

          {endMode === "count" && (
            <div className="flex items-center gap-2 text-xs pl-1">
              <input
                type="number"
                min={1}
                max={365}
                value={localCount}
                onChange={(e) => { const v = parseInt(e.target.value)||1; setLocalCount(v); applyEndCondition("count", v); }}
                className="input w-16 px-2 py-0.5 rounded text-center text-sm"
              />
              <span className="text-[#71717a]">occurrences</span>
              <button onClick={() => { setEndMode("never"); applyEndCondition("never"); }} className="text-[10px] text-[#a1a1aa] underline">or never</button>
            </div>
          )}

          {endMode === "until" && (
            <div className="flex items-center gap-2 text-xs pl-1">
              <DateTimePicker
                value={localUntil}
                onChange={(dateStr) => {
                  setLocalUntil(dateStr || '');
                  applyEndCondition("until", undefined, dateStr || '');
                }}
                className="flex-1"
              />
              <button onClick={() => { setEndMode("never"); applyEndCondition("never"); }} className="text-[10px] text-[#a1a1aa] underline">Never</button>
            </div>
          )}

          {endMode === "never" && !compact && (
            <div className="text-[10px] text-[#a1a1aa] pl-1">Open-ended series (continues forever)</div>
          )}
        </div>

        </>
      )}

      {localTask.recurringRule && upcoming.length > 0 && (
        <div className="text-[10px] text-[#71717a] pt-1">
          Next: {upcoming.join(" • ")}
        </div>
      )}
      {!compact && localTask.recurringRule && (
        <div className="text-[9px] text-[#71717a] flex items-center gap-2">
          <span className="font-mono opacity-70">{localTask.recurringRule}</span>
          <button
            onClick={() => { setRawRule(localTask.recurringRule || ""); setShowRaw(!showRaw); }}
            className="text-[9px] underline hover:text-[#c084fc]"
            title="Edit raw RRULE (advanced / custom)"
          >
            edit raw
          </button>
        </div>
      )}
      {!compact && showRaw && (
        <div className="space-y-1">
          <input
            value={rawRule}
            onChange={(e) => setRawRule(e.target.value)}
            className="input w-full px-2 py-1 font-mono text-xs"
            placeholder="FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE;COUNT=12"
          />
          <div className="flex gap-2">
            <button onClick={applyRawRule} className="text-[10px] px-2 py-0.5 bg-[#c084fc]/20 text-[#c084fc] rounded">Apply RRULE</button>
            <button onClick={() => setShowRaw(false)} className="text-[10px] px-2 py-0.5 bg-white/5 rounded">Cancel</button>
          </div>
          <div className="text-[9px] text-[#a1a1aa]">Full RRULE strings supported (engine handles parse/generate + COUNT/UNTIL/exceptions).</div>
        </div>
      )}

      {/* Exceptions / Skipped + quick actions — polished */}
      {localTask.recurringRule && (
        <div className="pt-2 border-t border-white/10 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleSkipOccurrence}
              className="text-[10px] px-2 py-0.5 rounded bg-[#c084fc]/10 hover:bg-[#c084fc]/20 text-[#c084fc] border border-[#c084fc]/30 transition"
              title="Skip the current overdue occurrence or the next future one"
            >
              {localTask.dueDate && isDueDatePast(localTask.dueDate)
                ? "Skip this occurrence"
                : "Skip next occurrence"}
            </button>
            <span className="text-[9px] text-[#71717a]">{endDesc}</span>
          </div>

          {localTask.exceptionDates && localTask.exceptionDates.length > 0 && (
            <div>
              <div className="text-[10px] text-[#a1a1aa] mb-1">Skipped dates (tap to restore):</div>
              <div className="flex flex-wrap gap-1">
                {localTask.exceptionDates.map((exDate, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      const nextEx = (localTask.exceptionDates || []).filter((_, i) => i !== idx);
                      save({ exceptionDates: nextEx.length ? nextEx : undefined });
                    }}
                    className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/10 text-[#a1a1aa] border border-white/10"
                    title="Click to un-skip this occurrence"
                  >
                    {exDate.slice(0, 10)} ✕
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function TaskModal({ task, isOpen, onClose, workspaceDeepLink }: TaskModalProps) {
  const { 
    updateTask, deleteTask, taskLoadingStates, 
    comments, isLoadingComments, fetchComments, addComment, updateComment, deleteComment, markTaskCommentsRead, addTask,
    activeConflicts, resolveConflict, members,
    liveEditing, broadcastLiveTaskEdit, user,
  } = useTaskStore();
  const [localTask, setLocalTask] = useState(task);
  const [newComment, setNewComment] = useState("");
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentDraft, setEditingCommentDraft] = useState("");
  const [commentActionId, setCommentActionId] = useState<string | null>(null);
  const [pendingDeleteCommentId, setPendingDeleteCommentId] = useState<string | null>(null);

  // Live collab: debounce refs for broadcasting while typing (lightweight, no extra deps)
  const liveBroadcastTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastBroadcastRef = useRef<{ title?: string; description?: string }>({});

  // Mobile bottom sheet detection + drag state (additive, only affects <768px)
  const [mounted] = useState(() => typeof window !== "undefined");
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.innerWidth < 768,
  );
  const [dragY, setDragY] = useState(0);
  const dragControls = useDragControls();
  const mobileTitleRef = useRef<HTMLTextAreaElement>(null);
  const openedTaskSnapshotRef = useRef<Task | null>(null);
  const prevIsOpenRef = useRef(false);

  const resizeMobileTitle = useCallback(() => {
    const el = mobileTitleRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  // State for the modern delete confirmation modal (house-cleaning item)
  const [pendingDeleteTask, setPendingDeleteTask] = useState(false);
  const [showUnsavedConfirm, setShowUnsavedConfirm] = useState(false);

  // Debounced live broadcast helper (250ms feels very live without spamming)
  const scheduleLiveBroadcast = (updates: { title?: string; description?: string }) => {
    if (!broadcastLiveTaskEdit) return;

    // Merge with last known values so we always send a coherent snapshot
    const next = {
      title: updates.title ?? lastBroadcastRef.current.title,
      description: updates.description ?? lastBroadcastRef.current.description,
    };
    lastBroadcastRef.current = next;

    if (liveBroadcastTimeoutRef.current) {
      clearTimeout(liveBroadcastTimeoutRef.current);
    }

    liveBroadcastTimeoutRef.current = setTimeout(() => {
      broadcastLiveTaskEdit(task.id, next);
    }, 250);
  };

  useEffect(() => {
    const checkMobile = () => setIsMobile(typeof window !== 'undefined' && window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Haptic on open for native confirmation feel (mobile)
  useEffect(() => {
    if (isOpen && isMobile) {
      triggerHaptic('light');
    }
  }, [isOpen, isMobile]);

  useScrollLock(isOpen);

  // Cleanup any pending live broadcast debounce when modal closes
  useEffect(() => {
    if (!isOpen) {
      if (liveBroadcastTimeoutRef.current) {
        clearTimeout(liveBroadcastTimeoutRef.current);
        liveBroadcastTimeoutRef.current = null;
      }
      lastBroadcastRef.current = {};
      setEditingCommentId(null);
      setEditingCommentDraft("");
      setCommentActionId(null);
      setPendingDeleteCommentId(null);
      setShowUnsavedConfirm(false);
    }
  }, [isOpen]);

  // Agent 14: fetch comments realtime-backed when modal opens for task (optimistic + live via hybrid)
  useEffect(() => {
    if (isOpen && task?.id) {
      void fetchComments({ taskId: task.id }).then(() => {
        markTaskCommentsRead(task.id);
      });
    }
  }, [isOpen, task?.id, fetchComments, markTaskCommentsRead]);

  // Snapshot task when the drawer opens so Cancel can revert edits
  useEffect(() => {
    if (!isOpen) {
      openedTaskSnapshotRef.current = null;
      prevIsOpenRef.current = false;
      return;
    }

    const justOpened = !prevIsOpenRef.current;
    const switchedTask = openedTaskSnapshotRef.current?.id !== task.id;
    if (justOpened || switchedTask) {
      openedTaskSnapshotRef.current = cloneTaskSnapshot(task);
      setLocalTask(task);
    }
    prevIsOpenRef.current = isOpen;
  }, [isOpen, task, task.id]);

  useEffect(() => {
    if (!isOpen || !isMobile) return;
    requestAnimationFrame(resizeMobileTitle);
  }, [isOpen, isMobile, localTask.title, resizeMobileTitle]);

  const taskComments = [...comments]
    .filter((c: { taskId?: string }) => c.taskId === task.id)
    .sort(
      (a: { createdAt: string }, b: { createdAt: string }) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

  const startEditingComment = (comment: Comment) => {
    setEditingCommentId(comment.id);
    setEditingCommentDraft(comment.content);
  };

  const cancelEditingComment = () => {
    setEditingCommentId(null);
    setEditingCommentDraft("");
  };

  const saveEditingComment = async () => {
    if (!editingCommentId || !editingCommentDraft.trim()) return;
    setCommentActionId(editingCommentId);
    const ok = await updateComment(editingCommentId, editingCommentDraft);
    setCommentActionId(null);
    if (ok) cancelEditingComment();
  };

  const requestDeleteComment = (commentId: string) => {
    triggerHaptic("light");
    setPendingDeleteCommentId(commentId);
  };

  const handleConfirmDeleteComment = async () => {
    if (!pendingDeleteCommentId) return;
    triggerHaptic("error");
    setCommentActionId(pendingDeleteCommentId);
    const ok = await deleteComment(pendingDeleteCommentId);
    setCommentActionId(null);
    if (ok) {
      if (editingCommentId === pendingDeleteCommentId) cancelEditingComment();
      setPendingDeleteCommentId(null);
    }
  };

  const pendingDeleteComment = pendingDeleteCommentId
    ? taskComments.find((c) => c.id === pendingDeleteCommentId)
    : null;

  const pendingDeleteCommentPreview = pendingDeleteComment
    ? pendingDeleteComment.content.replace(/\s+/g, " ").trim().slice(0, 120) +
      (pendingDeleteComment.content.trim().length > 120 ? "…" : "")
    : undefined;

  const save = async (updates: Partial<Task>) => {
    triggerHaptic('light');
    const normalized = applyTaskUpdateSideEffects(updates);
    if (
      Object.prototype.hasOwnProperty.call(normalized, "recurringRule") &&
      (normalized.recurringRule === null || normalized.recurringRule === undefined)
    ) {
      normalized.recurringRule = null;
      if (!Object.prototype.hasOwnProperty.call(normalized, "exceptionDates")) {
        normalized.exceptionDates = undefined;
      }
    }
    const newTask = { ...localTask, ...normalized };
    if (
      Object.prototype.hasOwnProperty.call(normalized, "dueDate") &&
      (normalized.dueDate === undefined || normalized.dueDate === null)
    ) {
      delete (newTask as Task).dueDate;
    }
    if (normalized.recurringRule === null) {
      delete (newTask as Task).recurringRule;
      if (normalized.exceptionDates === undefined) {
        delete (newTask as Task).exceptionDates;
      }
    }
    if (
      Object.prototype.hasOwnProperty.call(normalized, "completedAt") &&
      (normalized.completedAt === undefined || normalized.completedAt === null)
    ) {
      delete (newTask as Task).completedAt;
    }
    if (newTask.status !== "done") {
      delete (newTask as Task).completedAt;
    }
    setLocalTask(newTask);
    await updateTask(task.id, normalized);
    openedTaskSnapshotRef.current = cloneTaskSnapshot(newTask);

    // Live collab: broadcast the change so others see it in near real-time (debounced)
    scheduleLiveBroadcast(updates);
  };

  const handleDelete = async () => {
    triggerHaptic('error');
    setPendingDeleteTask(true); // Use modern modal
  };

  const handleConfirmDeleteTask = async () => {
    await deleteTask(task.id);
    setPendingDeleteTask(false);
    onClose();
  };

  const clearPendingLiveBroadcast = useCallback(() => {
    if (liveBroadcastTimeoutRef.current) {
      clearTimeout(liveBroadcastTimeoutRef.current);
      liveBroadcastTimeoutRef.current = null;
    }
    lastBroadcastRef.current = {};
  }, []);

  // Mobile: keep edits and close
  const handleSheetClose = useCallback(() => {
    triggerHaptic('light');
    if (liveBroadcastTimeoutRef.current) {
      clearTimeout(liveBroadcastTimeoutRef.current);
      liveBroadcastTimeoutRef.current = null;
      if (broadcastLiveTaskEdit && lastBroadcastRef.current) {
        broadcastLiveTaskEdit(task.id, lastBroadcastRef.current);
      }
    }
    lastBroadcastRef.current = {};
    onClose();
  }, [onClose, broadcastLiveTaskEdit, task.id]);

  // Revert all edits made this session and close
  const handleCancel = useCallback(async () => {
    triggerHaptic('light');
    clearPendingLiveBroadcast();
    setShowUnsavedConfirm(false);

    const original = openedTaskSnapshotRef.current;
    if (original) {
      setLocalTask(original);
      await updateTask(task.id, taskRevertPatch(original));
    }
    onClose();
  }, [clearPendingLiveBroadcast, onClose, task.id, updateTask]);

  const handleDismissWithoutChanges = useCallback(() => {
    triggerHaptic("light");
    clearPendingLiveBroadcast();
    setShowUnsavedConfirm(false);
    onClose();
  }, [clearPendingLiveBroadcast, onClose]);

  const requestDismiss = useCallback(() => {
    if (taskHasUnsavedChanges(localTask, openedTaskSnapshotRef.current)) {
      triggerHaptic("light");
      setShowUnsavedConfirm(true);
      return;
    }
    handleDismissWithoutChanges();
  }, [handleDismissWithoutChanges, localTask]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopImmediatePropagation();
      if (showUnsavedConfirm) {
        setShowUnsavedConfirm(false);
        return;
      }
      requestDismiss();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, requestDismiss, showUnsavedConfirm]);

  const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.y > 120 || info.velocity.y > 600) {
      setDragY(0);
      requestDismiss();
    } else {
      setDragY(0);
    }
  };

  const startSheetDrag = (e: React.PointerEvent) => {
    dragControls.start(e);
  };

  if (!mounted) return null;

  return createPortal(
    <>
      <AnimatePresence onExitComplete={() => setDragY(0)}>
      {isOpen && (
      <div
        className={cn(
          "fixed inset-0 z-[200]",
          isMobile ? "flex flex-col justify-end" : "flex items-center justify-center p-4"
        )}
      >
        <motion.div
          key="task-sheet-backdrop"
          className={cn("absolute inset-0", isMobile ? "sheet-backdrop" : "bg-black/70")}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          onClick={() => requestDismiss()}
          aria-hidden="true"
        />
        <motion.div
          key="task-sheet-panel"
          className={cn(
            "glass w-full overflow-hidden flex flex-col",
            isMobile
              ? "task-drawer-sheet mobile-bottom-sheet relative flex flex-col h-[92dvh] max-h-[92dvh] rounded-t-3xl max-w-none"
              : "relative max-w-3xl max-h-[min(88vh,760px)] rounded-2xl"
          )}
          onClick={e => e.stopPropagation()}
          drag={isMobile ? "y" : false}
          dragControls={dragControls}
          dragListener={false}
          dragConstraints={{ top: 0, bottom: 500 }}
          dragElastic={{ top: 0, bottom: 0.2 }}
          onDragEnd={isMobile ? handleDragEnd : undefined}
          onDrag={(_e, info) => { if (isMobile) setDragY(Math.max(0, info.offset.y)); }}
          initial={isMobile ? { y: "100%" } : { scale: 0.96, opacity: 0 }}
          animate={isMobile ? { y: dragY } : { scale: 1, opacity: 1 }}
          exit={isMobile ? { y: "100%" } : { scale: 0.96, opacity: 0 }}
          transition={SHEET_SPRING}
          role="dialog"
          aria-modal="true"
          aria-label={`Task: ${localTask.title}`}
        >
          {isMobile && (
            <div
              className="sheet-drag-handle shrink-0 touch-none cursor-grab active:cursor-grabbing"
              onPointerDown={startSheetDrag}
              aria-hidden="true"
            />
          )}

          {/* Header — Cancel reverts; Save and Close keeps edits */}
          <div
            className={cn(
              "shrink-0 flex items-center border-b border-white/10 w-full",
              isMobile ? "task-sheet-header px-4 py-3 gap-2" : "px-5 py-3 gap-2",
            )}
          >
            <div className="flex items-center justify-between gap-3 w-full">
              <button
                type="button"
                onClick={() => requestDismiss()}
                disabled={!!taskLoadingStates?.[task.id]}
                className="text-sm font-medium text-[#a1a1aa] hover:text-white min-h-[44px] px-1 disabled:opacity-50 active:scale-[0.98] transition"
                aria-label="Cancel changes"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSheetClose}
                disabled={!!taskLoadingStates?.[task.id]}
                className="btn btn-primary text-sm px-4 py-2 min-h-[44px] disabled:opacity-60 flex items-center gap-1.5 active:scale-[0.98]"
                aria-label="Save and close task"
              >
                {taskLoadingStates?.[task.id] ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : null}
                Save and Close
              </button>
            </div>
          </div>

        <div className="task-sheet-scroll flex-1 min-h-0 overflow-y-auto overscroll-contain">
        {isMobile ? (
        <div className="task-sheet-body p-4 space-y-4">
          {workspaceDeepLink && (
            <WorkspaceItemDeepLink
              workspaceName={workspaceDeepLink.workspaceName}
              destination="Tasks"
              onNavigate={workspaceDeepLink.onNavigate}
              className="inline-flex items-center gap-1.5 text-xs text-[#c084fc] hover:text-[#d8b4fe] transition w-full text-left group"
            />
          )}

          <textarea
            ref={mobileTitleRef}
            value={localTask.title}
            onChange={(e) => {
              const title = e.target.value.replace(/\r?\n/g, " ");
              save({ title });
              e.target.style.height = "auto";
              e.target.style.height = `${e.target.scrollHeight}px`;
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.preventDefault();
            }}
            rows={1}
            className="w-full bg-transparent text-xl font-semibold tracking-tight outline-none resize-none overflow-hidden leading-snug"
          />

          {liveEditing?.[localTask.id] && liveEditing[localTask.id].userId !== (user?.id || "me") && (
            <div className="text-[10px] text-emerald-400/80 flex items-center gap-1.5 -mt-2">
              <span className="inline-block w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
              {liveEditing[localTask.id].email?.split("@")[0] || "Someone"} is typing…
            </div>
          )}

          {activeConflicts && activeConflicts[localTask.id] && (
            <div className="glass px-3 py-2 rounded-xl border border-amber-500/40 text-amber-400 text-xs flex flex-wrap items-center gap-2">
              <span>Conflict with {activeConflicts[localTask.id].remoteUser || "teammate"}</span>
              <button onClick={() => resolveConflict(localTask.id, false)} className="px-2 py-0.5 bg-white/10 rounded text-[10px]">Theirs</button>
              <button onClick={() => resolveConflict(localTask.id, true)} className="px-2 py-0.5 bg-white/10 rounded text-[10px]">Mine</button>
            </div>
          )}

          <textarea
            value={localTask.description}
            onChange={(e) => save({ description: e.target.value })}
            placeholder="Add notes…"
            className="w-full min-h-[64px] max-h-[120px] bg-[#111114] rounded-xl p-3 text-sm resize-y outline-none border border-white/10"
            rows={2}
          />

          <div className="grid grid-cols-1 gap-3">
            <DateTimePicker
              label="Due date"
              value={localTask.dueDate}
              onChange={(dateStr) => save(buildDueDateUpdates(dateStr))}
              className="w-full"
            />
            {localTask.dueDate && (
              <CollapsibleSection
                title="Recurrence"
                icon={Repeat}
                badge={getRecurringLabel(localTask.recurringRule) || "None"}
                defaultOpen={!!localTask.recurringRule}
              >
                <RecurrenceEditor localTask={localTask} save={save} compact />
              </CollapsibleSection>
            )}
            <TaskAssigneePicker
              members={members || []}
              currentUserId={user?.id}
              value={localTask.assigneeIds?.[0] ?? null}
              onChange={(userId) => {
                const assigneeIds = userId ? [userId] : [];
                const assignee = resolveAssigneeLabel(assigneeIds, members || [], user?.id);
                save({ assigneeIds, assignee });
              }}
              compact
            />
          </div>

          <CollapsibleSection
            title="Comments"
            icon={MessageSquare}
            badge={String(taskComments.length)}
            defaultOpen={taskComments.length > 0}
          >
            <div className="space-y-2 min-w-0">
              <div className="space-y-1.5 max-h-40 overflow-y-auto overflow-x-hidden pr-1">
                {taskComments.length === 0 ? (
                  <div className="text-xs text-[#71717a]">No comments yet.</div>
                ) : (
                  taskComments.map((c) => (
                    <TaskCommentCard
                      key={c.id}
                      comment={c}
                      members={members || []}
                      currentUserId={user?.id}
                      isEditing={editingCommentId === c.id}
                      editDraft={editingCommentId === c.id ? editingCommentDraft : c.content}
                      isBusy={commentActionId === c.id}
                      onEditDraftChange={setEditingCommentDraft}
                      onStartEdit={() => startEditingComment(c)}
                      onCancelEdit={cancelEditingComment}
                      onSaveEdit={() => void saveEditingComment()}
                      onDelete={() => requestDeleteComment(c.id)}
                      compact
                    />
                  ))
                )}
              </div>

              <div className="flex flex-col gap-1.5 min-w-0">
                <input
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      if (newComment.trim()) {
                        addComment(newComment, { taskId: task.id });
                        setNewComment("");
                      }
                    }
                  }}
                  placeholder="Add a comment…"
                  className="input w-full min-w-0 text-sm px-3 py-2 rounded-xl"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (newComment.trim()) {
                      addComment(newComment, { taskId: task.id });
                      setNewComment("");
                    }
                  }}
                  className={cn(
                    "btn w-full min-h-[44px] text-sm px-4 py-2 rounded-xl transition-all duration-150",
                    newComment.trim()
                      ? "btn-primary shadow-[0_0_14px_rgba(192,132,252,0.4)]"
                      : "btn-secondary opacity-45",
                  )}
                  disabled={!newComment.trim() || isLoadingComments}
                >
                  Post comment
                </button>
              </div>

              <TaskMentionSuggestions
                comment={newComment}
                members={members || []}
                currentUserId={user?.id}
                onSelect={(handle) => setNewComment(insertMention(newComment, handle))}
              />
            </div>
          </CollapsibleSection>

          <div className="text-[10px] text-[#71717a] pt-1">
            Created {safeFormatTimestampIso(localTask.createdAt, "MMM d, yyyy", "—")}
            {localTask.status === "done" && localTask.completedAt && (
              <span> · Completed {safeFormatTimestampIso(localTask.completedAt, "MMM d, yyyy", "—")}</span>
            )}
          </div>

          <button
            type="button"
            onClick={handleDelete}
            disabled={!!taskLoadingStates?.[task.id]}
            className={cn(
              "w-full min-h-[50px] rounded-xl text-sm font-semibold tracking-tight",
              "text-white bg-gradient-to-r from-[#9f1239] via-[#be123c] to-[#e11d48]",
              "border border-[#fb7185]/35 shadow-[0_8px_24px_rgba(190,18,57,0.28)]",
              "hover:from-[#881337] hover:via-[#9f1239] hover:to-[#be123c]",
              "active:scale-[0.98] transition disabled:opacity-50 disabled:active:scale-100",
            )}
            aria-label="Delete task"
          >
            Delete
          </button>
        </div>
        ) : (
        <div className="p-5 flex flex-col gap-5 min-h-0">
          <div className="flex flex-col lg:flex-row gap-5 min-h-0">
          <div className="flex-1 min-w-0 space-y-4">
            <input
              value={localTask.title}
              onChange={(e) => save({ title: e.target.value })}
              onFocus={(e) => e.currentTarget.select()}
              className={cn(
                "w-full min-w-0 bg-transparent text-2xl font-semibold tracking-tight outline-none",
                localTask.status === "done" && "line-through text-[#71717a]",
              )}
              aria-label="Task title"
            />

            {liveEditing?.[localTask.id] && liveEditing[localTask.id].userId !== (user?.id || "me") && (
              <div className="text-[10px] text-emerald-400/80 flex items-center gap-1.5 -mt-2">
                <span className="inline-block w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                {liveEditing[localTask.id].email?.split("@")[0] || "Someone"} is typing…
              </div>
            )}

            {activeConflicts && activeConflicts[localTask.id] && (
              <div className="glass px-3 py-2 rounded-xl border border-amber-500/40 text-amber-400 text-xs flex flex-wrap items-center gap-2">
                <span>Edited by {activeConflicts[localTask.id].remoteUser || "teammate"}</span>
                <button onClick={() => resolveConflict(localTask.id, false)} className="px-2 py-0.5 bg-white/10 rounded text-[10px]">Theirs</button>
                <button onClick={() => resolveConflict(localTask.id, true)} className="px-2 py-0.5 bg-white/10 rounded text-[10px]">Mine</button>
              </div>
            )}

            <textarea
              value={localTask.description}
              onChange={(e) => save({ description: e.target.value })}
              placeholder="Add notes…"
              className="w-full min-h-[64px] max-h-[120px] bg-[#111114] rounded-xl p-3 text-sm resize-y outline-none border border-white/10"
              rows={2}
            />

            <div className="pt-3 border-t border-white/10 space-y-2">
              <div className="flex items-center gap-2 text-xs font-medium text-[#a1a1aa]">
                <MessageSquare className="h-3.5 w-3.5" />
                Comments
                {isLoadingComments ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <span className="text-[#71717a]">({taskComments.length})</span>
                )}
              </div>

              <div className="space-y-2 max-h-44 overflow-auto pr-1">
                {taskComments.length === 0 ? (
                  <div className="text-xs text-[#71717a]">No comments yet.</div>
                ) : (
                  taskComments.map((c) => (
                    <TaskCommentCard
                      key={c.id}
                      comment={c}
                      members={members || []}
                      currentUserId={user?.id}
                      isEditing={editingCommentId === c.id}
                      editDraft={editingCommentId === c.id ? editingCommentDraft : c.content}
                      isBusy={commentActionId === c.id}
                      onEditDraftChange={setEditingCommentDraft}
                      onStartEdit={() => startEditingComment(c)}
                      onCancelEdit={cancelEditingComment}
                      onSaveEdit={() => void saveEditingComment()}
                      onDelete={() => requestDeleteComment(c.id)}
                      compact
                    />
                  ))
                )}
              </div>

              <div className="flex gap-2">
                <input
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      if (newComment.trim()) {
                        addComment(newComment, { taskId: task.id });
                        setNewComment("");
                      }
                    }
                  }}
                  placeholder="Write a comment…"
                  className="input flex-1 text-sm px-3 py-2 rounded-xl min-h-[40px]"
                />
                <button
                  onClick={() => {
                    if (newComment.trim()) {
                      addComment(newComment, { taskId: task.id });
                      setNewComment("");
                    }
                  }}
                  className="btn btn-secondary px-3 text-sm shrink-0"
                  disabled={!newComment.trim() || isLoadingComments}
                >
                  Post
                </button>
              </div>

              <TaskMentionSuggestions
                comment={newComment}
                members={members || []}
                currentUserId={user?.id}
                onSelect={(handle) => setNewComment(insertMention(newComment, handle))}
              />
            </div>
          </div>

          <div className="lg:w-52 shrink-0 space-y-3 text-sm lg:border-l lg:border-white/10 lg:pl-5">
            {workspaceDeepLink && (
              <WorkspaceItemDeepLink
                workspaceName={workspaceDeepLink.workspaceName}
                destination="Tasks"
                onNavigate={workspaceDeepLink.onNavigate}
                className="inline-flex items-center gap-1.5 text-xs text-[#c084fc] hover:text-[#d8b4fe] transition w-full text-left group"
              />
            )}

            <DateTimePicker
              label="Due date"
              value={localTask.dueDate}
              onChange={(dateStr) => save(buildDueDateUpdates(dateStr))}
              className="w-full"
            />

            {localTask.dueDate && (
              <CollapsibleSection
                title="Repeat"
                icon={Repeat}
                badge={getRecurringLabel(localTask.recurringRule) || "None"}
                defaultOpen={false}
              >
                <RecurrenceEditor localTask={localTask} save={save} compact />
              </CollapsibleSection>
            )}

            <TaskAssigneePicker
              members={members || []}
              currentUserId={user?.id}
              value={localTask.assigneeIds?.[0] ?? null}
              onChange={(userId) => {
                const assigneeIds = userId ? [userId] : [];
                const assignee = resolveAssigneeLabel(assigneeIds, members || [], user?.id);
                save({ assigneeIds, assignee });
              }}
              compact
            />

            <div className="pt-3 border-t border-white/10 text-[11px] text-[#71717a] leading-relaxed">
              Created {safeFormatTimestampIso(localTask.createdAt, "MMM d, yyyy", "—")}
              {localTask.status === "done" && localTask.completedAt && (
                <div>Completed {safeFormatTimestampIso(localTask.completedAt, "MMM d, yyyy", "—")}</div>
              )}
            </div>
          </div>
          </div>

          <button
            type="button"
            onClick={handleDelete}
            disabled={!!taskLoadingStates?.[task.id]}
            className={cn(
              "w-full min-h-[50px] rounded-xl text-sm font-semibold tracking-tight",
              "text-white bg-gradient-to-r from-[#9f1239] via-[#be123c] to-[#e11d48]",
              "border border-[#fb7185]/35 shadow-[0_8px_24px_rgba(190,18,57,0.28)]",
              "hover:from-[#881337] hover:via-[#9f1239] hover:to-[#be123c]",
              "active:scale-[0.98] transition disabled:opacity-50 disabled:active:scale-100",
            )}
            aria-label="Delete task"
          >
            Delete
          </button>
        </div>
        )}
        </div>
        {/* Close motion sheet + backdrop + AnimatePresence (mobile sheet structure) */}
      </motion.div>
    </div>
      )}
    </AnimatePresence>

    {showUnsavedConfirm && (
      <div className="fixed inset-0 z-[250] flex items-end md:items-center justify-center p-0 md:p-4">
        <div
          className="absolute inset-0 bg-black/60 backdrop-blur-[3px]"
          onClick={() => setShowUnsavedConfirm(false)}
          aria-hidden
        />
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="task-unsaved-title"
          aria-describedby="task-unsaved-desc"
          className={cn(
            "relative w-full max-w-md bg-[#0f0f12] border border-white/10 shadow-2xl",
            "rounded-t-2xl md:rounded-2xl",
            "pb-[max(1rem,env(safe-area-inset-bottom))] md:pb-0",
            "animate-in fade-in slide-in-from-bottom-4 md:zoom-in-95 duration-200",
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-center pt-2.5 md:hidden">
            <div className="h-1 w-10 rounded-full bg-white/20" aria-hidden />
          </div>
          <div className="p-5 pb-4">
            <h3 id="task-unsaved-title" className="text-lg font-semibold text-white tracking-tight">
              Save changes?
            </h3>
            <div id="task-unsaved-desc" className="mt-2 space-y-1.5">
              <p className="text-sm font-medium text-[#f4f4f5] truncate">
                &ldquo;{localTask.title}&rdquo;
              </p>
              <p className="text-sm text-[#a1a1aa] leading-relaxed">
                You have unsaved changes. Save them before closing, or discard your edits.
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-2.5 px-5 pb-5">
            <button
              type="button"
              onClick={() => setShowUnsavedConfirm(false)}
              className="w-full min-h-[44px] rounded-xl border border-white/10 px-4 py-2.5 text-sm font-medium text-[#e4e4e7] hover:bg-white/5 transition"
            >
              Keep editing
            </button>
            <div className="flex flex-col-reverse md:flex-row gap-2.5">
              <button
                type="button"
                onClick={() => void handleCancel()}
                disabled={!!taskLoadingStates?.[task.id]}
                className="flex-1 min-h-[44px] rounded-xl border border-[#fb7185]/35 px-4 py-2.5 text-sm font-semibold text-[#fda4af] hover:bg-[#be123c]/15 disabled:opacity-50 transition"
              >
                Discard changes
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowUnsavedConfirm(false);
                  handleSheetClose();
                }}
                disabled={!!taskLoadingStates?.[task.id]}
                className="flex-1 min-h-[44px] rounded-xl bg-[#c084fc] hover:bg-[#a855f7] px-4 py-2.5 text-sm font-semibold text-black disabled:opacity-50 transition"
              >
                Save and close
              </button>
            </div>
          </div>
        </div>
      </div>
    )}

    {/* Modern confirmation modal (replaces raw confirm for task delete) */}
    <ConfirmationModal
      open={pendingDeleteTask}
      onOpenChange={setPendingDeleteTask}
      title={localTask.recurringRule ? "Delete recurring series?" : "Delete this task?"}
      highlight={localTask.title}
      description={
        localTask.recurringRule
          ? "This permanently deletes the entire recurring series and all future occurrences. Comments and links are also removed. This cannot be undone."
          : "The task, its comments, and any links will be permanently removed. This cannot be undone."
      }
      confirmText={localTask.recurringRule ? "Delete series" : "Delete task"}
      cancelText="Cancel"
      variant="destructive"
      onConfirm={handleConfirmDeleteTask}
    />

    <ConfirmationModal
      open={!!pendingDeleteCommentId}
      onOpenChange={(open) => {
        if (!open) setPendingDeleteCommentId(null);
      }}
      title="Delete this comment?"
      highlight={pendingDeleteCommentPreview}
      description="This comment will be permanently removed from the task. This cannot be undone."
      confirmText="Delete comment"
      cancelText="Keep comment"
      variant="destructive"
      onConfirm={handleConfirmDeleteComment}
      isLoading={!!pendingDeleteCommentId && commentActionId === pendingDeleteCommentId}
    />
  </>,
    document.body,
  );
}
