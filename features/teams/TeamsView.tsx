"use client";

import React from "react";
import { 
  Users, Plus, Search, X, Loader2, Trash2, Repeat 
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * TeamsView
 *
 * Teams & Collaboration domain shell (M0 Batch 2.17 - initial extraction).
 *
 * This is the first-cut shell for the previously monolithic renderTeamsView (~990 LOC).
 *
 * CURRENT STATUS (safe incremental):
 * - Presentation + layout only.
 * - All business logic, handlers, store access, invite creation, role changes,
 *   member removal, admin dashboard actions (export/import/templates/insights),
 *   search debounce, realtime presence, empty-owner special state predicates,
 *   and every demo/live guard remain in app/page.tsx.
 *
 * GUARD NOTE (critical):
 * Do NOT add direct calls to useTaskStore, hybridStore, sendInvite, removeWorkspaceMember,
 * changeMemberRole, fetchMembers, isSupabaseConfigured, or any workspace/role checks here.
 * All of that must continue to live in the parent orchestrator during M0.
 *
 * Future batches will gradually pull stable sub-components (InviteDialog, MemberRow,
 * AdminDashboard, etc.) once the wiring is proven stable.
 */

export interface TeamsViewProps {
  // Core data (passed from parent)
  members: any[];
  invites: any[];
  onlineUsers: any[];
  currentWorkspace: any;
  user: any;

  // Role / permission flags (computed in parent)
  myRole: string;
  canManage: boolean;
  isLive: boolean;
  isDemoWs: boolean;
  isSingleOwnerWorkspace: boolean;
  isLiveWorkspace: boolean;
  isLoadingMembers: boolean;

  teamSearchQuery: string;
  setTeamSearchQuery: (q: string) => void;
  teamSearchResults: any[];
  isSearchingTeam: boolean;
  showDirectInvite: boolean;
  setShowDirectInvite: (v: boolean) => void;
  inviteEmail: string;
  setInviteEmail: (v: string) => void;
  showInviteDialog: boolean;
  setShowInviteDialog: (v: boolean) => void;
  isSendingInvite: boolean;
  copiedInviteId: string | null;

  // Callbacks (all heavy logic stays in parent)
  onRefresh: () => void;
  onInviteMember: () => void;
  onManualAccept: () => void;
  onSendInvite: () => void;
  onCopyInviteLink: (inviteId: string) => void;
  onResendInvite: (inviteId: string, label: string) => void;
  onRevokeInvite: (inviteId: string, label: string) => void;
  onRoleChange: (userId: string, newRole: "owner" | "admin" | "user") => void;
  onRemoveMember: (userId: string, label: string) => void;
  onLeaveWorkspace: () => void;
  onSearchPotentialTeammates: (query: string, workspaceId: string) => Promise<any[]>;
  onSearchResultInvite: (result: any) => void;
  onClearSearch: () => void;
  onTeamSearchChange?: (query: string) => void;
  /** Full admin dashboard (tabs, export/import, insights) — rendered from parent until extracted */
  adminDashboard?: React.ReactNode;
  /** Invite modal — rendered from parent */
  inviteDialog?: React.ReactNode;
  /** Role / permissions footnotes below main content */
  footerNotes?: React.ReactNode;
}

export function TeamsView(props: TeamsViewProps) {
  const {
    members,
    invites,
    onlineUsers,
    currentWorkspace,
    user,
    myRole,
    canManage,
    isLive,
    isDemoWs,
    isSingleOwnerWorkspace,
    isLiveWorkspace,
    isLoadingMembers,
    teamSearchQuery,
    setTeamSearchQuery,
    teamSearchResults,
    isSearchingTeam,
    showDirectInvite,
    setShowDirectInvite,
    inviteEmail,
    setInviteEmail,
    showInviteDialog,
    setShowInviteDialog,
    isSendingInvite,
    copiedInviteId,
    onRefresh,
    onInviteMember,
    onManualAccept,
    onSendInvite,
    onCopyInviteLink,
    onResendInvite,
    onRevokeInvite,
    onRoleChange,
    onRemoveMember,
    onLeaveWorkspace,
    onSearchPotentialTeammates,
    onSearchResultInvite,
    onClearSearch,
    onTeamSearchChange,
    adminDashboard,
    inviteDialog,
    footerNotes,
  } = props;

  // === Special modern empty state for owners with no other members yet ===
  // The predicate decision itself stays in the parent (passed via early return or flag).
  // For the first extraction we render the two main branches based on a simple length + role prop.
  const isEmptyOwnerState = myRole === 'owner' && members.length <= 1 && isLiveWorkspace && !isDemoWs;

  if (isEmptyOwnerState) {
    return (
      <div className="max-w-2xl mx-auto pt-12 pb-20">
        <div className="text-center mb-10">
          <div className="mx-auto mb-6 h-20 w-20 rounded-3xl bg-gradient-to-br from-[#c084fc] to-[#a855f7] flex items-center justify-center">
            <Users className="h-10 w-10 text-black" />
          </div>
          <div className="text-4xl font-semibold tracking-tighter mb-3">Team</div>

          {/* Recipient context — only show for non-creators of *this* workspace */}
          {currentWorkspace.role && currentWorkspace.role !== "owner" && (
            <div className="mt-4 mb-2 text-sm text-[#c084fc] bg-[#c084fc]/10 border border-[#c084fc]/20 rounded-xl px-4 py-2 inline-block">
              You were invited to this workspace.
            </div>
          )}
        </div>

        {/* === "Invites sent" — primary focus once any exist (world-class simple feedback) === */}
        {invites.length > 0 && (
          <div className="glass rounded-3xl p-8 border border-white/10 mb-8">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="font-semibold text-xl tracking-tight">Invites sent</div>
                <div className="px-3 py-0.5 rounded-full bg-[#c084fc]/20 text-sm font-mono text-[#c084fc] border border-[#c084fc]/30">
                  {invites.length}
                </div>
              </div>
              <div className="text-xs text-[#71717a] font-mono">Pending</div>
            </div>

            <div className="space-y-3">
              {invites.map((inv, index) => (
                <div key={inv.id} className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition group">
                  <div className="min-w-0">
                    <div className="font-medium truncate">
                      {inv.invitedFullName || (inv.invitedUsername ? `@${inv.invitedUsername}` : "Pending teammate")}
                    </div>
                    <div className="text-xs text-[#71717a] font-mono mt-0.5">
                      {inv.role} • {new Date(inv.createdAt).toLocaleDateString()}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 opacity-80 group-hover:opacity-100 transition">
                    <button
                      onClick={() => onCopyInviteLink(inv.id)}
                      className="btn btn-secondary text-xs px-3 py-1.5"
                    >
                      {copiedInviteId === inv.id ? "Copied!" : "Copy link"}
                    </button>
                    <button
                      onClick={() => onResendInvite(inv.id, inv.invitedFullName || (inv.invitedUsername ? `@${inv.invitedUsername}` : inv.email || "link-only"))}
                      className="btn btn-secondary text-xs px-3 py-1.5 flex items-center gap-1"
                      disabled={!isLive}
                    >
                      <Repeat className="h-3 w-3" /> Resend
                    </button>
                    <button
                      onClick={() => onRevokeInvite(inv.id, inv.invitedFullName || (inv.invitedUsername ? `@${inv.invitedUsername}` : inv.email || "link-only"))}
                      className="p-2 text-red-400 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition"
                      aria-label="Revoke invite"
                      disabled={!isLive}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Prominent user search (Facebook-style "find friends") */}
        <div className="glass rounded-3xl p-8 border border-white/10 mb-8">
          <div className="font-semibold text-lg mb-4 flex items-center gap-2">
            <Search className="h-5 w-5 text-[#c084fc]" /> Search for teammates
          </div>

          <div className="relative">
            <input
              type="text"
              value={teamSearchQuery}
              onChange={(e) => {
                const q = e.target.value;
                setTeamSearchQuery(q);
                onTeamSearchChange?.(q);
              }}
              placeholder="Search by name, @username or city (e.g. Jordan, @alex, Austin)"
              className="input w-full px-5 py-4 text-lg rounded-2xl mb-4 pr-10"
            />
            {teamSearchQuery && (
              <button
                onClick={onClearSearch}
                className="absolute right-4 top-4 text-[#71717a] hover:text-white"
                aria-label="Clear search"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>

          {/* Clickable trigger for direct invite */}
          {teamSearchQuery.trim() && (
            <div
              onClick={() => setShowDirectInvite(!showDirectInvite)}
              className="text-sm text-[#c084fc] hover:underline cursor-pointer mb-4 flex items-center gap-1.5 select-none"
            >
              Not seeing who you're looking for? <span className="font-medium">Invite by email or create a link</span>
            </div>
          )}

          {/* Expanded direct invite form (still controlled from parent state) */}
          {showDirectInvite && (
            <div className="mb-6 space-y-3 border border-white/10 bg-white/5 rounded-2xl p-5">
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="teammate@company.com (optional for link-only)"
                className="input w-full px-4 py-3 rounded-2xl"
              />

              <div className="flex gap-3">
                <button
                  onClick={() => onSendInvite()}
                  disabled={isSendingInvite || !inviteEmail.trim()}
                  className="flex-1 btn btn-primary py-3 text-sm disabled:opacity-60"
                >
                  {isSendingInvite ? "Sending..." : "Send invite"}
                </button>
                <button
                  onClick={async () => {
                    setInviteEmail("");
                    await onSendInvite();
                  }}
                  disabled={isSendingInvite}
                  className="flex-1 btn btn-secondary py-3 text-sm"
                >
                  Create shareable link
                </button>
              </div>

              <div className="text-[11px] text-[#71717a] text-center">
                They’ll receive an email (if provided) or can join via the link.
              </div>
            </div>
          )}

          {isSearchingTeam && (
            <div className="flex items-center gap-2 text-sm text-[#a1a1aa] mb-3 px-1">
              <Loader2 className="h-4 w-4 animate-spin" /> Searching directory...
            </div>
          )}

          {teamSearchResults.length > 0 && (
            <div className="space-y-2 mb-4">
              {teamSearchResults.map((result, idx) => {
                const initial = (result.fullName || result.username || result.email || "?").toString()[0].toUpperCase();
                const displayName = result.fullName || result.username || "User";
                return (
                  <div key={result.id || idx} className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition">
                    <div className="flex items-center gap-3 min-w-0">
                      {result.avatarUrl ? (
                        <img src={result.avatarUrl} alt="" className="h-10 w-10 rounded-full object-cover border border-white/10" />
                      ) : (
                        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-[#c084fc]/80 to-[#a855f7]/80 flex items-center justify-center text-black font-bold flex-shrink-0">
                          {initial}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="font-medium truncate">{displayName}</div>
                        {result.username && <div className="text-xs text-[#c084fc] font-mono">@{result.username}</div>}
                        {result.location && <div className="text-xs text-[#71717a] truncate">📍 {result.location}</div>}
                      </div>
                    </div>
                    <button
                      onClick={() => onSearchResultInvite(result)}
                      className="btn btn-primary px-5 py-2 text-sm flex-shrink-0"
                    >
                      Invite
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {!isSearchingTeam && teamSearchQuery.trim() && teamSearchResults.length === 0 && (
            <div className="text-sm text-[#71717a] mb-4 px-1">
              No matches in the directory.
            </div>
          )}

          <div className="text-[11px] text-[#71717a] mt-4">
            Search name, username or city. Results preview details before you invite.
          </div>
        </div>
      </div>
    );
  }

  // Normal Teams view (members list + presence + admin dashboard)
  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users className="h-8 w-8 text-[#c084fc]" />
          <div className="text-2xl font-semibold tracking-tighter">Team</div>
        </div>
        <div className="flex items-center gap-2">
          {canManage && isLive && !isDemoWs && (
            <button
              onClick={onInviteMember}
              className="btn btn-primary text-sm flex items-center gap-2"
            >
              <Plus className="h-4 w-4" /> Invite
            </button>
          )}
          <button onClick={onManualAccept} className="btn btn-ghost text-xs px-3 py-1.5" disabled={!isLive}>
            Accept invite
          </button>
        </div>
      </div>

      {/* Presence */}
      {onlineUsers.length > 0 && (
        <div className="glass rounded-2xl p-4 border border-white/10">
          <div className="flex flex-wrap gap-2">
            {onlineUsers.map((u) => (
              <div key={u.userId || u.presenceRef} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#00ff9f]/10 text-[#00ff9f] text-xs border border-[#00ff9f]/20">
                <div className="w-1.5 h-1.5 rounded-full bg-[#00ff9f] animate-pulse" />
                {u.fullName || (u.username ? `@${u.username}` : "Online")}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Members list */}
      <div className="glass rounded-2xl border border-white/10 overflow-hidden">
        <div className="px-5 py-3 border-b border-white/10 flex items-center justify-between bg-white/5">
          <div className="font-medium">Members ({members.length})</div>
          {isLoadingMembers && <Loader2 className="h-4 w-4 animate-spin text-[#c084fc]" />}
        </div>

        {members.length === 0 ? (
          <div className="p-8 text-center text-[#71717a] text-sm">No members</div>
        ) : (
          <div className="divide-y divide-white/10 text-sm">
            {members.map((m) => {
              const isSelf = m.userId === user?.id;
              const canActOnThis = canManage && !isSelf;
              return (
                <div key={m.userId} className="px-5 py-3.5 flex items-center gap-4 hover:bg-white/5 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">
                      {m.fullName || (m.username ? `@${m.username}` : "Member")}
                    </div>
                  </div>

                  <div className="text-xs px-2.5 py-1 rounded bg-white/5 border border-white/10 font-mono text-[#a1a1aa]">
                    {m.role}
                  </div>

                  {canActOnThis ? (
                    <div className="flex items-center gap-2">
                      <select
                        value={m.role}
                        onChange={(e) => onRoleChange(m.userId, e.target.value as any)}
                        className="bg-[#111114] border border-white/20 rounded px-2 py-1 text-xs font-mono focus:outline-none focus:border-[#c084fc]"
                        disabled={!isLive}
                      >
                        <option value="user">user</option>
                        <option value="admin">admin</option>
                        <option value="owner">owner</option>
                      </select>
                      <button
                        onClick={() => {
                          const display = m.fullName || (m.username ? `@${m.username}` : "this teammate");
                          onRemoveMember(m.userId, display);
                        }}
                        className="p-1.5 text-red-400 hover:text-red-500 hover:bg-red-500/10 rounded transition"
                        aria-label="Remove member"
                        title="Remove member"
                        disabled={!isLive}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  ) : isSelf ? (
                    <button
                      onClick={onLeaveWorkspace}
                      className="px-3 py-1 text-xs rounded-xl border border-white/20 hover:bg-white/5 text-[#a1a1aa] disabled:opacity-50"
                      disabled={!isLive}
                      title="Leave this workspace (self-service exit)"
                    >
                      Leave team
                    </button>
                  ) : (
                    <div className="text-[10px] text-[#71717a] px-2"></div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pending Invites (owner/admin only) */}
      {canManage && isLive && !isDemoWs && (
        <div className="glass rounded-2xl border border-white/10 overflow-hidden">
          <div className="px-5 py-3 border-b border-white/10 flex items-center justify-between bg-white/5">
            <div className="font-medium">Pending Invites ({invites.length})</div>
          </div>
          {invites.length === 0 ? (
            <div className="p-6 text-sm text-[#71717a]">None</div>
          ) : (
            <div className="divide-y divide-white/10 text-sm">
              {invites.map((inv) => (
                <div key={inv.id} className="px-5 py-3 flex items-center gap-3">
                  <div className="flex-1">
                    <div>
                      {inv.invitedFullName || (inv.invitedUsername ? `@${inv.invitedUsername}` : "Link-only invite")}
                    </div>
                    <div className="text-[11px] text-[#71717a] font-mono">{inv.role}</div>
                  </div>
                  <button
                    onClick={() => onCopyInviteLink(inv.id)}
                    className="btn btn-secondary text-xs px-3 py-1 flex items-center gap-1"
                  >
                    {copiedInviteId === inv.id ? "Copied!" : "Copy link"}
                  </button>
                  <button
                    onClick={() => onResendInvite(inv.id, inv.invitedFullName || (inv.invitedUsername ? `@${inv.invitedUsername}` : inv.email || "link-only"))}
                    className="btn btn-secondary text-xs px-2 py-1 flex items-center gap-1"
                    title="Resend fresh invite (new expiry, revokes old)"
                    disabled={!isLive}
                  >
                    <Repeat className="h-3.5 w-3.5" /> Resend
                  </button>
                  <button
                    onClick={() => onRevokeInvite(inv.id, inv.invitedFullName || (inv.invitedUsername ? `@${inv.invitedUsername}` : inv.email || "link-only"))}
                    className="p-1.5 text-red-400 hover:text-red-500 hover:bg-red-500/10 rounded transition"
                    aria-label="Revoke invite"
                    title="Revoke invite"
                    disabled={!isLive}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {canManage && adminDashboard}

      {footerNotes}

      {inviteDialog}
    </div>
  );
}
