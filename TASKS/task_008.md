# TASK-008: Wire watcher handoff consumers for active execution

- **Status**: `MERGED`
- **Created**: 2026-06-16
- **Created By**: Codex (Layer 1)
- **Assigned To**: Antigravity (Layer 3)
- **Reviewer**: Grok Build (Layer 2)
- **Priority**: `HIGH`
- **Branch**: `task/task_008_watcher_handoff_consumers`
- **PR URL**: `N/A (local merge @ 1f4b2e5)`
- **Linked Review**: [review_008.md](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/REVIEWS/review_008.md)
- **Dependencies**: [TASK-006](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/TASKS/task_006.md), [TASK-007](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/TASKS/task_007.md)

---

## 1. Objective

Close the automation gap observed after TASK-007 by wiring the watcher to real, configurable handoff consumers instead of stopping at local JSON artifacts.

There are two related but separate handoff pipelines:

1. **Task execution handoff**: `watcher.py` writes `REVIEWS/task_handoff_NNN.json` when a task enters `DRAFT` or `IN_PROGRESS`. This payload is meant to start or notify Antigravity.
2. **Review decision route**: `agent-runner/route-review-decision.js` writes `REVIEWS/handoff_payload_NNN.json` after `REVIEWS/review_NNN.md` exists. This payload routes a Grok decision such as `APPROVE` to targets like `antigravity.merge`.

TASK-008 primarily fixes the first pipeline and the `UNDER_REVIEW` trigger into Grok review request generation. It must not conflate `task_handoff_NNN.json` with `handoff_payload_NNN.json`; the latter remains owned by the review decision router.

Implement active handoff wiring so the Pixel Agent Desk watcher can move beyond visual-only fallback:

1. When the watcher creates or updates `REVIEWS/task_handoff_NNN.json`, it must also dispatch the same handoff through a configured Antigravity command or webhook in active mode.
2. When a task transitions to `UNDER_REVIEW`, the watcher must generate or trigger `REVIEWS/review_request_NNN.md` through the existing Grok review path, or dispatch to a configured Grok command/webhook.
3. If active mode is requested but a required consumer is not configured or fails, the watcher must make the failure visible instead of quietly leaving only fallback JSON.

This task should not invent proprietary Antigravity or Grok APIs. It should define a clear, configurable local execution contract that can call real local commands or HTTP endpoints when the operator provides them.

---

## 2. Files Affected

- `[MODIFY]` [watcher.py](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/watcher.py)
- `[MODIFY]` [watcher.test.js](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/__tests__/watcher.test.js)
- `[MODIFY]` [README.md](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/README.md)
- `[MODIFY]` [.gitignore](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/.gitignore)

### Candidate Files

- [agent-runner/trigger-review.js](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/agent-runner/trigger-review.js)
- [agent-runner/route-review-decision.js](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/agent-runner/route-review-decision.js)
- [REVIEWS/follow_up_006.md](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/REVIEWS/follow_up_006.md)

---

## 3. Acceptance Criteria

### P0 - Required for Approval

- Add an explicit watcher execution mode, configurable through `~/.pixel-agent-desk/watcher.json` and environment variable, with at least:
  - `visual-only`: existing behavior is allowed to write fallback payload files and warn.
  - `active`: configured command or webhook consumers are required for handoff paths that should execute.
- Use these configuration keys, environment variables, and defaults:

