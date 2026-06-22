# Integration Smoke Test Guide

Pixel Agent Desk supports five AI agent platforms. This guide documents how to verify each one, how to read the diagnostic output, and where hook/config files are written.

---

## 1. Five-Agent Support Overview

| Adapter | Mechanism | Config File | Event Ingest | Observer/Start |
|---|---|---|---|---|
| **Claude Code** | Legacy HTTP hook | `~/.claude/settings.json` | POST `/hook` | Event-driven (hook) |
| **Codex** | Read-only observer | `~/.codex/sessions/` | `POST /events/agent` (from observer) | Polling every 2s |
| **Grok Build** | Command-hook forwarder | `~/.grok/hooks/pixel-agent-desk.json` | `POST /events/agent` (from forwarder) | Event-driven (hook) |
| **Antigravity** | Command-hook forwarder | `~/.gemini/config/hooks.json` | `POST /events/agent` (from forwarder) | Event-driven (hook) |
| **OpenWork / OpenCode** | OpenCode plugin | `~/.config/opencode/plugins/pad-adapter.js` | `POST /events/agent` (from plugin) | Event-driven (plugin) |

---

## 2. Quick Diagnostics

Run the read-only diagnostics command — it does NOT write any config files or start observers:

```bash
npm run diagnose:integrations
```

Example output:

```
Pixel Agent Desk Integration Diagnostics
Config:
  - claude enabled=true
  - opencode enabled=true

[IntegrationManager] 5 adapters registered. Capability report:
  - Claude Code: installed=true integrated=true active=false setupMode=legacy-http-hook
  - Codex: installed=true integrated=true active=false setupMode=read-only-observer
  - Grok Build: installed=true integrated=true active=false setupMode=command-hook
  - Antigravity: installed=true integrated=true active=false setupMode=command-hook
  - OpenWork / OpenCode: installed=true integrated=true active=false setupMode=opencode-plugin
```

For JSON output:

```bash
npm run diagnose:integrations -- --json
```

---

## 3. Reading the Capability Report

### Field meanings

| Field | Meaning |
|---|---|
| `installed` | Agent platform appears to be present on the machine (e.g. `~/.codex` exists, `~/.claude` exists) |
| `integrated` | PAD's hook/plugin/observer setup is in place (e.g. Claude hooks in `settings.json`, Grok hook file exists) |
| `active` | The adapter's observer/forwarder is currently running (Codex: polling, others: event-driven so usually `false`) |
| `setupMode` | How PAD connects to this agent |
| `error` | Only present when something went wrong during detection — non-null means diagnostic failure |

### Diagnostics vs `npm start`

| | `diagnose:integrations` | `npm start` |
|---|---|---|
| `ensureAll()` | No | Yes |
| `startAll()` | No | Yes |
| Writes config | Never | May update hooks/plugins |
| Codex `active` | `false` | `true` (if installed) |

This means **Codex `active=false` in diagnostics is expected** — the diagnostic intentionally does not start the observer.

---

## 4. Per-Agent Capability Report (Live Smoke, 2026-06-23)

| Agent | installed | integrated | active (diagnostics) | active (npm start) | setupMode |
|---|---|---|---|---|---|
| Claude Code | true | true | false | false | legacy-http-hook |
| Codex | true | true | false | **true** | read-only-observer |
| Grok Build | true | true | false | false | command-hook |
| Antigravity | true | true | false | false | command-hook |
| OpenWork / OpenCode | true | true | false | false | opencode-plugin |

---

## 5. Per-Agent Manual Smoke Test

### 5.1 Claude Code

**Setup check**: `~/.claude/settings.json` should have PAD HTTP hooks under `hooks` key. User's existing hooks, permissions, and settings are preserved.

**Smoke test**:
1. Open a Claude Code session in any project.
2. Trigger a prompt or tool (e.g. `Bash: ls`).
3. Verify in `debug.log`: `[Hook] ← PreToolUse`, then `[Processor] ← agent.working`.
4. PAD GUI should show a Claude Code character with the project name.

**Naming**: Character name is the project directory basename.

**Common issues**:
- `InstructionsLoaded` is mapped to `agent.thinking` — not dropped.
- Hooks are registered in `~/.claude/settings.json` at first PAD startup (or via `npm install`).

---

### 5.2 Codex

**Setup check**: `~/.codex/sessions/` directory with JSONL files, `~/.codex/session_index.jsonl`.

**Smoke test**:
1. Open a Codex session.
2. Wait for PAD observer poll (every 2s).
3. Verify `debug.log`: `[Processor] ← agent.started`.
4. Trigger a tool/command (e.g. `ExecuteCommand`).
5. Verify state changes: working → thinking → idle.

**Naming**: Uses thread name from session_index, or project basename. Will NOT hardcode to `Codex` unless no better name is available.

**Common issues**:
- Observer uses recursive directory scan (`sessions/**/*.jsonl`).
- Quiet timeout (60s) emits `agent.idle` only once.
- Stale timeout (10min) emits `agent.removed`.

---

### 5.3 Grok Build

**Setup check**: `~/.grok/hooks/pixel-agent-desk.json` exists with `_pad` marker, contains lifecycle hooks for 10 events.

**Smoke test**:
1. Open a Grok Build session.
2. Trigger a tool (e.g. `Read`, `Bash`).
3. PAD receives events via the forwarder → `POST /events/agent`.

