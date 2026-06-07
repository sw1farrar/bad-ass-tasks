import { randomBytes } from "crypto";

/** Short stable prefix from a workspace UUID for inbox local-parts. */
export function workspaceIdToInboxPrefix(workspaceId: string): string {
  return workspaceId.replace(/-/g, "").slice(0, 8).toLowerCase();
}

function randomToken(bytes = 4): string {
  return randomBytes(bytes).toString("hex");
}

/**
 * Generate a mailbox local-part for note email inboxes.
 * Example: n-a1b2c3d4-x9y8z7w6 → n-a1b2c3d4-x9y8z7w6@inbound.badazztasks.com
 */
export function generateNoteInboxLocalPart(workspaceId: string): string {
  const prefix = workspaceIdToInboxPrefix(workspaceId);
  return `n-${prefix}-${randomToken()}`;
}

/** @deprecated Use generateNoteInboxLocalPart */
export function generateInboxLocalPart(workspaceId: string): string {
  return generateNoteInboxLocalPart(workspaceId);
}

/**
 * Generate a mailbox local-part for task email inboxes.
 * Example: t-a1b2c3d4-x9y8z7w6 → t-a1b2c3d4-x9y8z7w6@inbound.badazztasks.com
 */
export function generateTaskInboxLocalPart(workspaceId: string): string {
  const prefix = workspaceIdToInboxPrefix(workspaceId);
  return `t-${prefix}-${randomToken()}`;
}

export function buildInboxEmailAddress(localPart: string, inboundDomain: string): string {
  return `${localPart}@${inboundDomain}`;
}