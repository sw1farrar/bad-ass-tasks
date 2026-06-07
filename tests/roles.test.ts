import { describe, expect, it } from "vitest";
import { formatRoleLabel, fromDbRole, toDbRole } from "@/lib/roles";

describe("roles", () => {
  it("maps DB user role to member in the app", () => {
    expect(fromDbRole("user")).toBe("member");
    expect(toDbRole("member")).toBe("user");
  });

  it("formats role labels for UI", () => {
    expect(formatRoleLabel("user")).toBe("Member");
    expect(formatRoleLabel("member")).toBe("Member");
    expect(formatRoleLabel("admin")).toBe("Admin");
    expect(formatRoleLabel("owner")).toBe("Owner");
  });
});