/**
 * Codex Observer
 *
 * Polling-based read-only observer for Codex session data.
 * Scans ~/.codex/sessions/** /*.jsonl for new activity and emits
 * normalized agent events via the provided processAgentEvent callback.
 *
 * Does NOT start external Codex commands, does NOT write to ~/.codex.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const {
  safeParse,
  parseSessionIndex,
  parseChatProcesses,
  mapCodexRecordToAgentEvent,
  resolveDisplayName,
  getSessionId,
} = require('./adapters/codexObserverAdapter');

function createCodexObserver(options) {
  const opts = options || {};
  const homeDir = opts.homeDir || os.homedir();
  const codexDir = path.join(homeDir, '.codex');
  const sessionsDir = path.join(codexDir, 'sessions');
  const sessionIndexPath = path.join(codexDir, 'session_index.jsonl');
  const chatProcessesPath = path.join(codexDir, 'process_manager', 'chat_processes.json');
  const globalStatePath = path.join(codexDir, '.codex-global-state.json');

  const processAgentEvent = opts.processAgentEvent || (function () {});
  const debugLog = opts.debugLog || (function () {});
  const pollIntervalMs = opts.pollIntervalMs || 2000;
  const quietMs = opts.quietMs || 60000;
  const staleMs = opts.staleMs || 600000;
  const chatProcessFreshMs = opts.chatProcessFreshMs || 2 * 60 * 1000;
  const replayExisting = opts.replayExisting !== false;

  let pollTimer = null;
  let running = false;
  let lastEventAt = null;
  let initialScan = true;
  let observerStartedAt = 0;

  // 記錄每個 session 最後一次看到的檔案 offset，避免重放
  const sessionOffsets = new Map();

  // 記錄每個 session 最後一次活動時間
  const sessionActivity = new Map();

  // 記錄 session 是否已處於 idle（防止重複 emit）
  const sessionIdle = new Map();

  // sessionIndex cache
  let sessionIndex = new Map();

  // session metadata cache（跨 poll 保留，避免增量輪次遺失 cwd/model）
  const sessionMetaMap = new Map();

  // 記錄已 emit 過的 chat_processes 活動 key，避免每輪 poll 重複 emit
  const chatProcessSeen = new Map();

  // Codex Desktop keeps currently open workspaces in global state. This is the
  // safest signal for an idle "Codex is open here" avatar.
  const activeWorkspaceAgents = new Map();

  function loadSessionIndex() {
    try {
      if (fs.existsSync(sessionIndexPath)) {
        const content = fs.readFileSync(sessionIndexPath, 'utf-8');
        sessionIndex = parseSessionIndex(content);
      }
    } catch (e) {
      debugLog(`[CodexObserver] Failed to read session_index: ${e.message}`);
    }
  }

  function walkDir(dir) {
    const results = [];
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          for (const sub of walkDir(fullPath)) {
            results.push(sub);
          }
        } else if (entry.isFile() && entry.name.endsWith('.jsonl')) {
          results.push(fullPath);
        }
      }
    } catch (e) {
      // skip unreadable dirs
    }
    return results;
  }

  function findSessionJsonls() {
    try {
      if (!fs.existsSync(sessionsDir)) return [];
      return walkDir(sessionsDir);
    } catch (e) {
      debugLog(`[CodexObserver] Failed to scan sessions: ${e.message}`);
      return [];
    }
  }

  function readActiveWorkspaceRoots() {
    try {
      if (!fs.existsSync(globalStatePath)) return [];
      const raw = fs.readFileSync(globalStatePath, 'utf-8');
      const parsed = safeParse(raw);
      const roots = parsed && parsed['active-workspace-roots'];
      return Array.isArray(roots) ? roots.filter(Boolean) : [];
    } catch (e) {
      debugLog(`[CodexObserver] Failed to read global state: ${e.message}`);
      return [];
    }
  }

  function workspaceAgentId(workspaceRoot) {
    return `codex-workspace:${Buffer.from(workspaceRoot).toString('base64url')}`;
  }

  function emitActiveWorkspaceAgents() {
    const roots = readActiveWorkspaceRoots();
    const current = new Set(roots);
    const now = Date.now();

    for (const root of roots) {
      if (activeWorkspaceAgents.has(root)) continue;

      const agentId = workspaceAgentId(root);
      activeWorkspaceAgents.set(root, agentId);
      processAgentEvent({
        event: 'agent.started',
        agent_id: agentId,
        source: 'codex',
        name: 'Codex',
        project_path: root,
        timestamp: now,
        metadata: {
          observer_source: 'active-workspace-roots',
        },
      });
      processAgentEvent({
        event: 'agent.idle',
        agent_id: agentId,
        source: 'codex',
        timestamp: now,
      });
      lastEventAt = now;
      sessionActivity.set(agentId, now);
      sessionIdle.set(agentId, true);
    }

    for (const [root, agentId] of activeWorkspaceAgents) {
      if (current.has(root)) continue;
      processAgentEvent({
        event: 'agent.removed',
        agent_id: agentId,
        source: 'codex',
        timestamp: now,
      });
      activeWorkspaceAgents.delete(root);
      sessionActivity.delete(agentId);
      sessionIdle.delete(agentId);
    }
  }

  function sessionIdFromFilePath(filePath) {
    const base = path.basename(filePath, '.jsonl');
    const match = base.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i);
    if (match) return match[1];
    return path.basename(path.dirname(filePath));
  }

  function isPidAlive(pid) {
    if (!pid || typeof pid !== 'number') return false;
    try {
      process.kill(pid, 0);
      return true;
    } catch (e) {
      return false;
    }
  }

  function isFreshChatProcess(proc, now) {
    if (isPidAlive(proc.pid)) return true;
    const ts = proc.updatedAtMs || proc.startedAtMs || 0;
    if (!ts) return false;
    return now - ts <= chatProcessFreshMs;
  }

  function readNewLines(filePath, sessionId) {
    try {
      const stat = fs.statSync(filePath);
      const mtimeMs = stat.mtimeMs;
      const size = stat.size;

      const prev = sessionOffsets.get(filePath);
      let startOffset = 0;

      if (prev) {
        // If the file was modified since last read, read from last known offset
        if (mtimeMs > prev.mtimeMs || size !== prev.size) {
          startOffset = prev.offset;
        } else {
          return []; // no changes
        }
      }

      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');
      const records = [];

      let currentOffset = 0;
      for (const line of lines) {
        currentOffset += Buffer.byteLength(line, 'utf-8') + 1; // +1 for \n
        if (currentOffset <= startOffset) continue;

        const record = safeParse(line);
        if (record) records.push(record);
      }

      // Update offset tracking
      sessionOffsets.set(filePath, { offset: size, mtimeMs: mtimeMs, size });

      return records;
    } catch (e) {
      debugLog(`[CodexObserver] Failed to read ${filePath}: ${e.message}`);
      return [];
    }
  }

  function scan() {
    try {
      loadSessionIndex();
      emitActiveWorkspaceAgents();

      const jsonlFiles = findSessionJsonls();

      for (const filePath of jsonlFiles) {
        const fallbackSessionId = sessionIdFromFilePath(filePath);
        const records = readNewLines(filePath, fallbackSessionId);

        for (const record of records) {
          const sid = getSessionId(record, fallbackSessionId);
          const agentEvent = mapCodexRecordToAgentEvent(record, {
            sessionIndex,
            sessionMetaMap,  // persistent: survives across poll cycles
            fallbackSessionId,
          });

          if (agentEvent && (replayExisting || !initialScan)) {
            processAgentEvent(agentEvent);
            lastEventAt = Date.now();
            sessionActivity.set(sid, lastEventAt);

            // Any new working/thinking event clears the idle flag so
            // a subsequent quiet period can re-emit idle once.
            if (agentEvent.event === 'agent.working' || agentEvent.event === 'agent.thinking') {
              sessionIdle.delete(sid);
            }
          }
        }
      }

      // Scan chat_processes.json for active process/command activity
      try {
        if (fs.existsSync(chatProcessesPath)) {
          const raw = fs.readFileSync(chatProcessesPath, 'utf-8');
          const processes = parseChatProcesses(raw);
          const now = Date.now();

          for (const proc of processes) {
            const sid = proc.session_id;
            const ts = proc.updatedAtMs || proc.startedAtMs || Date.now();

            // chat_processes.json is an activity ledger, not just live tools.
            // Only recent entries (or still-live PIDs) should move Codex to
            // Working, otherwise historical commands spawn stale avatars.
            if (!isFreshChatProcess(proc, now)) continue;

            // Build a stable dedupe key without Date.now() for absent timestamps
            const dedupeKey = [
              sid,
              proc.updatedAtMs || proc.startedAtMs || '',
              proc.processId || proc.turnId || proc.itemId || '',
              proc.command || '',
            ].join('::');
            if (chatProcessSeen.has(dedupeKey)) continue;
            chatProcessSeen.set(dedupeKey, true);
            if (!replayExisting && initialScan && ts < observerStartedAt) continue;

            // Resolve name/project_path: session meta → session index → proc.chatTitle/cwd
            const meta = sessionMetaMap.get(sid);
            const indexEntry = sessionIndex.get(sid);
            let name = resolveDisplayName(meta, indexEntry);
            if (name === 'Codex' && proc.chatTitle) name = proc.chatTitle;

            const projectPath = (meta && meta.cwd) || (indexEntry && indexEntry.cwd) || proc.cwd || '';

            const agentEvent = {
              event: 'agent.working',
              agent_id: sid,
              source: 'codex',
              name,
              project_path: projectPath,
              tool: proc.command || null,
              pid: proc.pid || undefined,
              timestamp: ts,
            };

            processAgentEvent(agentEvent);
            lastEventAt = Date.now();
            sessionActivity.set(sid, lastEventAt);
            sessionIdle.delete(sid);
          }
        }
      } catch (e) {
        debugLog(`[CodexObserver] Failed to read chat_processes: ${e.message}`);
      }

      // Quiet / stale detection
      const now = Date.now();
      for (const [sid, activity] of sessionActivity) {
        const elapsed = now - activity;
        if (elapsed >= staleMs) {
          processAgentEvent({
            event: 'agent.removed',
            agent_id: sid,
            source: 'codex',
            timestamp: now,
          });
          sessionActivity.delete(sid);
          sessionIdle.delete(sid);
        } else if (elapsed >= quietMs && !sessionIdle.has(sid)) {
          sessionIdle.set(sid, true);
          processAgentEvent({
            event: 'agent.idle',
            agent_id: sid,
            source: 'codex',
            timestamp: now,
          });
        }
      }
      initialScan = false;
    } catch (e) {
      debugLog(`[CodexObserver] Scan error: ${e.message}`);
      initialScan = false;
    }
  }

  function start() {
    if (running) return { status: 'already_running' };
    running = true;
    lastEventAt = null;
    initialScan = true;
    observerStartedAt = Date.now();
    sessionActivity.clear();
    sessionIdle.clear();
    sessionMetaMap.clear();
    chatProcessSeen.clear();
    activeWorkspaceAgents.clear();

    // Initial scan immediately
    scan();

    pollTimer = setInterval(scan, pollIntervalMs);
    debugLog(`[CodexObserver] Started polling every ${pollIntervalMs}ms`);
    return { status: 'started' };
  }

  function stop() {
    running = false;
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
    sessionOffsets.clear();
    sessionActivity.clear();
    sessionIdle.clear();
    sessionMetaMap.clear();
    chatProcessSeen.clear();
    activeWorkspaceAgents.clear();
    sessionIndex.clear();
    debugLog('[CodexObserver] Stopped');
    return { status: 'stopped' };
  }

  function getHealth() {
    return {
      active: running,
      lastEventAt,
      error: null,
    };
  }

  return { start, stop, getHealth };
}

module.exports = { createCodexObserver };
