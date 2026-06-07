# M2 Smoke Execution Companion — Post-C4 — 2026-06

**Ultra-practical runbook.** Keep this + the Command Center open in a second window. Follow step-by-step. All commands copy-paste ready. Fits ~1-2 pages printed.

**Canonical root (quote exactly):** `C:\Build\Bad Ass Tasks`

**🚨 Critical Post-C4 Facts**:
- Smoke test file on disk: `tests/notes-m2-smoke.test.tsx` (**use .tsx** — legacy docs had the wrong extension).
- Post-C4 hygiene baseline (auditor task `019e74de-faf0-7861-8cff-0b3354c955d0`): Exactly **22 TS errors** (pre-existing M2 extraction residuals only; **0 new** from C4). See full report in [C4-WAVE-COMPLETION-2026-06.md](./C4-WAVE-COMPLETION-2026-06.md).
- C4 touched shared core (hybridStore, useTaskStore, app/page.tsx) — fresh full hygiene is **mandatory** before your smoke.

---

## Exact Recommended Order of Operations

1. Full Hygiene Regression (timestamped logs preferred)
2. M2 Smoke Suite (keep Failure Mapper open)
3. Manual Verification — M2 crown jewels **+ explicit C4 surfaces** (multi-tab live Supabase gold standard)
4. Re-run full hygiene (post-manual)
5. Capture evidence checklist (terminals + screenshots + statements)
6. Reply with complete evidence pack + **exactly one** decision phrase

---

## 1. Prep + Full Hygiene (MANDATORY Before Smoke)

```powershell
cd "C:\Build\Bad Ass Tasks"
git status   # Expect clean or note uncommitted C4/M2 changes
```

**Quick gate:**
```powershell
npm run typecheck && npm run lint && npm run build && npm run test && npm run test:e2e
```

**Recommended timestamped version (rich evidence, matches post-C4 auditor):**
```powershell
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"; `
npm run typecheck 2>&1 | Tee-Object -FilePath "typecheck-post-smoke-$timestamp.log"; `
npm run lint 2>&1 | Tee-Object -FilePath "lint-post-smoke-$timestamp.log"; `
npm run build 2>&1 | Tee-Object -FilePath "build-post-smoke-$timestamp.log"; `
npm run test 2>&1 | Tee-Object -FilePath "test-post-smoke-$timestamp.log"; `
npm run test:e2e 2>&1 | Tee-Object -FilePath "e2e-post-smoke-$timestamp.log"; `
Write-Host "Hygiene chain complete. Logs saved with timestamp $timestamp"
```

**Capture:** Copy the **entire** terminal block (stdout + stderr).

---

## 2. M2 Smoke Suite — Primary Commands (.tsx Corrected)

**Primary one-liner (recommended — copy/paste exactly):**
```powershell
Set-Location "C:\Build\Bad Ass Tasks"; npx vitest run tests/notes-m2-smoke.test.tsx --no-watch --reporter=verbose
```

**No-cd alternative:**
```powershell
npx vitest run --root "C:\Build\Bad Ass Tasks" "tests/notes-m2-smoke.test.tsx" --no-watch --reporter=verbose
```

**High-signal focused variants (for evidence or debugging):**
```powershell
# Highest-leverage: Gap 1 sortOrder + renorm cases
Set-Location "C:\Build\Bad Ass Tasks"; npx vitest run tests/notes-m2-smoke.test.tsx --no-watch --reporter=verbose -t "sortOrder|renormaliz|Gap Closers|Hierarchy drag|load-time|cross-parent|defensive guards|integer guarantees"

# Broad M2 surfaces
Set-Location "C:\Build\Bad Ass Tasks"; npx vitest run tests/notes-m2-smoke.test.tsx --no-watch --reporter=verbose -t "M2|Gap Closers|sortOrder|DatabaseBlock|SyncedBlock|backlink|kanban|history|synced"
```

**Via npm:**
```powershell
npm test -- tests/notes-m2-smoke.test.tsx -- --reporter=verbose
```

**Expected:** ~30–40 high-signal cases green.

**🚨 Any red (or manual breakage):** Immediately open [M2-SMOKE-FAILURE-MAPPER-2026-05-31.md](./M2-SMOKE-FAILURE-MAPPER-2026-05-31.md). Map the exact failing `it('title')` from the stack trace. **Do not declare M2 done.**

---

## 3. Manual Verification (After `npm run dev`)

```powershell
npm run dev
```

