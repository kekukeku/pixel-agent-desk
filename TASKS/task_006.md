# TASK-006: Add Pixel Agent Desk watcher with visual status and execution handoff

- **Status**: `UNDER_REVIEW`
- **Created**: 2026-06-16
- **Created By**: Codex (Layer 1)
- **Assigned To**: Antigravity (Layer 3)
- **Reviewer**: Grok Build (Layer 2)
- **Priority**: `HIGH`
- **Branch**: `task/task_006_pixel_agent_desk_watcher`
- **PR URL**: `TBD`
- **Linked Review**: `TBD`
- **Dependencies**: [TASK-004](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/TASKS/task_004.md)

---

## 1. Objective

Create a Pixel Agent Desk-specific `watcher.py` that replaces the old project-specific watcher and watches this repository:

```text
/Users/kevinkuo/My Drive/all/Github projects/pixel-agent-desk
```

The watcher must support two responsibilities:

1. **Visual status updates**: publish normalized agent events to Pixel Agent Desk so Codex, Antigravity, and Grok Build are reflected by the animated office characters.
2. **Execution handoff**: monitor governance files in this repo and hand off work to the configured Antigravity or Grok Build execution environment.

The watcher should be reusable for this repo and should not contain iPLAYinn-specific paths or assumptions.

TASK-005 is intentionally paused while this watcher task is created. TASK-006 should not implement the TASK-005 UI title change.

---

## 2. Files Affected

- `[NEW]` [watcher.py](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/watcher.py)
- `[NEW]` [watcher.test.js](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/__tests__/watcher.test.js)
- `[MODIFY]` [README.md](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/README.md)

### Candidate Files

- [TEAM_RULES.md](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/TEAM_RULES.md)
- [agent-runner/trigger-review.js](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/agent-runner/trigger-review.js)
- [agent-runner/route-review-decision.js](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/agent-runner/route-review-decision.js)

---

## 3. Acceptance Criteria

- `watcher.py` defaults to watching the Pixel Agent Desk repo root, not the old iPLAYinn project.
- The watched root can be overridden via CLI flag or environment variable, for example:
  - `python3 watcher.py --project-root "/path/to/repo"`
  - `PIXEL_AGENT_DESK_PROJECT_ROOT=/path/to/repo python3 watcher.py`
- The watcher publishes normalized visual events to `POST http://localhost:47821/events/agent`, not legacy Claude `/hook` events.
- On startup, the watcher registers three default agents with stable ids and display names:
  - Codex / planner
  - Antigravity / executor
  - Grok Build / reviewer
- Default agent ids and names are configurable via `~/.pixel-agent-desk/watcher.json` or environment variables.
- The watcher sends periodic keep-alive `agent.idle` events so visual agents do not disappear while the workflow is idle.
- When a `TASKS/task_NNN.md` file appears or changes with status `DRAFT` or `IN_PROGRESS`, the watcher:
  - updates the Antigravity visual agent to `agent.working`
  - creates a durable handoff payload for Antigravity
  - dispatches the payload through a configured command or webhook if available
- When `AGENT_STATE.md` changes and a task transitions to `UNDER_REVIEW`, the watcher:
  - updates the Grok Build visual agent to `agent.working`
  - invokes the existing review request path when appropriate, such as `node agent-runner/trigger-review.js NNN`, or dispatches to a configured Grok endpoint
- When `REVIEWS/review_request_NNN.md` appears, the watcher updates the Grok Build visual agent to `agent.working`.
- When `REVIEWS/review_NNN.md` appears or changes, the watcher:
  - runs or delegates review decision routing through the existing `agent-runner/route-review-decision.js NNN`
  - updates visual agent states according to the decision:
    - `APPROVE` -> Grok idle/done, Antigravity working for merge
    - `REQUEST_CHANGES` -> Grok idle/done, Antigravity working for fixes
    - `REJECT` -> Grok idle/done, Codex/help or operator-review state
    - missing review -> no failure
- The watcher must not silently pretend to launch Antigravity or Grok if no command/webhook is configured. In that case it must:
  - write a local handoff payload file under `REVIEWS/` or `LOGS/`
  - log a clear warning explaining that visual status was updated but execution handoff is pending configuration
- The watcher debounces duplicate filesystem events so a single file save does not spam handoffs.
- The watcher must be safe to run while Pixel Agent Desk is open; it must not lock source files or modify `src/`.
- README documents:
  - how to start Pixel Agent Desk
  - how to start `watcher.py`
  - how visual-only mode differs from execution-handoff mode
  - how to configure Antigravity/Grok commands or webhook endpoints
  - how to stop the old watcher and avoid watching the wrong project
- Add automated test coverage for watcher planning/parsing logic without requiring a live Electron app or live filesystem watcher.
- Run:

```bash
npm test -- --runTestsByPath __tests__/watcher.test.js
```

---

## 4. Implementation Notes

- Prefer implementing the watcher in Python because the existing project-specific watcher is Python and the operator already runs it manually.
- Keep side-effecting code behind small functions so tests can cover:
  - task number extraction
  - status parsing from `TASKS/task_NNN.md`
  - `AGENT_STATE.md` task state detection
  - review decision parsing
  - handoff payload construction
  - normalized event payload construction
- Use the normalized Agent Event API:

```json
{
  "event": "agent.working",
  "agent_id": "antigravity",
  "source": "pixel-agent-desk-watcher",
  "name": "Antigravity",
  "agent_type": "executor",
  "tool": "Implement TASK-006",
  "project_path": "/Users/kevinkuo/My Drive/all/Github projects/pixel-agent-desk"
}
```

- Suggested configuration sources, in priority order:
  1. CLI flags
  2. environment variables
  3. `~/.pixel-agent-desk/watcher.json`
  4. safe defaults
- Suggested optional execution config keys:

```json
{
  "antigravity": {
    "command": null,
    "webhook": null
  },
  "grok": {
    "command": "node agent-runner/trigger-review.js {task_num}",
    "webhook": null
  }
}
```

- If implementing command templates, avoid shell interpolation where possible. Prefer argument-array execution or carefully documented placeholders.
- The watcher should not auto-merge. Review approval should route to Antigravity merge handoff, consistent with TASK-004.
- Preserve current governance rules and review router behavior.

---

## 5. Non-Goals

- Do not implement TASK-005's office title change.
- Do not modify runtime dashboard UI behavior except through visual status events.
- Do not add auto-merge.
- Do not require real Antigravity/Grok credentials or proprietary local APIs.
- Do not remove the GitHub Actions review router.

---

## 6. Verification Plan

- Run:

```bash
npm test -- --runTestsByPath __tests__/watcher.test.js
```

- Manual smoke test:
  1. Start Pixel Agent Desk.
  2. Run `python3 watcher.py --project-root "/Users/kevinkuo/My Drive/all/Github projects/pixel-agent-desk"`.
  3. Touch or create a test task file and confirm Antigravity visual status changes.
  4. Create a synthetic `REVIEWS/review_request_NNN.md` and confirm Grok visual status changes.
  5. Create a synthetic `REVIEWS/review_NNN.md` decision and confirm handoff payload/route behavior.

---

## 7. Rollback Notes

If the watcher causes noisy events or incorrect handoffs, stop the watcher process. Revert `watcher.py`, `__tests__/watcher.test.js`, and README changes. Existing Pixel Agent Desk runtime and GitHub workflow behavior should remain unaffected.

---

小 A，請依照 `pixel-agent-desk/TASKS/task_006.md` 開始執行，將狀態從 `DRAFT` 推進到 `IN_PROGRESS`，並按既有流程開分支建立 Pixel Agent Desk 專用 watcher。
