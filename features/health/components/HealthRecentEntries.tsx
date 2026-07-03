"use client";

import React from "react";
import { Trash2 } from "lucide-react";
import { getMemberDisplayName } from "@/lib/assignee";
import { formatHealthValue, getHealthMetricDef } from "@/lib/health/healthMetrics";
import type { HealthReading, WorkspaceMember } from "@/types";

interface HealthRecentEntriesProps {
  readings: HealthReading[];
  members: WorkspaceMember[];
  colorMap: Record<string, string>;
  onDelete: (id: string) => void;
  limit?: number;
}

export function HealthRecentEntries({
  readings,
  members,
  colorMap,
  onDelete,
  limit = 12,
}: HealthRecentEntriesProps) {
  const slice = readings.slice(0, limit);

  if (slice.length === 0) {
    return (
      <p className="text-sm text-text-muted text-center py-8">
        No entries yet. Tap Log entry to record your first measurement.
      </p>
    );
  }

  return (
    <ul className="health-recent-entries divide-y divide-border-glass">
      {slice.map((r) => {
        const member = members.find((m) => m.userId === r.userId);
        const name = member ? getMemberDisplayName(member) : "Member";
        const def = getHealthMetricDef(r.metricType);
        const diastolic =
          r.metricType === "blood_pressure_systolic" && r.metadata?.diastolic != null
            ? ` / ${r.metadata.diastolic}`
            : "";
        return (
          <li key={r.id} className="flex items-start gap-3 py-3 px-1 min-w-0">
            <span
              className="mt-1.5 h-2.5 w-2.5 rounded-full shrink-0"
              style={{ backgroundColor: colorMap[r.userId] ?? "var(--neon-purple)" }}
              aria-hidden
            />
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 min-w-0">
                <span className="text-sm font-semibold text-text-primary truncate">{name}</span>
                <span className="text-xs text-text-muted">
                  {new Date(r.recordedAt).toLocaleString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <p className="text-sm text-text-secondary mt-0.5 break-words">
                <span className="inline-flex items-center rounded-md bg-neon-purple/10 text-neon-purple-tint px-1.5 py-0.5 text-[10px] font-semibold uppercase mr-2">
                  {def.label}
                </span>
                {formatHealthValue(r.value, r.unit)}
                {diastolic}
                {r.note ? <span className="text-text-muted"> — {r.note}</span> : null}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onDelete(r.id)}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-text-muted hover:text-rose-400 hover:bg-rose-400/10 shrink-0"
              aria-label="Delete entry"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </li>
        );
      })}
    </ul>
  );
}