```json
{
  "execution_mode": "visual-only",
  "command_timeout_seconds": 600,
  "output_capture_bytes": 8192,
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

| Config Key | Env Var | Default |
| :--- | :--- | :--- |
| `execution_mode` | `PIXEL_AGENT_DESK_WATCHER_EXECUTION_MODE` | `visual-only` |
| `command_timeout_seconds` | `PIXEL_AGENT_DESK_WATCHER_COMMAND_TIMEOUT_SECONDS` | `600` |
| `output_capture_bytes` | `PIXEL_AGENT_DESK_WATCHER_OUTPUT_CAPTURE_BYTES` | `8192` |
| `antigravity.command` | `PIXEL_AGENT_DESK_ANTIGRAVITY_COMMAND` | `null` |
| `antigravity.webhook` | `PIXEL_AGENT_DESK_ANTIGRAVITY_WEBHOOK` | `null` |
| `grok.command` | `PIXEL_AGENT_DESK_GROK_COMMAND` | `node agent-runner/trigger-review.js {task_num}` |
| `grok.webhook` | `PIXEL_AGENT_DESK_GROK_WEBHOOK` | `null` |

- In active mode, when a `TASKS/task_NNN.md` file enters `DRAFT` or `IN_PROGRESS`, the watcher:
  - writes or updates `REVIEWS/task_handoff_NNN.json`
  - invokes the configured Antigravity command or webhook with the same handoff payload
  - records a visible dispatch result or failure, for example in stderr and/or a structured status field/file
- Command dispatch must not block the watchdog event handler thread. Long-running Antigravity or Grok commands must execute in a background worker/thread while the watcher remains responsive to additional filesystem events and visual status updates.
- Command dispatch must still collect the final return code and bounded stdout/stderr after the background command exits.
- Dispatch results must be written to target-specific structured files so Antigravity and Grok results do not overwrite each other, for example:
  - `REVIEWS/dispatch_result_NNN_antigravity.json`
  - `REVIEWS/dispatch_result_NNN_grok.json`
- Dispatch result files must follow this schema shape:

```json
{
  "task_num": "008",
  "target": "antigravity",
  "trigger": "task_status",
  "state": "DRAFT",
  "dispatch_key": "008:antigravity:task_status:DRAFT",
  "transport": "command",
  "success": true,
  "returncode": 0,
  "http_status": null,
  "timed_out": false,
  "stdout_excerpt": "optional bounded output",
  "stderr_excerpt": "",
  "error": null,
  "started_at": 1781566256.3771589,
  "finished_at": 1781566257.1250000
}
```

- Command execution must support a configurable timeout, with a safe default, so stuck active handoffs do not leave unlimited background work running.
- Captured stdout/stderr must be truncated to a documented maximum size before being written to `REVIEWS/`.
- In active mode, Antigravity handoff must not be considered complete when no command/webhook is configured. The watcher must emit a clear configuration error and keep the operator-visible fallback payload.
- In active mode, when `AGENT_STATE.md` transitions a task to `UNDER_REVIEW`, the watcher must generate or trigger `REVIEWS/review_request_NNN.md` by default through the existing local path:

```bash
node agent-runner/trigger-review.js NNN
```

- After the `UNDER_REVIEW` path runs successfully, `REVIEWS/review_request_NNN.md` must exist for the task, unless a configured Grok webhook is used and the README clearly documents that the external endpoint is responsible for review creation.
- If the default Grok trigger fails because the task state is not `UNDER_REVIEW`, the watcher must surface that error clearly and not silently mark the Grok handoff as successful.
- The watcher must distinguish between:
  - visual status update success
  - local fallback payload creation
  - command/webhook dispatch success
  - command/webhook dispatch failure
- Webhook dispatch must use the same result-recording model as command dispatch: successful and failed POST attempts should produce target-specific dispatch results with HTTP status or error details.
- The watcher must not repeatedly dispatch the same task handoff on every file save. Use this idempotency key format unless there is a documented reason to change it:

```text
{task_num}:{target}:{trigger}:{state_or_decision}
```

Examples:

```text
008:antigravity:task_status:DRAFT
008:antigravity:task_status:IN_PROGRESS
008:grok:registry_state:UNDER_REVIEW
008:antigravity:review_decision:APPROVE
```

- A dispatch with the same idempotency key must not re-fire unless the relevant state changes, the prior dispatch failed and a retry is explicitly triggered, or the watcher is restarted and the implementation intentionally treats runtime memory as a new session.
- Add a side-effect-controlled CLI test hook that extends the current `--parse-only` testing approach. It may be a new flag such as `--simulate-handoff` or an extension of `--parse-only`, but it must let Jest validate handoff decisions, idempotency keys, and result payload shape without starting a live watchdog observer or Electron app.
- Add `.gitignore` entries for runtime dispatch artifacts that should not be committed, including:

```text
REVIEWS/dispatch_result_*.json
REVIEWS/task_handoff_*.json
REVIEWS/grok_handoff_*.json
```

- Do not gitignore review audit artifacts that are expected to be committed, such as `REVIEWS/review_NNN.md`, `REVIEWS/review_request_NNN.md`, `REVIEWS/validation_master_NNN.md`, and router-produced `REVIEWS/handoff_payload_NNN.json`, unless Grok Build explicitly approves a separate policy change.
- README documents:
  - how to enable `active` vs `visual-only` mode
  - the exact config keys, env vars, and default values listed above
  - Antigravity command/webhook configuration examples
  - Grok command/webhook configuration examples
  - expected files after a successful automatic handoff, including `REVIEWS/task_handoff_NNN.json` and `REVIEWS/review_request_NNN.md`
  - troubleshooting steps when payload files exist but no agent starts
- Add automated coverage for watcher handoff wiring without requiring live Antigravity, live Grok, or a live Electron app. Tests should cover at least:
  - active mode with missing Antigravity consumer reports failure
  - active mode with a mock Antigravity command/webhook records dispatch success
  - background command execution does not block the watcher event handler while still writing a final result file
  - command timeout records failure without killing the watcher loop
  - `UNDER_REVIEW` transition triggers review request generation or the configured Grok consumer
  - visual-only mode still writes fallback payloads without failing
- Preserve existing TASK-006/TASK-007 behavior for agent visualization, keep-alive, `--parse-only`, and missing-`watchdog` handling.
- Do not modify `src/`, Electron runtime UI, GitHub workflow files, or provider-agnostic event contracts.
- Run:

```bash
npm test -- --runTestsByPath __tests__/watcher.test.js
npm test -- --runTestsByPath __tests__/agentRunner.test.js
```

### P1 - May Be Deferred if P0 Is Complete

- Add command-array execution support if it can be done without expanding the task significantly. Preserve backward compatibility with existing string commands.
- Add a manual retry command or documented retry mechanism for failed dispatch keys.
- Add optional Pixel Agent Desk visual error events for dispatch failures.

---

## 4. Implementation Notes

- The core design goal is to replace "write JSON and hope the operator reads it" with an explicit dispatch contract.
- Keep the two pipelines separate in code and docs:
  - `task_handoff_NNN.json` is watcher-owned and starts Antigravity task execution.
  - `handoff_payload_NNN.json` is router-owned and routes completed Grok review decisions.
- Prefer extracting small pure functions for:
  - building Antigravity handoff payloads
  - building Grok handoff payloads
  - deciding whether a task/state pair should dispatch
  - normalizing dispatch result records
  - generating idempotency keys
- Prefer a `run_command_async` style implementation: the event callback starts a daemon worker/thread, the worker may use blocking command execution to obtain the final return code, and completion writes a structured dispatch result without blocking the watchdog event handler.
- The async completion callback must not depend on mutable global watcher state. Pass `project_root`, `target`, `task_num`, and the triggering state/event into the worker or callback explicitly.
- Use target-specific result filenames such as `dispatch_result_NNN_antigravity.json` and `dispatch_result_NNN_grok.json`; avoid a single shared `dispatch_result_NNN.json` that can be overwritten by another handoff path.
- Include bounded stdout/stderr excerpts in result files. Do not write unlimited command output into repository files.
- Apply the same dispatch result schema to command and webhook paths so active mode has one operator-facing success/failure model.
- Runtime result files should be ignored by git. This prevents watcher executions from leaving noisy untracked files after normal local operation.
- Do not remove fallback JSON files. They remain useful as audit artifacts and manual recovery payloads.
- Active mode should make missing configuration visible, but it should not crash the entire long-running watcher loop after one failed task handoff. Log the error, record the failed dispatch, and keep watching.
- Existing `agent-runner/trigger-review.js` already enforces that the task must be `UNDER_REVIEW`; reuse that contract rather than duplicating review request formatting in Python unless there is a clear testability reason.
- If adding a command-array form is necessary to test dispatch safely, keep backward compatibility with existing string command configuration and document the tradeoff. Do not make F4 from `follow_up_006.md` larger than needed for this wiring task.
- Avoid hidden default commands that pretend to launch Antigravity. Antigravity execution must be configured by the operator or by a documented local command.

---

## 5. Non-Goals

- Do not implement a proprietary Antigravity desktop automation API.
- Do not implement Grok Build model calls or external review generation inside `watcher.py`.
- Do not add auto-merge.
- Do not resume or implement TASK-005.
- Do not redesign the GitHub Actions router.
- Do not rewrite the entire watcher.

---

## 6. Verification Plan

- Run:

```bash
npm test -- --runTestsByPath __tests__/watcher.test.js
npm test -- --runTestsByPath __tests__/agentRunner.test.js
```

- Manual smoke test:
  1. Start Pixel Agent Desk.
  2. Start `python3 watcher.py` in `active` mode with a harmless mock Antigravity command that appends the task number to a temp file.
  3. Create or modify `TASKS/task_008.md` with `DRAFT` or `IN_PROGRESS`.
  4. Confirm `REVIEWS/task_handoff_008.json` is written and the mock command/webhook receives the handoff.
  5. Change `AGENT_STATE.md` TASK-008 to `UNDER_REVIEW`.
  6. Confirm `REVIEWS/review_request_008.md` is generated by `agent-runner/trigger-review.js` or that the configured Grok webhook receives an equivalent payload.

---

## 7. Rollback Notes

If active handoff dispatch causes noisy repeats or false-positive execution, revert the watcher dispatch changes and README updates. Keep fallback payload files as the safe recovery path. The existing visual-only watcher behavior from TASK-006/TASK-007 should remain usable after rollback.

---

小 A，請依照 `pixel-agent-desk/TASKS/task_008.md` 實作 watcher active handoff consumer wiring，讓 Antigravity 與 Grok review 交接能透過可配置 command/webhook 真正被觸發，而不只留下 fallback JSON。
