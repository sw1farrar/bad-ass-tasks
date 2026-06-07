/** Server-only Brevo configuration (never import from client components). */

const PLACEHOLDER_KEYS = new Set([
  "PASTE_YOUR_XKEYSIB_KEY_HERE",
  "xkeysib-your-api-key-here",
]);

export function isBrevoConfigured(): boolean {
  const apiKey = process.env.BREVO_API_KEY?.trim();
  const senderEmail = process.env.BREVO_SENDER_EMAIL?.trim();
  if (!apiKey || !senderEmail || !senderEmail.includes("@")) return false;
  if (PLACEHOLDER_KEYS.has(apiKey)) return false;
  return apiKey.startsWith("xkeysib-");
}

export function getBrevoConfig() {
  return {
    apiKey: process.env.BREVO_API_KEY?.trim() ?? "",
    senderEmail: process.env.BREVO_SENDER_EMAIL?.trim() ?? "",
    senderName: process.env.BREVO_SENDER_NAME?.trim() || "Badazz Tasks",
    appBaseUrl: process.env.APP_BASE_URL?.trim() || "http://localhost:3000",
    inviteTemplateId: process.env.BREVO_INVITE_TEMPLATE_ID?.trim(),
  };
}