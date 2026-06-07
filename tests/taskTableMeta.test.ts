import { describe, it, expect } from "vitest";
import {
  getTaskPriorityLabel,
  getTaskWorkflowLabel,
  isElevatedPriority,
} from "@/features/tasks/lib/taskTableMeta";

describe("taskTableMeta", () => {
  it("hides default open and completed workflow states", () => {
    expect(getTaskWorkflowLabel("todo")).toBeNull();
    expect(getTaskWorkflowLabel("done")).toBeNull();
    expect(getTaskWorkflowLabel("doing")).toBe("In progress");
    expect(getTaskWorkflowLabel("backlog")).toBe("Backlog");
  });

  it("labels priorities for table display", () => {
    expect(getTaskPriorityLabel("P0")).toBe("Urgent");
    expect(getTaskPriorityLabel("P2")).toBe("Normal");
    expect(isElevatedPriority("P1")).toBe(true);
    expect(isElevatedPriority("P2")).toBe(false);
  });
});