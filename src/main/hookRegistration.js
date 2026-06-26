/**
 * Claude CLI Hook Registration
 * Read/write/register command hooks from Claude CLI config file
 */

const path = require('path');
const os = require('os');
const fs = require('fs');
const { getHookRunnerCommand, getForwardersCacheDir } = require('./integrations/assetResolver');

const HOOK_SERVER_PORT = 47821;
const PAD_HTTP_HOOK_URL = `http://localhost:${HOOK_SERVER_PORT}/hook`;
const PAD_FORWARDER_BASENAME = 'claude-forwarder.js';

function getClaudeConfigPath(options) {
  const opts = options || {};
  return path.join(opts.homeDir || os.homedir(), '.claude', 'settings.json');
}

function getForwarderPath(options) {
  const opts = options || {};
  return opts.forwarderPath || path.join(getForwardersCacheDir(opts), PAD_FORWARDER_BASENAME);
}

function readClaudeConfig(debugLog, options) {
  try {
    const configPath = getClaudeConfigPath(options);
    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, 'utf-8');
      return JSON.parse(content);
    }
  } catch (error) {
    debugLog(`[Hook] Failed to read Claude config: ${error.message}`);
  }
  return {};
}

function writeClaudeConfig(config, debugLog, options) {
  try {
    const configPath = getClaudeConfigPath(options);
    const dir = path.dirname(configPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
    debugLog('[Hook] Claude config file updated');
    return true;
  } catch (error) {
    debugLog(`[Hook] Failed to write Claude config: ${error.message}`);
    return false;
  }
}

const HOOK_EVENTS = [
  'SessionStart', 'SessionEnd', 'UserPromptSubmit',
  'PreToolUse', 'PostToolUse', 'PostToolUseFailure',
  'Stop', 'TaskCompleted', 'PermissionRequest', 'Notification',
  'SubagentStart', 'SubagentStop', 'TeammateIdle',
  'ConfigChange', 'WorktreeCreate', 'WorktreeRemove',
  'PreCompact'
];

function isPadHttpHook(hook) {
  return hook && hook.type === 'http' && hook.url === PAD_HTTP_HOOK_URL;
}

function isPadCommandHook(hook, forwarderPath) {
  if (!hook || hook.type !== 'command' || !hook.command) return false;
  return hook.command.includes(PAD_FORWARDER_BASENAME)
    || hook.command.includes(forwarderPath);
}

function hasOurCommandHookInEntry(entry, forwarderPath) {
  return entry.hooks && entry.hooks.some(h => isPadCommandHook(h, forwarderPath));
}

function hasLegacyHttpHooks(config) {
  if (!config.hooks) return false;
  for (const entries of Object.values(config.hooks)) {
    if (!Array.isArray(entries)) continue;
    for (const entry of entries) {
      if (entry.hooks && entry.hooks.some(isPadHttpHook)) return true;
    }
  }
  return false;
}

function stripPadHooksFromConfig(config, forwarderPath) {
  if (!config.hooks) return;

  for (const event of Object.keys(config.hooks)) {
    if (!Array.isArray(config.hooks[event])) continue;

    config.hooks[event] = config.hooks[event]
      .map(function (entry) {
        if (!entry.hooks) return entry;
        const remaining = entry.hooks.filter(function (hook) {
          return !isPadHttpHook(hook) && !isPadCommandHook(hook, forwarderPath);
        });
        if (remaining.length === 0) return null;
        return { ...entry, hooks: remaining };
      })
      .filter(Boolean);
  }
}

function buildOurEntry(forwarderPath, eventName) {
  return {
    matcher: '*',
    hooks: [{
      type: 'command',
      command: getHookRunnerCommand(forwarderPath, eventName),
      timeout: 5,
    }],
  };
}

function isHookRegistered(debugLog, options) {
  const config = readClaudeConfig(debugLog, options);
  const forwarderPath = getForwarderPath(options);

  if (!config.hooks || hasLegacyHttpHooks(config)) {
    return false;
  }

  return HOOK_EVENTS.every(function (event) {
    return Array.isArray(config.hooks[event])
      && config.hooks[event].some(function (entry) {
        return hasOurCommandHookInEntry(entry, forwarderPath);
      });
  });
}

function registerClaudeHooks(debugLog, options) {
  debugLog('[Hook] Checking Claude CLI hook registration status...');

  const forwarderPath = getForwarderPath(options);

  if (!fs.existsSync(forwarderPath)) {
    debugLog(`[Hook] Forwarder not found at ${forwarderPath} — skipping`);
    return false;
  }

  if (isHookRegistered(debugLog, options)) {
    debugLog('[Hook] Hooks are already registered.');
    return true;
  }

  debugLog('[Hook] Starting hook registration...');

  const config = readClaudeConfig(debugLog, options);
  config.hooks = config.hooks || {};

  stripPadHooksFromConfig(config, forwarderPath);

  for (const event of HOOK_EVENTS) {
    const ourEntry = buildOurEntry(forwarderPath, event);

    if (!Array.isArray(config.hooks[event])) {
      config.hooks[event] = [ourEntry];
    } else if (!config.hooks[event].some(function (entry) {
      return hasOurCommandHookInEntry(entry, forwarderPath);
    })) {
      config.hooks[event].push(ourEntry);
    }
  }

  if (writeClaudeConfig(config, debugLog, options)) {
    debugLog('[Hook] Claude CLI hook registration complete');
    return true;
  }

  debugLog('[Hook] Hook registration failed');
  return false;
}

module.exports = {
  HOOK_SERVER_PORT,
  HOOK_EVENTS,
  PAD_HTTP_HOOK_URL,
  PAD_FORWARDER_BASENAME,
  getClaudeConfigPath,
  getForwarderPath,
  isHookRegistered,
  registerClaudeHooks,
};