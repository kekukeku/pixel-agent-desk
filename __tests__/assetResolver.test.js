/**
 * assetResolver.test.js
 * Tests for asset materialization and hook command builder.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const {
  shellQuote,
  resolveSourcePath,
  resolveCachedPath,
  materializeAssets,
  getHookRunnerCommand,
  getForwardersCacheDir,
  getPluginsCacheDir,
} = require('../src/main/integrations/assetResolver');

describe('shellQuote', () => {
  test('wraps path in double quotes', () => {
    expect(shellQuote('/simple/path')).toBe('"/simple/path"');
  });

  test('escapes internal double quotes', () => {
    expect(shellQuote('/path/with/"quotes')).toBe('"/path/with/\\"quotes"');
  });
});

describe('resolveSourcePath', () => {
  test('resolves relative path from app root', () => {
    const result = resolveSourcePath('src/forwarders/grok-forwarder.js');
    expect(result).toContain('src/forwarders/grok-forwarder.js');
  });
});

describe('resolveCachedPath', () => {
  test('resolves forwarder to forwarders cache dir', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pad-ar-'));
    const result = resolveCachedPath('src/forwarders/grok-forwarder.js', { homeDir: tempDir });
    expect(result).toContain('.pixel-agent-desk');
    expect(result).toContain('forwarders');
    expect(result).toContain('grok-forwarder.js');
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test('resolves plugin to adapters cache dir', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pad-ar-'));
    const result = resolveCachedPath('src/adapters/opencode-plugin.js', { homeDir: tempDir });
    expect(result).toContain('.pixel-agent-desk');
    expect(result).toContain('runtime');
    expect(result).toContain('opencode-plugin.js');
    fs.rmSync(tempDir, { recursive: true, force: true });
  });
});

describe('materializeAssets', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pad-ar-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test('creates target folder and copies files', () => {
    const results = materializeAssets({ homeDir: tempDir, debugLog: jest.fn() });

    // All six assets should be materialized
    expect(results.length).toBe(6);
    for (const r of results) {
      expect(r.ok).toBe(true);
    }

    // Check files exist in cache
    const fwdDir = getForwardersCacheDir({ homeDir: tempDir });
    const pluginsDir = getPluginsCacheDir({ homeDir: tempDir });

    expect(fs.existsSync(path.join(fwdDir, 'grok-forwarder.js'))).toBe(true);
    expect(fs.existsSync(path.join(fwdDir, 'claude-forwarder.js'))).toBe(true);
    expect(fs.existsSync(path.join(fwdDir, 'antigravity-forwarder.js'))).toBe(true);
    expect(fs.existsSync(path.join(pluginsDir, 'opencode-plugin.js'))).toBe(true);
  });

  test('idempotent — does not overwrite when content matches', () => {
    materializeAssets({ homeDir: tempDir, debugLog: jest.fn() });

    const fwdPath = path.join(getForwardersCacheDir({ homeDir: tempDir }), 'grok-forwarder.js');
    const mtimeBefore = fs.statSync(fwdPath).mtimeMs;

    materializeAssets({ homeDir: tempDir, debugLog: jest.fn() });

    const mtimeAfter = fs.statSync(fwdPath).mtimeMs;
    expect(mtimeAfter).toBe(mtimeBefore);
  });
});

describe('getHookRunnerCommand', () => {
  test('uses node when node is available', () => {
    const cmd = getHookRunnerCommand('/path/to/fwd.js', 'PreToolUse', { nodeAvailable: true });
    expect(cmd).toContain('node');
    expect(cmd).toContain('"/path/to/fwd.js"');
    expect(cmd).toContain('PreToolUse');
    expect(cmd).not.toContain('ELECTRON_RUN_AS_NODE');
  });

  test('macOS/Linux fallback to Electron prepends env var', () => {
    const cmd = getHookRunnerCommand('/path/to/fwd.js', 'Stop', {
      nodeAvailable: false,
      platform: 'darwin',
      execPath: '/Applications/My App.app/Contents/MacOS/Electron',
    });
    expect(cmd).toContain('ELECTRON_RUN_AS_NODE=1');
    expect(cmd).toContain('"/path/to/fwd.js"');
    expect(cmd).toContain('Stop');
    expect(cmd).not.toContain('cmd');
  });

  test('Windows fallback wraps in cmd /C', () => {
    const cmd = getHookRunnerCommand('C:\\tools\\fwd.js', 'PreInvocation', {
      nodeAvailable: false,
      platform: 'win32',
      execPath: 'C:\\Program Files\\App\\app.exe',
    });
    expect(cmd).toContain('cmd /C');
    expect(cmd).toContain('ELECTRON_RUN_AS_NODE=1');
    expect(cmd).toContain('"C:\\tools\\fwd.js"');
    expect(cmd).toContain('PreInvocation');
  });

  test('handles paths with spaces', () => {
    const cmd = getHookRunnerCommand('/my path/with spaces/fwd.js', 'PreToolUse', { nodeAvailable: true });
    expect(cmd).toContain('"/my path/with spaces/fwd.js"');
  });

  test('omits event name when not provided', () => {
    const cmd = getHookRunnerCommand('/fwd.js', null, { nodeAvailable: true });
    expect(cmd).toBe('node "/fwd.js"');
  });

  test('forces Electron when appDir contains .asar', () => {
    const cmd = getHookRunnerCommand('/fwd.js', 'PreInvocation', {
      nodeAvailable: true,
      appDir: '/path/app.asar',
      platform: 'darwin',
      execPath: '/path/Electron',
    });
    expect(cmd).toContain('ELECTRON_RUN_AS_NODE=1');
    expect(cmd).not.toContain('node ');
  });

  test('uses node when not packaged and node available', () => {
    const cmd = getHookRunnerCommand('/fwd.js', 'Stop', {
      nodeAvailable: true,
      appDir: '/normal/path',
    });
    expect(cmd).toContain('node ');
    expect(cmd).not.toContain('ELECTRON_RUN_AS_NODE');
  });
});

describe('resolveSourcePath packaged mapping', () => {
  test('maps app.asar to app.asar.unpacked', () => {
    const result = resolveSourcePath('src/forwarders/test.js', {
      appDir: '/Applications/MyApp.app/Contents/Resources/app.asar',
    });
    expect(result).toContain('app.asar.unpacked');
    expect(result).not.toContain('.asar/');
    expect(result).toContain('src/forwarders/test.js');
  });

  test('does not modify path when appDir has no .asar', () => {
    const result = resolveSourcePath('src/forwarders/test.js', {
      appDir: '/normal/dev/path',
    });
    expect(result).not.toContain('unpacked');
    expect(result).toContain('/normal/dev/path');
  });
});

describe('materialized grok-forwarder require-able', () => {
  test('materialized grok-forwarder can be required and loads adapter', () => {
    const tempDir = path.join(os.tmpdir(), 'pad-test-home-' + Date.now());
    try {
      materializeAssets({ homeDir: tempDir, debugLog: jest.fn() });
      const fwd = resolveCachedPath('src/forwarders/grok-forwarder.js', { homeDir: tempDir });
      expect(function () { require(fwd); }).not.toThrow();
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
