# M2 Smoke Run Companion — 2026-05-31

**Ultra-narrow, live-use reference for Decision Day smoke execution.**  
Project root: `C:\Build\Bad Ass Tasks`

**🚨 RED SMOKE INSTANT JUMP:** Use **[M2-SMOKE-FAILURE-MAPPER-2026-05-31.md](./M2-SMOKE-FAILURE-MAPPER-2026-05-31.md)** — the practical failure signatures → gaps reference. Map any failing `it('title')` directly to Gap + kickoff charter (keep open with this doc while running smoke tests).

## Exact Windows One-Liner (PowerShell — quotes mandatory)

```powershell
Set-Location "C:\Build\Bad Ass Tasks"; npx vitest run tests/notes-m2-smoke.test.ts --no-watch
```

Alternative (no cd):
```powershell
npx vitest run --root "C:\Build\Bad Ass Tasks" "tests/notes-m2-smoke.test.ts" --no-watch
```

Append `--reporter=verbose` for timing/console. Filter: `-t "M2|Gap Closers|sortOrder|DatabaseBlock|SyncedBlock"`.

**🚨 QUICK JUMP (if any test fails):** [M2-SMOKE-FAILURE-MAPPER-2026-05-31.md](./M2-SMOKE-FAILURE-MAPPER-2026-05-31.md) — the practical failure signatures → gaps reference (open this tab immediately on red for smoke runners).

**Full hygiene (MANDATORY):**  
`npm run typecheck && npm run lint && npm run build && npm run test && npm run test:e2e`

## What to Capture

- **Terminal output**: Full stdout from one-liner + hygiene (copy entire block).
- **Screenshots** (2-3 key flows):
  - Hierarchy tree + drag/reparent (sidebar + editor)
  - DatabaseBlock Board view (drag + "Save current view" / named views dropdown)
  - SyncedBlock or History diff/restore/export
- Console (DevTools): zero new errors after hard refresh (Ctrl+Shift+R) ×2.
- Mark this checklist + note pass/fail + any signatures.

## Quick Manual Smoke Checklist (15-30 min)

After `npm run dev` (localhost:3000 ready, hard refresh, clear console, confirm DEMO):

1. **Hierarchy + Drag**: Create notes/subs. Drag reparent + reorder. No cycles. Stable post-refresh. Sidebar + search badges (← N).
2. **Bidirectional Linking**: @mentions + /link /note-link pickers. Verify symmetry (task↔note, note↔note), panels, refresh persistence.
3. **TaskEmbeds**: /task embed. Inline edits (title/due/priority/status/assignee). Unlink + deleted state. Live updates.
4. **Version History**: Manual/title snapshots. Diff viewer. Restore ("Before restore" safety snap). Export JSON/TXT.
5. **DatabaseBlock**: /db-block insert. Table ↔ Board. Filters + intra-column drag. Edit View form → title/types/filters + "Save current view" + Load dropdown. Persists.
6. **SyncedBlock**: /synced-block + picker. Re-sync, clickable header nav, graceful missing state, live title.
7. **Post-Smoke**: Hard refresh ×2 (all state survives). Console clean. Re-run hygiene. (If .env: toggle LIVE Supabase — same flows.)

Full details + "What Good Looks Like": See Evidence Pack §3.

## 🚨 Failure Signatures → Gaps Reference (PRIMARY RED-SMOKE TOOL)

Drawn directly from `tests/notes-m2-smoke.test.ts` (M2 Gap Closers block + 5 new high-signal cases) + M2-TEST-RUN-INSTRUCTIONS.md. **For instant title-to-gap lookup while smoke is red: use the dedicated [M2-SMOKE-FAILURE-MAPPER-2026-05-31.md](./M2-SMOKE-FAILURE-MAPPER-2026-05-31.md) — the practical failure signatures → gaps reference (the go-to for smoke test runners).**

If red: Stack trace shows exact `it('title')`. Map to gap:

- `"stable sortOrder renormalization"` → hierarchy / `onReparentNote` / midpoint + renorm logic (Gap 1: Stable integer sortOrder)
- `"kanban intra-column drag persistence"` → `DatabaseBlockNodeView` board drag/drop + `onUpdateTask` (Gap 3: DatabaseBlock)
- `"synced-block bidirectional contract"` → `SyncedBlockNodeView` + `onLinkNoteToNote` symmetry (Gap 5: SyncedBlock)
- `"named saved views stub"` → "Save current view" + `queryConfig` enrichment (Gap 3)
- `"backlink centralization"` → `extractMentionsFromDoc` + `linkedNoteIds` aggregation (Gap 2: Backlinks)

Other common: text/attr changes, un-wired mocks, new required props, sortOrder distribution shift.

**Full 7 Gaps**: See [M2-SIGNOFF-CHECKLIST-2026-05-31.md](./M2-SIGNOFF-CHECKLIST-2026-05-31.md) §1.

## Master Links

- **Master Evidence Pack** (single source of truth): [M2-EVIDENCE-PACK-2026-05-31.md](./M2-EVIDENCE-PACK-2026-05-31.md)
- **Decision Day Command Center** (one-screen): [M2-DECISION-DAY-COMMAND-CENTER-2026-05-31.md](./M2-DECISION-DAY-COMMAND-CENTER-2026-05-31.md)
- **🚨 Smoke Failure Mapper** (PRIMARY for anyone running smoke tests: red smoke instant lookup — the practical failure signatures → gaps reference): [M2-SMOKE-FAILURE-MAPPER-2026-05-31.md](./M2-SMOKE-FAILURE-MAPPER-2026-05-31.md)
- Decision Day Cheat Sheet: [M2-DECISION-DAY-CHEAT-SHEET-2026-05-31.md](./M2-DECISION-DAY-CHEAT-SHEET-2026-05-31.md)

**After run**: Reply with exact decision phrase from Command Center / Evidence Pack.

*Concise. Paste one-liner. Run. Capture. Decide. All else in the linked master docs.*
