"use client";

import { useCallback, useEffect, useState } from "react";
import type { MapStore, MapTerritory } from "@/lib/maps/types";
import { toast } from "sonner";

export function useMapData(workspaceId: string) {
  const [stores, setStores] = useState<MapStore[]>([]);
  const [territories, setTerritories] = useState<MapTerritory[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!workspaceId) return;
    try {
      const qs = `workspaceId=${encodeURIComponent(workspaceId)}`;
      const [sRes, tRes] = await Promise.all([
        fetch(`/api/maps/stores?${qs}`),
        fetch(`/api/maps/territories?${qs}`),
      ]);
      const sData = await sRes.json().catch(() => ({}));
      const tData = await tRes.json().catch(() => ({}));
      if (!sRes.ok || !tRes.ok) {
        const detail =
          (typeof sData?.error === "string" && sData.error) ||
          (typeof tData?.error === "string" && tData.error) ||
          `HTTP ${!sRes.ok ? sRes.status : tRes.status}`;
        throw new Error(`Failed to load map data: ${detail}`);
      }
      setStores(sData.stores ?? []);
      setTerritories(tData.territories ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    setLoading(true);
    void reload();
  }, [reload]);

  const upsertStore = useCallback((store: MapStore) => {
    setStores((prev) => {
      const idx = prev.findIndex((s) => s.id === store.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = store;
        return next;
      }
      return [...prev, store].sort((a, b) => a.name.localeCompare(b.name));
    });
  }, []);

  const removeStore = useCallback((id: string) => {
    setStores((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const upsertTerritory = useCallback((territory: MapTerritory) => {
    setTerritories((prev) => {
      const idx = prev.findIndex((t) => t.id === territory.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = territory;
        return next;
      }
      return [...prev, territory].sort((a, b) => a.name.localeCompare(b.name));
    });
  }, []);

  const removeTerritory = useCallback((id: string) => {
    setTerritories((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return {
    stores,
    territories,
    loading,
    reload,
    upsertStore,
    removeStore,
    upsertTerritory,
    removeTerritory,
  };
}
