/**
 * OpenWork / OpenCode Integration
 * Signal source: OpenCode plugin lifecycle events
 * Setup mode: opencode-plugin
 *
 * Uses Phase 3 registration helpers (registerOpenCodePlugin,
 * isOpenCodePluginRegistered) for detect and ensure, so the
 * capability report reflects the real installed/integrated state.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const {
  registerOpenCodePlugin,
  isOpenCodePluginRegistered,
} = require('../opencodePluginRegistration');

function createOpenCodeIntegration(options) {
  const opts = options || {};
  const homeDir = opts.homeDir || os.homedir();
  const sourcePath = opts.sourcePath || path.join(__dirname, '..', '..', 'adapters', 'opencode-plugin.js');
  const debugLog = opts.debugLog || (() => {});
  const opencodeConfigDir = path.join(homeDir, '.config', 'opencode');
  const openWorkConfigDir = path.join(homeDir, 'Library', '.opencode');

  function detectInstalled() {
    try {
      return fs.existsSync(opencodeConfigDir) || fs.existsSync(openWorkConfigDir);
    } catch (e) {
      return false;
    }
  }

  function detectIntegrated() {
    try {
      return isOpenCodePluginRegistered({ homeDir });
    } catch (e) {
      return false;
    }
  }

  function ensureIntegration() {
    try {
      const ok = registerOpenCodePlugin(debugLog, { homeDir, sourcePath });
      if (ok) {
        return { status: 'installed' };
      }
      return { status: 'failed', message: 'plugin registration returned false' };
    } catch (e) {
      return { status: 'failed', message: e.message };
    }
  }

  function start() {
    return { status: 'skipped', message: 'opencode start not yet implemented' };
  }

  function stop() {
    return { status: 'skipped', message: 'opencode stop not yet implemented' };
  }

  function getHealth() {
    return { active: false, lastEventAt: null, error: null };
  }

  return {
    id: 'opencode',
    label: 'OpenWork',
    setupMode: 'opencode-plugin',
    detectInstalled,
    detectIntegrated,
    ensureIntegration,
    start,
    stop,
    getHealth,
  };
}

module.exports = createOpenCodeIntegration();

module.exports.createOpenCodeIntegration = createOpenCodeIntegration;
