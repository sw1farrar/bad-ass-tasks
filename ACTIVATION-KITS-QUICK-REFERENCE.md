# Activation Kits Quick Reference

**Purpose:** One-page, scannable summary of the two ready-to-activate paths at the M2/C4 Decision Gate. Use after you have completed the full smoke + hygiene sequence in `DECISION-GATE-SMOKE-HYGIENE-COMMANDS.md` and captured your evidence pack.

**The Two Exact Trigger Phrases** (verbatim — no paraphrasing, no extra text):

- `"M2 done — begin user-led refinement/M3"`
- `"one more wave on the 7 gaps (with specific priorities)"` (insert your concrete priorities inside the parentheses)

**Activation protocol:** The instant the main thread receives your complete evidence pack + exactly one of the phrases above, the matching pre-prepared kit is launched immediately (parallel agents, zero ramp-up, full governance and post-C4 context already embedded in every charter).

## Path A — M2 Complete → User-Led Refinement / M3 Acceleration

**Exact trigger:** `M2 done — begin user-led refinement/M3`

**What it activates:** Parallel first-wave M3 agents focused on the highest-leverage M2→M3 bridges (Gaps 3 & 5 plus explicit §5 scaffolding from the Sign-off Checklist). Each agent receives narrow charters, exhaustive primary-file reading requirements, and the same iron governance rules.

- **M3-1 (highest priority):** DatabaseBlock full production + hybrid server query/RPC engine. Builds directly on the delivered M2 MVP (interactive Board with intra/inter drag, queryConfig auto-persist, named saved views). Delivers stable result shapes, RLS/hybrid-aware queries, minimal working server query path or polished RPC stubs, and clear next-slice markers. Zero changes to existing M2 UI/drag/filters/views/persistence.
- **M2-2:** SyncedBlock full bidirectional content sync production edges. Completes the M2 foundation with conflict handling, presence/cursor safety, and live sync across source and all embeds.
- **M3-3 (optional, same wave if capacity allows):** Deeper AI editor integration (expands on M2 AI scaffolding + graph context).

**Post-activation requirements:** Main thread produces consolidated summary + evidence; updates living handoff docs (WAVE8-MASTER-PLAN, MILESTONE-2-PROGRESS, SIGNOFF-CHECKLIST §5). **Full hygiene chain + M2 smoke (.tsx) + C4 manual surfaces must be re-run and pass before any fold or further M3 slices.**

**Key files (copy spawn-ready prompts and charters verbatim from these):**
- `docs/M3-PATH-STARTER-PACK-2026-06.md` — lightweight, post-C4, zero-ramp-up activation pack (recommended first read)
- `docs/M3-READY-EXECUTION-PROMPTS-2026-06.md` — detailed spawn prompts and governance language
- `docs/M3-KICKOFF-IF-M2-DONE-2026-05-31.md` — original full charters, success criteria, primary file lists, and governance
- Cross-references: `docs/M2-SIGNOFF-CHECKLIST-2026-05-31.md` §5 (M3 Bridge Items), `docs/WAVE8-MASTER-PLAN.md` (M3 status block)

## Path B — One More Targeted Wave on the Remaining 7 Gaps

**Exact trigger:** `one more wave on the 7 gaps (with specific priorities)`

**What it activates:** Narrow, intelligent 5-agent parallel wave (P-1 through P-5) that addresses every remaining prioritized M2 gap with minimal net footprint. Post-C4 context (guarded hybridStore globals, shared core touches in `store/useTaskStore.ts` + `app/page.tsx`, `.tsx` smoke file, explicit C4 surface requirements in manual) is baked into every charter. Total estimated footprint across the wave: <1,000 LOC.

- **P-1 (Gap 1 — highest leverage):** Stable integer sortOrder normalization hardening (load-time renormalization + hardened mid-point math using only `Math.floor`; idempotent; drift elimination on every reorder/reparent/create path).
- **P-2 (Gap 2):** Backlinks single-source centralization (pure unification of the bidirectional link surface).
- **P-3 (Gaps 3 + 4):** DatabaseBlock completeness + Version History depth (M2→M3 bridge aligned; heavy emphasis on hybridStore guard patterns).
- **P-4 (Gap 5):** SyncedBlock bidirectional production edges (M2→M3 bridge aligned; preserves TipTap presence/cursors).
- **P-5 (Gaps 6 + 7):** Narrow slimming + test execution polish (`.tsx` harness) + a11y/AI on core surfaces.

**Post-activation requirements:** Main thread produces concise completion summary, folds all work, updates the three primary M2 handoff documents. **Full hygiene + M2 smoke + C4 manual re-execution (including the new C4 surfaces) is mandatory before any fold.**

