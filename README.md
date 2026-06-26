# Pixel Agent Desk

[中文](readme-i18n/readme_zh-tw.md) [日本語](readme-i18n/readme_ja.md) [한국어](readme-i18n/readme_ko.md) [Tiếng Việt](readme-i18n/readme_vi.md) [Bahasa Indonesia](readme-i18n/readme_id.md) [Español](readme-i18n/readme_es.md) [Français](readme-i18n/readme_fr.md) [Русский](readme-i18n/readme_ru.md)

[![CI](https://github.com/kekukeku/pixel-agent-desk/actions/workflows/test.yml/badge.svg)](https://github.com/kekukeku/pixel-agent-desk/actions/workflows/test.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Electron](https://img.shields.io/badge/Electron-42+-47848F?logo=electron&logoColor=white)](https://www.electronjs.org/)

> A real-time pixel office for your AI coding agents.
> 
> Fork of [Mgpixelart/pixel-agent-desk](https://github.com/Mgpixelart/pixel-agent-desk), maintained independently with extended integrations and dashboard features.

## Of Guardians in the Machine

In the elder tales, no maker worked alone. Each hand at the bench, each eye bent over parchment, was said to be attended by unseen guardians: patient spirits who kept watch at the edge of labour, turning small perils aside before they could break the spell of creation.

The age has changed its lanterns. Parchment has become glass, the scriptorium a glowing terminal, and the faithful companions of the workbench now move in bodies of pixel and code. Pixel Agent Desk gives those companions a room of their own: a little office where your AI coding agents may be seen at their stations, thinking, working, resting, and keeping vigil over the craft in progress.

Open the desk, and let the invisible become visible. When the office fills with five bright guardians or more, perhaps the old promise still holds: that the wish held in that very breath may find its way into form.

*[Read the full prelude](docs/readme-prelude.md) — Of Guardians in the Machine*

Pixel Agent Desk is a standalone Electron app that watches agent lifecycle events and renders active AI sessions as animated pixel characters in a 2D office. It supports five major agent workspaces out of the box:

- **Claude Cowork**
- **Codex**
- **Grok Build**
- **Antigravity**
- **OpenWork**

The app is an observer and visualization layer. It does not dispatch work, assign tasks, or control your agents.

![Demo](docs/demo.gif)

| | | |
|---|---|---|
| ![](docs/screenshot-1.png) | ![](docs/screenshot-2.png) | ![](docs/screenshot-4.png) |
| ![](docs/screenshot-5.png) | | |

## Highlights

- **Standalone Observer** — PAD runs independently as an observer for GUI and TUI agent workspaces.
- **Pixel Office** — A 2D virtual office where active agents appear as animated pixel characters driven by lifecycle events.
- **System Roster** — Live dashboard cards displaying agent status, active tools, sources, token usage, and metered cost when available.
- **Five Optional Integrations** — Claude Cowork, Codex, Grok Build, Antigravity, and OpenWork, with OpenCode compatibility through the OpenWork core.
- **Token & Cost Analytics** — Shows token visibility for supported agents except Antigravity, and estimates cost only when reliable pricing data is available.
- **Activity Mesh & GroupChat Review** — Access historical session playbacks and visual heatmap activity matrices.
- **Generic Event API** — Custom external tools can post normalized events via `POST /events/agent`.
- **Auto Recovery** — Safely restores active agent sessions on app restart using verified PIDs or allowance configs.

## Requirements

**To run Pixel Agent Desk:**
- **macOS (recommended):** no separate Node install required — [`Install.command`](Install.command) downloads portable Node.js 22 to `~/.local/node` on first run.

*Note: Agent workspaces are **not** requirements to run the app. Pixel Agent Desk works as an independent observer. Missing platforms will be reported in diagnostics but will never crash or block the dashboard.*

## Quick Start

### macOS — Desktop Startup (Recommended)

1. **First-Time Setup**: Double-click [`Install.command`](Install.command) in the repository root.
   - Downloads official Node.js binaries to `~/.local/node` if you do not already have Node 20+.
   - Runs `npm install` for Pixel Agent Desk dependencies.
   - Requires network access on first run.
2. **Launch the Dashboard**: Double-click [`Start.command`](Start.command).
   - Uses the same Node.js (`~/.local/node` or an existing system Node 20+).
   - Opens the dashboard window via `npm start`.
   - *Gatekeeper Note: If macOS blocks execution, right-click the `.command` file and select **Open**, or run `chmod +x Install.command Start.command` in Terminal.*

### All Platforms — Source Startup

To clone and run from source manually:

```bash
git clone https://github.com/kekukeku/pixel-agent-desk.git
cd pixel-agent-desk
npm install
npm start
```

On launch:
- The Pixel Agent Desk dashboard window opens (showing `{username}'s Office` dynamically matching your OS account profile).
- The local event gateway server starts listening on `127.0.0.1:47821`.
- Configured observers and forwarder integrations register and prepare to receive agent events.

### Diagnostics

To inspect the detection status of your local agent integrations without writing any configuration hooks or starting observers:

```bash
npm run diagnose:integrations
```

## Dashboard Views

The sidebar navigation provides four primary view modes for monitoring and exploring your agent sessions:

| View | Purpose | Details |
|---|---|---|
| **Overview** | Main 2D office canvas & Live Roster | View animated pixel sprites moving and working, alongside real-time agent status cards. Supports PiP (Picture-in-Picture) window. |
| **Activity Mesh** | Interactive heatmap matrix | Displays daily/hourly event frequency and peaks. |
| **GroupChat Review** | Local session replay | Replays recorded multi-agent discussions (`groupchat_*.json`) directly on the 2D visual office canvas. |
| **Metered API Usage** | Token & billing usage dashboard | Displays token counts for supported agents, estimated costs when pricing is reliable, and peak context window usage (CTX%) for Grok Build. |

## Integrations

| Agent | Mechanism | Config / Data Path | Writes Config? | Notes |
|---|---|---|---|---|
| Claude Cowork | Event forwarder | `~/.claude/settings.json` | Yes | Automatically registers PAD-owned hooks; migrates legacy HTTP hooks if present |
| Codex | Read-only JSONL observer | `~/.codex/` | No | Scans session files every ~2s |
| Grok Build | Event forwarder + observer | `~/.grok/hooks/pixel-agent-desk.json` + `~/.grok/sessions/**/signals.json` | Yes | Hook manages lifecycle; observer tracks tokens and CTX% |
| Antigravity | Event forwarder | `~/.gemini/config/hooks.json` | Yes | Integrates forwarder executable directly |
| OpenWork / OpenCode | OpenCode-compatible plugin | `~/.config/opencode/plugins/pad-adapter.js` | Yes | OpenWork is supported through its OpenCode-compatible core |

In packaged builds, helper files are materialized under `~/.pixel-agent-desk/runtime/` to execute forwarders via the Electron binary using `ELECTRON_RUN_AS_NODE=1`. In source development mode, forwarders run directly from the repository source folder.

See [docs/integration-smoke-test.md](docs/integration-smoke-test.md) for a comprehensive integration test guide.

*Important Note: If no agents are active, an **empty virtual office** is normal and does not mean PAD is failing. Animated characters appear only after their respective agents send at least one event (e.g. opening a supported workspace or sending a prompt).*

To disconnect Pixel Agent Desk integrations, remove only the PAD-owned hook/plugin configs or keys:

| Agent | What to remove |
|---|---|
| Claude Cowork | Remove PAD-owned hook entries from `~/.claude/settings.json` |
| Grok Build | Delete `~/.grok/hooks/pixel-agent-desk.json` |
| Antigravity | Remove the `"pixel-agent-desk"` key from `~/.gemini/config/hooks.json` |
| OpenWork / OpenCode | Delete `~/.config/opencode/plugins/pad-adapter.js` |
| Codex | No configuration is written — simply quit PAD to disconnect |

Optional cache (safe to delete; PAD recreates it on next launch):

```text
~/.pixel-agent-desk/runtime/
```

Restart the affected agent workspace after modification to reload the configurations.

## Configuration

Pixel Agent Desk reads optional user configuration from:

```text
~/.pixel-agent-desk/config.json
```

Example:

```json
{
  "integrations": {
    "claude": {
      "enabled": true
    },
    "opencode": {
      "enabled": true
    }
  }
}
```

Current config gates:

- `integrations.claude.enabled: false` skips Claude Cowork hook registration and transcript scanning.
- `integrations.opencode.enabled: false` skips OpenCode plugin registration.

Other integrations are capability-detected and fail open if their platform is not installed.

## Normalized Agent Event API

Custom tools can report activity by sending normalized events to:

```text
POST http://127.0.0.1:47821/events/agent
Content-Type: application/json
```

Example:

```json
{
  "event": "agent.working",
  "agent_id": "custom-session-1",
  "source": "my-custom-agent",
  "name": "Research Agent",
  "project_path": "/path/to/project",
  "model": "gpt-4o",
  "tool": "Bash",
  "parent_id": null,
  "pid": 12345,
  "timestamp": 1781550497208,
  "token_usage": {
    "input_tokens": 1200,
    "cached_input_tokens": 500,
    "output_tokens": 400
  },
  "context_usage": {
    "kind": "snapshot",
    "tokens_used": 50000,
    "window_tokens": 200000,
    "percent": 25
  },
  "metadata": {}
}
```

### Supported Events

- `agent.started` - Registers or refreshes an agent session.
- `agent.thinking` - Shows thinking state and may accumulate token usage.
- `agent.working` - Shows working state and active tool.
- `agent.idle` - Shows resting/idle state.
- `agent.done` - Marks a completed action.
- `agent.error` - Shows error state.
- `agent.help` - Shows permission/help state.
- `agent.removed` - Removes the character from the office.

## Session Recovery and Display Names

Pixel Agent Desk persists active sessions and attempts recovery on restart when the source can be verified safely.

Optional local mapping files:

- `~/.pixel-agent-desk/name-map.json` maps stable session IDs to display names.
- `~/.pixel-agent-desk/watcher-allowlist.json` is a legacy filename used as a recovery allowlist for custom/manual sessions. It is not tied to the removed Python watcher.

Example `name-map.json`:

```json
{
  "codex-main": "Codex",
  "antigravity-ui": "Antigravity"
}
```

## Avatar Customization

Avatar selections are stored locally in browser storage:

```text
localStorage key: pixel-agent-desk.avatarOverrides.v1
```

The value maps stable agent IDs to avatar indices. Selecting "Reset to Default" removes the override.

## Token and Cost Display

Pixel Agent Desk displays resource usage depending on the data provided by the agent:

- **Token-visible agents**: Claude Cowork, Codex, Grok Build, and OpenWork/OpenCode can display token usage when their local event or session data exposes it.
- **Cost-aware agents**: When token usage can be matched to reliable pricing in [src/pricing.js](src/pricing.js), Pixel Agent Desk estimates cost. Otherwise it shows usage without inventing a billing number.
- **Context-aware agents (e.g. Grok Build)**: Displays peak context window percentage (`CTX: N tok` or percentage pressure). Context snapshot values are not accumulated. The daily heatmap records the daily peak context tokens.
- **Antigravity**: Lifecycle visibility is supported, but token detection is not currently available.

See [docs/integration-smoke-test.md](docs/integration-smoke-test.md) §5.3 for Grok CTX verification.

*Note: Ensure `npm start` is closed when validating packaged hooks, as only one PAD instance can bind to the local event server port (`47821`).*

## Advanced: Packaged Build

While running from source is recommended, you can build a standalone packaged app locally:

```bash
npm run dist:mac
```

Then launch:

```text
release/mac/Pixel Agent Desk.app
```

## Debug Log

Pixel Agent Desk writes runtime logs to `debug.log`:

- **From source (`npm start`)**: `src/debug.log` inside the cloned repo
- **Packaged app (macOS)**: `~/Library/Application Support/pixel-agent-desk/debug.log`
- **Packaged app (Windows)**: `%APPDATA%/pixel-agent-desk/debug.log`
- **Packaged app (Linux)**: `~/.config/pixel-agent-desk/debug.log`

Look for `[Processor]` and `[Event]` lines when verifying that agent events are reaching the office.

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---|---|---|
| No characters appear | No agent event has reached PAD yet | Start an agent session once, then check `debug.log` (see Debug Log above) for `[Processor]` lines |
| Empty office (no characters) | Normal state on startup or inactive sessions | Animated characters appear only after their agents send at least one event (e.g. open a supported workspace or send a prompt). Confirm `debug.log` has `[Processor]` events. |
| Diagnostics says Codex `active=false` | Diagnostics is read-only and does not start observers | Use `npm start`; Codex should become active if installed |
| Grok or Antigravity does not appear in packaged app | Hook command still points to an old source path | Restart the packaged app so hooks are refreshed; inspect hook config for `~/.pixel-agent-desk/runtime/forwarders/` |
| Hook command uses `node` in packaged validation | Hook config was generated by the dev app or old version | Close dev PAD, open packaged `.app`, then re-check hook config |
| OpenCode does not appear | Plugin was not installed or OpenCode has not loaded it | Check `~/.config/opencode/plugins/pad-adapter.js`, then restart OpenCode/OpenWork |
| Claude Cowork does not appear | Claude Cowork hooks missing or disabled | Run `npm run diagnose:integrations` and inspect `~/.claude/settings.json` |
| A stale character remains | Persisted session recovery still has a matching ID | Remove stale entries from `name-map.json` or `watcher-allowlist.json`, then restart |

## Development Commands

```bash
npm start                  # Run the Electron app from source
npm test                   # Run the test suite
npm run diagnose:integrations
npm run dist:mac           # Build macOS package
```

## Contributing

See [PR_TEMPLATE.md](PR_TEMPLATE.md) for the expected PR summary, testing notes, and scope verification.

## License

- **Source code:** [MIT License](LICENSE)
- **Art assets** (`public/characters/`, `public/office/`): [Custom restrictive license](LICENSE-ASSETS) - not for redistribution or modification.
