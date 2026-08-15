"use client";

import React, { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { BottomSheet } from "@/components/BottomSheet";
import { useIsMobileViewport } from "@/lib/hooks/useIsMobileViewport";
import type { HealthMetricType } from "@/types";
import { getHealthMetricDef, HEALTH_METRICS } from "@/lib/health/healthMetrics";
import type { HealthSectionTab } from "@/lib/health/healthSections";
import { getMetricsForTab } from "@/lib/health/healthMetrics";

interface LogHealthModalProps {
  open: boolean;
  onClose: () => void;
  defaultTab?: HealthSectionTab;
  defaultMetric?: HealthMetricType;
  onSubmit: (input: {
    metricType: HealthMetricType;
    value: number;
    unit: string;
    recordedAt: string;
    note?: string;
    metadata?: Record<string, unknown>;
  }) => Promise<void>;
}

export function LogHealthModal({
  open,
  onClose,
  defaultTab = "overview",
  defaultMetric,
  onSubmit,
}: LogHealthModalProps) {
  const isMobile = useIsMobileViewport();
  const tabMetrics = useMemo(() => {
    const list = defaultTab === "overview" ? HEALTH_METRICS : getMetricsForTab(defaultTab);
    return list.filter((m) => m.type !== "stress");
  }, [defaultTab]);

  const [metricType, setMetricType] = useState<HealthMetricType>(
    defaultMetric ?? tabMetrics[0]?.type ?? "weight",
  );
  const [value, setValue] = useState("");
  const [unit, setUnit] = useState(getHealthMetricDef(metricType).defaultUnit);
  const [note, setNote] = useState("");
  const [diastolic, setDiastolic] = useState("");
  const [recordedDate, setRecordedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [recordedTime, setRecordedTime] = useState(() => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  });
  const [recordedAtLocal, setRecordedAtLocal] = useState(() =>
    new Date().toISOString().slice(0, 16),
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const initial = defaultMetric ?? tabMetrics[0]?.type ?? "weight";
    setMetricType(initial);
    setUnit(getHealthMetricDef(initial).defaultUnit);
    setValue("");
    setNote("");
    setDiastolic("");
    const now = new Date();
    setRecordedDate(now.toISOString().slice(0, 10));
    setRecordedTime(
      `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`,
    );
    setRecordedAtLocal(now.toISOString().slice(0, 16));
  }, [open, defaultMetric, tabMetrics]);

  const def = getHealthMetricDef(metricType);

  const handleMetricChange = (type: HealthMetricType) => {
    setMetricType(type);
    setUnit(getHealthMetricDef(type).defaultUnit);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(value);
    if (!Number.isFinite(num)) return;
    setSaving(true);
    try {
      const metadata =
        metricType === "blood_pressure_systolic" && diastolic
          ? { diastolic: parseFloat(diastolic) }
          : undefined;
      const recordedAt = isMobile
        ? new Date(`${recordedDate}T${recordedTime}`).toISOString()
        : new Date(recordedAtLocal).toISOString();
      await onSubmit({
        metricType,
        value: num,
        unit,
        recordedAt,
        note: note.trim() || undefined,
        metadata,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const form = (
    <form onSubmit={handleSubmit} className="px-5 pb-2 space-y-4">
      <div>
        <label className="text-xs font-medium text-text-muted uppercase tracking-wider">Metric</label>
        <select
          value={metricType}
          onChange={(e) => handleMetricChange(e.target.value as HealthMetricType)}
          className="mt-1 w-full min-h-[44px] rounded-xl border border-border-glass bg-bg px-3 py-2.5 text-sm text-text-primary"
        >
          {tabMetrics.map((m) => (
            <option key={m.type} value={m.type}>
              {m.label}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-text-muted uppercase tracking-wider">Value</label>
          <input
            type="text"
            inputMode="decimal"
            enterKeyHint="next"
            autoComplete="off"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={def.placeholder}
            required
            className="mt-1 w-full min-h-[44px] rounded-xl border border-border-glass bg-bg px-3 py-2.5 text-sm text-text-primary tabular-nums"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-text-muted uppercase tracking-wider">Unit</label>
          <select
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            className="mt-1 w-full min-h-[44px] rounded-xl border border-border-glass bg-bg px-3 py-2.5 text-sm text-text-primary"
          >
            {def.units.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </div>
      </div>

      {metricType === "blood_pressure_systolic" ? (
        <div>
          <label className="text-xs font-medium text-text-muted uppercase tracking-wider">Diastolic</label>
          <input
            type="text"
            inputMode="numeric"
            value={diastolic}
            onChange={(e) => setDiastolic(e.target.value)}
            placeholder="80"
            className="mt-1 w-full min-h-[44px] rounded-xl border border-border-glass bg-bg px-3 py-2.5 text-sm text-text-primary"
          />
        </div>
      ) : null}

      <div>
        <label className="text-xs font-medium text-text-muted uppercase tracking-wider">Date & time</label>
        {isMobile ? (
          <div className="mt-1 grid grid-cols-2 gap-2">
            <input
              type="date"
              value={recordedDate}
              onChange={(e) => setRecordedDate(e.target.value)}
              className="w-full min-h-[44px] rounded-xl border border-border-glass bg-bg px-3 py-2.5 text-sm text-text-primary"
            />
            <input
              type="time"
              value={recordedTime}
              onChange={(e) => setRecordedTime(e.target.value)}
              className="w-full min-h-[44px] rounded-xl border border-border-glass bg-bg px-3 py-2.5 text-sm text-text-primary"
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

      <div>
        <label className="text-xs font-medium text-text-muted uppercase tracking-wider">Note (optional)</label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder="Morning weigh-in, post-workout…"
          className="mt-1 w-full rounded-xl border border-border-glass bg-bg px-3 py-2.5 text-sm text-text-primary resize-none"
        />
      </div>

      <div className="keyboard-stable-sheet__footer pt-2">
        <button
          type="submit"
          disabled={saving || !value}
          className={cn(
            "w-full min-h-[48px] rounded-xl text-sm font-semibold transition",
            "bg-neon-purple text-white hover:opacity-90 disabled:opacity-50",
          )}
        >
          {saving ? "Saving…" : "Save entry"}
        </button>
      </div>
    </form>
  );

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Log health entry"
      enableDragDismiss={!saving}
      zIndex={850}
      panelClassName="log-health-modal"
      ariaLabel="Log health entry"
    >
      {form}
    </BottomSheet>
  );
}