/**
 * Claude Code Integration
 * Signal source: command-hook forwarder → POST /hook
 * Setup mode: command-hook
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const {
  getClaudeConfigPath,
  isHookRegistered,
  registerClaudeHooks,
} = require('../hookRegistration');

function createClaudeIntegration(options) {
  const opts = options || {};
  const homeDir = opts.homeDir || os.homedir();
  const forwarderPath = opts.forwarderPath || null;
  const debugLog = opts.debugLog || (() => {});
  const claudeDir = path.join(homeDir, '.claude');

  function registrationOptions() {
    const regOpts = { homeDir };
    if (forwarderPath) regOpts.forwarderPath = forwarderPath;
    return regOpts;
  }

  function detectInstalled() {
    try {
      return fs.existsSync(claudeDir) || fs.existsSync(getClaudeConfigPath({ homeDir }));
    } catch (e) {
      return false;
    }
  }

  function detectIntegrated() {
    try {
      return isHookRegistered(debugLog, registrationOptions());
    } catch (e) {
      return false;
    }
  }

  function ensureIntegration() {
    try {
      const ok = registerClaudeHooks(debugLog, registrationOptions());
      if (ok) return { status: 'installed' };
      return { status: 'failed', message: 'claude hook registration returned false' };
    } catch (e) {
      return { status: 'failed', message: e.message };
    }
  }

  function start() {
    return { status: 'skipped', message: 'claude hooks are event-driven' };
  }

  function stop() {
    return { status: 'skipped', message: 'claude hooks are event-driven' };
  }

  function getHealth() {
    return { active: false, lastEventAt: null, error: null };
  }

  return {
    id: 'claude-code',
    label: 'Claude Code',
    setupMode: 'command-hook',
    detectInstalled,
    detectIntegrated,
    ensureIntegration,
    start,
    stop,
    getHealth,
  };
}

module.exports = createClaudeIntegration();

module.exports.createClaudeIntegration = createClaudeIntegration;
