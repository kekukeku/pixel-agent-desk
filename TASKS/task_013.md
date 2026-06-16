# TASK-013: Add consultative GroupChat planning artifacts with 小C final authority

- **Status**: `MERGED`
- **Created**: 2026-06-16
- **Created By**: Codex (Layer 1)
- **Assigned To**: Antigravity (Layer 3)
- **Reviewer**: Grok Build (Layer 2)
- **Priority**: `HIGH`
- **Branch**: `task/task_013_groupchat_planning_artifacts`
- **PR URL**: `N/A (local merge @ 102a49a)`
- **Linked Advice**: `N/A (GroupChat DRAFT advisory replaces task_advice; 小A/小B advice incorporated 2026-06-16)`
- **Linked Review**: [review_013.md](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/REVIEWS/review_013.md)
- **Dependencies**: None

---

## 1. Objective

Add a consultative multi-agent planning workflow that lets 小C, 小B, and 小A share one visible planning conversation before a task enters the normal `TASKS/task_NNN.md` workflow.

This is not a new merge gate. 小C is the final planner and has sole discretion to accept, reject, or adapt 小A/小B advice. 小A and 小B are advisory participants only; they do not need to approve the plan before 小C finalizes it.

The workflow must preserve a complete, human-readable conversation artifact so Kevin can inspect how the plan evolved. The final output should be a clean task draft that Codex can convert into the existing `TASKS/task_NNN.md` format and registry update.

GroupChat replaces the old `REVIEWS/task_advice_NNN.md` DRAFT advisory step. Do not run the old single-agent `task_advice_NNN.md` path in parallel by default. `TEAM_RULES.md` should be updated so Trigger A means "run consultative GroupChat advisory and produce `PLANNING/groupchat_<sessionId>.*` artifacts." The legacy `task_advice_NNN.md` format may remain documented only as a compatibility fallback for repositories that have not adopted GroupChat.

This task should also close the current implementation gap between `TEAM_RULES.md` and `watcher.py`: DRAFT must remain planning-only, but it should trigger the consultative GroupChat planning/advisory path without starting executor work.

Required speaker order:

1. 小C proposes the initial plan.
2. 小B gives advice.
3. 小A gives advice.
4. 小C responds to both sets of advice and states what will be adopted or rejected.
5. 小A gives a final opinion or full recognition.
6. 小B gives a final opinion or full recognition.
7. 小C thanks both participants and writes the final plan.

All participants must see the same shared conversation history. 小A must be able to see 小B's advice, and 小B must be able to see 小A's advice before their final opinion.

---

## 2. Files Affected

- `[NEW]` [PLANNING/README.md](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/PLANNING/README.md)
- `[NEW]` [groupchat_001.json](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/PLANNING/fixtures/groupchat_001.json)
- `[NEW]` [groupchat-planning.js](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/agent-runner/groupchat-planning.js)
- `[NEW]` [groupchat-format.js](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/agent-runner/groupchat-format.js)
- `[NEW]` [groupchat_mock_template.json](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/agent-runner/fixtures/groupchat_mock_template.json)
- `[NEW]` [groupchatPlanning.test.js](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/__tests__/groupchatPlanning.test.js)
- `[MODIFY]` [watcher.py](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/watcher.py)
- `[MODIFY]` [watcher.test.js](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/__tests__/watcher.test.js)
- `[MODIFY]` [.gitignore](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/.gitignore)
- `[MODIFY]` [package.json](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/package.json)
- `[MODIFY]` [README.md](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/README.md)
- `[MODIFY]` [TEAM_RULES.md](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/TEAM_RULES.md)

### Candidate Files

- [agent-runner/package.json](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/agent-runner/package.json) if runner-local scripts are preferred there.
- [requirements.txt](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/requirements.txt) only if the implementation deliberately chooses a Python/AutoGen runner. Avoid adding heavy dependencies unless they are isolated and justified.
- [scripts/start_pixel_workflow.sh](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/scripts/start_pixel_workflow.sh) only if a dedicated GroupChat adapter process must be started with the existing workflow.

---

## 3. Acceptance Criteria

- Add a reproducible groupchat planning runner that can be invoked from the repository root, for example:

```bash
npm run groupchat:plan -- --session 001 --input "需求文字"
```

