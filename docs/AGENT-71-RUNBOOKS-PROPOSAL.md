# AGENT-71: WAVE 8 PROPOSAL — Documentation & Activation Runbooks for Live Supabase Project

**Agent**: Agent 71 — Documentation & Activation Runbooks Agent  
**Reporting To**: Agent 44 (Architect & Primary Supervisor)  
**Wave**: 8  
**Date**: 2026-05-25 (PT)  
**Status**: **PROPOSAL ONLY — SUBMITTED FOR SUPERVISOR REVIEW**  
**Governance Compliance**: Strict proposal-only per Critical Rules and Iron Rule (WAVE8-MASTER-PLAN.md). Zero code changes, zero schema edits, zero file modifications outside this single deliverable document. All content derived from exhaustive non-destructive audit of current codebase state (as of this session). This document is the sole output.

---

## Executive Summary & Charter Fulfillment

This proposal fulfills the charter assigned to Agent 71: deliver **clear, step-by-step runbooks and checklists** enabling any user to fully activate their **live Supabase project** for the Bad Ass Tasks application.

**Scope Covered (based on current code state)**:
- Environment setup (exact vars, files, restart requirements)
- Schema application **order** (base `supabase/schema.sql` + incremental activation sections for completeness)
- Realtime enablement (publication for postgres_changes on all relevant tables)
- Full activation flow, verification, and testing (automated + manual multi-user / realtime / teams / offline scenarios)
- Alignment with hybrid data layer (`lib/data/hybridStore.ts`, `store/useTaskStore.ts`), clients (`lib/supabase/client.ts` / `server.ts`), middleware, AuthModal, realtime subscriptions (`subscribeToWorkspaceRealtime`), presence, invites, notifications, comments, workspaces, etc.

**Foundation Observed (Current Code State Summary)**:
- **Hybrid architecture** (pristine demo mode always works; strict `isSupabaseLive() === isSupabaseConfigured()` guards + demo workspace ID blocks ("w1"/"w2") everywhere).
- **Supabase clients**: `@supabase/ssr` (browser + server), singleton pattern, middleware session refresh (skipped in demo).
- **Schema** (`supabase/schema.sql`, ~558 lines): Production-grade tables (workspaces, workspace_members, profiles, tasks (rich recurring/arrays/JSONB), notes (TipTap JSONB), comments, activity_logs, workspace_invites, notifications), enums, indexes (GIN + search), RLS (via `is_workspace_member` SECURITY DEFINER helper), triggers, RPCs (create_workspace_for_user, invites, delete_workspace_for_owner). Later sections use `IF NOT EXISTS` for collab/notifs additions.
- **Realtime**: `subscribeToWorkspaceRealtime` (postgres_changes on tasks/notes per workspace filter) + presence channel stub in hybridStore; wired in useTaskStore `setupWorkspaceRealtime` + TipTapEditor cursors + page presence UI. **Requires explicit ALTER PUBLICATION** (not auto for new tables).
- **Auth**: AuthModal (email/password primary; magic links + OAuth "ready" per docs/README). Workspace bootstrap via RPCs.
- **Other**: .env.example present (with Supabase + optional xAI/Resend); SupabaseSetupBanner (simple 3-step guidance); E2E smoke (Playwright, demo-tolerant); Vitest utils tests; no Supabase CLI/migrations (dashboard SQL Editor pattern); no storage buckets or Edge Functions currently required.
- **Gaps in Current Activation UX** (addressed by these runbooks): Basic README + banner steps lack schema order details, realtime SQL, comprehensive checklists, troubleshooting, multi-user verification, and alignment with Phase 1 audit findings (e.g., missing `update_workspace_details` RPC in base schema, incomplete pub notes).
- Prior Phase 1 audit (AGENT-PHASE1-SUPABASE-ACTIVATION-PROPOSAL.md) identified exact needs; these runbooks operationalize them for end-users in polished, copy-paste-ready form.

