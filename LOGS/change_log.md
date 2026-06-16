# Change Log

All notable changes to this project will be documented in this file.

## [2026-06-16] TASK-001: Initialize Governance Framework

- Added [TEAM_RULES.md](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/TEAM_RULES.md) to define the three-agent system architecture and gate control.
- Added [AGENT_STATE.md](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/AGENT_STATE.md) as the single source of truth for task state transitions.
- Added [PR_TEMPLATE.md](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/PR_TEMPLATE.md) to structure pull requests.
- Set up local agent review runner under `agent-runner/`.

## [2026-06-16] TASK-002: Make Pixel Agent Desk provider-agnostic while preserving Claude support

- Added a configuration loader `config.js` to control optional integrations via `~/.pixel-agent-desk/config.json`.
- Implemented a provider-aware model pricing registry supporting OpenAI, Anthropic, Google Gemini, xAI Grok, and DeepSeek.
- Added a normalized agent event API at `POST /events/agent` with validation schemas, mappings, and state transitions.
- Separated Claude Code CLI hooks into compatibility adapters (`claudeHookAdapter.js` and legacy wrapper `hookProcessor.js`).
- Refactored session recovery policies to distinguish between process verification (for Claude) and source allowlist verification (for custom watchers).
- Added comprehensive unit testing for event processor and multi-provider pricing.

## [2026-06-16] TASK-003: Strengthen repository governance rules from TASK-002 retrospective

- Strengthened Codex task specifications standards to require selection based on AGENT_STATE.md, precise required files vs candidates, explicit testing and documentation expectations, and external reference validity checks.
- Added Antigravity pre-review self-check checklists inside TEAM_RULES.md and implemented them as a PR template checklist inside PR_TEMPLATE.md.
- Added Grok Build review guidelines to separate issues into blocking, non-blocking, and optional follow-ups, and require architectural tradeoff analysis.
- Defined a post-merge reconciliation checklist requiring alignment of task files, central registry, review files, validation master documents, and the change log.

## [2026-06-16] TASK-004: Implement review decision router MVP

- Added an `agent-runner` script suite containing `resolve-task.js`, `trigger-review.js`, `dispatch-grok-review.js`, `validate-review.js`, and `route-review-decision.js`.
- Implemented `route-review-decision.js` to parse Grok Build decisions (`APPROVE`, `REQUEST_CHANGES`, `REJECT`) and map them to downstream automation targets, labels, comments, and payload artifacts.
- Added GitHub Actions workflows for Grok review dispatching, merge validator gating, and decision routing with job-level guards to prevent self-applied label loop triggers.
- Updated `TEAM_RULES.md` and `REVIEWS/README.md` to document the router triggers and payload contracts.
- Added unit tests under `__tests__/agentRunner.test.js` validating all decision routes.

## [2026-06-16] TASK-005: Personalize office floorplan title with local username

- Wrapped the dashboard office panel title in a `<span>` element with ID `officePanelTitle` in `dashboard.html`.
- Implemented client-side logic in `public/dashboard.js` to asynchronously fetch `/api/profile` and safely set the panel header's text content.
- Created `GET /api/profile` backend endpoint in `src/dashboard-server.js` to resolve the local OS username using `os.userInfo()` with fallback to env variables (`USER`, `USERNAME`, `User`, or `'User'`).
- Added unit tests for the `/api/profile` endpoint verifying success and all error fallback paths.

## [2026-06-16] TASK-006: Add Pixel Agent Desk watcher with visual status and execution handoff

- Implemented `watcher.py` (Python 3) to monitor `TASKS/`, `REVIEWS/`, and `AGENT_STATE.md` using `watchdog`.
- Supported project root overrides via `--project-root` and `PIXEL_AGENT_DESK_PROJECT_ROOT` env variables.
- Added support for custom keep-alive intervals and configurable/customizable agent attributes (IDs, names, types) via environment variables and `~/.pixel-agent-desk/watcher.json`.
- Implemented execution handoff POST webhooks for both Antigravity task updates and Grok review triggers.
- Integrated `on_created` filesystem events to trigger visual updates and handoffs upon new file creation.
- Added symmetric handoff warnings and fallback payload writing for Grok Build (writing `REVIEWS/grok_handoff_NNN.json`).
- Added Jest integration test suite `__tests__/watcher.test.js` using side-effect-free `--parse-only` mode.
- Documented project watcher usage and configurations in `README.md`.

