import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { isBrevoInboundWebhookAuthorized } from "@/lib/brevo/inboundConfig";

describe("isBrevoInboundWebhookAuthorized", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("allows requests in development when secret is not configured", () => {
    delete process.env.BREVO_INBOUND_WEBHOOK_SECRET;
    vi.stubEnv("NODE_ENV", "development");
    const request = new Request("http://localhost:3000/api/webhooks/brevo-inbound", {
      method: "POST",
    });
    expect(isBrevoInboundWebhookAuthorized(request)).toBe(true);
  });

  it("rejects requests in production when secret is not configured", () => {
    delete process.env.BREVO_INBOUND_WEBHOOK_SECRET;
    vi.stubEnv("NODE_ENV", "production");
    const request = new Request("http://localhost:3000/api/webhooks/brevo-inbound", {
      method: "POST",
    });
    expect(isBrevoInboundWebhookAuthorized(request)).toBe(false);
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

  it("rejects query-string secrets in production", () => {
    process.env.BREVO_INBOUND_WEBHOOK_SECRET = "test-secret-value";
    vi.stubEnv("NODE_ENV", "production");
    const viaQuery = new Request(
      "http://localhost:3000/api/webhooks/brevo-inbound?secret=test-secret-value",
      { method: "POST" },
    );
    expect(isBrevoInboundWebhookAuthorized(viaQuery)).toBe(false);
  });

  it("allows query-string secrets outside production", () => {
    process.env.BREVO_INBOUND_WEBHOOK_SECRET = "test-secret-value";
    vi.stubEnv("NODE_ENV", "development");
    const viaQuery = new Request(
      "http://localhost:3000/api/webhooks/brevo-inbound?secret=test-secret-value",
      { method: "POST" },
    );
    expect(isBrevoInboundWebhookAuthorized(viaQuery)).toBe(true);
  });
});
