# M2 Test Run Instructions (Windows / PowerShell)

**Problem fixed**: Previous runs hit OS error 267 (invalid path) due to unquoted spaces in "Bad Ass Tasks".

## Exact one-liner to run the full expanded M2 smoke suite

Copy and paste this entire line into PowerShell (the quotes around the path are mandatory):

```
Set-Location "C:\Build\Bad Ass Tasks"; npx vitest run tests/notes-m2-smoke.test.ts --no-watch
```

(Alternative without changing dir, for CI/scripts:)
```
npx vitest run --root "C:\Build\Bad Ass Tasks" "tests/notes-m2-smoke.test.ts" --no-watch
```

## How to interpret results and failures

- Green: all ~23-36 high-signal cases (original + the 5 new gap closers) passed. Safe to commit.
- Red failure: the stack trace includes the exact `it('...')` title + source line in notes-m2-smoke.test.ts.
  - Match the failing title to the gap area:
    - "stable sortOrder renormalization" → hierarchy / onReparentNote / midpoint + renorm logic
    - "kanban intra-column drag persistence" → DatabaseBlockNodeView board drag/drop + onUpdateTask
    - "synced-block bidirectional contract" → SyncedBlockNodeView + onLinkNoteToNote symmetry
    - "named saved views stub" → Save current view + queryConfig enrichment path
    - "backlink centralization" → extractMentionsFromDoc + linkedNoteIds aggregation
  - Common causes: component text/attr change, mock handler not wired, new required prop, sortOrder now returns different distribution.
- Use `--reporter=verbose` appended to the one-liner for per-test timing + full console.
- Filter to M2 areas only: append `-t "M2|DatabaseBlock|SyncedBlock|Hierarchy|Gap Closers|sortOrder|bidirectional"`.
- Re-run single case during debug: `-t "exact it title substring"`.

Run this one-liner locally after any M2-related edit. No terminal execution from agents — user pastes directly.

## New learnings from sortOrder renormalization expansion (M2 closeout)

- Load-time robust renormalization (NotesView useEffect on notes change) + after-mutation helper (renormalizeSiblingsUnderParent + inline in handleReparentNote/handleCreateSubNote) form a complete belt-and-suspenders system:
  - Load-time: groups by parentNoteId, detects drift vs idx*1000, fires onUpdateNote only on mismatch + uses lastNormSigRef + anyDrift flag for idempotency (no update storms once clean).
  - Mutation paths: always compute clean integer end/midpoint then call full renorm on affected parent group(s) — old + dest for cross-parent. Math.floor + explicit % 1000 checks guarantee zero floats ever.
- Defensive String() + trim + existence + cycle guards (in handleReparentNote + wouldCreateCycle) protect against dnd-kit leakage, bad data at load/import time, and self/ancestor moves. All paths remain no-throw.
- Cross-parent and createSubNote paths correctly handle "empty dest" (lands at 0) and "dirty incoming" siblings (forces 0/1000/2000... post-move).
- Integer guarantee is now exhaustively exercised: every written sortOrder in renorm is Number.isInteger(o) && o % 1000 === 0.
- Test count uplift: original + prior gap closers + these 5 new focused cases (dirty load-complement, empty-dest cross, coercion guards, repeated mixed int proofs, createSub+cross multi-group) = materially stronger coverage on the highest-leverage M2 feature.

## Additional recommended commands for verification

- Focused sortOrder-only run (post-edit hygiene):  
  `Set-Location "C:\Build\Bad Ass Tasks"; npx vitest run tests/notes-m2-smoke.test.ts --no-watch -t "sortOrder|renormaliz|Gap Closers|Hierarchy drag|load-time|cross-parent|defensive guards|integer guarantees"`

- Verbose + filter for renorm call inspection: append `--reporter=verbose -t "M2 Gap Closers|stable sortOrder|load-time renormalization complement"`

- Single new case debug example: `-t "defensive guards + String coercion in renorm paths"`

- Full M2 smoke remains the primary one-liner at top of this doc. Re-run after any store/hierarchy/NotesView change touching parentNoteId or sortOrder.
