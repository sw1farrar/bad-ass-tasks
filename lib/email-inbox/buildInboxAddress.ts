import { buildInboxEmailAddress } from "./generateInboxLocalPart";
import { getBrevoInboundDomain } from "@/lib/brevo/inboundConfig";

export function formatInboxEmailAddress(localPart: string): string {
  return buildInboxEmailAddress(localPart, getBrevoInboundDomain());
}