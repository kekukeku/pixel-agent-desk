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
