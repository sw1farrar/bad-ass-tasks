import { describe, it, expect, beforeEach } from "vitest";
import {
  findWorkspaceByRef,
  getLastWorkspaceId,
  lastWorkspaceStorageKey,
  resolveCurrentWorkspace,
  saveLastWorkspaceId,
  sortWorkspacesDeterministic,
  workspaceUrlRef,
} from "@/lib/workspacePersistence";
import type { Workspace } from "@/types";

const userId = "user-abc";
const wsA: Workspace = {
  id: "ws-a",
  name: "Alpha",
  slug: "alpha",
  role: "owner",
  createdAt: "2024-01-02T00:00:00.000Z",
};
const wsB: Workspace = {
  id: "ws-b",
  name: "Farrar Home",
  slug: "farrarhome",
  role: "member",
  createdAt: "2024-01-01T00:00:00.000Z",
};
const wsC: Workspace = {
  id: "ws-c",
  name: "Personal",
  slug: "personal",
  role: "owner",
  createdAt: "2024-01-03T00:00:00.000Z",
};

describe("workspacePersistence", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("saves and reads last workspace per user", () => {
    saveLastWorkspaceId(userId, wsB.id);
    expect(localStorage.getItem(lastWorkspaceStorageKey(userId))).toBe(wsB.id);
    expect(getLastWorkspaceId(userId)).toBe(wsB.id);
    expect(getLastWorkspaceId("other-user")).toBeNull();
  });

  it("keeps current workspace when still in list", () => {
    const picked = resolveCurrentWorkspace([wsA, wsB], {
      currentId: wsB.id,
      lastSavedId: wsA.id,
      preferredRef: "alpha",
    });
    expect(picked?.id).toBe(wsB.id);
  });

  it("restores last saved workspace when current is missing", () => {
    saveLastWorkspaceId(userId, wsB.id);
    const picked = resolveCurrentWorkspace([wsA, wsB], {
      currentId: "",
      lastSavedId: getLastWorkspaceId(userId),
    });
    expect(picked?.id).toBe(wsB.id);
  });

  it("honors preferred URL slug when current is empty (PWA bookmark)", () => {
    const picked = resolveCurrentWorkspace([wsA, wsB, wsC], {
      currentId: "",
      lastSavedId: wsC.id,
      preferredRef: "farrarhome",
    });
    expect(picked?.id).toBe(wsB.id);
  });

  it("matches preferred ref by name case-insensitively", () => {
    const picked = findWorkspaceByRef([wsA, wsB], "farrar home");
    expect(picked?.id).toBe(wsB.id);
  });

  it("falls back to oldest owned workspace when saved id is stale", () => {
    const picked = resolveCurrentWorkspace([wsC, wsA, wsB], {
      currentId: "deleted-ws",
      lastSavedId: "also-gone",
    });
    // wsA is oldest owned (wsB is older overall but member-only)
    expect(picked?.id).toBe(wsA.id);
  });

  it("sorts workspaces deterministically by createdAt then name", () => {
    const sorted = sortWorkspacesDeterministic([wsC, wsA, wsB]);
    expect(sorted.map((w) => w.id)).toEqual(["ws-b", "ws-a", "ws-c"]);
  });

  it("prefers slug for bookmarkable URL refs", () => {
    expect(workspaceUrlRef(wsB)).toBe("farrarhome");
    expect(workspaceUrlRef({ id: "ws-x", slug: "" })).toBe("ws-x");
  });
});
