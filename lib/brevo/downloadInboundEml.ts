import { downloadBrevoInboundAttachment } from "./downloadInboundAttachment";

/** Download raw .eml source via Brevo EMLDownloadToken (same attachments API). */
export async function downloadBrevoInboundEml(emlDownloadToken: string): Promise<{
  buffer: ArrayBuffer;
  contentType: string | null;
}> {
  return downloadBrevoInboundAttachment(emlDownloadToken);
}