**Key Deliverable**: Usable, standalone runbooks + checklists. Once approved by Agent 44, a user with a fresh Supabase project can follow this document end-to-end in <15 minutes to reach "LIVE" mode with full realtime/teams/auth working.

**Iron Rule Alignment**: These runbooks directly support Agent 45 charter success criteria and the non-negotiable Phase 1 gate before any downstream Wave 8 work (Notes 46, AI/Graph 47, etc.).

---

## 1. Prerequisites & High-Level Overview

**Required**:
- Node.js + npm (project already `npm install`ed recommended)
- A free Supabase account/project (https://supabase.com)
- Text editor / terminal for .env and dev server
- Two browser profiles/tabs or incognito + another user for multi-user realtime testing (strongly recommended)

**High-Level Activation Flow** (detailed in subsequent runbooks):
1. Provision Supabase project + configure Auth providers (5 min)
2. Set up local environment vars (copy .env.example → .env.local)
3. Apply schema (base + activation SQL in correct order)
4. Enable realtime publication (critical DO block)
5. Restart dev server + hard refresh → observe LIVE mode + banner gone
6. Run verification checklists + tests
7. Perform end-to-end multi-user / realtime / teams validation

**Time Estimate**: 10-20 minutes for first-time activation (including testing).

**Safety**: All steps are non-destructive on a fresh project. Demo mode remains 100% functional and untouched.

---

## 2. Runbook: Supabase Project Creation & Dashboard Configuration

**Goal**: Provision a clean project and prepare Auth / Realtime / API settings.

**Steps**:

1. Go to https://supabase.com/dashboard and sign in / create account.
2. Click **New Project**.
   - Name: e.g., "bad-ass-tasks-prod" or "bad-ass-tasks-my-team"
   - Database Password: Generate strong one; **save it securely** (you may need it later for direct connections).
   - Region: Choose closest to your users.
   - Pricing: Free tier is sufficient and recommended for activation.
3. Wait for project provisioning (~1-2 min). You will land on the project dashboard.
4. **Configure Authentication Providers** (enables magic links, Google, GitHub, etc. — "ready" in AuthModal per current docs):
   - Go to **Authentication** (left nav) → **Providers**.
   - **Email**: Ensure enabled. For frictionless dev/testing: turn **off** "Confirm email" (or leave on for prod-like; magic links work either way via `signInWithOtp` if wired later).
   - **Google**: Enable + provide OAuth credentials from Google Cloud Console (optional but recommended for full "OAuth ready" experience).
   - **GitHub**: Enable + provide GitHub OAuth App credentials (optional).
   - **Site URL**: Set to `http://localhost:3000` (for local dev). Add production URLs later (e.g., your Vercel domain).
   - **Redirect URLs**: Add `http://localhost:3000/**` (and prod equivalents). AuthModal uses `window.location.origin` for some flows.
5. **Note your API keys** (required next):
   - Go to **Project Settings** (gear icon, bottom left) → **API**.
   - Copy:
     - **Project URL** (e.g., `https://your-project-ref.supabase.co`)
     - **anon public** key (the long `eyJhbGc...` JWT; **never** use the `service_role` key in client code).
   - (Optional but useful) Note the `service_role` key privately if you ever need admin bypasses (not used by this app).
6. **Verify Realtime is available**: It is enabled by default on new projects. We will explicitly add tables to the publication in later steps (this is the most common "realtime not working" gotcha).
7. (Optional) Explore **SQL Editor** (we will paste there next) and **Table Editor** (to inspect after schema).

**Verification at this stage**:
- You can access the project dashboard.
- You have the two keys ready to paste.
- Auth providers configured per your preference.

**Warnings**:
- Use a **dedicated project** for this app (not shared with unrelated data).
- Never commit keys to git (.env.local is gitignored by default in Next.js).

---

## 3. Runbook: Environment Setup (.env.local)

**Goal**: Wire the app to your live Supabase project. The hybrid layer auto-detects and switches from DEMO → LIVE.

**Current Code Requirements** (from `lib/supabase/client.ts`, `middleware.ts`, `isSupabaseConfigured`):
- Exactly two variables required:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

**Steps**:

1. In project root, copy the provided template:
   ```bash
   cp .env.example .env.local
   ```
   (Or manually create `.env.local` and paste the template below.)

2. Open `.env.local` and fill exactly:

   ```env
   # Bad Ass Tasks — Environment Configuration
   # Copy this file to .env.local and fill in your values

   # Supabase (REQUIRED for full auth, realtime, persistence)
   # Get these from https://supabase.com/dashboard/project/_/settings/api
   NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...   # <-- paste your anon public key here (no quotes)

   # Optional: For future AI features (Grok / xAI or OpenAI)
   # XAI_API_KEY=your-xai-key
   # OPENAI_API_KEY=your-openai-key

   # Optional: Resend for beautiful transactional emails (password reset, invites)
   # RESEND_API_KEY=re_xxxxxxxx

   # Vercel deployment (auto-populated on Vercel)
   # VERCEL_URL=your-vercel-url
   ```

3. **Save the file**.
4. **Restart the development server** (critical — Next.js loads env at startup):
   ```bash
   # Stop current dev server (Ctrl+C), then:
   npm run dev
   ```
5. Hard refresh the browser (Ctrl/Cmd + Shift + R or Cmd+Shift+R on Mac) at http://localhost:3000.

**Verification**:
- SupabaseSetupBanner should **disappear** (or be dismissible permanently for configured users).
- In UI (e.g., sidebar or status): "LIVE" indicator appears (code surfaces mode via `isSupabaseLive()`).
- No console errors about missing Supabase config.
- Auth modal (if opened) attempts real Supabase calls instead of pure demo.

**Troubleshooting**:
- Banner still visible? Double-check exact var names (case-sensitive), restart dev, clear browser cache / hard refresh. Check browser console for `process.env` values (dev only).
- "Invalid API key" or auth errors later? Re-copy the anon key precisely (no extra spaces/newlines).
- From memory: Users sometimes struggle to locate the anon key — it's under Project Settings → API (not "anon public" label confusion resolved in past guidance).

**Note**: `.env.local` is ignored by git (standard Next.js). For team/production, use Vercel Environment Variables (same names).

---

## 4. Runbook: Schema Application (Correct Order)

**Goal**: Apply the complete, production-grade database schema, RLS policies, RPCs, and supporting objects. Order matters for dependencies (tables → RLS enable → helpers → policies → RPCs → incremental collab objects → realtime prep).

**Current Code State Note**:
- Primary source: `supabase/schema.sql` (full file, run in Supabase SQL Editor).
- Schema is designed for one-pass execution but includes phased additions (Phase 2 collab, settings, notifications) with `IF NOT EXISTS` / comments recommending "re-run full or add sections".
- **Critical gap in base schema.sql alone** (identified in prior Phase 1 audit): Missing `update_workspace_details` RPC (called by hybridStore for safe owner updates; Wave 7 hardening). Incomplete realtime publication.
- Therefore: **Two-pass recommended** for robust activation on fresh or partial projects.

**Exact Steps**:

1. Open Supabase Dashboard → **SQL Editor** (left nav).
2. **Pass 1: Base Schema (Core Tables, RLS, Most RPCs)**
   - Open your local `supabase/schema.sql` in an editor.
   - Select **all** content (Ctrl/Cmd+A).
   - Paste **entire file** into SQL Editor.
   - Click **Run** (or Ctrl/Cmd+Enter).
   - **Expected**: Success (or minor "already exists" notices on re-runs; safe). Scroll for any red errors.
   - This creates:
     - Enums, extensions (uuid-ossp, pg_trgm)
     - All core tables + indexes
     - RLS enabled + policies (using `is_workspace_member` helper)
     - Triggers for `updated_at`
     - Primary RPCs: `create_workspace_for_user`, invite create/accept, `delete_workspace_for_owner`
     - Later sections: `workspace_invites`, `notifications`, additional policies/RPCs

3. **Pass 2: Activation Additions (Missing RPC + FK Alignment + Realtime Prep)**
   - After Pass 1 succeeds, paste and run the following **consolidated activation block** (synthesized from current schema state + Phase 1 audit findings for exact match to code call sites). This is idempotent/safe:

```sql
-- ============================================================
-- BAD ASS TASKS — ACTIVATION ADDITIONS (Post base schema.sql)
-- Run this in SQL Editor AFTER the full supabase/schema.sql
-- Adds: Critical missing RPC (update_workspace_details), FK alignments (past PGRST fixes),
--       Consolidated realtime publication (enables all current + planned postgres_changes)
-- Safe to re-run. Designed for fresh or incrementally built projects.
-- ============================================================

-- 1. Critical missing RPC: update_workspace_details (owner-only, called by hybridStore:updateWorkspace)
--    (Absent from base schema.sql per audit; required for workspace rename/slug flows without RLS/auth context errors)
CREATE OR REPLACE FUNCTION update_workspace_details(
  p_workspace_id UUID,
  p_name TEXT DEFAULT NULL,
  p_slug TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role user_role;
BEGIN
  SELECT role INTO v_caller_role
  FROM workspace_members
  WHERE workspace_id = p_workspace_id AND user_id = auth.uid()
  LIMIT 1;

  IF v_caller_role IS NULL OR v_caller_role != 'owner' THEN
    RAISE EXCEPTION 'Only the workspace owner may update details';
  END IF;

  -- Partial update with COALESCE; basic sanitization on slug
  UPDATE workspaces 
  SET 
    name = COALESCE(p_name, name),
    slug = COALESCE(NULLIF(TRIM(p_slug), ''), slug),
    updated_at = NOW()
  WHERE id = p_workspace_id;

  RETURN TRUE;
END;
$$;

COMMENT ON FUNCTION update_workspace_details IS 
  'Owner-only workspace name/slug update via RPC (Wave 7 fix for RLS/auth context). Use from hybridStore only.';

-- 2. Align profiles FKs (past one-off fix for PostgREST relationship errors on embeds in getWorkspaceMembers/getComments)
DO $$
BEGIN
  -- workspace_members.user_id -> profiles(id)
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'workspace_members_user_id_fkey_profiles'
  ) THEN
    ALTER TABLE workspace_members 
    ADD CONSTRAINT workspace_members_user_id_fkey_profiles 
    FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
  END IF;

  -- comments.user_id -> profiles(id) (for joins)
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'comments_user_id_fkey_profiles'
  ) THEN
    ALTER TABLE comments 
    ADD CONSTRAINT comments_user_id_fkey_profiles 
    FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'FK alignment note: %', SQLERRM;
END $$;

-- Reload PostgREST schema cache (critical after structural changes)
NOTIFY pgrst, 'reload schema';

-- 3. CONSOLIDATED REALTIME PUBLICATION (the key activation step for subscribeToWorkspaceRealtime + future)
--    Enables postgres_changes on tasks/notes (current hybrid) + members/invites/activity/notifs/comments (collab readiness)
--    Per WAVE8-MASTER-PLAN, Phase 1 charter, and code (hybridStore ~1836, useTaskStore setupWorkspaceRealtime)
DO $$
DECLARE
  tables_to_add text[] := ARRAY[
    'tasks',
    'notes',
    'workspace_members',
    'workspace_invites',
    'activity_logs',
    'notifications',
    'comments'
    -- 'profiles' -- optional: uncomment for live profile updates in member lists
    -- 'workspaces' -- low-volume; usually not needed
  ];
  t text;
BEGIN
  FOREACH t IN ARRAY tables_to_add
  LOOP
    IF NOT EXISTS (
      SELECT 1 
      FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %I', t);
      RAISE NOTICE 'Added % to supabase_realtime publication', t;
    ELSE
      RAISE NOTICE '% already in supabase_realtime publication (skipped)', t;
    END IF;
  END LOOP;
END $$;

-- Final reload
NOTIFY pgrst, 'reload schema';

-- ============================================================
-- END OF ACTIVATION ADDITIONS
-- ============================================================
```

4. Click **Run**. Review notices (adds should succeed; skips are normal on re-runs).
5. (Optional but recommended) Run a quick schema sanity query in SQL Editor:
   ```sql
   SELECT tablename FROM pg_publication_tables 
   WHERE pubname = 'supabase_realtime' AND schemaname = 'public'
   ORDER BY tablename;
   ```

**Verification**:
- No fatal errors in either pass.
- `update_workspace_details` function exists.
- Realtime publication includes the listed tables (at minimum tasks, notes, workspace_members, etc.).
- You can query tables in Table Editor (e.g., empty workspaces / profiles).

**Order Rationale** (from schema structure + memory):
- Base tables + RLS enable **before** helper functions and policies (avoids dependency errors).
- RPCs after policies (some depend on RLS context).
- Incremental sections (invites/notifs) after core (they reference core tables).
- Realtime publication **last** (after all tables exist).
- FK alignments + NOTIFY after structural adds (PostgREST cache).

**Re-running**: Safe. Use the DO blocks and IF NOT EXISTS patterns.

---

## 5. Runbook: Realtime Activation & App Launch

**Goal**: Ensure live postgres_changes and presence work; confirm app switches to LIVE.

**Steps** (after schema passes):

1. Confirm realtime tables added (query from previous runbook or dashboard: Database → Replication → "supabase_realtime" publication — tables should be checked/added).
2. Restart dev server again (`npm run dev`).
3. Hard refresh browser (or open in incognito/new profile).
4. Sign up / sign in via AuthModal (email/password works immediately; test magic link if providers configured).
   - On first real auth: `ensureUserHasWorkspace` + `create_workspace_for_user` RPC should auto-bootstrap a workspace + your profile + owner membership.
5. Create or switch to a **real workspace** (not the demo "w1"/"w2" seeds).
6. Perform actions: create task/note, edit, complete, invite (if testing multi-user).

**Expected**:
- "LIVE" / realtime indicators in UI.
- Changes in one tab/browser instantly reflect in another (same workspace, different authenticated users).
- No RLS or "relation not in publication" errors in console.
- Banner permanently dismissible / absent when keys present.

**If realtime not firing**:
- Re-run the realtime DO block.
- Hard refresh + teardown (code handles on workspace switch).
- Check browser Network tab for Supabase websocket (`realtime/v1`).
- Confirm tables in publication via query.

---

## 6. Runbook: Testing & Validation (Automated + Manual)

**Automated (always safe, works in demo or live)**:

```bash
# In terminal (after activation)
npm run typecheck     # Should pass or note only pre-existing issues
npm run lint
npm test              # Vitest (utils + core logic)
npm run test:e2e      # Playwright smoke (demo-tolerant; runs against localhost:3000)
```

**Manual Verification Checklist** (perform after activation; use 2+ browsers/tabs or different users):

**Pre-Launch**:
- [ ] .env.local correct + dev restarted + hard refresh
- [ ] No SupabaseSetupBanner (or permanently dismissed for live)
- [ ] UI shows LIVE mode indicators
- [ ] AuthModal opens; sign up with real email succeeds (profile row created)

**Core Data & Workspace**:
- [ ] Auto-workspace bootstrap on first sign-in (or create via UI)
- [ ] Create/edit/delete task (list + Kanban) — persists across refresh
- [ ] Same for notes (TipTap content roundtrips)
- [ ] Workspace rename (owner) succeeds via UI (tests the critical RPC)
- [ ] Switch workspaces; data isolates correctly (RLS)

**Teams / Invites / Auth**:
- [ ] Invite flow: Owner creates invite link → second user (new browser or incognito, possibly new Supabase user) accepts → member added, list updates live
- [ ] Role enforcement (non-owner cannot delete ws or manage invites)
- [ ] Sign out / sign in different user; data scoped correctly

**Realtime & Collab**:
- [ ] Two tabs (same live ws, same or different users): Create/edit task or note in one → instant appear/update in other (no manual refresh)
- [ ] Presence: Multiple users online → see online indicators, editing badges
- [ ] TipTap Editor: Cursors / selection broadcast visible across clients (colored labels)
- [ ] Comments: Add in TaskModal → appears for other clients (optimistic + future pub)
- [ ] Notifications: Trigger event (comment @mention, assign) → bell updates live for recipient

**Offline / Resilience**:
- [ ] Simulate offline (dev tools or disconnect): Queue writes (create/update tasks)
- [ ] Reconnect: Auto-sync via pending queue + LWW (no loss/duplicates)
- [ ] Refresh mid-edit: Data consistent

**Advanced / Polish**:
- [ ] Activity log populates for actions
- [ ] Stats / export (admin views) work on live data
- [ ] No critical console errors (filter known demo/supabase optional)
- [ ] Command Palette, Today view, recurring scaffolding, etc. all functional on live data

**Success Gate**: All above pass with zero data loss, zero RLS violations, realtime <1s latency, demo mode still pristine when keys removed.

**E2E Note**: Current smoke tests tolerate demo (no Supabase in CI). Post-activation, manual multi-browser is the gold standard for realtime/teams. Future hardening (Agent 53) can add live E2E.

---

## 7. Master Checklists (Printable / Copyable)

### Pre-Activation Checklist
- [ ] Fresh Supabase project created
- [ ] Auth providers configured (Email primary; Google/GitHub optional)
- [ ] Project URL + anon key copied
- [ ] .env.example copied to .env.local and filled
- [ ] Dev server will be restarted after env + after schema
- [ ] Two browser contexts ready for testing
- [ ] Read full schema.sql + this runbook once

### Activation Execution Checklist
- [ ] Pass 1: Full `supabase/schema.sql` run successfully in SQL Editor
- [ ] Pass 2: Activation additions SQL (RPC + FKs + realtime DO) run successfully
- [ ] Realtime publication query confirms key tables listed
- [ ] NOTIFY pgrst reloads executed
- [ ] Dev server restarted (post-env + post-schema)
- [ ] Hard browser refresh + sign in with real credentials
- [ ] Real workspace created/ bootstrapped (not demo w1/w2)

### Post-Activation Validation Checklist
- [ ] Banner gone in LIVE mode
- [ ] Automated: typecheck / test / lint clean (or known baseline)
- [ ] Manual core CRUD + persistence across refresh
- [ ] Realtime cross-client (tasks/notes/presence/cursors)
- [ ] Invite + multi-user teams flow end-to-end
- [ ] Workspace owner ops (rename/delete via RPC)
- [ ] Offline queue sync in live
- [ ] No critical errors; RLS holds
- [ ] Demo mode still works perfectly (test by temporarily commenting keys + restart)

### Troubleshooting Quick Reference
- **Realtime not updating**: Re-run realtime DO block; hard refresh; confirm publication tables; check websocket in Network tab.
- **RLS / permission errors**: Ensure real (non-demo) workspace ID; user is member; RPCs used for privileged ops.
- **"relation not in publication"**: Run the ALTER/DO realtime block.
- **Workspace update fails**: Confirm `update_workspace_details` RPC exists (Pass 2).
- **PostgREST / embed errors**: Run the FK DO + NOTIFY pgrst.
- **Env not picked up**: Full dev restart (not just HMR); check .env.local spelling exactly.
- **Auth redirect issues**: Update Site/Redirect URLs in Supabase Auth settings.
- **Data mixing demo/live**: Impossible by guards (demo IDs hard-blocked).
- **Key location confusion**: Project Settings → API (anon public only).

---

## 8. Success Criteria (Aligned to WAVE8-MASTER-PLAN & Agent 45 Charter)

Per Iron Rule and charter (exact match):
- Real Supabase project connected with valid .env.local
- Full `supabase/schema.sql` + activation additions applied
- Realtime publication complete for tasks, notes, workspace_members, workspace_invites, activity_logs, notifications, comments (and members/comments readiness)
- Multi-user auth/teams/invites/notifs/realtime working end-to-end in live mode (2+ concurrent users, cross-tab/browser)
- Hybrid layer battle-tested (optimistic CRUD, offline queue + LWW, realtime subs/presence, RPCs for privileged ops, no demo pollution)
- All prior features (tasks, notes, editor, graph, AI, collab) function seamlessly on live data
- Banner dismissible permanently for live users
- Zero critical console errors or data loss
- Demo mode remains pristine and fully functional when Supabase not configured
- Automated tests + manual validation checklists passed
- **Milestone approval by Agent 44 required** before downstream Wave 8 agents (46+) proceed

---

## 9. Risks, Mitigations & Notes

**Risks**:
- Partial schema on existing project → use IF NOT EXISTS / DO guards (already in script); start fresh recommended.
- Realtime pub timing → explicit DO + app restart + hard refresh.
- PostgREST cache after FKs → NOTIFY included.
- Auth provider setup for magic/OAuth → documented; UI currently password-primary but extensible.
- TS errors (pre-existing ~15 per prior notes) → independent of activation; hygiene tracked separately.
- Production (Vercel): Repeat env + schema steps; add prod redirect URLs.

**Mitigations**: All steps idempotent/safe; verification queries + checklists built-in; strict hybrid guards prevent cross-mode issues.

**Future-Proofing**: Runbooks cover current needs (no storage/edge fns required yet). Easy to extend for pgvector, more tables, or Supabase CLI migrations later.

**Relation to Prior Work**: Builds directly on README basics, .env.example, SupabaseSetupBanner, schema comments, Phase 1 audit SQL/checklists (AGENT-PHASE1-...), and WAVE8-MASTER-PLAN success criteria. Polished for end-user consumption vs. internal agent handoff format.

---

## 10. Request for Supervisor Review & Approval

**Agent 71** has completed the assigned charter with exhaustive exploration of current code state (root, lib/supabase/*, supabase/schema.sql, hybridStore, useTaskStore, clients, middleware, components (AuthModal, Banner, etc.), app/page, types, tests, .env.example, all relevant docs including WAVE8-MASTER-PLAN.md and prior Phase 1 proposal, memory sessions for context/governance).

This single document (`docs/AGENT-71-RUNBOOKS-PROPOSAL.md`) is the **only** deliverable. It provides production-ready, copy-paste-usable runbooks and checklists.

**Next per governance**: Awaiting explicit review and approval decision from Agent 44. Upon approval, this becomes the authoritative user guide for live Supabase activation. No further action by Agent 71 without new directive.

**Questions for Supervisor (if any during review)**:
- Preferred level of SQL excerpt detail vs. reference to prior proposal?
- Any additional sections (e.g., Vercel production deployment runbook appendix, storage bucket setup for future logos)?
- Integration with existing README or banner copy updates (post-approval only)?

Thank you for the opportunity to contribute to the Wave 8 foundation under your oversight, Agent 44.

**End of Proposal**

---

*This document was generated solely as a proposal. All technical details accurately reflect the inspected current codebase state on 2026-05-25.*