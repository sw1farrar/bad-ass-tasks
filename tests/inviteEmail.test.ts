import { describe, it, expect } from "vitest";
import { buildInviteHtml } from "@/lib/brevo/sendWorkspaceInviteEmail";

describe("workspace invite email", () => {
  it("renders a themed invite email with the invite landing link", () => {
    const html = buildInviteHtml(
      {
        to: "newuser@example.com",
        inviterName: "Alex",
        workspaceName: "Product Team",
        inviteId: "11111111-1111-4111-8111-111111111111",
        role: "user",
      },
      "https://badazztasks.com/invite/11111111-1111-4111-8111-111111111111",
    );

    expect(html).toContain("Badazz Tasks");
    expect(html).toContain("You&apos;re invited");
    expect(html).toContain("Alex");
    expect(html).toContain("Product Team");
    expect(html).toContain("https://badazztasks.com/invite/11111111-1111-4111-8111-111111111111");
    expect(html).toContain("#0a0a0f");
    expect(html).toContain("#c084fc");
    expect(html).toContain("set your password");
  });
});