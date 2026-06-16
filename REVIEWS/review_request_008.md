# Review Request: TASK-008 — Wire watcher handoff consumers for active execution (v2)

- **Branch**: `task/task_008_watcher_handoff_consumers`
- **Head**: `a36507f`
- **Reviewer**: Grok Build (Layer 2)
- **Requested By**: Antigravity (Layer 3)
- **Date**: 2026-06-16
- **Previous Review**: `review_008.md` — REQUEST_CHANGES

---

## Changes Since Previous Review (B1–B4 All Closed)

### B1 — README updated ✅

`README.md` now documents:
- `execution_mode` (`visual-only` / `active`) with explicit default note
- Full configuration table: all keys, defaults, env override names, descriptions
- `dispatch_result_NNN_target.json` schema (all 15 fields)
- Two-pipeline separation callout (`task_handoff_*` vs `handoff_payload_*`)
- `--simulate-handoff` dry-run documentation
- Troubleshooting table (5 common symptoms → causes → fixes)
- Runtime artifact gitignore list

### B2 — `.gitignore` committed ✅

`REVIEWS/dispatch_result_*.json`, `REVIEWS/task_handoff_*.json`, `REVIEWS/grok_handoff_*.json` added and committed in `a36507f`.

### B3 — P0 automated tests completed ✅

New `--dispatch-test` CLI hook added to `watcher.py` (`perform_dispatch_one` helper + `main()` parsing). 6 new integration tests in `watcher.test.js`:

| Test | Scenario | Result |
|---|---|---|
| P0-1 | active mode + mock `echo` command → success + dispatch_result schema validation | ✅ pass |
| P0-2 | command timeout → `timed_out: true`, failure result written, process exits cleanly | ✅ pass |
| P0-3 | visual-only mode → `task_handoff_*` written, no `dispatch_result_*`, warning to stderr | ✅ pass |
| P0-4 | non-blocking: `sleep 3` command runs in background thread, process eventually writes result | ✅ pass |
| P0-5 | active mode, no consumer configured → stderr config error + failed `dispatch_result_*` | ✅ pass |
| P0-6 (B4 regression) | `review_decision` trigger → `task_handoff_NNN.json` NOT written, only `dispatch_result_*` | ✅ pass |

### B4 — Pipeline separation fixed ✅

`dispatch_handoff()` now guards the fallback-payload write with `trigger != "review_decision"`. Review-decision dispatches write only `dispatch_result_*`; `task_handoff_NNN.json` is exclusively owned by the task-status pipeline.

---

## Full Test Results

```
Tests:       15 passed, 15 total   (__tests__/watcher.test.js)
Test Suites: 18 passed, 18 total   (full suite)
Tests:       316 passed, 316 total (full suite)
```

---

## Acceptance Criteria Checklist

- [x] `task_handoff` and `handoff_payload` pipelines are distinct (not conflated)
- [x] `execution_mode` key loaded from `watcher.json` with env override
- [x] In `active` mode, Antigravity command missing → stderr error + failed dispatch_result, not silent
- [x] Command runs in background thread, does not block watcher loop
- [x] Return code written to `dispatch_result_NNN_target.json`
- [x] Idempotency key prevents duplicate dispatches within same session
- [x] `--simulate-handoff` exits 0 with JSON, writes zero files
- [x] `--dispatch-test` exercises real dispatch path for CI
- [x] Runtime artifacts gitignored (committed in `.gitignore`)
- [x] `README.md` documents all of the above
- [x] `npm test` (all 316 tests) passes
