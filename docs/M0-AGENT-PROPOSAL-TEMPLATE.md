# M0 Agent Proposal Template

**Milestone**: M0 — Architecture Hygiene, Baseline Verification & Folder Reset (per WAVE8-MASTER-PLAN.md)  
**Extracted by**: Docs-Finalization-Agent (from M0-Docs-Runbooks-Agent proposal)  
**Source Document**: `docs/M0-DOCS-RUNBOOKS-PROPOSAL.md` (Section 3 — verbatim content)  
**Date**: 2026-05-25 (PT)  
**Status**: Operational template for all M0 sub-agents (follows proposal exactly)  
**Governance**: MANDATORY for TS-Hygiene, Folder-Pilot, CI-CD, Verification-Harness, and Docs agents. Every proposal *must* include the Hybrid Guard & Demo Invariant Audit Matrix. Use in conjunction with `docs/M0-HYGIENE-RUNBOOK.md` (commands/audit/smoke) and `docs/M0-VERIFICATION-SIGN-OFF-TEMPLATE.md`.

This is the standardized proposal format as defined in the M0 charter and delivered in the source proposal (modeled on AGENT-71/AGENT-70 style). Content below is **exactly** as proposed.

---

## 3. M0 Agent Proposal Template

**All M0 sub-agents** (TS-Hygiene, Folder-Pilot, CI-CD, Verification-Harness, and this Docs agent) **must** use this standardized proposal format (modeled on AGENT-71 / AGENT-70 / etc.). This ensures consistency and embeds guard auditing.

**Required Header** (copy-paste):
```
# M0-XXX-PROPOSAL: [Descriptive Title]

**Agent**: [M0-XXX-Agent]  
**Reporting To**: Supervisor Agent 44 (ID: 019e6070-aa6a-7373-8030-7b778d4d73ff)  
**Milestone**: M0 (Hygiene, Baseline Verification & Folder Reset)  
**Date**: 2026-05-25 (PT)  
**Status**: **PROPOSAL ONLY — SUBMITTED FOR SUPERVISOR REVIEW**  
**Governance Compliance**: [Statement affirming proposal gate, Iron Rule, demo invariant, todo_write, exclusive report to 44, zero changes until approval.]
```

**Required Sections** (minimum):
1. Executive Summary & Charter Fulfillment (quote relevant charter slice from master plan).
2. Audit / Diagnostic Findings (with tool evidence, current baseline).
3. Detailed Proposal (root causes, exact diffs as code blocks or search_replace instructions, phased plan, risk matrix).
4. **Hybrid Guard & Demo Invariant Audit Matrix** (MANDATORY — see template below. Non-negotiable per plan line 341).
5. Verification & Success Criteria (tied to M0 gate + this runbook's commands/smoke/audit).
6. Risks, Mitigations & Rollback.
7. Proposed Execution Sequencing / Dependencies on other M0 agents.
8. Request for Supervisor Review & Approval (explicit asks; questions).

**Hybrid Guard & Demo Invariant Audit Matrix Template** (include populated version in every proposal; update pre-gate):

| File / Path | Specific Guard / Block Location (line # or func) | Guard Present at Top? (Y/N + evidence) | Demo ID ("w1"/"w2") Strip/Block? (Y/N + evidence) | Risk if Bypassed | Verified By / Date | Notes / Action |
|-------------|--------------------------------------------------|---------------------------------------|---------------------------------------------------|------------------|--------------------|---------------|
| lib/data/hybridStore.ts | getTasks (~529), queue ops (~300+), etc. | Y - `if (!isSupabaseLive()) return []` + NOTE 519 | Y - `.filter(op => !["w1","w2"].includes...)` | RLS error / data mixing | [Agent] [Date] | Pristine per audit |
| lib/supabase/client.ts | isSupabaseConfigured (28-33) | N/A (foundation) | N/A | ... | ... | ... |
| store/useTaskStore.ts | ... | ... | ... | ... | ... | ... |
| [Any new file from proposal] | N/A yet | [To be added post-edit] | ... | ... | ... | Must pass audit pre-merge |
| ... | ... | ... | ... | ... | ... | ... |

**Aggregate Summary**: "All existing paths audited [date]; zero bypasses introduced by this proposal. Full demo regression passed. Demo invariant held."

**Additional Requirements in Proposals**:
- Reference this runbook (Section 2) for commands, smoke, audit procedure.
- Include pre/post regression output snippets.
- For folder pilot / code moves: Confirm no impact to hybridStore imports or guards.
- For harness/CI: Confirm demo-only, guard test coverage.

This template + matrix ensures "every proposal must include explicit guard/demoid audit matrix."

---

**End of M0 Agent Proposal Template**

*Content exactly as proposed in M0-DOCS-RUNBOOKS-PROPOSAL.md Section 3. All M0 proposals must use this. Reference `docs/M0-HYGIENE-RUNBOOK.md` for execution details.*

**Cross-References**:
- Source: `docs/M0-DOCS-RUNBOOKS-PROPOSAL.md`
- Hygiene procedures: `docs/M0-HYGIENE-RUNBOOK.md`
- Sign-off: `docs/M0-VERIFICATION-SIGN-OFF-TEMPLATE.md`
- Master: `docs/WAVE8-MASTER-PLAN.md` (esp. line 341 for matrix requirement)