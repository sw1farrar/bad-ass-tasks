# M2 Smoke Failure Mapper — 2026-05-31

**Ultra-narrow live reference.** When `notes-m2-smoke.test.ts` fails, copy the exact `it('title')` from stack and map instantly to gap + kickoff doc that owns the charter.

**Run command** (from M2-SMOKE-RUN-COMPANION):
```
npx vitest run tests/notes-m2-smoke.test.ts --no-watch
```
Filter: `-t "Gap Closers|sortOrder|kanban|synced|saved views|backlink"`

## Common Failure Titles → Gap + Kickoff Document

### sortOrder signatures (Gap 1)
- `stable sortOrder renormalization: sequential same-parent...`  
  → **Gap 1: Stable integer sortOrder normalization**  
  → [M2-ONE-MORE-WAVE-KICKOFF-2026-05-31.md](./M2-ONE-MORE-WAVE-KICKOFF-2026-05-31.md) (P-1 Spawn-Ready Charter)
- `same-parent reparent computes midpoint sortOrder...` / `cross-parent reparent assigns clean integer sortOrder...` / `createSubNote sets clean integer...` / `load-time renormalization complement (dirty initial orders...` / `integer guarantees across repeated mixed mutations...`  
  → **Gap 1** → P-1 (above)

### backlinks signatures (Gap 2)
- `backlink centralization: extractMentionsFromDoc combined with note.linkedNoteIds...`  
  → **Gap 2: Backlinks centralization**  
  → [M2-ONE-MORE-WAVE-KICKOFF-2026-05-31.md](./M2-ONE-MORE-WAVE-KICKOFF-2026-05-31.md) (P-2)

### kanban / DatabaseBlock / saved views signatures (Gaps 3+4)
- `kanban intra-column drag persistence: drag start/over/drop...` / `DB Kanban drag within columns: board view renders...` / `DB Kanban drag within columns: native drag...`  
  → **Gap 3: DatabaseBlock production completeness**  
  → [M2-ONE-MORE-WAVE-KICKOFF-2026-05-31.md](./M2-ONE-MORE-WAVE-KICKOFF-2026-05-31.md) (P-3)
- `named saved views stub if present: Save current view enriches queryConfig...`  
  → **Gap 3** → P-3
- `server snapshot paths...` / `onPersistSnapshot returns false immediately when !isSupabaseLive...` / `full server snapshot round-trip...`  
  → **Gap 4: Version History depth** → P-3 (shared)

### synced signatures (Gap 5)
- `synced-block bidirectional contract: linking notes to a synced source...`  
  → **Gap 5: SyncedBlock bidirectional + polish**  
  → [M2-ONE-MORE-WAVE-KICKOFF-2026-05-31.md](./M2-ONE-MORE-WAVE-KICKOFF-2026-05-31.md) (P-4)
- `SyncedBlock basic insertion + lookup behavior...` / `SyncedBlock with the new picker...` / `lookup behavior: shows "Referenced note not found"...`  
  → **Gap 5** → P-4

## Other Common Smoke Failures
- Mock wiring / new required props / text changes in DatabaseBlockNodeView or SyncedBlockNodeView → Gap 3/5 (P-3/P-4)
- sortOrder distribution shift after renorm changes → Gap 1 (P-1)
- See full test for `it` titles under "M2 Gap Closers", "M2 Targeted Regression", "Hierarchy drag/sortOrder normalization functions", "SyncedBlock...", "DatabaseBlock Edit View..."

**Full 7 Gaps definitions**: [M2-SIGNOFF-CHECKLIST-2026-05-31.md](./M2-SIGNOFF-CHECKLIST-2026-05-31.md) §1  
**Smoke execution + more signatures**: [M2-SMOKE-RUN-COMPANION-2026-05-31.md](./M2-SMOKE-RUN-COMPANION-2026-05-31.md)  
**Detailed evidence + interpretation**: [M2-EVIDENCE-PACK-2026-05-31.md](./M2-EVIDENCE-PACK-2026-05-31.md)

*Concise. Derived strictly from notes-m2-smoke.test.ts (esp. Gap Closers describe block) + M2-ONE-MORE-WAVE-KICKOFF-2026-05-31.md charters. Use while smoke is red.*
