/**
 * Pixel Agent Desk — Install Script
 *
 * Thin wrapper around the integration manager.
 * Ensures installable adapters (Claude Code, OpenCode) are registered
 * in the user's home config at install time.
 *
 * Does NOT start observers, forwarders, or Codex integration.
 */

'use strict';

const integrationManager = require('./main/integrations/integrationManager');
const { getAppConfig } = require('./main/config');

function runInstall(options) {
  const opts = options || {};
  const homeDir = opts.homeDir || null;
  const sourcePath = opts.sourcePath || null;
  const debugLog = opts.debugLog || (function () {});
  const appConfig = opts.appConfig || getAppConfig();

  integrationManager.init({ debugLog });

  integrationManager.registerDefaultAdapters({
    appConfig,
    debugLog,
    homeDir,
    sourcePath,
  });

  const results = integrationManager.ensureInstallableAdapters({
    appConfig,
    debugLog,
    homeDir,
  });

  const ok = results.every(function (r) { return r.status !== 'failed'; });

  integrationManager.cleanup();

  return { ok, results };
}

// CLI entry point — only when run directly (not required())
if (require.main === module) {
  const result = runInstall();
  if (!result.ok) process.exit(1);
}

module.exports = { runInstall };
