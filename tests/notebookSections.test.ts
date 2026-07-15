import { describe, expect, it } from "vitest";
import {
  DEFAULT_NOTEBOOK_ENABLED_SECTIONS,
  normalizeNotebookEnabledSections,
  resolveNotebookEnabledSections,
} from "@/lib/notebooks/notebookSections";

describe("notebookSections", () => {
  it("defaults to all sections when enabledSections is missing", () => {
    expect(resolveNotebookEnabledSections({})).toEqual(DEFAULT_NOTEBOOK_ENABLED_SECTIONS);
  });

  it("always keeps notes enabled", () => {
    expect(normalizeNotebookEnabledSections(["tasks", "investments"])).toEqual([
      "notes",
      "tasks",
      "investments",
    ]);
  });

  it("dedupes and filters unknown section ids", () => {
    expect(
      normalizeNotebookEnabledSections([
        "notes",
        "tasks",
        "tasks",
        "unknown" as never,
        "customers",
      ]),
    ).toEqual(["notes", "tasks", "customers"]);
  });
});
