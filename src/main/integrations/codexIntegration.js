/**
 * Codex Integration
 * Signal source: read-only observer of ~/.codex/sessions/
 * Setup mode: read-only-observer
 *
 * Uses Phase 6 observer and adapter to read Codex session streams.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { createCodexObserver } = require('../codexObserver');

function createCodexIntegration(options) {
  const opts = options || {};
  const homeDir = opts.homeDir || os.homedir();
  const codexDir = path.join(homeDir, '.codex');
  const processAgentEvent = opts.processAgentEvent || null;
  const debugLog = opts.debugLog || (function () {});

  let observer = null;

  function detectInstalled() {
    try {
      if (!fs.existsSync(codexDir)) return false;
      const sessionsDir = path.join(codexDir, 'sessions');
      const sessIndex = path.join(codexDir, 'session_index.jsonl');
      const procMgr = path.join(codexDir, 'process_manager');
      return fs.existsSync(sessionsDir) || fs.existsSync(sessIndex) || fs.existsSync(procMgr);
    } catch (e) {
      return false;
    }
  }

  function detectIntegrated() {
    // read-only observer, no installation needed
    return detectInstalled();
  }

  function ensureIntegration() {
    const installed = detectInstalled();
    if (installed) return { status: 'ready' };
    return { status: 'skipped', message: 'codex not installed' };
  }

  function start() {
    if (!processAgentEvent) {
      return { status: 'skipped', message: 'no processAgentEvent callback provided' };
    }

    if (observer) {
      observer.stop();
    }

    observer = createCodexObserver({
      homeDir,
      processAgentEvent,
      debugLog,
    });

    return observer.start();
  }

  function stop() {
    if (observer) {
      const result = observer.stop();
      observer = null;
      return result;
    }
    return { status: 'stopped' };
  }

  function getHealth() {
    if (observer) {
      return observer.getHealth();
    }
    return { active: false, lastEventAt: null, error: null };
  }

  return {
    id: 'codex',
    label: 'Codex',
    setupMode: 'read-only-observer',
    detectInstalled,
    detectIntegrated,
    ensureIntegration,
    start,
    stop,
    getHealth,
  };
}

module.exports = createCodexIntegration();

module.exports.createCodexIntegration = createCodexIntegration;
