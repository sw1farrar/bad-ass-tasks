# Bad Ass Tasks 2026 Architecture & Folder Structure Research Report

**Subagent ID**: 019e6060-cfdf-7062-9308-341632d0a074  
**Charter**: Research best 2026 architecture & folder structure for complex Next.js productivity SaaS (rich editor + realtime + teams)  
**Date**: 2026-05-25 (PT)  
**Duration**: 610.7s | 65 tool calls | 1 turn  
**Status**: Completed successfully.

---

**Bad Ass Tasks 2026 Architecture & Folder Structure Research Report**

**Mission**: Evidence-based recommendations for long-term maintainability of this complex productivity SaaS (Next.js 15 App Router + React 19, TipTap rich text, deep bidirectional tasks/notes integration, realtime collaboration, hybrid DEMO/LIVE offline support, multi-tenant auth/workspaces/teams, AI features, high-performance UI with Kanban/dnd/calendar/etc.). Grounded in extensive current codebase inspection + prescribed external research (web searches for "Next.js 15 best folder structure 2026", "scalable Next.js architecture for SaaS productivity apps", "feature-based vs domain-driven folder structure Next.js", plus related on Server Components/Actions/Route Handlers, TanStack Query + optimistic updates/React 19, and realtime TipTap collab with Supabase/Liveblocks/Yjs patterns).

**Research performed (per instructions)**: Multiple `list_dir` (root, app/, components/, lib/, store/, types/, lib/data/, etc.), targeted `read_file` (full or chunked) on `package.json`, `app/page.tsx` (monolith), `app/layout.tsx`, `lib/data/hybridStore.ts` (core hybrid + rich JSONB + offline queue), `lib/utils.ts` (AI layer + recurring), `store/useTaskStore.ts` (god store), `components/TipTapEditor.tsx` (rich editor + Mention + slash + AI transforms), `components/AIChatPanel.tsx`, `middleware.ts`, plus `grep` (imports/coupling in page.tsx; realtime/presence across source + docs/), and `browse_page`/`web_search` for the exact queries + extensions. Also inspected `docs/WAVE8-MASTER-PLAN.md` and related handoff proposals (which explicitly flag `app/page.tsx` as historical bottleneck and list core entrypoints as the monolith + god store + hybrid + editor).

**Current state summary (grounded)**: The project is impressively feature-complete (rich bidirectional linking via MentionMark refType + linked_*_ids, hybrid DEMO/LIVE with localStorage offline queue + LWW sync, Supabase Realtime presence/cursors/conflicts + workspace RLS, xAI-powered AI in editor/chat/briefings/extract/decomp with sim fallback, dnd-kit Kanban, recurring engine, PWA, etc.). However, architecture is classic rapid-iteration flat monolith:
- `app/` minimal (only 4 files); `app/page.tsx` is a 2000+ line `"use client"` giant orchestrating *all* views (today/tasks/kanban/notes/calendar/teams), dozens of `useState`, inline Kanban subcomponents, handlers, effects (auth/PWA/keyboard/pull-to-refresh/invites/sync), and direct imports of everything.
- `components/` flat (10 files: `TipTapEditor.tsx`, `AIChatPanel.tsx`, etc. — no grouping).
- `store/` singular `useTaskStore.ts` (massive Zustand + persist god object holding tasks/notes/workspaces/activity/UI/offline/realtime/presence/conflicts/notifs + calling hybrid).
- `lib/` strong foundation (`hybridStore.ts` for Supabase CRUD + rich TipTap JSONB `noteContentToJson`/`jsonToNoteContent` + offline queue + mappers with bidirectional links; `utils.ts` contains world-class recurring + large AI abstraction layer).
- No `features/`, route groups for app boundaries, or colocation. Middleware good for SSR auth (skips in DEMO). TanStack Query in deps but underutilized. No obvious Server Actions or heavy RSC usage. Realtime is Supabase-native (channels/presence in `@supabase/realtime-js` + custom store logic; editor is local + onChange sync, not CRDT). WAVE8 docs acknowledge the page.tsx bottleneck and list the same core files as entrypoints.

This matches the exact pain points the mission targets. The project has "evolved prototype" velocity but is at the scalability cliff for team ownership, deeper AI (graph + agents), true simultaneous rich collab, and maintenance.

### 1. Recommended Folder Structure (Tree Diagram)

