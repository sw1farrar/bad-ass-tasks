import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseToodledoCsv } from "@/features/import/platforms/toodledo/parseToodledoCsv";

const CURRENT = "C:/Users/sw1fa/Downloads/toodledo_current_260906.csv";
const COMPLETED = "C:/Users/sw1fa/Downloads/toodledo_completed_260906.csv";

describe.skipIf(!existsSync(CURRENT) || !existsSync(COMPLETED))(
  "Rachel Toodledo export goldens",
  () => {
    it("maps all 309 current tasks with 0 unmapped repeats", () => {
      const preview = parseToodledoCsv(readFileSync(CURRENT, "utf8"), "current");
      expect(preview.kind).toBe("current");
      expect(preview.rowCount).toBe(309);
      expect(preview.recurringCount).toBe(305);
      expect(preview.notesCount).toBe(203);
      expect(preview.unmappedRepeats).toEqual([]);
      expect(preview.folderNames).toEqual([
        "Birthdays, Holidays & Special Events",
        "Bookkeeping",
        "Career",
        "Errands",
        "Home",
        "Personal",
      ]);
    });

    it("maps completed history without recurrence", () => {
      const preview = parseToodledoCsv(readFileSync(COMPLETED, "utf8"), "completed");
      expect(preview.kind).toBe("completed");
      expect(preview.rowCount).toBe(19898);
      expect(preview.recurringCount).toBe(0);
      expect(preview.notesCount).toBe(81);
      expect(preview.tasks.every((t) => t.status === "done" && !t.recurringRule)).toBe(true);
    });
  },
);
