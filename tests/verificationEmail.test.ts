import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { buildVerificationHtml } from "@/lib/brevo/sendVerificationEmail";

describe("verification email", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv, APP_BASE_URL: "https://badazztasks.com" };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("renders a themed HTML email with the verification code", () => {
    const html = buildVerificationHtml({ to: "user@example.com", code: "482913" });

    expect(html).toContain("482913");
    expect(html).toContain("Badazz Tasks");
    expect(html).toContain("Verify your email");
    expect(html).toContain("#f4f4f5");
    expect(html).toContain("#7c3aed");
    expect(html).toContain("https://badazztasks.com");
    expect(html).toContain("Get shit done. Beautifully.");
  });

  it("escapes HTML in the verification code", () => {
    const html = buildVerificationHtml({ to: "user@example.com", code: "<script>" });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});