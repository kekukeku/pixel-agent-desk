/**
 * grokHookRegistration.test.js
 * Tests for Grok hook registration/unregistration with injected temp paths
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const {
  registerGrokHooks,
  unregisterGrokHooks,
  isGrokHooksRegistered,
} = require('../src/main/grokHookRegistration');

describe('grokHookRegistration', () => {
  let tempDir;
  let forwarderFile;
  let debugLog;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pad-grok-reg-'));
    // Create a real forwarder temp file so the existence check passes
    forwarderFile = path.join(tempDir, 'grok-forwarder.js');
    fs.writeFileSync(forwarderFile, '// forwarder stub', 'utf-8');
    debugLog = jest.fn();
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  function hookTargetPath() {
    return path.join(tempDir, '.grok', 'hooks', 'pixel-agent-desk.json');
  }

  function hooksDir() {
    return path.join(tempDir, '.grok', 'hooks');
  }

  function useForwarder(fp) {
    return fp || forwarderFile;
  }

  describe('registerGrokHooks', () => {
    test('first install creates hooks dir, writes file with PAD marker', () => {
      const result = registerGrokHooks(debugLog, {
        homeDir: tempDir,
        forwarderPath: forwarderFile,
      });

      expect(result).toBe(true);
      expect(fs.existsSync(hooksDir())).toBe(true);
      expect(fs.existsSync(hookTargetPath())).toBe(true);

      const content = JSON.parse(fs.readFileSync(hookTargetPath(), 'utf-8'));
      expect(content._pad).toBe('pixel-agent-desk');
      expect(content.hooks.SessionStart).toBeDefined();
      expect(content.hooks.PreToolUse).toBeDefined();
      expect(content.hooks.SessionEnd).toBeDefined();
    });

    test('hook JSON uses correct format with command, timeout, and all lifecycle events', () => {
      registerGrokHooks(debugLog, { homeDir: tempDir, forwarderPath: forwarderFile });

      const content = JSON.parse(fs.readFileSync(hookTargetPath(), 'utf-8'));
      const expectedEvents = [
        'SessionStart', 'UserPromptSubmit', 'PreToolUse', 'PostToolUse',
        'PostToolUseFailure', 'PermissionDenied', 'Stop', 'SessionEnd',
        'SubagentStart', 'SubagentStop',
      ];

      for (const evt of expectedEvents) {
        expect(content.hooks[evt]).toBeDefined();
        expect(content.hooks[evt][0].hooks[0].type).toBe('command');
        expect(content.hooks[evt][0].hooks[0].command).toContain(forwarderFile);
        expect(content.hooks[evt][0].hooks[0].timeout).toBe(5);
      }
    });

    test('identical existing file returns true without rewriting', () => {
      registerGrokHooks(debugLog, { homeDir: tempDir, forwarderPath: forwarderFile });
      const mtimeBefore = fs.statSync(hookTargetPath()).mtimeMs;

      debugLog.mockClear();
      const result = registerGrokHooks(debugLog, { homeDir: tempDir, forwarderPath: forwarderFile });

      expect(result).toBe(true);
      expect(fs.statSync(hookTargetPath()).mtimeMs).toBe(mtimeBefore);
      expect(debugLog).toHaveBeenCalledWith(expect.stringContaining('already up-to-date'));
    });

    test('different existing file updates content', () => {
      registerGrokHooks(debugLog, { homeDir: tempDir, forwarderPath: forwarderFile });
      debugLog.mockClear();

      const newFwd = path.join(tempDir, 'grok-forwarder-v2.js');
      fs.writeFileSync(newFwd, '// v2', 'utf-8');
      const result = registerGrokHooks(debugLog, { homeDir: tempDir, forwarderPath: newFwd });

      expect(result).toBe(true);
      const content = JSON.parse(fs.readFileSync(hookTargetPath(), 'utf-8'));
      expect(content.hooks.SessionStart[0].hooks[0].command).toContain(newFwd);
      expect(debugLog).toHaveBeenCalledWith(expect.stringContaining('differ'));
    });

    test('returns false when forwarderPath does not exist', () => {
      const missingPath = path.join(tempDir, 'nonexistent-fwd.js');
      const result = registerGrokHooks(debugLog, {
        homeDir: tempDir,
        forwarderPath: missingPath,
      });

      expect(result).toBe(false);
      expect(fs.existsSync(hookTargetPath())).toBe(false);
      expect(debugLog).toHaveBeenCalledWith(expect.stringContaining('not found'));
    });

    test('returns false on write failure without crash', () => {
      fs.mkdirSync(hooksDir(), { recursive: true });
      fs.mkdirSync(hookTargetPath(), { recursive: true });

      const result = registerGrokHooks(debugLog, { homeDir: tempDir, forwarderPath: forwarderFile });

      expect(result).toBe(false);
      expect(debugLog).toHaveBeenCalledWith(expect.stringContaining('failed'));
    });
  });

  describe('unregisterGrokHooks', () => {
    test('removes PAD hook file, leaves other files', () => {
      fs.mkdirSync(hooksDir(), { recursive: true });
      fs.writeFileSync(hookTargetPath(), '{}', 'utf-8');
      const otherFile = path.join(hooksDir(), 'user-hooks.json');
      fs.writeFileSync(otherFile, '{}', 'utf-8');

      const result = unregisterGrokHooks(debugLog, { homeDir: tempDir });

      expect(result).toBe(true);
      expect(fs.existsSync(hookTargetPath())).toBe(false);
      expect(fs.existsSync(otherFile)).toBe(true);
    });

    test('returns true even if hook file does not exist', () => {
      const result = unregisterGrokHooks(debugLog, { homeDir: tempDir });
      expect(result).toBe(true);
    });
  });

  describe('isGrokHooksRegistered', () => {
    test('returns false when file missing', () => {
      expect(isGrokHooksRegistered({ homeDir: tempDir, forwarderPath: forwarderFile })).toBe(false);
    });

    test('returns false when file exists but no PAD marker', () => {
      fs.mkdirSync(hooksDir(), { recursive: true });
      fs.writeFileSync(hookTargetPath(), JSON.stringify({ hooks: {} }), 'utf-8');

      expect(isGrokHooksRegistered({ homeDir: tempDir, forwarderPath: forwarderFile })).toBe(false);
    });

    test('returns true after registration', () => {
      registerGrokHooks(debugLog, { homeDir: tempDir, forwarderPath: forwarderFile });
      expect(isGrokHooksRegistered({ homeDir: tempDir, forwarderPath: forwarderFile })).toBe(true);
    });

    test('returns false after unregister', () => {
      registerGrokHooks(debugLog, { homeDir: tempDir, forwarderPath: forwarderFile });
      unregisterGrokHooks(debugLog, { homeDir: tempDir });
      expect(isGrokHooksRegistered({ homeDir: tempDir, forwarderPath: forwarderFile })).toBe(false);
    });
  });
});
