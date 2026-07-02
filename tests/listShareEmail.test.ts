import { describe, it, expect } from "vitest";
import { buildListShareHtml } from "@/lib/brevo/sendListShareEmail";
import { buildListShareAcceptedHtml } from "@/lib/brevo/sendListShareAcceptedEmail";

describe("list share emails", () => {
  it("renders initial share email with list-share link", () => {
    const html = buildListShareHtml(
      {
        to: "friend@example.com",
        sharerName: "Alex",
        listTitle: "Grocery run",
        sourceWorkspaceName: "Home",
        shareId: "22222222-2222-4222-8222-222222222222",
      },
      "https://badazztasks.com/list-share/22222222-2222-4222-8222-222222222222",
    );

    expect(html).toContain("Badazz Tasks");
    expect(html).toContain("Shared list");
    expect(html).toContain("Grocery run");
    expect(html).toContain("Home");
    expect(html).toContain("https://badazztasks.com/list-share/22222222-2222-4222-8222-222222222222");
  });

  it("renders acceptance confirmation email with lists deep link", () => {
    const html = buildListShareAcceptedHtml(
      {
        to: "friend@example.com",
        sharerName: "Alex",
        listTitle: "Grocery run",
        sourceWorkspaceName: "Home",
        targetWorkspaceName: "Personal",
        listId: "33333333-3333-4333-8333-333333333333",
        targetWorkspaceId: "44444444-4444-4444-8444-444444444444",
      },
      "https://badazztasks.com/?view=lists&workspace=44444444-4444-4444-8444-444444444444&highlightList=33333333-3333-4333-8333-333333333333",
    );

    expect(html).toContain("List share accepted");
    expect(html).toContain("Personal");
    expect(html).toContain("highlightList=33333333-3333-4333-8333-333333333333");
  });
});