**Opinionated recommendation (2026 best practice for this class of app)**: **Feature-based (with domain-driven elements) + colocation-first**, adapted for Next.js App Router. Keep routing concerns in `app/`, push *everything else* into feature/domain modules with their own UI, logic, data access adapters, and AI hooks. Shared/cross-cutting (design system, core data layer, auth, realtime primitives, pure utils) lives in `shared/` or `lib/`.

This is superior to the current flat + type-based (`components/`, `lib/`, `store/`) or pure "everything in app/" for discoverability, ownership, and avoiding god files. It colocates TipTap concerns (extensions, slash registry, Mention + bidirectional logic, AI transforms) inside `features/notes/`, Kanban/dnd/recurring/calendar inside `features/tasks/`, etc. Cross-domain (linking, AI extraction from note → tasks) happens via well-defined shared types/contracts or a thin events/pubsub layer.

```text
bad-ass-tasks/
├── app/                              # Routing + thin shells/providers only (Next.js App Router)
│   ├── (app)/                        # Protected app (auth layout/middleware gate)
│   │   ├── layout.tsx                # App shell (providers, nav, CommandPalette, AIChatPanel toggle)
│   │   ├── page.tsx                  # Thin orchestrator or dashboard redirect (NO business logic)
│   │   ├── tasks/                    # Route group or sub-routes for deep linking
│   │   │   └── page.tsx
│   │   ├── notes/
│   │   │   └── [id]/page.tsx         # Rich note detail (colocated editor)
│   │   ├── calendar/
│   │   └── teams/
│   ├── (auth)/                       # Login/signup flows
│   ├── (marketing)/                  # Landing if needed
│   ├── layout.tsx                    # Root (fonts, metadata PWA, ErrorBoundary, Toaster)
│   ├── globals.css
│   └── api/                          # Route Handlers (only for webhooks, AI proxy if keys must be server-only, etc.)
│       └── (optional)
├── features/                         # Primary organization (feature-based / domain-driven hybrid)
│   ├── tasks/                        # Tasks domain (Kanban, lists, calendar, recurring, dnd)
│   │   ├── components/
│   │   │   ├── KanbanBoard.tsx
│   │   │   ├── TaskCard.tsx
│   │   │   ├── TaskList.tsx
│   │   │   ├── CalendarView.tsx
│   │   │   └── ...
│   │   ├── hooks/
│   │   │   └── useTaskMutations.ts (or use TanStack)
│   │   ├── api/                      # Or server-actions.ts + queries.ts
│   │   │   └── taskService.ts        # Thin wrappers or direct hybrid calls
│   │   ├── lib/                      # Domain-specific (recurring engine extracted here)
│   │   └── index.ts
│   ├── notes/                        # Rich editor domain (separation of concerns)
│   │   ├── components/
│   │   │   ├── NoteCard.tsx
│   │   │   └── NoteDetail.tsx
│   │   ├── editor/                   # TipTap colocation (critical for this project)
│   │   │   ├── TipTapEditor.tsx      # (move + enhance current)
│   │   │   ├── extensions/           # MentionMark (bidir refType), custom embeds, etc.
│   │   │   ├── commands/             # Slash command registry + categories (AI, task-from-note, etc.)
│   │   │   ├── ai/                   # Editor-specific transforms (aiTransformText variants)
│   │   │   └── collab/               # Yjs provider hooks (future)
│   │   ├── hooks/
│   │   │   └── useBacklinks.ts
│   │   ├── api/
│   │   └── index.ts
│   ├── teams/                        # Workspaces, members, invites, roles, presence
│   │   └── ...
│   ├── ai/                           # Shared AI superpowers (extract, briefings, decomp, proactive, graph)
│   │   ├── lib/
│   │   │   └── xaiClient.ts          # (move/refine from lib/utils.ts AI section)
│   │   ├── prompts/
│   │   └── hooks/
│   │       └── useAIContext.ts       # Builds from tasks + notes + activity (domain-aware)
│   └── realtime/                     # Cross-cutting realtime primitives (optional; or under shared/)
│       └── useWorkspacePresence.ts
├── shared/                           # Cross-cutting (or lib/ + ui/)
│   ├── ui/                           # Design system primitives (glass cards, buttons, priority badges, etc.)
│   │   └── (shadcn-style or custom)
│   ├── components/                   # Only truly shared composites (CommandPalette, Confetti, ErrorBoundary, SupabaseSetupBanner)
│   ├── data/                         # Core data access layer (enhanced hybridStore)
│   │   └── hybridStore.ts            # Repository pattern, JSONB adapters, offline queue, mappers (bidir links)
│   ├── supabase/                     # Thin clients (client.ts, server.ts) + auth helpers
│   ├── state/                        # Lighter Zustand slices (per-feature or UI-only) + TanStack Query setup
│   ├── types/                        # Domain types (Task, Note with linked_* , etc.) + supabase.ts DB types
│   └── utils.ts                      # Pure utilities only (cn, formatDueDate, date-fns helpers; move recurring/AI out)
├── lib/                              # (Legacy thin or deprecated in favor of shared/ + features/*)
├── store/                            # (Migrate away from singular god store; keep temporarily for Zustand slices)
├── types/                            # (Migrate to shared/types/)
├── supabase/
│   └── schema.sql
├── docs/                             # Keep all handoff proposals + this report (WAVE8 etc.)
├── public/
├── middleware.ts                     # Excellent (keep/enhance for workspace RLS context)
├── next.config.ts
├── package.json                      # (Next 15.2+, React 19, @tanstack/react-query@5, @tiptap@3, zustand@5, @supabase/ssr, dnd-kit, framer-motion, sonner, etc.)
└── (tests/, vitest.config, etc.)
```

