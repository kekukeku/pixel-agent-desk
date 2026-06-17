# TASK-015: Add README note for keeping npm run workflow alive

- **Status**: `MERGED`
- **Created**: 2026-06-17
- **Created By**: Codex (Layer 1)
- **Assigned To**: Antigravity (Layer 3)
- **Reviewer**: Grok Build (Layer 2)
- **Priority**: `LOW`
- **Branch**: `task/task_015_workflow_alive_note`
- **PR URL**: `N/A (local merge @ e1304b857b45bcebf7b3c1d941198cce651c9109)`
- **Linked Advice**: [groupchat_015.md](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/PLANNING/groupchat_015.md)
- **Linked Review**: [review_015.md](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/REVIEWS/review_015.md)
- **Dependencies**: [TASK-013](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/TASKS/task_013.md)

---

## 1. Objective

Add a concise README note explaining that `npm run workflow` must remain running in an active terminal for the local automation loop to work.

The note should prevent operator confusion when the command appears to start successfully but later handoffs do not happen because the process was stopped, the terminal returned to the prompt, or the reviewer adapter/watchdog are no longer alive.

This is intentionally a small docs-only task used to verify the end-to-end automation loop:

```text
DRAFT -> GroupChat advisory -> 小C finalization -> IN_PROGRESS -> 小A execution -> UNDER_REVIEW -> 小B review -> 小A fix/merge route
```

---

## 2. Files Affected

- `[MODIFY]` [README.md](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/README.md)

### Candidate Files

- [TEAM_RULES.md](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/TEAM_RULES.md) only if the implementer finds the current workflow contract materially misleading.
- [watcher.py](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/watcher.py) only if workflow handoff validation exposes a blocker unrelated to README wording.
- [__tests__/watcher.test.js](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/__tests__/watcher.test.js) only if watcher behavior changes.

---

## 3. Acceptance Criteria

- README explains that `npm run workflow` is a long-running process and should keep occupying the terminal while automation is active.
- README states that if the shell prompt returns, the watcher/reviewer adapter may no longer be running and automatic handoffs may stop.
- README includes a short health-check hint for the reviewer adapter, such as checking `http://127.0.0.1:47822/health` while the workflow is active.
- README clarifies that the local loop depends on both the watcher and reviewer adapter being alive.
- Keep the documentation concise; do not add broad architecture rewrites.
- Run a docs-safe verification:

```bash
node agent-runner/resolve-task.js 015
```

- If code is not changed, no full test suite is required. If implementation touches scripts or runtime behavior, run the relevant focused tests.

---

## 4. Implementation Notes

- Prefer placing the note near the existing Repository Watcher / Quick Start workflow documentation.
- Avoid implying that `npm run workflow` is a one-shot setup command.
- Mention that users should open another terminal for unrelated commands while workflow is running.

### GroupChat Reconciliation

- The GroupChat session completed and produced [PLANNING/groupchat_015.md](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/PLANNING/groupchat_015.md), [PLANNING/groupchat_015.json](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/PLANNING/groupchat_015.json), and [PLANNING/draft_015.md](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/PLANNING/draft_015.md).
- 小C does not adopt the generic fixture recommendations about building the GroupChat runner, schema, or DRAFT watcher hooks; those were already handled by TASK-013 and are outside this docs task.
- During planning validation, 小C found that watcher planning command placeholders did not quote `{input_path}`, breaking projects whose root path contains spaces. Fixing that handoff blocker is allowed under Candidate Files so this small task can validate the workflow honestly.

---

## 5. Verification Plan

1. Read the updated README section and confirm it clearly says the workflow command must remain running.
2. Confirm the note mentions both watcher and reviewer adapter.
3. Confirm the note includes a lightweight health-check hint.
4. Run:

```bash
node agent-runner/resolve-task.js 015
```

---

## 6. Rollback Notes

If the wording causes confusion, revert only the README note for TASK-015. Do not touch watcher, reviewer adapter, GroupChat, or dispatch code in this task.

---

小C finalized this task after GroupChat advisory. 小A may implement the README note and preserve the focused watcher placeholder fix if present.
