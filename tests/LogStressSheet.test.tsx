import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { LogStressSheet } from "@/features/health/components/LogStressSheet";

vi.mock("@/lib/hooks/useIsMobileViewport", () => ({
  useIsMobileViewport: () => false,
}));

describe("LogStressSheet", () => {
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  const onClose = vi.fn();

  beforeEach(() => {
    onSubmit.mockClear();
    onClose.mockClear();
  });

  it("logs a score, driver chips, and comment", async () => {
    const user = userEvent.setup();
    render(<LogStressSheet open onClose={onClose} onSubmit={onSubmit} />);

    await user.click(screen.getByRole("radio", { name: "7" }));
    await user.click(screen.getByRole("button", { name: "Work" }));
    await user.type(screen.getByPlaceholderText("What’s on your mind?"), "Deadline week");
    await user.click(screen.getByRole("button", { name: "Save check-in" }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const payload = onSubmit.mock.calls[0]?.[0];
    expect(payload.value).toBe(7);
    expect(payload.drivers).toEqual(["work"]);
    expect(payload.note).toBe("Deadline week");
    expect(onClose).toHaveBeenCalled();
  });
});
