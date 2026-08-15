"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  X,
  Save,
  Loader2,
  Trash2,
  Pencil,
  MapPin,
  AlertTriangle,
  User,
} from "lucide-react";
import type { MultiPolygon, Polygon } from "geojson";
import type { OverlapResult, MapStore, MapTerritory } from "@/lib/maps/types";
import { TERRITORY_COLORS, TERRITORY_TYPES, type TerritoryType } from "@/lib/maps/constants";
import { storesInsideGeometry } from "@/lib/maps/geo";

interface TerritoryPanelProps {
  workspaceId: string;
  territory: MapTerritory | null;
  stores: MapStore[];
  mode: "view" | "create" | "edit";
  overlaps: OverlapResult[];
  hasGeometry: boolean;
  onClose: () => void;
  onSaved: (territory: MapTerritory) => void;
  onDeleted: (id: string) => void;
  onStartDraw: (meta: {
    name: string;
    territory_type: TerritoryType;
    color: string;
    notes: string;
    status: "active" | "draft" | "archived";
    assigned_person: string;
    excludeId?: string;
  }) => void;
  onRequestCommit: () => Polygon | MultiPolygon | null;
  pendingGeometry: Polygon | MultiPolygon | null;
}

const fieldClass =
  "w-full rounded-lg border border-border-glass bg-bg-tertiary/60 px-3 py-2 text-sm text-text-primary outline-none focus:border-neon-purple/50";

