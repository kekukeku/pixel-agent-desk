# TASK-019: Add governance rules from TASK-015 through TASK-018 retrospectives

- **Status**: `MERGED`
- **Created**: 2026-06-17
- **Created By**: Codex (Layer 1)
- **Assigned To**: Antigravity (Layer 3)
- **Reviewer**: Grok Build (Layer 2)
- **Priority**: `MEDIUM`
- **Branch**: `task/task_019_team_rules_governance_updates`
- **PR URL**: `N/A (local merge @ 7dd100d6d65839de95fb86c4d7ba4b7123083bd0)`
- **Linked Advice**: [groupchat_015018.md](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/PLANNING/groupchat_015018.md)
- **Linked Review**: [review_019.md](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/REVIEWS/review_019.md)
- **Dependencies**: [TASK-015](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/TASKS/task_015.md), [TASK-016](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/TASKS/task_016.md), [TASK-017](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/TASKS/task_017.md), [TASK-018](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/TASKS/task_018.md)

---

## 1. Objective

Update `TEAM_RULES.md` with the governance lessons agreed in the TASK-015 through TASK-018 colleagueview GroupChat.

The goal is to turn repeated retrospective findings into durable operating rules. This is a governance/documentation task only; do not change app source code.

The source planning artifact is [PLANNING/draft_015018.md](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/PLANNING/draft_015018.md). The full discussion transcript is [PLANNING/groupchat_015018.md](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/PLANNING/groupchat_015018.md).

---

## 2. Files Affected

- `[MODIFY]` [TEAM_RULES.md](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/TEAM_RULES.md)

### Candidate Files

- [AGENT_STATE.md](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/AGENT_STATE.md) only for normal status progression to `UNDER_REVIEW`.
- [TASKS/task_019.md](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/TASKS/task_019.md) only for normal status progression and post-review reconciliation.
- [LOGS/change_log.md](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/LOGS/change_log.md) only after approval and merge/reconciliation.

---

## 3. Acceptance Criteria

- `TEAM_RULES.md` adds a rule for superseded or absorbed tasks:
  - If a later task absorbs an earlier task's scope, the earlier task must be marked `SUPERSEDED`, `MERGED via successor`, or closed by supplemental review.
  - The earlier task must not remain indefinitely in `UNDER_REVIEW` / `REQUEST_CHANGES`.
- `TEAM_RULES.md` adds UI-heavy task specification minimums:
  - affected visual surface
  - coordinates/seats or layout constraints
  - state ownership
  - fallback names
  - persistence store
  - startup sequencing risks
  - live/replay isolation
  - responsive behavior
  - manual verification steps
- `TEAM_RULES.md` formalizes the review final-mile contract:
  - `APPROVE` triggers Antigravity merge/reconciliation.
  - `REQUEST_CHANGES` triggers Antigravity fix/resubmit.
  - reconciliation must update task metadata, `AGENT_STATE.md`, `LOGS/change_log.md`, linked review, validation master, and local merge SHA.
- `TEAM_RULES.md` adds reviewer escalation guidance:
  - automation-chain, state-contamination, security/sanitization, data-loss, and merge-gate credibility issues should be `REQUEST_CHANGES`, not non-blocking follow-up.
- `TEAM_RULES.md` adds a colleagueview-to-rules loop:
  - when batch retrospectives expose repeated process gaps, Codex should convene a governance GroupChat and produce actionable `TEAM_RULES.md` patch instructions for Antigravity.
- Keep the edit concise and place each rule near the existing related section rather than appending an unrelated block at the end.
- Run a lightweight verification after editing:

```bash
rg -n "SUPERSEDED|absorbed|final-mile|UI-heavy|colleagueview-to-rules|REQUEST_CHANGES" TEAM_RULES.md
```

---

## 4. Implementation Notes

- This is a documentation/governance update only.
- Do not modify app source files, tests, watcher logic, dashboard files, or review runner code.
- Preserve the existing `TEAM_RULES.md` structure where possible:
  - lifecycle/status rules belong near the state machine and post-merge sections
  - reviewer escalation guidance belongs near Grok Build review guidelines
  - UI-heavy task spec requirements belong near Codex task quality standards
  - colleagueview-to-rules belongs near the retrospective section

---

小A請依照本任務與 [PLANNING/draft_015018.md](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/PLANNING/draft_015018.md) 修改 `TEAM_RULES.md`。完成後請把 `TASKS/task_019.md` 與 `AGENT_STATE.md` 移到 `UNDER_REVIEW`，不要標成 `COMPLETED`。
