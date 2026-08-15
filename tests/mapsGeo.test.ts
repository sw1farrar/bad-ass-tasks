import { describe, expect, it } from "vitest";
import { findOverlapsClient, normalizePolygonGeoJSON } from "@/lib/maps/geo";
import { isMapsFeatureEnabled, parseWorkspaceSettings } from "@/lib/workspace/workspaceSettings";

describe("maps geo helpers", () => {
  it("normalizes polygon and closes rings", () => {
    const geom = normalizePolygonGeoJSON({
      type: "Polygon",
      coordinates: [
        [
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 1],
        ],
      ],
    });
    expect(geom.type).toBe("Polygon");
    const ring = geom.coordinates[0];
    expect(ring[0]).toEqual(ring[ring.length - 1]);
  });

  it("detects same-type area overlap and ignores different types", () => {
    const a = normalizePolygonGeoJSON({
      type: "Polygon",
      coordinates: [
        [
          [0, 0],
          [2, 0],
          [2, 2],
          [0, 2],
          [0, 0],
        ],
      ],
    });
    const b = normalizePolygonGeoJSON({
      type: "Polygon",
      coordinates: [
        [
          [1, 1],
          [3, 1],
          [3, 3],
          [1, 3],
          [1, 1],
        ],
      ],
    });

    const sameType = findOverlapsClient(
      a,
      [{ id: "1", name: "Other", territory_type: "Commercial", geojson: b }],
      "Commercial",
    );
    expect(sameType).toHaveLength(1);

    const otherType = findOverlapsClient(
      a,
      [{ id: "1", name: "Other", territory_type: "Residential Repaint", geojson: b }],
      "Commercial",
    );
    expect(otherType).toHaveLength(0);
  });
});

describe("maps feature flag", () => {
  it("is off by default and on when set", () => {
    expect(isMapsFeatureEnabled(parseWorkspaceSettings({}))).toBe(false);
    expect(
      isMapsFeatureEnabled(parseWorkspaceSettings({ features: { mapsEnabled: true } })),
    ).toBe(true);
  });
});
