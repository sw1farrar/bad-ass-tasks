import { describe, expect, it } from "vitest";
import {
  DEFAULT_NOTEBOOK_SECTIONS,
  DEFAULT_WORKSPACE_SETTINGS,
  getEnabledNotebookSections,
  isHealthFeatureEnabled,
  isMapsFeatureEnabled,
  isNotebookSectionEnabled,
  isNotesFeatureEnabled,
  mergeWorkspaceSettings,
  parseWorkspaceSettings,
} from "@/lib/workspace/workspaceSettings";

describe("workspaceSettings", () => {
  it("defaults notesEnabled to false", () => {
    expect(parseWorkspaceSettings(null)).toEqual(DEFAULT_WORKSPACE_SETTINGS);
    expect(isNotesFeatureEnabled(parseWorkspaceSettings({}))).toBe(false);
  });

  it("defaults healthEnabled and mapsEnabled to false", () => {
    const parsed = parseWorkspaceSettings({});
    expect(isHealthFeatureEnabled(parsed)).toBe(false);
    expect(isMapsFeatureEnabled(parsed)).toBe(false);
    expect(parsed.features?.mapsEnabled).toBe(false);
  });

  it("reads notesEnabled from persisted JSON", () => {
    const parsed = parseWorkspaceSettings({ features: { notesEnabled: true } });
    expect(isNotesFeatureEnabled(parsed)).toBe(true);
  });

  it("reads mapsEnabled from persisted JSON", () => {
    const parsed = parseWorkspaceSettings({ features: { mapsEnabled: true } });
    expect(isMapsFeatureEnabled(parsed)).toBe(true);
  });

  it("merges partial settings patches", () => {
    const merged = mergeWorkspaceSettings(
      { features: { notesEnabled: false } },
      { features: { notesEnabled: true } },
    );
    expect(merged.features?.notesEnabled).toBe(true);
  });

  it("merges mapsEnabled without wiping other flags", () => {
    const merged = mergeWorkspaceSettings(
      { features: { notesEnabled: true, healthEnabled: true, mapsEnabled: false } },
      { features: { mapsEnabled: true } },
    );
    expect(merged.features?.mapsEnabled).toBe(true);
    expect(merged.features?.notesEnabled).toBe(true);
    expect(merged.features?.healthEnabled).toBe(true);
  });

  it("defaults all notebook sections to enabled when unset", () => {
    const parsed = parseWorkspaceSettings({ features: { notesEnabled: true } });
    expect(parsed.features?.notebookSections).toEqual(DEFAULT_NOTEBOOK_SECTIONS);
    expect(getEnabledNotebookSections(parsed)).toEqual([
      "notes",
      "tasks",
      "investments",
      "customers",
      "competitors",
    ]);
  });

  it("reads notebookSections from persisted JSON", () => {
    const parsed = parseWorkspaceSettings({
      features: {
        notesEnabled: true,
        notebookSections: { tasks: false, investments: false },
      },
    });
    expect(isNotebookSectionEnabled(parsed, "notes")).toBe(true);
    expect(isNotebookSectionEnabled(parsed, "tasks")).toBe(false);
    expect(isNotebookSectionEnabled(parsed, "investments")).toBe(false);
    expect(getEnabledNotebookSections(parsed)).toEqual([
      "notes",
      "customers",
      "competitors",
    ]);
  });

  it("deep-merges notebookSections so one toggle does not wipe others", () => {
    const merged = mergeWorkspaceSettings(
      {
        features: {
          notesEnabled: true,
          notebookSections: { notes: true, tasks: false, investments: true },
        },
      },
      { features: { notebookSections: { investments: false } } },
    );
    expect(merged.features?.notebookSections).toEqual({
      ...DEFAULT_NOTEBOOK_SECTIONS,
      tasks: false,
      investments: false,
    });
  });

  it("treats missing section keys as enabled", () => {
    expect(isNotebookSectionEnabled(undefined, "competitors")).toBe(true);
    expect(
      isNotebookSectionEnabled(
        { features: { notebookSections: { competitors: false } } },
        "notes",
      ),
    ).toBe(true);
  });
});
