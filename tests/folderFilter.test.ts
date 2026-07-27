import { describe, expect, it } from "vitest";
import {
  folderFilterForStore,
  folderFilterSummary,
  includeNotebookRowsForFolderFilter,
  isFolderFilterActive,
  normalizeFolderFilter,
  taskMatchesFolderFilter,
  toggleFolderFilterToken,
} from "@/features/tasks/lib/folderFilter";

describe("folderFilter helpers", () => {
  it("normalizes legacy and multi-select values", () => {
    expect(normalizeFolderFilter("all")).toEqual([]);
    expect(normalizeFolderFilter(undefined)).toEqual([]);
    expect(normalizeFolderFilter("none")).toEqual(["none"]);
    expect(normalizeFolderFilter("f1")).toEqual(["f1"]);
    expect(normalizeFolderFilter(["f1", "none", "f1", "all"])).toEqual(["f1", "none"]);
  });

  it("matches tasks with OR multi-select", () => {
    const selected = ["none", "f1"];
    expect(taskMatchesFolderFilter({ folderId: null }, selected)).toBe(true);
    expect(taskMatchesFolderFilter({ folderId: "f1" }, selected)).toBe(true);
    expect(taskMatchesFolderFilter({ folderId: "f2" }, selected)).toBe(false);
    expect(taskMatchesFolderFilter({ folderId: "f2" }, [])).toBe(true);
  });

  it("toggles tokens and store values", () => {
    expect(toggleFolderFilterToken([], "f1")).toEqual(["f1"]);
    expect(toggleFolderFilterToken(["f1"], "f1")).toEqual([]);
    expect(toggleFolderFilterToken(["f1"], "none")).toEqual(["f1", "none"]);
    expect(folderFilterForStore([])).toBe("all");
    expect(folderFilterForStore(["f1"])).toEqual(["f1"]);
  });

  it("summarizes selection for the trigger label", () => {
    const folders = [
      { id: "f1", name: "DM Meetings" },
      { id: "f2", name: "Work" },
    ];
    expect(folderFilterSummary([], folders)).toBe("All folders");
    expect(folderFilterSummary(["none"], folders)).toBe("Unfiled");
    expect(folderFilterSummary(["f1"], folders)).toBe("DM Meetings");
    expect(folderFilterSummary(["f1", "f2"], folders)).toBe("2 folders");
    expect(isFolderFilterActive("all")).toBe(false);
    expect(isFolderFilterActive(["f1"])).toBe(true);
  });

  it("includes notebook rows for all/unfiled filters only", () => {
    expect(includeNotebookRowsForFolderFilter([])).toBe(true);
    expect(includeNotebookRowsForFolderFilter(["none"])).toBe(true);
    expect(includeNotebookRowsForFolderFilter(["f1"])).toBe(false);
    expect(includeNotebookRowsForFolderFilter(["none", "f1"])).toBe(true);
  });
});
