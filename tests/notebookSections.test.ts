import { describe, expect, it } from "vitest";
import {
  DEFAULT_NOTEBOOK_ENABLED_SECTIONS,
  normalizeNotebookEnabledSections,
  resolveNotebookEnabledSections,
} from "@/lib/notebooks/notebookSections";

describe("notebookSections", () => {
  it("defaults to notes and tasks when enabledSections is missing", () => {
    expect(resolveNotebookEnabledSections({})).toEqual(DEFAULT_NOTEBOOK_ENABLED_SECTIONS);
    expect(DEFAULT_NOTEBOOK_ENABLED_SECTIONS).toEqual(["notes", "tasks"]);
  });

  it("always keeps notes enabled and drops removed section ids", () => {
    expect(normalizeNotebookEnabledSections(["tasks", "investments" as never])).toEqual([
      "notes",
      "tasks",
    ]);
  });

  it("dedupes and filters unknown section ids", () => {
    expect(
      normalizeNotebookEnabledSections([
        "notes",
        "tasks",
        "tasks",
        "unknown" as never,
        "customers" as never,
      ]),
    ).toEqual(["notes", "tasks"]);
  });
});
