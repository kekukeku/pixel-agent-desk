/**
 * Integration Manager
 * Registers adapters, runs detection/ensure/start/stop, and produces capability reports.
 *
 * Single-adapter failure must not interrupt other adapters.
 */

'use strict';

const adapters = new Map();

let debugLog = () => {};

function init(deps) {
  debugLog = deps.debugLog || (() => {});

  // Materialize forwarder/plugin assets to ~/.pixel-agent-desk/ on every startup
  const { materializeAssets } = require('./assetResolver');
  materializeAssets({ debugLog, homeDir: deps.homeDir });
}

function registerAdapter(adapter) {
  if (!adapter || typeof adapter !== 'object' || !adapter.id) {
    debugLog(`[IntegrationManager] Invalid adapter rejected`);
    return false;
  }

  const required = ['id', 'label', 'detectInstalled', 'detectIntegrated', 'ensureIntegration', 'start', 'stop', 'getHealth'];
  for (const method of required) {
    if (typeof adapter[method] !== 'function' && method !== 'id' && method !== 'label' && method !== 'setupMode') {
      debugLog(`[IntegrationManager] Adapter "${adapter.id}" missing method: ${method}`);
      return false;
    }
  }

  adapters.set(adapter.id, adapter);
  debugLog(`[IntegrationManager] Registered adapter: ${adapter.id} (${adapter.label})`);
  return true;
}

function safeCall(adapterId, fn, fnName) {
  try {
    return fn();
  } catch (e) {
    debugLog(`[IntegrationManager] ${adapterId}.${fnName}() failed: ${e.message}`);
    return null;
  }
}

function detectAll() {
  const results = [];
  for (const [id, adapter] of adapters) {
    const installed = safeCall(id, () => adapter.detectInstalled(), 'detectInstalled') || false;
    const integrated = safeCall(id, () => adapter.detectIntegrated(), 'detectIntegrated') || false;
    debugLog(`[IntegrationManager] ${id}: installed=${installed} integrated=${integrated}`);
    results.push({ id, installed, integrated });
  }
  return results;
}

function ensureAll() {
  const results = [];
  for (const [id, adapter] of adapters) {
    const result = safeCall(id, () => adapter.ensureIntegration(), 'ensureIntegration');
    debugLog(`[IntegrationManager] ${id}: ensureIntegration → ${JSON.stringify(result)}`);
    results.push({ id, result });
  }
  return results;
}

function startAll() {
  const results = [];
  for (const [id, adapter] of adapters) {
    const result = safeCall(id, () => adapter.start(), 'start');
    debugLog(`[IntegrationManager] ${id}: start → ${JSON.stringify(result)}`);
    results.push({ id, result });
  }
  return results;
}

function stopAll() {
  const results = [];
  for (const [id, adapter] of adapters) {
    const result = safeCall(id, () => adapter.stop(), 'stop');
    debugLog(`[IntegrationManager] ${id}: stop → ${JSON.stringify(result)}`);
    results.push({ id, result });
  }
  return results;
}

function getCapabilityReport() {
  const report = [];
  for (const [id, adapter] of adapters) {
    let installed = false;
    let integrated = false;
    let active = false;
    let error = null;
    let health = null;

    try {
      installed = !!adapter.detectInstalled();
    } catch (e) {
      error = e.message;
    }

    try {
      integrated = !!adapter.detectIntegrated();
    } catch (e) {
      if (!error) error = e.message;
    }

    try {
      health = adapter.getHealth();
      if (health && health.active !== undefined) {
        active = !!health.active;
      }
      if (health && health.error) {
        if (!error) error = health.error;
      }
    } catch (e) {
      if (!error) error = e.message;
    }

    report.push({
      source: adapter.id,
      label: adapter.label,
      installed,
      integrated,
      active,
      setupMode: adapter.setupMode || 'process-fallback',
      lastEventAt: (health && health.lastEventAt) || null,
      error
    });
  }
  return report;
}

function formatCapabilityReport(report) {
  if (!report || report.length === 0) {
    return '[IntegrationManager] Capability report: (no adapters registered)';
  }

  const lines = [];
  lines.push(`[IntegrationManager] ${report.length} adapters registered. Capability report:`);

  for (const entry of report) {
    let line = `  - ${entry.label}: installed=${entry.installed} integrated=${entry.integrated} active=${entry.active} setupMode=${entry.setupMode}`;

    if (entry.lastEventAt) {
      line += ` lastEventAt=${entry.lastEventAt}`;
    }

    if (entry.error) {
      line += ` [ERROR: ${entry.error}]`;
    }

    lines.push(line);
  }

  return lines.join('\n');
}

function getRegisteredAdapters() {
  return Array.from(adapters.keys());
}

