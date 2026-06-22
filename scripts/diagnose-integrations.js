/**
 * Pixel Agent Desk — Integration Diagnostics
 *
 * Read-only smoke check.  Runs detectAll() on all adapters without writing
 * to any home-config files and without starting observers/forwarders.
 *
 * Usage:
 *   node scripts/diagnose-integrations.js           # uses real home
 *   node scripts/diagnose-integrations.js --json    # machine-readable JSON
 *
 * Programmatic:
 *   const { runDiagnostics } = require('./scripts/diagnose-integrations');
 *   const result = runDiagnostics({ homeDir, appConfig, debugLog });
 */

'use strict';

const path = require('path');
const os = require('os');

function resolveProjectRoot() {
  return path.resolve(__dirname, '..');
}

function requireRelative(mod) {
  return require(path.join(resolveProjectRoot(), mod));
}

function runDiagnostics(options) {
  const opts = options || {};
  const appConfig = opts.appConfig || requireRelative('src/main/config').getAppConfig();
  const homeDir = opts.homeDir || os.homedir();
  const debugLog = opts.debugLog || (function () {});

  const integrationManager = requireRelative('src/main/integrations/integrationManager');

  integrationManager.init({ debugLog });

  integrationManager.registerDefaultAdapters({
    appConfig,
    debugLog,
    homeDir,
  });

  integrationManager.detectAll();

  const report = integrationManager.getCapabilityReport();
  const formatted = integrationManager.formatCapabilityReport(report);

  const hasError = report.some(function (entry) {
    return !!entry.error;
  });

  integrationManager.cleanup();

  const config = {
    claude: !!(appConfig.integrations && appConfig.integrations.claude && appConfig.integrations.claude.enabled !== false),
    opencode: !!(appConfig.integrations && appConfig.integrations.opencode && appConfig.integrations.opencode.enabled !== false),
  };

  return {
    ok: !hasError,
    report,
    formatted,
    config,
  };
}

// CLI entry point
if (require.main === module) {
  const wantJson = process.argv.includes('--json');
  const result = runDiagnostics();

  if (wantJson) {
    console.log(JSON.stringify({
      ok: result.ok,
      config: result.config,
      report: result.report,
    }, null, 2));
  } else {
    console.log('Pixel Agent Desk Integration Diagnostics');
    console.log('Config:');
    console.log(`  - claude enabled=${result.config.claude}`);
    console.log(`  - opencode enabled=${result.config.opencode}`);
    console.log('');
    console.log(result.formatted);
  }

  process.exitCode = result.ok ? 0 : 1;
}

module.exports = { runDiagnostics };