**Why this tree (vs current or alternatives)**: Current flat structure + monolithic `app/page.tsx` + god store makes "where does the bidirectional mention logic live?" or "change the Kanban optimistic path" painful. Feature folders + colocation make it obvious. `app/` stays lean for routing (route groups for (app) vs (auth) boundaries, parallel routes `@modal` for TaskModal/AIChat if desired). `features/notes/editor/` perfectly isolates the rich editor (current strength) while exposing clean integration points (`onCreateTaskFromSlash`, backlinks, Mention refType).

Alternatives considered (from 2026 searches): Pure domain-driven (`domains/notes/`, `domains/tasks/`) is similar but heavier for smaller teams; "everything under app/" works for tiny apps but fails here. Type-based (`components/`, `lib/`, `hooks/`) is what we have now and is the anti-pattern for scale.

### 2. Key Architectural Patterns & Why Superior in 2026

- **Server Components (default) + selective "Client Islands"**: Layouts, list shells, metadata, and read-heavy views (task lists, note previews) as RSC for zero JS, streaming, and caching. Interactive heavy hitters (TipTapEditor full, dnd Kanban with sensors, realtime presence UI, offline sync indicators, AI chat) remain `"use client"` islands. **Superior**: Massive perf wins, better SEO/accessibility for productivity views, aligns with Next 15 Partial Prerendering. Current app is 100% client — a missed opportunity.

- **Server Actions for mutations (where possible) + TanStack Query for server state**: Simple CRUD (create/update task/note) as Server Actions (type-safe, progressive enhancement, no extra Route Handler boilerplate, automatic revalidation). Complex flows (optimistic + realtime + offline queue + cross-feature AI extract → create linked tasks) stay in client mutation hooks or TanStack `useMutation` (with `onMutate` optimistic, `onError` rollback, + Supabase realtime invalidation or direct patch). **Superior in 2026**: React 19 + TanStack Query v5 patterns excel at this hybrid; reduces "client-only" surface for security/auth. (Project already has Query in deps — underused.)

- **Feature-based / domain-driven folder structure with colocation**: As diagrammed. **Superior**: Long-term maintainability for large feature-rich apps (productivity SaaS especially). Searches and community 2025/2026 guidance (Vercel ecosystem, architecture articles, Robin Wieruch-style deep dives, Medium analyses by authors like Albert Barsegyan/J. Hariharan) consistently show this beats flat or type-organized structures for cognitive load, team scaling, and avoiding the "where is the logic?" problem. Current project (flat components + 2000-line page + god store) is the textbook case of what these sources warn against.

- **Optimistic updates + realtime + hybrid offline (TanStack + custom layer)**: Enhance `hybridStore` into a clean DAL (repositories, query key factories). Use Query for cache + optimistic on top of Supabase (or keep Zustand slices for UI/realtime presence). Offline queue (already strong in hybrid) + background sync. **Superior**: Matches real-world SaaS (Notion/Linear-like) with flaky networks + multi-user. Current hybrid + store optimistic is a great foundation — just needs extraction and Query integration.