## [2026-06-16] TASK-007: Watcher onboarding docs and dependency setup

- Added a root-level `requirements.txt` containing the pinned `watchdog>=6.0.0,<7.0.0` dependency.
- Implemented a graceful import guard in `watcher.py` for the `watchdog` package, showing a helpful install command hint and exiting with status code 1 when missing in normal monitoring mode.
- Ensured `--parse-only` mode runs with zero side-effects and tolerates missing `watchdog` dependencies gracefully.
- Refactored `README.md` project watcher section to use a checklist-style Quick Start guide.
- Fully documented the Visual-Only Mode behavior, fallback payloads (`REVIEWS/task_handoff_NNN.json` and `REVIEWS/grok_handoff_NNN.json`), and their exact JSON fields/trigger conditions.

## [2026-06-16] TASK-008: Wire watcher handoff consumers for active execution

- Replaced fire-and-forget `subprocess.Popen` with a full **async dispatch engine**: `_run_command_worker` and `_run_webhook_worker` run in background threads using `subprocess.Popen` + `communicate(timeout=…)` to capture return codes without blocking the watcher loop.
- Introduced `dispatch_handoff()` as the single, authoritative entry point for both the **task-execution pipeline** (`REVIEWS/task_handoff_NNN.json` → Antigravity) and the **registry pipeline** (`REVIEWS/grok_handoff_NNN.json` → Grok). The review-decision router (`route-review-decision.js`) remains the owner of `handoff_payload_NNN.json`.
- Enforced **pipeline separation**: `review_decision` dispatches are guarded from writing `task_handoff_NNN.json`; only `dispatch_result_*` is written for router dispatch auditing.
- Added **session-level idempotency** via `WatcherState.dispatched_keys` set; key format: `{task_num}:{target}:{trigger}:{state_or_decision}`.
- Added **`execution_mode`** config key (`visual-only` default / `active`): in `active` mode, misconfigured targets (no `command` or `webhook`) emit a stderr error and write a failed `dispatch_result_*` instead of silently passing.
- Added **`dispatch_result_{task_num}_{target}.json`** result schema (15 fields including `transport`, `success`, `returncode`, `http_status`, `timed_out`, `stdout_excerpt`, `stderr_excerpt`, `started_at`, `finished_at`, `dispatch_key`).
- New config keys with env var overrides: `execution_mode` (`PIXEL_AGENT_DESK_WATCHER_EXECUTION_MODE`), `command_timeout_seconds` (`PIXEL_AGENT_DESK_WATCHER_COMMAND_TIMEOUT_SECONDS`), `output_capture_bytes` (`PIXEL_AGENT_DESK_WATCHER_OUTPUT_CAPTURE_BYTES`).
- Added **`--simulate-handoff`** CLI flag: pure side-effect-free dry-run returning a JSON array of dispatches that would fire given current repo state, including `dispatch_key`, `transport`, `would_error_active`, and `payload_shape`.
- Added **`--dispatch-test`** CLI flag + `perform_dispatch_one()` helper: CI integration test hook that runs a single real dispatch, waits for the background worker to complete, and returns the `dispatch_result` JSON.
- Committed runtime artifact patterns to **`.gitignore`**: `REVIEWS/dispatch_result_*.json`, `REVIEWS/task_handoff_*.json`, `REVIEWS/grok_handoff_*.json`.
- Updated **`README.md`**: documented `execution_mode` modes, full config table with env overrides/defaults, `dispatch_result` schema table, two-pipeline separation callout, `--simulate-handoff` dry-run usage, and a troubleshooting table (5 common symptoms).
- Extended **`__tests__/watcher.test.js`** with 6 P0 integration tests (total 15 tests): active dispatch success + schema validation, command timeout failure, visual-only fallback, non-blocking thread verification, active-mode missing consumer config error, and B4 pipeline separation regression test.
- Full test suite: **316/316 passing**.

## [2026-06-16] TASK-009: Editable agent display names in dashboard roster

