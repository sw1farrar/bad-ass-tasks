# Agent Handoff: WAVE8 Master Plan + Current State (June 2026)

**Purpose of This Document**  
This is the single onboarding document for any new agent taking over the project. It consolidates:
- The living master plan
- All standing rules and governance protocols that have been in effect
- The exact current state of the project
- What must happen next

Read this document first. It will tell you precisely where we are and what to do.

---

## 1. The Living Master Plan

**Primary File**: `docs/WAVE8-MASTER-PLAN.md`

This is the canonical, actively maintained master plan for the entire Wave 8 effort on "Bad Ass Tasks".

### Core Priorities (as defined in the master plan)
1. Live Supabase migration / Auth / Teams / Realtime activation (Phase 1 – non-negotiable first)
2. Deep Notes integration + Task ↔ Note bidirectional platform
3. AI Superpowers + Knowledge Graph + Semantic Discovery
4–9. (Advanced views, mobile/PWA, public site, admin/governance, production hardening)

**Iron Rule**: No structural or high-impact work on phases 2+ until Phase 1 (live Supabase + realtime) is verified complete.

The plan has two major recent sections relevant to our current work:
- Historical M2 (Notes deep integration) status from May 2026, including the 7 prioritized gaps and the decision gate.
- 2026-06 C4 section (realtime collaboration, invites, Home hub) and the subsequent "Continue." wave documentation polish.

---

## 2. Standing Rules & Governance (Non-Negotiable)

These rules have been consistently applied and must continue:

### On "Continue."
- Immediately spin up multiple sub-agents in parallel.
- Stay extremely close to the master plan.
- Focus on living docs sync and decision-gate preparation.
- Use `todo_write` for internal planning.
- All work must be purely additive unless explicitly scoped otherwise.

### Post-Edit Discipline (Governance)
After every `search_replace` or file creation:
- Immediately run `read_file` on the edited area + surrounding context.
- Run multiple **path-restricted** `grep` calls on the edited file only.
- Verify that the intended change landed cleanly and that no prior content was accidentally altered.
- Record the verification in your final output.

### Decision Gate Protocol (M2)
The project is currently paused at the **M2 Decision Gate**.

The user **must**:
1. Run the canonical smoke using the prepared materials (especially `2026-06-DECISION-DAY-OPEN-THIS-FIRST.md` and its companions).
2. Reply with **exactly one** of these two phrases (verbatim):

   - `"M2 done — begin user-led refinement/M3"`
   - `"one more wave on the 7 gaps (with specific priorities)"`

Until one of these two exact phrases is received, **do not** begin M3 execution or a new scoped wave. Continue improving gate readiness and living documentation only.

### Other Consistent Rules
- Zero new console errors or TS regressions from new work.
- Preserve demo/live/hybrid invariants at all times (`isSupabaseLive()`, `isSupabaseConfigured()`, w1/w2 hard blocks).
- Multiple sub-agents in parallel on "Continue."
- High-signal, low-noise deliverables.
- All synthesis must come from on-disk files (no invention).

---

## 3. Current State (As of This Handoff)

### Major Deliveries
- **C4 Complete** (realtime collaboration on the active branch `feat/agent-6-realtime-collaboration-invites`):
  - Zero-orphan realtime invites/membership lifecycle.
  - Rich presence surfaced across Teams, sidebar, Home, and Notes.
  - Home Global Workspace Hub MVP Phase A fully wired.
  - Zustand persist warning fixed (`safeLocalStorage`).

- **M2 Decision Gate Preparation** (very large body of work):
  - Multiple high-quality one-pagers created, including:
    - `2026-06-DECISION-DAY-OPEN-THIS-FIRST.md` (the primary file users are told to open first on smoke day)
    - `2026-06-DECISION-GATE-LATEST-POLISH-SUMMARY.md`
    - `2026-06-GATE-POLISH-CUMULATIVE-SUMMARY.md` (the best current one-screen view of recent polish)
  - Heavy cross-referencing and "Latest Polish" notes added to:
    - `WAVE8-MASTER-PLAN.md` (canonical record)
    - `README.md`
    - `ALL-2026-06-ARTIFACTS-INVENTORY-AND-QUICK-START.md`
    - Launch Guide, Command Center, Package Index, Readiness Pack, Master Handoff
    - Both retrospectives (`THIS-CONTINUE-WAVE-RETROSPECTIVE-2026-06.md` and `THIS-CONTINUE-WAVE-DELIVERED-FOR-YOU-2026-06.md`)
  - Activation kits prepared for both possible decisions:
    - `M3-PATH-STARTER-PACK-2026-06.md`
    - `ONE-MORE-WAVE-STARTER-OUTLINE-2026-06.md`
  - Hygiene baseline established (22 pre-existing TS errors only; 0 delta from C4).

### Current Position in the Master Plan
We are **paused at the M2 Decision Gate** (the deep Notes integration milestone).

The user has not yet run the canonical smoke or delivered one of the two decision phrases. All recent autonomous work has been documentation polish and cross-referencing to make the gate as low-friction and self-describing as possible.

**You are not authorized to begin M3 execution or a new scoped "one more wave" until the user explicitly gives one of the two phrases above.**

---

## 4. What Must Happen Next (Exact Protocol)

1. **User runs the smoke** using the prepared materials (primarily `2026-06-DECISION-DAY-OPEN-THIS-FIRST.md` and the companions it references).
2. **User replies with exactly one** of the two phrases listed in Section 2.
3. **Once the phrase is received**:
   - If `"M2 done — begin user-led refinement/M3"`: Activate the M3 path using the prepared materials in `M3-PATH-STARTER-PACK-2026-06.md` and related files.
   - If `"one more wave on the 7 gaps (with specific priorities)"`: Run a narrow, scoped follow-up wave using the prepared materials in `ONE-MORE-WAVE-STARTER-OUTLINE-2026-06.md`.

After the decision, perform any remaining additive documentation updates called for in the master plan.

---

## 5. Most Important Files for a New Agent (Read in This Order)

1. `docs/AGENT-HANDOFF-WAVE8-MASTER-PLAN-AND-CURRENT-STATE-2026-06.md` (this file)
2. `docs/WAVE8-MASTER-PLAN.md` (the living master plan – especially the 2026-06 sections)
3. `docs/2026-06-DECISION-DAY-OPEN-THIS-FIRST.md` (the primary file the user is told to open on smoke day)
4. `docs/2026-06-GATE-POLISH-CUMULATIVE-SUMMARY.md` (best current one-screen overview of recent polish)
5. `docs/ALL-2026-06-ARTIFACTS-INVENTORY-AND-QUICK-START.md` (inventory of key documents)
6. `docs/ALL-2026-06-DECISION-PACKAGE-MASTER-HANDOFF.md` (the ultimate handoff document)

---

## 6. Tone & Quality Bar

All deliverables must be:
- High-signal and low-noise
- Scannable (short paragraphs, bold key phrases, clear structure)
- Governance-obsessed (todos, verification, additive where appropriate)
- Warm/professional but precise
- 100% synthesized from on-disk reality

---

**You now have everything you need to continue the project at a world-class level.**

The next action belongs to the user (running smoke + giving one of the two exact phrases). Until then, continue improving gate readiness and living documentation if another "Continue." is issued.

Good luck. Build something excellent.