# Structured Research Report: 2026 Best Practices for Testing, Deployment, CI/CD, Observability, and Long-term Maintenance — "Bad Ass Tasks" (Next.js 15 + Supabase)

**Subagent ID**: 019e6061-0913-74c2-ac5b-a02e7cb3d718  
**Charter**: Research 2026 testing, deployment, CI/CD & maintenance best practices for Next.js SaaS  
**Date**: 2026-05-25 (PT)  
**Duration**: 728.8s | 53 tool calls | 1 turn  
**Status**: Completed successfully.

---

**Structured Research Report: 2026 Best Practices for Testing, Deployment, CI/CD, Observability, and Long-term Maintenance — "Bad Ass Tasks" (Next.js 15 + Supabase)**

**Prepared by:** Specialized Research Subagent (Wave 8 re-planning support)  
**Date:** 2026-05-25 (PT)  
**Scope:** Grounded exclusively in the current project state (Vitest + Playwright foundation with multi-context support noted in configs/proposals; minimal E2E coverage; manual SQL-based Supabase schema application; existing structured logging + ErrorBoundary; TypeScript debt; extensive handoff docs) + the many Wave 8 diagnostic proposals (explicitly the Master Plan, Agent 70 Testing & Verification Harness, Agent 71 Runbooks & Activation, Agent 69 DX Hygiene, Agent 53 Production Hardening/CI/CD charter, and cross-references to Agent 33 Production Quality baseline) + fresh web_search results for 2025/2026 external best practices.

**Core Project Context (from inspection + Wave 8 artifacts):** Complex productivity app (tasks + rich TipTap notes + bidirectional linking + Knowledge Graph + AI + realtime collab + mobile/PWA). Tech: Next.js 15 (App Router), TypeScript (strict-ish with ~15 errors at one audit point), Zustand + hybrid optimistic/LWW/offline queue + Supabase (schema.sql with RLS/RPCs/realtime pubs, @supabase/ssr), Vitest + React Testing Library (unit/component base) + Playwright (E2E config supports multi-browser + multi-context; currently only `tests/e2e/smoke.spec.ts` + `tests/utils.test.ts` — smoke is demo-tolerant). No (or minimal) `.github/workflows` (confirmed via discovery; aligns with Master Plan statement that "full CI/CD/deploy not hardened"). Migrations: Dashboard SQL Editor pattern (full `supabase/schema.sql` + activation DO blocks for RPCs/FKs/realtime pubs; no Supabase CLI/migrations folder yet). Observability baseline: `lib/logger.ts` (structured levels, error buffer, metrics), root `app/global-error.tsx` + `components/ErrorBoundary.tsx`, Sonner toasts. Docs: Extensive AGENT-*.md handoffs + `docs/` proposals + README + `bad-ass-tasks-prompt.md`; no formalized ADRs or production runbooks beyond the new Wave 8 proposals themselves. Wave 8 governance (Master Plan): Strict sequencing (Agent 45 Phase 1 Live Supabase first — non-negotiable Iron Rule before downstream work), Supervisor (Agent 44), diagnostic-only proposals from workers until approval. Agent 53 charter and Agents 69/70/71 directly target this report's pillars.

