/** Server-only Brevo inbound parsing configuration. */

export function getBrevoInboundDomain(): string {
  return process.env.BREVO_INBOUND_DOMAIN?.trim() || "inbound.badazztasks.com";
}

export function getBrevoInboundWebhookSecret(): string | undefined {
  const secret = process.env.BREVO_INBOUND_WEBHOOK_SECRET?.trim();
  return secret && secret.length >= 8 ? secret : undefined;
}

export function isBrevoInboundWebhookAuthorized(request: Request): boolean {
  const expected = getBrevoInboundWebhookSecret();
  if (!expected) return true;

  const headerSecret = request.headers.get("x-brevo-inbound-secret")?.trim();
  if (headerSecret && headerSecret === expected) return true;

  try {
    const url = new URL(request.url);
    const querySecret = url.searchParams.get("secret")?.trim();
    if (querySecret && querySecret === expected) return true;
  } catch {
    // ignore
  }

  return false;
}