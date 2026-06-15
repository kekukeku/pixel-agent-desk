# TASK-007: Watcher onboarding docs and dependency setup

- **Status**: `IN_PROGRESS`
- **Created**: 2026-06-16
- **Created By**: Codex (Layer 1)
- **Assigned To**: Antigravity (Layer 3)
- **Reviewer**: Grok Build (Layer 2)
- **Priority**: `HIGH`
- **Branch**: `task/task_007_watcher_onboarding_docs`
- **PR URL**: `TBD`
- **Linked Review**: [review_request_007.md](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/REVIEWS/review_request_007.md)
- **Dependencies**: [TASK-006](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/TASKS/task_006.md)

---

## 1. Objective

Harden the TASK-006 Pixel Agent Desk watcher for new-machine onboarding and visual-only operation by implementing the F1 and F2 follow-up items from [follow_up_006.md](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/REVIEWS/follow_up_006.md).

This task should make it obvious how to install the Python dependency required by `watcher.py`, how to start the watcher from a clean checkout, and how to interpret both Antigravity and Grok Build fallback handoff files when no command or webhook is configured.

Keep the scope intentionally small: dependency setup, README documentation, and a clear missing-dependency error path only. Do not redesign the watcher architecture or implement the larger F3/F4/F5/F6 follow-ups in this task.

---

## 2. Files Affected

- `[NEW]` [requirements.txt](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/requirements.txt)
- `[MODIFY]` [README.md](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/README.md)
- `[MODIFY]` [watcher.py](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/watcher.py)

### Candidate Files

- [REVIEWS/follow_up_006.md](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/REVIEWS/follow_up_006.md)
- [__tests__/watcher.test.js](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/__tests__/watcher.test.js)

---

## 3. Acceptance Criteria

- Add a root-level `requirements.txt` that includes the Python dependency needed by `watcher.py`.
- Pin or constrain the `watchdog` dependency conservatively enough for repeatable installation while avoiding unnecessary broad dependency churn.
- README documents clean-checkout watcher setup, including:
  - installing Python dependencies with `python3 -m pip install -r requirements.txt`
  - starting Pixel Agent Desk
  - starting `python3 watcher.py`
  - overriding the watched project root with `--project-root` or `PIXEL_AGENT_DESK_PROJECT_ROOT`
- README clearly distinguishes visual-only mode from execution-handoff mode.
- README documents both fallback payload files and their trigger conditions:
  - Antigravity fallback payload under `REVIEWS/` when TASK files enter `DRAFT` or `IN_PROGRESS` and no Antigravity command/webhook is configured
  - Grok Build fallback payload `REVIEWS/grok_handoff_NNN.json` when a task enters `UNDER_REVIEW` or review handoff is needed and no Grok command/webhook is configured
- README includes a small example of the fallback payload fields, such as `task_num`, `project_root`, `status` or `decision`, and `timestamp`.
- `watcher.py` fails with a clear operator-facing message if `watchdog` is missing, instead of surfacing only a raw Python import traceback.
- Existing watcher behavior remains unchanged when dependencies are installed.
- Do not modify `src/`, Electron runtime UI, GitHub workflow files, or the review router in this task.
- Do not implement F3 watcher test expansion, F4 argument-array command execution, F5 `agent.done`, or F6 `on_deleted`.
- Add or update automated tests only if the `watcher.py` dependency guard changes test-visible behavior.
- Run:

```bash
npm test -- --runTestsByPath __tests__/watcher.test.js
```

---

## 4. Implementation Notes

- Treat [REVIEWS/follow_up_006.md](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/REVIEWS/follow_up_006.md) as the source of intent, but implement only F1 and F2.
- Prefer a small import guard near the `watchdog` import that prints a concise install hint and exits non-zero when the dependency is missing.
- Keep `requirements.txt` minimal. Do not add unrelated Python or Node dependencies.
- README should mention that visual status updates can still work independently from external Antigravity/Grok automation, but missing command/webhook configuration means the operator must inspect the fallback JSON files and manually continue the workflow.
- Preserve TASK-006's existing watcher CLI, config keys, event payloads, and handoff filenames unless the current code already uses a different Antigravity fallback filename. Document the actual filenames used by the implementation.

---

## 5. Non-Goals

- Do not resume or implement TASK-005.
- Do not expand watcher functional coverage beyond F1 and F2.
- Do not change review routing semantics.
- Do not add auto-merge or external proprietary agent APIs.
- Do not rewrite `watcher.py`.

---

## 6. Verification Plan

- Run:

```bash
npm test -- --runTestsByPath __tests__/watcher.test.js
```

- Manually verify README instructions by checking that the documented commands are copy-pasteable from the repository root.
- Optional smoke check:
  1. In a clean or dependency-isolated Python environment, run `python3 watcher.py --parse-only`.
  2. Confirm the missing `watchdog` path gives a clear install hint if `watchdog` is absent.
  3. After installing with `python3 -m pip install -r requirements.txt`, confirm `python3 watcher.py --parse-only` still works.

---

## 7. Rollback Notes

If the dependency guard or documentation causes confusion, revert `requirements.txt`, the README watcher section changes, and the small `watcher.py` import guard. The TASK-006 watcher runtime behavior should remain otherwise unchanged.

---

小 A，請依照 `pixel-agent-desk/TASKS/task_007.md` 開始執行 F1 + F2 watcher onboarding 文件與依賴補強，將狀態從 `DRAFT` 推進到 `IN_PROGRESS`，並按既有流程開分支。