- Planning session IDs are not the same thing as formal task IDs:
  - `sessionId` / `planNum` identifies the planning conversation and its `PLANNING/groupchat_<sessionId>.*` artifacts.
  - `taskNum` is optional metadata and should exist only when the planning session is attached to an existing formal task.
  - Runner v1 must not automatically create `TASKS/task_NNN.md` or mutate `AGENT_STATE.md`.
- The runner accepts an optional `--task NNN` only to link a planning session to an existing task; it must not assume `--session NNN` and `--task NNN` are identical.
- Add watcher support for DRAFT planning dispatch:
  - `DRAFT` must trigger the consultative GroupChat advisory path, not Antigravity execution.
  - `IN_PROGRESS` must remain the only task-file status that dispatches Antigravity.
  - `UNDER_REVIEW` must remain the only registry state that dispatches formal Grok review.
  - Visual-only mode should write an auditable fallback payload without launching external commands.
  - Active mode should use a configured `planning.command` or `planning.webhook`, with the same idempotency discipline as existing handoffs.
  - Dispatch key format must be `{session_id}:planning:task_status:DRAFT` or `{session_id}:planning:registry_state:DRAFT`, depending on the trigger source.
  - Long-lived DRAFT files must not retrigger planning on every watcher restart. The implementation must either persist enough request/dispatch state or use `PLANNING/groupchat_request_<sessionId>.json` as the explicit single-use trigger artifact.
- Add watcher configuration keys:

```json
{
  "planning": {
    "command": "npm run groupchat:plan -- --session {session_id} --input-file {input_path}",
    "webhook": null
  }
}
```

- The runner writes at least these artifacts:
  - `PLANNING/groupchat_<sessionId>.md`: complete ordered transcript.
  - `PLANNING/draft_<sessionId>.md`: clean final plan from 小C, suitable for Codex to convert into `TASKS/task_NNN.md`.
  - `PLANNING/groupchat_<sessionId>.json`: structured schema v1 metadata and message timeline for dashboard consumption.
- `groupchat_<sessionId>.md` includes metadata for session ID, optional task number, started/finished timestamps, participant names, model/provider labels when known, and the fixed seven-step speaker sequence.
- `groupchat_<sessionId>.json` must use schema version 1 and include at least:
  - `schemaVersion`
  - `sessionId`
  - optional `taskNum`
  - `title`
  - `startedAt`
  - `finishedAt`
  - `participants`
  - `steps`
  - `messages[]`
  - each participant has `speakerId`, `speakerName`, and `role`.
  - each step has `stepId` and `order`.
  - each message has `stepId`, `speakerId`, `round`, `content`, and `at` or `offsetMs`.
- Use these stable participant IDs so TASK-014 can map transcript speakers to office characters:
  - 小C: `codex`
  - 小B: `grok-build`
  - 小A: `antigravity`
- Use step IDs instead of relying only on message index. Required step IDs:
  - `codex_proposal`
  - `grok_advice`
  - `antigravity_advice`
  - `codex_response`
  - `antigravity_final`
  - `grok_final`
  - `codex_closing`
- The implementation must support a deterministic local mode that does not require API keys so tests and local plumbing can run reliably.
- Deterministic mode must read from `agent-runner/fixtures/groupchat_mock_template.json` by default so CI has stable expected output.
- Add a committed golden dashboard fixture at `PLANNING/fixtures/groupchat_001.json`.
- If live model adapters are added, they must be isolated behind a provider interface. Missing API keys must produce a clear error without breaking deterministic mode.
- Deterministic mode must strictly produce the seven steps in fixed order. Live mode must still write `stepId` for every transcript message; if one model step fails, the runner may retry that step, but the final transcript must remain schema-valid.
- 小C's final message must explicitly summarize which 小A/小B suggestions were accepted, modified, or rejected when those suggestions affect task scope.
- 小A/小B final messages are advisory only. The code and documentation must not treat `小A全面認可` or `小B全面認可` as a required approval gate.
- The runner must fail safely when a session ID or task number is invalid, when an output artifact already exists unless `--force` is provided, or when the input is empty.
- Add documentation explaining how this planning layer relates to the existing `DRAFT -> IN_PROGRESS -> UNDER_REVIEW` workflow.
- Update watcher configuration documentation for the new `planning.command` and `planning.webhook` keys.
- Update `TEAM_RULES.md` to define the consultative GroupChat layer and explicitly state that 小C keeps final task-spec authority.
- Update `TEAM_RULES.md` so GroupChat replaces `REVIEWS/task_advice_NNN.md` as the default DRAFT advisory mechanism.
- Update `.gitignore` so runtime planning artifacts are ignored by default while fixtures remain committable. For example, ignore `PLANNING/groupchat_*.json`, `PLANNING/groupchat_*.md`, `PLANNING/draft_*.md`, and `PLANNING/groupchat_request_*.json`, but keep `PLANNING/fixtures/`.
- `PLANNING/README.md` must list the minimal portable workflow files/directories needed when copying this workflow to another repository.
- Add tests for transcript formatting, fixed speaker ordering, deterministic mode, invalid task numbers, JSON playback schema, and DRAFT watcher dispatch behavior.
- At minimum, run:

