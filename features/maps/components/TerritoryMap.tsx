"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import type { Feature, MultiPolygon, Polygon } from "geojson";
import type {
  MapStore,
  MapTerritory,
  LayerVisibility,
  SnapSettings,
  OverlapResult,
} from "@/lib/maps/types";
import type { TerritoryType } from "@/lib/maps/constants";
import { DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM, TERRITORY_COLORS } from "@/lib/maps/constants";
import {
  findOverlapsClient,
  metersPerPixel,
  normalizePolygonGeoJSON,
  snapToTerritories,
  boundsFromStoresAndTerritories,
} from "@/lib/maps/geo";
import {
  TERRITORY_SOURCE,
  TERRITORY_FILL,
  TERRITORY_LINE,
  TERRITORY_HIGHLIGHT,
  STORE_SOURCE,
  STORE_CIRCLE,
  STORE_LABEL,
  OVERLAP_SOURCE,
  OVERLAP_FILL,
  OVERLAP_LINE,
  SNAP_SOURCE,
  SNAP_CIRCLE,
  territoriesToFC,
  storesToFC,
} from "@/lib/maps/map-styles";
import "mapbox-gl/dist/mapbox-gl.css";
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css";

export type DrawMode = "idle" | "draw" | "edit";

export interface TerritoryDraft {
  name: string;
  territory_type: TerritoryType;
  color: string;
  notes: string;
  status: "active" | "draft" | "archived";
  assigned_person: string;
  excludeId?: string;
}

interface TerritoryMapProps {
  stores: MapStore[];
  territories: MapTerritory[];
  visibility: LayerVisibility;
  snap: SnapSettings;
  selectedStoreId: string | null;
  selectedTerritoryId: string | null;
  drawMode: DrawMode;
  draftMeta: TerritoryDraft | null;
  onSelectStore: (id: string | null) => void;
  onSelectTerritory: (id: string | null) => void;
  onGeometryReady: (geojson: Polygon | MultiPolygon, overlaps: OverlapResult[]) => void;
  onOverlapChange: (overlaps: OverlapResult[]) => void;
  onDrawCancel: () => void;
  mapStyle: "streets" | "satellite";
  fitRequest: number;
}

