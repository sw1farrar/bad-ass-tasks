"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  MapPinned,
  Layers,
  Plus,
  Store,
  Hexagon,
  Maximize2,
  PanelRightClose,
  Upload,
  Satellite,
  Map as MapIcon,
  Loader2,
} from "lucide-react";
import type { MultiPolygon, Polygon } from "geojson";
import { useMapData } from "./hooks/useMapData";
import { defaultLayerVisibility } from "@/lib/maps/map-styles";
import type {
  LayerVisibility,
  OverlapResult,
  SnapSettings,
  MapStore,
  MapTerritory,
} from "@/lib/maps/types";
import type { TerritoryType } from "@/lib/maps/constants";
import type { DrawMode, TerritoryDraft } from "./components/TerritoryMap";
import { SearchBar } from "./components/SearchBar";
import { LayerPanel } from "./components/LayerPanel";
import { SnapControls } from "./components/SnapControls";
import { StorePanel } from "./components/StorePanel";
import { TerritoryPanel } from "./components/TerritoryPanel";
import { CsvImportDialog } from "./components/CsvImportDialog";
import { cn } from "@/lib/utils";
import "./maps-workspace.css";

const TerritoryMap = dynamic(
  () => import("./components/TerritoryMap").then((m) => m.TerritoryMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center text-text-muted">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading map…
      </div>
    ),
  },
);

type SideTab = "layers" | "store" | "territory" | null;

export interface MapsViewProps {
  workspaceId: string;
  workspaceName?: string;
}