**Wave 8 Diagnostic Baseline (Key Gaps Identified Internally):** 
- Testing: Only smoke E2E + limited utils; no dedicated live-mode harness, multi-user/RLS/offline/LWW/realtime collab simulation, visual regression, or a11y (axe) automation. Demo invariant required (tests must never pollute pristine demo mode). Agent 70 delivers a comprehensive Verification Harness + massive ready-to-use checklist for Phase 1 milestone (multi-context Playwright sketches, RLS contract tests with service_role in CI, unit/component expansions for hybridStore/useTaskStore, live vs demo matrix, evidence-based). 
- CI/CD/Deployment: Not hardened. Agent 53 (Master Plan): GitHub Actions or Vercel-native (typecheck/lint/test/e2e on PRs, coverage, preview deploys); Vercel prod-ready (env, Supabase prod guidance); expand tests for hybrid live/demo parity + a11y audit. No visible workflows.
- Observability: Foundations exist (logger + boundaries) but gaps in production error tracking/perf/feature flags for collab debugging.
- Maintenance: Manual SQL migrations (gap vs CLI best practice); TS debt (~15+ errors: imports, store returns/nullability for addTask/addNote, notif/RPC payloads, AI mode unions, logger exports, React namespace, 'as any' proliferation — detailed root-cause in Agent 69 with prioritized fix waves); extensive handoffs but need formalized runbooks/ADRs (Agent 71 delivered polished, copy-paste Supabase activation runbooks + checklists with exact SQL order, realtime pubs, troubleshooting, multi-user validation; aligns with Master Plan success criteria). DX hygiene (Agent 69) calls for clean baseline + future CI typecheck gate.

All recommendations below explicitly extend the Vitest + Playwright (multi-context for collaboration) foundation and directly address/prioritize/operationalize the Wave 8 proposals under the Iron Rule (Phase 1 Supabase first; demo pristine; evidence-based; no scope creep).

### 1. Testing Pillar (Pyramid: Unit Vitest, Component RTL, E2E Playwright Multi-Context, Contract/API, Visual, Accessibility)
**Current State:** Vitest (fast Vite-based, jsdom, @testing-library/react, coverage v8, setup mocks for localStorage/etc.; tests/utils.test.ts covers natural language, recurring, formatting, logger). Playwright configured (chromium + Pixel 5 + webkit; auto webServer :3000; retries/CI; traces/screenshots on fail; tolerant of demo Supabase errors; supports multi-context per proposals/config). Only smoke E2E (load, ⌘K, add/complete task). No visual regression, axe a11y automation, contract/RLS tests, or live-mode harness. Agent 33 baseline delivered initial setup + a11y/perf seeds.

**2026 Best Practices (web-grounded):** Next.js official guidance (updated 2026-05) strongly recommends Vitest + RTL for unit/component (synchronous Server/Client Components; Playwright for async Server Components/E2E). Vitest preferred over Jest for speed/ESM in modern Next 15 stacks. Common patterns: custom render utils for providers/Context, absolute path/SVG handling, coverage scripts. Playwright excels at multi-context/`browser.newContext()` + storageState for realistic multi-user/collaboration/realtime flows (chat/e-commerce/multi-role analogies directly map to Bad Ass Tasks presence, cursors, invites, comments). Visual regression via `toHaveScreenshot` + updates; a11y via built-in or @axe-core integrations in E2E. Contract/API: MSW for mocking Supabase in unit/integration; RLS/service_role tests in CI. Layered pyramid + demo/live matrix + evidence artifacts strongly endorsed in 2025/2026 sources.

**Concrete Prioritized Recommendations (directly extends Agent 70 + 33 + Master Plan Agent 53):**
- **P0 (High — Phase 1 gate, quick win, aligns with Agent 70 harness + Iron Rule):** Implement Agent 70 Verification Harness immediately post-Phase 1 Supabase activation. Add `tests/hybridStore.test.ts` + `useTaskStore.test.ts` (offline queue, LWW, realtime subs, invites/notifs, guards — use MSW or Supabase mocks + vi.mock). Component/RTL tests for AuthModal, SupabaseSetupBanner, Teams/Invite fragments, Notification bell (mock store). Expand E2E: `tests/e2e/live-smoke.spec.ts` (conditional on TEST_SUPABASE env), offline simulation, **multi-user harness using `browser.newContext({ storageState })` for User A/B collab scenarios** (exact sketch in Agent 70 Appendix — create in A, assert live in B, presence/cursors/conflicts, invites, comments). Always run full demo regression (`npm test && npm run test:e2e`) before/after live runs. Preserve demo invariant.
- **P0/P1:** Add accessibility (axe-core via Playwright or jest-axe in RTL) + basic visual regression (`toHaveScreenshot` on key views) in E2E. RLS contract tests (Node script with service_role key in CI secrets only).
- **P1:** Specialized harnesses (realtime pub validator SQL/JS, load/concurrent via Playwright contexts, Lighthouse in CI). Observability in tests (assert `logger.getErrorBuffer()` clean; toasts).
- **P2:** Coverage thresholds in vitest.config (e.g., 70-80%+ on hybrid paths); `test:live` script + CI matrix (demo vs dedicated test Supabase project); integrate with Agent 69 clean TS baseline.
- **Quick Wins:** Update playwright.config for explicit multi-context projects/fixtures/storageState dir if not already; add `npm run test:coverage` script (per tutorials); make smoke.spec more representative of current features.