**Key files (copy spawn-ready prompts verbatim from these):**
- `docs/ONE-MORE-WAVE-STARTER-OUTLINE-2026-06.md` — post-C4 lightweight outline with agent table, launch protocol, and context (recommended first read)
- `docs/M2-ONE-MORE-WAVE-KICKOFF-2026-05-31.md` — full 5 spawn-ready verbatim prompt blocks (P-1 to P-5)
- `docs/M2-ONE-MORE-WAVE-PROPOSAL-2026-05-31.md` — detailed 7-gap analysis, original charters, success criteria, and governance
- Cross-references: `docs/M2-SIGNOFF-CHECKLIST-2026-05-31.md` §1 (exact gap definitions and invariants), `docs/M2-DECISION-READINESS-PACK-2026-06.md`, `docs/M2-DECISION-COMMAND-CENTER-POST-C4-2026-06.md`

## Side-by-Side Comparison

| Dimension              | Path A (M3)                                           | Path B (One More Wave)                                      |
|------------------------|-------------------------------------------------------|-------------------------------------------------------------|
| Trigger phrase         | M2 done — begin user-led refinement/M3                | one more wave on the 7 gaps (with specific priorities)      |
| Primary goal           | Forward M3 acceleration (server query + sync engines) | Close the last prioritized M2 gaps before M3                |
| Agent count & structure| 2–3 agents (M3-1/2 + optional M3-3)                   | 5 agents (P-1 to P-5) with intelligent grouping             |
| Scope focus            | Production foundations for DatabaseBlock & SyncedBlock| Data hygiene (sortOrder), unification (backlinks), completeness (DB/History/Synced), polish (tests/a11y) |
| M2→M3 bridge work       | Explicit (Gaps 3 & 5)                                 | Explicit (P-3/P-4 align with M3-1/M3-2 starters)            |
| Re-run full gate after | Yes (hygiene + smoke + all C4 manual surfaces)        | Yes (identical)                                             |
| Best when...           | Core M2 crown jewels already feel solid and demo-ready| Specific remaining gaps need targeted, reviewable increments first |

## Universal Post-Decision Checklist (applies to whichever path you choose)

1. Complete **every** step in `DECISION-GATE-SMOKE-HYGIENE-COMMANDS.md` (timestamped pre-hygiene, M2 smoke with `.tsx`, full manual exercising M2 crown jewels + explicit C4 surfaces in 2+ tabs with hard refreshes ×2, zero-new-console statement, post-manual hygiene).
2. Assemble the mandatory evidence pack (terminals + 7–8 screenshots + verbatim statements).
3. Reply on the main thread with the complete pack + **exactly one** trigger phrase above (priorities filled in if Path B).
4. (Main thread / parent) instantly activates the matching kit using the files listed above under full governance (`todo_write` + exhaustive read/grep on every edit).
5. After the wave completes and is folded: re-execute the full Decision Gate Smoke & Hygiene sequence (including C4 surfaces) before any further work or sign-off.

## Essential Context & Orientation Files

- **Read this first at the gate:** `docs/2026-06-DECISION-DAY-OPEN-THIS-FIRST.md` (hygiene baseline, exact commands, C4 surfaces, phrases, activation pointers)
- **Living master record:** `docs/WAVE8-MASTER-PLAN.md` — canonical section `## 2026-06 Post-C4 + Zustand Hygiene Fix + Exhaustive Decision Package Ready (This Continue Wave)`
- **Latest polish layer (2026-06 Continue. waves):** `docs/2026-06-DECISION-GATE-LATEST-POLISH-SUMMARY.md` + `docs/ALL-2026-06-DECISION-PACKAGE-MASTER-HANDOFF.md`
- **Practical companions (keep open during smoke):** `docs/M2-SMOKE-EXECUTION-COMPANION-POST-C4-2026-06.md`, `docs/M2-DECISION-EXECUTION-QUICK-REFERENCE-CARD-2026-06.md`, `docs/C4-WAVE-COMPLETION-2026-06.md` (contains the full Post-C4 Hygiene Baseline Auditor Report)

**Governance reminder (verbatim across all kits):** Narrow charters only. Every agent must start with internal `todo_write` (plan/research/implement/verify). Mandatory full + targeted `read_file` + path-restricted `grep` after every edit. 100% preservation of demo/live/hybrid invariants, zero new console errors, feature-folder architecture. All work folded only after main-thread verification. Living docs updated with evidence.

*Final, high-signal, one-page user artifact. Synthesized 100% from the complete set of verified on-disk M2 Decision Day, C4, and 2026-06 Continue. activation-kit sources (kickoffs, starter packs, polish summaries, command centers). Immediately usable for handoff. No invention, no scope creep.*
