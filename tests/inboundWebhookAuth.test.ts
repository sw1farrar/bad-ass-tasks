import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { isBrevoInboundWebhookAuthorized } from "@/lib/brevo/inboundConfig";

describe("isBrevoInboundWebhookAuthorized", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("allows all requests when secret is not configured", () => {
    delete process.env.BREVO_INBOUND_WEBHOOK_SECRET;
    const request = new Request("http://localhost:3000/api/webhooks/brevo-inbound", {
      method: "POST",
    });
    expect(isBrevoInboundWebhookAuthorized(request)).toBe(true);
  });

  it("requires matching header when secret is configured", () => {
    process.env.BREVO_INBOUND_WEBHOOK_SECRET = "test-secret-value";
    const ok = new Request("http://localhost:3000/api/webhooks/brevo-inbound", {
      method: "POST",
      headers: { "x-brevo-inbound-secret": "test-secret-value" },
    });
    const bad = new Request("http://localhost:3000/api/webhooks/brevo-inbound", {
      method: "POST",
    });
    expect(isBrevoInboundWebhookAuthorized(ok)).toBe(true);
    expect(isBrevoInboundWebhookAuthorized(bad)).toBe(false);
  });
});