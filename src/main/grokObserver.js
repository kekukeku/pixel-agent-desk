/**
 * Grok Observer
 *
 * Read-only polling observer for Grok Build context usage via signals.json.
 * Does NOT write to ~/.grok or start Grok processes.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const {
  parseActiveSessions,
  parseSignals,
  parseSummary,
  resolveSessionDir,
  mapSignalsToContextEvent,
  contextSnapshotChanged,
} = require('./adapters/grokObserverAdapter');

function resolveGrokHome(homeDir) {
  return process.env.GROK_HOME || path.join(homeDir || os.homedir(), '.grok');
}

function createGrokObserver(options) {
  const opts = options || {};
  const homeDir = opts.homeDir || os.homedir();
  const grokHome = opts.grokHome || resolveGrokHome(homeDir);
  const processAgentEvent = opts.processAgentEvent || (function () {});
  const hasAgent = opts.hasAgent || (function () { return false; });
  const debugLog = opts.debugLog || (function () {});
  const pollIntervalMs = opts.pollIntervalMs || 3000;

  let pollTimer = null;
  let running = false;
  let lastEventAt = null;

  const sessionDirCache = new Map();
  const lastSnapshots = new Map();

  function scan() {
    if (!running) return;

    const activePath = path.join(grokHome, 'active_sessions.json');
    let activeSessions = [];

    try {
      if (fs.existsSync(activePath)) {
        activeSessions = parseActiveSessions(fs.readFileSync(activePath, 'utf-8'));
      }
    } catch (e) {
      debugLog(`[GrokObserver] Failed to read active_sessions.json: ${e.message}`);
      return;
    }

    for (const session of activeSessions) {
      if (!hasAgent(session.sessionId)) {
        continue;
      }

      const sessionDir = resolveSessionDir(
        grokHome,
        session.sessionId,
        session.cwd,
        sessionDirCache
      );

      if (!sessionDir) continue;

      const signalsPath = path.join(sessionDir, 'signals.json');
      let signals;
      try {
        if (!fs.existsSync(signalsPath)) continue;
        signals = parseSignals(fs.readFileSync(signalsPath, 'utf-8'));
      } catch (e) {
        debugLog(`[GrokObserver] Failed to read signals for ${session.sessionId.slice(0, 8)}: ${e.message}`);
        continue;
      }

      if (!signals) continue;

      const summaryPath = path.join(sessionDir, 'summary.json');
      let summaryModel = null;
      try {
        if (fs.existsSync(summaryPath)) {
          summaryModel = parseSummary(fs.readFileSync(summaryPath, 'utf-8'));
        }
      } catch (e) {
        // optional
      }

      if (summaryModel && !signals.primaryModelId) {
        signals.primaryModelId = summaryModel;
      }

      const prev = lastSnapshots.get(session.sessionId);
      if (!contextSnapshotChanged(prev, signals)) {
        continue;
      }

      lastSnapshots.set(session.sessionId, { ...signals });

      const event = mapSignalsToContextEvent(session.sessionId, signals, {
        projectPath: session.cwd,
        model: signals.primaryModelId,
      });

      if (!event) continue;

      try {
        processAgentEvent(event);
        lastEventAt = Date.now();
        debugLog(`[GrokObserver] context ${session.sessionId.slice(0, 8)} → ${signals.percent}%`);
      } catch (e) {
        debugLog(`[GrokObserver] processAgentEvent failed: ${e.message}`);
      }
    }
  }

  function start() {
    if (running) return { status: 'already_running' };
    if (!fs.existsSync(grokHome)) {
      return { status: 'skipped', message: 'grok home not found' };
    }

    running = true;
    lastEventAt = null;
    sessionDirCache.clear();
    lastSnapshots.clear();

    scan();
    pollTimer = setInterval(scan, pollIntervalMs);
    debugLog(`[GrokObserver] Started polling ${grokHome} every ${pollIntervalMs}ms`);
    return { status: 'started' };
  }

  function stop() {
    running = false;
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
    sessionDirCache.clear();
    lastSnapshots.clear();
    debugLog('[GrokObserver] Stopped');
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

module.exports = { createGrokObserver, resolveGrokHome };