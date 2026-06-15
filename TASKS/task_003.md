# TASK-003: Strengthen governance rules from TASK-002 retrospective

- **Status**: `MERGED`
- **Created**: 2026-06-16
- **Created By**: Codex (Layer 1)
- **Assigned To**: Antigravity (Layer 3)
- **Reviewer**: Grok Build (Layer 2)
- **Priority**: `MEDIUM`
- **Branch**: `task/task_003_governance_retrospective_rules`
- **PR URL**: `N/A (local merge @ 7133e36)`
- **Linked Review**: [review_003.md](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/REVIEWS/review_003.md)
- **Dependencies**: [TASK-002](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/TASKS/task_002.md)

---

## 1. Objective

Update the repository governance rules based on the TASK-002 retrospective so future Planner, Executor, and Reviewer work is more consistent, easier to review, and less likely to leave post-merge drift.

The update should formalize practical improvements learned from TASK-002:

- Codex task specs should be precise about required files, candidate files, tests, docs, and acceptance criteria.
- Antigravity should run an explicit pre-review self-check against the task's acceptance criteria before submitting changes.
- Grok Build review notes should distinguish blocking defects from non-blocking architecture suggestions, including tradeoffs and side effects when relevant.
- Post-merge reconciliation must keep task metadata, registry, review artifacts, validation artifacts, and change log entries aligned.

This is a governance/documentation task only. Do not modify runtime product code.

---

## 2. Files Affected

- `[MODIFY]` [TEAM_RULES.md](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/TEAM_RULES.md)
- `[MODIFY]` [PR_TEMPLATE.md](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/PR_TEMPLATE.md)
- `[MODIFY]` [REVIEWS/README.md](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/REVIEWS/README.md)

### Candidate Files

- [task_003.md](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/TASKS/task_003.md)
- [AGENT_STATE.md](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/AGENT_STATE.md)
- [change_log.md](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/LOGS/change_log.md)

### Backfill Files
The following files are included in this branch as backfill to reconcile the git master branch history with local files created in previous tasks:
- [task_001.md](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/TASKS/task_001.md)
- [task_002.md](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/TASKS/task_002.md)
- [review_002.md](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/REVIEWS/review_002.md)
- [validation_master_002.md](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/REVIEWS/validation_master_002.md)


---

## 3. Acceptance Criteria

- `TEAM_RULES.md` includes a Codex task quality section that requires:
  - exact next-task selection from `AGENT_STATE.md`
  - precise `Files Affected` semantics
  - a separate candidate/likely-area list when files are possible but not required
  - explicit test expectations in acceptance criteria
  - explicit README/docs expectations when user-facing behavior changes
  - explicit source URLs and `updatedAt` requirements when external facts such as pricing are used
  - a one-sentence Antigravity start prompt after Codex writes a task file
- `TEAM_RULES.md` includes an Antigravity pre-review self-check section requiring the executor to verify:
  - every acceptance criterion is satisfied or explicitly marked out of scope
  - tests requested by the task were run
  - README/docs requested by the task were updated
  - backward compatibility was considered
  - no major dependency upgrades or broad lockfile churn were included unless requested or justified
- `TEAM_RULES.md` includes Grok Build review guidance requiring review findings to separate:
  - blocking issues
  - non-blocking notes
  - optional follow-ups
  - architecture tradeoffs, especially when a suggestion introduces async work, side effects, or broader scope
- `TEAM_RULES.md` includes a post-merge reconciliation checklist requiring alignment across:
  - `TASKS/task_NNN.md`
  - `AGENT_STATE.md`
  - `REVIEWS/review_NNN.md`
  - `REVIEWS/validation_master_NNN.md`
  - `LOGS/change_log.md`
- Post-merge metadata checklist explicitly requires:
  - `Status: MERGED`
  - actual PR URL, or `N/A (local merge @ SHA)` for local merges
  - `Linked Review` pointing to `REVIEWS/review_NNN.md`
  - registry row state matching the task file
- `PR_TEMPLATE.md` includes an executor self-check area for acceptance criteria, tests, docs, compatibility, and dependency/scope notes.
- `REVIEWS/README.md` documents the expected review file structure and how to label blocking versus non-blocking feedback.
- Documentation wording stays concise and procedural; avoid turning retrospective praise into rules text.

---

## 4. Non-Goals

- Do not change runtime source code under `src/`.
- Do not change GitHub workflow behavior unless the documentation update clearly requires it.
- Do not add new automation in this task.
- Do not rewrite existing governance architecture sections unless necessary for clarity.

---

## 5. Implementation Notes

- Prefer adding new sections near the end of `TEAM_RULES.md`, after the current task template section.
- Keep existing parser-sensitive headings and task template fields intact.
- If adding new file action semantics, preserve `[MODIFY]`, `[NEW]`, and `[DELETE]` as the required parser-compatible action codes. Put candidate files in a separate "Candidate Files" or "Likely Areas" subsection rather than changing the required action code grammar.
- Keep the tone operational. The goal is to improve workflow reliability, not to record individual performance evaluations.

---

## 6. Verification Plan

- Manually inspect `TEAM_RULES.md`, `PR_TEMPLATE.md`, and `REVIEWS/README.md`.
- Confirm the existing task template section still includes the exact headings:
  - `## 1. Objective`
  - `## 2. Files Affected`
- Confirm `PR_TEMPLATE.md` remains valid Markdown.
- Run `git diff --check`.

---

## 7. Rollback Notes

If the governance update causes confusion or conflicts with existing runner parsing, revert the documentation changes and keep TASK-002-era governance behavior.
