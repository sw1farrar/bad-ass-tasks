# M2 Decision Day Command Center — 2026-05-31

**One-screen reference. Open this. Run. Decide.**

**🚨 DECISION-DAY SMOKE COMPANION — OPEN THIS WHILE RUNNING TESTS (PRIMARY LIVE HELPER):**  
**[M2-SMOKE-RUN-COMPANION-2026-05-31.md](./M2-SMOKE-RUN-COMPANION-2026-05-31.md)**  
*(exact test variants, full manual smoke checklist, what to capture, failure signatures → gaps map. The practical real-time reference for executing smoke right now.)*

**Smoke One-Liner** (PowerShell; exact):
```powershell
Set-Location "C:\Build\Bad Ass Tasks"; npx vitest run tests/notes-m2-smoke.test.ts --no-watch
```

**🚨 QUICK JUMP (smoke failure signatures → gaps):** [M2-SMOKE-FAILURE-MAPPER-2026-05-31.md](./M2-SMOKE-FAILURE-MAPPER-2026-05-31.md) — open now for instant title-to-gap mapping while running.

**🚨 LIVE SMOKE RUN COMPANION** (open this now — use while executing tests):  
**[→ M2-SMOKE-RUN-COMPANION-2026-05-31.md](./M2-SMOKE-RUN-COMPANION-2026-05-31.md)** — exact variants, capture checklist, full manual smoke steps, failure signatures → gaps map. The practical live-use helper for Decision Day smoke execution. **(Keep this tab open during the entire smoke run.)**

**🚨 WHEN SMOKE IS RED — INSTANT JUMP TO THE DEDICATED FAILURE SIGNATURES → GAPS REFERENCE:**  
**[M2-SMOKE-FAILURE-MAPPER-2026-05-31.md](./M2-SMOKE-FAILURE-MAPPER-2026-05-31.md)** — the practical failure signatures → gaps reference. Map exact failing `it('title')` directly to Gap + owning charter in one click. Open alongside the Companion for smoke runners.

**Decision Phrases** (reply with exactly one):
- "M2 done — begin user-led refinement/M3"
- "one more wave on the 7 gaps (with specific priorities)"

**Checklist**
- Run hygiene: `npm run typecheck && npm run lint && npm run build && npm run test && npm run test:e2e`
- Run smoke (one-liner above) — **use [M2-SMOKE-RUN-COMPANION-2026-05-31.md](./M2-SMOKE-RUN-COMPANION-2026-05-31.md) LIVE while executing** for exact variants, captures, manual checklist & troubleshooting. **If red: immediately open [M2-SMOKE-FAILURE-MAPPER-2026-05-31.md](./M2-SMOKE-FAILURE-MAPPER-2026-05-31.md) — the practical failure signatures → gaps reference**
- Run manual smoke (hierarchy/drag, bidir linking/picker/mentions, TaskEmbeds, History restore/export, DatabaseBlock + named views, SyncedBlock)
- Capture evidence (full terminal output + 2-3 screenshots of key flows)
- Check console (zero new errors post hard-refresh ×2)
- Reply with exact decision phrase

**Activation — Exact Launch Commands** (instant phrase received)

**"M2 done — begin user-led refinement/M3"** (launch M3-1/M3-2/M3-3):
```powershell
# >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> COPY FROM HERE (M3 path)
# M3-1: DatabaseBlock + hybrid RPC  |  M3-2: SyncedBlock full sync  |  M3-3: AI editor integration
# Next: use full prompts from M3-KICKOFF-IF-M2-DONE-2026-05-31.md (spawn all 3 in parallel)
Set-Location "C:\Build\Bad Ass Tasks"
# <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< END COPY
```

**"one more wave on the 7 gaps (with specific priorities)"** (launch P-1 to P-5):
```powershell
# >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> COPY FROM HERE (One More Wave path)
# P-1: Gap 1 SortOrder  |  P-2: Gap 2 Backlinks  |  P-3: Gaps 3+4 DB+History  |  P-4: Gap 5 Synced  |  P-5: Gaps 6+7 slim+tests
# Next: use full prompts from M2-ONE-MORE-WAVE-KICKOFF-2026-05-31.md (spawn all 5 in parallel)
Set-Location "C:\Build\Bad Ass Tasks"
# <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< END COPY
```

**Governance**: Narrow charters only. Internal `todo_write` mandatory. Post-edit full `read_file` + path-restricted `grep`. Preserve demo/live/hybrid invariants. Zero new console errors.

**Quick Links**
- **🚨🚨 PRIMARY: Smoke Run Companion (LIVE HELPER — OPEN & USE THIS WHILE RUNNING SMOKE TESTS RIGHT NOW)**: [M2-SMOKE-RUN-COMPANION-2026-05-31.md](./M2-SMOKE-RUN-COMPANION-2026-05-31.md) — exact variants + captures + manual steps + troubleshooting
- **🚨 Smoke Failure Mapper (PRIMARY RED-SMOKE JUMP for test runners — the practical failure signatures → gaps reference)**: [M2-SMOKE-FAILURE-MAPPER-2026-05-31.md](./M2-SMOKE-FAILURE-MAPPER-2026-05-31.md)
- Master Evidence Pack: [M2-EVIDENCE-PACK-2026-05-31.md](./M2-EVIDENCE-PACK-2026-05-31.md)
- Activation Scripts (ultra-short launch helper): [M2-ACTIVATION-SCRIPTS-2026-05-31.md](./M2-ACTIVATION-SCRIPTS-2026-05-31.md)
- Main Decision Day One-Pager: [M2-DECISION-DAY-2026-05-31.md](./M2-DECISION-DAY-2026-05-31.md)
- Decision Day Cheat Sheet: [M2-DECISION-DAY-CHEAT-SHEET-2026-05-31.md](./M2-DECISION-DAY-CHEAT-SHEET-2026-05-31.md)
- Ultra-Clean Activation: [M2-ULTRA-CLEAN-ACTIVATION-2026-05-31.md](./M2-ULTRA-CLEAN-ACTIVATION-2026-05-31.md)
- Post-Decision 48h Playbook: [M2-POST-DECISION-48HOUR-PLAYBOOK-2026-05-31.md](./M2-POST-DECISION-48HOUR-PLAYBOOK-2026-05-31.md)
- M2 Test Run Instructions: [M2-TEST-RUN-INSTRUCTIONS.md](./M2-TEST-RUN-INSTRUCTIONS.md)
- M3 Kickoff Pack: [M3-KICKOFF-IF-M2-DONE-2026-05-31.md](./M3-KICKOFF-IF-M2-DONE-2026-05-31.md)
- One More Wave Kickoff: [M2-ONE-MORE-WAVE-KICKOFF-2026-05-31.md](./M2-ONE-MORE-WAVE-KICKOFF-2026-05-31.md)
- Crown jewels: [M2-SIGNOFF-CHECKLIST-2026-05-31.md](./M2-SIGNOFF-CHECKLIST-2026-05-31.md) | [M2-READINESS-REPORT-2026-05-31.md](./M2-READINESS-REPORT-2026-05-31.md)

*Copy-paste ready. All per M2-EVIDENCE-PACK + SIGNOFF-CHECKLIST §4.*