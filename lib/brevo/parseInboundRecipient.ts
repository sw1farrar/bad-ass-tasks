import type { BrevoInboundEmailItem } from "./inboundTypes";

function normalizeEmailAddress(raw: string): string | null {
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed.includes("@")) return null;
  return trimmed;
}

function localPartFromAddress(address: string, inboundDomain: string): string | null {
  const normalized = normalizeEmailAddress(address);
  if (!normalized) return null;

  const suffix = `@${inboundDomain.toLowerCase()}`;
  if (!normalized.endsWith(suffix)) return null;

  const local = normalized.slice(0, -suffix.length);
  return local.length > 0 ? local : null;
}

/** Collect candidate recipient addresses from a parsed inbound email item. */
export function collectInboundRecipientAddresses(item: BrevoInboundEmailItem): string[] {
  const addresses: string[] = [];

  for (const raw of item.Recipients ?? []) {
    if (typeof raw === "string" && raw.trim()) addresses.push(raw.trim());
  }

  for (const mailbox of item.To ?? []) {
    if (mailbox?.Address?.trim()) addresses.push(mailbox.Address.trim());
  }

  return addresses;
}

/**
 * Resolve the inbox local-part (e.g. n-a1b2c3d4-x9y8z7w6) from Brevo payload recipients.
 * Returns null when no address targets the configured inbound domain.
 */
export function parseInboundRecipientLocalPart(
  item: BrevoInboundEmailItem,
  inboundDomain: string,
): string | null {
  for (const address of collectInboundRecipientAddresses(item)) {
    const localPart = localPartFromAddress(address, inboundDomain);
    if (localPart) return localPart;
  }
  return null;
}