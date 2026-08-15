import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import type { Workspace } from "@/types";

vi.mock("next/image", () => ({
  default: (props: { alt?: string }) => <img alt={props.alt ?? ""} />,
}));

vi.mock("@/lib/utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/utils")>();
  return {
    ...actual,
    triggerHaptic: vi.fn(),
  };
});

const workspace: Workspace = {
  id: "ws-1",
  name: "Badazz Ventures",
  slug: "ventures",
  role: "owner",
  settings: {
    features: { notesEnabled: true, healthEnabled: false, mapsEnabled: false },
  },
};

describe("MobileBottomNav", () => {
  const onNavigate = vi.fn();

  beforeEach(() => {
    onNavigate.mockReset();
  });

  it("renders the four daily tabs plus More, not every workspace view", () => {
    render(
      <MobileBottomNav
        currentView="home"
        onNavigate={onNavigate}
        workspace={workspace}
        openTaskCount={0}
        overdueTaskCount={0}
        reviewCount={0}
      />,
    );

    const nav = screen.getByRole("navigation", { name: "Primary navigation" });
    expect(within(nav).getByRole("button", { name: "Home" })).toBeInTheDocument();
    expect(within(nav).getByRole("button", { name: "Tasks" })).toBeInTheDocument();
    expect(within(nav).getByRole("button", { name: "Files" })).toBeInTheDocument();
    expect(within(nav).getByRole("button", { name: "Lists" })).toBeInTheDocument();
    expect(within(nav).getByRole("button", { name: "More" })).toBeInTheDocument();
    expect(within(nav).queryByRole("button", { name: "Settings" })).not.toBeInTheDocument();
    expect(within(nav).queryByRole("button", { name: "Team" })).not.toBeInTheDocument();
    expect(within(nav).queryByRole("button", { name: "Notes" })).not.toBeInTheDocument();
  });

  it("opens a searchable overflow sheet for secondary destinations", async () => {
    const user = userEvent.setup();
    render(
      <MobileBottomNav
        currentView="home"
        onNavigate={onNavigate}
        workspace={workspace}
        showChat
        openTaskCount={0}
        overdueTaskCount={0}
        reviewCount={0}
      />,
    );

    await user.click(screen.getByRole("button", { name: "More" }));
    const sheet = await screen.findByRole("dialog", { name: "More navigation" });
    expect(within(sheet).getByRole("button", { name: /Notes/i })).toBeInTheDocument();
    expect(within(sheet).getByRole("button", { name: /Meetings/i })).toBeInTheDocument();
    expect(within(sheet).getByRole("button", { name: /Chat/i })).toBeInTheDocument();
    expect(within(sheet).getByRole("button", { name: /Team/i })).toBeInTheDocument();
    expect(within(sheet).getByRole("button", { name: /Settings/i })).toBeInTheDocument();

    await user.type(within(sheet).getByPlaceholderText("Go to…"), "meet");
    expect(within(sheet).getByRole("button", { name: /Meetings/i })).toBeInTheDocument();
    expect(within(sheet).queryByRole("button", { name: /Chat/i })).not.toBeInTheDocument();

    await user.click(within(sheet).getByRole("button", { name: /Meetings/i }));
    expect(onNavigate).toHaveBeenCalledWith("meetings");
  });

  it("marks More as the current page when an overflow view is open", () => {
    render(
      <MobileBottomNav
        currentView="settings"
        onNavigate={onNavigate}
        workspace={workspace}
        openTaskCount={0}
        overdueTaskCount={0}
        reviewCount={0}
      />,
    );

    expect(screen.getByRole("button", { name: "More" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "Home" })).not.toHaveAttribute("aria-current");
  });
});
