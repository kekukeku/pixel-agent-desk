/**
 * OpenCode Plugin Registration
 *
 * Installs the PAD adapter plugin only when an active OpenCode / OpenWork
 * environment is detected (~/.config/opencode/ with opencode.json|c, or
 * ~/Library/.opencode/ with openwork.json|c). Merges an absolute plugin path
 * into the existing config without overwriting unrelated settings.
 *
 * Called during npm postinstall AND on every app startup. Skips silently when
 * OpenCode is not installed. Never throws — failures degrade to a console
 * warning so PAD startup is unaffected.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { parse, modify, applyEdits } = require('jsonc-parser');
const { getPluginsCacheDir } = require('./integrations/assetResolver');

const OPENCODE_SCHEMA = 'https://opencode.ai/config.json';
const PAD_ADAPTER_BASENAME = 'pad-adapter.js';
const JSONC_FORMAT = { insertSpaces: true, tabSize: 2, eol: '\n' };
const GRACEFUL_WARNING =
  '[Warning] Unable to register OpenCode plugin automatically. OpenWork/OpenCode integration may not appear in the office until the plugin is configured manually.';

function _resolvePaths(options) {
  const opts = options || {};
  const homeDir = opts.homeDir || os.homedir();
  const opencodeConfigDir = path.join(homeDir, '.config', 'opencode');
  const pluginsDir = path.join(opencodeConfigDir, 'plugins');
  const targetPath = path.join(pluginsDir, PAD_ADAPTER_BASENAME);
  const openWorkRoot = path.join(homeDir, 'Library', '.opencode');
  const openWorkPluginsDir = path.join(openWorkRoot, 'plugins');
  const openWorkTargetPath = path.join(openWorkPluginsDir, PAD_ADAPTER_BASENAME);
  const sourcePath = opts.sourcePath || path.join(getPluginsCacheDir(opts), 'opencode-plugin.js');
  return {
    homeDir,
    opencodeConfigDir,
    pluginsDir,
    targetPath,
    openWorkRoot,
    openWorkPluginsDir,
    openWorkTargetPath,
    sourcePath,
  };
}

function _resolveExistingConfigFile(configDir, stem) {
  const jsoncPath = path.join(configDir, stem + '.jsonc');
  if (fs.existsSync(jsoncPath)) return jsoncPath;
  const jsonPath = path.join(configDir, stem + '.json');
  if (fs.existsSync(jsonPath)) return jsonPath;
  return null;
}

function _collectActiveTargets(paths) {
  const targets = [];

  if (fs.existsSync(paths.opencodeConfigDir)) {
    const configPath = _resolveExistingConfigFile(paths.opencodeConfigDir, 'opencode');
    if (configPath) {
      targets.push({
        pluginsDir: paths.pluginsDir,
        targetPath: paths.targetPath,
        configPath: configPath,
        label: 'OpenCode',
      });
    }
  }

  if (fs.existsSync(paths.openWorkRoot)) {
    const configPath = _resolveExistingConfigFile(paths.openWorkRoot, 'openwork');
    if (configPath) {
      targets.push({
        pluginsDir: paths.openWorkPluginsDir,
        targetPath: paths.openWorkTargetPath,
        configPath: configPath,
        label: 'OpenWork',
      });
    }
  }

  return targets;
}

function _collectRemovalTargets(paths) {
  const targets = [];

  if (fs.existsSync(paths.opencodeConfigDir)) {
    targets.push({
      targetPath: paths.targetPath,
      configPath: _resolveExistingConfigFile(paths.opencodeConfigDir, 'opencode'),
      label: 'OpenCode',
    });
  }

  if (fs.existsSync(paths.openWorkRoot)) {
    targets.push({
      targetPath: paths.openWorkTargetPath,
      configPath: _resolveExistingConfigFile(paths.openWorkRoot, 'openwork'),
      label: 'OpenWork',
    });
  }

  return targets;
}

function _readConfigFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return { exists: false, raw: '', data: null, errors: [] };
  }

  const raw = fs.readFileSync(filePath, 'utf-8');
  if (!raw.trim()) {
    return { exists: true, raw, data: {}, errors: [] };
  }

  const errors = [];
  const data = parse(raw, errors, { allowTrailingComma: true, disallowComments: false });
  if (errors.length > 0) {
    return { exists: true, raw, data: null, errors };
  }

  return { exists: true, raw, data: data && typeof data === 'object' ? data : {}, errors: [] };
}

function _writeConfigFile(filePath, content) {
  fs.writeFileSync(filePath, content, 'utf-8');
}

function _applyJsoncEdits(raw, edits) {
  if (!edits || edits.length === 0) return raw;
  return applyEdits(raw, edits, { insertSpaces: true, tabSize: 2, eol: '\n' });
}

function _pluginEntryPath(entry) {
  if (typeof entry === 'string') return entry;
  if (Array.isArray(entry) && typeof entry[0] === 'string') return entry[0];
  return null;
}

function _isPadAdapterEntry(entry) {
  const pluginPath = _pluginEntryPath(entry);
  if (!pluginPath) return false;
  return path.basename(pluginPath) === PAD_ADAPTER_BASENAME || pluginPath.includes('pad-adapter');
}

function _normalizePluginList(list) {
  if (!Array.isArray(list)) return [];
  return list.filter(function (entry) { return _pluginEntryPath(entry) !== null; });
}

function _dedupePluginList(list) {
  const seen = new Set();
  const result = [];

  for (const entry of list) {
    const pluginPath = _pluginEntryPath(entry);
    if (!pluginPath || seen.has(pluginPath)) continue;
    seen.add(pluginPath);
    result.push(entry);
  }

  return result;
}

function _mergePluginList(existingList, absolutePluginPath) {
  const existing = _normalizePluginList(existingList);
  const desiredEntry = absolutePluginPath;
  let hasPadAdapter = false;

  const merged = existing.map(function (entry) {
    if (!_isPadAdapterEntry(entry)) return entry;
    hasPadAdapter = true;
    return desiredEntry;
  });

  if (!hasPadAdapter) {
    merged.push(desiredEntry);
  }

  return _dedupePluginList(merged);
}

function _pluginListUnchanged(before, after) {
  if (before.length !== after.length) return false;
  return before.every(function (entry, index) {
    return _pluginEntryPath(entry) === _pluginEntryPath(after[index]);
  });
}

function _warnGraceful(log, error) {
  log(GRACEFUL_WARNING);
  if (error && error.message) {
    log(`[Warning] ${error.message}`);
  }
}

/**
 * Merge config.plugin with the PAD adapter absolute path using JSONC-aware edits.
 * Caller must only invoke when the config file already exists.
 *
 * @returns {boolean} true when the config file was changed
 */
