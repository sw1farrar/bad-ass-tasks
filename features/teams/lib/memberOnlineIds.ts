/**
 * Presence can briefly include non-members or drop the local user during
 * reconnect. Team UI should only count workspace members, and always treat
 * the signed-in user as online while they're on the app.
 */
export function buildMemberOnlineUserIds(
  onlineUsers: Array<{ userId?: string | null }>,
  members: Array<{ userId?: string | null }>,
  currentUserId?: string | null,
): Set<string> {
  const memberIds = new Set(
    members.map((m) => m.userId).filter((id): id is string => !!id),
  );
  const online = new Set<string>();

  for (const user of onlineUsers) {
    const id = user.userId;
    if (id && memberIds.has(id)) online.add(id);
  }

  if (currentUserId && memberIds.has(currentUserId)) {
    online.add(currentUserId);
  }

  return online;
}

/** Stable signature for presence lists used to skip no-op store updates. */
export function onlineUsersSignature(
  users: Array<{
    userId?: string | null;
    view?: string | null;
    editingItemId?: string | null;
  }>,
): string {
  return users
    .map(
      (u) =>
        `${u.userId ?? ""}:${u.view ?? ""}:${u.editingItemId ?? ""}`,
    )
    .sort()
    .join("|");
}
