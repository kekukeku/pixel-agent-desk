/**
 * Asset Resolver
 *
 * Handles packaged-app asset materialization and smart hook-command building.
 *
 * In development, forwarders/plugins live at their source paths under src/.
 * In a packaged Electron app (asar), they must be materialized from an
 * unpacked location into a stable user-cache directory so that hook configs
 * can point to real filesystem paths.
 *
 * Also provides a command builder that auto-detects whether to use the
 * system `node` or fall back to the Electron binary with
 * ELECTRON_RUN_AS_NODE=1.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const PAD_CACHE_DIR = '.pixel-agent-desk';

function shellQuote(p) {
  return '"' + String(p).replace(/"/g, '\\"') + '"';
}

// ---------------------------------------------------------------------------
// Path resolution
// ---------------------------------------------------------------------------

function isPackaged(appDir) {
  if (appDir) return appDir.indexOf('.asar') !== -1;
  try {
    const main = require.main ? require.main.filename : '';
    return main.indexOf('app.asar') !== -1;
  } catch (e) {
    return false;
  }
}

function getAppRoot(appDir) {
  if (appDir) return appDir;
  try {
    return path.resolve(path.join(__dirname, '..', '..', '..'));
  } catch (e) {
    return process.cwd();
  }
}

function getCacheDir(options) {
  const opts = options || {};
  const homeDir = opts.homeDir || os.homedir();
  return path.join(homeDir, PAD_CACHE_DIR);
}

function getRuntimeDir(options) {
  return path.join(getCacheDir(options), 'runtime');
}

function getForwardersCacheDir(options) {
  return path.join(getRuntimeDir(options), 'forwarders');
}

function getPluginsCacheDir(options) {
  return path.join(getRuntimeDir(options), 'adapters');
}

function resolveSourcePath(relativeSourcePath, options) {
  const opts = options || {};
  let appRoot = getAppRoot(opts.appDir);

  // If running inside app.asar, map source path to app.asar.unpacked
  if (appRoot.indexOf('app.asar') !== -1) {
    appRoot = appRoot.replace(/([\\/]app\.asar)/g, '$1.unpacked');
  }

  return path.join(appRoot, relativeSourcePath);
}

function resolveCachedPath(relativeSourcePath, options) {
  const cleanPath = relativeSourcePath.startsWith('src/')
    ? relativeSourcePath.slice(4)
    : relativeSourcePath;
  return path.join(getCacheDir(options), 'runtime', cleanPath);
}

// ---------------------------------------------------------------------------
// Materialization
// ---------------------------------------------------------------------------

function materializeAssets(options) {
  const results = [];
  const opts = options || {};
  const debugLog = opts.debugLog || (function () {});

  const assets = [
    { src: 'src/forwarders/grok-forwarder.js', label: 'grok forwarder' },
    { src: 'src/forwarders/antigravity-forwarder.js', label: 'antigravity forwarder' },
    { src: 'src/main/adapters/grokHookAdapter.js', label: 'grok adapter' },
    { src: 'src/main/adapters/antigravityHookAdapter.js', label: 'antigravity adapter' },
    { src: 'src/adapters/opencode-plugin.js', label: 'opencode plugin' },
  ];

  for (const asset of assets) {
    try {
      const sourcePath = resolveSourcePath(asset.src, opts);
      const cachePath = resolveCachedPath(asset.src, opts);
      const cacheDir = path.dirname(cachePath);

      if (!fs.existsSync(sourcePath)) {
        debugLog(`[AssetResolver] Source not found: ${asset.src}`);
        results.push({ asset: asset.label, ok: false, reason: 'source missing' });
        continue;
      }

      const sourceContent = fs.readFileSync(sourcePath, 'utf-8');

      let needsWrite = true;
      if (fs.existsSync(cachePath)) {
        const cachedContent = fs.readFileSync(cachePath, 'utf-8');
        if (cachedContent === sourceContent) {
          needsWrite = false;
          debugLog(`[AssetResolver] ${asset.label} cache up-to-date`);
        }
      }

      if (needsWrite) {
        if (!fs.existsSync(cacheDir)) {
          fs.mkdirSync(cacheDir, { recursive: true });
        }
        fs.writeFileSync(cachePath, sourceContent, 'utf-8');
        debugLog(`[AssetResolver] ${asset.label} materialized to ${cachePath}`);
      }

      results.push({ asset: asset.label, ok: true, path: cachePath });
    } catch (e) {
      debugLog(`[AssetResolver] Failed to materialize ${asset.label}: ${e.message}`);
      results.push({ asset: asset.label, ok: false, reason: e.message });
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Command builder
// ---------------------------------------------------------------------------

function nodeAvailable(options) {
  const opts = options || {};
  if (typeof opts.nodeAvailable === 'boolean') return opts.nodeAvailable;

  try {
    const { execSync } = require('child_process');
    execSync('node --version', { stdio: 'ignore' });
    return true;
  } catch (e) {
    return false;
  }
}

function getHookRunnerCommand(scriptPath, eventName, options) {
  const opts = options || {};
  const quotedScript = shellQuote(scriptPath);
  const evt = eventName ? ' ' + eventName : '';
  const platform = opts.platform || process.platform;
  const appDir = opts.appDir || null;

  // Force Electron binary if packaged
  const forceElectron = isPackaged(appDir);

  if (!forceElectron && nodeAvailable(opts)) {
    return `node ${quotedScript}${evt}`;
  }

  const execPath = opts.execPath || process.execPath;

  if (platform === 'win32') {
    return `cmd /C "set ELECTRON_RUN_AS_NODE=1 && ${shellQuote(execPath)} ${quotedScript}${evt}"`;
  }

  // macOS / Linux
  return `ELECTRON_RUN_AS_NODE=1 ${shellQuote(execPath)} ${quotedScript}${evt}`;
}

module.exports = {
  shellQuote,
  isPackaged,
  getAppRoot,
  getCacheDir,
  getRuntimeDir,
  getForwardersCacheDir,
  getPluginsCacheDir,
  resolveSourcePath,
  resolveCachedPath,
  materializeAssets,
  getHookRunnerCommand,
};
