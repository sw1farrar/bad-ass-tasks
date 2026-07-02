/** Server-only Brevo configuration (never import from client components). */

const PLACEHOLDER_KEYS = new Set([
  "PASTE_YOUR_XKEYSIB_KEY_HERE",
  "xkeysib-your-api-key-here",
]);

function isValidBrevoApiKey(apiKey: string | undefined): apiKey is string {
  if (!apiKey) return false;
  if (PLACEHOLDER_KEYS.has(apiKey)) return false;
  return apiKey.startsWith("xkeysib-");
}

/** Inbound attachment/EML downloads only need a valid API key. */
export function isBrevoInboundApiConfigured(): boolean {
  return isValidBrevoApiKey(process.env.BREVO_API_KEY?.trim());
}

export function isBrevoConfigured(): boolean {
  const apiKey = process.env.BREVO_API_KEY?.trim();
  const senderEmail = process.env.BREVO_SENDER_EMAIL?.trim();
  if (!isValidBrevoApiKey(apiKey) || !senderEmail || !senderEmail.includes("@")) return false;
  if (process.env.NODE_ENV === "production" && !process.env.APP_BASE_URL?.trim()) {
    return false;
  }
  return true;
}

function resolveAppBaseUrl(): string {
  const configured = process.env.APP_BASE_URL?.trim();
  if (configured) return configured;
  if (process.env.NODE_ENV === "production") {
    console.error("[brevo] APP_BASE_URL is required in production email links.");
  }
  return "http://localhost:3000";
}

export function getBrevoConfig() {
  return {
    apiKey: process.env.BREVO_API_KEY?.trim() ?? "",
    senderEmail: process.env.BREVO_SENDER_EMAIL?.trim() ?? "",
    senderName: process.env.BREVO_SENDER_NAME?.trim() || "Badazz Tasks",
    appBaseUrl: resolveAppBaseUrl(),
    inviteTemplateId: process.env.BREVO_INVITE_TEMPLATE_ID?.trim(),
    listShareTemplateId: process.env.BREVO_LIST_SHARE_TEMPLATE_ID?.trim(),
    listShareAcceptedTemplateId: process.env.BREVO_LIST_SHARE_ACCEPTED_TEMPLATE_ID?.trim(),
  };
}