# Review Request: TASK-008 — Wire watcher handoff consumers for active execution

- **Branch**: `task/task_008_watcher_handoff_consumers`
- **Reviewer**: Grok Build (Layer 2)
- **Requested By**: Antigravity (Layer 3)
- **Date**: 2026-06-16

---

## Summary of Changes

Implements the full async dispatch engine for TASK-008, closing the automation gap left after TASK-006/007.

### Core changes — `watcher.py`

| Area | Detail |
|---|---|
| **Idempotency** | `WatcherState.dispatched_keys` set; key format `{task_num}:{target}:{trigger}:{state}` |
| **Dispatch engine** | `dispatch_handoff()` is the single entry point for both pipelines |
| **Two pipelines** | `task_handoff` (antigravity) vs `grok_handoff` (grok) remain separate; router (`route-review-decision.js`) is unchanged |
| **Async workers** | `_run_command_worker` (thread + `subprocess.run` via `communicate(timeout=…)`) / `_run_webhook_worker` (thread + `urllib`) |
| **Timeout + capture** | Configurable via `command_timeout_seconds` (default 600 s) and `output_capture_bytes` (default 8 192 B) |
| **Result schema** | `dispatch_result_{task_num}_{target}.json` written after every worker completes; gitignored |
| **Active mode error** | `execution_mode=active` with no command/webhook prints to stderr and writes a failed dispatch result instead of silently passing |
| **Visual-only** | Prints warning and writes fallback payload only; no thread spawned |
| **`--simulate-handoff`** | Side-effect-free dry-run; returns JSON array of would-be dispatches with `dispatch_key`, `transport`, `would_error_active`, `payload_shape` |

### Tests — `__tests__/watcher.test.js`

9 tests passing:

- `--parse-only` suite: 3 existing tests (unchanged)
- `--simulate-handoff` suite: 5 new integration tests
  - Empty repo → `[]`
  - IN_PROGRESS task → correct `antigravity` entry
  - UNDER_REVIEW registry → correct `grok` entry
  - `would_error_active=true` when `execution_mode=active` and no command configured
  - No files written (side-effect-free)
- Idempotency key format: 1 unit test

### Gitignore

```
REVIEWS/dispatch_result_*.json
REVIEWS/task_handoff_*.json
REVIEWS/grok_handoff_*.json
```

---

## Acceptance Criteria Checklist

- [x] `task_handoff` and `handoff_payload` pipelines are distinct (not conflated)
- [x] `execution_mode` key loaded from `watcher.json` with env override (`PIXEL_AGENT_DESK_WATCHER_EXECUTION_MODE`)
- [x] In `active` mode, Antigravity command missing → stderr error + failed dispatch_result, not silent
- [x] Command runs in background thread (`subprocess.Popen` + `communicate(timeout=…)`) — does not block watcher loop
- [x] Return code written to `dispatch_result_NNN_target.json`
- [x] Idempotency key prevents duplicate dispatches within same watcher session
- [x] `--simulate-handoff` exits 0 with JSON output and writes zero files
- [x] Runtime artifacts gitignored
- [x] `npm test` (all 9 tests) passes

---

## Open Questions for Grok Build

None. All consultant guidance addressed: threading for non-blocking execution, synchronous `communicate()` for return code, active-mode config error.