export function MapsView({ workspaceId, workspaceName }: MapsViewProps) {
  const {
    stores,
    territories,
    loading: dataLoading,
    upsertStore,
    removeStore,
    upsertTerritory,
    removeTerritory,
    reload,
  } = useMapData(workspaceId);

  const [visibility, setVisibility] = useState<LayerVisibility>(defaultLayerVisibility);
  const [snap, setSnap] = useState<SnapSettings>({
    enabled: true,
    tolerancePx: 14,
    snapToTerritories: true,
    snapToRoads: false,
  });
  const [mapStyle, setMapStyle] = useState<"streets" | "satellite">("streets");
  const [fitRequest, setFitRequest] = useState(0);

  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [selectedTerritoryId, setSelectedTerritoryId] = useState<string | null>(null);
  const [sideTab, setSideTab] = useState<SideTab>("layers");
  const [storeMode, setStoreMode] = useState<"view" | "create" | "edit">("view");
  const [territoryMode, setTerritoryMode] = useState<"view" | "create" | "edit">("view");

  const [drawMode, setDrawMode] = useState<DrawMode>("idle");
  const [draftMeta, setDraftMeta] = useState<TerritoryDraft | null>(null);
  const [pendingGeometry, setPendingGeometry] = useState<Polygon | MultiPolygon | null>(null);
  const pendingGeometryRef = useRef<Polygon | MultiPolygon | null>(null);
  const [overlaps, setOverlaps] = useState<OverlapResult[]>([]);
  const [hasGeometry, setHasGeometry] = useState(false);
  const [csvOpen, setCsvOpen] = useState(false);

  const selectedStore = useMemo(
    () => stores.find((s) => s.id === selectedStoreId) ?? null,
    [stores, selectedStoreId],
  );
  const selectedTerritory = useMemo(
    () => territories.find((t) => t.id === selectedTerritoryId) ?? null,
    [territories, selectedTerritoryId],
  );

  const panelOpen =
    sideTab !== null ||
    storeMode === "create" ||
    territoryMode === "create" ||
    drawMode !== "idle";

  const onSelectStore = useCallback((id: string | null) => {
    setSelectedStoreId(id);
    if (id) {
      setSelectedTerritoryId(null);
      setStoreMode("view");
      setTerritoryMode("view");
      setSideTab("store");
      setDrawMode("idle");
      setDraftMeta(null);
    }
  }, []);

  const onSelectTerritory = useCallback((id: string | null) => {
    setSelectedTerritoryId(id);
    if (id) {
      setSelectedStoreId(null);
      setTerritoryMode("view");
      setStoreMode("view");
      setSideTab("territory");
      setDrawMode("idle");
      setDraftMeta(null);
      setPendingGeometry(null);
    }
  }, []);

  const startCreateStore = () => {
    setSelectedStoreId(null);
    setSelectedTerritoryId(null);
    setStoreMode("create");
    setSideTab("store");
    setDrawMode("idle");
  };

  const startCreateTerritory = () => {
    setSelectedStoreId(null);
    setSelectedTerritoryId(null);
    setTerritoryMode("create");
    setSideTab("territory");
    setPendingGeometry(null);
    setHasGeometry(false);
    setOverlaps([]);
    const meta: TerritoryDraft = {
      name: "",
      territory_type: "Commercial",
      color: "#3b82f6",
      notes: "",
      status: "active",
      assigned_person: "",
    };
    setDraftMeta(meta);
    setDrawMode("draw");
  };

  const onStartDraw = (meta: {
    name: string;
    territory_type: TerritoryType;
    color: string;
    notes: string;
    status: "active" | "draft" | "archived";
    assigned_person: string;
    excludeId?: string;
  }) => {
    setDraftMeta(meta);
    setDrawMode(meta.excludeId ? "edit" : "draw");
    setSideTab("territory");
    if (meta.excludeId) {
      setSelectedTerritoryId(meta.excludeId);
      setTerritoryMode("edit");
    } else {
      setTerritoryMode("create");
    }
  };

  const onGeometryReady = useCallback(
    (geojson: Polygon | MultiPolygon, ov: OverlapResult[]) => {
      pendingGeometryRef.current = geojson;
      setPendingGeometry(geojson);
      setOverlaps(ov);
      setHasGeometry(true);
    },
    [],
  );

  const getCommittedGeometry = useCallback(() => {
    window.dispatchEvent(new Event("tm-commit-geometry"));
    return pendingGeometryRef.current;
  }, []);

  const onDrawCancel = () => {
    setDrawMode("idle");
    pendingGeometryRef.current = null;
    setPendingGeometry(null);
    setHasGeometry(false);
    setOverlaps([]);
    if (territoryMode === "create" && !selectedTerritoryId) {
      setSideTab("layers");
      setTerritoryMode("view");
    }
  };

  const emptyState = !dataLoading && stores.length === 0 && territories.length === 0;

  return (
    <div className="maps-workspace flex h-full min-h-0 flex-col overflow-hidden">
      {/* Toolbar */}
      <header className="z-20 flex h-14 shrink-0 items-center gap-2 border-b border-border-glass bg-bg-secondary/70 px-3 backdrop-blur md:px-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-neon-purple/20 text-neon-purple">
            <MapPinned className="h-4 w-4" />
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-semibold leading-none text-text-primary">Map</p>
            <p className="text-[11px] text-text-muted">
              {workspaceName ? `${workspaceName} · ` : ""}
              {stores.length} stores · {territories.length} territories
            </p>
          </div>
        </div>

        <div className="mx-auto w-full max-w-md flex-1 px-2">
          <SearchBar
            stores={stores}
            territories={territories}
            onSelectStore={onSelectStore}
            onSelectTerritory={onSelectTerritory}
          />
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            title="Fit all"
            onClick={() => setFitRequest((n) => n + 1)}
            className="rounded-lg p-2 text-text-muted hover:bg-surface-hover hover:text-text-primary"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            title="Toggle map style"
            onClick={() => setMapStyle((s) => (s === "streets" ? "satellite" : "streets"))}
            className="rounded-lg p-2 text-text-muted hover:bg-surface-hover hover:text-text-primary"
          >
            {mapStyle === "streets" ? (
              <Satellite className="h-4 w-4" />
            ) : (
              <MapIcon className="h-4 w-4" />
            )}
          </button>

          <div className="relative group">
            <button
              type="button"
              className="ml-1 inline-flex items-center gap-1 rounded-lg bg-neon-purple/90 px-2.5 py-1.5 text-sm font-medium text-white"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden md:inline">Add</span>
            </button>
            <div className="invisible absolute right-0 top-full z-30 mt-1 w-48 rounded-xl border border-border-glass bg-bg-secondary py-1 opacity-0 shadow-xl transition group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-text-primary hover:bg-surface-hover"
                onClick={startCreateStore}
              >
                <Store className="h-4 w-4" />
                New store
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-text-primary hover:bg-surface-hover"
                onClick={startCreateTerritory}
              >
                <Hexagon className="h-4 w-4" />
                New territory
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-text-primary hover:bg-surface-hover"
                onClick={() => setCsvOpen(true)}
              >
                <Upload className="h-4 w-4" />
                Import stores CSV
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1">
        {/* Left tools */}
        <aside className="hidden w-14 shrink-0 flex-col items-center gap-2 border-r border-border-glass bg-bg-secondary/40 py-3 md:flex">
          <ToolBtn
            active={sideTab === "layers"}
            title="Layers"
            onClick={() => setSideTab(sideTab === "layers" ? null : "layers")}
          >
            <Layers className="h-4 w-4" />
          </ToolBtn>
          <ToolBtn
            active={sideTab === "store" || storeMode === "create"}
            title="Stores"
            onClick={() => {
              setSideTab("store");
              if (!selectedStoreId) setStoreMode("create");
            }}
          >
            <Store className="h-4 w-4" />
          </ToolBtn>
          <ToolBtn
            active={sideTab === "territory" || territoryMode === "create"}
            title="Territories"
            onClick={() => {
              setSideTab("territory");
              if (!selectedTerritoryId) startCreateTerritory();
            }}
          >
            <Hexagon className="h-4 w-4" />
          </ToolBtn>
        </aside>

        {/* Map */}
        <main className="relative min-w-0 flex-1">
          {dataLoading && (
            <div className="absolute left-1/2 top-3 z-10 -translate-x-1/2 rounded-full border border-border-glass bg-bg-secondary/95 px-3 py-1.5 text-xs text-text-primary shadow">
              <Loader2 className="mr-1.5 inline h-3 w-3 animate-spin" />
              Loading data…
            </div>
          )}
          {emptyState && !dataLoading && (
            <div className="pointer-events-none absolute inset-x-4 top-12 z-10 mx-auto max-w-md rounded-2xl border border-border-glass bg-bg-secondary/95 p-4 text-center shadow-lg backdrop-blur">
              <p className="text-sm font-medium text-text-primary">No map data yet</p>
              <p className="mt-1 text-xs text-text-muted leading-relaxed">
                Import a stores CSV or draw a territory to get started. All data is scoped to
                this workspace.
              </p>
            </div>
          )}
          {overlaps.length > 0 && drawMode !== "idle" && (
            <div className="absolute left-1/2 top-3 z-10 flex -translate-x-1/2 items-center gap-2 rounded-lg border border-red-500/40 bg-red-600/95 px-3 py-2 text-xs font-medium text-white shadow-lg">
              Same-type overlap with {overlaps.map((o) => o.name).join(", ")} — save blocked
            </div>
          )}
          <TerritoryMap
            stores={stores}
            territories={territories}
            visibility={visibility}
            snap={snap}
            selectedStoreId={selectedStoreId}
            selectedTerritoryId={selectedTerritoryId}
            drawMode={drawMode}
            draftMeta={draftMeta}
            onSelectStore={onSelectStore}
            onSelectTerritory={onSelectTerritory}
            onGeometryReady={onGeometryReady}
            onOverlapChange={setOverlaps}
            onDrawCancel={onDrawCancel}
            mapStyle={mapStyle}
            fitRequest={fitRequest}
          />
        </main>

        {/* Side panel */}
        <aside
          className={cn(
            "absolute inset-y-0 right-0 z-20 flex w-full max-w-md flex-col border-l border-border-glass bg-bg-secondary shadow-xl transition-transform duration-200 md:static md:max-w-sm md:shadow-none",
            panelOpen
              ? "translate-x-0"
              : "translate-x-full md:w-0 md:translate-x-0 md:border-0 md:overflow-hidden",
          )}
        >
          {panelOpen && (
            <div className="flex h-full min-h-0 flex-col">
              <div className="flex items-center justify-between border-b border-border-glass px-3 py-2 md:hidden">
                <span className="text-sm font-medium text-text-primary">Details</span>
                <button
                  type="button"
                  className="rounded-lg p-1.5 text-text-muted hover:bg-surface-hover"
                  onClick={() => {
                    setSideTab(null);
                    setStoreMode("view");
                    setTerritoryMode("view");
                    if (drawMode !== "idle") onDrawCancel();
                  }}
                >
                  <PanelRightClose className="h-4 w-4" />
                </button>
              </div>

              {sideTab === "layers" && (
                <div className="flex min-h-0 flex-1 flex-col p-4">
                  <h2 className="mb-3 text-sm font-semibold text-text-primary">Map layers</h2>
                  <LayerPanel visibility={visibility} onChange={setVisibility} />
                  <div className="my-4 border-t border-border-glass" />
                  <SnapControls snap={snap} onChange={setSnap} />
                </div>
              )}

              {(sideTab === "store" || storeMode === "create") && (
                <StorePanel
                  workspaceId={workspaceId}
                  store={selectedStore}
                  mode={storeMode === "create" ? "create" : "view"}
                  onClose={() => {
                    setSideTab("layers");
                    setSelectedStoreId(null);
                    setStoreMode("view");
                  }}
                  onSaved={(s: MapStore) => {
                    upsertStore(s);
                    setSelectedStoreId(s.id);
                    setStoreMode("view");
                    setSideTab("store");
                  }}
                  onDeleted={(id) => {
                    removeStore(id);
                    setSelectedStoreId(null);
                    setSideTab("layers");
                  }}
                />
              )}

              {(sideTab === "territory" ||
                territoryMode === "create" ||
                drawMode !== "idle") &&
                sideTab !== "store" &&
                sideTab !== "layers" && (
                  <TerritoryPanel
                    workspaceId={workspaceId}
                    territory={selectedTerritory}
                    stores={stores}
                    mode={
                      territoryMode === "create"
                        ? "create"
                        : territoryMode === "edit"
                          ? "edit"
                          : "view"
                    }
                    overlaps={overlaps}
                    hasGeometry={hasGeometry || !!selectedTerritory}
                    pendingGeometry={pendingGeometry}
                    onClose={() => {
                      setSideTab("layers");
                      setSelectedTerritoryId(null);
                      setTerritoryMode("view");
                      onDrawCancel();
                    }}
                    onSaved={(t: MapTerritory) => {
                      upsertTerritory(t);
                      setSelectedTerritoryId(t.id);
                      setTerritoryMode("view");
                      setSideTab("territory");
                      setDrawMode("idle");
                      setDraftMeta(null);
                      pendingGeometryRef.current = null;
                      setPendingGeometry(null);
                      setHasGeometry(false);
                      setOverlaps([]);
                      void reload();
                    }}
                    onDeleted={(id) => {
                      removeTerritory(id);
                      setSelectedTerritoryId(null);
                      setSideTab("layers");
                      onDrawCancel();
                    }}
                    onStartDraw={onStartDraw}
                    onRequestCommit={getCommittedGeometry}
                  />
                )}
            </div>
          )}
        </aside>
      </div>

      {/* Mobile bottom bar */}
      <div className="flex h-12 shrink-0 items-center justify-around border-t border-border-glass bg-bg-secondary md:hidden">
        <button
          type="button"
          className="rounded-lg p-2 text-text-muted"
          onClick={() => setSideTab(sideTab === "layers" ? null : "layers")}
        >
          <Layers className="h-4 w-4" />
        </button>
        <button type="button" className="rounded-lg p-2 text-text-muted" onClick={startCreateStore}>
          <Store className="h-4 w-4" />
        </button>
        <button
          type="button"
          className="rounded-lg p-2 text-text-muted"
          onClick={startCreateTerritory}
        >
          <Hexagon className="h-4 w-4" />
        </button>
        <button
          type="button"
          className="rounded-lg p-2 text-text-muted"
          onClick={() => setCsvOpen(true)}
        >
          <Upload className="h-4 w-4" />
        </button>
      </div>

      <CsvImportDialog
        open={csvOpen}
        workspaceId={workspaceId}
        onOpenChange={setCsvOpen}
        onImported={(list) => {
          list.forEach(upsertStore);
          void reload();
        }}
      />
    </div>
  );
}

function ToolBtn({
  children,
  active,
  title,
  onClick,
}: {
  children: React.ReactNode;
  active?: boolean;
  title: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn(
        "flex h-10 w-10 items-center justify-center rounded-xl text-text-muted transition hover:bg-surface-hover hover:text-text-primary",
        active && "bg-neon-purple/20 text-neon-purple shadow-md",
      )}
    >
      {children}
    </button>
  );
}
