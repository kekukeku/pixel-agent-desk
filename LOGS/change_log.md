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

## [2026-06-16] TASK-006: Add Pixel Agent Desk watcher with visual status and execution handoff

- Implemented `watcher.py` (Python 3) to monitor `TASKS/`, `REVIEWS/`, and `AGENT_STATE.md` using `watchdog`.
- Supported project root overrides via `--project-root` and `PIXEL_AGENT_DESK_PROJECT_ROOT` env variables.
- Added support for custom keep-alive intervals and configurable/customizable agent attributes (IDs, names, types) via environment variables and `~/.pixel-agent-desk/watcher.json`.
- Implemented execution handoff POST webhooks for both Antigravity task updates and Grok review triggers.
- Integrated `on_created` filesystem events to trigger visual updates and handoffs upon new file creation.
- Added symmetric handoff warnings and fallback payload writing for Grok Build (writing `REVIEWS/grok_handoff_NNN.json`).
- Added Jest integration test suite `__tests__/watcher.test.js` using side-effect-free `--parse-only` mode.
- Documented project watcher usage and configurations in `README.md`.