export function TerritoryPanel({
  workspaceId,
  territory,
  stores,
  mode,
  overlaps,
  hasGeometry,
  onClose,
  onSaved,
  onDeleted,
  onStartDraw,
  onRequestCommit,
  pendingGeometry,
}: TerritoryPanelProps) {
  const [form, setForm] = useState({
    name: "",
    territory_type: "Commercial" as TerritoryType,
    color: TERRITORY_COLORS.Commercial,
    notes: "",
    status: "active" as "active" | "draft" | "archived",
    assigned_person: "",
  });
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(mode === "create" || mode === "edit");
  const [containedStores, setContainedStores] = useState<MapStore[]>([]);

  useEffect(() => {
    if (territory && mode !== "create") {
      setForm({
        name: territory.name,
        territory_type: territory.territory_type,
        color: territory.color || TERRITORY_COLORS[territory.territory_type],
        notes: territory.notes ?? "",
        status: territory.status,
        assigned_person: territory.assigned_person ?? "",
      });
      setEditing(mode === "edit");

      fetch(
        `/api/maps/territories/${territory.id}?workspaceId=${encodeURIComponent(workspaceId)}`,
      )
        .then((r) => r.json())
        .then((data) => {
          if (data.stores) setContainedStores(data.stores);
        })
        .catch(() => {
          setContainedStores(storesInsideGeometry(territory.geojson, stores) as MapStore[]);
        });
    } else if (mode === "create") {
      setForm({
        name: "",
        territory_type: "Commercial",
        color: TERRITORY_COLORS.Commercial,
        notes: "",
        status: "active",
        assigned_person: "",
      });
      setEditing(true);
      setContainedStores([]);
    }
  }, [territory, mode, stores, workspaceId]);

  useEffect(() => {
    if (pendingGeometry) {
      setContainedStores(storesInsideGeometry(pendingGeometry, stores) as MapStore[]);
    }
  }, [pendingGeometry, stores]);

  const blocked = overlaps.length > 0 && form.status !== "archived";

  if (!territory && mode !== "create") return null;

  async function save() {
    if (!form.name.trim()) {
      toast.error("Name is required");
      return;
    }

    const committed = onRequestCommit();
    const geojson = committed ?? pendingGeometry ?? territory?.geojson ?? null;

    if (!geojson && mode === "create") {
      toast.error("Draw a polygon before saving");
      return;
    }

    if (!geojson) {
      toast.error("No geometry available");
      return;
    }

    if (blocked) {
      toast.error("Cannot save — same-type territory overlap detected");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        workspaceId,
        name: form.name.trim(),
        territory_type: form.territory_type,
        color: form.color,
        notes: form.notes || null,
        status: form.status,
        assigned_person: form.assigned_person || null,
        geojson,
      };

      const isCreate = mode === "create" || !territory;
      const res = await fetch(
        isCreate ? "/api/maps/territories" : `/api/maps/territories/${territory!.id}`,
        {
          method: isCreate ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Save failed");
        return;
      }
      toast.success(isCreate ? "Territory created" : "Territory updated");
      onSaved(data.territory);
      setEditing(false);
    } catch {
      toast.error("Network error");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!territory) return;
    if (!confirm(`Delete territory “${territory.name}”?`)) return;
    setSaving(true);
    try {
      const res = await fetch(
        `/api/maps/territories/${territory.id}?workspaceId=${encodeURIComponent(workspaceId)}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Delete failed");
        return;
      }
      toast.success("Territory deleted");
      onDeleted(territory.id);
    } catch {
      toast.error("Network error");
    } finally {
      setSaving(false);
    }
  }

  function beginDraw() {
    onStartDraw({
      ...form,
      excludeId: territory?.id,
    });
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-2 border-b border-border-glass p-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
            Territory
          </p>
          <h2 className="text-lg font-semibold leading-tight text-text-primary">
            {mode === "create" ? "New territory" : territory?.name}
          </h2>
          {territory && mode !== "create" && (
            <p className="text-sm text-text-muted">{territory.territory_type}</p>
          )}
        </div>
        <button
          type="button"
          className="rounded-lg p-1.5 text-text-muted hover:bg-surface-hover"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-4">
        {blocked && (
          <div className="flex items-start gap-2 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-medium">Same-type overlap</p>
              <p className="text-xs opacity-90">
                Overlaps: {overlaps.map((o) => o.name).join(", ")}. Adjust the boundary or
                change type before saving.
              </p>
            </div>
          </div>
        )}

        {!editing && territory ? (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-1.5">
              <span className="rounded-full border border-border-glass px-2 py-0.5 text-xs capitalize text-text-primary">
                {territory.status}
              </span>
              <span
                className="rounded-full border px-2 py-0.5 text-xs"
                style={{
                  borderColor: territory.color || undefined,
                  color: territory.color || undefined,
                }}
              >
                {territory.territory_type}
              </span>
            </div>
            {territory.assigned_person && (
              <p className="flex items-center gap-2 text-sm text-text-primary">
                <User className="h-4 w-4 text-text-muted" />
                {territory.assigned_person}
              </p>
            )}
            {territory.notes && (
              <p className="rounded-lg bg-bg-tertiary/50 p-3 text-sm text-text-primary">
                {territory.notes}
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <label className="block space-y-1.5 text-sm">
              <span className="text-text-muted">Name *</span>
              <input
                className={fieldClass}
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </label>
            <label className="block space-y-1.5 text-sm">
              <span className="text-text-muted">Type *</span>
              <select
                className={fieldClass}
                value={form.territory_type}
                onChange={(e) => {
                  const v = e.target.value as TerritoryType;
                  setForm((f) => ({
                    ...f,
                    territory_type: v,
                    color: TERRITORY_COLORS[v],
                  }));
                }}
              >
                {TERRITORY_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block space-y-1.5 text-sm">
                <span className="text-text-muted">Status</span>
                <select
                  className={fieldClass}
                  value={form.status}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      status: e.target.value as "active" | "draft" | "archived",
                    }))
                  }
                >
                  <option value="active">Active</option>
                  <option value="draft">Draft</option>
                  <option value="archived">Archived</option>
                </select>
              </label>
              <label className="block space-y-1.5 text-sm">
                <span className="text-text-muted">Color</span>
                <input
                  type="color"
                  value={form.color}
                  onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                  className="h-10 w-full rounded-lg border border-border-glass bg-bg-tertiary/60 p-1"
                />
              </label>
            </div>
            <label className="block space-y-1.5 text-sm">
              <span className="text-text-muted">Assigned person</span>
              <input
                className={fieldClass}
                value={form.assigned_person}
                onChange={(e) => setForm((f) => ({ ...f, assigned_person: e.target.value }))}
                placeholder="Optional"
              />
            </label>
            <label className="block space-y-1.5 text-sm">
              <span className="text-text-muted">Notes</span>
              <textarea
                className={fieldClass}
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                rows={3}
              />
            </label>

            <button
              type="button"
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border-glass px-3 py-2 text-sm text-text-primary hover:bg-surface-hover"
              onClick={beginDraw}
            >
              <Pencil className="h-4 w-4" />
              {hasGeometry || territory ? "Redraw / edit boundary" : "Draw boundary on map"}
            </button>
            {(hasGeometry || territory) && (
              <p className="text-xs text-text-muted">
                Geometry ready. Adjust vertices on the map, then save.
              </p>
            )}
          </div>
        )}

        <div className="border-t border-border-glass pt-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
            Stores inside ({containedStores.length})
          </p>
          {containedStores.length === 0 ? (
            <p className="text-sm text-text-muted">No stores currently inside this boundary.</p>
          ) : (
            <ul className="space-y-1.5">
              {containedStores.map((s) => (
                <li
                  key={s.id}
                  className="flex items-start gap-2 rounded-md border border-border-glass px-2 py-1.5 text-sm"
                >
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-neon-purple" />
                  <span>
                    <span className="font-medium text-text-primary">{s.name}</span>
                    <span className="block text-xs text-text-muted">{s.address}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-t border-border-glass p-4">
        {editing ? (
          <>
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving || blocked}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-neon-purple/90 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save
            </button>
            {mode !== "create" && (
              <button
                type="button"
                onClick={() => setEditing(false)}
                disabled={saving}
                className="rounded-lg border border-border-glass px-3 py-2 text-sm text-text-primary hover:bg-surface-hover"
              >
                Cancel
              </button>
            )}
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="flex-1 rounded-lg bg-neon-purple/90 px-3 py-2 text-sm font-medium text-white"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={beginDraw}
              className="inline-flex items-center gap-1 rounded-lg border border-border-glass px-3 py-2 text-sm text-text-primary hover:bg-surface-hover"
            >
              <Pencil className="h-4 w-4" />
              Boundary
            </button>
            <button
              type="button"
              onClick={() => void remove()}
              disabled={saving}
              className="rounded-lg border border-red-500/40 p-2 text-red-400 hover:bg-red-500/10 disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
