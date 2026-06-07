import { describe, it, expect } from "vitest";
import {
  canDeleteWorkspace,
  getPrimaryWorkspace,
  getWorkspaceSwitchTargetAfterDelete,
} from "@/lib/workspaceGuards";
import type { Workspace } from "@/types";

const userId = "user-1";

const primary: Workspace = {
  id: "ws-primary",
  name: "Original",
  slug: "personal-user",
  role: "owner",
  owner_id: userId,
  createdAt: "2026-01-01T00:00:00.000Z",
};

const secondary: Workspace = {
  id: "ws-secondary",
  name: "Side Project",
  slug: "side-project-abc",
  role: "owner",
  owner_id: userId,
  createdAt: "2026-02-01T00:00:00.000Z",
};

describe("workspaceGuards", () => {
  it("identifies the oldest owned workspace as primary", () => {
    expect(getPrimaryWorkspace([secondary, primary], userId)?.id).toBe(primary.id);
  });

  it("blocks deleting the only workspace", () => {
    const result = canDeleteWorkspace(primary.id, [primary], userId);
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/only workspace/i);
  });

  it("blocks deleting the original workspace when multiple exist", () => {
    const result = canDeleteWorkspace(primary.id, [primary, secondary], userId);
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/original workspace/i);
  });

  it("allows deleting a non-primary workspace when another exists", () => {
    const result = canDeleteWorkspace(secondary.id, [primary, secondary], userId);
    expect(result.allowed).toBe(true);
  });

  it("switches to the primary workspace after deleting another", () => {
    const target = getWorkspaceSwitchTargetAfterDelete([primary], userId);
    expect(target?.id).toBe(primary.id);
  });
});