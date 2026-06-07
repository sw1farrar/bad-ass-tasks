export { isBrevoConfigured, getBrevoConfig } from "./config";
export { buildTransactionalHtml, buildTransactionalPlainText } from "./emailLayout";
export { sendBrevoTransactionalEmail } from "./sendBrevoTransactional";
export {
  sendWorkspaceInviteEmail,
  buildInviteHtml,
  type WorkspaceInviteEmailParams,
} from "./sendWorkspaceInviteEmail";
export {
  sendVerificationEmail,
  buildVerificationHtml,
  type VerificationEmailParams,
} from "./sendVerificationEmail";
export {
  sendDualAuthEmail,
  buildDualAuthHtml,
  type DualAuthEmailParams,
} from "./sendDualAuthEmail";
export {
  getBrevoInboundDomain,
  getBrevoInboundWebhookSecret,
  isBrevoInboundWebhookAuthorized,
} from "./inboundConfig";
export { processInboundEmail, type ProcessInboundEmailResult } from "./processInboundEmail";
export { parseInboundRecipientLocalPart } from "./parseInboundRecipient";
export type { BrevoInboundWebhookPayload, BrevoInboundEmailItem } from "./inboundTypes";