# M2 Continue Loop — Focused Smoke Command + Post-Smoke Autonomous Checklist

**Prepared autonomously for main agent at M2 Decision Gate (Continue wave).**  
**Date:** 2026-05-30 ~12:17  
**Canonical root:** `C:\Build\Bad Ass Tasks`  
**Test target:** `tests/notes-m2-smoke.test.tsx` (use .tsx exactly)  
**Style:** Matches exactly the rich timestamped Tee-Object + Write-Host annotated wrappers used in prior Continue hygiene runs (see terminal histories for 20260530-10xx hygiene blocks mentioning "user 'Continue'").

---

## 1. Precise Single PowerShell Command (or short block) — Run the focused M2 smoke NOW

Copy-paste the entire block into PowerShell (at project root, or it cds for you). Produces fresh `m2-smoke-continue-YYYYMMDD-HHmmss.log` with full verbose output, matching prior turn naming and capture style.

```powershell
cd "C:\Build\Bad Ass Tasks"; $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"; `
Write-Host "=== STARTING FOCUSED M2 SMOKE (notes-m2-smoke.test.tsx) FOR CONTINUE LOOP at $timestamp ===" -ForegroundColor Cyan; `
Write-Host "Verbose reporter + Tee capture (style-matched to prior continue turns' m2-smoke-continue-*.log)" -ForegroundColor Yellow; `
Write-Host "Log will be: m2-smoke-continue-$timestamp.log" -ForegroundColor White; `
npx vitest run tests/notes-m2-smoke.test.tsx --no-watch --reporter=verbose 2>&1 | Tee-Object -FilePath "m2-smoke-continue-$timestamp.log"; `
Write-Host "=== FOCUSED M2 SMOKE RUN COMPLETE ===" -ForegroundColor Green; `
Write-Host "Fresh log saved: m2-smoke-continue-$timestamp.log (full verbose output captured)" -ForegroundColor Cyan; `
Write-Host "Autonomous next step: Follow the Post-Smoke Checklist below (read log, count pass/fail, decide on tiny stabilization pass vs surface to user)." -ForegroundColor Magenta
```

**No-cd alternative (if preferred):**
```powershell
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"; `
Write-Host "=== STARTING FOCUSED M2 SMOKE (notes-m2-smoke.test.tsx) FOR CONTINUE LOOP at $timestamp ===" -ForegroundColor Cyan; `
npx vitest run --root "C:\Build\Bad Ass Tasks" "tests/notes-m2-smoke.test.tsx" --no-watch --reporter=verbose 2>&1 | Tee-Object -FilePath "m2-smoke-continue-$timestamp.log"; `
Write-Host "=== FOCUSED M2 SMOKE COMPLETE. Log: m2-smoke-continue-$timestamp.log ===" -ForegroundColor Green
```

**Expected baseline (from prior turns):** ~30-54 tests, variable failures mapped to the 7 Gaps (see `docs/M2-SMOKE-FAILURE-MAPPER-2026-05-31.md`). Use `-t "..."` filter variants only if narrowing for a micro-fix iteration.

**Capture:** The entire console output of this block (the Write-Hosts + vitest stream) + the generated .log file itself for evidence.

---

## 2. Short "What to do after the smoke finishes" — Autonomous Checklist for Main Agent

Follow **exactly** after the smoke command above completes (before any user-facing message or decision phrase). Stay fully autonomous; only surface to user after checklist + (optional micro-pass) concludes.

1. **Read the fresh log immediately:** Open `m2-smoke-continue-$timestamp.log` (or `tail` / `Get-Content ... -Tail 100` in another PS). Locate the final vitest summary lines (look for `❯ tests/notes-m2-smoke.test.tsx (NN tests | FF failed)`, the ✓/✕ counts, and any "FAIL" blocks).

2. **Count pass/fail precisely:** Record exact numbers (e.g. "39 passed | 15 failed (54 total)"). Compare delta to the most recent prior continue smoke log(s) in root (e.g. `m2-smoke-continue-20260530-102055.log` or `m2-smoke-post-patches-*.log`): did failures decrease, stay same, or regress? Note any *new* failing `it('...')` titles not seen before.

3. **Classify outcome autonomously:**
   - **All green (0 new failures, or only known pre-existing test debt that is stable):** No stabilization pass needed. Proceed to step 5 (prepare surface evidence).
   - **Failures present but improved vs last continue log (or clearly isolated to 1-2 known Gaps):** Consider **one tiny targeted stabilization pass** (max 1-2 files, using the exact failing `it()` titles mapped via `docs/M2-SMOKE-FAILURE-MAPPER-2026-05-31.md`). Do **not** do broad changes. After edit, immediately re-execute **this same smoke command** (new timestamp) + re-count. At most one such micro-iteration before surfacing.
   - **Same or worse, or many new signatures, or >~20 failures without clear mapper path:** Do **not** attempt further stabilization now. Surface the current state + counts + log excerpt + "one more wave..." recommendation with concrete gap priorities.

4. **If doing a micro-stabilization pass:** 
   - Use the Failure Mapper to own the exact Gap(s).
   - Make the smallest possible defensive/renorm/guard fix (honor all invariants: demo/live guards, no new TS beyond 22, no new console errors).
   - Re-run the **exact smoke command above** (fresh timestamp, e.g. m2-smoke-continue-...-2.log).
   - Re-apply steps 1-3. If still not clean enough for "M2 done", stop and surface with "one more wave (priorities: X,Y)".

5. **Prepare to surface (always, after 0 or 1 micro-pass):**
   - Note exact log filename(s) used and the final pass/fail counts (pre- and post- any micro).
   - Extract 3-5 line summary of top remaining failure modes (with `it()` titles if any).
   - Confirm hygiene baseline still holds if any code touched (run the 5-stage timestamped hygiene from `DECISION-GATE-SMOKE-HYGIENE-COMMANDS.md` if edits were made).
   - Assemble minimal evidence snippet: "M2 smoke (continue loop): 39 passed | 15 failed (see m2-smoke-continue-20260530-XXXXXX.log). Delta from prior: -2 failures. [No / One micro] stabilization pass performed. [Ready for decision phrase / Recommending one more wave on Gaps 1,3 (sortOrder + DB board)]."
   - **Then and only then:** Surface the above + full log path + your autonomous recommendation to the user, offering the two exact decision phrases.

**Governance (non-negotiable):** Never surface a decision phrase without having run this smoke (with log) + followed this checklist. Preserve 100% invariants. Zero new console/TS debt. If in doubt on "tiny pass vs surface", default to surfacing the current evidence — the user owns the final "one more wave" call.

---

**This artifact is ephemeral for the current Continue loop iteration.** After use, it can be archived into the evidence pack or `docs/`.  
*Generated autonomously by subagent following exact prior execution patterns from terminal histories + Decision Gate docs (no invention). Ready for immediate main-agent execution.*
