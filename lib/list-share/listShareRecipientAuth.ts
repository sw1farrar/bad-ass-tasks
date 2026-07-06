export type ListShareRecipientInvite = {
  invitedUserId?: string | null;
  recipientEmail?: string | null;
};

export function normalizeListShareEmail(value: string | null | undefined): string | null {
  const trimmed = value?.trim().toLowerCase();
  return trimmed || null;
}

/**
 * Returns true when the signed-in user may accept/decline/view workspaces for a list share.
 * Matches decline_list_share_invite: user id OR recipient email must match.
 */
export function isListShareRecipient(
  invite: ListShareRecipientInvite,
  user: { id: string; email?: string | null },
): boolean {
  if (invite.invitedUserId && invite.invitedUserId === user.id) {
    return true;
  }

  const recipientEmail = normalizeListShareEmail(invite.recipientEmail);
  const userEmail = normalizeListShareEmail(user.email);
  if (recipientEmail && userEmail && recipientEmail === userEmail) {
    return true;
  }

  return false;
}

export function listShareRecipientMismatchMessage(
  invite: ListShareRecipientInvite,
): string {
  if (invite.recipientEmail) {
    return "This share was sent to a different email address. Sign out and open the link again with the invited account.";
  }
  return "This share was sent to a different Badazz Tasks account.";
}