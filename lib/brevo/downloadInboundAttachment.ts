import { getBrevoConfig, isBrevoInboundApiConfigured } from "./config";

export async function downloadBrevoInboundAttachment(downloadToken: string): Promise<{
  buffer: ArrayBuffer;
  contentType: string | null;
}> {
  if (!isBrevoInboundApiConfigured()) {
    throw new Error("brevo_inbound_api_not_configured");
  }

  const { apiKey } = getBrevoConfig();
  const url = `https://api.brevo.com/v3/inbound/attachments/${encodeURIComponent(downloadToken)}`;

  const response = await fetch(url, {
    method: "GET",
    headers: { "api-key": apiKey },
  });

  if (!response.ok) {
    throw new Error(`brevo_attachment_download_${response.status}`);
  }

  const buffer = await response.arrayBuffer();
  const contentType = response.headers.get("content-type");
  return { buffer, contentType };
}