```bash
npm test -- --runTestsByPath __tests__/groupchatPlanning.test.js __tests__/watcher.test.js
```

---

## 4. Implementation Notes

- Prefer a lightweight implementation that fits the existing Node-based `agent-runner/` tooling unless there is a clear reason to introduce Python AutoGen as a required dependency.
- If Python AutoGen is used, keep it optional and document setup separately so the main app can still install and test without model credentials.
- The planning runner should not write `TASKS/task_NNN.md` or update `AGENT_STATE.md` automatically in its first version. It should produce `PLANNING/draft_<sessionId>.md`; Codex remains responsible for creating the formal task file and registry entry.
- Do not couple this feature to the formal Grok Build review validator. This is pre-task planning, not code review.
- Keep generated artifacts project-local and portable so the future workflow template can copy the pattern to other repositories.
- If the watcher creates fallback payloads for DRAFT, use `PLANNING/groupchat_request_<sessionId>.json`; do not reuse `task_handoff_NNN.json`, which is reserved for Antigravity execution handoff.

---

## 5. Verification Plan

1. Run the deterministic groupchat runner with a sample requirement.
2. Confirm `PLANNING/groupchat_<sessionId>.md`, `PLANNING/draft_<sessionId>.md`, and `PLANNING/groupchat_<sessionId>.json` are created.
3. Confirm the transcript preserves the exact seven-step speaker order.
4. Confirm 小A and 小B final messages can reference prior messages from both other participants.
5. Confirm 小C's final plan is present and clearly marked as the source of truth for the next formal task draft.
6. Run watcher simulation or focused watcher tests and confirm DRAFT produces a planning dispatch while `IN_PROGRESS` and `UNDER_REVIEW` behavior remains unchanged.
7. Run:

```bash
npm test -- --runTestsByPath __tests__/groupchatPlanning.test.js __tests__/watcher.test.js
```

8. Run the broader test suite if shared runner utilities are touched:

```bash
npm test
```

---

## 6. Rollback Notes

If the groupchat runner causes workflow confusion, remove the new `groupchat:*` scripts and `agent-runner/groupchat-*` files. Existing `TASKS/`, `REVIEWS/`, watcher, review validator, and Antigravity dispatch semantics should remain untouched.

---

## 7. 小C DRAFT Advisory Decision

小C accepts the operator-relayed 小A and 小B advisory feedback with the following decisions:

- Adopt 小A's deterministic mock recommendation by requiring `agent-runner/fixtures/groupchat_mock_template.json`.
- Adopt 小A's DRAFT idempotency recommendation by defining planning dispatch keys and `PLANNING/groupchat_request_<sessionId>.json`.
- Adopt 小A's replay isolation recommendation in TASK-014 by requiring replay-only meeting-room positioning and no persisted live-agent mutations.
- Adopt 小B's recommendation that GroupChat replaces, rather than runs alongside, the legacy `REVIEWS/task_advice_NNN.md` DRAFT advisory path.
- Adopt 小B's recommendation to decouple `sessionId` / `planNum` from formal `taskNum`.
- Adopt 小B's schema recommendation by requiring `schemaVersion: 1`, stable `speakerId`, and explicit `stepId` values.
- Adopt 小B's recommendation to keep TASK-014 blocked until TASK-013 ships a golden fixture.
- Keep watcher DRAFT dispatch inside TASK-013 instead of splitting to TASK-013b, because the operator explicitly asked to proceed with the workflow automation now.

---

小A，TASK-013 已由小C釋出為 `IN_PROGRESS`；請實作 TASK-013 的 consultative GroupChat planning artifact layer；完成後不要標 `COMPLETED`，請將 `TASKS/task_013.md` 與 `AGENT_STATE.md` 推進到 `UNDER_REVIEW`。
