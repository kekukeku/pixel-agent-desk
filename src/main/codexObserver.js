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
} = require('./adapters/codexObserverAdapter');

function createCodexObserver(options) {
  const opts = options || {};
  const homeDir = opts.homeDir || os.homedir();
  const codexDir = path.join(homeDir, '.codex');
  const sessionsDir = path.join(codexDir, 'sessions');
  const sessionIndexPath = path.join(codexDir, 'session_index.jsonl');
  const chatProcessesPath = path.join(codexDir, 'process_manager', 'chat_processes.json');

  const processAgentEvent = opts.processAgentEvent || (function () {});
  const debugLog = opts.debugLog || (function () {});
  const pollIntervalMs = opts.pollIntervalMs || 2000;
  const quietMs = opts.quietMs || 60000;
  const staleMs = opts.staleMs || 600000;

  let pollTimer = null;
  let running = false;
  let lastEventAt = null;

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

  function findSessionJsonls() {
    try {
      if (!fs.existsSync(sessionsDir)) return [];

      const entries = fs.readdirSync(sessionsDir, { withFileTypes: true });
      const files = [];

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const sessionDir = path.join(sessionsDir, entry.name);
        try {
          const dirFiles = fs.readdirSync(sessionDir);
          for (const f of dirFiles) {
            if (f.endsWith('.jsonl')) {
              files.push(path.join(sessionDir, f));
            }
          }
        } catch (e) {
          // skip unreadable dirs
        }
      }

      return files;
    } catch (e) {
      debugLog(`[CodexObserver] Failed to scan sessions: ${e.message}`);
      return [];
    }
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

      const jsonlFiles = findSessionJsonls();

      for (const filePath of jsonlFiles) {
        // Derive a session id from the file path (parent dir name is usually session id)
        const sessionDirName = path.basename(path.dirname(filePath));
        const records = readNewLines(filePath, sessionDirName);

        for (const record of records) {
          const sid = record.session_id || record.sessionId || sessionDirName;
          const agentEvent = mapCodexRecordToAgentEvent(record, {
            sessionIndex,
            sessionMetaMap,  // persistent: survives across poll cycles
          });

          if (agentEvent) {
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

          for (const proc of processes) {
            const sid = proc.session_id;
            const ts = proc.updatedAtMs || proc.startedAtMs || Date.now();

            // Build a stable dedupe key without Date.now() for absent timestamps
            const dedupeKey = [
              sid,
              proc.updatedAtMs || proc.startedAtMs || '',
              proc.processId || proc.turnId || proc.itemId || '',
              proc.command || '',
            ].join('::');
            if (chatProcessSeen.has(dedupeKey)) continue;
            chatProcessSeen.set(dedupeKey, true);

            // Resolve name/project_path: session meta → session index → proc.chatTitle/cwd
            const meta = sessionMetaMap.get(sid);
            const indexEntry = sessionIndex.get(sid);
            let name = resolveDisplayName(meta, indexEntry);
            if (name === 'Codex' && proc.chatTitle) name = proc.chatTitle;
            if (name === 'Codex' && proc.cwd) name = path.basename(proc.cwd);

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
    } catch (e) {
      debugLog(`[CodexObserver] Scan error: ${e.message}`);
    }
  }

  function start() {
    if (running) return { status: 'already_running' };
    running = true;
    lastEventAt = null;
    sessionActivity.clear();
    sessionIdle.clear();
    sessionMetaMap.clear();
    chatProcessSeen.clear();

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