function _ensurePluginConfig(configPath, absolutePluginPath, log, label) {
  const snapshot = _readConfigFile(configPath);
  if (!snapshot.exists) {
    throw new Error(`config file not found: ${configPath}`);
  }
  if (snapshot.errors.length > 0) {
    throw new Error('invalid JSON/JSONC: ' + snapshot.errors.map(function (e) { return e.error; }).join(', '));
  }

  const config = snapshot.data || {};
  const existing = _normalizePluginList(config.plugin);
  const nextPlugin = _mergePluginList(existing, absolutePluginPath);
  const removeInvalidPluginsKey = Object.prototype.hasOwnProperty.call(config, 'plugins');
  const needsSchema = !config.$schema;
  const pluginChanged = !_pluginListUnchanged(existing, nextPlugin);

  if (!pluginChanged && !removeInvalidPluginsKey && !needsSchema) {
    return false;
  }

  let updated = snapshot.raw;

  if (pluginChanged) {
    if (Array.isArray(config.plugin)) {
      log(`[OpenCode] Merging ${label} plugin into existing plugin array`);
    } else {
      log(`[OpenCode] Appending ${label} plugin to config`);
    }
    updated = _applyJsoncEdits(updated, modify(updated, ['plugin'], nextPlugin, JSONC_FORMAT));
  } else if (!Array.isArray(config.plugin)) {
    log(`[OpenCode] Creating ${label} plugin array in config`);
    updated = _applyJsoncEdits(updated, modify(updated, ['plugin'], nextPlugin, JSONC_FORMAT));
  }

  if (removeInvalidPluginsKey) {
    log(`[OpenCode] Removing invalid "plugins" key from ${label} config`);
    updated = _applyJsoncEdits(updated, modify(updated, ['plugins'], undefined, JSONC_FORMAT));
  }

  if (needsSchema) {
    updated = _applyJsoncEdits(updated, modify(updated, ['$schema'], OPENCODE_SCHEMA, JSONC_FORMAT));
  }

  if (updated === snapshot.raw) {
    return false;
  }

  _writeConfigFile(configPath, updated.endsWith('\n') ? updated : updated + '\n');
  log(`[OpenCode] ${label} config updated at ${configPath}`);
  return true;
}

