/** Workspace membership roles in the app (DB stores the default tier as `user`). */
export type WorkspaceRole = "owner" | "admin" | "member";

export type DbWorkspaceRole = "owner" | "admin" | "user";

export function fromDbRole(role: string | null | undefined): WorkspaceRole {
  if (role === "owner" || role === "admin") return role;
  return "member";
}

export function toDbRole(role: WorkspaceRole): DbWorkspaceRole {
  if (role === "owner" || role === "admin") return role;
  return "user";
}

export function formatRoleLabel(role: WorkspaceRole | DbWorkspaceRole | string | null | undefined): string {
  const normalized = fromDbRole(role ?? "member");
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}