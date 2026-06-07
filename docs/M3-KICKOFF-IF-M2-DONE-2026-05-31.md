# M3 Kickoff Pack — IF "M2 done — begin user-led refinement/M3" — 2026-05-31

**Status**: READY-TO-EXECUTE. Ultra-narrow, spawn-ready dual-path artifact.  
**Trigger Phrase (exact)**: "M2 done — begin user-led refinement/M3"  
**Purpose**: The moment the phrase is received, launch the prioritized first M3 agents below **in parallel** with zero additional instructions. This is the instant-activation package for the M2-complete → user-led refinement / M3 path.

**Primary Sources (verbatim synthesis only — no invention)**:
- [M2-SIGNOFF-CHECKLIST-2026-05-31.md](./M2-SIGNOFF-CHECKLIST-2026-05-31.md) §5 (M3 Bridge Items)
- [M2-READINESS-REPORT-2026-05-31.md](./M2-READINESS-REPORT-2026-05-31.md) (explicit M2→M3 bridges for Gaps 3 & 5)
- [MILESTONE-2-PROGRESS-2026-05-28.md](./MILESTONE-2-PROGRESS-2026-05-28.md) (M3 Bridge Scaffolding Enhancer + handoff notes)
- [WAVE8-MASTER-PLAN.md](./WAVE8-MASTER-PLAN.md) (M2 Status block + Agent 47 Phase 3 context)
- Polished M2→M3 scaffolds ("M2→M3 SERVER QUERY ENGINE STUBS", "M2→M3 FULL CONTENT BIDIRECTIONAL SYNC SCAFFOLDING", "M2→M3 BRIDGE AI INTEGRATION SCAFFOLDING", "HANDOFF FOR FUTURE AGENT 47/53 (M3)")
- M3 Starting Kit for Gaps 3&5 foundation: AGENT-64-SCHEMA-RPC-PROPOSAL.md, AGENT-65-REALTIME-PROPOSAL.md, AGENT-68-HYBRID-LIVE-PROPOSAL.md, AGENT-72-PHASE2-NOTES-PROPOSAL.md, AGENT-73-PHASE3-AI-GRAPH-PROPOSAL.md + Gap 3/5 definitions from SIGNOFF §1

**Related Decision Day & Dual-Path Kickoff Artifacts** (cross-refs for full context):
- [M2-DECISION-DAY-2026-05-31.md](./M2-DECISION-DAY-2026-05-31.md) (primary one-pager + exact decision phrases)
- [M2-DECISION-DAY-COMMAND-CENTER-2026-05-31.md](./M2-DECISION-DAY-COMMAND-CENTER-2026-05-31.md) (one-screen practical reference)
- [M2-ACTIVATION-SCRIPTS-2026-05-31.md](./M2-ACTIVATION-SCRIPTS-2026-05-31.md) (ultra-short launch helper)
- [M2-EVIDENCE-PACK-2026-05-31.md](./M2-EVIDENCE-PACK-2026-05-31.md) (master aggregation; claims merge of this M3 Starting Kit)
- [M2-ONE-MORE-WAVE-PROPOSAL-2026-05-31.md](./M2-ONE-MORE-WAVE-PROPOSAL-2026-05-31.md) (conditional "one more wave" planning)
- [M2-ONE-MORE-WAVE-KICKOFF-2026-05-31.md](./M2-ONE-MORE-WAVE-KICKOFF-2026-05-31.md) (spawn-ready counterpart for the alternate path)

**Non-Negotiable Governance for All M3 Agents**:
- Narrow charters only. Zero scope creep.
- Every agent **must** use internal `todo_write` (minimum 4 steps: plan, research, implement, verify).
- **Mandatory** post-edit `read_file` (full file + targeted offsets) + path-restricted `grep` on every file touched before marking step complete.
- 100% preservation of demo/live/hybrid invariants, zero new console errors, feature-folder architecture.
- All work folded only after main-thread verification.
- Update living handoff docs (MILESTONE-2-PROGRESS, WAVE8-MASTER-PLAN M2/M3 status, SIGNOFF-CHECKLIST §5) with evidence.

---

## Prioritized First M3 Agents (Gaps 3 & 5 + §5 Bridges Focus)

