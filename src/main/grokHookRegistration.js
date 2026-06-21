/**
 * Grok Hook Registration
 *
 * Installs a PAD-owned command-hook file at ~/.grok/hooks/pixel-agent-desk.json
 * so Grok Build automatically invokes the PAD grok-forwarder.
 *
 * Uses command hooks (no localhost HTTP hook) to avoid Grok's HTTPS requirement.
 *
 * Supports injection of homeDir and forwarderPath for testing.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

function _resolvePaths(options) {
  const opts = options || {};
  const homeDir = opts.homeDir || os.homedir();
  const hooksDir = path.join(homeDir, '.grok', 'hooks');
  const targetPath = path.join(hooksDir, 'pixel-agent-desk.json');
  const forwarderPath = opts.forwarderPath || path.join(__dirname, '..', 'forwarders', 'grok-forwarder.js');
  return { homeDir, hooksDir, targetPath, forwarderPath };
}

const LIFECYCLE_EVENTS = [
  'SessionStart',
  'UserPromptSubmit',
  'PreToolUse',
  'PostToolUse',
  'PostToolUseFailure',
  'PermissionDenied',
  'Stop',
  'SessionEnd',
  'SubagentStart',
  'SubagentStop',
];

function buildHookJson(forwarderPath) {
  const hooks = {};
  for (const eventName of LIFECYCLE_EVENTS) {
    hooks[eventName] = [
      {
        hooks: [
          {
            type: 'command',
            command: `node ${forwarderPath} ${eventName}`,
            timeout: 5,
          },
        ],
      },
    ];
  }
  return { hooks };
}

const PAD_MARKER = 'pixel-agent-desk';

function hasPadMarker(content) {
  try {
    const parsed = JSON.parse(content);
    return !!(parsed && parsed._pad === PAD_MARKER);
  } catch (e) {
    return false;
  }
}

function buildExpectedContent(forwarderPath) {
  const hookConfig = buildHookJson(forwarderPath);
  hookConfig._pad = PAD_MARKER;
  return JSON.stringify(hookConfig, null, 2) + '\n';
}

function registerGrokHooks(debugLog, options) {
  const log = debugLog || (() => {});
  const { hooksDir, targetPath, forwarderPath } = _resolvePaths(options);

  log('[Grok] Checking hook installation...');

  try {
    const expected = buildExpectedContent(forwarderPath);

    if (fs.existsSync(targetPath)) {
      const existing = fs.readFileSync(targetPath, 'utf-8');
      if (existing === expected) {
        log('[Grok] Hooks already up-to-date');
        return true;
      }
      log('[Grok] Hooks exist but differ — updating...');
    } else {
      log('[Grok] Installing hooks for the first time...');
    }

    if (!fs.existsSync(hooksDir)) {
      fs.mkdirSync(hooksDir, { recursive: true });
    }

    fs.writeFileSync(targetPath, expected, 'utf-8');
    log('[Grok] Hooks installed successfully');
    return true;
  } catch (error) {
    log(`[Grok] Hook registration failed: ${error.message}`);
    return false;
  }
}

function unregisterGrokHooks(debugLog, options) {
  const log = debugLog || (() => {});
  const { targetPath } = _resolvePaths(options);

  try {
    if (fs.existsSync(targetPath)) {
      fs.unlinkSync(targetPath);
      log('[Grok] Hooks removed');
    }
    return true;
  } catch (error) {
    log(`[Grok] Hook removal failed: ${error.message}`);
    return false;
  }
}

function isGrokHooksRegistered(options) {
  const { targetPath } = _resolvePaths(options);

  try {
    if (!fs.existsSync(targetPath)) return false;
    const content = fs.readFileSync(targetPath, 'utf-8');
    return hasPadMarker(content);
  } catch (e) {
    return false;
  }
}

module.exports = {
  registerGrokHooks,
  unregisterGrokHooks,
  isGrokHooksRegistered,
};
