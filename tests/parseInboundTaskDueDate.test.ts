import { describe, expect, it } from "vitest";
import {
  buildInboundTaskDescription,
  parseInboundTaskDueDate,
} from "@/lib/brevo/parseInboundTaskDueDate";
import { buildInboundTaskFields } from "@/lib/brevo/inboundTaskContent";
import type { BrevoInboundEmailItem } from "@/lib/brevo/inboundTypes";

const REF = new Date(2026, 5, 7); // Jun 7, 2026 local

describe("parseInboundTaskDueDate", () => {
  it("parses ISO due line and strips it from the body", () => {
    const result = parseInboundTaskDueDate("Due: 2026-06-15\n\nPick up milk", REF);
    expect(result?.dueDate).toMatch(/^2026-06-15/);
    expect(result?.bodyWithoutDueLine).toBe("Pick up milk");
  });

  it("parses relative due dates", () => {
    const tomorrow = parseInboundTaskDueDate("Due: tomorrow\nDetails", REF);
    expect(tomorrow?.dueDate).toMatch(/^2026-06-08/);

    const nextFriday = parseInboundTaskDueDate("Due: next friday\nDetails", REF);
    expect(nextFriday?.dueDate).toBeTruthy();
  });

  it("parses slash dates", () => {
    const result = parseInboundTaskDueDate("Due: 6/15/2026\nHello", REF);
    expect(result?.dueDate).toMatch(/^2026-06-15/);
  });

  it("returns null when no due line exists", () => {
    expect(parseInboundTaskDueDate("Just a normal email body", REF)).toBeNull();
  });

  it("builds task description without the due line", () => {
    const description = buildInboundTaskDescription(
      "Due: 2026-06-15\nCall the vendor",
      "alice@example.com",
    );
    expect(description).toContain("Call the vendor");
    expect(description).not.toContain("Due:");
    expect(description).toContain("alice@example.com");
  });
});

describe("buildInboundTaskFields", () => {
  it("uses subject as title and body due line for due date", () => {
    const item = {
      Subject: "Buy groceries",
      RawTextBody: "Due: 2026-06-20\nGet eggs and bread",
      From: { Address: "me@example.com" },
    } as BrevoInboundEmailItem;

    const fields = buildInboundTaskFields(item, REF);
    expect(fields.title).toBe("Buy groceries");
    expect(fields.dueDate).toMatch(/^2026-06-20/);
    expect(fields.description).toContain("Get eggs and bread");
    expect(fields.description).not.toContain("Due:");
  });
});