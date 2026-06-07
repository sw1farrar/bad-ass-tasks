import { describe, it, expect, beforeEach } from "vitest";
import {
  getLastWorkspaceId,
  lastWorkspaceStorageKey,
  resolveCurrentWorkspace,
  saveLastWorkspaceId,
} from "@/lib/workspacePersistence";
import type { Workspace } from "@/types";

const userId = "user-abc";
const wsA: Workspace = { id: "ws-a", name: "Alpha", slug: "alpha", role: "owner" };
const wsB: Workspace = { id: "ws-b", name: "Beta", slug: "beta", role: "member" };

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

  it("falls back to first workspace when saved id is stale", () => {
    const picked = resolveCurrentWorkspace([wsA, wsB], {
      currentId: "deleted-ws",
      lastSavedId: "also-gone",
    });
    expect(picked?.id).toBe(wsA.id);
  });
});