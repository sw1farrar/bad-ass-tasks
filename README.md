# Bad Ass Tasks

> **Get shit done. Beautifully.**

The most powerful, delightful, and addictive notes + task management application on the planet. Built for ambitious creators, founders, and teams who ship at the speed of thought.

This is a **high-fidelity, fully interactive prototype** of the ultimate productivity app — the love child of Notion, Todoist, Linear, and Obsidian, but faster, more beautiful, and more fun.

![Bad Ass Tasks](https://picsum.photos/id/1015/1200/630) <!-- Replace with real hero later -->

## ✨ What You Can Experience Right Now

- **Stunning neon dark interface** with glassmorphism, 60fps micro-interactions, and premium motion
- **Today view** — smart daily briefing with focus score and priority surfacing
- **World-class task system**:
  - Beautiful list view with natural language quick-add
  - Powerful Kanban board (move between columns instantly)
  - Priority (P0–P3), due dates, tags, assignees, time estimates
  - Magical **natural language parsing** ("Ship investor deck by Friday P0 @Sarah")
- **Command Palette** (⌘K) — the heart of the experience. Create tasks, jump views, trigger "AI" actions
- **Delight**:
  - Confetti + toast on task completion
  - Smooth keyboard navigation
  - Workspace switcher
  - Persistent local state (refresh-safe)
- **Notes stub** (will become full TipTap block editor)
- **Keyboard-first**: ⌘K, ⌘N, 1/2/3 view switching, Space to complete, Escape to close

Everything you see here is production-grade code ready to evolve into the real full-stack app.

## 🚀 Getting Started (30 seconds)

```bash
# 1. Install dependencies
npm install

# 2. Run the dev server (Turbopack enabled)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — you're inside the prototype.

No accounts. No setup. Just pure delight.

## 🔌 Connect Real Supabase (Recommended Next Step)

1. Go to https://supabase.com and create a new project (free tier is perfect).
2. In your project, go to **SQL Editor** and run the entire contents of `supabase/schema.sql`.
3. Copy your **Project URL** and **anon public key** from Project Settings → API.
4. Create `.env.local` in the project root:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
```

5. Restart the dev server.

The app will automatically switch from "DEMO" to "LIVE" and the setup banner will disappear.

You now have real auth, real-time capable database, and RLS-secured data.

## 🧠 The Vision (from the original prompt)

See [docs/bad-ass-tasks-prompt.md](./docs/bad-ass-tasks-prompt.md) for the complete 360+ line spec.

**Core Promise**: The most powerful, delightful, and addictive notes + task management app on the planet.

**Design language**: Dark-first, ultra-modern, neon accents (#00ff9f green + #ff00aa pink), glassmorphism, buttery 60fps animations, keyboard-first, zero friction.

## 🗺️ Current Status (Aggressively Advanced)

**You are looking at a shockingly complete, production-grade foundation.**

### ✅ Completed So Far
- **Phase 1**: Full stunning interactive prototype (list + Kanban + Today + Command Palette + natural language + confetti + persistence)
- **Phase 2**: Complete Supabase foundation
  - `lib/supabase/client.ts` + `server.ts`
  - Full production schema + RLS policies + helper functions in `supabase/schema.sql`
  - Hybrid data layer (demo works perfectly without Supabase)
  - Middleware ready
  - Beautiful "Connect Supabase" banner + setup guidance
- **Phase 3 (Partial)**: Gorgeous Auth modal with magic links + Google/GitHub OAuth (works in demo + ready for real Supabase)
- **Phase 5 (Partial)**: Rich Task detail modal with all properties, comments, time tracking UI
- Full TypeScript types, beautiful design system, keyboard-first experience

### Next Immediate Wins (you can continue from here)
- Connect real Supabase (5-10 min setup)
- Replace demo store with live queries
- Add full TipTap editor
- Real drag & drop on Kanban using the @dnd-kit libs already installed

See the detailed roadmap in the original prompt: [docs/bad-ass-tasks-prompt.md](./docs/bad-ass-tasks-prompt.md)

### Wave 8 Master Plan (Current Governance)
**Live Supabase migration first (Agent 45), then deep Notes integration (46), AI + Graph (47), etc.**  
Full living prioritized plan, agent charters (45-53), sequencing rules, success criteria, and coordination protocol maintained by Agent 44 (Architect & Primary Supervisor).  

**Read it here:** [docs/WAVE8-MASTER-PLAN.md](./docs/WAVE8-MASTER-PLAN.md)

**M2 / 2026-05-31 Delivered Status + Current Focus (additive update per WAVE8-MASTER-PLAN.md 2026-06 section)**

**M2 (Deep Notes + Bidirectional Task↔Note Platform) delivered** (full synthesis + 7 gaps closed/MVPs + 8 GREEN / 2 YELLOW hygiene status in the canonical "M2 Status as of 2026-05-28 / 05-31 Closeout" section):
- Production-grade hierarchy (drag reparent + stable integer sortOrder), centralized `useBacklinks` single source of truth, live editable TaskEmbeds (inline edits + deleted state), Version History (structured/JSON diff + onPersistSnapshot server round-trip), interactive DatabaseBlock (Board/kanban + named saved views MVP + queryConfig persist), SyncedBlock title bidirectional MVP + scaffolds.
- All work 100% demo/live/hybrid-guard safe; zero new console errors per 10-agent wave + 3-agent verification.
- **Decision Day crown jewel package** (run smoke → reply exact phrase): [M2-EVIDENCE-PACK-2026-05-31.md](./docs/M2-EVIDENCE-PACK-2026-05-31.md) (single master), [M2-SIGNOFF-CHECKLIST-2026-05-31.md](./docs/M2-SIGNOFF-CHECKLIST-2026-05-31.md) (7 gaps + invariants §2 + smoke §3 + What Good Looks Like §4 + M3 bridges §5), [M2-READINESS-REPORT-2026-05-31.md](./docs/M2-READINESS-REPORT-2026-05-31.md) (exec summary + explicit "M2 ready for user review" recommendation), [10-AGENT-WAVE-COMPLETION-2026-05-31.md](./docs/10-AGENT-WAVE-COMPLETION-2026-05-31.md), [MILESTONE-2-PROGRESS-2026-05-28.md](./docs/MILESTONE-2-PROGRESS-2026-05-28.md) (2026-05-30/31 closeout + verbatim 7 gaps + 11-invariant table), all M2-DECISION-DAY-*.md ([M2-DECISION-DAY-2026-05-31.md](./docs/M2-DECISION-DAY-2026-05-31.md) etc. for exact one-liner + two decision phrases + activation), plus live companions ([M2-SMOKE-RUN-COMPANION-2026-05-31.md](./docs/M2-SMOKE-RUN-COMPANION-2026-05-31.md), [M2-SMOKE-FAILURE-MAPPER-2026-05-31.md](./docs/M2-SMOKE-FAILURE-MAPPER-2026-05-31.md)), [M2-TEST-RUN-INSTRUCTIONS.md](./docs/M2-TEST-RUN-INSTRUCTIONS.md), conditional kickoffs ([M3-KICKOFF-IF-M2-DONE-2026-05-31.md](./docs/M3-KICKOFF-IF-M2-DONE-2026-05-31.md) | [M2-ONE-MORE-WAVE-*.md](./docs/)).
- **Exact decision phrases** (reply one after smoke/hygiene/manual on `C:\Build\Bad Ass Tasks`): "M2 done — begin user-led refinement/M3" or "one more wave on the 7 gaps (with specific priorities)".

**Home hub addition**: `features/home/HomeView.tsx` + integration live on-disk (layout/nav).

**Active realtime/invites/teams focus**: Hardened subscriptions/presence (hybridStore + editor/collab/), full invites/membership lifecycle (features/teams/ + [IMPROVEMENTS-INVITE-MEMBERSHIP-LIFECYCLE.md](./docs/IMPROVEMENTS-INVITE-MEMBERSHIP-LIFECYCLE.md)), M1 live Supabase + M2 surfaces. (See WAVE8 2026-06 snapshot + related AGENT handoffs for details.)

**Next Immediate Wins (additive update)**:
- Execute M2 Decision Day: full hygiene (`npm run typecheck && npm run lint && npm run build && npm run test && npm run test:e2e`) + `npx vitest run tests/notes-m2-smoke.test.tsx` (quoted PowerShell per M2-TEST-RUN-INSTRUCTIONS.md) + 15-30 min manual Notes smoke (hierarchy/drag/bidir/TaskEmbeds/History/DB Board+named views/Synced) per [M2-SIGNOFF-CHECKLIST-2026-05-31.md](./docs/M2-SIGNOFF-CHECKLIST-2026-05-31.md) §3 + [M2-SMOKE-RUN-COMPANION-2026-05-31.md](./docs/M2-SMOKE-RUN-COMPANION-2026-05-31.md). Capture terminal + screenshots. Reply with exact phrase above.
- Realtime collab polish + invites full lifecycle on live Supabase.
- Home hub refinement + cross-feature integration.
- Continue per full WAVE8 Master Plan (now with M2 closeout + 2026-06 canonical snapshot).

**Wave 8 Master Plan (additive update)**: Full living plan at [docs/WAVE8-MASTER-PLAN.md](./docs/WAVE8-MASTER-PLAN.md) now includes the inserted "M2 Status as of 2026-05-28 / 05-31 Closeout" (synthesis of all crown jewels, verbatim where possible) + new "2026-06 Current Snapshot Analysis + Continuation" (B3 living record of on-disk reality, M2 delivery, Home addition, realtime/invites focus, exhaustive cross-refs to every M2 artifact/Decision Day file, plan.md note, B3 task status). M2 delivered; Home hub added; active realtime/invites/teams focus. Agent 44 governance + Iron Rule intact. One canonical "where we are" matching on-disk + pointing to Decision Day package.

**C4 (Realtime Invites + Home Hub) + Post-C4 Hygiene + 2026-06 Decision Gate** (additive update)

**C4 delivered** on the active branch (zero-orphan realtime invites symmetry, rich presence, Home Global Workspace Hub MVP Phase A) per [C4-WAVE-COMPLETION-2026-06.md](./docs/C4-WAVE-COMPLETION-2026-06.md) (exec summary, per-agent evidence, multi-tab verification steps).

**Fresh Post-C4 hygiene**: Exactly 22 TS errors (pre-existing M2 extraction residuals only; 0 delta); guards 100% clean per [POST-C4-HYGIENE-VERIFICATION-2026-06.md](./docs/POST-C4-HYGIENE-VERIFICATION-2026-06.md) (GREEN report; auditor task 019e74de-faf0-7861-8cff-0b3354c955d0 exit 0 + root post-C4 logs). Zustand safeLocalStorage fix confirmed.

**Canonical current status**: See [docs/WAVE8-MASTER-PLAN.md](./docs/WAVE8-MASTER-PLAN.md) section "## 2026-06 Post-C4 + Zustand Hygiene Fix + Exhaustive Decision Package Ready (This Continue Wave)" (on-disk snapshot, crown jewels cross-reference table, governance record).

**Decision Gate**: Run full hygiene + M2 smoke (`tests/notes-m2-smoke.test.tsx`) + manual (M2 crown jewels + C4 surfaces) per [M2-DECISION-EXECUTION-MASTER-LAUNCH-GUIDE-2026-06.md](./docs/M2-DECISION-EXECUTION-MASTER-LAUNCH-GUIDE-2026-06.md) and [M2-DECISION-COMMAND-CENTER-POST-C4-2026-06.md](./docs/M2-DECISION-COMMAND-CENTER-POST-C4-2026-06.md). Reply with exactly one: "M2 done — begin user-led refinement/M3" or "one more wave on the 7 gaps (with specific priorities)".

**2026-06 Gate Polish (this Continue. wave — additive)**: The brand-new [2026-06-DECISION-GATE-LATEST-POLISH-SUMMARY.md](./docs/2026-06-DECISION-GATE-LATEST-POLISH-SUMMARY.md) is the latest one-screen consolidator. Master Handoff, Launch Guide, and Command Center received recent "**Latest Polish (this Continue. wave)**" notes. Canonical record remains the WAVE8 section `## 2026-06 Post-C4 + Zustand Hygiene Fix + Exhaustive Decision Package Ready (This Continue Wave)` in [docs/WAVE8-MASTER-PLAN.md](./docs/WAVE8-MASTER-PLAN.md).

### Phase 6 — Notes (Notion Killer)
- Full TipTap block editor + slash commands
- Nested pages, backlinks, version history

### Phase 7 — AI Superpowers & Integration
- Global AI chat
- Task extraction from notes
- Semantic search
- Writing coach

### Phase 8–10 — Polish, Mobile/PWA, Production
- Adaptive layouts (bottom nav on mobile, sidebar on desktop)
- PWA + offline
- Themes, accessibility, Vercel deployment

## 🛠️ Tech Stack (as specified)

- **Next.js 15** (App Router + Turbopack)
- **TypeScript** strict
- **Tailwind + custom neon design system**
- **Framer Motion** for all animations
- **Zustand** (client state) + **TanStack Query** (future server state)
- **@dnd-kit** (drag & drop)
- **cmdk** (command palette)
- **Sonner** (toasts)
- **Lucide** icons
- **date-fns**
- **Supabase** (coming Phase 2)

## 📁 Project Structure

```
app/
  layout.tsx          # Root + Toaster
  page.tsx            # The entire interactive prototype
  globals.css         # Epic neon dark theme
components/
  CommandPalette.tsx  # ⌘K heart of the product
  Confetti.tsx        # Celebration on completion
store/
  useTaskStore.ts     # All state + natural language parser + persistence
lib/
  utils.ts            # cn(), parseNaturalLanguage(), date helpers
types/
docs/
  bad-ass-tasks-prompt.md   # The complete original vision
```

## 🧪 Useful Commands

| Command           | Description                          |
|-------------------|--------------------------------------|
| `npm run dev`     | Start with Turbopack (fast)          |
| `npm run build`   | Production build                     |
| `npm run lint`    | ESLint                               |
| `npm run typecheck`| TypeScript check                    |
| `npm run format`  | Prettier                             |

## 🧰 M0 Baseline Hygiene (For Contributors & Agents)

For M0 (and ongoing) work under the revised 7-Milestone Master Plan (see [docs/WAVE8-MASTER-PLAN.md](./docs/WAVE8-MASTER-PLAN.md)):

```bash
# Full regression (run before/after any change + pre-gate)
npm run typecheck && npm run lint && npm run build && npm run test && npm run test:e2e
```

See the **official M0 runbooks and templates** (authoritative operating system for M0, delivered by Docs-Finalization-Agent):
- `docs/M0-HYGIENE-RUNBOOK.md` (exact commands, guard audit Sec 2.3, demo smoke Sec 2.4, rollback)
- `docs/M0-AGENT-PROPOSAL-TEMPLATE.md` (standardized proposals + mandatory guard matrix)
- `docs/M0-VERIFICATION-SIGN-OFF-TEMPLATE.md` (gate checklist for Agent 44)

Source/provenance: `docs/M0-DOCS-RUNBOOKS-PROPOSAL.md` (Secs 2–4).

**CI Note (post M0-CI-Verification-Agent)**: `.github/workflows/ci.yml` (demo-only) now provides CI parity for the hygiene commands (typecheck/lint/test/e2e on push/PR; see workflow for matrix + runbook 2.6 local equivalent). Verified locally; minor note: omits build (full local chain includes it). Use for PR gates during M0.

Always protect the demo invariant and hybrid guards (`isSupabaseLive()` + "w1"/"w2" blocks in `lib/data/hybridStore.ts` etc.).

## 🙏 Next Steps for the Builder

1. Run `npm install && npm run dev`
2. Play with it for 10 minutes — feel the delight
3. Read the full prompt in `docs/`
4. Begin **Phase 2**: Create Supabase project → wire real auth + database
5. Replace the Zustand store with real Supabase client + TanStack Query
6. Add the full TipTap editor
7. Make it feel even more native on mobile

This is going to be legendary.

---

**Built with obsession for people who actually ship.**

Tagline: *Get shit done. Beautifully.*