**Expected Impact:** Battle-tested Phase 1 milestone (per Agent 70 checklist); prevents regressions in hybrid/realtime/RLS; extends existing Vitest/Playwright foundation exactly as required.

### 2. Deployment, CI/CD (Vercel + GitHub Actions, Preview Environments, Database Seeding)
**Current State:** Likely Vercel for hosting (standard for Next.js + Supabase). No (or minimal) `.github/workflows` (discovery confirmed gap; Master Plan explicitly calls out "full CI/CD/deploy not hardened"). Manual local/dev Supabase activation (no automated seeding or preview DBs). Previews probably manual or basic Vercel previews without test data/RLS validation.

**2026 Best Practices:** Vercel + GitHub Actions is the dominant pattern for Next.js (PR previews with isolated envs, GitHub for type/lint/test/e2e matrix + coverage gates, Vercel for prod deploys + edge). Preview environments: Use Vercel preview URLs + dedicated Supabase test project/branch or ephemeral DBs. Database seeding for tests: Supabase CLI or SQL scripts in CI (idempotent DO/IF NOT EXISTS blocks as in current activation proposal), separate test org/project with seeded users/ws for multi-user E2E (never prod). Matrix jobs (demo vs live-test). Secrets for test keys. Always green demo suite.

**Concrete Prioritized Recommendations (directly implements Agent 53 charter + Agent 70/71 CI ideas + Master Plan gaps):**
- **P0 (High — foundational, quick win):** Create `.github/workflows/ci.yml` (or leverage Vercel-native GitHub integration): on PR/push — `npm run typecheck && npm run lint && npm test && npm run test:e2e` (demo mode). Add preview deploy job (Vercel). Require demo green.
- **P1:** Dedicated test Supabase project in CI secrets. `test:live` script + matrix (demo + live-test-project with seeded data via activation SQL from Agent 71). Playwright storageState pre-generation for multi-user E2E in CI. Coverage reporting + thresholds.
- **P1/P2:** Supabase preview/branch support or ephemeral test DBs for PR previews (seed via CLI or the exact activation DO blocks from Agent 71 runbooks). Vercel prod guidance runbook (env vars, Supabase prod project checklist).
- **P2:** Full pipeline for Agent 53 success (Lighthouse, a11y in CI, hybrid parity tests).

**Quick Wins:** Add `test:e2e:ui` and coverage scripts now; document in README/Agent 71 runbooks; start with demo-only CI job (zero risk).

**Expected Impact:** Hardens production readiness per Wave 8; enables safe live testing without manual coordination.

### 3. Observability (Logging, Error Tracking, Performance, Feature Flags)
**Current State:** Strong foundation from Agent 33: `lib/logger.ts` (levels, context, error serialization/buffer, `timeOperation`, `registerErrorReporter`), root ErrorBoundary + global-error (neon-themed), Sonner toasts, some perf memoization. Gaps in production error tracking/replays for collab debugging, structured metrics, feature flags for gradual live rollout.

