# TASK-016: Add review decision final-mile runner

- **Status**: `MERGED`
- **Created**: 2026-06-17
- **Created By**: Codex (Layer 1)
- **Assigned To**: Antigravity (Layer 3)
- **Reviewer**: Grok Build (Layer 2)
- **Priority**: `HIGH`
- **Branch**: `task/task_016_review_decision_final_mile`
- **PR URL**: `N/A (local merge @ fb97750)`
- **Linked Advice**: [groupchat_016.md](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/PLANNING/groupchat_016.md)
- **Linked Review**: [review_016.md](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/REVIEWS/review_016.md)
- **Dependencies**: [TASK-008](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/TASKS/task_008.md), [TASK-015](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/TASKS/task_015.md)

---

## 1. Objective

Close the review-decision automation loop so Grok Build decisions do not stop at `REVIEWS/handoff_payload_NNN.json`.

When the watcher observes `REVIEWS/review_NNN.md`:

```text
REQUEST_CHANGES -> route decision -> open Antigravity fix session
APPROVE         -> route decision -> open Antigravity merge/reconcile session
REJECT          -> route decision only; do not open Antigravity
```

The task should preserve the existing pipeline separation from TASK-008: `task_handoff_NNN.json` remains owned by the task-status execution pipeline, while `handoff_payload_NNN.json` remains owned by the review-decision router.

---

## 2. Files Affected

- `[MODIFY]` [watcher.py](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/watcher.py)
- `[MODIFY]` [scripts/trigger_antigravity.py](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/scripts/trigger_antigravity.py)
- `[MODIFY]` [__tests__/watcher.test.js](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/__tests__/watcher.test.js)
- `[MODIFY]` [README.md](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/README.md)

### Candidate Files

- [TEAM_RULES.md](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/TEAM_RULES.md) if the review-decision routing contract needs governance clarification.
- [agent-runner/route-review-decision.js](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/agent-runner/route-review-decision.js) only if the payload schema lacks data needed by the final-mile runner.

---

## 3. Acceptance Criteria

- Watcher review-output handling still runs `agent-runner/route-review-decision.js NNN` and writes `REVIEWS/handoff_payload_NNN.json`.
- For `REQUEST_CHANGES`, the watcher automatically opens an Antigravity follow-up session whose prompt tells 小A to fix the blocking review findings and resubmit to `UNDER_REVIEW`.
- For `APPROVE`, the watcher automatically opens an Antigravity follow-up session whose prompt tells 小A to perform the approved-task merge/reconciliation workflow.
- For `REJECT`, the watcher must not open Antigravity; the operator remains the next actor.
- The final-mile command is configurable separately from the normal `antigravity.command`, such as via a `review_decision` watcher config key and environment overrides.
- Tests must not call the real Antigravity agentapi. Use command overrides or fixtures.
- Review-decision dispatch must continue not to write `REVIEWS/task_handoff_NNN.json`.
- Existing TASK-015 path quoting behavior must remain covered.
- README briefly documents that the full local workflow now includes review-decision final-mile dispatch after Grok writes `REVIEWS/review_NNN.md`.
- Run focused verification:

```bash
npm test -- --runInBand __tests__/watcher.test.js
node agent-runner/resolve-task.js 016
```

---

## 4. Implementation Notes

- Prefer extending `scripts/trigger_antigravity.py` with a `--review-decision` mode so both initial implementation handoff and review follow-up handoff use the same Antigravity discovery code.
- The review-decision prompt should include:
  - task number
  - target directory
  - review file path
  - `handoff_payload_NNN.json` path
  - decision
  - handoff target
  - concise review summary when available
- Keep `REQUEST_CHANGES` and `APPROVE` behavior explicit; do not infer from free-form review text after the router has already produced a structured payload.
- If the configured review-decision command fails, `REVIEWS/dispatch_result_NNN_antigravity.json` should show a failed review-decision dispatch result.

### GroupChat Reconciliation

- The GroupChat session completed and produced [PLANNING/groupchat_016.md](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/PLANNING/groupchat_016.md), [PLANNING/groupchat_016.json](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/PLANNING/groupchat_016.json), and [PLANNING/draft_016.md](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/PLANNING/draft_016.md).
- 小C does not adopt the generic fixture recommendations about implementing the GroupChat runner, schema, or DRAFT watcher hooks; those are already delivered by TASK-013.
- 小C final decision: proceed with the objective and acceptance criteria above, focused only on review-decision final-mile dispatch.

---

## 5. Verification Plan

1. Confirm `REQUEST_CHANGES` review-decision dispatch invokes a mocked Antigravity final-mile command after writing `handoff_payload_NNN.json`.
2. Confirm `APPROVE` review-decision dispatch invokes a mocked merge/reconcile final-mile command after writing `handoff_payload_NNN.json`.
3. Confirm `REJECT` does not invoke Antigravity.
4. Confirm `task_handoff_NNN.json` is not written by review-decision dispatch.
5. Run the focused watcher test suite and task resolver.

---

## 6. Rollback Notes

If final-mile dispatch causes repeated unwanted Antigravity sessions, revert the watcher `review_decision` command integration while keeping `route-review-decision.js` payload generation intact.

---

小C finalized this task after GroupChat advisory. 小A may start implementation.
