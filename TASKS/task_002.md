# TASK-002: Make Pixel Agent Desk provider-agnostic while preserving Claude support

- **Status**: `MERGED`
- **Created**: 2026-06-16
- **Created By**: Codex (Layer 1)
- **Assigned To**: Antigravity (Layer 3)
- **Reviewer**: Grok Build (Layer 2)
- **Priority**: `HIGH`
- **Branch**: `task/task_002_provider_agnostic_agent_events`
- **PR URL**: `N/A (local merge @ 5560418)`
- **Linked Review**: [review_002.md](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/REVIEWS/review_002.md)
- **Dependencies**: [TASK-001](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/TASKS/task_001.md)

---

## 1. Objective

Refactor Pixel Agent Desk into a provider-agnostic agent monitor. The core runtime must no longer depend on Claude Code hook names, Claude transcript paths, Claude PID checks, or Claude-only pricing assumptions.

Claude Code must remain supported through a compatibility adapter, but it should become one integration among many. Custom watchers, Antigravity, Codex, Grok, local scripts, and future agent frameworks should be able to report activity through a normalized event API without emitting Claude-specific fields such as `hook_event_name`, `PreToolUse`, `transcript_path`, or `permission_mode`.

---

## 2. Files Affected

- `[NEW]` [agentEventSchema.js](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/src/main/agentEventSchema.js)
- `[NEW]` [agentEventProcessor.js](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/src/main/agentEventProcessor.js)
- `[NEW]` [claudeHookAdapter.js](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/src/main/adapters/claudeHookAdapter.js)
- `[NEW]` [normalizedAgentAdapter.js](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/src/main/adapters/normalizedAgentAdapter.js)
- `[MODIFY]` [hookServer.js](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/src/main/hookServer.js)
- `[MODIFY]` [hookProcessor.js](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/src/main/hookProcessor.js)
- `[MODIFY]` [sessionPersistence.js](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/src/main/sessionPersistence.js)
- `[MODIFY]` [livenessChecker.js](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/src/main/livenessChecker.js)
- `[MODIFY]` [hookRegistration.js](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/src/main/hookRegistration.js)
- `[MODIFY]` [main.js](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/src/main.js)
- `[MODIFY]` [agentManager.js](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/src/agentManager.js)
- `[MODIFY]` [pricing.js](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/src/pricing.js)
- `[MODIFY]` [heatmapScanner.js](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/src/heatmapScanner.js)
- `[MODIFY]` [README.md](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/README.md)
- `[MODIFY/NEW]` relevant Jest tests under `__tests__/`

---

## 3. Normalized Agent Event API

Add a provider-neutral ingestion endpoint:

- `POST /events/agent`

It accepts normalized events with this shape:

```json
{
  "event": "agent.started",
  "agent_id": "GA",
  "source": "custom-watcher",
  "name": "A沐瑤",
  "project_path": "/path/to/project",
  "model": "gpt-5.5",
  "tool": "Write",
  "parent_id": null,
  "agent_type": "planner",
  "pid": 12345,
  "timestamp": 1781550497208,
  "token_usage": {
    "input_tokens": 0,
    "cached_input_tokens": 0,
    "output_tokens": 0
  },
  "metadata": {}
}
```

Required:

- `event`
- `agent_id`
- `source`

Supported event names:

- `agent.started`
- `agent.thinking`
- `agent.working`
- `agent.idle`
- `agent.done`
- `agent.error`
- `agent.help`
- `agent.removed`

Compatibility:

- Accept `session_id` as an alias for `agent_id`, but normalize internally to `agent_id`.
- Accept `tool_name` as an alias for `tool`.
- Preserve safe provider-specific fields inside `metadata`.

---

## 4. Claude Compatibility Adapter

Keep `POST /hook` for Claude Code legacy hooks, but it must no longer update `AgentManager` directly.

Flow:

1. `POST /hook` validates Claude hook payloads.
2. `claudeHookAdapter` maps Claude hook events to normalized agent events.
3. `agentEventProcessor` applies normalized events to `AgentManager`.

Claude mapping:

| Claude hook | Normalized event |
| :--- | :--- |
| `SessionStart` | `agent.started` |
| `UserPromptSubmit` | `agent.thinking` |
| `PreToolUse` | `agent.working` |
| `PostToolUse` | `agent.thinking` |
| `Stop` | `agent.done` |
| `TaskCompleted` | `agent.done` |
| `PermissionRequest` | `agent.help` |
| `Notification` with permission prompt | `agent.help` |
| `PostToolUseFailure` | `agent.error` |
| `SessionEnd` | `agent.removed` |
| `SubagentStart` | `agent.started` with `parent_id` |
| `SubagentStop` | `agent.removed` |

