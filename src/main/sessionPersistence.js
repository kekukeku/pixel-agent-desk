/**
 * Session Persistence
 * state.json save/restore — recover active sessions on app restart
 */

const path = require('path');
const os = require('os');
const fs = require('fs');
const { execFileSync } = require('child_process');

function getPersistedStatePath() {
  return path.join(os.homedir(), '.pixel-agent-desk', 'state.json');
}

function getPixelAgentDeskDir() {
  return path.join(os.homedir(), '.pixel-agent-desk');
}


/**
 * User-specific custom watcher allowlist.
 *
 * Supported files:
 * - ~/.pixel-agent-desk/watcher-allowlist.json
 *   - ["GA", "GB"]
 *   - { "sessions": ["GA", "GB"] }
 *   - { "GA": true, "GB": true }
 * - ~/.pixel-agent-desk/name-map.json keys are also allowed, because watcher
 *   scripts commonly keep session ids aligned with display-name mappings.
 */
function getCustomWatcherAllowlist() {
  const allowlist = new Set();
  const configDir = getPixelAgentDeskDir();

  function addFromJsonFile(filename) {
    const filePath = path.join(configDir, filename);
    if (!fs.existsSync(filePath)) return;

    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    if (Array.isArray(parsed)) {
      parsed.forEach(id => { if (typeof id === 'string') allowlist.add(id); });
      return;
    }

    if (!parsed || typeof parsed !== 'object') return;
    if (Array.isArray(parsed.sessions)) {
      parsed.sessions.forEach(id => { if (typeof id === 'string') allowlist.add(id); });
      return;
    }

    for (const [id, enabled] of Object.entries(parsed)) {
      if (enabled && typeof id === 'string') allowlist.add(id);
    }
  }

  try {
    addFromJsonFile('watcher-allowlist.json');
  } catch (e) {
    console.error('[Recover] Error reading watcher-allowlist.json:', e.message);
  }

  try {
    addFromJsonFile('name-map.json');
  } catch (e) {
    console.error('[Recover] Error reading name-map.json for watcher allowlist:', e.message);
  }

  return allowlist;
}

function shouldRecoverAgent(agent, pid, watcherAllowlist) {
  const source = agent.source || '';
  if (source === 'claude-code' || (!source && pid)) {
    // ponytail: a Codex JSONL path is never a valid Claude recovery candidate.
    if (/(^|[/\\])\.codex[/\\]sessions[/\\]/.test(String(agent.jsonlPath || ''))) return false;
    return pid ? isClaudeProcess(pid) : false;
  }

  // Generic/custom sources bypass PID check and recover if in allowlist
  return watcherAllowlist.has(agent.id);
}

/**
 * Check if the PID is an actual Claude Code CLI process
 * Excludes Claude Desktop App (WindowsApps/Claude.app)
 */
function isClaudeProcess(pid) {
  try {
    if (process.platform === 'win32') {
      const result = execFileSync('powershell.exe', [
        '-NoProfile', '-Command',
        `$p = Get-CimInstance Win32_Process -Filter "ProcessId = ${pid}" -ErrorAction SilentlyContinue; if ($p) { "$($p.Name)|$($p.CommandLine)" }`
      ], { timeout: 5000, encoding: 'utf-8' });
      if (!result) return false;
      const lower = result.toLowerCase();
      if (!lower.includes('claude')) return false;
      // Exclude Claude Desktop App (WindowsApps path)
      if (lower.includes('windowsapps')) return false;
      // Only allow Claude Code CLI running via node.exe
      return lower.startsWith('node.exe|');
    } else {
      const result = execFileSync('ps', ['-p', String(pid), '-o', 'command='],
        { timeout: 3000, encoding: 'utf-8' });
      if (!result) return false;
      const lower = result.toLowerCase();
      if (!lower.includes('claude')) return false;
      // Exclude Claude Desktop App (macOS .app bundle)
      if (lower.includes('claude.app')) return false;
      return true;
    }
  } catch (e) {
    return false;
  }
}

function savePersistedState({ agentManager, sessionPids }) {
  if (!agentManager) return;
  const statePath = getPersistedStatePath();
  const dir = path.dirname(statePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const agents = agentManager.getAllAgents();
  const state = {
    agents: agents,
    pids: Array.from(sessionPids.entries())
  };
  const tmpPath = statePath + '.tmp';
  fs.writeFileSync(tmpPath, JSON.stringify(state, null, 2), 'utf-8');
  fs.renameSync(tmpPath, statePath);
}

function recoverExistingSessions({ agentManager, sessionPids, firstPreToolUseDone, debugLog, errorHandler }) {
  if (!agentManager) return;
  const statePath = getPersistedStatePath();

  if (!fs.existsSync(statePath)) {
    debugLog('[Recover] No persisted state found.');
    return;
  }

  try {
    const raw = fs.readFileSync(statePath, 'utf-8');
    const state = JSON.parse(raw);
    const savedAgents = state.agents || [];
    const savedPids = new Map((state.pids || []));
    const watcherAllowlist = getCustomWatcherAllowlist();

    let recoveredCount = 0;
    let skippedCount = 0;
    for (const agent of savedAgents) {
      const pid = savedPids.get(agent.id) || 0;
      if (!shouldRecoverAgent(agent, pid, watcherAllowlist)) {
        skippedCount++;
        debugLog(`[Recover] Skipped stale/non-allowlisted agent: ${agent.id.slice(0, 8)} source=${agent.source || 'unknown'} pid=${pid || 'none'}`);
        continue;
      }

      if (pid) {
        sessionPids.set(agent.id, pid);
      }
      firstPreToolUseDone.set(agent.id, true);

      agentManager.updateAgent({
        sessionId: agent.id,
        projectPath: agent.projectPath,
        displayName: agent.displayName,
        state: agent.state,
        jsonlPath: agent.jsonlPath,
        source: agent.source || null,
        agentType: agent.agentType || null,
        isTeammate: agent.isTeammate,
        isSubagent: agent.isSubagent,
        parentId: agent.parentId
      }, 'recover');

      recoveredCount++;
      debugLog(`[Recover] Restored: ${agent.id.slice(0, 8)} (${agent.displayName}) state=${agent.state} pid=${pid}`);
    }

    debugLog(`[Recover] Done — ${recoveredCount} session(s) restored from state.json, ${skippedCount} skipped`);
  } catch (e) {
    errorHandler.capture(e, {
      code: 'E009',
      category: 'FILE_IO',
      severity: 'WARNING'
    });
    debugLog(`[Recover] Error reading or parsing state.json: ${e.message}`);
  }

  // Reset state.json after recovering agents
  try {
    const tmpPath = statePath + '.tmp';
    fs.writeFileSync(tmpPath, JSON.stringify({ agents: [], pids: [] }, null, 2), 'utf-8');
    fs.renameSync(tmpPath, statePath);
    debugLog('[Recover] state.json reset after recovery');
  } catch (e) { process.stderr.write(`[session-persist] reset error: ${e.message}\n`); }
}

module.exports = {
  savePersistedState,
  recoverExistingSessions,
  getCustomWatcherAllowlist,
  shouldRecoverAgent,
};