- **Dedicated realtime layer for collab (especially rich editor)**: Current Supabase Realtime (presence, cursors, conflicts, workspace channels) is solid for coarse-grained (lists, activity, notifications). For true simultaneous TipTap editing: evaluate **Yjs (CRDT) + Liveblocks** (excellent Next.js + TipTap starters, auth, presence, offline IndexedDB) or a custom Supabase Yjs provider. Enhance MentionMark (already excellent bidirectional foundation with refType) into full embeds/resolution. **Superior 2026**: CRDTs eliminate conflict hell for rich text; Liveblocks abstracts the hard parts while Supabase handles your multi-tenant RLS.

- **AI as first-class cross-cutting feature (with domain context)**: Move/refine the excellent AI layer (`extract*AI`, `generate*BriefingAI`, `aiTransformTextAI`, proactive, xAI structured JSON + sim fallback) into `features/ai/`. Provide domain-aware context builders (`useAIContext` pulling tasks + notes + activity + graph). Wire editor-specific AI into `features/notes/editor/ai/`. **Superior**: Keeps magic without polluting utils or page; easier to add agents/graph.

Other: Route Handlers only for true API surfaces (webhooks, secure AI proxy). Zod + server validation everywhere. Error boundaries + logging already strong — keep.

These patterns are repeatedly validated in 2026 sources for scalable Next.js SaaS (productivity apps in particular need the separation because of rich editor complexity + structured data + realtime + AI crossovers).

### 3. Specific Recommendations for *This* Project's Needs

- **Kill the monolithic page.tsx immediately**: Extract view logic (KanbanBoard subcomponents already partially extracted in spirit, Notes rendering with `<TipTapEditor>`, calendar, teams admin, etc.) into `features/*/components/`. Make root page a thin shell composing `<TasksView />`, `<NotesView />` etc. (or adopt sub-routes). Use composition + feature flags for views. This alone dramatically improves maintainability.

- **Notes (rich editor) vs Tasks separation**: Give `features/notes/` full ownership of TipTap config, extensions (move/enhance MentionMark + bidirectional resolution), slash commands (including /task, /ai, embeds), JSONB roundtrips (already handled well in hybrid), and editor AI. Tasks owns Kanban (dnd-kit), calendar (react-day-picker + recurring), lists, and the recurring engine (extract from utils). Shared contracts: `Task.linkedNoteIds` / `Note.linkedTaskIds` + mention pills + `suggestLinksForNote`/`suggestLinksForTask` (already in utils). AI extraction from notes creates real tasks with links (already partially wired in AIChatPanel + utils).

- **Rich editor + tasks integration + AI**: Colocate editor slash actions that call `features/tasks/api` (e.g., `onCreateTaskFromSlash`). Enhance AI layer to be context-aware (current data pull from god store is powerful — preserve the magic). Add more structured extraction for hierarchical tasks (parentTaskId already in schema/mappers).

- **Realtime + hybrid offline**: Keep/enhance `shared/data/hybridStore.ts` (or `features/shared/data/`) as the source of truth for DEMO vs LIVE (isSupabaseConfigured, RLS-safe). Add TanStack Query on top for lists/activity. For editor collab, pilot Yjs/Liveblocks in `features/notes/editor/collab/` (leverages existing presence patterns from store/docs). Current offline queue + PWA SW + pull-to-refresh + sync indicator is excellent — just modularize.

- **Auth + multi-tenant**: Middleware is production-grade (keep). Slim the store by moving workspace/members/invites/notifs logic toward feature modules or Query. Use workspace context for all realtime channels and RLS.

- **AI features**: Central `features/ai/` with clear opt-in for real xAI (key or server proxy via Route Handler). Build on existing high-quality sim + structured outputs.

- **Data fetching/mutations/optimistic**: HybridStore + store optimistic (kanbanReorder etc.) is battle-tested. Introduce Query for server reads + mutations with optimistic + realtime-driven invalidation/patches. Avoid scattering mutations.

- **Migration path (for master plan)**: Incremental — start with extracting editor + AI into `features/notes/`, Kanban into `features/tasks/`, then slim page + store. Add Server Actions for a few mutations as proof. Pilot Query on one view. Update WAVE8 handoffs with this structure. No big bang.