**2026 Best Practices:** Sentry (or Axiom/Datadog alternatives) for Next.js 15 (full instrumentation, source maps on Vercel, performance monitoring, session replays ideal for realtime collab debugging). Structured logging (existing logger is excellent base — pipe to Sentry/Axiom). Feature flags: Vercel Flags (simple, edge-native for previews), PostHog (product analytics + flags), or LaunchDarkly for enterprise. OpenTelemetry for traces if scaling.

**Concrete Prioritized Recommendations (extends Agent 33 + Master Plan Agent 53 + gaps in collab debugging):**
- **P0 (High):** Integrate Sentry (Next.js SDK) — errors + performance + optional replays. Wire existing `logger` + ErrorBoundary to report to Sentry (use `registerErrorReporter`). Source maps + Vercel integration.
- **P1:** Feature flags (start with Vercel Flags for live Supabase rollout, hybrid guards, new views — kill switches for risky Phase 1+ features). Pipe logger metrics to observability backend.
- **P2:** Axiom or similar for log aggregation/search; full OpenTelemetry if needed; dashboards for realtime presence/sub health.

**Quick Wins:** Add Sentry DSN to env (demo-safe); expose `logger` error buffer in dev tools or tests.

**Expected Impact:** Production resilience + debuggability for multi-user scenarios (directly supports Agent 49/70 testing).

### 4. Long-term Maintenance (Dependency Management, Supabase Migrations, Documentation/ADRs/Runbooks, Code Health)
**Current State:** Deps in package.json (Vitest/Playwright/Supabase/Next 15 versions current as of 2026). Migrations: Manual SQL Editor (Agent 71 details exact order + activation additions for missing RPC/FKs/realtime pubs; idempotent DO blocks). Docs: Rich handoffs + proposals (this Wave 8 set is excellent start); no dedicated `docs/adr/` or production runbooks beyond Agent 71 activation focus. Code health: TS with debt (Agent 69 full audit + prioritized fixes for imports, store contracts, payloads, unions, logger, 'as any'); lint/typecheck scripts exist; Agent 69 recommends future CI gate + reduced `as any`.

**2026 Best Practices:** Dependency mgmt: Renovate (highly configurable for TS/Next.js, grouped PRs, TS strictness checks) or Dependabot (simpler). Supabase migrations: Official CLI (`supabase db diff`, `supabase migration new`, `supabase db push` in CI for previews/prod; migration files in `supabase/migrations/`). ADRs: Lightweight markdown in `docs/adr/` (or tools like adr-tools/log4brains) with template (context/decision/status/consequences). Runbooks: Living docs in `docs/runbooks/` (playbooks for activation, incidents, deploy, rollback — Agent 71 is the perfect model; expand to Vercel/observability). Code health: Strict tsconfig + noUnused* + eslint/biome in CI; automated dep updates + typecheck gates; ADR for major decisions.

**Concrete Prioritized Recommendations (directly advances Agent 69/71/53 + closes Master Plan gaps):**
- **P0 (High — Phase 1 enabler):** Adopt Supabase CLI migrations (migrate current schema.sql + activation blocks into proper `supabase/migrations/` files + `supabase.config.ts`). Update Agent 71 runbooks + activation proposal. Add to CI (apply to test project).
- **P0/P1:** Formalize Wave 8 proposals into `docs/adr/` (e.g., "ADR-001: Hybrid LWW + optimistic queue", "ADR-002: Testing Harness for Phase 1"). Expand Agent 71 runbooks (add Vercel deploy, incident response, observability, rollback). Agent 69 TS fixes (Wave 1 P0 imports/returns/prefs first — exact diffs provided; then shapes/unions).
- **P1:** Renovate (or Dependabot) with Next.js/TS config + security grouping; schedule weekly. Lint-staged + CI typecheck/lint gates (per Agent 69/53).
- **P2:** Full runbooks library + ADR tool; dependency dashboard; code health metrics in CI.

