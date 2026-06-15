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
- **Agent Desk Dashboard** — Web-monitor panel with real-time stats (accessible at `http://localhost:3000`).
- **Activity Heatmap** — GitHub-style contribution grid showing daily agent session frequency.
- **Token Analytics** — Per-session and aggregate token usage, cost estimates, and model breakdowns.
- **Terminal Focus** — Click any avatar to bring its terminal window to the foreground (macOS/Windows).
- **PiP Mode** — Always-on-top floating window so your pixel office stays visible while you work.
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

## Repository Watcher

You can run `watcher.py` (written in Python 3) to automatically monitor this repository for task changes, review requests, and review outputs. It performs two duties:
1. **Visual status updates**: reports activity events to the Electron app to animate Codex, Antigravity, and Grok Build characters.
2. **Execution handoff**: runs local trigger or routing commands when tasks change.

### Quick Start

To setup and run the repository watcher on a clean checkout, follow these steps:

- [ ] **1. Run Pixel Agent Desk**:
  Install Node dependencies and start the Electron application or the local web dashboard server:
  ```bash
  # Install dependencies
  npm install

  # Start desktop app
  npm start
  # OR start web dashboard server
  npm run dashboard
  ```
- [ ] **2. Install Python Dependencies**:
  Install required dependencies using the root-level `requirements.txt`:
  ```bash
  python3 -m pip install -r requirements.txt
  ```
- [ ] **3. Terminate Conflict Watchers**:
  Ensure you have terminated any old watcher processes (e.g., from other tasks or projects) to prevent state conflicts.
- [ ] **4. Run the Watcher**:
  Start the watcher script at the repository root:
  ```bash
  python3 watcher.py
  ```
  *Optionally override the watched project root path using the `--project-root` argument or the `PIXEL_AGENT_DESK_PROJECT_ROOT` environment variable:*
  ```bash
  # CLI argument override
  python3 watcher.py --project-root "/path/to/another/repo"

  # Environment variable override
  PIXEL_AGENT_DESK_PROJECT_ROOT="/path/to/another/repo" python3 watcher.py
  ```

### Operating Modes

The watcher supports two modes of operation depending on the automation configuration:

#### 1. Visual-Only Mode (Default)
If no commands or webhooks are configured in `~/.pixel-agent-desk/watcher.json`, the watcher operates in **Visual-Only Mode**.
It will still post character state updates to the desktop application to animate avatars, but instead of automatically executing commands or webhooks, it writes fallback handoff payload files to the `REVIEWS/` folder and logs a warning to stderr. This allows an operator to inspect the files and manually proceed.

**Fallback Payload Files and Trigger Conditions:**

*   **Antigravity Handoff File:** `REVIEWS/task_handoff_NNN.json` (where `NNN` is the 3-digit task number, e.g. `006`).
    *   *Trigger Condition:* A task file under `TASKS/task_NNN.md` is modified or created with status `DRAFT` or `IN_PROGRESS`, and no command or webhook is configured for `antigravity` in `watcher.json`.
    *   *Payload Fields:*
        *   `task_num`: String (3-digit task number, e.g. `"006"`).
        *   `branch`: String (branch name associated with the task, e.g. `"task/task_006_pixel_agent_desk_watcher"`).
        *   `project_root`: String (absolute path of the watched repository).
        *   `status`: String (`"DRAFT"` or `"IN_PROGRESS"`).
        *   `timestamp`: Number (float epoch timestamp).
    *   *Example JSON:*
        ```json
        {
          "task_num": "006",
          "branch": "task/task_006_pixel_agent_desk_watcher",
          "project_root": "/Users/user/pixel-agent-desk",
          "status": "IN_PROGRESS",
          "timestamp": 1781584800.123
        }
        ```

*   **Grok Build Handoff File:** `REVIEWS/grok_handoff_NNN.json`.
    *   *Trigger Condition:* A task row's status in `AGENT_STATE.md` transitions to `UNDER_REVIEW`, and no command or webhook is configured for `grok` in `watcher.json`.
    *   *Payload Fields:*
        *   `task_num`: String (3-digit task number, e.g. `"006"`).
        *   `project_root`: String (absolute path of the watched repository).
        *   `status`: String (`"UNDER_REVIEW"`).
        *   `timestamp`: Number (float epoch timestamp).
    *   *Example JSON:*
        ```json
        {
          "task_num": "006",
          "project_root": "/Users/user/pixel-agent-desk",
          "status": "UNDER_REVIEW",
          "timestamp": 1781584800.456
        }
        ```

#### 2. Execution Handoff Mode
If commands or webhooks are configured for `antigravity` or `grok` in `~/.pixel-agent-desk/watcher.json`, the watcher automatically executes the command (in a subprocess shell) or issues an HTTP POST request to the webhook URL when trigger conditions are met.

### Configuration (`~/.pixel-agent-desk/watcher.json`)

```json
{
  "antigravity": {
    "command": "node scripts/run-executor.js {task_num}",
    "webhook": "http://localhost:3000/webhook/antigravity"
  },
  "grok": {
    "command": "node agent-runner/trigger-review.js {task_num}",
    "webhook": null
  },
  "keep_alive_seconds": 60,
  "agents": {
    "codex": {
      "id": "my-codex-id",
      "name": "Custom Codex",
      "type": "planner"
    }
  }
}
```

- `keep_alive_seconds`: Interval in seconds to post periodic keep-alive `agent.idle` events (defaults to `60`).
- `{task_num}`: Replaced automatically by the watcher with the 3-digit task number (e.g. `006`).
- `agents`: Customize name, id, and type for `codex`, `antigravity`, and `grok-build` agents.
- **Environment Overrides**:
  - Keep alive interval: `PIXEL_AGENT_DESK_WATCHER_KEEP_ALIVE=60`
  - Agent attributes: `PIXEL_AGENT_DESK_AGENT_[CODEX/ANTIGRAVITY/GROK_BUILD]_[ID/NAME/TYPE]` (e.g. `PIXEL_AGENT_DESK_AGENT_CODEX_NAME="My Codex"`).

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

---

## Model Pricing Registry

Pixel Agent Desk resolves pricing, token costs, and context window sizes dynamically for models belonging to the following mainstream provider families:

- **OpenAI GPT family** (e.g. `gpt-4o`, `gpt-4o-mini`, `o1`)
- **Anthropic Claude family** (e.g. `claude-3-5-sonnet`, `claude-3-5-haiku`, `claude-3-opus`)
- **Google Gemini family** (e.g. `gemini-1.5-pro`, `gemini-1.5-flash`, `gemini-2.0-flash`)
- **xAI Grok family** (e.g. `grok-2`, `grok-beta`)
- **DeepSeek family** (e.g. `deepseek-chat`, `deepseek-reasoner`)

Pricing calculations support cached input discounts. Pricing details and context windows are maintained in [src/pricing.js](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/src/pricing.js) with references to official documentation and `updatedAt` metadata.

---

## Troubleshooting

**Avatars do not appear**
- Check that hooks are registered in `~/.claude/settings.json` (for Claude mode).
- Verify the hook server is up: `curl http://localhost:47821/hook` (should return 404 for GET, 200 for valid POST).

**Ghost avatars persist**
- Restart the watcher so future hook payloads include a stable `source` (e.g. `"source": "custom-watcher"`).
- Make sure session IDs are allowlisted in `watcher-allowlist.json` or `name-map.json` so they are not treated as zombie sessions.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

- **Source code:** [MIT License](LICENSE)
- **Art assets** (`public/characters/`, `public/office/`): [Custom restrictive license](LICENSE-ASSETS) — not for redistribution or modification.