Leverage existing strengths: hybrid layer, Mention bidirectional foundation, AI depth, realtime primitives in docs/proposals, PWA, recurring engine, dnd polish.

### 4. Trade-offs

**Benefits of recommended architecture**:
- Dramatically better long-term velocity and onboarding (new dev finds "the notes rich editor stuff" in one folder).
- Team scalability (one person/team owns notes + editor collab + AI in notes; another owns tasks domain).
- Performance (RSC islands + Query caching + colocation for tree-shaking/lazy).
- Testability and isolation (feature modules easier to unit/E2E).
- Future-proof for deeper AI agents, full CRDT collab, more views, or even micro-frontends later.

**Costs/Downsides**:
- Migration effort from current flat/god/monolith (real but necessary; do incrementally per WAVE governance in master plan). Refactoring 2000-line page + god store is non-trivial.
- More initial files/boilerplate (feature folders have overhead vs flat for tiny prototypes — but this app is *not* tiny).
- Risk of over-fragmentation (mitigate with strong shared/ + barrel exports + clear "this is cross-cutting" rules). Duplication of tiny UI pieces (solve with `shared/ui/`).
- Learning curve for team on new layout (offset by docs/ + the excellent existing handoff culture).

**When to deviate**: Pure Server Actions everywhere won't work well for the realtime/optimistic/offline richness here — hybrid client orchestration stays essential. Don't force RSC on the TipTap editor or dnd Kanban.

**Risk of staying current**: Increasingly painful as AI/graph features, true rich collab, and team growth hit (already flagged in WAVE8 docs).

### Conclusion & Input to Master Plan

The "Bad Ass Tasks" project has delivered *shockingly* complete, delightful functionality through prior waves and agent handoffs. The hybrid data layer, rich editor foundations (Mention + slash + AI + JSONB), realtime presence work, bidirectional linking, and AI depth are genuine strengths. However, the flat folder structure, monolithic `app/page.tsx`, and singular god store are now the primary technical debt limiting maintainability and scaling — exactly as the user mission and WAVE8 master plan acknowledge.

Adopting the recommended 2026 feature-based + RSC + Query + modular realtime patterns (with strong colocation for the editor vs tasks concerns) will position it for production excellence, team collaboration, and the "most powerful, delightful" vision in the metadata. This report is intentionally opinionated (feature/domain folders win for this complexity level) but directly grounded in the actual files (`app/page.tsx`, `lib/data/hybridStore.ts`, `store/useTaskStore.ts`, `components/TipTapEditor.tsx`, etc.) and external 2026 guidance.

**Recommended next for master plan synthesis**: 
1. Validate this structure with stakeholders (align with WAVE governance/"Iron Rule").
2. Pilot extraction of `features/notes/editor/` (lowest risk, highest win — leverages existing TipTap strength).
3. Define migration phases + success criteria (e.g., "page.tsx < 300 lines", "no god store").
4. Evaluate Liveblocks/Yjs spike for editor collab.
5. Introduce TanStack Query on one domain + a couple Server Actions.

This feeds directly into detailed implementation planning, handoffs, and WAVE execution. All paths respect the existing hybrid DEMO/LIVE contract and multi-tenant RLS.

**Key files referenced (absolute/relative as appropriate to workspace)**: `C:\Grok Build Projects\bad ass tasks\app\page.tsx`, `lib/data\hybridStore.ts`, `store/useTaskStore.ts`, `components/TipTapEditor.tsx`, `lib/utils.ts`, `app/layout.tsx`, `middleware.ts`, `docs/WAVE8-MASTER-PLAN.md`, `supabase/schema.sql`, `package.json`, and the full `docs/` handoff corpus.

Be ready for the master plan synthesis — this architecture will make the "bad ass" part sustainable at scale. 

(End of report. All research complete; todos advanced.)

<subagent_meta>id=019e6060-cfdf-7062-9308-341632d0a074, type=general-purpose, tool_calls=65, turns=1, duration_ms=610742</subagent_meta>

<subagent_result>
subagent_id: 019e6060-cfdf-7062-9308-341632d0a074
subagent_type: general-purpose
To continue this subagent's conversation, use resume_from="019e6060-cfdf-7062-9308-341632d0a074".
</subagent_result>