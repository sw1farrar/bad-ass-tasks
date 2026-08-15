"use client";

import React, { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { BottomSheet } from "@/components/BottomSheet";
import { useIsMobileViewport } from "@/lib/hooks/useIsMobileViewport";
import {
  STRESS_DRIVERS,
  STRESS_MAX,
  STRESS_MIN,
  getStressBand,
  type StressDriverId,
} from "@/lib/health/stressLabels";
import { toLocalDateString } from "@/lib/datetime";

export type LogStressInput = {
  value: number;
  recordedAt: string;
  note?: string;
  drivers: StressDriverId[];
};

interface LogStressSheetProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: LogStressInput) => Promise<void>;
}

function nowDate(): string {
  return toLocalDateString(new Date());
}

function nowTime(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function nowLocal(): string {
  return `${nowDate()}T${nowTime()}`;
}

function toRecordedIso(date: string, time: string): string | null {
  if (!date || !time) return null;
  const parsed = new Date(`${date}T${time}`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export function LogStressSheet({ open, onClose, onSubmit }: LogStressSheetProps) {
  const isMobile = useIsMobileViewport();
  const [score, setScore] = useState<number | null>(null);
  const [drivers, setDrivers] = useState<StressDriverId[]>([]);
  const [note, setNote] = useState("");
  const [recordedDate, setRecordedDate] = useState(nowDate);
  const [recordedTime, setRecordedTime] = useState(nowTime);
  const [recordedAtLocal, setRecordedAtLocal] = useState(nowLocal);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setScore(null);
    setDrivers([]);
    setNote("");
    setRecordedDate(nowDate());
    setRecordedTime(nowTime());
    setRecordedAtLocal(nowLocal());
  }, [open]);

  const band = score != null ? getStressBand(score) : null;

  const toggleDriver = (id: StressDriverId) => {
    setDrivers((prev) => (prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (score == null) return;
    setSaving(true);
    try {
      const recordedAt = isMobile
        ? toRecordedIso(recordedDate, recordedTime)
        : toRecordedIso(recordedAtLocal.slice(0, 10), recordedAtLocal.slice(11, 16));
      if (!recordedAt) return;
      await onSubmit({
        value: score,
        recordedAt,
        note: note.trim() || undefined,
        drivers,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="How stressed are you?"
      mobileHeight="90"
      enableDragDismiss={!saving}
      zIndex={850}
      panelClassName="log-stress-sheet"
      ariaLabel="Log stress"
      wrapChildrenInScroll={false}
    >
      <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 pb-4 space-y-5">
        <div>
          <div className="flex items-baseline justify-between gap-2">
            <label className="text-xs font-medium text-text-muted uppercase tracking-wider">
              Stress level
            </label>
            {band ? (
              <span className="text-xs font-semibold" style={{ color: band.color }}>
                {band.label}
              </span>
            ) : null}
          </div>
          <div
            className="mt-2 grid grid-cols-5 gap-2 md:grid-cols-10"
            role="radiogroup"
            aria-label="Stress from 1 to 10"
          >
            {Array.from({ length: STRESS_MAX - STRESS_MIN + 1 }, (_, i) => {
              const value = i + STRESS_MIN;
              const selected = score === value;
              const valueBand = getStressBand(value);
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setScore(value)}
                  className={cn(
                    "health-stress-score min-h-[48px] min-w-[44px] rounded-xl border text-sm font-bold tabular-nums transition active:scale-95",
                    selected
                      ? "text-bg border-transparent shadow-sm"
                      : "border-border-glass text-text-secondary hover:text-text-primary hover:bg-surface-hover",
                  )}
                  style={
                    selected
                      ? { backgroundColor: valueBand.color, color: "#0a0a0f" }
                      : { backgroundColor: `${valueBand.color}22` }
                  }
                >
                  {value}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-[11px] text-text-muted">1 calm · 10 overwhelmed</p>
        </div>

        <div>
          <p className="text-xs font-medium text-text-muted uppercase tracking-wider">
            What’s driving it?
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {STRESS_DRIVERS.map((driver) => {
              const on = drivers.includes(driver.id);
              return (
                <button
                  key={driver.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleDriver(driver.id)}
                  className={cn(
                    "min-h-[44px] rounded-full border px-3 text-xs font-semibold transition",
                    on
                      ? "bg-neon-purple/15 text-neon-purple-tint border-neon-purple/35"
                      : "border-border-glass text-text-secondary hover:bg-surface-hover",
                  )}
                >
                  {driver.label}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-text-muted uppercase tracking-wider">
            Comment
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="What’s on your mind?"
            className="mt-1 w-full rounded-xl border border-border-glass bg-bg px-3 py-2.5 text-sm text-text-primary resize-none"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-text-muted uppercase tracking-wider">
            Date & time
          </label>
          {isMobile ? (
            <div className="mt-1 grid grid-cols-1 min-[400px]:grid-cols-2 gap-2">
              <input
                type="date"
                value={recordedDate}
                onChange={(e) => setRecordedDate(e.target.value)}
                className="min-w-0 w-full min-h-[44px] rounded-xl border border-border-glass bg-bg px-3 py-2.5 text-sm text-text-primary"
              />
              <input
                type="time"
                value={recordedTime}
                onChange={(e) => setRecordedTime(e.target.value)}
                className="min-w-0 w-full min-h-[44px] rounded-xl border border-border-glass bg-bg px-3 py-2.5 text-sm text-text-primary"
              />
            </div>
          ) : (
            <input
              type="datetime-local"
              value={recordedAtLocal}
              onChange={(e) => setRecordedAtLocal(e.target.value)}
              className="mt-1 w-full min-h-[44px] rounded-xl border border-border-glass bg-bg px-3 py-2.5 text-sm text-text-primary"
            />
          )}
        </div>

      </div>
        <div className="shrink-0 border-t border-border-glass px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom,12px))]">
          <button
            type="submit"
            disabled={saving || score == null}
            className="w-full min-h-[48px] rounded-xl text-sm font-semibold bg-neon-purple text-white hover:opacity-90 disabled:opacity-50 transition"
          >
            {saving ? "Saving…" : "Save check-in"}
          </button>
        </div>
      </form>
    </BottomSheet>
  );
}
