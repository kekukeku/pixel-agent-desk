/**
 * Grok Build Integration
 * Signal source: command-hook forwarder via ~/.grok/hooks/
 * Setup mode: command-hook
 *
 * Uses Phase 5 registration helpers (registerGrokHooks, isGrokHooksRegistered)
 * for detect and ensure, so the capability report reflects the real state.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const {
  registerGrokHooks,
  isGrokHooksRegistered,
} = require('../grokHookRegistration');

function createGrokIntegration(options) {
  const opts = options || {};
  const homeDir = opts.homeDir || os.homedir();
  const forwarderPath = opts.forwarderPath || null;
  const debugLog = opts.debugLog || (() => {});
  const grokDir = path.join(homeDir, '.grok');

  function detectInstalled() {
    try {
      if (fs.existsSync(grokDir)) return true;
      const hooksDir = path.join(grokDir, 'hooks');
      if (fs.existsSync(hooksDir)) return true;
      return false;
    } catch (e) {
      return false;
    }
  }

  function detectIntegrated() {
    try {
      const opts = { homeDir };
      if (forwarderPath) opts.forwarderPath = forwarderPath;
      return isGrokHooksRegistered(opts);
    } catch (e) {
      return false;
    }
  }

  function ensureIntegration() {
    try {
      const opts = { homeDir };
      if (forwarderPath) opts.forwarderPath = forwarderPath;
      const ok = registerGrokHooks(debugLog, opts);
      if (ok) return { status: 'installed' };
      return { status: 'failed', message: 'grok hook registration returned false' };
    } catch (e) {
      return { status: 'failed', message: e.message };
    }
  }

  function start() {
    return { status: 'skipped', message: 'grok start not yet implemented' };
  }

  function stop() {
    return { status: 'skipped', message: 'grok stop not yet implemented' };
  }

  function getHealth() {
    return { active: false, lastEventAt: null, error: null };
  }

  return {
    id: 'grok-build',
    label: 'Grok Build',
    setupMode: 'command-hook',
    detectInstalled,
    detectIntegrated,
    ensureIntegration,
    start,
    stop,
    getHealth,
  };
}

module.exports = createGrokIntegration();

module.exports.createGrokIntegration = createGrokIntegration;