- Wait for `localhost:3000`. **Hard refresh ×2** (Ctrl+Shift+R). Open DevTools → Console (clear; filter Errors/Warnings; enable "Preserve log").

### M2 Crown Jewels (condensed)
1. **Hierarchy + Drag**: Create top-level + subs. Reparent + intra-parent reorder. No cycles. Optimistic UI + stable order/expand after hard refresh. Backlink badges (← N).
2. **Bidirectional Linking**: @mentions, /link or /note-link pickers. Full symmetry (task↔note + note↔note). Remove via panels. Refresh persistence.
3. **Rich TaskEmbeds**: `/task` slash. Inline edit title/due/priority/status/assignee. Unlink + deleted (red strikethrough). Click → TaskModal; live data.
4. **Version History**: Header + toolbar. Manual + title-change snapshots. Structured/JSON diff viewer. Restore (safety "Before restore" snapshot + confirm). Export JSON/TXT.
5. **DatabaseBlock (MVP)**: `/db-block`. Table ↔ Board. Filters + drags (intra/inter-column). Edit View (title/types/filters) → "Save current view" + Load dropdown (named views). Persists across reload.
6. **SyncedBlock**: `/synced-block` + picker. Re-sync, clickable source header nav, graceful missing state, live title sync.

### Explicit C4 Surfaces (Multi-Tab — Use 2+ Incognito Windows)
**Use real accounts where possible. Exercise invites/presence/Home while M2 Notes flows remain responsive.**

7. **Home Global Workspace Hub MVP — Phase A**:
   - Navigate to Home (default or sidebar).
   - **Workspace Pulse**: Grid of cards (name + role badge) → instant `switchWorkspace` on click. "live pulse" framing.
   - **Today's Focus**: Grouped actionable list (workspace pill + title + priority) → switch + tasks view.
   - **Recent Movement**: Scrollable cross-ws activity feed (workspace prefix + action + title + time).
   - **AI Summary**: Dynamic count-based cross-ws briefing stub + "coming soon" teaser.
   - Hard refresh on Home → aggregates repopulate cleanly.
   - Toggle `.env` Supabase keys (on/off) → graceful demo synthesis vs live member-scoped pulls. Confirm **separate global slices** (no per-ws pollution).

8. **Invites + Membership Lifecycle + Realtime Symmetry (P0)**:
   - Tab A (owner): Send invite to recipient email.
   - Tab B (recipient): Instant banner/bell notification (no refresh required).
   - Recipient accepts → instant workspace switch + member list update visible in owner Tab A.
   - Owner: Revoke or recipient declines → instant clear on both sides.
   - Hard refresh **all tabs mid-flow** → zero orphans (init fetches + realtime resume + `cleanupInviteEverywhere` RPC).
   - Self "Leave team" (non-owner) → instant access loss for actor + clean lists for others.
   - Remove member (owner) → survivors clean; removed user loses access on next action.
   - Concurrent: Two owners editing members → symmetric state.
   - Exercise last-owner protection + self-exit paths. (Live Supabase: confirm notifications refetch on `onInviteChange`/`onMemberChange`.)

9. **Rich Presence + UI Surfaces**:
   - Open Notes + Teams + Home across tabs/sessions.
   - **Sidebar** (`app/page.tsx`): Per-view live counts (👁N) + ✎ editing indicators on nav items.
   - **TeamsView**: Rich "editing X" badges on pills + full online list with status (view + editingItem). Zap icon + pulsing.
   - **Home**: Workspace Pulse cards framed with "live pulse" context.
   - **Notes**: Remote cursors visible in TipTap overlay (pre-existing; reconfirm no regression).
   - Switch workspaces/views → presence meta updates cleanly via `updatePresenceMeta` on `presence-${wsId}` (no leaks; reuse only).
   - Observe `onlineUsers` with view/editingItem across surfaces.

10. **Cross-Cutting Guards & Realtime Symmetry (every surface)**:
    - Guard toggle: Remove Supabase keys from `.env` → pure demo (synthesized Home aggregates + **no** invites/presence leaks or errors).
    - **Zero new console errors** across Notes crown jewels + all C4 surfaces.
    - Hard refresh ×2 + offline reconnect mid-flow on every surface → state (hierarchy, links, DB views, snaps, membership, aggregates, presence) survives perfectly.
    - (Live Supabase): Supabase dashboard — realtime publications + REPLICA IDENTITY FULL on `workspace_invites` / `workspace_members`. Watch postgres_changes.

**Post-manual hygiene**: Re-run the full timestamped hygiene chain. Confirm **no regressions** introduced by exercising Home switching, invites, or presence alongside M2 Notes flows.