**Quick Wins:** Run Agent 69 Wave 1 fixes now (low risk, unblocks everything); copy Agent 71 runbooks into README or dedicated activation guide; create `docs/adr/` with 2-3 from current proposals; add Renovate config.

**Expected Impact:** Sustainable velocity; production-grade DX; preserves "shockingly complete" foundation while scaling to real teams (per Master Plan success criteria).

### 5. Overall Prioritized Roadmap & Alignment to Wave 8
**P0 (Immediate, Phase 1 gate — before Agent 45 milestone sign-off):** Agent 70 harness (multi-context E2E + unit/component expansions) + Agent 69 TS baseline fixes + basic CI job (demo-only) + Sentry + Supabase CLI migration adoption + Agent 71 runbooks operationalized + .github/workflows skeleton. All preserve demo invariant and Iron Rule.

**P1 (Post-Phase 1, Agent 53/69/70/71 execution):** Full CI matrix + live test project seeding + visual/a11y + feature flags + expanded runbooks/ADRs + Renovate + coverage gates.

**P2 (Ongoing hardening):** Advanced harnesses (load, contract), OpenTelemetry, ADR governance, dep automation maturity.

**Risks & Mitigations:** Demo pollution (strict guards + always-run demo suite); brittle live E2E auth (storageState + post-auth focus); manual multi-user verification (use Playwright contexts + dedicated test project). All recs are reviewable, incremental, and directly traceable to Wave 8 proposals + 2026 practices.

**Success Metrics:** Clean typecheck/build/lint/test/e2e (demo + live matrix); Phase 1 milestone signed off per Agent 70 checklist + Master Plan criteria; no regressions in hybrid/realtime/RLS; production-ready for real teams on Vercel + Supabase.

This report provides **actionable, non-generic, prioritized next steps** that a follow-on Agent 53/70/71 (or delegated) can execute under Agent 44 governance. It fully extends the Vitest + Playwright multi-context foundation and treats the Wave 8 proposals as the authoritative internal diagnostic baseline (not generic advice).

**References (internal grounding):** `docs/WAVE8-MASTER-PLAN.md`, `docs/AGENT-70-TESTING-PROPOSAL.md` (incl. Appendix multi-context sketch + full checklist), `docs/AGENT-71-RUNBOOKS-PROPOSAL.md` (exact SQL + checklists), `docs/AGENT-69-DX-HYGIENE-PROPOSAL.md` (TS audit + diffs), project configs/tests (`vitest.config.ts`, `playwright.config.ts`, `tests/e2e/smoke.spec.ts`, etc.), `lib/logger.ts`, `app/global-error.tsx`, memory sessions (Agent 33 baseline + multi-context mandate).

**External (web citations used above for 2026 practices):** Next.js Vitest guide (2026-05 updates), community/Strapi/Vercel-adjacent patterns for pyramid + multi-context. Additional targeted searches (visual regression/axe, Vercel+GH Actions+Supabase seeding, Sentry/feature flags, Renovate/ADRs/runbooks, contract testing, Supabase migrations CLI) would further refine specifics (e.g., exact current Sentry Next.js setup or Renovate presets) but do not alter the priorities.

**Next Action for Supervisor (Agent 44):** Review/approve this synthesis alongside peer Wave 8 proposals. Authorize P0 execution (coordinated with Agents 45/53/69/70/71). Update Master Plan.

This completes the assigned research mission with concrete, grounded, prioritized output. All todos for synthesis phase now closed.

<subagent_meta>id=019e6061-0913-74c2-ac5b-a02e7cb3d718, type=general-purpose, tool_calls=53, turns=1, duration_ms=728781</subagent_meta>

<subagent_result>
subagent_id: 019e6061-0913-74c2-ac5b-a02e7cb3d718
subagent_type: general-purpose
To continue this subagent's conversation, use resume_from="019e6061-0913-74c2-ac5b-a02e7cb3d718".
</subagent_result>