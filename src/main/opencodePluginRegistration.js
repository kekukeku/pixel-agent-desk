/**
 * OpenCode Plugin Registration
 *
 * Installs the PAD adapter plugin into the user's OpenCode global config
 * (~/.config/opencode/plugins/pad-adapter.js) so OpenCode and OpenWork
 * automatically pick up PAD lifecycle events.
 *
 * Called during npm postinstall AND on every app startup to ensure the
 * plugin stays current across PAD updates.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { getPluginsCacheDir } = require('./integrations/assetResolver');

function _resolvePaths(options) {
  const opts = options || {};
  const homeDir = opts.homeDir || os.homedir();
  const pluginsDir = path.join(homeDir, '.config', 'opencode', 'plugins');
  const targetPath = path.join(pluginsDir, 'pad-adapter.js');
  const sourcePath = opts.sourcePath || path.join(getPluginsCacheDir(opts), 'opencode-plugin.js');
  return { homeDir, pluginsDir, targetPath, sourcePath };
}

/**
 * Install the PAD adapter plugin into the OpenCode plugins directory.
 *
 * @param {Function} debugLog - logging function
 * @param {Object}  [options]
 * @param {string}  [options.homeDir]    - override home directory (for testing)
 * @param {string}  [options.sourcePath] - override plugin source path (for testing)
 * @returns {boolean} true on success or already up-to-date, false on failure
 */
function registerOpenCodePlugin(debugLog, options) {
  const log = debugLog || (() => {});
  const { pluginsDir, targetPath, sourcePath } = _resolvePaths(options);

  log('[OpenCode] Checking plugin installation...');

  try {
    if (!fs.existsSync(sourcePath)) {
      log(`[OpenCode] Plugin source not found at ${sourcePath} — skipping`);
      return false;
    }

    const sourceContent = fs.readFileSync(sourcePath, 'utf-8');

    if (fs.existsSync(targetPath)) {
      const existingContent = fs.readFileSync(targetPath, 'utf-8');
      if (existingContent === sourceContent) {
        log('[OpenCode] Plugin already up-to-date');
        return true;
      }
      log('[OpenCode] Plugin exists but differs — updating...');
    } else {
      log('[OpenCode] Installing plugin for the first time...');
    }

    if (!fs.existsSync(pluginsDir)) {
      fs.mkdirSync(pluginsDir, { recursive: true });
    }

    fs.writeFileSync(targetPath, sourceContent, 'utf-8');
    log('[OpenCode] Plugin installed successfully');
    return true;
  } catch (error) {
    log(`[OpenCode] Plugin registration failed: ${error.message}`);
    return false;
  }
}

/**
 * Remove the PAD adapter plugin from the OpenCode plugins directory.
 *
 * @param {Function} debugLog - logging function
 * @param {Object}  [options]
 * @param {string}  [options.homeDir] - override home directory (for testing)
 * @returns {boolean} true on success, false on failure
 */
function unregisterOpenCodePlugin(debugLog, options) {
  const log = debugLog || (() => {});
  const { targetPath } = _resolvePaths(options);

  try {
    if (fs.existsSync(targetPath)) {
      fs.unlinkSync(targetPath);
      log('[OpenCode] Plugin removed');
    }
    return true;
  } catch (error) {
    log(`[OpenCode] Plugin removal failed: ${error.message}`);
    return false;
  }
}

/**
 * Check if the PAD adapter plugin is currently installed.
 *
 * @param {Object} [options]
 * @param {string} [options.homeDir] - override home directory (for testing)
 * @returns {boolean}
 */
function isOpenCodePluginRegistered(options) {
  const { targetPath } = _resolvePaths(options);
  return fs.existsSync(targetPath);
}

module.exports = {
  registerOpenCodePlugin,
  unregisterOpenCodePlugin,
  isOpenCodePluginRegistered,
};