- Added a compact edit button inline next to each agent's display name in the right-side System Roster.
- Implemented client-side logic in `public/dashboard.js` and `public/dashboard.css` to allow renaming active agent avatars inline.
- Created `GET /api/name-map` and `PUT /api/agents/:id/name` API endpoints in `src/dashboard-server.js` to manage custom names for local requests.
- Integrated name mapping logic in `src/agentManager.js` to parse, update, and persist custom names to `~/.pixel-agent-desk/name-map.json` using atomic file writes.
- Implemented payload validation on the name update route to reject names longer than 40 characters and ensure safe rendering via `textContent`.
- Added unit and integration tests in `__tests__/agentManager.test.js` and `__tests__/dashboard-server.test.js` covering name resolution and mapping APIs.

## [2026-06-16] TASK-010: Launch dashboard directly and remove always-floating desktop avatar

- Modified default app startup in `src/main.js` to launch the full web dashboard directly via `windowManager.createDashboardWindow()` instead of the legacy `alwaysOnTop` transparent mini window.
- Removed the legacy mini window creation path and the keep-alive loop (`startKeepAlive()`) from default startup and activate events.
- Re-ordered main process startup lifecycle to register agent event listeners and flush pending starts before the dashboard window finishes loading.
- Retained the `renderer-ready` IPC listener and legacy window creation helpers for backward compatibility without activating them by default.
- Updated the dashboard codebase comments and documented the direct-dashboard startup behavior and optional PiP trigger in `README.md`.
- Confirmed full test suite compatibility with **332/332 tests passing**.

## [2026-06-16] TASK-011: Set default agent display names in user name map

- Created/updated the local configuration file at `~/.pixel-agent-desk/name-map.json` to assign custom Chinese names to the three default watcher agents: `antigravity` ("小A沐瑤"), `grok-build` ("小B盼兮"), and `codex` ("小C婉清").
- Removed stale fallback mappings and confirmed JSON validity.
- Conducted cross-agent retrospective evaluations (`colleagueview/`) for Codex (Layer 1) and Grok Build (Layer 2) for TASK-011.

## [2026-06-16] TASK-012: Make subscription and API usage metrics honest in dashboard UI

- Updated `src/dashboardAdapter.js` to normalize the server-side metrics payload, introducing a `usageAvailable` boolean flag to distinguish between API-metered agents and subscription/TUI agents.
- Refactored `public/dashboard.js` to utilize a client-side `hasMeteredUsage()` helper to conditionally render roster cards, office popover, and usage graphs.
- Updated dashboard HTML overview KPI cards to display workflow-oriented stats (`Active Agents`, `Session Activity`, `Tasks Today`, `Errors (24h)`) instead of confusing metered cost metrics.
- Re-labeled and redesigned the Token Usage page to "Metered API Usage", including clear copy about unmetered/subscription agents and displaying an explicit empty state instead of misleading `$0.00` values.
- Updated `public/dashboard.css` to visually disable elements (e.g. context gauge showing `--`) when usage metrics are unavailable.
- Documented the distinction between metered API usage and subscription/TUI usage in `README.md`.
- Expanded test suites in `__tests__/dashboard-server.test.js` to verify usage availability logic and mock responses.

## [2026-06-16] TASK-013: Add consultative GroupChat planning artifacts with 小C final authority

- Implemented consultative GroupChat planning CLI runner (`agent-runner/groupchat-planning.js`) and formatter (`agent-runner/groupchat-format.js`) producing schema v1 JSON, markdown transcripts, and draft plans.
- Integrated deterministic mock mode utilizing `agent-runner/fixtures/groupchat_mock_template.json` for stable CI runs.
- Added watcher dispatch keys and support for `DRAFT` planning triggers in `watcher.py` using `groupchat_request_*.json` for single-use dispatch idempotency.
- Documented GroupChat workflow and configurations in `README.md` and `TEAM_RULES.md` as the default DRAFT advisory mechanism.
- Created dashboard-ready golden fixture at `PLANNING/fixtures/groupchat_001.json`.
- Added unit and integration test suite `__tests__/groupchatPlanning.test.js` validating formatters, CLI arguments, and watcher dispatching.
