# World-Class Invite & Membership Lifecycle Improvements

**Date**: 2026-05-26  
**Status**: Core implementation complete (per user directive to proceed aggressively with all expert consensus)  
**Goal**: Every terminating action (send/revoke/decline/accept + owner remove + self-exit) must be **instant, symmetric, zero-orphan, survives hard refresh** for all parties.

## 1. Database Layer (Atomic + Reliable Realtime)

**File**: `supabase/fix-invite-lifecycle-rls-and-rpcs.sql` (new, comprehensive migration)

- `REPLICA IDENTITY FULL` + `ALTER PUBLICATION` on `notifications`, `workspace_invites`, `workspace_members` (fixes DELETE delivery fragility — root cause of lingering banners).
- Symmetric DELETE policies:
  - Users delete own notifications.
  - Targets delete own pending invites.
  - Self-removal from workspace_members.
  - Hardened owner/admin invite-notif delete.
- SECURITY DEFINER RPCs (gold standard per RLS, Realtime, Member Removal, Concurrency, Holistic, Zustand experts):
  - `revoke_workspace_invite`
  - `decline_workspace_invite`
  - `exit_workspace` (last-owner protected)
  - Enhanced `accept_workspace_invite` (now cleans powering notification)
- Orphan cleanup helper.

**Run this file** in the Supabase SQL editor for the changes to take effect.

## 2. Data Layer (`lib/data/hybridStore.ts`)

- `revokeInvite`: Now prefers `revoke_workspace_invite` RPC (atomic) with graceful fallback.
- New wrappers: `declineInvite`, `exitWorkspace`, `cleanupOrphanInviteNotifications`.
- **New central helper** (Zustand expert recommendation): `cleanupInviteEverywhere(inviteId, reason)` — single place for all terminating actions.
- `removeMember`: Now performs best-effort cleanup of related invites (by invited_by or invited_user_id) + notifications for the removed user in that workspace (closes major orphan gap flagged by Member Removal expert).
- `subscribeToWorkspaceRealtime`: Ready for extension to invites/members (publication now includes the tables).

## 3. State Layer (`store/useTaskStore.ts`)

- New action: `exitWorkspace(workspaceId?)` — full optimistic UI + server authority via RPC + rollback on failure + auto workspace switch + toasts + safety fetches. Self can now leave the team symmetrically.
- `declineReceivedInvite`: Now uses the central `cleanupInviteEverywhere` helper (RPC-preferred).
- `removeWorkspaceMember`: Now also refreshes `fetchInvites()` + `fetchNotifications()` after success (survivor consistency).
- `acceptInviteLink`: Now uses central cleanup helper for powering notifications.
- Notifications realtime DELETE handler hardened (robust payload handling for partial DELETEs, always force refetch + unread refresh, better logging) — per Realtime + Zustand experts.
- Interface updated for new action.

## 4. UI Layer (`app/page.tsx`)

- **"Leave team" button** in the Members list: Visible for the current user when they are not an owner/admin (symmetric self-exit). Calls `exitWorkspace` with confirmation. Directly fulfills "the user exits the team" requirement.
- Banner Decline handler: Extra safety-net `fetchNotifications` after decline.
- Display hardening (Profile Privacy expert):
  - Members list: No more `Member ${userId.slice(0,8)}` — now "Unknown teammate".
  - Remove confirm and display vars: Clean friendly names only (no partial UUID leaks).
  - Online users presence labels: Prefer fullName / @username over raw email or partial ID.
- All primary "Invites sent" and members rendering already had strong privacy discipline; these changes close the remaining fallback gaps.

## 5. Expert Consensus Incorporated

- **RLS**: Symmetric policies + RPCs (done).
- **Realtime/DELETE**: REPLICA FULL + publication + handler hardening (done).
- **Member Removal/Self-Exit**: Self-exit UI + action + removal cleanup (done); RPC recommended (SQL has exit; remove RPC can be added next).
- **Concurrency/Resilience**: Central helper, hardened fallbacks, awareness of races/hard-refresh windows (addressed via RPCs + always-refetch + optimistic patterns).
- **Holistic/E2E**: Self-exit + cleanup + recognition of blast radius to presence/live-collab (teardown patterns already strong; event bus is a natural future extension).
- **Zustand/Optimistic**: Central helper, better DELETE handling, reduced ad-hoc direct deletes.
- **Profile Privacy**: Fixed UUID/email fallbacks in Teams surfaces; noted snapshot denormalization as future polish.

## 6. Remaining Polish / Future (Low Priority)

- Wire workspace-scoped `postgres_changes` for `workspace_invites` + `workspace_members` (easy extension to existing realtime setup; publication already done).
- Add `remove_workspace_member` SECURITY DEFINER RPC (recommended by Member Removal expert for full atomicity on removal, mirroring the other terminating actions).
- Snapshot name denormalization at invite creation time (Profile expert — eliminates late-profile hydration issues).
- Lightweight membership event bus (Holistic) for even cleaner decoupling.
- Force resync primitive on long offline/reconnect (Concurrency).

## 7. How to Verify (Next Phase)

Run the SQL migration first.

Test matrix (all paths, both sides, hard refresh, multi-tab, concurrent):
- Owner sends invite → Recipient sees banner + bell instantly.
- Owner revokes → Recipient banner/bell gone instantly (online + hard refresh).
- Recipient declines → Sender "Invites sent" clears; no orphan.
- Recipient accepts → Banner gone; member appears; no orphan.
- Owner removes member → Removed user loses access (fetchUserWorkspaces drops it); survivors see clean list; invites/notifs cleaned.
- Member self-exits via "Leave team" → Same as above, symmetric.
- All under hard refresh mid-flow, offline window + reconnect, multiple tabs for same user.

All changes follow the existing high-quality patterns (optimistic + server authority + realtime + fetch fallback + excellent logging + demo guards).

The system now treats the full membership graph with the same rigor previously applied only to the invite creation side.

**Ready for user verification and any final polish.**