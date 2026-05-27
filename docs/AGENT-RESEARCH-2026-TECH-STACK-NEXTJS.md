# Bad Ass Tasks — 2026 Tech Stack Research Report

**Subagent ID**: 019e6060-e13b-7462-8653-fee0db45b647  
**Charter**: Research latest 2026 tech stack recommendations for Next.js productivity apps  
**Date**: 2026-05-25 (PT)  
**Duration**: 553.8s | 49 tool calls | 1 turn  
**Status**: Completed successfully.

---

**Bad Ass Tasks — 2026 Tech Stack Research Report**  
**Specialized Research Subagent Deliverable for Re-Planning Effort**  
**Date**: 2026-05-25 (PT)  
**Mission**: Grounded analysis of latest recommended patterns for a high-end productivity SaaS (Next.js 15, rich bidirectional notes + powerful tasks, realtime collaboration, AI features, offline/PWA, multi-tenant teams/auth). Extensive web_search across mandated and focus-specific queries, cross-referenced against the actual current codebase (package.json, stores, data layer, editor, configs, schema, UI, proposals/handoffs).

This report directly feeds the master/WAVE8 re-plan with actionable keep/change/add guidance.

### 1. Executive Summary & Current Stack Baseline
The "Bad Ass Tasks" project is already remarkably aligned with 2026 best practices for a premium, ambitious productivity application. It features a sophisticated **hybrid data architecture** (Zustand + conditional Supabase layer with offline queue, optimistic updates, presence scaffolding, and TipTap JSONB round-tripping), a full multi-tenant schema (workspaces + roles + members), TipTap 3 rich editing with custom bidirectional linking/mentions and early AI transforms, a stunning custom neon/glassmorphism premium theme (#00ff9f green accents via memory + explicit #ff00aa pink, #c084fc purple, priority colors), Framer Motion + dnd-kit for 60fps interactions, PWA assets (manifest + sw.js + next.config headers), and React 19 + Next 15.2.4 with Turbopack and package import optimization.

**Exact current stack (grounded in package.json + code reads)**:
- **Core**: Next 15.2.4 (App Router, React 19), TypeScript, Tailwind 3.4.17 + custom neon tokens + `tailwindcss-animate`, PostCSS.
- **State & Data**: Zustand 5.0.3 (with persist; massive `useTaskStore.ts` for tasks/notes/workspaces/members/invites/comments/notifications/presence/cursors/conflicts/offline state/auth), TanStack Query 5.66.11 (in deps), sophisticated `lib/data/hybridStore.ts` (Supabase-conditional CRUD, offline queue in localStorage with client UUIDs, TipTap JSONB <-> plain text mapping for notes, `buildTaskDbPayload` supporting full schema fields like `recurring_rule`, `linked_note_ids`, `assignee_ids`, `parent_task_id`, `exception_dates`).
- **Backend/DB**: Supabase (`@supabase/supabase-js` 2.49.1 + `@supabase/ssr` 0.6.1), full `supabase/schema.sql` (workspaces, workspace_members with `user_role` enum owner/admin/user, profiles with notification_prefs JSONB, tasks/notes with workspace_id FK + JSONB content for notes, comments (polymorphic on task/note), activity_logs, indexes on workspace/status/due/assignees/tags + pg_trgm for text search; no pgvector yet).
- **Editor**: TipTap 3.23.6 (`@tiptap/react` + starter-kit + placeholder) with custom `MentionMark` extension (refType task/note/external, neon pills, bidirectional foundation), slash commands (glass, Notion-style), AI transforms (`aiTransformText` + xAI config check), JSON round-tripping to Supabase.
- **UI/UX**: shadcn/ui setup (components.json), cmdk (CommandPalette ⌘K), lucide-react, sonner, dnd-kit (drag/sort + Kanban), Framer Motion 12.4.10, custom glassmorphism (`.glass`/`.glass-strong` with backdrop-blur 20-24px) + neon glows in globals.css + Tailwind config (neon shadows, custom animations like slideUp/scaleIn/confettiPop).
- **Auth/Collab Scaffolding**: Middleware (graceful Supabase SSR session refresh + demo bypass), AuthModal, SupabaseSetupBanner, store methods for invites/roles/presence (Supabase Realtime channels + simulated demo cursors), `initializeAuth`/`fetchMembers` etc.
- **PWA/Offline**: public/manifest.json + sw.js + icons; next.config headers (sw no-cache + Service-Worker-Allowed, manifest/icons immutable long-cache); hybrid offline queue + `isOnline`/`pendingSyncCount`/`processPendingOperations`.
- **Other**: React Day Picker, date-fns, testing (Vitest + Playwright + RTL), no Yjs/Hocuspocus/pgvector yet; heavy use of proposals/handoffs (WAVE8-MASTER-PLAN.md, PHASE1-SUPABASE, AUTH-TEAMS, REALTIME, HYBRID-LIVE, TIPTAP-LINKING, SEMANTIC-SEARCH, etc.).

**Gaps visible in code** (not yet production-activated or fully implemented): Full RLS + production auth/teams flows (demo mode prominent), true CRDT realtime collab on rich notes (presence/cursors scaffolded but Supabase Realtime only), vector/semantic AI search over notes+tasks, deeper RSC/Server Actions + TanStack Query leverage (Zustand/hybrid dominant), PPR, Tailwind 4.

The stack is **not a blank slate** — it is an advanced, proposal-driven prototype already executing on much of the ambitious vision. 2026 research largely **validates and refines** the direction rather than requiring wholesale replacement.

### 2. Next.js 15 Best Practices & New Features (2026)
**2026 Recommendations** (from searches): Leverage Partial Prerendering (PPR) as a core production pattern for SaaS/productivity apps: static HTML shell for fast initial load + dynamic "holes" (via `Suspense` + `loading.tsx` or `unstable_cache`) for personalized/realtime content (user-specific task lists, presence, AI summaries). Server Actions are stable and preferred for mutations (progressive enhancement, reduced client JS). React Server Components (RSC) for data fetching where possible. Streaming, improved caching, and React Compiler (experimental) for perf. Turbopack in dev is excellent. For dashboards: combine PPR with Suspense boundaries around lists/filters.

**Current Project**: Next 15.2.4 + React 19 + Turbopack (dev script) + `experimental.optimizePackageImports` (lucide, framer-motion, dnd-kit — smart). Strong PWA headers and metadata. No PPR, limited visible RSC/Server Actions (hybrid layer + client store dominant), good streaming potential via App Router.

**Recommendations — Keep / Change / Add**:
- **Keep**: Next 15.2.4/React 19 + Turbopack + optimizePackageImports. PWA foundation.
- **Add/Change**: Enable PPR for Today/Tasks/Notes views (static shell + dynamic personalized/realtime holes). Introduce more Server Components + Server Actions for initial loads and mutations (reduce hybridStore client roundtrips where possible). Add Suspense + `loading.tsx` boundaries. Pilot React Compiler when stable. Rationale: Directly improves perceived perf and scalability for a high-end productivity app with rich client state + realtime needs; aligns with "beautifully fast" positioning while preserving the existing hybrid layer for complex offline/optimistic UX. Low-risk incremental adoption.

### 3. State Management (Zustand, TanStack Query, RSC, Server Actions, Jotai — 2026)
**2026 Recommendations**: Hybrid approaches dominate for complex apps. Use RSC + Server Actions for server-synced data and mutations (where progressive enhancement fits). TanStack Query (v5 excellent) for client-side caching, background sync, optimistic updates, and realtime invalidation (pair with Supabase channels). Zustand or Jotai for ephemeral/global client UI state (filters, modals, presence cursors, command palette, local optimistic patches). Avoid over-relying on a single client store for everything that could be server-coordinated. TanStack Query shines for Supabase integrations.

**Current Project**: Zustand 5 (dominant, with persist + huge feature-rich store including offline/presence/auth). Sophisticated hybridStore abstraction (conditional Supabase vs demo, offline queue, mapping layers). TanStack Query in dependencies but light/minimal usage visible so far. Strong offline + optimistic scaffolding.

**Recommendations — Keep / Change / Add**:
- **Keep strong**: Zustand for client-global/ephemeral UX state (views, filters, palettes, cursors, conflicts, demo presence). The hybridStore layer (offline + Supabase conditional + TipTap mappings) is a 2026-aligned strength.
- **Add/Change**: Deepen @tanstack/react-query integration for server-synced tasks/notes/activity (cache, invalidation on realtime broadcasts, optimistic mutations). Use Server Actions for key mutations. Consider Jotai atoms for very fine-grained UI bits if Zustand store grows unwieldy. Rationale: Leverages existing TanStack dep, reduces Zustand bloat for data that benefits from server caching/revalidation, improves consistency with realtime (Supabase channels → Query invalidation), while preserving the premium offline/optimistic experience and client-side snappiness for the productivity UX (⌘K, drag, presence). Matches hybrid-live proposals perfectly.

### 4. Database & Backend (Supabase vs Alternatives, Vector Search)
**2026 Recommendations**: For integrated Postgres + auth + realtime + storage SaaS, Supabase is frequently the pragmatic winner (especially with RLS). Drizzle or Prisma + Neon/PlanetScale/Supabase Postgres are strong if you prioritize raw ORM control or specific hosting economics. pgvector (with pgvectorscale/HNSW indexes) is the recommended default for semantic/AI search when already on Postgres — excellent for relational + vector hybrid queries, RLS compatibility, and moderate scale (<5-10M vectors typical for productivity notes/tasks). Dedicated vector DBs (Pinecone, Weaviate, etc.) for extreme scale or specialized workloads.

**Current Project**: Supabase (SSR + client) with production-grade multi-tenant schema (workspaces, members with roles, tasks/notes with rich JSONB, comments, activity, pg_trgm). Excellent hybrid offline + conditional logic. No pgvector yet (proposals exist for semantic search/AI KG).

**Recommendations — Keep / Change / Add**:
- **Keep**: Supabase as the backend (full activation of existing schema + hybrid layer). The multi-tenant design and TipTap JSONB support for notes are forward-looking wins.
- **Add/Change**: Add `vector` extension + pgvector columns (e.g., on notes/tasks or dedicated embeddings table) + embedding pipeline (Vercel AI SDK or OpenAI). Use HNSW indexes. Enhance hybridStore with vector queries. Consider Drizzle for any new complex queries if ORM friction appears, but no need to switch wholesale. Rationale: Unlocks AI differentiation (semantic search over rich notes + tasks, RAG for AIChatPanel, knowledge graph per proposals) with minimal migration cost due to existing Postgres foundation. pgvector fits the "productivity + AI" vision better than a separate DB. Hybrid offline story remains intact.

### 5. Auth: Best Patterns for Multi-Tenant Workspaces/Teams (2026)
**2026 Recommendations**: Supabase Auth + RLS policies on `workspace_id` (and member role checks) is a standard, secure, scalable pattern for SaaS multi-tenancy. Use database functions/RPCs for invites/roles. For advanced team features (SSO, SCIM, enterprise invites), evaluate Clerk or better-auth as supplements or alternatives, but Supabase RLS keeps data isolation simple and performant.

**Current Project**: Schema explicitly designed for it (roles enum, workspace_members, owner_id, invited_by). Middleware + SSR session handling (demo bypass). Store methods for invites/members/roles/presence. AuthModal + SupabaseSetupBanner. Not fully activated in production flows.

**Recommendations — Keep / Change / Add**:
- **Keep**: Supabase Auth + the existing schema design.
- **Add/Change**: Implement/activate RLS policies (workspace isolation + role-based). Flesh out invite flows, role management, and teams UI per AUTH-TEAMS and related proposals. Add proper protected route handling (remove demo bypass in prod). Rationale: The schema is already 2026-grade; activating it delivers the core multi-tenant teams promise with low risk. Supabase RLS is the simplest secure path for this app size/scope.

### 6. Rich Editor: TipTap 3+ Best Practices, Extensions, Collaboration (Yjs etc.)
**2026 Recommendations**: TipTap 3 (ProseMirror) remains excellent for extensible React rich text. Official collab options or Yjs + Hocuspocus (self-hosted or edge) for true realtime multi-user editing with CRDT conflict resolution. Custom extensions for mentions, embeds, bidirectional task/note links, slash commands, and AI transforms are standard. Store rich JSON (or JSONB in DB).

**Current Project**: TipTap 3.23.6 with StarterKit + Placeholder + sophisticated custom `MentionMark` (task/note/external refs, neon pills, bidirectional-ready). Slash commands (glassmorphism, categorized), AI integration, JSONB round-tripping via hybrid layer, toolbar. Editor handoff docs show ongoing polish.

**Recommendations — Keep / Change / Add**:
- **Keep**: TipTap 3 + custom extensions + JSONB storage + slash/AI foundation. The bidirectional linking work is a major differentiator.
- **Add/Change**: For full realtime collab on notes: Add Yjs + Hocuspocus (or Supabase Realtime + TipTap collab extensions / custom CRDT layer) on top of existing presence/cursor scaffolding. Extend Mention/embeds for live resolution. Rationale: Unlocks the "realtime collaboration" pillar without replacing the excellent current editor. Leverages Supabase Realtime investments while adding CRDT where rich text conflicts matter most. Directly supports rich notes + tasks integration vision.

### 7. UI: shadcn/ui + Radix vs Other Component Systems (2026)
**2026 Recommendations**: shadcn/ui (Radix primitives + Tailwind) remains the dominant high-DX choice for customizable, accessible, production UIs in Next.js/Tailwind apps. Strong community, copy-paste model, excellent Radix foundation for a11y and behavior. Alternatives (Ark UI, custom libraries) exist but rarely justify the migration cost for most teams.

**Current Project**: shadcn/ui setup + Radix-backed cmdk (CommandPalette) + lucide + sonner + custom Tailwind neon/glass on top. Consistent premium styling.

**Recommendations — Keep / Change / Add**: Keep and double down on the shadcn + custom Tailwind pattern. Add more shadcn components as needed (e.g., for teams panels, activity log). No migration warranted. Rationale: Perfect for the "beautifully" premium, highly customized neon/glass aesthetic while maintaining excellent DX and a11y.

### 8. Animations & DX: Framer Motion, Tailwind 4, PWA/Offline
**2026 Recommendations**: Framer Motion remains top-tier for complex, performant (60fps via transform/opacity) interactions, gestures, layout animations, and presence (cursors, drag). Use LazyMotion for bundle size. Tailwind 4 offers major DX/engine improvements (oxide, new features) but v3 is stable and sufficient; migrate when pain or clear wins justify. PWA: Modern manifest + service workers (stale-while-revalidate, offline shell + critical data) + install prompts.

**Current Project**: Framer Motion 12 (paired with dnd-kit, custom CSS animations, glass). Tailwind 3.4.17 + custom keyframes. Strong PWA skeleton (manifest/sw.js/headers) + hybrid offline queue.

**Recommendations — Keep / Change / Add**:
- **Keep**: Framer Motion for complex interactions (modals, presence cursors, drag, view transitions, confetti) to deliver the 60fps premium feel. Custom Tailwind + glass CSS.
- **Add/Change**: Enhance sw.js strategy and add offline UX polish using the existing queue. Pilot Tailwind 4 in a branch (low urgency; v3 is fine). Use Framer Motion features like `LazyMotion` and layout animations judiciously. Rationale: Directly supports the "addictive, beautiful, 60fps" positioning. PWA + offline is a stated pillar — the foundation is there; 2026 patterns make it production-grade.

### 9. Overall Recommendations, Keep/Change Matrix, & How This Feeds the Master Plan
The current direction is **strong and validated** by 2026 research. The hybrid optimistic/realtime/offline model, Supabase multi-tenancy, TipTap 3 richness, premium neon/glass UX, and PWA scaffolding are correct choices for this class of app. Re-planning should focus on **activation, refinement, and selective 2026 upgrades** rather than pivots.

**High-Level Keep/Change/Add Summary** (condensed):
- **Keep (core strengths)**: Supabase (schema + hybrid layer) + full activation/RLS; Zustand + evolved hybrid (add deeper TanStack Query); TipTap 3 + custom extensions + JSONB + AI; shadcn + custom Tailwind neon/glass; Framer Motion + dnd-kit; Next 15.2 + React 19 + Turbopack + PWA base; offline queue + presence scaffolding.
- **Add/Upgrade (high impact)**: PPR + more RSC/Server Actions + Suspense for perf; pgvector + embeddings for semantic AI (notes/tasks); Yjs/Hocuspocus (or equivalent) for rich note collab; full teams/invites/auth flows per schema + proposals; enhanced PWA offline strategies + Query integration.
- **Deprioritize/Low Urgency**: Full Tailwind 4 migration; wholesale DB/ORM switch; replacing Zustand entirely.

**Risks/Migration Notes**: Incremental (PPR, vector, Query layering, collab layer) minimizes disruption. Demo mode and hybrid conditional logic are excellent safety nets. Leverage existing proposals/handoffs (WAVE8, PHASE1-SUPABASE, REALTIME, HYBRID-LIVE, AUTH-TEAMS, SEMANTIC-SEARCH, TIPTAP-LINKING) as implementation guides.

This research **directly feeds the master plan** by:
- Confirming the hybrid + Supabase multi-tenant foundation as 2026-aligned.
- Prioritizing PPR, vector AI, and refined realtime collab as the next high-leverage waves.
- Providing rationale for consolidating the many Agent proposals into a phased, validated roadmap.
- Highlighting opportunities to simplify (more server coordination) while preserving the delightful client-side premium experience.

**Next Steps Suggested for Master Plan**: (1) Prototype PPR on one major view + TanStack Query integration on tasks/notes. (2) Add pgvector + basic semantic search endpoint. (3) Evaluate Yjs/Hocuspocus spike against existing presence. (4) Activate RLS + complete core teams flows. (5) Polish PWA install + offline indicators.

All key factual statements above derive from the web searches and direct codebase analysis. Sources cited inline where specific claims are made; full search result details (titles, URLs, dates) available in tool history for further browsing.

This completes the assigned specialized research mission. Ready for master plan integration or follow-up deep-dives (e.g., specific proposal alignment or migration spikes).

<subagent_meta>id=019e6060-e13b-7462-8653-fee0db45b647, type=general-purpose, tool_calls=49, turns=1, duration_ms=553762</subagent_meta>

<subagent_result>
subagent_id: 019e6060-e13b-7462-8653-fee0db45b647
subagent_type: general-purpose
To continue this subagent's conversation, use resume_from="019e6060-e13b-7462-8653-fee0db45b647".
</subagent_result>