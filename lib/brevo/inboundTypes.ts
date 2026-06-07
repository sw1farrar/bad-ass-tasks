/** Brevo inbound parsing webhook payload (inboundEmailProcessed). */

export type BrevoInboundMailbox = {
  Name?: string | null;
  Address?: string;
};

export type BrevoInboundAttachment = {
  Name: string;
  ContentType?: string;
  ContentLength?: number;
  ContentID?: string;
  DownloadToken?: string;
};

export type BrevoInboundEmailItem = {
  Uuid?: string[];
  Recipients?: string[];
  MessageId?: string;
  InReplyTo?: string | null;
  From?: BrevoInboundMailbox;
  To?: BrevoInboundMailbox[];
  Cc?: BrevoInboundMailbox[];
  Bcc?: BrevoInboundMailbox[];
  ReplyTo?: BrevoInboundMailbox | null;
  SentAtDate?: string;
  Subject?: string;
  RawHtmlBody?: string | null;
  RawTextBody?: string | null;
  ExtractedMarkdownMessage?: string;
  ExtractedMarkdownSignature?: string | null;
  Attachments?: BrevoInboundAttachment[];
  Headers?: Record<string, string | string[]>;
  SpamScore?: number;
  EMLDownloadToken?: string;
};

export type BrevoInboundWebhookPayload = {
  items?: BrevoInboundEmailItem[];
};