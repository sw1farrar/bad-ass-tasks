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