export function TerritoryMap({
  stores,
  territories,
  visibility,
  snap,
  selectedStoreId,
  selectedTerritoryId,
  drawMode,
  draftMeta,
  onSelectStore,
  onSelectTerritory,
  onGeometryReady,
  onOverlapChange,
  onDrawCancel,
  mapStyle,
  fitRequest,
}: TerritoryMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const drawRef = useRef<MapboxDraw | null>(null);
  const snapRef = useRef(snap);
  const territoriesRef = useRef(territories);
  const draftMetaRef = useRef(draftMeta);
  const drawModeRef = useRef(drawMode);
  const altHeld = useRef(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    snapRef.current = snap;
  }, [snap]);
  useEffect(() => {
    territoriesRef.current = territories;
  }, [territories]);
  useEffect(() => {
    draftMetaRef.current = draftMeta;
  }, [draftMeta]);
  useEffect(() => {
    drawModeRef.current = drawMode;
  }, [drawMode]);

  // Init map once
  useEffect(() => {
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!containerRef.current || !token) return;

    mapboxgl.accessToken = token;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/light-v11",
      center: DEFAULT_MAP_CENTER,
      zoom: DEFAULT_MAP_ZOOM,
      attributionControl: true,
    });

    map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), "bottom-right");
    map.addControl(new mapboxgl.ScaleControl({ unit: "imperial" }), "bottom-left");
    map.addControl(
      new mapboxgl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: false,
      }),
      "bottom-right"
    );

    const draw = new MapboxDraw({
      displayControlsDefault: false,
      controls: {},
      defaultMode: "simple_select",
      styles: drawStyles(),
    });
    map.addControl(draw as unknown as mapboxgl.IControl);

    mapRef.current = map;
    drawRef.current = draw;

    map.on("load", () => {
      // Empty sources
      map.addSource(TERRITORY_SOURCE, {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addSource(STORE_SOURCE, {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addSource(OVERLAP_SOURCE, {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addSource(SNAP_SOURCE, {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });

      map.addLayer({
        id: TERRITORY_FILL,
        type: "fill",
        source: TERRITORY_SOURCE,
        paint: {
          "fill-color": ["get", "color"],
          "fill-opacity": [
            "case",
            ["==", ["get", "status"], "draft"],
            0.18,
            ["==", ["get", "status"], "archived"],
            0.08,
            0.28,
          ],
        },
      });

      map.addLayer({
        id: TERRITORY_LINE,
        type: "line",
        source: TERRITORY_SOURCE,
        paint: {
          "line-color": ["get", "color"],
          "line-width": 2,
          "line-opacity": 0.9,
        },
      });

      map.addLayer({
        id: TERRITORY_HIGHLIGHT,
        type: "line",
        source: TERRITORY_SOURCE,
        paint: {
          "line-color": "#fbbf24",
          "line-width": 4,
          "line-opacity": 1,
        },
        filter: ["==", ["get", "id"], ""],
      });

      map.addLayer({
        id: OVERLAP_FILL,
        type: "fill",
        source: OVERLAP_SOURCE,
        paint: {
          "fill-color": "#ef4444",
          "fill-opacity": 0.35,
        },
      });

      map.addLayer({
        id: OVERLAP_LINE,
        type: "line",
        source: OVERLAP_SOURCE,
        paint: {
          "line-color": "#dc2626",
          "line-width": 3,
          "line-dasharray": [2, 1],
        },
      });

      map.addLayer({
        id: STORE_CIRCLE,
        type: "circle",
        source: STORE_SOURCE,
        paint: {
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["zoom"],
            4,
            4,
            10,
            7,
            14,
            10,
          ],
          "circle-color": ["get", "color"],
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
          "circle-opacity": [
            "case",
            ["==", ["get", "status"], "inactive"],
            0.4,
            0.95,
          ],
        },
      });

      map.addLayer({
        id: STORE_LABEL,
        type: "symbol",
        source: STORE_SOURCE,
        minzoom: 9,
        layout: {
          "text-field": ["get", "name"],
          "text-size": 11,
          "text-offset": [0, 1.2],
          "text-anchor": "top",
          "text-optional": true,
        },
        paint: {
          "text-color": "#0f172a",
          "text-halo-color": "#ffffff",
          "text-halo-width": 1.2,
        },
      });

      map.addLayer({
        id: SNAP_CIRCLE,
        type: "circle",
        source: SNAP_SOURCE,
        paint: {
          "circle-radius": 7,
          "circle-color": "#22d3ee",
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
          "circle-opacity": 0.95,
        },
      });

      setReady(true);
    });

    // Click handlers
    map.on("click", STORE_CIRCLE, (e) => {
      const f = e.features?.[0];
      const id = f?.properties?.id as string | undefined;
      if (id && drawModeRef.current === "idle") {
        e.originalEvent.stopPropagation();
        onSelectStore(id);
        onSelectTerritory(null);
      }
    });

    map.on("click", TERRITORY_FILL, (e) => {
      if (drawModeRef.current !== "idle") return;
      const f = e.features?.[0];
      const id = f?.properties?.id as string | undefined;
      if (id) {
        e.originalEvent.stopPropagation();
        onSelectTerritory(id);
        onSelectStore(null);
      }
    });

    map.on("mouseenter", STORE_CIRCLE, () => {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", STORE_CIRCLE, () => {
      map.getCanvas().style.cursor = "";
    });
    map.on("mouseenter", TERRITORY_FILL, () => {
      if (drawModeRef.current === "idle") {
        map.getCanvas().style.cursor = "pointer";
      }
    });
    map.on("mouseleave", TERRITORY_FILL, () => {
      map.getCanvas().style.cursor = "";
    });

    // Draw events
    const evaluateGeometry = () => {
      const d = drawRef.current;
      if (!d) return;
      const all = d.getAll();
      const poly = all.features.find(
        (f) =>
          f.geometry.type === "Polygon" || f.geometry.type === "MultiPolygon"
      );
      if (!poly) {
        onOverlapChange([]);
        setOverlapOnMap(map, null);
        return;
      }
      try {
        const geom = normalizePolygonGeoJSON(poly.geometry);
        const meta = draftMetaRef.current;
        const type = meta?.territory_type ?? "Commercial";
        const excludeId = meta?.excludeId;
        const overlaps = findOverlapsClient(
          geom,
          territoriesRef.current.filter((t) => t.status !== "archived"),
          type,
          excludeId
        );
        onOverlapChange(overlaps);
        // Highlight overlapping others
        const overlapFeatures = territoriesRef.current
          .filter((t) => overlaps.some((o) => o.id === t.id))
          .map((t) => ({
            type: "Feature" as const,
            properties: { id: t.id },
            geometry: t.geojson,
          }));
        setOverlapOnMap(map, {
          type: "FeatureCollection",
          features: overlapFeatures,
        });
      } catch {
        onOverlapChange([]);
      }
    };

    map.on("draw.create", evaluateGeometry);
    map.on("draw.update", evaluateGeometry);
    map.on("draw.delete", () => {
      onOverlapChange([]);
      setOverlapOnMap(map, null);
    });

    // Snapping on draw render — intercept mousemove while drawing
    const onMouseMove = (e: mapboxgl.MapMouseEvent) => {
      const s = snapRef.current;
      const d = drawRef.current;
      if (!d || !s.enabled || altHeld.current) {
        setSnapIndicator(map, null);
        return;
      }
      if (drawModeRef.current === "idle") {
        setSnapIndicator(map, null);
        return;
      }

      const mode = d.getMode();
      if (
        mode !== "draw_polygon" &&
        mode !== "direct_select" &&
        mode !== "simple_select"
      ) {
        setSnapIndicator(map, null);
        return;
      }

      let { lng, lat } = e.lngLat;
      const zoom = map.getZoom();
      const mpp = metersPerPixel(lat, zoom);
      const tolM = s.tolerancePx * mpp;

      if (s.snapToTerritories) {
        const others = territoriesRef.current
          .filter((t) => {
            const exclude = draftMetaRef.current?.excludeId;
            return !exclude || t.id !== exclude;
          })
          .map((t) => ({ geojson: t.geojson }));

        const snapped = snapToTerritories(lng, lat, others, tolM);
        if (snapped.snapped) {
          lng = snapped.lng;
          lat = snapped.lat;
          setSnapIndicator(map, [lng, lat]);
          return;
        }
      }

      setSnapIndicator(map, null);
    };

    map.on("mousemove", onMouseMove);

    // Keyboard: Alt temporarily disables snap
    const onKeyDown = (ev: KeyboardEvent) => {
      if (ev.key === "Alt") {
        altHeld.current = true;
        setSnapIndicator(map, null);
      }
      if (ev.key === "Escape" && drawModeRef.current !== "idle") {
        onDrawCancel();
      }
    };
    const onKeyUp = (ev: KeyboardEvent) => {
      if (ev.key === "Alt") altHeld.current = false;
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      map.remove();
      mapRef.current = null;
      drawRef.current = null;
      setReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Style toggle
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const style =
      mapStyle === "satellite"
        ? "mapbox://styles/mapbox/satellite-streets-v12"
        : "mapbox://styles/mapbox/light-v11";

    const readd = () => {
      // Sources/layers are wiped on style change — re-add
      if (!map.getSource(TERRITORY_SOURCE)) {
        map.addSource(TERRITORY_SOURCE, {
          type: "geojson",
          data: territoriesToFC(territories, visibility),
        });
        map.addSource(STORE_SOURCE, {
          type: "geojson",
          data: storesToFC(stores, visibility),
        });
        map.addSource(OVERLAP_SOURCE, {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
        map.addSource(SNAP_SOURCE, {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });

        map.addLayer({
          id: TERRITORY_FILL,
          type: "fill",
          source: TERRITORY_SOURCE,
          paint: {
            "fill-color": ["get", "color"],
            "fill-opacity": 0.28,
          },
        });
        map.addLayer({
          id: TERRITORY_LINE,
          type: "line",
          source: TERRITORY_SOURCE,
          paint: {
            "line-color": ["get", "color"],
            "line-width": 2,
          },
        });
        map.addLayer({
          id: TERRITORY_HIGHLIGHT,
          type: "line",
          source: TERRITORY_SOURCE,
          paint: {
            "line-color": "#fbbf24",
            "line-width": 4,
          },
          filter: ["==", ["get", "id"], selectedTerritoryId ?? ""],
        });
        map.addLayer({
          id: OVERLAP_FILL,
          type: "fill",
          source: OVERLAP_SOURCE,
          paint: { "fill-color": "#ef4444", "fill-opacity": 0.35 },
        });
        map.addLayer({
          id: OVERLAP_LINE,
          type: "line",
          source: OVERLAP_SOURCE,
          paint: {
            "line-color": "#dc2626",
            "line-width": 3,
            "line-dasharray": [2, 1],
          },
        });
        map.addLayer({
          id: STORE_CIRCLE,
          type: "circle",
          source: STORE_SOURCE,
          paint: {
            "circle-radius": 7,
            "circle-color": ["get", "color"],
            "circle-stroke-width": 2,
            "circle-stroke-color": "#fff",
          },
        });
        map.addLayer({
          id: STORE_LABEL,
          type: "symbol",
          source: STORE_SOURCE,
          minzoom: 9,
          layout: {
            "text-field": ["get", "name"],
            "text-size": 11,
            "text-offset": [0, 1.2],
            "text-anchor": "top",
          },
          paint: {
            "text-color": "#0f172a",
            "text-halo-color": "#fff",
            "text-halo-width": 1.2,
          },
        });
        map.addLayer({
          id: SNAP_CIRCLE,
          type: "circle",
          source: SNAP_SOURCE,
          paint: {
            "circle-radius": 7,
            "circle-color": "#22d3ee",
            "circle-stroke-width": 2,
            "circle-stroke-color": "#fff",
          },
        });
      }
    };

    map.once("style.load", readd);
    map.setStyle(style);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapStyle]);

  // Update data sources
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const tSrc = map.getSource(TERRITORY_SOURCE) as mapboxgl.GeoJSONSource | undefined;
    const sSrc = map.getSource(STORE_SOURCE) as mapboxgl.GeoJSONSource | undefined;
    tSrc?.setData(territoriesToFC(territories, visibility));
    sSrc?.setData(storesToFC(stores, visibility));
  }, [stores, territories, visibility, ready]);

  // Highlight selected territory
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !map.getLayer(TERRITORY_HIGHLIGHT)) return;
    map.setFilter(TERRITORY_HIGHLIGHT, [
      "==",
      ["get", "id"],
      selectedTerritoryId ?? "",
    ]);
  }, [selectedTerritoryId, ready]);

  // Fit bounds
  useEffect(() => {
    if (!fitRequest || !ready) return;
    const map = mapRef.current;
    if (!map) return;
    const b = boundsFromStoresAndTerritories(stores, territories);
    if (b) {
      map.fitBounds(b, { padding: 64, maxZoom: 12, duration: 800 });
    }
  }, [fitRequest, ready, stores, territories]);

  // Draw mode management
  useEffect(() => {
    const draw = drawRef.current;
    const map = mapRef.current;
    if (!draw || !map || !ready) return;

    if (drawMode === "draw") {
      draw.deleteAll();
      draw.changeMode("draw_polygon");
      map.getCanvas().style.cursor = "crosshair";
    } else if (drawMode === "edit" && draftMeta?.excludeId) {
      const t = territories.find((x) => x.id === draftMeta.excludeId);
      if (t) {
        draw.deleteAll();
        const ids = draw.add({
          type: "Feature",
          properties: {},
          geometry: t.geojson,
        } as Feature);
        if (ids[0]) {
          try {
            draw.changeMode("direct_select", { featureId: ids[0] });
          } catch {
            draw.changeMode("simple_select", { featureIds: ids });
          }
        }
      }
    } else {
      draw.deleteAll();
      draw.changeMode("simple_select");
      map.getCanvas().style.cursor = "";
      setOverlapOnMap(map, null);
    }
  }, [drawMode, draftMeta?.excludeId, ready, territories, draftMeta]);

  // Fly to selected store
  useEffect(() => {
    if (!selectedStoreId || !ready) return;
    const s = stores.find((x) => x.id === selectedStoreId);
    const map = mapRef.current;
    if (s?.longitude != null && s.latitude != null && map) {
      map.easeTo({
        center: [s.longitude, s.latitude],
        zoom: Math.max(map.getZoom(), 12),
        duration: 600,
      });
    }
  }, [selectedStoreId, stores, ready]);

  // Fly to selected territory
  useEffect(() => {
    if (!selectedTerritoryId || !ready || drawMode !== "idle") return;
    const t = territories.find((x) => x.id === selectedTerritoryId);
    const map = mapRef.current;
    if (t && map) {
      try {
        const b = boundsFromStoresAndTerritories([], [t]);
        if (b) map.fitBounds(b, { padding: 80, maxZoom: 13, duration: 600 });
      } catch {
        /* ignore */
      }
    }
  }, [selectedTerritoryId, territories, ready, drawMode]);

  const commitGeometry = useCallback(() => {
    const draw = drawRef.current;
    if (!draw) return null;
    const all = draw.getAll();
    const poly = all.features.find(
      (f) =>
        f.geometry.type === "Polygon" || f.geometry.type === "MultiPolygon"
    );
    if (!poly) return null;
    try {
      const geom = normalizePolygonGeoJSON(poly.geometry);
      const meta = draftMetaRef.current;
      const type = meta?.territory_type ?? "Commercial";
      const overlaps = findOverlapsClient(
        geom,
        territoriesRef.current.filter((t) => t.status !== "archived"),
        type,
        meta?.excludeId
      );
      onGeometryReady(geom, overlaps);
      return { geom, overlaps };
    } catch {
      return null;
    }
  }, [onGeometryReady]);

  // Expose commit via custom event so parent can trigger save synchronously
  useEffect(() => {
    const handler = () => {
      commitGeometry();
    };
    window.addEventListener("tm-commit-geometry", handler);
    return () => window.removeEventListener("tm-commit-geometry", handler);
  }, [commitGeometry]);

  const tokenMissing = !process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  return (
    <div className="relative h-full w-full">
      {tokenMissing && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-bg-primary/90 p-6 text-center">
          <div className="max-w-md space-y-2">
            <p className="text-lg font-semibold text-text-primary">Mapbox token required</p>
            <p className="text-sm text-text-muted">
              Set <code className="rounded bg-bg-tertiary px-1">NEXT_PUBLIC_MAPBOX_TOKEN</code> in{" "}
              <code className="rounded bg-bg-tertiary px-1">.env.local</code> and restart the dev
              server.
            </p>
          </div>
        </div>
      )}
      <div ref={containerRef} className="h-full w-full" />
      {drawMode !== "idle" && (
        <div className="pointer-events-none absolute bottom-6 left-1/2 z-10 -translate-x-1/2 rounded-full border border-border-glass bg-bg-secondary/95 px-4 py-2 text-xs text-text-primary shadow-lg backdrop-blur">
          {snap.enabled && !altHeld.current ? (
            <span>
              Snapping on · tolerance {snap.tolerancePx}px · hold{" "}
              <kbd className="rounded border border-border-glass px-1">Alt</kbd> to disable ·{" "}
              <kbd className="rounded border border-border-glass px-1">Esc</kbd> cancel
            </span>
          ) : (
            <span>
              Drawing · snap temporarily off ·{" "}
              <kbd className="rounded border border-border-glass px-1">Esc</kbd> cancel
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function setOverlapOnMap(
  map: mapboxgl.Map,
  data: GeoJSON.FeatureCollection | null
) {
  const src = map.getSource(OVERLAP_SOURCE) as mapboxgl.GeoJSONSource | undefined;
  src?.setData(data ?? { type: "FeatureCollection", features: [] });
}

function setSnapIndicator(
  map: mapboxgl.Map,
  coord: [number, number] | null
) {
  const src = map.getSource(SNAP_SOURCE) as mapboxgl.GeoJSONSource | undefined;
  if (!src) return;
  if (!coord) {
    src.setData({ type: "FeatureCollection", features: [] });
    return;
  }
  src.setData({
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {},
        geometry: { type: "Point", coordinates: coord },
      },
    ],
  });
}

function drawStyles() {
  // Simplified MapboxDraw styles with brand colors
  return [
    {
      id: "gl-draw-polygon-fill",
      type: "fill",
      filter: ["all", ["==", "$type", "Polygon"], ["!=", "mode", "static"]],
      paint: {
        "fill-color": TERRITORY_COLORS.Commercial,
        "fill-opacity": 0.2,
      },
    },
    {
      id: "gl-draw-polygon-stroke-active",
      type: "line",
      filter: ["all", ["==", "$type", "Polygon"], ["!=", "mode", "static"]],
      paint: {
        "line-color": TERRITORY_COLORS.Commercial,
        "line-width": 2.5,
      },
    },
    {
      id: "gl-draw-polygon-and-line-vertex-active",
      type: "circle",
      filter: [
        "all",
        ["==", "meta", "vertex"],
        ["==", "$type", "Point"],
        ["!=", "mode", "static"],
      ],
      paint: {
        "circle-radius": 6,
        "circle-color": "#ffffff",
        "circle-stroke-color": TERRITORY_COLORS.Commercial,
        "circle-stroke-width": 2,
      },
    },
    {
      id: "gl-draw-polygon-midpoint",
      type: "circle",
      filter: ["all", ["==", "$type", "Point"], ["==", "meta", "midpoint"]],
      paint: {
        "circle-radius": 4,
        "circle-color": TERRITORY_COLORS.Commercial,
      },
    },
    {
      id: "gl-draw-line",
      type: "line",
      filter: ["all", ["==", "$type", "LineString"], ["!=", "mode", "static"]],
      paint: {
        "line-color": TERRITORY_COLORS.Commercial,
        "line-width": 2,
      },
    },
    {
      id: "gl-draw-point",
      type: "circle",
      filter: [
        "all",
        ["==", "$type", "Point"],
        ["==", "meta", "feature"],
        ["!=", "mode", "static"],
      ],
      paint: {
        "circle-radius": 5,
        "circle-color": TERRITORY_COLORS.Commercial,
      },
    },
  ];
}
