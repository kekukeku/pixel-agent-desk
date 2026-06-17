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

## Repository Watcher

You can run `watcher.py` (written in Python 3) to automatically monitor this repository for task changes, review requests, and review outputs. It performs two duties:
1. **Visual status updates**: reports activity events to the Electron app to animate Codex, Antigravity, and Grok Build characters.
2. **Execution handoff**: runs local trigger or routing commands when tasks change.

Additionally, in active mode, the watcher automatically coordinates a **review-decision final-mile dispatch** after Grok Build publishes `REVIEWS/review_NNN.md`. For `APPROVE` or `REQUEST_CHANGES` decisions, the watcher invokes the configured `review_decision.command` (which defaults to opening an Antigravity follow-up session via `python3 scripts/trigger_antigravity.py --review-decision --task {task_num}`) once the review router writes `REVIEWS/handoff_payload_NNN.json`.

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

  *Alternatively, to run the full local automation loop (which automatically launches the watcher and the reviewer adapter together), run:*
  ```bash
  npm run workflow
  ```

> [!IMPORTANT]
> **Keeping the Local Automation Loop Alive**
> - **Long-Running Process**: `npm run workflow` is a long-running process that must remain active and keep occupying the terminal window for the local automation loop to function. It is **not** a one-shot setup command.
> - **Local Loop Dependency**: The automation loop depends on **both** the repository watcher and the reviewer adapter server running simultaneously. If the shell prompt returns or the process exits, automatic handoffs and reviews will stop.
> - **Reviewer Adapter Health Check**: You can verify that the reviewer adapter is active by visiting its health check endpoint at `http://127.0.0.1:47822/health` while the workflow is running.
> - **Using the Terminal**: If you need to execute other commands while the workflow is running, do not terminate the process or reuse that terminal. Instead, open a new terminal window or tab.


### Operating Modes

The watcher supports two execution modes, controlled by the `execution_mode` config key (or env var override). **The default is `visual-only`** — no commands or webhooks are executed until you explicitly opt in to `active`.

#### 1. Visual-Only Mode (Default)

`"execution_mode": "visual-only"` (or unset)

The watcher posts character state updates to the desktop application and writes fallback JSON payload files to `REVIEWS/` for manual inspection. No commands or webhooks are triggered.

**Fallback payload files written in visual-only mode:**

| Trigger | File written | Condition |
|---|---|---|
| Task `IN_PROGRESS` | `REVIEWS/task_handoff_NNN.json` | `TASKS/task_NNN.md` status changes |
| Registry `UNDER_REVIEW` | `REVIEWS/grok_handoff_NNN.json` | `AGENT_STATE.md` row transitions |

> **Pipeline separation**: `task_handoff_NNN.json` is exclusively owned by the task-execution pipeline (Antigravity). The review-decision router (`route-review-decision.js`) produces `handoff_payload_NNN.json`. These files must never be conflated.

**`task_handoff_NNN.json` payload fields:**

| Field | Type | Description |
|---|---|---|
| `task_num` | string | 3-digit task number (e.g. `"008"`) |
| `branch` | string | Branch associated with the task |
| `project_root` | string | Absolute path of the watched repository |
| `status` | string | `"IN_PROGRESS"` |
| `timestamp` | number | Float epoch timestamp |

**`grok_handoff_NNN.json` payload fields:**

| Field | Type | Description |
|---|---|---|
| `task_num` | string | 3-digit task number |
| `project_root` | string | Absolute path of the watched repository |
| `status` | string | `"UNDER_REVIEW"` |
| `timestamp` | number | Float epoch timestamp |

#### 2. Active Mode

`"execution_mode": "active"`

The watcher dispatches configured commands or webhooks asynchronously via background threads. Each dispatch:
1. Writes the fallback payload file (audit artifact, task-execution pipeline only)
2. Checks an in-session idempotency key — skips if already fired for the same `task:target:trigger:state`
3. Spawns a background thread to run the command (`subprocess` with timeout) or POST the webhook
4. Writes `REVIEWS/dispatch_result_{task_num}_{target}.json` with success/failure details

**If `execution_mode` is `active` but no `command` or `webhook` is configured for a target,** the watcher prints an error to stderr and writes a failed `dispatch_result_*` file. It does **not** silently pass.

**`dispatch_result_NNN_target.json` schema:**

