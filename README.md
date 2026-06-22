# Pixel Agent Desk

[![CI](https://github.com/Mgpixelart/pixel-agent-desk/actions/workflows/test.yml/badge.svg)](https://github.com/Mgpixelart/pixel-agent-desk/actions/workflows/test.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Electron](https://img.shields.io/badge/Electron-42+-47848F?logo=electron&logoColor=white)](https://www.electronjs.org/)

> A real-time pixel office for your AI coding agents.

Pixel Agent Desk is a standalone Electron app that watches agent lifecycle events and renders active AI sessions as animated pixel characters in a 2D office. It supports five major agent surfaces out of the box:

- **Claude Code**
- **Codex**
- **Grok Build**
- **Antigravity**
- **OpenWork / OpenCode**

The app is an observer and visualization layer. It does not dispatch work, assign tasks, or control your agents.

![Demo](docs/demo.gif)

| | | |
|---|---|---|
| ![](docs/screenshot-1.png) | ![](docs/screenshot-2.png) | ![](docs/screenshot-4.png) |
| ![](docs/screenshot-5.png) | | |

## Highlights

- **Pixel Avatars** - Each agent session gets a sprite character with state-driven animations.
- **Virtual Office** - A 2D pixel art office where characters idle, think, and work.
- **System Roster** - Live cards for active agents, tools, status, source, and metered usage when available.
- **Five-Agent Integration** - Claude Code, Codex, Grok Build, Antigravity, and OpenWork / OpenCode.
- **Packaged Runtime Hooks** - Packaged builds materialize forwarders into `~/.pixel-agent-desk/runtime/` and run them through the app executable.
- **Activity and Usage Views** - Session activity, heatmaps, and token/cost analytics when providers expose token data.
- **Auto Recovery** - Active sessions can be restored after app restart when their source supports reliable recovery.
- **Generic Event API** - Custom tools can POST normalized agent events into the same office.

## Requirements

For source/development use:

- **Node.js** 20 or later
- **npm**
- **macOS, Windows, or Linux**

For the packaged app, launch the installed app directly. Hook forwarders in packaged mode use the Pixel Agent Desk executable with `ELECTRON_RUN_AS_NODE=1`, so Grok and Antigravity hooks do not depend on a globally available `node` binary.

Each agent integration is optional. Pixel Agent Desk will report missing platforms without failing startup.

## Quick Start

### From Source

```bash
git clone https://github.com/Mgpixelart/pixel-agent-desk.git
cd pixel-agent-desk
npm install
npm start
```

`npm start` opens the Pixel Agent Desk dashboard window. It also starts the local event server on `127.0.0.1:47821`, registers configured hooks/plugins, and starts the Codex observer.

### Packaged App

Build a local packaged app:

```bash
npm run dist:mac
```

Then open:

```text
release/mac/Pixel Agent Desk.app
```

Do not run `npm start` at the same time when validating packaged hooks. Only one Pixel Agent Desk instance should own the local event server.

### Diagnostics

Run a read-only integration report:

```bash
npm run diagnose:integrations
```

Diagnostics never writes hook config and never starts observers. Codex may show `active=false` here even though it becomes `active=true` during `npm start`.

## Integrations

| Agent | Mechanism | Config / Data Path | Writes Config? |
|---|---|---|---|
| Claude Code | HTTP hooks | `~/.claude/settings.json` | Yes |
| Codex | Read-only JSONL observer | `~/.codex/sessions/` | No |
| Grok Build | Command-hook forwarder | `~/.grok/hooks/pixel-agent-desk.json` | Yes |
| Antigravity | Command-hook forwarder | `~/.gemini/config/hooks.json` | Yes |
| OpenWork / OpenCode | OpenCode plugin | `~/.config/opencode/plugins/pad-adapter.js` | Yes |

The packaged app also materializes runtime helper files here:

```text
~/.pixel-agent-desk/runtime/
  forwarders/
    grok-forwarder.js
    antigravity-forwarder.js
  main/adapters/
    grokHookAdapter.js
    antigravityHookAdapter.js
  adapters/
    opencode-plugin.js
```

See [docs/integration-smoke-test.md](docs/integration-smoke-test.md) for a complete smoke-test guide.

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

- `integrations.claude.enabled: false` skips Claude hook registration and Claude transcript scanning.
- `integrations.opencode.enabled: false` skips OpenCode plugin registration.

Other integrations are capability-detected and fail open if their platform is not installed.

## Normalized Agent Event API

Custom tools can report activity by sending normalized events to:

```text
POST http://localhost:47821/events/agent
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

When an agent reports token usage, Pixel Agent Desk displays usage and estimated cost based on [src/pricing.js](src/pricing.js).

Agents that do not expose reliable metered usage show:

- `Usage unavailable`
- `Cost: N/A`
- disabled context window indicators

This avoids misleading zero-cost displays for subscription or TUI-based agents.

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---|---|---|
| No characters appear | No agent event has reached PAD yet | Start an agent session and check `src/debug.log` for `[Processor]` lines |
| Diagnostics says Codex `active=false` | Diagnostics is read-only and does not start observers | Use `npm start`; Codex should become active if installed |
| Grok or Antigravity does not appear in packaged app | Hook command still points to an old source path | Restart the packaged app so hooks are refreshed; inspect hook config for `~/.pixel-agent-desk/runtime/forwarders/` |
| Hook command uses `node` in packaged validation | Hook config was generated by the dev app or old version | Close dev PAD, open packaged `.app`, then re-check hook config |
| OpenCode does not appear | Plugin was not installed or OpenCode has not loaded it | Check `~/.config/opencode/plugins/pad-adapter.js`, then restart OpenCode/OpenWork |
| Claude does not appear | Claude hooks missing or disabled | Run `npm run diagnose:integrations` and inspect `~/.claude/settings.json` |
| A stale character remains | Persisted session recovery still has a matching ID | Remove stale entries from `name-map.json` or the recovery allowlist, then restart |

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
