import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { buildPasswordResetHtml } from "@/lib/brevo/sendPasswordResetEmail";

describe("password reset email", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv, APP_BASE_URL: "https://badazztasks.com" };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("renders a themed HTML email with the reset code", () => {
    const html = buildPasswordResetHtml({ to: "user@example.com", code: "739204" });

    expect(html).toContain("739204");
    expect(html).toContain("Badazz Tasks");
    expect(html).toContain("Reset your password");
    expect(html).toContain("https://badazztasks.com/login?mode=reset-verify");
    expect(html).toContain("recovery code");
  });

  it("escapes HTML in the reset code", () => {
    const html = buildPasswordResetHtml({ to: "user@example.com", code: "<script>" });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});