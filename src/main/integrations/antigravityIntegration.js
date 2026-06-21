/**
 * Antigravity Integration
 * Signal source: command-hook forwarder via ~/.gemini/config/hooks.json
 * Setup mode: command-hook
 *
 * Uses Phase 7 registration helpers for detect and ensure, so the
 * capability report reflects the real installed/integrated state.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const {
  registerAntigravityHooks,
  isAntigravityHooksRegistered,
} = require('../antigravityHookRegistration');

function createAntigravityIntegration(options) {
  const opts = options || {};
  const homeDir = opts.homeDir || os.homedir();
  const forwarderPath = opts.forwarderPath || null;
  const debugLog = opts.debugLog || (() => {});
  const geminiDir = path.join(homeDir, '.gemini');

  function detectInstalled() {
    try {
      if (fs.existsSync(geminiDir)) return true;
      const hooksPath = path.join(geminiDir, 'config', 'hooks.json');
      if (fs.existsSync(hooksPath)) return true;
      return false;
    } catch (e) {
      return false;
    }
  }

  function detectIntegrated() {
    try {
      const regOpts = { homeDir };
      if (forwarderPath) regOpts.forwarderPath = forwarderPath;
      return isAntigravityHooksRegistered(regOpts);
    } catch (e) {
      return false;
    }
  }

  function ensureIntegration() {
    try {
      const regOpts = { homeDir };
      if (forwarderPath) regOpts.forwarderPath = forwarderPath;
      const ok = registerAntigravityHooks(debugLog, regOpts);
      if (ok) return { status: 'installed' };
      return { status: 'failed', message: 'antigravity hook registration returned false' };
    } catch (e) {
      return { status: 'failed', message: e.message };
    }
  }

  function start() {
    return { status: 'skipped', message: 'antigravity start not yet implemented' };
  }

  function stop() {
    return { status: 'skipped', message: 'antigravity stop not yet implemented' };
  }

  function getHealth() {
    return { active: false, lastEventAt: null, error: null };
  }

  return {
    id: 'antigravity',
    label: 'Antigravity',
    setupMode: 'command-hook',
    detectInstalled,
    detectIntegrated,
    ensureIntegration,
    start,
    stop,
    getHealth,
  };
}

module.exports = createAntigravityIntegration();

module.exports.createAntigravityIntegration = createAntigravityIntegration;
