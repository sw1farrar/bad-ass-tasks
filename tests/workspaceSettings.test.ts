import { describe, expect, it } from "vitest";
import {
  DEFAULT_WORKSPACE_SETTINGS,
  isNotesFeatureEnabled,
  mergeWorkspaceSettings,
  parseWorkspaceSettings,
} from "@/lib/workspace/workspaceSettings";

describe("workspaceSettings", () => {
  it("defaults notesEnabled to false", () => {
    expect(parseWorkspaceSettings(null)).toEqual(DEFAULT_WORKSPACE_SETTINGS);
    expect(isNotesFeatureEnabled(parseWorkspaceSettings({}))).toBe(false);
  });

  it("reads notesEnabled from persisted JSON", () => {
    const parsed = parseWorkspaceSettings({ features: { notesEnabled: true } });
    expect(isNotesFeatureEnabled(parsed)).toBe(true);
  });

  it("merges partial settings patches", () => {
    const merged = mergeWorkspaceSettings(
      { features: { notesEnabled: false } },
      { features: { notesEnabled: true } },
    );
    expect(merged.features?.notesEnabled).toBe(true);
  });
});