function _removePluginConfig(configPath, log, label) {
  const snapshot = _readConfigFile(configPath);
  if (!snapshot.exists || snapshot.errors.length > 0 || !snapshot.data) return false;
  if (!Array.isArray(snapshot.data.plugin)) return false;

  const nextPlugin = snapshot.data.plugin.filter(function (entry) { return !_isPadAdapterEntry(entry); });
  if (nextPlugin.length === snapshot.data.plugin.length) return false;

  let updated = snapshot.raw;
  if (nextPlugin.length === 0) {
    updated = _applyJsoncEdits(updated, modify(updated, ['plugin'], undefined, JSONC_FORMAT));
  } else {
    updated = _applyJsoncEdits(updated, modify(updated, ['plugin'], nextPlugin, JSONC_FORMAT));
  }

  _writeConfigFile(configPath, updated.endsWith('\n') ? updated : updated + '\n');
  log(`[OpenCode] Removed ${label} plugin from config`);
  return true;
}

function _installPluginFiles(sourceContent, targets, log) {
  let changed = false;

  for (const target of targets) {
    const { pluginsDir, targetPath, label } = target;

    if (fs.existsSync(targetPath)) {
      const existingContent = fs.readFileSync(targetPath, 'utf-8');
      if (existingContent === sourceContent) {
        continue;
      }
      log(`[OpenCode] ${label} plugin exists but differs — updating...`);
    } else {
      log(`[OpenCode] Installing ${label} plugin for the first time...`);
    }

    if (!fs.existsSync(pluginsDir)) {
      fs.mkdirSync(pluginsDir, { recursive: true });
    }

    fs.writeFileSync(targetPath, sourceContent, 'utf-8');
    changed = true;
  }

  return changed;
}

function _registerPluginConfigs(targets, log) {
  let changed = false;

  for (const target of targets) {
    try {
      if (_ensurePluginConfig(target.configPath, target.targetPath, log, target.label)) {
        changed = true;
      }
    } catch (error) {
      _warnGraceful(log, error);
    }
  }

  return changed;
}

/**
 * Install the PAD adapter plugin into active OpenCode / OpenWork environments.
 *
 * @param {Function} debugLog - logging function
 * @param {Object}  [options]
 * @param {string}  [options.homeDir]    - override home directory (for testing)
 * @param {string}  [options.sourcePath] - override plugin source path (for testing)
 * @returns {boolean} true unless the PAD plugin source file is missing
 */
function registerOpenCodePlugin(debugLog, options) {
  const log = debugLog || (() => {});
  const paths = _resolvePaths(options);
  const { sourcePath } = paths;

  if (!fs.existsSync(paths.opencodeConfigDir) && !fs.existsSync(paths.openWorkRoot)) {
    return true;
  }

  const targets = _collectActiveTargets(paths);
  if (targets.length === 0) {
    return true;
  }

  if (!fs.existsSync(sourcePath)) {
    log(`[OpenCode] Plugin source not found at ${sourcePath} — skipping`);
    return false;
  }

  log('[OpenCode] Checking plugin installation...');

  let changed = false;

  try {
    const sourceContent = fs.readFileSync(sourcePath, 'utf-8');
    changed = _installPluginFiles(sourceContent, targets, log);
  } catch (error) {
    _warnGraceful(log, error);
    return true;
  }

  if (_registerPluginConfigs(targets, log)) {
    changed = true;
  }

  if (changed) {
    log('[OpenCode] Plugin installed successfully');
  } else {
    log('[OpenCode] Plugin already up-to-date');
  }

  return true;
}

/**
 * Remove the PAD adapter plugin from active OpenCode / OpenWork environments.
 *
 * @param {Function} debugLog - logging function
 * @param {Object}  [options]
 * @param {string}  [options.homeDir] - override home directory (for testing)
 * @returns {boolean} always true — failures degrade to warnings
 */
function unregisterOpenCodePlugin(debugLog, options) {
  const log = debugLog || (() => {});
  const paths = _resolvePaths(options);
  const targets = _collectRemovalTargets(paths);

  if (targets.length === 0) {
    return true;
  }

  for (const target of targets) {
    try {
      if (fs.existsSync(target.targetPath)) {
        fs.unlinkSync(target.targetPath);
        log(`[OpenCode] ${target.label} plugin removed`);
      }
    } catch (error) {
      _warnGraceful(log, error);
    }

    if (target.configPath) {
      try {
        _removePluginConfig(target.configPath, log, target.label);
      } catch (error) {
        _warnGraceful(log, error);
      }
    }
  }

  return true;
}

/**
 * Check if the PAD adapter plugin is installed in all active environments.
 *
 * @param {Object} [options]
 * @param {string} [options.homeDir] - override home directory (for testing)
 * @returns {boolean}
 */
function isOpenCodePluginRegistered(options) {
  const paths = _resolvePaths(options);
  const targets = _collectActiveTargets(paths);
  if (targets.length === 0) return false;
  return targets.every(function (target) { return fs.existsSync(target.targetPath); });
}

module.exports = {
  registerOpenCodePlugin,
  unregisterOpenCodePlugin,
  isOpenCodePluginRegistered,
};