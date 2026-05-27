"use client";

import { useState, useEffect, useRef } from "react";
import { X, Calendar, Clock, Tag, User, Link2, MessageSquare, Trash2, Loader2, Repeat, Zap } from "lucide-react";
import { DateTimePicker } from "./DateTimePicker";
import { ConfirmationModal } from "./ConfirmationModal";
import { format } from "date-fns";
import { toast } from "sonner";
import { motion, AnimatePresence, PanInfo } from "framer-motion";
import { useTaskStore } from "@/store/useTaskStore";
import type { Task, Priority } from "@/types";
import { getContextualAISuggestion, triggerHaptic, generateSubtaskDecomposition, generateSubtaskDecompositionAI, isXAIConfigured } from "@/lib/utils";
import {
  cn,
  getRecurringLabel,
  parseRecurringRule,
  generateRecurringRule,
  getUpcomingRecurrencesPreview,
  getNextRecurringDue,
  normalizeExceptionKey,
  getRecurrenceEndDescription,
  type RecurrencePattern,
  type RecurrenceFreq,
  type WeekDay,
} from "@/lib/utils";

interface TaskModalProps {
  task: Task;
  isOpen: boolean;
  onClose: () => void;
}

const priorities: Priority[] = ["P0", "P1", "P2", "P3"];

/** Self-contained, beautifully styled recurrence editor (extracted to satisfy strict TS + keep modal clean)
 *  Production (Agent 25): full end conditions (Never / After N / Until date + COUNT/UNTIL), YEARLY preset,
 *  raw RRULE editor, smooth local state for end conds, Linear/Notion quality.
 */
