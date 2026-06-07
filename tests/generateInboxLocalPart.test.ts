import { describe, it, expect } from "vitest";
import {
  buildInboxEmailAddress,
  generateInboxLocalPart,
  generateTaskInboxLocalPart,
  workspaceIdToInboxPrefix,
} from "@/lib/email-inbox/generateInboxLocalPart";

describe("generateInboxLocalPart", () => {
  const workspaceId = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

  it("builds stable workspace prefix", () => {
    expect(workspaceIdToInboxPrefix(workspaceId)).toBe("a1b2c3d4");
  });

  it("generates n-prefixed local parts", () => {
    const localPart = generateInboxLocalPart(workspaceId);
    expect(localPart).toMatch(/^n-a1b2c3d4-[a-f0-9]{8}$/);
  });

  it("generates t-prefixed local parts for tasks", () => {
    const localPart = generateTaskInboxLocalPart(workspaceId);
    expect(localPart).toMatch(/^t-a1b2c3d4-[a-f0-9]{8}$/);
  });

  it("builds full inbox email address", () => {
    expect(buildInboxEmailAddress("n-a1b2c3d4-deadbeef", "inbound.badazztasks.com")).toBe(
      "n-a1b2c3d4-deadbeef@inbound.badazztasks.com",
    );
  });
});