| Field | Type | Description |
|---|---|---|
| `task_num` | string | Task number |
| `target` | string | `"antigravity"` or `"grok"` |
| `trigger` | string | `"task_status"`, `"registry_state"`, or `"review_decision"` |
| `state` | string | State or decision that triggered dispatch |
| `dispatch_key` | string | Idempotency key: `{task_num}:{target}:{trigger}:{state}` |
| `transport` | string | `"command"` or `"webhook"` or `null` |
| `success` | boolean | Whether the dispatch completed successfully |
| `returncode` | integer \| null | Command exit code (`null` for webhooks) |
| `http_status` | integer \| null | HTTP response status (`null` for commands) |
| `timed_out` | boolean | Whether the command exceeded `command_timeout_seconds` |
| `stdout_excerpt` | string | First `output_capture_bytes` of stdout |
| `stderr_excerpt` | string | First `output_capture_bytes` of stderr |
| `error` | string \| null | Exception message on unexpected failure |
| `started_at` | number | Float epoch timestamp of worker start |
| `finished_at` | number | Float epoch timestamp of worker finish |

### Configuration (`~/.pixel-agent-desk/watcher.json`)

```json
{
  "execution_mode": "visual-only",
  "antigravity": {
    "command": "node scripts/run-executor.js {task_num}",
    "webhook": "http://localhost:3000/webhook/antigravity"
  },
  "grok": {
    "command": "node agent-runner/trigger-review.js {task_num}",
    "webhook": null
  },
  "planning": {
    "command": "npm run groupchat:plan -- --session {session_id} --input-file {input_path}",
    "webhook": null
  },
  "review_decision": {
    "command": "python3 scripts/trigger_antigravity.py --review-decision --task {task_num}",
    "webhook": null
  },
  "keep_alive_seconds": 60,
  "command_timeout_seconds": 600,
  "output_capture_bytes": 8192,
  "agents": {
    "codex": {
      "id": "my-codex-id",
      "name": "Custom Codex",
      "type": "planner"
    }
  }
}
```

**Configuration reference:**

| Key | Default | Env override | Description |
|---|---|---|---|
| `execution_mode` | `"visual-only"` | `PIXEL_AGENT_DESK_WATCHER_EXECUTION_MODE` | `"visual-only"` or `"active"` |
| `antigravity.command` | `""` | — | Shell command for Antigravity handoffs; `{task_num}` is replaced at runtime |
| `antigravity.webhook` | `""` | — | HTTP POST URL for Antigravity handoffs (used if command is empty) |
| `grok.command` | `"node agent-runner/trigger-review.js {task_num}"` | — | Shell command for Grok review dispatch |
| `grok.webhook` | `""` | — | HTTP POST URL for Grok dispatch (used if command is empty) |
| `planning.command` | `""` | — | Shell command for consultative planning handoffs; `{session_id}` and `{input_path}` are replaced at runtime |
| `planning.webhook` | `""` | — | HTTP POST URL for consultative planning handoffs (used if command is empty) |
| `review_decision.command` | `"python3 scripts/trigger_antigravity.py --review-decision --task {task_num}"` | — | Shell command for review-decision final-mile dispatches; `{task_num}` is replaced at runtime |
| `review_decision.webhook` | `""` | — | HTTP POST URL for review-decision final-mile dispatches (used if command is empty) |
| `keep_alive_seconds` | `60` | `PIXEL_AGENT_DESK_WATCHER_KEEP_ALIVE` | Periodic `agent.idle` heartbeat interval |
| `command_timeout_seconds` | `600` | `PIXEL_AGENT_DESK_WATCHER_COMMAND_TIMEOUT` | Max seconds before a dispatched command is killed |
| `output_capture_bytes` | `8192` | `PIXEL_AGENT_DESK_WATCHER_OUTPUT_CAPTURE_BYTES` | Max bytes captured from stdout/stderr per dispatch |
| `agents.*.id/name/type` | see defaults | `PIXEL_AGENT_DESK_AGENT_{ROLE}_{FIELD}` | Override per-agent identity (roles: `CODEX`, `ANTIGRAVITY`, `GROK_BUILD`) |

- `{task_num}`: Replaced with the 3-digit task number (e.g. `006`) at dispatch time.
- `{session_id}`: Replaced with the session ID (e.g. `013`) at dispatch time for the planning target.
- `{input_path}`: Replaced with the absolute path to the input trigger file (e.g. the path to `groupchat_request_{session_id}.json` under `PLANNING/`) for the planning target.
- Commands are **always non-blocking** — they run in background threads; the watcher loop continues.
- If both `command` and `webhook` are set, `command` takes precedence.

### Dry-run / Planning Mode (`--simulate-handoff`)

