/**
 * Antigravity Hook Registration
 *
 * Installs a PAD-owned hook key into ~/.gemini/config/hooks.json.
 * Preserves all existing user hook keys — only adds/updates the
 * "pixel-agent-desk" key.
 *
 * Lifecycle events (PreInvocation, Stop) use bare command hooks (no matcher).
 * Tool events (PreToolUse, PostToolUse) use matcher: "*".
 *
 * All commands include the event name as argv so the forwarder can
 * determine the event even if the stdin payload lacks hookEventName.
 *
 * Supports injection of homeDir and forwarderPath for testing.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

function shellQuote(p) {
  return '"' + p.replace(/"/g, '\\"') + '"';
}

function _resolvePaths(options) {
  const opts = options || {};
  const homeDir = opts.homeDir || os.homedir();
  const configDir = path.join(homeDir, '.gemini', 'config');
  const hooksPath = path.join(configDir, 'hooks.json');
  const forwarderPath = opts.forwarderPath || path.join(__dirname, '..', 'forwarders', 'antigravity-forwarder.js');
  return { homeDir, configDir, hooksPath, forwarderPath };
}

function buildHookConfig(forwarderPath) {
  const quoted = shellQuote(forwarderPath);
  return {
    pixelAgentDesk: {
      enabled: true,
      PreInvocation: [
        {
          type: 'command',
          command: `node ${quoted} PreInvocation`,
          timeout: 10,
        },
      ],
      PreToolUse: [
        {
          matcher: '*',
          hooks: [
            {
              type: 'command',
              command: `node ${quoted} PreToolUse`,
              timeout: 10,
            },
          ],
        },
      ],
      PostToolUse: [
        {
          matcher: '*',
          hooks: [
            {
              type: 'command',
              command: `node ${quoted} PostToolUse`,
              timeout: 10,
            },
          ],
        },
      ],
      Stop: [
        {
          type: 'command',
          command: `node ${quoted} Stop`,
          timeout: 10,
        },
      ],
    },
  };
}

const PAD_KEY = 'pixel-agent-desk';

function registerAntigravityHooks(debugLog, options) {
  const log = debugLog || (() => {});
  const { configDir, hooksPath, forwarderPath } = _resolvePaths(options);

  log('[Antigravity] Checking hook installation...');

  try {
    let config = {};

    if (fs.existsSync(hooksPath)) {
      try {
        const raw = fs.readFileSync(hooksPath, 'utf-8');
        config = JSON.parse(raw);
        if (!config || typeof config !== 'object' || Array.isArray(config)) {
          log('[Antigravity] Config is not a JSON object — treating as empty');
          config = {};
        }
      } catch (e) {
        log(`[Antigravity] Failed to parse existing config — backing up and creating fresh`);
        const backupPath = hooksPath + '.backup-' + Date.now();
        try { fs.renameSync(hooksPath, backupPath); } catch (e2) { /* ignore */ }
        config = {};
      }
    }

    const padConfig = buildHookConfig(forwarderPath);

    // Check if already up-to-date
    if (config[PAD_KEY]) {
      const existing = JSON.stringify(config[PAD_KEY]);
      const expected = JSON.stringify(padConfig.pixelAgentDesk);
      if (existing === expected) {
        log('[Antigravity] Hooks already up-to-date');
        return true;
      }
      log('[Antigravity] PAD hook exists but differs — updating...');
    } else {
      log('[Antigravity] Installing PAD hook for the first time...');
    }

    // Preserve all existing user keys, only overwrite PAD_KEY
    config[PAD_KEY] = padConfig.pixelAgentDesk;

    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    fs.writeFileSync(hooksPath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
    log('[Antigravity] Hooks installed successfully');
    return true;
  } catch (error) {
    log(`[Antigravity] Hook registration failed: ${error.message}`);
    return false;
  }
}

function unregisterAntigravityHooks(debugLog, options) {
  const log = debugLog || (() => {});
  const { hooksPath } = _resolvePaths(options);

  try {
    if (!fs.existsSync(hooksPath)) return true;

    let config;
    try {
      const raw = fs.readFileSync(hooksPath, 'utf-8');
      config = JSON.parse(raw);
    } catch (e) {
      return true;
    }

    if (!config || typeof config !== 'object') return true;

    if (config[PAD_KEY]) {
      delete config[PAD_KEY];
      fs.writeFileSync(hooksPath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
      log('[Antigravity] PAD hook removed');
    }

    return true;
  } catch (error) {
    log(`[Antigravity] Hook removal failed: ${error.message}`);
    return false;
  }
}

function isAntigravityHooksRegistered(options) {
  const { hooksPath, forwarderPath } = _resolvePaths(options);

  try {
    if (!fs.existsSync(hooksPath)) return false;
    const raw = fs.readFileSync(hooksPath, 'utf-8');
    const config = JSON.parse(raw);
    if (!config || !config[PAD_KEY]) return false;

    const pad = config[PAD_KEY];
    // Must have at least the expected structure with PreInvocation
    if (!pad.PreInvocation || !Array.isArray(pad.PreInvocation) || pad.PreInvocation.length === 0) return false;
    if (!pad.PreToolUse || !Array.isArray(pad.PreToolUse) || pad.PreToolUse.length === 0) return false;

    // Verify the PreInvocation command contains the forwarderPath
    const expectedFwd = forwarderPath || _resolvePaths(options).forwarderPath;
    const cmd = pad.PreInvocation[0].command || '';
    if (expectedFwd && cmd.indexOf(expectedFwd) === -1) return false;

    return true;
  } catch (e) {
    return false;
  }
}

module.exports = {
  registerAntigravityHooks,
  unregisterAntigravityHooks,
  isAntigravityHooksRegistered,
};
