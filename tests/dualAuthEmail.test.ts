import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { buildDualAuthHtml } from "@/lib/brevo/sendDualAuthEmail";

describe("dual auth email", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv, APP_BASE_URL: "https://badazztasks.com" };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("renders a themed HTML email with the sign-in code", () => {
    const html = buildDualAuthHtml({ to: "user@example.com", code: "482913" });

    expect(html).toContain("482913");
    expect(html).toContain("Badazz Tasks");
    expect(html).toContain("Verify your sign-in");
    expect(html).toContain("#f4f4f5");
    expect(html).toContain("#7c3aed");
    expect(html).toContain("https://badazztasks.com");
  });

  it("escapes HTML in the sign-in code", () => {
    const html = buildDualAuthHtml({ to: "user@example.com", code: "<script>" });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});