Launch **M3-1, M3-2, M3-3 in parallel** the instant the trigger phrase arrives.

### M3-1: DatabaseBlock Full Production + Hybrid Server Query/RPC Engine (Gap 3 + §5 "Full custom TipTap NodeView + React rendering engine for DatabaseBlock with hybrid query execution + RPCs (beyond the current JSON config + DOM table/Board)")

**Narrow Charter**: Build directly on the delivered M2 MVP (interactive Board/kanban with intra+inter drag, full queryConfig auto-persist, named saved views MVP). Implement the first production slice of the hybrid query execution engine + RPC hook foundations using the polished "M2→M3 SERVER QUERY ENGINE STUBS / RPC FOUNDATION" scaffolding in `database-block.ts` and `database-block-node-view.tsx`. Deliver stable result shapes, RLS/hybrid-aware queries (demo guards non-negotiable), minimal working server query path (or fully documented RPC stubs per AGENT-64). Leave all existing M2 UI, drag, filters, views, and persistence untouched. Add explicit next-M3 markers.

**Success Criteria**:
- Named views save/load/apply/persist correctly in both demo and live Supabase.
- At least one end-to-end server-backed query (filtered/aggregated) executes via new RPC foundation without errors or invariant violations.
- All M2 Board/kanban behaviors, drag, queryConfig persistence 100% unchanged and green.
- Expanded smoke/manual coverage for the new query paths.
- Scaffolds remain crystal-clear for subsequent M3 slices.

**Primary Files** (read 100% first, multiple targeted reads required):
- `features/notes/editor/extensions/database-block.ts`
- `features/notes/editor/extensions/database-block-node-view.tsx`
- `lib/data/hybridStore.ts` (query paths)
- `tests/notes-m2-smoke.test.ts`
- `supabase/schema.sql` (read-only reference for RPC patterns)

**Spawn-Ready Prompt Template** (copy the entire block below verbatim as the sub-agent system prompt the moment the trigger phrase is received):
```
You are M3-1: DatabaseBlock Full Production + Hybrid Server Query/RPC Engine Agent (Gaps 3 focus).

[PASTE THE FULL "Narrow Charter", "Success Criteria", "Primary Files", and the "Non-Negotiable Governance for All M3 Agents" section from the top of M3-KICKOFF-IF-M2-DONE-2026-05-31.md here]

Execute with perfect fidelity:
1. Begin with todo_write (plan/research/implement/verify).
2. Perform exhaustive initial read_file + grep on all Primary Files.
3. Implement only within charter.
4. After every edit: immediate full + targeted read_file + grep verification.
5. Preserve all invariants. Zero console errors.
6. Upon completion: concise evidence summary + propose updates to MILESTONE-2-PROGRESS and WAVE8-MASTER-PLAN.

Report status only through structured updates. No assumptions.
```

### M3-2: SyncedBlock Full Bidirectional Content Sync + Production Edges (Gap 5 + §5 "SyncedBlock bidirectional live sync + richer edge handling (M2→M3 explicit)")

**Narrow Charter**: Advance the title-only bidirectional MVP to full content bidirectional live sync. Implement using the polished "M2→M3 FULL CONTENT BIDIRECTIONAL SYNC SCAFFOLDING", "CONTENT_WRITE STUB", cycle handling, and edge comments in `synced-block.ts` and `synced-block-node-view.tsx`. Production-grade handling for missing/deleted targets, cycles, deep hierarchies, permissions, live auto-updates on source change. Strengthen any remaining scaffolding. Preserve picker, navigation, title-sync, and all M2 behaviors perfectly.

**Success Criteria**:
- Full note content syncs bidirectionally and live (source change triggers target update and vice-versa) in demo + live.
- All edge cases from the M2→M3 scaffolding (deleted/missing, cycles, hierarchies) handled gracefully with no data loss or crashes.
- Title sync, picker, and navigation continue to work identically (zero regression).
- Smoke + manual verification exercises full sync + edges.
- Remaining content sync work clearly marked for any follow-on M3.

**Primary Files** (read 100% first):
- `features/notes/editor/extensions/synced-block.ts`
- `features/notes/editor/extensions/synced-block-node-view.tsx`
- `features/notes/editor/TipTapEditor.tsx`
- `lib/data/hybridStore.ts`

