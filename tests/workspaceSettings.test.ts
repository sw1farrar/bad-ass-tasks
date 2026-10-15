import { describe, expect, it } from "vitest";
import {
  DEFAULT_NOTEBOOK_SECTIONS,
  DEFAULT_WORKSPACE_SETTINGS,
  getEnabledNotebookSections,
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

  it("ignores removed health and map flags", () => {
    const parsed = parseWorkspaceSettings({
      features: { healthEnabled: true, mapsEnabled: true, notesEnabled: true },
    });
    expect(parsed.features?.notesEnabled).toBe(true);
    expect(parsed.features).not.toHaveProperty("healthEnabled");
    expect(parsed.features).not.toHaveProperty("mapsEnabled");
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

  it("merges notesEnabled without wiping notebook sections", () => {
    const merged = mergeWorkspaceSettings(
      { features: { notesEnabled: true, notebookSections: { notes: true, tasks: false } } },
      { features: { notesEnabled: false } },
    );
    expect(merged.features?.notesEnabled).toBe(false);
    expect(merged.features?.notebookSections).toEqual({
      ...DEFAULT_NOTEBOOK_SECTIONS,
      tasks: false,
    });
  });

  it("defaults notebook sections to notes and tasks", () => {
    const parsed = parseWorkspaceSettings({ features: { notesEnabled: true } });
    expect(parsed.features?.notebookSections).toEqual(DEFAULT_NOTEBOOK_SECTIONS);
    expect(getEnabledNotebookSections(parsed)).toEqual(["notes", "tasks"]);
  });

  it("ignores removed notebook section keys", () => {
    const parsed = parseWorkspaceSettings({
      features: {
        notesEnabled: true,
        notebookSections: { tasks: false, investments: false, customers: true, competitors: false },
      },
    });
    expect(isNotebookSectionEnabled(parsed, "notes")).toBe(true);
    expect(isNotebookSectionEnabled(parsed, "tasks")).toBe(false);
    expect(parsed.features?.notebookSections).toEqual({
      notes: true,
      tasks: false,
    });
    expect(getEnabledNotebookSections(parsed)).toEqual(["notes"]);
  });

  it("deep-merges notebookSections so one toggle does not wipe others", () => {
    const merged = mergeWorkspaceSettings(
      {
        features: {
          notesEnabled: true,
          notebookSections: { notes: true, tasks: false },
        },
      },
      { features: { notebookSections: { tasks: true } } },
    );
    expect(merged.features?.notebookSections).toEqual({
      ...DEFAULT_NOTEBOOK_SECTIONS,
      tasks: true,
    });
  });

  it("treats missing section keys as enabled", () => {
    expect(isNotebookSectionEnabled(undefined, "tasks")).toBe(true);
    expect(
      isNotebookSectionEnabled({ features: { notebookSections: { tasks: false } } }, "notes"),
    ).toBe(true);
  });
});
