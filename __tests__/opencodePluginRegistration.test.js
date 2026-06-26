/**
 * opencodePluginRegistration.test.js
 * Tests for plugin registration/unregistration with injected temp paths
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { parse } = require('jsonc-parser');

const {
  registerOpenCodePlugin,
  unregisterOpenCodePlugin,
  isOpenCodePluginRegistered,
} = require('../src/main/opencodePluginRegistration');

describe('opencodePluginRegistration', () => {
  let tempDir;
  let pluginSourceDir;
  let sourcePath;
  let debugLog;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pad-plugin-test-'));
    pluginSourceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pad-plugin-src-'));
    sourcePath = path.join(pluginSourceDir, 'opencode-plugin.js');
    debugLog = jest.fn();

    fs.writeFileSync(sourcePath, '// test plugin source v1\n', 'utf-8');
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
    fs.rmSync(pluginSourceDir, { recursive: true, force: true });
  });

  function pluginTargetPath() {
    return path.join(tempDir, '.config', 'opencode', 'plugins', 'pad-adapter.js');
  }

  function pluginDir() {
    return path.join(tempDir, '.config', 'opencode', 'plugins');
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

  function opencodeJsoncPath() {
    return path.join(tempDir, '.config', 'opencode', 'opencode.jsonc');
  }

  function openWorkConfigPath() {
    return path.join(openWorkRoot(), 'openwork.json');
  }

  function seedOpenCodeEnvironment(config) {
    fs.mkdirSync(path.dirname(opencodeConfigPath()), { recursive: true });
    fs.writeFileSync(opencodeConfigPath(), JSON.stringify(config || { plugin: [] }), 'utf-8');
  }

  function seedOpenWorkEnvironment(config) {
    fs.mkdirSync(openWorkRoot(), { recursive: true });
    fs.writeFileSync(openWorkConfigPath(), JSON.stringify(config || { version: 1, plugin: [] }), 'utf-8');
  }

  describe('registerOpenCodePlugin', () => {
    test('returns false when source file is missing', () => {
      seedOpenCodeEnvironment();
      fs.unlinkSync(sourcePath);

      const result = registerOpenCodePlugin(debugLog, { homeDir: tempDir, sourcePath });
      expect(result).toBe(false);
      expect(debugLog).toHaveBeenCalledWith(expect.stringContaining('not found'));
    });

    test('silently skips when ~/.config/opencode does not exist', () => {
      const result = registerOpenCodePlugin(debugLog, { homeDir: tempDir, sourcePath });

      expect(result).toBe(true);
      expect(fs.existsSync(path.join(tempDir, '.config'))).toBe(false);
      expect(debugLog).not.toHaveBeenCalled();
    });

    test('silently skips when opencode dir exists but config file is missing', () => {
      fs.mkdirSync(path.join(tempDir, '.config', 'opencode'), { recursive: true });

      const result = registerOpenCodePlugin(debugLog, { homeDir: tempDir, sourcePath });

      expect(result).toBe(true);
      expect(fs.existsSync(pluginDir())).toBe(false);
      expect(debugLog).not.toHaveBeenCalled();
    });

    test('first install creates plugins dir, writes file, returns true', () => {
      seedOpenCodeEnvironment();

      const result = registerOpenCodePlugin(debugLog, { homeDir: tempDir, sourcePath });

      expect(result).toBe(true);
      expect(fs.existsSync(pluginDir())).toBe(true);
      expect(fs.existsSync(pluginTargetPath())).toBe(true);
      expect(fs.readFileSync(pluginTargetPath(), 'utf-8')).toBe('// test plugin source v1\n');
      expect(debugLog).toHaveBeenCalledWith(expect.stringContaining('for the first time'));
    });

    test('identical existing plugin returns true without rewriting', () => {
      seedOpenCodeEnvironment();
      registerOpenCodePlugin(debugLog, { homeDir: tempDir, sourcePath });
      debugLog.mockClear();
      const originalMtime = fs.statSync(pluginTargetPath()).mtimeMs;

      const result = registerOpenCodePlugin(debugLog, { homeDir: tempDir, sourcePath });

      expect(result).toBe(true);
      expect(fs.statSync(pluginTargetPath()).mtimeMs).toBe(originalMtime);
      expect(debugLog).toHaveBeenCalledWith(expect.stringContaining('already up-to-date'));
    });

    test('different existing plugin updates only pad-adapter.js', () => {
      seedOpenCodeEnvironment();
      registerOpenCodePlugin(debugLog, { homeDir: tempDir, sourcePath });

      const otherPlugin = path.join(pluginDir(), 'user-plugin.js');
      fs.writeFileSync(otherPlugin, '// user owned plugin', 'utf-8');

      fs.writeFileSync(sourcePath, '// test plugin source v2\n', 'utf-8');
      debugLog.mockClear();

      const result = registerOpenCodePlugin(debugLog, { homeDir: tempDir, sourcePath });

      expect(result).toBe(true);
      expect(fs.readFileSync(pluginTargetPath(), 'utf-8')).toBe('// test plugin source v2\n');
      expect(fs.readFileSync(otherPlugin, 'utf-8')).toBe('// user owned plugin');
      expect(debugLog).toHaveBeenCalledWith(expect.stringContaining('differs'));
    });

    test('creates plugins dir only inside an existing active environment', () => {
      seedOpenCodeEnvironment();
      expect(fs.existsSync(pluginDir())).toBe(false);

      registerOpenCodePlugin(debugLog, { homeDir: tempDir, sourcePath });

      expect(fs.existsSync(pluginTargetPath())).toBe(true);
    });

    test('also installs into OpenWork when root and openwork.json exist', () => {
      seedOpenCodeEnvironment();
      seedOpenWorkEnvironment();

      const result = registerOpenCodePlugin(debugLog, { homeDir: tempDir, sourcePath });

      expect(result).toBe(true);
      expect(fs.existsSync(pluginTargetPath())).toBe(true);
      expect(fs.existsSync(openWorkPluginTargetPath())).toBe(true);
      expect(fs.readFileSync(openWorkPluginTargetPath(), 'utf-8')).toBe('// test plugin source v1\n');
    });

    test('warns gracefully and returns true when plugin write fails', () => {
      seedOpenCodeEnvironment();
      fs.mkdirSync(pluginDir(), { recursive: true });
      fs.mkdirSync(pluginTargetPath(), { recursive: true });

      const result = registerOpenCodePlugin(debugLog, { homeDir: tempDir, sourcePath });

      expect(result).toBe(true);
      expect(debugLog).toHaveBeenCalledWith(expect.stringContaining('Unable to register OpenCode plugin automatically'));
    });

    test('does not create opencode.json when config is missing', () => {
      fs.mkdirSync(path.join(tempDir, '.config', 'opencode'), { recursive: true });

      registerOpenCodePlugin(debugLog, { homeDir: tempDir, sourcePath });

      expect(fs.existsSync(opencodeConfigPath())).toBe(false);
    });

    test('merges absolute plugin path into existing opencode.json', () => {
      seedOpenCodeEnvironment({ plugin: [] });

      registerOpenCodePlugin(debugLog, { homeDir: tempDir, sourcePath });

      const config = JSON.parse(fs.readFileSync(opencodeConfigPath(), 'utf-8'));
      expect(config.plugin).toEqual([pluginTargetPath()]);
      expect(config.$schema).toBe('https://opencode.ai/config.json');
    });

    test('upgrades relative pad-adapter path to absolute without touching other keys', () => {
      seedOpenCodeEnvironment({
        provider: { demo: { npm: '@scope/pkg' } },
        plugin: ['./plugins/pad-adapter.js', 'other-plugin'],
      });

      registerOpenCodePlugin(debugLog, { homeDir: tempDir, sourcePath });

      const config = JSON.parse(fs.readFileSync(opencodeConfigPath(), 'utf-8'));
      expect(config.provider).toEqual({ demo: { npm: '@scope/pkg' } });
      expect(config.plugin).toEqual([pluginTargetPath(), 'other-plugin']);
      expect(config.plugins).toBeUndefined();
    });

    test('removes invalid plugins key and migrates pad-adapter entry to plugin', () => {
      fs.mkdirSync(path.dirname(opencodeConfigPath()), { recursive: true });
      fs.writeFileSync(
        opencodeConfigPath(),
        JSON.stringify({
          plugins: ['./plugins/pad-adapter.js'],
        }),
        'utf-8'
      );

      registerOpenCodePlugin(debugLog, { homeDir: tempDir, sourcePath });

      const config = JSON.parse(fs.readFileSync(opencodeConfigPath(), 'utf-8'));
      expect(config.plugins).toBeUndefined();
      expect(config.plugin).toEqual([pluginTargetPath()]);
      expect(debugLog).toHaveBeenCalledWith(expect.stringContaining('invalid "plugins" key'));
    });

    test('appends pad-adapter to existing plugin array without duplicating absolute path', () => {
      seedOpenCodeEnvironment({
        plugin: [pluginTargetPath(), 'other-plugin'],
      });
      fs.mkdirSync(pluginDir(), { recursive: true });
      fs.writeFileSync(pluginTargetPath(), '// test plugin source v1\n', 'utf-8');

      registerOpenCodePlugin(debugLog, { homeDir: tempDir, sourcePath });

      const config = JSON.parse(fs.readFileSync(opencodeConfigPath(), 'utf-8'));
      expect(config.plugin).toEqual([pluginTargetPath(), 'other-plugin']);
    });

    test('merges opencode.jsonc and preserves comments', () => {
      const jsoncPath = opencodeJsoncPath();
      fs.mkdirSync(path.dirname(jsoncPath), { recursive: true });
      fs.writeFileSync(
        jsoncPath,
        '{\n  // provider config\n  "provider": { "demo": true },\n  "plugin": ["other-plugin"]\n}\n',
        'utf-8'
      );

      registerOpenCodePlugin(debugLog, { homeDir: tempDir, sourcePath });

      const raw = fs.readFileSync(jsoncPath, 'utf-8');
      expect(raw).toContain('// provider config');
      const config = parse(raw);
      expect(config.provider).toEqual({ demo: true });
      expect(config.plugin).toEqual(['other-plugin', pluginTargetPath()]);
    });

    test('warns gracefully and continues when config write fails', () => {
      seedOpenCodeEnvironment({ plugin: [] });
      fs.chmodSync(opencodeConfigPath(), 0o444);

      try {
        const result = registerOpenCodePlugin(debugLog, { homeDir: tempDir, sourcePath });

        expect(result).toBe(true);
        expect(fs.existsSync(pluginTargetPath())).toBe(true);
        expect(debugLog).toHaveBeenCalledWith(expect.stringContaining('Unable to register OpenCode plugin automatically'));
      } finally {
        fs.chmodSync(opencodeConfigPath(), 0o644);
      }
    });

    test('writes openwork.json with absolute plugin path when OpenWork config exists', () => {
      seedOpenCodeEnvironment();
      seedOpenWorkEnvironment({
        version: 1,
        plugin: ['./plugins/pad-adapter.js'],
      });

      registerOpenCodePlugin(debugLog, { homeDir: tempDir, sourcePath });

      const config = JSON.parse(fs.readFileSync(openWorkConfigPath(), 'utf-8'));
      expect(config.version).toBe(1);
      expect(config.plugin).toEqual([openWorkPluginTargetPath()]);
    });
  });

  describe('unregisterOpenCodePlugin', () => {
    test('removes only pad-adapter.js, leaves other files', () => {
      seedOpenCodeEnvironment();
      fs.mkdirSync(pluginDir(), { recursive: true });
      fs.writeFileSync(pluginTargetPath(), '// PAD plugin', 'utf-8');
      const otherFile = path.join(pluginDir(), 'other.json');
      fs.writeFileSync(otherFile, '{}', 'utf-8');

      const result = unregisterOpenCodePlugin(debugLog, { homeDir: tempDir });

      expect(result).toBe(true);
      expect(fs.existsSync(pluginTargetPath())).toBe(false);
      expect(fs.existsSync(otherFile)).toBe(true);
    });

    test('removes OpenWork pad-adapter.js when OpenWork root exists', () => {
      seedOpenWorkEnvironment();
      fs.mkdirSync(path.dirname(openWorkPluginTargetPath()), { recursive: true });
      fs.writeFileSync(openWorkPluginTargetPath(), '// PAD plugin', 'utf-8');

      const result = unregisterOpenCodePlugin(debugLog, { homeDir: tempDir });

      expect(result).toBe(true);
      expect(fs.existsSync(openWorkPluginTargetPath())).toBe(false);
    });

    test('returns true even if plugin is not installed', () => {
      const result = unregisterOpenCodePlugin(debugLog, { homeDir: tempDir });
      expect(result).toBe(true);
    });

    test('removes pad-adapter from plugin arrays but preserves other plugins', () => {
      seedOpenCodeEnvironment({
        plugin: [pluginTargetPath(), 'other-plugin'],
      });
      fs.mkdirSync(pluginDir(), { recursive: true });
      fs.writeFileSync(pluginTargetPath(), '// PAD plugin', 'utf-8');

      unregisterOpenCodePlugin(debugLog, { homeDir: tempDir });

      const config = JSON.parse(fs.readFileSync(opencodeConfigPath(), 'utf-8'));
      expect(config.plugin).toEqual(['other-plugin']);
    });
  });

  describe('isOpenCodePluginRegistered', () => {
    test('returns false before registration', () => {
      expect(isOpenCodePluginRegistered({ homeDir: tempDir })).toBe(false);
    });

    test('returns true after registration', () => {
      seedOpenCodeEnvironment();
      registerOpenCodePlugin(debugLog, { homeDir: tempDir, sourcePath });
      expect(isOpenCodePluginRegistered({ homeDir: tempDir })).toBe(true);
    });

    test('requires OpenWork plugin when OpenWork environment is active', () => {
      seedOpenCodeEnvironment();
      seedOpenWorkEnvironment();
      fs.mkdirSync(pluginDir(), { recursive: true });
      fs.writeFileSync(pluginTargetPath(), '// PAD plugin', 'utf-8');

      expect(isOpenCodePluginRegistered({ homeDir: tempDir })).toBe(false);
    });

    test('returns false after unregister', () => {
      seedOpenCodeEnvironment();
      registerOpenCodePlugin(debugLog, { homeDir: tempDir, sourcePath });
      unregisterOpenCodePlugin(debugLog, { homeDir: tempDir });
      expect(isOpenCodePluginRegistered({ homeDir: tempDir })).toBe(false);
    });
  });
});