function RecurrenceEditor({ localTask, save }: { localTask: Task; save: (updates: Partial<Task>) => void }) {
  const currentLabel = getRecurringLabel(localTask.recurringRule);
  const currentPattern = parseRecurringRule(localTask.recurringRule);
  const upcoming = getUpcomingRecurrencesPreview(localTask.dueDate, localTask.recurringRule, 4, localTask.exceptionDates);
  const endDesc = getRecurrenceEndDescription(localTask.recurringRule);

  const freq = currentPattern?.freq || "WEEKLY";
  const interval = currentPattern?.interval || 1;
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

  const handleSkipNext = () => {
    if (!localTask.recurringRule) return;
    const nextDue = getNextRecurringDue(localTask.recurringRule, new Date(), localTask.dueDate, localTask.exceptionDates);
    if (!nextDue) {
      toast.info("No future occurrences (series may have ended)");
      return;
    }
    const exKey = normalizeExceptionKey(nextDue);
    const currentEx = localTask.exceptionDates || [];
    if (currentEx.some((ex) => normalizeExceptionKey(ex) === exKey)) {
      toast.info("Next occurrence already skipped");
      return;
    }
    const nextEx = [...currentEx, exKey];
    save({ exceptionDates: nextEx });
    toast.success("Next occurrence skipped", {
      description: `${format(nextDue, "MMM d")} excluded from series`,
    });
  };

  // Advanced raw RRULE editor state (power-user / custom rules not covered by UI)
  const [showRaw, setShowRaw] = useState(false);
  const [rawRule, setRawRule] = useState(localTask.recurringRule || "");
  const [pendingDeleteTask, setPendingDeleteTask] = useState(false);

  const applyRawRule = () => {
    const trimmed = rawRule.trim().toUpperCase();
    save({ recurringRule: trimmed || null });
    setShowRaw(false);
  };

  return (
    <div className="space-y-3">
      {/* Current state + quick clear */}
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
            onClick={() => save({ recurringRule: null })}
            className="text-[10px] px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 text-[#a1a1aa] transition"
          >
            Clear
          </button>
        )}
      </div>

      {/* Presets */}
      <div className="flex flex-wrap gap-1.5">
        {(["DAILY", "WEEKLY", "MONTHLY", "YEARLY"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFreq(f)}
            className={cn(
              "text-xs px-3 py-1 rounded-full border transition",
              freq === f
                ? "bg-[#c084fc] text-black border-[#c084fc]"
                : "border-white/10 hover:bg-white/5 text-[#a1a1aa]"
            )}
          >
            {f === "DAILY" ? "Daily" : f === "WEEKLY" ? "Weekly" : f === "MONTHLY" ? "Monthly" : "Yearly"}
          </button>
        ))}
        <button
          onClick={() => save({ recurringRule: null })}
          className="text-xs px-3 py-1 rounded-full border border-white/10 hover:bg-white/5 text-[#71717a]"
        >
          None
        </button>
      </div>

      {/* Interval */}
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
      {localTask.recurringRule && (
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

          {endMode === "never" && (
            <div className="text-[10px] text-[#a1a1aa] pl-1">Open-ended series (continues forever)</div>
          )}
        </div>
      )}

      {/* Preview + raw RRULE (transparency & advanced control) */}
      {upcoming.length > 0 && (
        <div className="text-[10px] text-[#71717a] pt-1">
          Next: {upcoming.join(" • ")}
        </div>
      )}
      {localTask.recurringRule && (
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
      {showRaw && (
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
              onClick={handleSkipNext}
              className="text-[10px] px-2 py-0.5 rounded bg-[#c084fc]/10 hover:bg-[#c084fc]/20 text-[#c084fc] border border-[#c084fc]/30 transition"
              title="Skip the next calculated occurrence (adds to exceptionDates)"
            >
              Skip next occurrence
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

export function TaskModal({ task, isOpen, onClose }: TaskModalProps) {
  const { 
    updateTask, deleteTask, completeTask, taskLoadingStates, 
    comments, isLoadingComments, fetchComments, addComment, addTask, 
    activeConflicts, resolveConflict, members, onlineUsers,
    liveEditing, broadcastLiveTaskEdit, user 
  } = useTaskStore();
  const [localTask, setLocalTask] = useState(task);
  const [newComment, setNewComment] = useState("");

  // Live collab: debounce refs for broadcasting while typing (lightweight, no extra deps)
  const liveBroadcastTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastBroadcastRef = useRef<{ title?: string; description?: string }>({});

  // Mobile bottom sheet detection + drag state (additive, only affects <768px)
  const [isMobile, setIsMobile] = useState(false);
  const [dragY, setDragY] = useState(0);

  // State for the modern delete confirmation modal (house-cleaning item)
  const [pendingDeleteTask, setPendingDeleteTask] = useState(false);

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

  // Cleanup any pending live broadcast debounce when modal closes
  useEffect(() => {
    if (!isOpen) {
      if (liveBroadcastTimeoutRef.current) {
        clearTimeout(liveBroadcastTimeoutRef.current);
        liveBroadcastTimeoutRef.current = null;
      }
      lastBroadcastRef.current = {};
    }
  }, [isOpen]);

  // Agent 14: fetch comments realtime-backed when modal opens for task (optimistic + live via hybrid)
  useEffect(() => {
    if (isOpen && task?.id) {
      fetchComments({ taskId: task.id });
    }
  }, [isOpen, task?.id, fetchComments]);

  if (!isOpen) return null;

  const save = async (updates: Partial<Task>) => {
    triggerHaptic('light');
    const newTask = { ...localTask, ...updates };
    setLocalTask(newTask);
    await updateTask(task.id, updates);

    // Live collab: broadcast the change so others see it in near real-time (debounced)
    scheduleLiveBroadcast(updates);
  };

  const handleComplete = async () => {
    triggerHaptic('success');
    await completeTask(task.id);
    toast.success("Task completed");
    onClose();
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

  // Mobile sheet close handler with haptic + spring reset
  const handleSheetClose = () => {
    triggerHaptic('light');
    onClose();
  };

  const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.y > 140 || info.velocity.y > 650) {
      handleSheetClose();
    } else {
      setDragY(0);
    }
  };

  return (
    <>
      <AnimatePresence>
      <div 
        className={cn(
          "fixed inset-0 z-[180] flex p-4",
          isMobile 
            ? "items-end sheet-backdrop" 
            : "items-center justify-center bg-black/70"
        )} 
        onClick={handleSheetClose}
      >
        <motion.div 
          className={cn(
            "glass w-full overflow-hidden",
            isMobile 
              ? "mobile-bottom-sheet rounded-t-3xl max-w-none" 
              : "max-w-3xl rounded-3xl"
          )}
          onClick={e => e.stopPropagation()}
          // Mobile bottom sheet drag-to-dismiss (delightful native gesture)
          drag={isMobile ? "y" : false}
          dragConstraints={{ top: -20, bottom: 400 }}
          dragElastic={0.18}
          dragDirectionLock
          onDragEnd={isMobile ? handleDragEnd : undefined}
          onDrag={(e, info) => { if (isMobile) setDragY(Math.max(0, info.offset.y)); }}
          initial={isMobile ? { y: 80, opacity: 0 } : { scale: 0.96, opacity: 0 }}
          animate={isMobile ? { y: dragY, opacity: 1 } : { scale: 1, opacity: 1 }}
          exit={isMobile ? { y: 120, opacity: 0 } : { scale: 0.96, opacity: 0 }}
          transition={{ type: "spring", damping: 28, stiffness: 320, mass: 0.8 }}
          style={isMobile ? { touchAction: 'pan-y' } : {}}
        >
          {/* Mobile-native drag handle (visual + affordance) */}
          {isMobile && (
            <div className="sheet-drag-handle" aria-hidden="true" />
          )}

          {/* Header (content preserved, extra safe-area padding on mobile) */}
          <div className="flex items-center justify-between border-b border-white/10 px-6 py-4" style={isMobile ? { paddingTop: 'max(16px, env(safe-area-inset-top, 8px))' } : {}}>
          <div className="flex items-center gap-3">
            <button 
              onClick={handleComplete} 
              disabled={!!taskLoadingStates?.[task.id]}
              className="btn btn-primary text-sm px-5 py-1.5 disabled:opacity-60 flex items-center gap-1.5"
            >
              {taskLoadingStates?.[task.id] ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Mark done
            </button>
            <div className={`priority-badge priority-${localTask.priority.toLowerCase()}`}>{localTask.priority}</div>
            {taskLoadingStates?.[task.id] && (
              <span className="text-[10px] text-[#c084fc] ml-1 flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> saving…</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={handleDelete} 
              disabled={!!taskLoadingStates?.[task.id]}
              className="p-3 min-h-[44px] min-w-[44px] flex items-center justify-center text-red-400 hover:bg-white/5 rounded-lg disabled:opacity-50 active:scale-95"
            >
              <Trash2 className="h-5 w-5" />
            </button>
            <button 
              onClick={onClose} 
              aria-label="Close task details"
              className="p-3 min-h-[44px] min-w-[44px] flex items-center justify-center text-[#71717a] hover:text-white active:scale-95"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-6">
            <input
              value={localTask.title}
              onChange={(e) => save({ title: e.target.value })}
              className="w-full bg-transparent text-3xl font-semibold tracking-tighter outline-none"
            />

            {/* Live collab indicator (lightweight broadcast) */}
            {liveEditing?.[localTask.id] && liveEditing[localTask.id].userId !== (user?.id || 'me') && (
              <div className="text-[10px] text-emerald-400/80 font-mono mb-1 flex items-center gap-1.5">
                <span className="inline-block w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                {liveEditing[localTask.id].email?.split('@')[0] || 'Someone'} is typing…
              </div>
            )}

            {/* Agent 30: Conflict resolution banner for concurrent task edits (live) */}
            {activeConflicts && activeConflicts[localTask.id] && (
              <div className="glass px-3 py-2 rounded-2xl border border-amber-500/40 text-amber-400 text-xs flex flex-wrap items-center gap-2 font-mono mb-2">
                ⚠️ Concurrent edit by {activeConflicts[localTask.id].remoteUser || 'teammate'} • 
                <button onClick={() => resolveConflict(localTask.id, false)} className="px-2 py-0.5 bg-white/10 rounded hover:bg-white/20 underline">Take theirs</button>
                <button onClick={() => resolveConflict(localTask.id, true)} className="px-2 py-0.5 bg-white/10 rounded hover:bg-white/20 underline">Keep mine</button>
                <span className="text-[10px] opacity-70">(LWW auto-applied in background)</span>
              </div>
            )}

            <textarea
              value={localTask.description}
              onChange={(e) => save({ description: e.target.value })}
              placeholder="Add description... (TipTap editor coming soon)"
              className="w-full min-h-[160px] bg-[#111114] rounded-2xl p-4 text-sm resize-y outline-none border border-white/10"
            />

            {/* Contextual AI suggestion (Agent 9) — non-intrusive, one-click helpfulness */}
            <div className="glass rounded-2xl p-3 border border-[#ff00aa]/10">
              <div className="flex items-center justify-between text-[10px] uppercase tracking-widest text-[#ff00aa]/80 mb-1">
                <span>AI CO-PILOT</span>
                <button
                  onClick={() => {
                    const suggestion = getContextualAISuggestion("task-modal", { task: localTask });
                    toast(suggestion, { description: "Apply it to the description above or use as inspiration." });
                  }}
                  className="text-[10px] px-2 py-0.5 rounded bg-white/5 hover:bg-white/10"
                >
                  ✨ Suggest
                </button>
              </div>
              <div className="text-xs text-[#a1a1aa]">
                {getContextualAISuggestion("task-modal", { task: localTask })}
              </div>
            </div>

            {/* Agent 26: Smart Task Decomposition — "Break this down into subtasks" that actually creates linked child tasks (parentTaskId) */}
            <div className="glass rounded-2xl p-3 border border-[#c084fc]/10">
              <div className="flex items-center justify-between text-[10px] uppercase tracking-widest text-[#c084fc]/80 mb-1">
                <span>SMART DECOMPOSE</span>
                <button
                  onClick={async () => {
                    if (!localTask) return;
                    const realMode = isXAIConfigured();
                    const subs = realMode 
                      ? await generateSubtaskDecompositionAI(localTask)
                      : generateSubtaskDecomposition(localTask);
                    if (subs.length === 0) {
                      toast.info("This task is already atomic — no high-signal splits detected.");
                      return;
                    }
                    let created = 0;
                    for (const sub of subs) {
                      try {
                        const child = await addTask(sub.title);
                        if (child) {
                          await updateTask(child.id, {
                            parentTaskId: localTask.id,
                            priority: sub.priority || localTask.priority,
                            dueDate: sub.dueDate,
                            description: `Subtask (${realMode ? "Grok" : "AI"} decomposed from "${localTask.title.slice(0,40)}...")`,
                          });
                          created++;
                        }
                      } catch (e) {
                        // continue gracefully
                      }
                    }
                    triggerHaptic("success");
                    toast.success(realMode ? `xAI Grok created ${created} linked subtasks` : `Created ${created} linked subtasks`, {
                      description: "Children inherit priority/due where smart. Find them via parent or filters.",
                    });
                  }}
                  className="text-[10px] px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 flex items-center gap-1 disabled:opacity-50"
                  disabled={localTask.status === "done"}
                >
                  <Zap className="h-3 w-3" /> Break into subtasks
                </button>
              </div>
              <div className="text-xs text-[#a1a1aa]">
                AI splits complex work into 2-4 real child tasks with parent links. Magical for P0s.
              </div>
            </div>

            {/* Comments section - full realtime + @mentions (Agent 14) */}
            <div>
              <div className="flex items-center gap-2 text-sm font-medium mb-3 text-[#a1a1aa]">
                <MessageSquare className="h-4 w-4" /> Comments {isLoadingComments ? <Loader2 className="h-3 w-3 animate-spin" /> : `(${comments.filter((c: any) => c.taskId === task.id).length})`}
              </div>
              <div className="space-y-3 max-h-48 overflow-auto pr-1">
                {comments.filter((c: any) => c.taskId === task.id).length === 0 ? (
                  <div className="text-xs text-[#71717a] italic">No comments yet. Be the first — @mention teammates!</div>
                ) : (
                  comments.filter((c: any) => c.taskId === task.id).map((c: any) => (
                    <div key={c.id} className="glass rounded-xl p-3 text-sm border border-white/10">
                      <div className="flex items-center gap-2 text-[10px] text-[#a1a1aa] mb-1">
                        <span className="font-mono text-[#c084fc]">{c.userEmail || c.userName || c.userId?.slice(0,8)}</span>
                        <span>•</span>
                        <span>{new Date(c.createdAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                      </div>
                      <div className="text-[#e4e4e7] whitespace-pre-wrap">
                        {c.content.split(/(@\w+)/g).map((part: string, i: number) => 
                          part.startsWith('@') ? (
                            <span key={i} className="mention-pill" style={{background:'rgba(192,132,252,0.15)', color:'#c084fc', padding:'0 3px', borderRadius:'3px'}}>{part}</span>
                          ) : part
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="mt-3 flex gap-2">
                <input 
                  value={newComment}
                  onChange={e => setNewComment(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      if (newComment.trim()) {
                        addComment(newComment, { taskId: task.id });
                        setNewComment("");
                      }
                    }
                  }}
                  placeholder="Write a comment... (@name to mention)"
                  className="input flex-1 text-sm px-4 py-2 rounded-2xl"
                />
                <button 
                  onClick={() => {
                    if (newComment.trim()) {
                      addComment(newComment, { taskId: task.id });
                      setNewComment("");
                    }
                  }}
                  className="btn btn-secondary px-4"
                  disabled={!newComment.trim() || isLoadingComments}
                >
                  Post
                </button>
              </div>
              <div className="text-[9px] text-[#71717a] mt-1">Live when connected • Type @ to mention teammates</div>
              {/* Dynamic @mention suggestions when typing @ in the comment box */}
              {newComment.includes('@') && (
                <div className="flex gap-1 flex-wrap mt-1.5">
                  {[...(members || []), ...(onlineUsers || [])]
                    .filter((m: any) => {
                      const name = (m.fullName || m.email || m.userId || '').toLowerCase();
                      const query = newComment.split('@').pop()?.toLowerCase() || '';
                      return name.includes(query) && query.length > 0;
                    })
                    .slice(0, 5)
                    .map((m: any, i: number) => {
                      const name = m.fullName || (m.email || m.userId || 'user').split('@')[0];
                      return (
                        <button
                          key={i}
                          type="button"
                          onClick={() => {
                            const beforeAt = newComment.substring(0, newComment.lastIndexOf('@'));
                            setNewComment(beforeAt + '@' + name + ' ');
                          }}
                          className="text-[9px] px-1.5 py-px rounded bg-[#c084fc]/10 text-[#c084fc] border border-[#c084fc]/20 hover:bg-[#c084fc]/20"
                        >
                          @{name.length > 12 ? name.slice(0,12) + '...' : name}
                        </button>
                      );
                    })}
                </div>
              )}

              {/* Fallback quick chips when no @ is typed yet */}
              {!newComment.includes('@') && (
                (() => {
                  const pool = [...(members || []), ...(onlineUsers || [])].slice(0, 4);
                  if (!pool.length) return null;
                  return (
                    <div className="flex gap-1 flex-wrap mt-1.5">
                      {pool.map((m: any, i: number) => {
                        const short = (m.fullName || m.email || m.userId || 'user').split('@')[0].slice(0,8);
                        return (
                          <button
                            key={i}
                            type="button"
                            onClick={() => setNewComment((c) => (c.trim() ? c.trim() + ' ' : '') + '@' + short + ' ')}
                            className="text-[9px] px-1.5 py-px rounded bg-[#c084fc]/10 text-[#c084fc] border border-[#c084fc]/20 hover:bg-[#c084fc]/20"
                          >
                            @{short}
                          </button>
                        );
                      })}
                    </div>
                  );
                })()
              )}
            </div>
          </div>

          {/* Sidebar properties */}
          <div className="space-y-6 text-sm">
            {/* Priority — a11y: pressed state + labels for screen readers (WCAG) */}
            <div role="group" aria-label="Task priority">
              <div className="text-[#71717a] mb-2" id="priority-label">Priority</div>
              <div className="flex gap-2">
                {priorities.map(p => (
                  <button
                    key={p}
                    onClick={() => save({ priority: p })}
                    aria-pressed={localTask.priority === p}
                    aria-labelledby="priority-label"
                    aria-label={`Priority ${p}${localTask.priority === p ? ' (selected)' : ''}`}
                    className={`priority-badge priority-${p.toLowerCase()} ${localTask.priority === p ? "ring-2 ring-white/50" : "opacity-60"}`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* Due Date — clean modern calendar, timezone-safe (yyyy-MM-dd) */}
            <div>
              <DateTimePicker
                label="Due date"
                value={localTask.dueDate}
                onChange={(dateStr) => {
                  // Convert clean date string to ISO at local midnight (prevents TZ day shifts)
                  if (!dateStr) {
                    save({ dueDate: undefined });
                    return;
                  }
                  const [y, m, d] = dateStr.split('-').map(Number);
                  const localDate = new Date(y, m - 1, d);
                  save({ dueDate: localDate.toISOString() });
                }}
                className="w-full"
              />
            </div>

            {/* Recurrence — World-class UI for setting RRULE (Agent 8) */}
            <div>
              <div className="text-[#71717a] mb-2 flex items-center gap-2"><Repeat className="h-4 w-4" /> Recurrence</div>
              <RecurrenceEditor localTask={localTask} save={save} />
            </div>

            {/* Time Estimate */}
            <div>
              <div className="text-[#71717a] mb-2 flex items-center gap-2"><Clock className="h-4 w-4" /> Time estimate</div>
              <div className="flex gap-2 items-center">
                <input 
                  type="number" 
                  value={localTask.timeEstimate || ""}
                  onChange={e => save({ timeEstimate: parseInt(e.target.value) || undefined })}
                  className="input w-24 px-3 py-2 rounded-xl"
                />
                <span className="text-[#71717a]">minutes</span>
              </div>
            </div>

            {/* Tags */}
            <div>
              <div className="text-[#71717a] mb-2 flex items-center gap-2"><Tag className="h-4 w-4" /> Tags</div>
              <div className="flex flex-wrap gap-2">
                {localTask.tags.map((tag, i) => (
                  <span key={i} className="bg-white/5 text-xs px-3 py-1 rounded-full">{tag}</span>
                ))}
                <button className="text-xs text-[#c084fc]">+ Add tag</button>
              </div>
            </div>

            {/* Linked notes (stub) */}
            <div>
              <div className="text-[#71717a] mb-2 flex items-center gap-2"><Link2 className="h-4 w-4" /> Linked notes</div>
              <div className="text-xs text-[#71717a]">Connect notes to this task (coming in Phase 6)</div>
            </div>

            <div className="pt-4 border-t border-white/10 text-[11px] text-[#71717a]">
              Created {format(new Date(localTask.createdAt), "MMM d, yyyy")}
              {localTask.completedAt && <div>Completed {format(new Date(localTask.completedAt), "MMM d")}</div>}
            </div>
          </div>
        </div>
        {/* Close motion sheet + backdrop + AnimatePresence (mobile sheet structure) */}
      </motion.div>
    </div>
    </AnimatePresence>

    {/* Modern confirmation modal (replaces raw confirm for task delete) */}
    <ConfirmationModal
      open={pendingDeleteTask}
      onOpenChange={setPendingDeleteTask}
      title="Delete this task?"
      description="This cannot be undone. The task, its comments, and any links will be permanently removed."
      confirmText="Delete task"
      cancelText="Cancel"
      variant="destructive"
      onConfirm={handleConfirmDeleteTask}
    />
  </>
  );
}
