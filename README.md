# Pixel Agent Desk

[![CI](https://github.com/Mgpixelart/pixel-agent-desk/actions/workflows/test.yml/badge.svg)](https://github.com/Mgpixelart/pixel-agent-desk/actions/workflows/test.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Electron](https://img.shields.io/badge/Electron-42+-47848F?logo=electron&logoColor=white)](https://www.electronjs.org/)

> Real-time pixel avatar visualization for Claude Code CLI and generic multi-agent sessions.

Pixel Agent Desk is a standalone Electron app that listens to agent hook events and renders each active session as an animated pixel character — complete with a virtual 2D office, web dashboard, activity heatmaps, and token usage analytics. It supports both **Claude Code CLI** and any generic agent framework reporting via a unified event ingestion API.

![Demo](docs/demo.gif)

| | | |
|---|---|---|
| ![](docs/screenshot-1.png) | ![](docs/screenshot-2.png) | ![](docs/screenshot-4.png) |
| ![](docs/screenshot-5.png) | | |

## Highlights

- **Pixel Avatars** — Each agent session gets a unique sprite character with state-driven animations.
- **Virtual Office** — 2D pixel art office where characters walk between desks.
- **Agent Desk Dashboard** — Full UI desktop window and web-monitor panel with real-time stats (accessible at `http://localhost:3000`).
- **Activity Heatmap** — GitHub-style contribution grid showing daily agent session frequency.
- **Token Analytics** — Per-session and aggregate token usage, cost estimates, and model breakdowns.
- **Terminal Focus** — Click any avatar card or sprite to bring its terminal window to the foreground (macOS/Windows).
- **PiP Mode** — Optional always-on-top floating window (triggered from the dashboard) so your pixel office stays visible while you work.
- **Auto Recovery** — Sessions are automatically restored on app restart.
- **Multi-Provider Support** — Normalize pricing and context windows for OpenAI, Anthropic, Google Gemini, xAI Grok, and DeepSeek.

## Requirements

- **Node.js** 20 or later
- **OS:** Windows, macOS, or Linux
- **Claude Code CLI** (Optional, only required if using Claude Code mode)

## Quick Start

```bash
git clone https://github.com/Mgpixelart/pixel-agent-desk.git
cd pixel-agent-desk
npm install
npm start
```

> `npm start` opens the full Pixel Agent Desk dashboard window directly. From the dashboard, you can optionally launch Picture-in-Picture (PiP) mode to keep a small always-on-top floating view of your pixel office.
> If Claude mode is enabled, `npm install` will automatically attempt to register the required Claude Code hooks in `~/.claude/settings.json`.

---

## Configuration & Operating Modes

Pixel Agent Desk can be configured via a JSON file located at `~/.pixel-agent-desk/config.json`. 

### Operating Modes

1. **Claude Code Mode (Default)**
   - Enabled by setting `integrations.claude.enabled` to `true` (or leaving it undefined).
   - Auto-registers Claude settings, scans transcripts under `~/.claude/projects/` for heatmaps, and verifies active sessions using local PID processes.

2. **Generic Watcher Mode**
   - Enabled by setting `integrations.claude.enabled` to `false`.
   - In this mode, the app operates without any dependencies on the Claude CLI. It will skip transcript scanning, bypass local PID validation, and allow you to render characters purely via the generic HTTP event API.

Example `~/.pixel-agent-desk/config.json`:
```json
{
  "integrations": {
    "claude": {
      "enabled": false
    }
  }
}
```

## Agent Detection

Pixel Agent Desk automatically detects and connects to five AI agent platforms at startup. See `docs/integration-smoke-test.md` for a complete guide.

- **Claude Code**: HTTP hook via `~/.claude/settings.json`
- **Codex**: Read-only observer of `~/.codex/sessions/`
- **Grok Build**: Command-hook forwarder via `~/.grok/hooks/`
- **Antigravity**: Command-hook forwarder via `~/.gemini/config/hooks.json`
- **OpenWork / OpenCode**: Plugin via `~/.config/opencode/plugins/`

Run the read-only diagnostic to check integration status:
```bash
npm run diagnose:integrations
```

See `docs/integration-smoke-test.md` for detailed per-agent smoke test instructions.

### Troubleshooting

| Symptom | Likely Cause | Fix |
|---|---|---|
| Agent not appearing | Agent platform not installed or hook not registered | Run `npm run diagnose:integrations` and check `installed`/`integrated` columns |
| Codex observer shows `active=false` | Diagnostics does not call `startAll()` | This is normal; `npm start` starts observers |

---

## Normalized Agent Event API

You can report activity from any custom watcher, script, or agent framework by sending HTTP POST requests to the generic ingestion endpoint:

- **Endpoint:** `POST http://localhost:47821/events/agent`
- **Content-Type:** `application/json`

### Event Payload Schema

```json
{
  "event": "agent.working",
  "agent_id": "GA",
  "source": "my-custom-watcher",
  "name": "A沐瑤",
  "project_path": "/path/to/project",
  "model": "gpt-4o",
  "tool": "Bash",
  "parent_id": null,
  "agent_type": "planner",
  "pid": 12345,
  "timestamp": 1781550497208,
  "token_usage": {
    "input_tokens": 1200,
    "cached_input_tokens": 500,
    "output_tokens": 400
  },
  "metadata": {}
}
```

### Fields

| Field | Type | Required | Description |
| :--- | :---: | :---: | :--- |
| `event` | `string` | **Yes** | One of the supported event names below. |
| `agent_id` | `string` | **Yes** | A unique identifier for the agent session (supports `session_id` alias). |
| `source` | `string` | **Yes** | The source name of the agent (e.g. `watcher`, `antigravity`). |
| `name` | `string` | No | Display name of the agent (falls back to `name-map.json` or project path). |
| `project_path` | `string` | No | Absolute path to the directory containing the project. |
| `model` | `string` | No | LLM model name. |
| `tool` | `string` | No | The name of the active tool (supports `tool_name` alias). |
| `pid` | `number` | No | Process identifier of the agent runner (optional). |
| `timestamp` | `number` | No | Millisecond Epoch timestamp (defaults to `Date.now()`). |
| `token_usage` | `object` | No | Contains `input_tokens`, `cached_input_tokens`, and `output_tokens`. |

### Supported Event Names

- `agent.started` — Instantiates/registers the agent.
- `agent.thinking` — Transitions character to a thinking state (accumulating token costs if `token_usage` is passed).
- `agent.working` — Transitions character to working state (displays active tool).
- `agent.idle` — Transitions character to waiting/idle state.
- `agent.done` — Character returns to idle and sets last message.
- `agent.error` — Character shows error status.
- `agent.help` — Character requests permission/help.
- `agent.removed` — Clears the character from the virtual office.

---

## Session Recovery & Custom Mapping

### Recovery Policies

Persisted sessions are automatically recovered on application restart based on their source:
- **Claude Code (`claude-code`)**: Verified by checking active system processes using the running PID.
- **Generic/Custom Watchers**: Bypasses local PID checks. Custom sessions will be recovered if the `agent_id` is allowlisted in either of the config files below.

### Configuration Files

- **`~/.pixel-agent-desk/watcher-allowlist.json`**
  Stores session IDs that should be persisted across restarts. Supports array lists, key-value maps, or nested formats.
  ```json
  ["GA", "GB", "CC"]
  ```

- **`~/.pixel-agent-desk/name-map.json`**
  Maps session IDs to display names in the office dashboard. Keys in this file are also automatically allowlisted for session recovery.
  ```json
  {
    "GA": "A沐瑤",
    "GB": "B盼兮",
    "CC": "C婉清"
  }
  ```

### Avatar Customization Override

Roster agents (e.g. Codex, Antigravity, Grok Build) can be customized with local avatar overrides that persist across dashboard reloads:
- **`localStorage` Key:** `pixel-agent-desk.avatarOverrides.v1`
- **Data Shape:** A JSON object mapping stable agent `id` to the selected avatar index in the avatar file array.
  ```json
  {
    "codex": 2,
    "antigravity": 5
  }
  ```
- **Reset Option:** Selecting the "Reset to Default" option removes the agent's entry from the override object, reverting their appearance to the default deterministic assignment (`avatarIndexFromId()`).

---

## Model Pricing Registry

Pixel Agent Desk resolves pricing, token costs, and context window sizes dynamically for models belonging to the following mainstream provider families:

- **OpenAI GPT family** (e.g. `gpt-4o`, `gpt-4o-mini`, `o1`)
- **Anthropic Claude family** (e.g. `claude-3-5-sonnet`, `claude-3-5-haiku`, `claude-3-opus`)
- **Google Gemini family** (e.g. `gemini-1.5-pro`, `gemini-1.5-flash`, `gemini-2.0-flash`)
- **xAI Grok family** (e.g. `grok-2`, `grok-beta`)
- **DeepSeek family** (e.g. `deepseek-chat`, `deepseek-reasoner`)

Pricing calculations support cached input discounts. Pricing details and context windows are maintained in [src/pricing.js](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/src/pricing.js) with references to official documentation and `updatedAt` metadata.

### Metered API vs. Subscription / TUI Agents

Mainstream API models (like Anthropic Claude, OpenAI GPT, Google Gemini, xAI Grok, etc.) report granular token consumption via hook events. For these agents, the dashboard displays precise metered API token count, estimated cost, and context window utilization.

Subscription-based tools, local TUI-based agents, and other platforms that do not use pay-per-token API endpoints do not expose precise token count metrics. For these agents:
- The dashboard displays **"Usage unavailable"** and **"Cost: N/A"** to prevent misleading zeros.
- The context window indicator shows **`--`** (disabled).
- Overall KPIs for token totals and costs on the dashboard are reframed to highlight live/idle metered activity, excluding non-metered agents from the totals to avoid skewing the averages.

---

## Troubleshooting

**Avatars do not appear**
- Check that hooks are registered in `~/.claude/settings.json` (for Claude mode).
- Verify the hook server is up: `curl http://localhost:47821/hook` (should return 404 for GET, 200 for valid POST).

**Ghost avatars persist**
- Make sure session IDs are in `watcher-allowlist.json` or `name-map.json` so they are not treated as zombie sessions on restart.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

- **Source code:** [MIT License](LICENSE)
- **Art assets** (`public/characters/`, `public/office/`): [Custom restrictive license](LICENSE-ASSETS) — not for redistribution or modification.
