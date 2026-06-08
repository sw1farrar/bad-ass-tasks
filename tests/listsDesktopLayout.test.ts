import { afterEach, describe, expect, it } from "vitest";
import {
  readListsDesktopLayout,
  writeListsDesktopLayout,
} from "@/features/lists/lib/listsDesktopLayout";

describe("listsDesktopLayout", () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it("defaults to grid", () => {
    expect(readListsDesktopLayout()).toBe("grid");
  });

  it("persists stack layout", () => {
    writeListsDesktopLayout("stack");
    expect(readListsDesktopLayout()).toBe("stack");
  });
});