Run without starting the watchdog daemon:

```sh
python3 watcher.py --simulate-handoff [--project-root /path/to/repo]
```

Scans the repository and prints a JSON array of every dispatch that *would* fire given the current file states and configured `execution_mode`. **No files are written, no commands are executed.**

Each entry includes `dispatch_key`, `transport` (`command`/`webhook`/`none`), `would_error_active` (true if mode is active but no consumer configured), and `payload_shape`.

### Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| No commands executed, only JSON files appear in `REVIEWS/` | `execution_mode` is `"visual-only"` (default) | Set `"execution_mode": "active"` in `watcher.json` or `PIXEL_AGENT_DESK_WATCHER_EXECUTION_MODE=active` |
| `Error: execution_mode=active but no command/webhook configured` on stderr | `active` mode enabled but target has no consumer | Add `command` or `webhook` for the failing target in `watcher.json` |
| `dispatch_result_NNN_target.json` shows `"success": false, "timed_out": true` | Command ran longer than `command_timeout_seconds` | Increase `command_timeout_seconds` or optimize the command |
| `task_handoff_NNN.json` is not being updated on review events | Correct — review-decision dispatches only write `dispatch_result_*`; `task_handoff_*` is exclusively for task-status pipeline | Inspect `dispatch_result_NNN_antigravity.json` for review dispatch results |
| Dispatch fires only once per session even after file re-save | Idempotency key deduplicated in-session | Restart the watcher; idempotency resets on start |

**Runtime artifacts** (gitignored, never committed):

```
REVIEWS/task_handoff_*.json      ← visual-only fallback: task-execution pipeline
REVIEWS/grok_handoff_*.json      ← visual-only fallback: review-dispatch pipeline
REVIEWS/dispatch_result_*.json   ← active mode result records (per target per task)
```

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

### Metered API vs. Subscription / TUI Agents

Mainstream API models (like Anthropic Claude, OpenAI GPT, Google Gemini, xAI Grok, etc.) report granular token consumption via hook events. For these agents, the dashboard displays precise metered API token count, estimated cost, and context window utilization.

Subscription-based tools, local TUI-based agents, and other platforms that do not use pay-per-token API endpoints do not expose precise token count metrics. For these agents:
- The dashboard displays **"Usage unavailable"** and **"Cost: N/A"** to prevent misleading zeros.
- The context window indicator shows **`--`** (disabled).
- Overall KPIs for token totals and costs on the dashboard are reframed to highlight live/idle metered activity, excluding non-metered agents from the totals to avoid skewing the averages.

---

## Consultative GroupChat Planning

Pixel Agent Desk features a consultative, multi-agent planning workflow that allows Codex (Planner), Grok Build (Reviewer), and Antigravity (Executor) to participate in a shared, visible planning conversation *before* a task enters the formal execution pipeline. 

### Life Cycle & Workflow Integration
1. **DRAFT Stage**: Codex creates a new task or planning session. Under the hood, the watcher monitors the directory for `DRAFT` status and dispatches the GroupChat runner (Trigger A).
2. **Consultative GroupChat**: The runner initiates a fixed seven-step dialogue to collect suggestions and review points.
3. **Planning Authority**: Codex (小C) maintains the final authority to accept, modify, or reject advice before releasing the task to `IN_PROGRESS` (Trigger B).
4. **Implementation**: Once in `IN_PROGRESS`, Antigravity (小A) performs the actual code changes (Trigger C).
5. **Review**: Moving the task registry to `UNDER_REVIEW` dispatches the formal review checks (Trigger F).

### CLI Usage
You can run the planning runner locally in a deterministic mode to generate plans and mock transcripts:
```bash
npm run groupchat:plan -- --session 001 --input "Implement a new database index for tasks"
```
Options:
- `--session <sessionId>`: The unique numeric string identifier for the planning session.
- `--input <text>`: The initial requirement or objective text.
- `--input-file <path>`: Alternative path to a text file containing requirements.
- `--task <taskNum>`: Optional task number to link this session to a formal task.
- `--force`: Overwrite existing artifacts in the `PLANNING/` directory.

### Generated Artifacts
Every planning session outputs three files inside the `PLANNING/` directory:
- `PLANNING/groupchat_<sessionId>.json`: Structured v1 timeline data for dashboard integration.
- `PLANNING/groupchat_<sessionId>.md`: A human-readable full conversation transcript showing the sequence of proposals and advice.
- `PLANNING/draft_<sessionId>.md`: A clean proposal markdown containing the finalized task specification drafted by Codex.
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
