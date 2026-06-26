/**
 * opencodeIntegration.test.js
 * Tests for OpenCode integration adapter: detect, ensure, health, start/stop
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const { createOpenCodeIntegration } = require('../src/main/integrations/opencodeIntegration');

describe('opencodeIntegration', () => {
  let tempDir;
  let pluginSourceDir;
  let sourcePath;
  let adapter;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pad-oc-int-'));
    pluginSourceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pad-oc-src-'));
    sourcePath = path.join(pluginSourceDir, 'opencode-plugin.js');
    fs.writeFileSync(sourcePath, '// PAD plugin v1\n', 'utf-8');

    adapter = createOpenCodeIntegration({
      homeDir: tempDir,
      sourcePath,
      debugLog: jest.fn(),
    });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
    fs.rmSync(pluginSourceDir, { recursive: true, force: true });
  });

  function pluginTargetPath() {
    return path.join(tempDir, '.config', 'opencode', 'plugins', 'pad-adapter.js');
  }

  function openWorkRoot() {
    return path.join(tempDir, 'Library', '.opencode');
  }

  function openWorkPluginTargetPath() {
    return path.join(openWorkRoot(), 'plugins', 'pad-adapter.js');
  }

  function opencodeConfigPath() {
    return path.join(tempDir, '.config', 'opencode', 'opencode.json');
  }

  function openWorkConfigPath() {
    return path.join(openWorkRoot(), 'openwork.json');
  }

  function seedOpenCodeEnvironment() {
    fs.mkdirSync(path.dirname(opencodeConfigPath()), { recursive: true });
    fs.writeFileSync(opencodeConfigPath(), JSON.stringify({ plugin: [] }), 'utf-8');
  }

  function seedOpenWorkEnvironment() {
    fs.mkdirSync(openWorkRoot(), { recursive: true });
    fs.writeFileSync(openWorkConfigPath(), JSON.stringify({ version: 1, plugin: [] }), 'utf-8');
  }

  describe('interface', () => {
    test('exports required adapter fields', () => {
      expect(adapter).toMatchObject({
        id: 'opencode',
        label: 'OpenWork',
        setupMode: 'opencode-plugin',
      });
      expect(typeof adapter.detectInstalled).toBe('function');
      expect(typeof adapter.detectIntegrated).toBe('function');
      expect(typeof adapter.ensureIntegration).toBe('function');
      expect(typeof adapter.start).toBe('function');
      expect(typeof adapter.stop).toBe('function');
      expect(typeof adapter.getHealth).toBe('function');
    });
  });

  describe('detectInstalled', () => {
    test('returns false when no opencode config directory', () => {
      const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pad-oc-empty-'));
      const ad = createOpenCodeIntegration({
        homeDir: emptyDir,
        sourcePath: path.join(emptyDir, 'nonexistent.js'),
      });

      expect(ad.detectInstalled()).toBe(false);
      fs.rmSync(emptyDir, { recursive: true, force: true });
    });

    test('returns false when opencode config directory does not exist in temp home', () => {
      expect(adapter.detectInstalled()).toBe(false);
    });

    test('returns true when opencode config directory is present', () => {
      const configDir = path.join(tempDir, '.config', 'opencode');
      fs.mkdirSync(configDir, { recursive: true });

      expect(adapter.detectInstalled()).toBe(true);
    });

    test('returns true when OpenWork opencode directory is present', () => {
      fs.mkdirSync(openWorkRoot(), { recursive: true });

      expect(adapter.detectInstalled()).toBe(true);
    });
  });

  describe('detectIntegrated', () => {
    test('returns false when plugin is not installed', () => {
      expect(fs.existsSync(pluginTargetPath())).toBe(false);
      expect(adapter.detectIntegrated()).toBe(false);
    });

    test('returns true after ensureIntegration installs the plugin', () => {
      seedOpenCodeEnvironment();
      adapter.ensureIntegration();
      expect(adapter.detectIntegrated()).toBe(true);
    });

    test('returns true after ensureIntegration installs OpenWork plugin', () => {
      seedOpenCodeEnvironment();
      seedOpenWorkEnvironment();

      adapter.ensureIntegration();

      expect(adapter.detectIntegrated()).toBe(true);
      expect(fs.existsSync(openWorkPluginTargetPath())).toBe(true);
    });
  });

  describe('ensureIntegration', () => {
    test('installs plugin and returns installed status', () => {
      seedOpenCodeEnvironment();
      expect(fs.existsSync(pluginTargetPath())).toBe(false);

      const result = adapter.ensureIntegration();

      expect(result).toEqual({ status: 'installed' });
      expect(fs.existsSync(pluginTargetPath())).toBe(true);
    });

    test('installs plugin into OpenWork directory when available', () => {
      seedOpenCodeEnvironment();
      seedOpenWorkEnvironment();

      const result = adapter.ensureIntegration();

      expect(result).toEqual({ status: 'installed' });
      expect(fs.existsSync(pluginTargetPath())).toBe(true);
      expect(fs.existsSync(openWorkPluginTargetPath())).toBe(true);
    });

    test('returns installed when plugin already installed and identical', () => {
      seedOpenCodeEnvironment();
      adapter.ensureIntegration();

      const result = adapter.ensureIntegration();

      expect(result).toEqual({ status: 'installed' });
    });

    test('returns failed when source path is missing', () => {
      seedOpenCodeEnvironment();
      fs.unlinkSync(sourcePath);

      const result = adapter.ensureIntegration();

      expect(result).toMatchObject({ status: 'failed' });
      expect(fs.existsSync(pluginTargetPath())).toBe(false);
    });
  });

  describe('start / stop', () => {
    test('start returns skipped without changing active state', () => {
      const result = adapter.start();

      expect(result).toEqual({ status: 'skipped', message: expect.stringContaining('not yet implemented') });
      expect(adapter.getHealth().active).toBe(false);
    });

    test('stop returns skipped', () => {
      const result = adapter.stop();

      expect(result).toEqual({ status: 'skipped', message: expect.stringContaining('not yet implemented') });
    });
  });

  describe('getHealth', () => {
    test('returns expected shape with active=false', () => {
      expect(adapter.getHealth()).toEqual({
        active: false,
        lastEventAt: null,
        error: null,
      });
    });
  });

  describe('integration flow', () => {
    test('full lifecycle: not integrated → ensure → integrated → start → health', () => {
      seedOpenCodeEnvironment();
      expect(adapter.detectIntegrated()).toBe(false);

      const ensured = adapter.ensureIntegration();
      expect(ensured.status).toBe('installed');
      expect(adapter.detectIntegrated()).toBe(true);

      adapter.start();

      const health = adapter.getHealth();
      expect(health.active).toBe(false);
      expect(health.error).toBeNull();
    });
  });
});
