"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { X, MapPin, Trash2, Save, Loader2, Navigation } from "lucide-react";
import type { MapStore } from "@/lib/maps/types";
import { MISSION_TYPES, type MissionType } from "@/lib/maps/constants";

interface StorePanelProps {
  workspaceId: string;
  store: MapStore | null;
  mode: "view" | "create" | "edit";
  onClose: () => void;
  onSaved: (store: MapStore) => void;
  onDeleted: (id: string) => void;
}

const emptyForm = {
  name: "",
  store_number: "",
  address: "",
  city: "",
  state: "",
  postal_code: "",
  country: "US",
  mission_types: [] as MissionType[],
  notes: "",
  status: "active" as "active" | "inactive",
  latitude: "" as string | number,
  longitude: "" as string | number,
};

const fieldClass =
  "w-full rounded-lg border border-border-glass bg-bg-tertiary/60 px-3 py-2 text-sm text-text-primary outline-none focus:border-neon-purple/50";

export function StorePanel({
  workspaceId,
  store,
  mode,
  onClose,
  onSaved,
  onDeleted,
}: StorePanelProps) {
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(mode === "create" || mode === "edit");

  useEffect(() => {
    if (store && mode !== "create") {
      setForm({
        name: store.name,
        store_number: store.store_number ?? "",
        address: store.address,
        city: store.city ?? "",
        state: store.state ?? "",
        postal_code: store.postal_code ?? "",
        country: store.country ?? "US",
        mission_types: store.mission_types,
        notes: store.notes ?? "",
        status: store.status,
        latitude: store.latitude ?? "",
        longitude: store.longitude ?? "",
      });
      setEditing(mode === "edit");
    } else if (mode === "create") {
      setForm(emptyForm);
      setEditing(true);
    }
  }, [store, mode]);

  if (!store && mode !== "create") return null;

  async function geocode() {
    const address = [form.address, form.city, form.state, form.postal_code]
      .filter(Boolean)
      .join(", ");
    if (!address) {
      toast.error("Enter an address first");
      return;
    }
    try {
      const res = await fetch("/api/maps/geocode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, workspaceId }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Geocode failed");
        return;
      }
      setForm((f) => ({
        ...f,
        latitude: data.result.latitude,
        longitude: data.result.longitude,
      }));
      toast.success("Coordinates found");
    } catch {
      toast.error("Geocode request failed");
    }
  }

  async function save() {
    if (!form.name.trim() || !form.address.trim()) {
      toast.error("Name and address are required");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        workspaceId,
        name: form.name.trim(),
        store_number: form.store_number || null,
        address: form.address.trim(),
        city: form.city || null,
        state: form.state || null,
        postal_code: form.postal_code || null,
        country: form.country || "US",
        mission_types: form.mission_types,
        notes: form.notes || null,
        status: form.status,
        latitude: form.latitude === "" ? null : Number(form.latitude),
        longitude: form.longitude === "" ? null : Number(form.longitude),
      };

      const isCreate = mode === "create" || !store;
      const res = await fetch(
        isCreate ? "/api/maps/stores" : `/api/maps/stores/${store!.id}`,
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
      toast.success(isCreate ? "Store created" : "Store updated");
      onSaved(data.store);
      setEditing(false);
    } catch {
      toast.error("Network error");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!store) return;
    if (!confirm(`Delete store “${store.name}”?`)) return;
    setSaving(true);
    try {
      const res = await fetch(
        `/api/maps/stores/${store.id}?workspaceId=${encodeURIComponent(workspaceId)}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Delete failed");
        return;
      }
      toast.success("Store deleted");
      onDeleted(store.id);
    } catch {
      toast.error("Network error");
    } finally {
      setSaving(false);
    }
  }

  function toggleMission(m: MissionType) {
    setForm((f) => ({
      ...f,
      mission_types: f.mission_types.includes(m)
        ? f.mission_types.filter((x) => x !== m)
        : [...f.mission_types, m],
    }));
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-2 border-b border-border-glass p-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Store</p>
          <h2 className="text-lg font-semibold leading-tight text-text-primary">
            {mode === "create" ? "New store" : store?.name}
          </h2>
          {store?.store_number && mode !== "create" && (
            <p className="text-sm text-text-muted">#{store.store_number}</p>
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

      <div className="flex-1 overflow-auto p-4">
        {!editing && store ? (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-1.5">
              <span className="rounded-full border border-border-glass px-2 py-0.5 text-xs capitalize text-text-primary">
                {store.status}
              </span>
              {store.mission_types.map((m) => (
                <span
                  key={m}
                  className="rounded-full border border-border-glass px-2 py-0.5 text-xs text-text-muted"
                >
                  {m}
                </span>
              ))}
            </div>
            <div className="flex items-start gap-2 text-sm">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-neon-purple" />
              <div>
                <p className="text-text-primary">{store.address}</p>
                <p className="text-text-muted">
                  {[store.city, store.state, store.postal_code].filter(Boolean).join(", ")}
                </p>
                {store.latitude != null && store.longitude != null && (
                  <p className="mt-1 font-mono text-xs text-text-muted">
                    {store.latitude.toFixed(5)}, {store.longitude.toFixed(5)}
                  </p>
                )}
              </div>
            </div>
            {store.notes && (
              <p className="rounded-lg bg-bg-tertiary/50 p-3 text-sm text-text-primary">
                {store.notes}
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
              <span className="text-text-muted">Store number</span>
              <input
                className={fieldClass}
                value={form.store_number}
                onChange={(e) => setForm((f) => ({ ...f, store_number: e.target.value }))}
              />
            </label>
            <label className="block space-y-1.5 text-sm">
              <span className="text-text-muted">Address *</span>
              <input
                className={fieldClass}
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block space-y-1.5 text-sm">
                <span className="text-text-muted">City</span>
                <input
                  className={fieldClass}
                  value={form.city}
                  onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                />
              </label>
              <label className="block space-y-1.5 text-sm">
                <span className="text-text-muted">State</span>
                <input
                  className={fieldClass}
                  value={form.state}
                  onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))}
                />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="block space-y-1.5 text-sm">
                <span className="text-text-muted">Postal code</span>
                <input
                  className={fieldClass}
                  value={form.postal_code}
                  onChange={(e) => setForm((f) => ({ ...f, postal_code: e.target.value }))}
                />
              </label>
              <label className="block space-y-1.5 text-sm">
                <span className="text-text-muted">Status</span>
                <select
                  className={fieldClass}
                  value={form.status}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      status: e.target.value as "active" | "inactive",
                    }))
                  }
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </label>
            </div>

            <div className="space-y-2">
              <span className="text-sm text-text-muted">Mission types</span>
              {MISSION_TYPES.map((m) => (
                <label key={m} className="flex cursor-pointer items-center gap-2 text-sm text-text-primary">
                  <input
                    type="checkbox"
                    checked={form.mission_types.includes(m)}
                    onChange={() => toggleMission(m)}
                    className="h-4 w-4 accent-neon-purple"
                  />
                  {m}
                </label>
              ))}
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-sm text-text-muted">Coordinates</span>
                <button
                  type="button"
                  onClick={() => void geocode()}
                  className="inline-flex items-center gap-1 rounded-lg border border-border-glass px-2 py-1 text-xs text-text-primary hover:bg-surface-hover"
                >
                  <Navigation className="h-3.5 w-3.5" />
                  Geocode
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  className={fieldClass}
                  placeholder="Latitude"
                  value={form.latitude}
                  onChange={(e) => setForm((f) => ({ ...f, latitude: e.target.value }))}
                />
                <input
                  className={fieldClass}
                  placeholder="Longitude"
                  value={form.longitude}
                  onChange={(e) => setForm((f) => ({ ...f, longitude: e.target.value }))}
                />
              </div>
            </div>

            <label className="block space-y-1.5 text-sm">
              <span className="text-text-muted">Notes</span>
              <textarea
                className={fieldClass}
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                rows={3}
              />
            </label>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2 border-t border-border-glass p-4">
        {editing ? (
          <>
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving}
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
