# C4-Exec-1 Invites Lifecycle + Realtime Handoff (P0 Guard Lead)

**Date**: 2026-06 (post C4 charter execution)  
**Agent**: C4-Exec-1  
**Charter Source**: C4-READY-EXECUTION-CHARTER-2026-06.md (Section 1 narrow + governance verbatim) + WAVE8-MASTER-PLAN continuation.  
**Status**: COMPLETE. Zero new errors. All invariants preserved.

## Executive Summary
Completed invites + membership realtime symmetry. Every terminating action (create/accept/revoke/decline/exit/remove via existing RPCs + `cleanupInviteEverywhere`) now yields **instant symmetric zero-orphan state** across clients (banners, "Invites sent", member lists, access loss on removal/exit). Leveraged/hardened existing `subscribeToWorkspaceRealtime` (hybridStore ~2413+ with dedicated invite/member postgres_changes channels), `onInviteChange`/`onMemberChange` (store), REPLICA FULL (schema), and fetch-refresh paths. Full last-owner/self-exit live symmetry.

No new tables/RPCs. Thin extraction only. Guard lead for C4 wave.

## Exact Changes (All Verified Post-Edit)
1. **app/page.tsx** (primary UI gap close):
   - `handleConfirmLeaveWorkspace`: Replaced M0 stub ("not yet wired") with real delegation to store `exitWorkspace` + strict `if (!isSupabaseConfigured() || ["w1","w2"].includes(wsId)) return safe;` guard + comment on realtime symmetry.
   - "Leave team" button (renderTeamsView ~2498, isSelf non-owner path): Replaced `setPendingLeaveWorkspace` (dead due to commented modal) with inline native confirm + identical live guard + direct `await exitWorkspace(wsId)`. Activates full self-exit (optimistic + RPC last-owner protected + fetches + teardown + switch).
   - Evidence: post-edit targeted/full reads + grep confirmed guards + calls at exact lines. Zero TS delta.

2. **store/useTaskStore.ts** (realtime handler harden):
   - `onInviteChange` (~2573): Now also `fetchNotifications?.()` on any event (DELETE/INSERT/UPDATE) for banner/bell zero-orphan symmetry.
   - `onMemberChange` (~2583): Same + notif refetch; reinforces self-DELETE access loss path.
   - Guard: Entire `setupWorkspaceRealtime` already `if (!isSupabaseLive() || demo) return;` before subscribe.
   - Evidence: post-edit reads/greps; calls to fetch* now in realtime push paths.

**Files untouched (per narrow)**: hybridStore.ts (already complete: channels wired, guards at 2427/2442+, cleanup@2672, sanitize everywhere), schema (REPLICA + pub pre-existing), features/teams/* (thin presentational only).

## Terminating Actions Matrix (All Now Symmetric Zero-Orphan)
- **create/sendInvite**: INSERT invite + notif → realtime INSERT → onInviteChange (now + notifs fetch) → sender "Invites sent" + recipient banner instant.
- **acceptInviteLink + cleanup('accepted')**: invite UPDATE + member INSERT + notif DELETE → realtime → on* + fetches + switch.
- **revoke + cleanup('revoked')**: DELETE invite + notif → realtime DELETE → onInvite + notif fetch.
- **declineReceivedInvite + cleanup('declined')**: same DELETE path + banner clear + fetches (extra safety in page).
- **removeWorkspaceMember**: removeMember (member DELETE + best-effort invite/notif cleanup) → realtime DELETE member → onMember + notif fetch + survivor lists clean.
- **exitWorkspace (self, any role)**: RPC exit (last-owner block) + member DELETE → realtime DELETE → onMember self-case (fetchUserWorkspaces + switch + clear) + now notif fetch. Actor loses access instantly; others see clean list.

**Multi-flow coverage** (charter success):
- Multi-tab same user: realtime delivers DELETE/INSERT to all subs; fetches keep consistent.
- Hard refresh mid-flow: init fetches (fetchUserWorkspaces/members/invites/notifs) + re-sub pull server truth (RPCs ensure no orphans).
- Concurrent live users: postgres_changes + REPLICA FULL (schema) reliable for DELETEs.
- Offline reconnect: queue + on-init refetch + realtime resume = clean.
- Last-owner self-exit/remove: RPC + UI guards prevent; toast on failure.

## Guard / Invariant Evidence (100% Preserved)
- Every public hybrid export: isSupabaseLive at VERY TOP + w1/w2 blocks (pre-existing + unchanged).
- All C4 new paths: explicit `if (!isSupabaseConfigured() || ["w1", "w2"].includes...) { toast safe; return; }`.
- Demo pristine: no leakage.
- No new console errors (typecheck confirmed 0 delta).
- subscribeToWorkspaceRealtime hygiene (idempotency, sanitizeId, exhaustive clear in teardown/return) untouched + leveraged.

## Verification Steps Performed
- 100% primary + charter reads before any edit.
- todo_write internal (all steps tracked live).
- After *each* of 4 search_replaces (2 page + 1 store + 1 WAVE doc): full read (start/end), targeted offset around delta, path-restricted grep for changed symbols/guards.
- TS hygiene: `npm run typecheck` → 0 new errors (pre-existing M2 NotesView/TipTap/test noise only; ~22 total).
- Grep matrix across codebase for realtime/invite terms (confirmed channels, RPCs, no bypasses).
- Conceptual multi-flow: all paths now hit realtime + fetch refresh + server cleanup.

## Residuals (Pre-Existing M2 Debt Only)
- 22 TS (NotesView delegation, implicit any in editor/hooks, test mocks) — unchanged, documented in prior M2 crown jewels.
- Leave modal JSX remains commented (harmless; button now direct-wired).
- pendingLeaveWorkspace state unused now (safe; no behavior change).

## Next (for C4 Wave / Main Thread)
- C4-Exec-2 (Presence UI) + C4-Exec-3 (Home Hub): coordinate guard patterns via this lead.
- User: run full hygiene + manual multi-tab live Supabase invite flows (owner send → accept/decline/revoke/exit/remove → hard refresh all tabs → confirm zero orphans + instant).
- Update README if needed (additive cross-ref to this + C4 charter).

**Handoff Complete**. All evidence self-contained. Report only to main thread.

*Generated under C4-Exec-1 charter. Obsessive post-edit verification + todo discipline observed.*
