# TASK-022: Harden review audit rules and colleagueview tone

- **Status**: `UNDER_REVIEW`
- **Created**: 2026-06-17
- **Created By**: Codex (Layer 1)
- **Assigned To**: Antigravity (Layer 3)
- **Reviewer**: Grok Build (Layer 2)
- **Priority**: `HIGH`
- **Branch**: `task/task_022_review_audit_rules_and_tone`
- **PR URL**: `N/A`
- **Linked Advice**: [groupchat_022.md](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/PLANNING/groupchat_022.md)
- **Linked Review**: `TBD`
- **Dependencies**: [TASK-019](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/TASKS/task_019.md), [TASK-021](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/TASKS/task_021.md)

---

## 1. Objective

Update the governance rules to capture the process lessons from TASK-021 and improve the tone standard for cross-agent retrospectives.

This task must update both the live project rules and the portable `agent-cowork` template rules:

- [TEAM_RULES.md](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/TEAM_RULES.md)
- [agent-cowork/templates/TEAM_RULES.md](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/agent-cowork/templates/TEAM_RULES.md)

Do not modify app source code. Do not implement `agent-cowork` publish-readiness polish such as `requirements.txt`, branding cleanup, or smoke tests in this task.

---

## 2. Files Affected

- `[MODIFY]` [TEAM_RULES.md](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/TEAM_RULES.md)
- `[MODIFY]` [agent-cowork/templates/TEAM_RULES.md](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/agent-cowork/templates/TEAM_RULES.md)

### Candidate Files

- [REVIEWS/README.md](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/REVIEWS/README.md) only if the existing review request documentation directly contradicts the new rule language.
- [agent-cowork/README.md](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/agent-cowork/README.md) only if a small pointer to the template rules is needed; do not add publish polish here.

---

## 3. Acceptance Criteria

- `TEAM_RULES.md` and `agent-cowork/templates/TEAM_RULES.md` both include a **Commit Before Review Gate**:
  - Antigravity must not move a task to `UNDER_REVIEW` until the named task branch exists.
  - All substantive task deliverables must be tracked and committed on that branch.
  - The generated `REVIEWS/review_diff_NNN.patch` must reflect the substantive deliverable, not only registry/task metadata.
- Both rule files include **Self-Check Evidence** requirements:
  - §9 self-check evidence must be written into `REVIEWS/review_request_NNN.md`.
  - Evidence must include command summaries, key stdout excerpts or artifact paths, test results, branch name, and commit SHA where available.
- Both rule files include **Review History Preservation**:
  - `REVIEWS/validation_master_NNN.md` must preserve every review round.
  - History must include prior `REQUEST_CHANGES`, corrective commits, final `APPROVE`, dates, commit SHAs, and blocking issue summaries.
  - Final validation must not erase rejected or changes-requested rounds.
- Both rule files include **Portable / Extraction Task Minimums**:
  - For reusable workflow kits, extracted packages, templates, or libraries intended for other repositories, the task spec must define included/excluded manifest, runtime dependencies, env var schema, installer semantics, exclusion verification, and phase boundaries.
- Both rule files include an **Orphan / Superseded Task Check**:
  - Before merge/reconciliation, Antigravity must check for same-topic orphan tasks stuck in `UNDER_REVIEW` or `REQUEST_CHANGES`.
  - Such tasks must be marked `SUPERSEDED`, closed by supplemental review, or explicitly documented before the successor task is considered cleanly closed.
- Both rule files include **Colleagueview Tone** guidance:
  - Retrospectives should feel human, warm, candid, lively, and evidence-grounded.
  - They may use concrete imagery, emotionally honest phrasing, and light humor when it clarifies the work.
  - They must avoid empty praise, cruelty, sarcasm, vague cheerleading, or replacing evidence with vibes.
- Preserve the existing `TEAM_RULES.md` structure. Place new rules near the relevant sections:
  - §8 for portable/extraction task minimums
  - §9 for commit gate and self-check evidence
  - §11 for colleagueview tone
  - §12 for review history and orphan/superseded checks
- Run focused verification:

```bash
rg -n "Commit Before Review Gate|Self-Check Evidence|Review History Preservation|Portable / Extraction Task Minimums|Orphan / Superseded Task Check|Colleagueview Tone" TEAM_RULES.md agent-cowork/templates/TEAM_RULES.md
```

---

## 4. Implementation Notes

- Use concise normative language. These are governance rules, not a tutorial.
- Keep the root `TEAM_RULES.md` and `agent-cowork/templates/TEAM_RULES.md` semantically aligned, even if surrounding line numbers differ.
- Do not include implementation-only follow-ups from TASK-021 such as `requirements.txt`, residual branding cleanup, installer smoke tests, or `verify-package.sh` copying.
- The purpose is to harden the review/audit loop before the future `agent-cowork` GitHub publish task.

### GroupChat Reconciliation

- The governance GroupChat session completed and produced [PLANNING/groupchat_022.md](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/PLANNING/groupchat_022.md), [PLANNING/groupchat_022.json](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/PLANNING/groupchat_022.json), and [PLANNING/draft_022.md](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/PLANNING/draft_022.md).
- 小C accepts 小B's prioritization of pre-review git readiness and self-check evidence as P0 governance fixes.
- 小C accepts 小A's requirement to update both the root rules and the portable `agent-cowork` template rules.
- 小C accepts Kevin's tone requirement: colleague evaluations should become more human, emotional, lively, and lightly humorous while staying evidence-grounded.
- 小C defers `agent-cowork` GitHub publishing to a later task.

---

小A請修改 `TEAM_RULES.md` 與 `agent-cowork/templates/TEAM_RULES.md`。完成後請把 `TASKS/task_022.md` 與 `AGENT_STATE.md` 移到 `UNDER_REVIEW`，不要標成 `COMPLETED`。
