"use client";

import {
  MISSION_COLORS,
  MISSION_TYPES,
  TERRITORY_COLORS,
  TERRITORY_TYPES,
  type MissionType,
  type TerritoryType,
} from "@/lib/maps/constants";
import type { LayerVisibility } from "@/lib/maps/types";

interface LayerPanelProps {
  visibility: LayerVisibility;
  onChange: (next: LayerVisibility) => void;
}

export function LayerPanel({ visibility, onChange }: LayerPanelProps) {
  function toggleTerritory(type: TerritoryType) {
    onChange({
      ...visibility,
      territories: {
        ...visibility.territories,
        [type]: !visibility.territories[type],
      },
    });
  }

  function toggleMission(type: MissionType) {
    onChange({
      ...visibility,
      missions: {
        ...visibility.missions,
        [type]: !visibility.missions[type],
      },
    });
  }

  return (
    <div className="max-h-[70vh] space-y-4 overflow-auto p-1 pr-2">
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
          Territory types
        </p>
        <div className="space-y-2">
          {TERRITORY_TYPES.map((type) => (
            <label key={type} className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={visibility.territories[type]}
                onChange={() => toggleTerritory(type)}
                className="h-4 w-4 accent-neon-purple"
              />
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: TERRITORY_COLORS[type] }}
              />
              <span className="leading-tight text-text-primary">{type}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="border-t border-border-glass pt-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
          Store mission types
        </p>
        <div className="space-y-2">
          {MISSION_TYPES.map((type) => (
            <label key={type} className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={visibility.missions[type]}
                onChange={() => toggleMission(type)}
                className="h-4 w-4 accent-neon-purple"
              />
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: MISSION_COLORS[type] }}
              />
              <span className="leading-tight text-text-primary">{type}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-2 border-t border-border-glass pt-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
          Status filters
        </p>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-text-primary">
          <input
            type="checkbox"
            checked={visibility.showDraftTerritories}
            onChange={(e) =>
              onChange({ ...visibility, showDraftTerritories: e.target.checked })
            }
            className="h-4 w-4 accent-neon-purple"
          />
          Show draft territories
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-text-primary">
          <input
            type="checkbox"
            checked={visibility.showArchivedTerritories}
            onChange={(e) =>
              onChange({ ...visibility, showArchivedTerritories: e.target.checked })
            }
            className="h-4 w-4 accent-neon-purple"
          />
          Show archived territories
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-text-primary">
          <input
            type="checkbox"
            checked={visibility.showInactiveStores}
            onChange={(e) =>
              onChange({ ...visibility, showInactiveStores: e.target.checked })
            }
            className="h-4 w-4 accent-neon-purple"
          />
          Show inactive stores
        </label>
      </div>
    </div>
  );
}