**Spawn-Ready Prompt Template** (copy entire block verbatim):
```
You are M3-2: SyncedBlock Full Bidirectional Content Sync + Production Edges Agent (Gap 5 focus).

[PASTE THE FULL "Narrow Charter", "Success Criteria", "Primary Files", and the "Non-Negotiable Governance for All M3 Agents" section from the top of M3-KICKOFF-IF-M2-DONE-2026-05-31.md here]

Execute with perfect fidelity:
1. Begin with todo_write (plan/research/implement/verify).
2. Perform exhaustive initial read_file + grep on all Primary Files.
3. Implement only within charter.
4. After every edit: immediate full + targeted read_file + grep verification.
5. Preserve all invariants. Zero console errors.
6. Upon completion: concise evidence summary + propose updates to MILESTONE-2-PROGRESS and WAVE8-MASTER-PLAN.

Report status only through structured updates. No assumptions.
```

### M3-3: Deeper AI Integration in Editor (from §5 "Deeper AI integration in editor (real xAI/Grok calls for 'Summarize...', 'Extract action items', 'Improve writing' — replace the explicit stubs/markers with production orchestration, context-aware prompts, and streaming)")

**Narrow Charter**: Replace the three explicit AI slash stubs (currently containing "WHERE THE xAI/Grok CALL WILL GO" markers + "M2→M3 BRIDGE AI INTEGRATION SCAFFOLDING (ai-editor-points)" + "HANDOFF FOR FUTURE AGENT 47/53 (M3)") in TipTapEditor.tsx with production orchestration. Wire real (or production-ready stub) xAI/Grok calls using context injection points, rich prompts, and streaming hooks. Reference AGENT-73-PHASE3-AI-GRAPH-PROPOSAL and Agent 47/29 handoffs. Keep all changes cleanly reversible and non-breaking to the slash menu or existing commands.

**Success Criteria**:
- The three AI commands ("Summarize...", "Extract action items", "Improve writing") invoke orchestrated Grok calls with full relevant note + task + workspace context.
- Streaming responses integrate cleanly into the editor.
- Zero regression on slash command menu or non-AI flows.
- Scaffolds updated with production markers and clear handoff for deeper graph/AI work.

**Primary Files** (read 100% first):
- `features/notes/editor/TipTapEditor.tsx` (AI slash category block, ~1080-1222 and related)
- Any supporting AI orchestration files referenced in proposals

**Spawn-Ready Prompt Template** (copy entire block verbatim):
```
You are M3-3: Deeper AI Integration in Editor Agent (§5 AI bridge).

[PASTE THE FULL "Narrow Charter", "Success Criteria", "Primary Files", and the "Non-Negotiable Governance for All M3 Agents" section from the top of M3-KICKOFF-IF-M2-DONE-2026-05-31.md here]

Execute with perfect fidelity:
1. Begin with todo_write (plan/research/implement/verify).
2. Perform exhaustive initial read_file + grep on all Primary Files.
3. Implement only within charter.
4. After every edit: immediate full + targeted read_file + grep verification.
5. Preserve all invariants. Zero console errors.
6. Upon completion: concise evidence summary + propose updates to MILESTONE-2-PROGRESS and WAVE8-MASTER-PLAN.

Report status only through structured updates. No assumptions.
```

---

**Launch Protocol (copy-paste ready)**:
1. User utters exact trigger phrase.
2. Immediately spawn M3-1 + M3-2 + M3-3 in parallel (background where supported).
3. Each agent begins with its todo_write + full primary file reads.
4. After first wave: main thread produces consolidated summary, updates living docs, and prepares subsequent M3 agents from remaining §5 items (stable sortOrder finalization, mobile/keyboard/a11y depth, Synced richer edges beyond this wave, onboarding magic moments, broader Wave 8 Phase 2/3 unlocks).

**This package + the polished M2→M3 scaffolds in the codebase = complete M3 Starting Kit for Gaps 3&5 + §5 bridges. Ready for legendary execution the instant the decision phrase arrives.**

**Prepared strictly docs-only per Dual-Path Kickoff Packager charter. All content derived directly from cited artifacts.**