function cleanup() {
  adapters.clear();
}

function registerDefaultAdapters(options) {
  const opts = options || {};
  const appConfig = opts.appConfig || {};
  const log = opts.debugLog || debugLog;

  const claudeAdapter = (function () {
    const cf = require('./claudeIntegration');
    if (typeof cf.createClaudeIntegration === 'function') {
      return cf.createClaudeIntegration({
        debugLog: log,
        homeDir: opts.homeDir || undefined,
      });
    }
    return cf;
  })();

  const grokAdapter = (function () {
    const gf = require('./grokIntegration');
    if (typeof gf.createGrokIntegration === 'function') {
      return gf.createGrokIntegration({
        debugLog: log,
        forwarderPath: opts.forwarderPath || null,
        homeDir: opts.homeDir || undefined,
      });
    }
    return gf;
  })();

  const codexAdapter = (function () {
    const cf = require('./codexIntegration');
    if (typeof cf.createCodexIntegration === 'function') {
      return cf.createCodexIntegration({
        debugLog: log,
        processAgentEvent: opts.processAgentEvent || null,
        homeDir: opts.homeDir || undefined,
      });
    }
    return cf;
  })();

  const antigravityAdapter = (function () {
    const af = require('./antigravityIntegration');
    if (typeof af.createAntigravityIntegration === 'function') {
      return af.createAntigravityIntegration({
        debugLog: log,
        forwarderPath: opts.forwarderPath || null,
        homeDir: opts.homeDir || undefined,
      });
    }
    return af;
  })();

  const opencodeAdapter = (function () {
    const of = require('./opencodeIntegration');
    if (typeof of.createOpenCodeIntegration === 'function') {
      return of.createOpenCodeIntegration({
        debugLog: log,
        sourcePath: opts.sourcePath || null,
        homeDir: opts.homeDir || undefined,
      });
    }
    return of;
  })();

  const allModules = [
    claudeAdapter,
    codexAdapter,
    grokAdapter,
    antigravityAdapter,
    opencodeAdapter
  ];

  const modules = allModules.filter(function (adapter) {
    if (adapter.id === 'claude-code' && appConfig.integrations && appConfig.integrations.claude && appConfig.integrations.claude.enabled === false) {
      log(`[IntegrationManager] Skipping ${adapter.id} (disabled in config)`);
      return false;
    }
    if (adapter.id === 'opencode' && appConfig.integrations && appConfig.integrations.opencode && appConfig.integrations.opencode.enabled === false) {
      log(`[IntegrationManager] Skipping ${adapter.id} (disabled in config)`);
      return false;
    }
    return true;
  });

  let count = 0;
  for (const adapter of modules) {
    if (registerAdapter(adapter)) {
      count++;
    }
  }

  log(`[IntegrationManager] Registered ${count} / ${modules.length} default adapters`);
  return count;
}

function ensureInstallableAdapters(options) {
  const opts = options || {};
  const appConfig = opts.appConfig || {};
  const log = opts.debugLog || debugLog;

  // Only claude-code and opencode are installable (write to home config).
  // Grok and Antigravity command-hooks are deferred to app startup.
  const installableIds = ['claude-code', 'opencode'];

  const results = [];

  for (const id of installableIds) {
    const adapter = adapters.get(id);
    if (!adapter) {
      log(`[IntegrationManager] ${id}: adapter not registered, skipping`);
      continue;
    }

    if (id === 'claude-code' && appConfig.integrations && appConfig.integrations.claude && appConfig.integrations.claude.enabled === false) {
      log(`[IntegrationManager] ${id}: disabled in config, skipping`);
      results.push({ id, status: 'skipped', reason: 'disabled' });
      continue;
    }
    if (id === 'opencode' && appConfig.integrations && appConfig.integrations.opencode && appConfig.integrations.opencode.enabled === false) {
      log(`[IntegrationManager] ${id}: disabled in config, skipping`);
      results.push({ id, status: 'skipped', reason: 'disabled' });
      continue;
    }

    const result = safeCall(id, () => adapter.ensureIntegration(), 'ensureIntegration');
    log(`[IntegrationManager] ${id}: ensureIntegration → ${JSON.stringify(result)}`);

    if (!result) {
      results.push({ id, status: 'failed', message: 'ensureIntegration failed' });
      continue;
    }

    const status = (result && result.status) ? result.status : 'unknown';
    results.push({ id, status, message: result.message || null });
  }

  return results;
}

module.exports = {
  init,
  registerAdapter,
  registerDefaultAdapters,
  ensureInstallableAdapters,
  detectAll,
  ensureAll,
  startAll,
  stopAll,
  getCapabilityReport,
  formatCapabilityReport,
  getRegisteredAdapters,
  cleanup
};
