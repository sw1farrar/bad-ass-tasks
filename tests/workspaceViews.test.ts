import { describe, expect, it } from "vitest";
import type { Workspace } from "@/types";
import {
  getBottomNavViews,
  getMobileMoreNavGroups,
  getMobileMoreNavViews,
  getMobilePrimaryNavViews,
  isMobilePrimaryNavView,
  isValidNavView,
  resolveNavView,
} from "@/lib/nav/workspaceViews";

function workspace(partial?: Partial<Workspace>): Workspace {
  return {
    id: "ws-1",
    name: "Demo",
    slug: "demo",
    role: "owner",
    settings: {
      features: {
        notesEnabled: false,
      },
    },
    ...partial,
  };
}

describe("mobile workspace navigation", () => {
  it("keeps Home, Tasks, Files, and Lists as the primary phone tabs", () => {
    const primary = getMobilePrimaryNavViews(workspace());
    expect(primary.map((v) => v.id)).toEqual(["home", "tasks", "notes", "lists"]);
    expect(primary.every((v) => isMobilePrimaryNavView(v.id))).toBe(true);
  });

  it("does not dump every destination into the bottom bar", () => {
    const all = getBottomNavViews(workspace());
    const primary = getMobilePrimaryNavViews(workspace());
    expect(all.length).toBeGreaterThan(primary.length);
    expect(primary).toHaveLength(4);
  });

  it("puts Team and Settings in More, not the primary bar", () => {
    const more = getMobileMoreNavViews(workspace());
    expect(more.map((v) => v.id)).toEqual(["teams", "settings"]);
    expect(more.every((v) => !isMobilePrimaryNavView(v.id))).toBe(true);
  });

  it("groups overflow destinations and hides flagged features until enabled", () => {
    const empty = getMobileMoreNavGroups(workspace());
    expect(empty.map((g) => g.id)).toEqual(["team", "workspace"]);

    const full = getMobileMoreNavGroups(
      workspace({
        settings: {
          features: {
            notesEnabled: true,
          },
        },
      }),
      { showChat: true, isSiteAdmin: true },
    );

    expect(full.map((g) => g.id)).toEqual(["work", "team", "workspace"]);
    expect(full.find((g) => g.id === "work")?.items.map((i) => i.id)).toEqual(["notebooks"]);
    expect(full.find((g) => g.id === "team")?.items.map((i) => i.id)).toEqual(["chat", "teams"]);
    expect(full.find((g) => g.id === "workspace")?.items.map((i) => i.id)).toEqual([
      "settings",
      "admin",
    ]);
  });

  it("still treats overflow views as valid routes", () => {
    const ws = workspace({
      settings: { features: { notesEnabled: true } },
    });
    expect(isValidNavView("settings", ws)).toBe(true);
    expect(isValidNavView("notebooks", ws)).toBe(true);
    expect(isValidNavView("admin", ws, { isSiteAdmin: true })).toBe(true);
    expect(isValidNavView("admin", ws)).toBe(false);
  });

  it("sends removed meetings links to Home", () => {
    const ws = workspace({ settings: { features: { notesEnabled: true } } });
    expect(isValidNavView("meetings", ws)).toBe(true);
    expect(resolveNavView("meetings")).toBe("home");
    expect(getBottomNavViews(ws).map((v) => v.id)).not.toContain("meetings");
  });
});
