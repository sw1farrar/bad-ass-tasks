import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { isBrevoInboundApiConfigured, isBrevoConfigured } from "@/lib/brevo/config";

describe("brevo inbound API config", () => {
  const env = process.env;

  beforeEach(() => {
    process.env = { ...env };
  });

  afterEach(() => {
    process.env = env;
  });

  it("allows inbound downloads with only a valid API key", () => {
    process.env.BREVO_API_KEY = "xkeysib-test-key";
    delete process.env.BREVO_SENDER_EMAIL;
    delete process.env.APP_BASE_URL;

    expect(isBrevoInboundApiConfigured()).toBe(true);
    expect(isBrevoConfigured()).toBe(false);
  });

  it("rejects placeholder API keys for inbound downloads", () => {
    process.env.BREVO_API_KEY = "PASTE_YOUR_XKEYSIB_KEY_HERE";
    expect(isBrevoInboundApiConfigured()).toBe(false);
  });
});