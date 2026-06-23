import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  flushPendingNoteFieldSave,
  schedulePendingNoteFieldSave,
} from "@/lib/notebooks/noteEditorSave";

describe("noteEditorSave", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("flushes pending value for the correct note id", () => {
    const timerRef = { current: null as ReturnType<typeof setTimeout> | null };
    const pendingRef = { current: { noteId: "note-a", value: "draft" } };
    const save = vi.fn();

    flushPendingNoteFieldSave(timerRef, pendingRef, save);

    expect(save).toHaveBeenCalledWith("note-a", "draft");
    expect(pendingRef.current).toBeNull();
  });

  it("schedules debounced save bound to note id", () => {
    const timerRef = { current: null as ReturnType<typeof setTimeout> | null };
    const pendingRef = { current: null as { noteId: string; value: string } | null };
    const save = vi.fn();

    schedulePendingNoteFieldSave("note-b", "hello", timerRef, pendingRef, save, 600);
    expect(save).not.toHaveBeenCalled();

    vi.advanceTimersByTime(600);
    expect(save).toHaveBeenCalledWith("note-b", "hello");
  });
});