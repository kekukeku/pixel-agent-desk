/**
 * diagnose-integrations.test.js
 * Tests for runDiagnostics() — read-only integration smoke check.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const { runDiagnostics } = require('../scripts/diagnose-integrations');

function defaultAppConfig(overrides) {
  return {
    integrations: {
      claude: { enabled: true },
      opencode: { enabled: true },
      ...overrides,
    },
  };
}

describe('runDiagnostics', () => {
  let tempDir;
  let debugLog;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pad-diag-'));
    debugLog = jest.fn();
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test('returns ok=true when no adapters have errors', () => {
    const result = runDiagnostics({
      homeDir: tempDir,
      debugLog,
      appConfig: defaultAppConfig(),
    });

    expect(result.ok).toBe(true);
    expect(result.report).toBeDefined();
  });

  test('includes formatted report in result', () => {
    const result = runDiagnostics({
      homeDir: tempDir,
      debugLog,
      appConfig: defaultAppConfig(),
    });

    expect(result.formatted).toBeDefined();
    expect(typeof result.formatted).toBe('string');
    expect(result.formatted).toContain('Capability report');
  });

  test('includes config summary in result', () => {
    const result = runDiagnostics({
      homeDir: tempDir,
      debugLog,
      appConfig: defaultAppConfig(),
    });

    expect(result.config).toEqual({ claude: true, opencode: true });
  });

  test('does not call ensureAll', () => {
    runDiagnostics({
      homeDir: tempDir,
      debugLog,
      appConfig: defaultAppConfig(),
    });

    // ensureAll would have written files — verify none were created
    const claudeSettings = path.join(tempDir, '.claude', 'settings.json');
    expect(fs.existsSync(claudeSettings)).toBe(false);

    const grokHooks = path.join(tempDir, '.grok', 'hooks', 'pixel-agent-desk.json');
    expect(fs.existsSync(grokHooks)).toBe(false);

    const geminiHooks = path.join(tempDir, '.gemini', 'config', 'hooks.json');
    expect(fs.existsSync(geminiHooks)).toBe(false);
  });

  test('does not call ensureInstallableAdapters (no file writes)', () => {
    runDiagnostics({
      homeDir: tempDir,
      debugLog,
      appConfig: defaultAppConfig(),
    });

    const pluginPath = path.join(tempDir, '.config', 'opencode', 'plugins', 'pad-adapter.js');
    expect(fs.existsSync(pluginPath)).toBe(false);
  });

    test('does not call startAll (Codex observer not started)', () => {
      const result = runDiagnostics({
        homeDir: tempDir,
        debugLog,
        appConfig: defaultAppConfig(),
      });

    // All adapters should report active=false since startAll was not called
    for (const entry of result.report) {
      expect(entry.active).toBe(false);
    }
  });

  test('disabled Claude filtered from report', () => {
    const result = runDiagnostics({
      homeDir: tempDir,
      debugLog,
      appConfig: defaultAppConfig({ claude: { enabled: false } }),
    });

    const claudeEntry = result.report.find(function (e) { return e.source === 'claude-code'; });
    expect(claudeEntry).toBeUndefined();
  });

  test('disabled OpenCode filtered from report', () => {
    const result = runDiagnostics({
      homeDir: tempDir,
      debugLog,
      appConfig: defaultAppConfig({ opencode: { enabled: false } }),
    });

    const ocEntry = result.report.find(function (e) { return e.source === 'opencode'; });
    expect(ocEntry).toBeUndefined();
  });

  test('config summary reflects disabled state', () => {
    const result = runDiagnostics({
      homeDir: tempDir,
      debugLog,
      appConfig: defaultAppConfig({ claude: { enabled: false } }),
    });

    expect(result.config.claude).toBe(false);
    expect(result.config.opencode).toBe(true);
  });

  test('does not write any home config files', () => {
    runDiagnostics({
      homeDir: tempDir,
      debugLog,
      appConfig: defaultAppConfig(),
    });

    expect(fs.existsSync(path.join(tempDir, '.claude'))).toBe(false);
    expect(fs.existsSync(path.join(tempDir, '.grok'))).toBe(false);
    expect(fs.existsSync(path.join(tempDir, '.gemini'))).toBe(false);
    expect(fs.existsSync(path.join(tempDir, '.config'))).toBe(false);
  });

  test('returns ok=false when report contains error', () => {
    const integrationManager = require('../src/main/integrations/integrationManager');
    const orig = integrationManager.getCapabilityReport;
    integrationManager.getCapabilityReport = jest.fn(function () {
      return [{
        source: 'codex', label: 'Codex', installed: true, integrated: true,
        active: false, setupMode: 'read-only-observer', lastEventAt: null,
        error: 'fs access denied',
      }];
    });
    try {
      const result = runDiagnostics({
        homeDir: tempDir,
        appConfig: defaultAppConfig(),
        debugLog,
      });
      expect(result.ok).toBe(false);
      expect(result.formatted).toContain('[ERROR: fs access denied]');
    } finally {
      integrationManager.getCapabilityReport = orig;
      integrationManager.cleanup();
    }
  });
});
