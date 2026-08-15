/** Server-only Brevo inbound parsing configuration. */

import { timingSafeEqual } from "node:crypto";

export function getBrevoInboundDomain(): string {
  return process.env.BREVO_INBOUND_DOMAIN?.trim() || "inbound.badazztasks.com";
}

export function getBrevoInboundWebhookSecret(): string | undefined {
  const secret = process.env.BREVO_INBOUND_WEBHOOK_SECRET?.trim();
  // Prefer long secrets; min 8 kept for existing envs, warn via length checks in authorize.
  return secret && secret.length >= 8 ? secret : undefined;
}

function secretsEqual(provided: string, expected: string): boolean {
  try {
    const a = Buffer.from(provided);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function isBrevoInboundWebhookAuthorized(request: Request): boolean {
  const expected = getBrevoInboundWebhookSecret();
  // Never accept unsigned inbound webhooks in production — missing secret is an open injection vector.
  if (!expected) {
    return process.env.NODE_ENV !== "production";
  }

  const headerSecret = request.headers.get("x-brevo-inbound-secret")?.trim() ?? "";
  if (headerSecret && secretsEqual(headerSecret, expected)) return true;

  // Query-string secrets leak via access logs / proxies — allow only outside production.
  if (process.env.NODE_ENV !== "production") {
    try {
      const url = new URL(request.url);
      const querySecret = url.searchParams.get("secret")?.trim() ?? "";
      if (querySecret && secretsEqual(querySecret, expected)) return true;
    } catch {
      // ignore
    }
  }

  return false;
}