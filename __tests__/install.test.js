/**
 * install.test.js
 * Tests for install-time integration registration via runInstall().
 * All tests use temp home directories — no real ~/.claude or ~/.config/opencode.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const { runInstall } = require('../src/install');
const integrationManager = require('../src/main/integrations/integrationManager');

function defaultAppConfig(overrides) {
  return {
    integrations: {
      claude: { enabled: true },
      opencode: { enabled: true },
      ...overrides,
    },
  };
}

describe('runInstall', () => {
  let tempDir;
  let pluginSourceDir;
  let sourcePath;
  let debugLog;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pad-install-'));
    pluginSourceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pad-install-src-'));
    sourcePath = path.join(pluginSourceDir, 'opencode-plugin.js');
    fs.writeFileSync(sourcePath, '// plugin stub', 'utf-8');
    debugLog = jest.fn();

    // Seed OpenCode environment
    const opencodeConfigDir = path.join(tempDir, '.config', 'opencode');
    fs.mkdirSync(opencodeConfigDir, { recursive: true });
    fs.writeFileSync(path.join(opencodeConfigDir, 'opencode.json'), JSON.stringify({ plugin: [] }), 'utf-8');
  });

  afterEach(() => {
    jest.restoreAllMocks();
    fs.rmSync(tempDir, { recursive: true, force: true });
    fs.rmSync(pluginSourceDir, { recursive: true, force: true });
  });

  describe('Claude integration', () => {
    test('disabled config does not create .claude/settings.json', () => {
      const result = runInstall({
        homeDir: tempDir,
        sourcePath,
        debugLog,
        appConfig: defaultAppConfig({ claude: { enabled: false } }),
      });

      expect(result.ok).toBe(true);

      const settingsPath = path.join(tempDir, '.claude', 'settings.json');
      expect(fs.existsSync(settingsPath)).toBe(false);
    });

    test('enabled config creates .claude/settings.json with PAD hooks', () => {
      const result = runInstall({
        homeDir: tempDir,
        sourcePath,
        debugLog,
        appConfig: defaultAppConfig(),
      });

      expect(result.ok).toBe(true);

      const settingsPath = path.join(tempDir, '.claude', 'settings.json');
      expect(fs.existsSync(settingsPath)).toBe(true);
    });

    test('preserves existing user hooks/permissions in settings.json', () => {
      const claudeDir = path.join(tempDir, '.claude');
      fs.mkdirSync(claudeDir, { recursive: true });
      const settingsPath = path.join(claudeDir, 'settings.json');

      const existing = {
        permissions: {
          deny: ['Bash(rm:*)'],
        },
        hooks: {
          UserPromptSubmit: [
            { matcher: '', hooks: [{ type: 'command', command: 'my-hook.sh' }] },
          ],
        },
      };
      fs.writeFileSync(settingsPath, JSON.stringify(existing, null, 2), 'utf-8');

      const result = runInstall({
        homeDir: tempDir,
        sourcePath,
        debugLog,
        appConfig: defaultAppConfig(),
      });

      expect(result.ok).toBe(true);

      const updated = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
      expect(updated.permissions.deny).toContain('Bash(rm:*)');
    });
  });

  describe('OpenCode integration', () => {
    test('disabled config does not create plugin file', () => {
      const result = runInstall({
        homeDir: tempDir,
        sourcePath,
        debugLog,
        appConfig: defaultAppConfig({ opencode: { enabled: false } }),
      });

      expect(result.ok).toBe(true);

      const pluginPath = path.join(tempDir, '.config', 'opencode', 'plugins', 'pad-adapter.js');
      expect(fs.existsSync(pluginPath)).toBe(false);
    });

    test('enabled config installs plugin to temp home', () => {
      const result = runInstall({
        homeDir: tempDir,
        sourcePath,
        debugLog,
        appConfig: defaultAppConfig(),
      });

      expect(result.ok).toBe(true);

      const pluginPath = path.join(tempDir, '.config', 'opencode', 'plugins', 'pad-adapter.js');
      expect(fs.existsSync(pluginPath)).toBe(true);
    });
  });

  describe('failure handling', () => {
    test('returns ok: false when source file is missing', () => {
      fs.unlinkSync(sourcePath);

      const result = runInstall({
        homeDir: tempDir,
        sourcePath,
        debugLog,
        appConfig: defaultAppConfig({ claude: { enabled: false } }),
      });

      expect(result.ok).toBe(false);
      expect(result.results.some(function (r) { return r.status === 'failed'; })).toBe(true);
    });
  });

  describe('integration manager usage', () => {
    test('does not call startAll (no active observers)', () => {
      const startSpy = jest.spyOn(integrationManager, 'startAll');

      const result = runInstall({
        homeDir: tempDir,
        sourcePath,
        debugLog,
        appConfig: defaultAppConfig(),
      });

      expect(result.ok).toBe(true);
      expect(result.results).toBeDefined();
      expect(result.results.length).toBeGreaterThanOrEqual(1);
      expect(startSpy).not.toHaveBeenCalled();

      startSpy.mockRestore();
    });

    test('OpenCode factory receives injected homeDir', () => {
      // Verify by checking that the plugin is installed in the temp home, not real home
      const result = runInstall({
        homeDir: tempDir,
        sourcePath,
        debugLog,
        appConfig: defaultAppConfig({ claude: { enabled: false } }),
      });

      expect(result.ok).toBe(true);

      // Plugin should be in temp home
      const pluginPath = path.join(tempDir, '.config', 'opencode', 'plugins', 'pad-adapter.js');
      expect(fs.existsSync(pluginPath)).toBe(true);
    });

    test('both integrations can succeed simultaneously', () => {
      const result = runInstall({
        homeDir: tempDir,
        sourcePath,
        debugLog,
        appConfig: defaultAppConfig(),
      });

      expect(result.ok).toBe(true);
      expect(result.results.every(function (r) { return r.status !== 'failed'; })).toBe(true);
    });
  });
});
