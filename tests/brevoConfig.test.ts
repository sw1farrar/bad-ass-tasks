import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { isBrevoConfigured } from "@/lib/brevo/config";

describe("brevo config", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns false when API key is missing or placeholder", () => {
    delete process.env.BREVO_API_KEY;
    process.env.BREVO_SENDER_EMAIL = "test@example.com";
    expect(isBrevoConfigured()).toBe(false);

    process.env.BREVO_API_KEY = "PASTE_YOUR_XKEYSIB_KEY_HERE";
    expect(isBrevoConfigured()).toBe(false);
  });

  it("returns true when API key and sender email are valid", () => {
    process.env.BREVO_API_KEY = "xkeysib-test-key";
    process.env.BREVO_SENDER_EMAIL = "sender@example.com";
    expect(isBrevoConfigured()).toBe(true);
  });
});