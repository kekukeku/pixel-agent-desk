/**
 * antigravityHookRegistration.test.js
 * Tests for Antigravity hook registration with injected temp paths.
 * Verifies: install, idempotent, preserves other hooks, unregister, malformed config.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const {
  registerAntigravityHooks,
  unregisterAntigravityHooks,
  isAntigravityHooksRegistered,
} = require('../src/main/antigravityHookRegistration');

describe('antigravityHookRegistration', () => {
  let tempDir;
  let forwarderFile;
  let debugLog;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pad-anti-reg-'));
    forwarderFile = path.join(tempDir, 'antigravity-forwarder.js');
    fs.writeFileSync(forwarderFile, '// forwarder stub', 'utf-8');
    debugLog = jest.fn();
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  function hooksPath() {
    return path.join(tempDir, '.gemini', 'config', 'hooks.json');
  }

  function configDir() {
    return path.join(tempDir, '.gemini', 'config');
  }

  describe('registerAntigravityHooks', () => {
    test('first install creates config dir, writes hooks.json with PAD key', () => {
      const result = registerAntigravityHooks(debugLog, {
        homeDir: tempDir,
        forwarderPath: forwarderFile,
      });

      expect(result).toBe(true);
      expect(fs.existsSync(hooksPath())).toBe(true);

      const config = JSON.parse(fs.readFileSync(hooksPath(), 'utf-8'));
      expect(config['pixel-agent-desk']).toBeDefined();
      expect(config['pixel-agent-desk'].PreInvocation).toBeDefined();
      expect(config['pixel-agent-desk'].PreToolUse).toBeDefined();
      expect(config['pixel-agent-desk'].PostToolUse).toBeDefined();
      expect(config['pixel-agent-desk'].Stop).toBeDefined();
    });

    test('lifecycle events have no matcher and event name in argv', () => {
      registerAntigravityHooks(debugLog, { homeDir: tempDir, forwarderPath: forwarderFile });

      const config = JSON.parse(fs.readFileSync(hooksPath(), 'utf-8'));
      const pad = config['pixel-agent-desk'];

      expect(pad.PreInvocation[0].type).toBe('command');
      expect(pad.PreInvocation[0].matcher).toBeUndefined();
      expect(pad.PreInvocation[0].command).toContain('PreInvocation');

      expect(pad.Stop[0].type).toBe('command');
      expect(pad.Stop[0].matcher).toBeUndefined();
      expect(pad.Stop[0].command).toContain('Stop');
    });

    test('tool events use matcher: "*"', () => {
      registerAntigravityHooks(debugLog, { homeDir: tempDir, forwarderPath: forwarderFile });

      const config = JSON.parse(fs.readFileSync(hooksPath(), 'utf-8'));
      const pad = config['pixel-agent-desk'];

      expect(pad.PreToolUse[0].matcher).toBe('*');
      expect(pad.PreToolUse[0].hooks[0].type).toBe('command');

      expect(pad.PostToolUse[0].matcher).toBe('*');
      expect(pad.PostToolUse[0].hooks[0].type).toBe('command');
    });

    test('identical PAD hook returns true without rewriting', () => {
      registerAntigravityHooks(debugLog, { homeDir: tempDir, forwarderPath: forwarderFile });
      const mtimeBefore = fs.statSync(hooksPath()).mtimeMs;
      debugLog.mockClear();

      const result = registerAntigravityHooks(debugLog, { homeDir: tempDir, forwarderPath: forwarderFile });

      expect(result).toBe(true);
      expect(fs.statSync(hooksPath()).mtimeMs).toBe(mtimeBefore);
      expect(debugLog).toHaveBeenCalledWith(expect.stringContaining('already up-to-date'));
    });

    test('preserves existing user hook keys', () => {
      // Pre-create hooks.json with a user-owned key
      fs.mkdirSync(configDir(), { recursive: true });
      const existing = {
        'user-linter': { PreInvocation: [{ type: 'command', command: 'lint.sh' }] },
      };
      fs.writeFileSync(hooksPath(), JSON.stringify(existing, null, 2), 'utf-8');

      registerAntigravityHooks(debugLog, { homeDir: tempDir, forwarderPath: forwarderFile });

      const config = JSON.parse(fs.readFileSync(hooksPath(), 'utf-8'));
      expect(config['user-linter']).toBeDefined();
      expect(config['user-linter'].PreInvocation[0].command).toBe('lint.sh');
      expect(config['pixel-agent-desk']).toBeDefined();
    });

    test('different PAD key content gets updated, other keys preserved', () => {
      const existing = {
        'user-hook': { Stop: [{ type: 'command', command: 'cleanup.sh' }] },
        'pixel-agent-desk': { PreInvocation: [{ type: 'command', command: 'old-fwd' }] },
      };
      fs.mkdirSync(configDir(), { recursive: true });
      fs.writeFileSync(hooksPath(), JSON.stringify(existing, null, 2), 'utf-8');

      registerAntigravityHooks(debugLog, { homeDir: tempDir, forwarderPath: forwarderFile });

      const config = JSON.parse(fs.readFileSync(hooksPath(), 'utf-8'));
      expect(config['user-hook']).toBeDefined();
      expect(config['pixel-agent-desk'].PreToolUse).toBeDefined();
    });

    test('malformed hooks.json is backed up and recreated', () => {
      fs.mkdirSync(configDir(), { recursive: true });
      fs.writeFileSync(hooksPath(), '{broken', 'utf-8');

      const result = registerAntigravityHooks(debugLog, { homeDir: tempDir, forwarderPath: forwarderFile });

      expect(result).toBe(true);
      const config = JSON.parse(fs.readFileSync(hooksPath(), 'utf-8'));
      expect(config['pixel-agent-desk']).toBeDefined();
    });
  });

  describe('unregisterAntigravityHooks', () => {
    test('removes only PAD key, leaves other keys', () => {
      fs.mkdirSync(configDir(), { recursive: true });
      fs.writeFileSync(hooksPath(), JSON.stringify({
        'user-hook': { Stop: [{ type: 'command', command: 'x' }] },
        'pixel-agent-desk': { PreInvocation: [{ type: 'command', command: 'y' }] },
      }), 'utf-8');

      unregisterAntigravityHooks(debugLog, { homeDir: tempDir });

      const config = JSON.parse(fs.readFileSync(hooksPath(), 'utf-8'));
      expect(config['user-hook']).toBeDefined();
      expect(config['pixel-agent-desk']).toBeUndefined();
    });

    test('returns true when file does not exist', () => {
      expect(unregisterAntigravityHooks(debugLog, { homeDir: tempDir })).toBe(true);
    });
  });

  describe('isAntigravityHooksRegistered', () => {
    test('returns false when file missing', () => {
      expect(isAntigravityHooksRegistered({ homeDir: tempDir, forwarderPath: forwarderFile })).toBe(false);
    });

    test('returns false when PAD key missing', () => {
      fs.mkdirSync(configDir(), { recursive: true });
      fs.writeFileSync(hooksPath(), JSON.stringify({ 'other': {} }), 'utf-8');
      expect(isAntigravityHooksRegistered({ homeDir: tempDir, forwarderPath: forwarderFile })).toBe(false);
    });

    test('returns true after registration', () => {
      registerAntigravityHooks(debugLog, { homeDir: tempDir, forwarderPath: forwarderFile });
      expect(isAntigravityHooksRegistered({ homeDir: tempDir, forwarderPath: forwarderFile })).toBe(true);
    });

    test('returns false after unregister', () => {
      registerAntigravityHooks(debugLog, { homeDir: tempDir, forwarderPath: forwarderFile });
      unregisterAntigravityHooks(debugLog, { homeDir: tempDir });
      expect(isAntigravityHooksRegistered({ homeDir: tempDir, forwarderPath: forwarderFile })).toBe(false);
    });

    test('returns false when PAD key exists but is empty/incomplete', () => {
      fs.mkdirSync(configDir(), { recursive: true });
      fs.writeFileSync(hooksPath(), JSON.stringify({
        'pixel-agent-desk': { PreInvocation: [] },
      }), 'utf-8');
      expect(isAntigravityHooksRegistered({ homeDir: tempDir, forwarderPath: forwarderFile })).toBe(false);
    });

    test('returns false when PAD key exists but PreToolUse missing', () => {
      fs.mkdirSync(configDir(), { recursive: true });
      fs.writeFileSync(hooksPath(), JSON.stringify({
        'pixel-agent-desk': {
          PreInvocation: [{ type: 'command', command: 'x' }],
          Stop: [{ type: 'command', command: 'y' }],
        },
      }), 'utf-8');
      expect(isAntigravityHooksRegistered({ homeDir: tempDir, forwarderPath: forwarderFile })).toBe(false);
    });

    test('returns false when forwarderPath does not match', () => {
      registerAntigravityHooks(debugLog, { homeDir: tempDir, forwarderPath: forwarderFile });
      expect(isAntigravityHooksRegistered({ homeDir: tempDir, forwarderPath: '/different/path.js' })).toBe(false);
    });
  });

  describe('shell quoting', () => {
    test('forwarderPath with spaces gets quoted', () => {
      const spacedFwd = path.join(tempDir, 'my forwarder.js');
      fs.writeFileSync(spacedFwd, '// stub', 'utf-8');

      registerAntigravityHooks(debugLog, { homeDir: tempDir, forwarderPath: spacedFwd });

      const config = JSON.parse(fs.readFileSync(hooksPath(), 'utf-8'));
      const cmd = config['pixel-agent-desk'].PreInvocation[0].command;
      expect(cmd).toContain('"' + spacedFwd + '"');
      expect(cmd).toContain('PreInvocation');
    });
  });

  describe('event argv in commands', () => {
    test('all lifecycle/tool hooks include correct event name in command argv', () => {
      registerAntigravityHooks(debugLog, { homeDir: tempDir, forwarderPath: forwarderFile });

      const config = JSON.parse(fs.readFileSync(hooksPath(), 'utf-8'));
      const pad = config['pixel-agent-desk'];

      expect(pad.PreInvocation[0].command).toMatch(/PreInvocation$/);
      expect(pad.PreToolUse[0].hooks[0].command).toMatch(/PreToolUse$/);
      expect(pad.PostToolUse[0].hooks[0].command).toMatch(/PostToolUse$/);
      expect(pad.Stop[0].command).toMatch(/Stop$/);
    });
  });
});
