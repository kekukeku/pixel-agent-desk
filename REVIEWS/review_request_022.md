# Review Request: Harden review audit rules and colleagueview tone (TASK-022)

- **Request ID**: RR-022
- **Linked Task**: [TASK-022](file:///Users/kevinkuo/My Drive/all/Github projects/pixel-agent-desk/TASKS/task_022.md)
- **Author**: Antigravity (Layer 3)
- **Target Branch**: `task/task_022_review_audit_rules_and_tone`
- **Date**: 2026-06-17

---

## 1. Request Details

Update the governance rules to capture the process lessons from TASK-021 and improve the tone standard for cross-agent retrospectives.

This task updates both the live project rules and the portable `agent-cowork` template rules:
- [TEAM_RULES.md](file:///Users/kevinkuo/My Drive/all/Github projects/pixel-agent-desk/TEAM_RULES.md)
- [agent-cowork/templates/TEAM_RULES.md](file:///Users/kevinkuo/My Drive/all/Github projects/pixel-agent-desk/agent-cowork/templates/TEAM_RULES.md)

---

## 2. Changes Summary

- **TEAM_RULES.md**: Added Commit Before Review Gate, Self-Check Evidence, Review History Preservation, Portable / Extraction Task Minimums, Orphan / Superseded Task Check, and Colleagueview Tone guidance.
- **agent-cowork/templates/TEAM_RULES.md**: Added the identical rule set to the portable template.

---

## 3. §9 Pre-Review Self-Check Evidence

As required by the newly established governance guidelines, the self-check details are recorded below:

### 3.1 Verification Commands and Output Excerpts

- **Command**: `grep_search` pattern check for new rules.
- **Findings (TEAM_RULES.md)**:
  - Line 312: `8. **Portable / Extraction Task Minimums**: For tasks involving reusable workflow kits...`
  - Line 330: `6. **Commit Before Review Gate**: Antigravity must not move a task to UNDER_REVIEW...`
  - Line 331: `7. **Self-Check Evidence**: The findings and verification data from this §9 self-check must be written...`
  - Line 405: `### Colleagueview Tone`
  - Line 432: `### Review History Preservation`
  - Line 447: `7. **Orphan / Superseded Task Check**: Before completing reconciliation, Antigravity must search...`

- **Findings (agent-cowork/templates/TEAM_RULES.md)**:
  - Identical headers and rules implemented at identical line numbers matching the main rules file.

### 3.2 Deliverable Verification Status
- **Acceptance Criteria**: Fully met. New rules placed near relevant sections (§8, §9, §11, §12) in both files.
- **Test Execution**: N/A (this is a rules/documentation-only governance task; no code logic or test suites are modified).
- **Documentation Updates**: Fully implemented.
- **Backward Compatibility**: N/A (no code logic modified).
- **Dependency Control**: No dependencies added or modified.

---

**Please evaluate these changes and record the decision in `REVIEWS/review_022.md`**.
