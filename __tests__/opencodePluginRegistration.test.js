/**
 * opencodePluginRegistration.test.js
 * Tests for plugin registration/unregistration with injected temp paths
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

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

    // Write a minimal plugin source so the source file exists
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

  describe('registerOpenCodePlugin', () => {
    test('returns false when source file is missing', () => {
      fs.unlinkSync(sourcePath);

      const result = registerOpenCodePlugin(debugLog, { homeDir: tempDir, sourcePath });
      expect(result).toBe(false);
      expect(debugLog).toHaveBeenCalledWith(expect.stringContaining('not found'));
    });

    test('first install creates plugins dir, writes file, returns true', () => {
      expect(fs.existsSync(pluginDir())).toBe(false);

      const result = registerOpenCodePlugin(debugLog, { homeDir: tempDir, sourcePath });

      expect(result).toBe(true);
      expect(fs.existsSync(pluginDir())).toBe(true);
      expect(fs.existsSync(pluginTargetPath())).toBe(true);
      expect(fs.readFileSync(pluginTargetPath(), 'utf-8')).toBe('// test plugin source v1\n');
      expect(debugLog).toHaveBeenCalledWith(expect.stringContaining('for the first time'));
    });

    test('identical existing plugin returns true without rewriting', () => {
      registerOpenCodePlugin(debugLog, { homeDir: tempDir, sourcePath });
      debugLog.mockClear();
      const originalMtime = fs.statSync(pluginTargetPath()).mtimeMs;

      const result = registerOpenCodePlugin(debugLog, { homeDir: tempDir, sourcePath });

      expect(result).toBe(true);
      expect(fs.statSync(pluginTargetPath()).mtimeMs).toBe(originalMtime);
      expect(debugLog).toHaveBeenCalledWith(expect.stringContaining('already up-to-date'));
    });

    test('different existing plugin updates only pad-adapter.js', () => {
      registerOpenCodePlugin(debugLog, { homeDir: tempDir, sourcePath });

      // Also write another user-owned plugin file in the same dir
      const otherPlugin = path.join(pluginDir(), 'user-plugin.js');
      fs.writeFileSync(otherPlugin, '// user owned plugin', 'utf-8');

      // Update source content
      fs.writeFileSync(sourcePath, '// test plugin source v2\n', 'utf-8');
      debugLog.mockClear();

      const result = registerOpenCodePlugin(debugLog, { homeDir: tempDir, sourcePath });

      expect(result).toBe(true);
      expect(fs.readFileSync(pluginTargetPath(), 'utf-8')).toBe('// test plugin source v2\n');
      expect(fs.readFileSync(otherPlugin, 'utf-8')).toBe('// user owned plugin');
      expect(debugLog).toHaveBeenCalledWith(expect.stringContaining('differs'));
    });

    test('creates parent plugins dir if needed', () => {
      // No .config/opencode/ dirs exist yet
      expect(fs.existsSync(path.join(tempDir, '.config'))).toBe(false);

      registerOpenCodePlugin(debugLog, { homeDir: tempDir, sourcePath });

      expect(fs.existsSync(pluginTargetPath())).toBe(true);
    });

    test('returns false on write failure without crash', () => {
      // Create the target path as a directory to cause write to fail
      fs.mkdirSync(pluginDir(), { recursive: true });
      fs.mkdirSync(pluginTargetPath(), { recursive: true }); // target is a dir, not a file

      const result = registerOpenCodePlugin(debugLog, { homeDir: tempDir, sourcePath });

      expect(result).toBe(false);
      expect(debugLog).toHaveBeenCalledWith(expect.stringContaining('failed'));
    });
  });

  describe('unregisterOpenCodePlugin', () => {
    test('removes only pad-adapter.js, leaves other files', () => {
      fs.mkdirSync(pluginDir(), { recursive: true });
      fs.writeFileSync(pluginTargetPath(), '// PAD plugin', 'utf-8');
      const otherFile = path.join(pluginDir(), 'other.json');
      fs.writeFileSync(otherFile, '{}', 'utf-8');

      const result = unregisterOpenCodePlugin(debugLog, { homeDir: tempDir });

      expect(result).toBe(true);
      expect(fs.existsSync(pluginTargetPath())).toBe(false);
      expect(fs.existsSync(otherFile)).toBe(true);
    });

    test('returns true even if plugin is not installed', () => {
      const result = unregisterOpenCodePlugin(debugLog, { homeDir: tempDir });
      expect(result).toBe(true);
    });
  });

  describe('isOpenCodePluginRegistered', () => {
    test('returns false before registration', () => {
      expect(isOpenCodePluginRegistered({ homeDir: tempDir })).toBe(false);
    });

    test('returns true after registration', () => {
      registerOpenCodePlugin(debugLog, { homeDir: tempDir, sourcePath });
      expect(isOpenCodePluginRegistered({ homeDir: tempDir })).toBe(true);
    });

    test('returns false after unregister', () => {
      registerOpenCodePlugin(debugLog, { homeDir: tempDir, sourcePath });
      unregisterOpenCodePlugin(debugLog, { homeDir: tempDir });
      expect(isOpenCodePluginRegistered({ homeDir: tempDir })).toBe(false);
    });
  });
});
