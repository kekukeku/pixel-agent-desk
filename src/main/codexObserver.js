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
  mapCodexRecordToAgentEvent,
} = require('./adapters/codexObserverAdapter');

function createCodexObserver(options) {
  const opts = options || {};
  const homeDir = opts.homeDir || os.homedir();
  const codexDir = path.join(homeDir, '.codex');
  const sessionsDir = path.join(codexDir, 'sessions');
  const sessionIndexPath = path.join(codexDir, 'session_index.jsonl');

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

  // sessionIndex cache
  let sessionIndex = new Map();

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

        const sessionMetaMap = new Map();

        for (const record of records) {
          const sid = record.session_id || record.sessionId || sessionDirName;
          const agentEvent = mapCodexRecordToAgentEvent(record, {
            sessionIndex,
            sessionMetaMap,
          });

          if (agentEvent) {
            processAgentEvent(agentEvent);
            lastEventAt = Date.now();
            sessionActivity.set(sid, lastEventAt);
          }
        }
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
        } else if (elapsed >= quietMs) {
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