**Key design**:
- Uses **command hooks**, NOT HTTP localhost hooks (avoids Grok's HTTPS requirement).
- In development, hooks may run as: `node "<path>/grok-forwarder.js" <eventName>`.
- In packaged builds, hooks run through the app executable:
  `ELECTRON_RUN_AS_NODE=1 "<Pixel Agent Desk executable>" "$HOME/.pixel-agent-desk/runtime/forwarders/grok-forwarder.js" <eventName>`.
- Fail-open: forwarder always exits 0, never blocks Grok.

---

### 5.4 Antigravity

**Setup check**: `~/.gemini/config/hooks.json` has `"pixel-agent-desk"` key. User's existing hook keys are preserved.

**Smoke test**:
1. Open an Antigravity session.
2. Trigger a tool.
3. Verify `debug.log`: `[Event] ← agent.working` with `source: antigravity`.

**Key design**:
- Lifecycle events (PreInvocation, Stop): bare command, no matcher.
- Tool events (PreToolUse, PostToolUse): `matcher: "*"`.
- All commands include event name as argv.
- In development, hooks may run as: `node "<fwd.js>" PreToolUse`.
- In packaged builds, hooks run through the app executable:
  `ELECTRON_RUN_AS_NODE=1 "<Pixel Agent Desk executable>" "$HOME/.pixel-agent-desk/runtime/forwarders/antigravity-forwarder.js" PreToolUse`.
- Forwarder fail-open: exits 0 on any error.

---

### 5.5 OpenWork / OpenCode

**Setup check**: `~/.config/opencode/plugins/pad-adapter.js` exists (copied from PAD source).

**Smoke test**:
1. Open an OpenWork or OpenCode session.
2. Send a user message — character should show `agent.thinking`.
3. Trigger a tool call — character should show `agent.working` with tool name.
4. After completion — character returns to `agent.thinking` or `agent.idle`.

**Key fixes in Phase 3**:
- `session.idle` → `agent.idle` (was incorrectly mapped to `agent.thinking`).
- `session.deleted` and `session.ended` both → `agent.removed`.
- `message.created role=user` → `agent.thinking`.
- Step-finish token usage forwarded to PAD.

---

## 6. Common Questions

### Q: Why is Codex `active=false` in diagnostics but `active=true` in `npm start`?
A: Diagnostics runs `detectAll()` only — it checks capability without starting anything. `npm start` calls `startAll()`, which starts the Codex observer (polling every 2s).

### Q: Why does a disabled adapter not appear in the report?
A: If `config.json` has `integrations.claude.enabled: false`, the Claude adapter is never registered, so it won't appear in the diagnostic. This is correct behavior.

### Q: `installed=false` — is this an error?
A: No. It just means the agent platform doesn't appear to be installed on this machine (e.g. `~/.codex` directory doesn't exist). The diagnostic exit code is only `1` when `error` is non-null.

### Q: Where are hook/config files written?
A: Each adapter writes to a specific path:
- Claude: `~/.claude/settings.json`
- Codex: **read-only** — no writes
- Grok: `~/.grok/hooks/pixel-agent-desk.json`
- Antigravity: `~/.gemini/config/hooks.json` (adds `pixel-agent-desk` key only)
- OpenCode: `~/.config/opencode/plugins/pad-adapter.js`

Packaged builds also materialize runtime files under:

```text
~/.pixel-agent-desk/runtime/
```

Grok and Antigravity hook commands should point to `runtime/forwarders/` in packaged validation, not to repo `src/forwarders/`.

### Q: A character doesn't appear. What should I check first?
A: Check `src/debug.log`:
1. Look for `[IntegrationManager]` capability report — are all adapters registered?
2. Look for `[Processor] ← agent.started` — did the event reach PAD?
3. For Codex: check `[CodexObserver]` lines — is the observer scanning sessions?
4. For hook-based adapters: check `[Hook] ←` or `[Event] ←` — did the hook fire?
5. If no events arrive: check the agent's hook config file exists and has the correct structure.

---

## 7. Packaged App Smoke Gate

Use this when validating a release build.

1. Commit source changes first.
2. Run `npm run dist:mac`.
3. Close all development Pixel Agent Desk instances.
4. Open only `release/mac/Pixel Agent Desk.app`.
5. Inspect hook config:
   - `~/.grok/hooks/pixel-agent-desk.json`
   - `~/.gemini/config/hooks.json`
6. Confirm commands contain:
   - `ELECTRON_RUN_AS_NODE=1`
   - `~/.pixel-agent-desk/runtime/forwarders/`
   - no repo `src/forwarders/` path
7. Pipe-test both forwarders while the packaged app is running.

Antigravity example:

```bash
echo '{"conversationId":"packaged-smoke-antigravity","workspacePaths":["/tmp/packaged-test"],"event":"PreInvocation"}' \
  | ELECTRON_RUN_AS_NODE=1 "./release/mac/Pixel Agent Desk.app/Contents/MacOS/Pixel Agent Desk" \
    "$HOME/.pixel-agent-desk/runtime/forwarders/antigravity-forwarder.js" PreInvocation
```

Grok example:

```bash
echo '{"hookEventName":"SessionStart","sessionId":"packaged-smoke-grok","workspaceRoot":"/tmp/packaged-test"}' \
  | ELECTRON_RUN_AS_NODE=1 "./release/mac/Pixel Agent Desk.app/Contents/MacOS/Pixel Agent Desk" \
    "$HOME/.pixel-agent-desk/runtime/forwarders/grok-forwarder.js" SessionStart
```

Both commands should exit `0`, avoid stdout/stderr noise, and produce `[Processor]` events in PAD logs.
