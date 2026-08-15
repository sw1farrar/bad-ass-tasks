"use client";

import type { SnapSettings } from "@/lib/maps/types";
import { Magnet } from "lucide-react";

interface SnapControlsProps {
  snap: SnapSettings;
  onChange: (next: SnapSettings) => void;
}

export function SnapControls({ snap, onChange }: SnapControlsProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium text-text-primary">
          <Magnet className="h-4 w-4 text-cyan-400" />
          Snapping
        </div>
        <input
          type="checkbox"
          checked={snap.enabled}
          onChange={(e) => onChange({ ...snap, enabled: e.target.checked })}
          className="h-4 w-4 accent-neon-purple"
        />
      </div>

      <div className={snap.enabled ? "space-y-2" : "space-y-2 opacity-50"}>
        <div className="flex items-center justify-between text-xs text-text-muted">
          <span>Tolerance</span>
          <span>{snap.tolerancePx}px</span>
        </div>
        <input
          type="range"
          min={4}
          max={40}
          step={1}
          value={snap.tolerancePx}
          disabled={!snap.enabled}
          onChange={(e) =>
            onChange({ ...snap, tolerancePx: Number(e.target.value) || 12 })
          }
          className="w-full accent-neon-purple"
        />

        <label className="flex items-center justify-between gap-2 pt-1 text-sm text-text-primary">
          <span>Territory edges</span>
          <input
            type="checkbox"
            checked={snap.snapToTerritories}
            disabled={!snap.enabled}
            onChange={(e) => onChange({ ...snap, snapToTerritories: e.target.checked })}
            className="h-4 w-4 accent-neon-purple"
          />
        </label>
        <label className="flex items-center justify-between gap-2 text-sm text-text-primary">
          <span>Roads (visual aid)</span>
          <input
            type="checkbox"
            checked={snap.snapToRoads}
            disabled={!snap.enabled}
            onChange={(e) => onChange({ ...snap, snapToRoads: e.target.checked })}
            className="h-4 w-4 accent-neon-purple"
          />
        </label>
        <p className="text-[11px] leading-relaxed text-text-muted">
          Hold <kbd className="rounded border border-border-glass px-1">Alt</kbd> while drawing
          to temporarily disable snapping. Cyan dot shows magnetic snap target.
        </p>
      </div>
    </div>
  );
}
