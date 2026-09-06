import { afterEach, describe, expect, it } from "vitest";
import {
  bumpImportReviewStartCount,
  clearImportReviewSession,
  readImportReviewSession,
  writeImportReviewSession,
} from "@/features/import/lib/reviewSession";

const WS = "ws-review-test";

afterEach(() => {
  clearImportReviewSession(WS);
});

describe("import review session", () => {
  it("remembers resume task and start count", () => {
    writeImportReviewSession(WS, { resumeTaskId: "task-9", startCount: 309 });
    expect(readImportReviewSession(WS)).toEqual({ resumeTaskId: "task-9", startCount: 309 });
  });

  it("raises start count when remaining grows, keeps it when remaining shrinks", () => {
    expect(bumpImportReviewStartCount(WS, 309)).toBe(309);
    expect(bumpImportReviewStartCount(WS, 247)).toBe(309);
    expect(bumpImportReviewStartCount(WS, 400)).toBe(400);
  });

  it("clears when remaining hits zero", () => {
    writeImportReviewSession(WS, { resumeTaskId: "task-9", startCount: 10 });
    expect(bumpImportReviewStartCount(WS, 0)).toBe(0);
    expect(readImportReviewSession(WS)).toEqual({ resumeTaskId: null, startCount: 0 });
  });
});