---

## 4. Quick Evidence Capture Checklist (Minimum for Decision)

**Paste or attach everything in your reply:**

**Terminal Output**:
- Complete pre-smoke hygiene chain (full stdout + stderr).
- M2 smoke one-liner (full; verbose recommended).
- Any focused `-t` re-runs.
- Post-manual hygiene re-run.

**Screenshots** (timestamped filenames; 7–8 high-signal required):
1. Sidebar + editor note hierarchy (drag in progress or stable post-reparent + backlink badges ← N).
2. DatabaseBlock Board view (drag between columns + Edit View form open showing "Save current view" + named views Load dropdown populated).
3. Version History panel (diff viewer side-by-side with highlights + Restore button / confirm dialog).
4. SyncedBlock or TaskEmbed live card (inline edit + bidirectional panel symmetry).
5. **Home Hub surfaces**: Workspace Pulse cards (with "live pulse" framing) + Today's Focus grouped list + Recent Movement feed + AI summary stub.
6. **Presence surfaces**: TeamsView rich editing badges + online list + sidebar 👁 counts / ✎ dots.
7. **Invites realtime symmetry**: Multi-tab view (owner send + recipient instant banner + post-accept state).
8. DevTools Console tab (after hard refresh ×2 on Notes + Home + Teams; filter Errors; "Preserve log" enabled; show completely clean or only expected non-errors).

**Explicit Console / Runtime Statements** (include verbatim):
- "Zero *new* console errors on Notes surfaces + C4 surfaces (Home hub, invites flows, rich presence) post hard refresh ×2 (demo and live if tested)."
- "Post-manual hygiene re-run completed with [green / only pre-existing baseline noise]."

**Optional high-value**:
- `git status` + short `git diff --stat`.
- Browser network / Supabase dashboard realtime logs (live runs).
- Dated log files (the Tee outputs above).

---

## 5. Simple Failure Protocol

- **Any red** in automated smoke or during manual verification → **STOP immediately**.
- Open [M2-SMOKE-FAILURE-MAPPER-2026-05-31.md](./M2-SMOKE-FAILURE-MAPPER-2026-05-31.md) right away.
- Map the exact failing `it('title')` (or observed symptom) to the owning Gap (1–7).
- **Do not** reply with a decision phrase yet.
- Address under full governance (internal `todo_write`, mandatory `read_file` + path-restricted `grep` after every edit, 100% demo/live/hybrid guards, zero new console errors).
- Re-run the **entire sequence** (hygiene → smoke → full manual incl. C4 surfaces → capture) after fixes.
- Only clean green end-to-end evidence allows a decision reply.

---

## 6. How to Reply with the Decision + Evidence

After full clean run (hygiene + smoke + manual C4 + post-manual hygiene + screenshots + statements):

Paste the complete evidence pack (terminals + all screenshots + explicit statements) + **exactly one** of these two phrases (no changes, no paraphrasing):

- `"M2 done — begin user-led refinement/M3"`
- `"one more wave on the 7 gaps (with specific priorities)"` (include your additional priorities if selecting this path)

**Non-negotiable for either path**:
- All evidence above must be included.
- Re-run of hygiene + smoke + manual (including C4 surfaces) is required after any code changes in the chosen path.

---

**Docs to Keep Open While Running Smoke**:
- [M2-DECISION-COMMAND-CENTER-POST-C4-2026-06.md](./M2-DECISION-COMMAND-CENTER-POST-C4-2026-06.md) (ultimate one-pager + full matrix + pre-drafted WAVE8 blocks)
- [M2-DECISION-READINESS-PACK-2026-06.md](./M2-DECISION-READINESS-PACK-2026-06.md)
- [M2-SMOKE-FAILURE-MAPPER-2026-05-31.md](./M2-SMOKE-FAILURE-MAPPER-2026-05-31.md) (instant red → gap)
- [M2-SIGNOFF-CHECKLIST-2026-05-31.md](./M2-SIGNOFF-CHECKLIST-2026-05-31.md) (11 invariants + full "What Good Looks Like")
- [C4-WAVE-COMPLETION-2026-06.md](./C4-WAVE-COMPLETION-2026-06.md) (post-C4 baseline + multi-tab verification matrix)

**Ready. Execute in order. Capture everything. Decide with the exact phrase.**

*Pure synthesis from on-disk post-C4 artifacts under strict governance. Low friction. Immediately actionable.*

**End of M2 Smoke Execution Companion — Post-C4 — 2026-06**