Important:

- `hookProcessor.js` should shrink or become legacy-only glue.
- New state transition logic should live in `agentEventProcessor.js`.
- Claude-specific names must not leak into the generic processor.

---

## 5. Provider-Agnostic Recovery And Liveness

Refactor persisted-session recovery so it is source-policy based instead of Claude-only.

Suggested policy shape:

```js
const SOURCE_POLICIES = {
  'claude-code': { recover: 'pid', processNamePattern: /claude/i },
  'custom-watcher': { recover: 'allowlist' },
  'antigravity': { recover: 'allowlist' },
  'codex': { recover: 'allowlist' },
  'grok': { recover: 'allowlist' },
  'generic': { recover: 'allowlist' }
};
```

Rules:

- Claude Code can keep PID-based recovery through the Claude integration.
- Non-Claude sources must not call `isClaudeProcess()`.
- Custom/generic sources recover only if allowlisted.
- Existing allowlist behavior must continue:
  - `~/.pixel-agent-desk/watcher-allowlist.json`
  - keys in `~/.pixel-agent-desk/name-map.json`
- Stale, non-allowlisted, or unknown persisted agents must be skipped with a clear debug log.

---

## 6. Optional Integrations

Move Claude-specific features behind explicit integrations.

Claude integration:

- Auto-registering `~/.claude/settings.json`
- Reading `transcript_path`
- Scanning `~/.claude/projects/`
- Claude PID verification

Generic runtime:

- Should work without `~/.claude/`
- Should not require Claude CLI installed
- Should render agents purely from normalized `/events/agent` events

Configuration:

- Add an integration config such as `integrations.claude.enabled`.
- Default may stay enabled for backward compatibility, but README must explain generic mode.

---

## 7. Model Pricing Registry

Refactor `src/pricing.js` into a provider-aware registry with model aliases.

Minimum API:

```js
resolveModelPricing(modelName)
calculateTokenCost({
  model,
  input,
  cacheRead,
  cacheCreate,
  output
})
getContextWindowSize(model)
```

Pricing entries should use this style:

```js
{
  provider: "openai",
  model: "gpt-5.5",
  aliases: ["gpt-5.5"],
  inputPerMTok: 5,
  cachedInputPerMTok: 0.5,
  outputPerMTok: 30,
  contextWindow: null,
  sourceUrl: "https://developers.openai.com/api/docs/pricing",
  updatedAt: "2026-06-16"
}
```

Built-in coverage must include the top five mainstream hosted model providers/families:

- OpenAI GPT family
- Anthropic Claude family
- Google Gemini family
- xAI Grok family
- DeepSeek family

Execution requirement:

- Verify current pricing from official provider documentation before finalizing constants.
- Include source URLs and `updatedAt`.
- Add tests for model alias resolution and cost calculation across all five provider families.
- If a provider has multiple pricing tiers, document which tier is implemented.
- Do not hardcode a single canonical Llama price unless choosing a specific hosted provider such as OpenRouter, Together, Groq, or Replicate.

---

## 8. Acceptance Criteria

- Custom watchers can use `POST /events/agent` without any Claude-specific fields.
- Claude Code still works through `POST /hook`.
- Core event processing no longer switches on Claude hook names.
- Agent state updates work for generic sources: started, thinking, working, idle, done, error, help, removed.
- Persisted non-Claude agents recover by source allowlist, not Claude PID checks.
- Pixel Agent Desk can start and display generic watcher agents on a machine without Claude CLI.
- Pricing supports aliases and cost estimates for OpenAI, Anthropic, Google, xAI, and DeepSeek.
- Heatmap/session analytics do not require `~/.claude/projects/` in generic mode.
- README includes Claude Code setup, generic watcher setup, normalized event payload examples, and model pricing notes.
- `npm test` passes.

---

## 9. Suggested Work Order

1. Add normalized schema and `/events/agent`.
2. Add `agentEventProcessor.js` and make it update `AgentManager`.
3. Write tests for generic started/working/done/removed events.
4. Add Claude adapter and route legacy `/hook` through normalized events.
5. Refactor recovery source policies.
6. Move Claude transcript/heatmap behavior behind optional integration flags.
7. Refactor pricing registry and add five-provider tests.
8. Update README.
9. Run full `npm test`.

---

## 10. Rollback Notes

If the generic event refactor causes regressions, revert the feature branch and keep the current Claude-compatible `/hook` behavior.
