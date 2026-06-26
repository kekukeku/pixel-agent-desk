/**
 * claudeIntegration.test.js
 * Tests for Claude Code integration adapter: detect, ensure, health, start/stop
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const { createClaudeIntegration } = require('../src/main/integrations/claudeIntegration');
const { HOOK_EVENTS } = require('../src/main/hookRegistration');

describe('claudeIntegration', () => {
  let tempDir;
  let forwarderFile;
  let adapter;
  let debugLog;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pad-claude-int-'));
    forwarderFile = path.join(tempDir, 'claude-forwarder.js');
    fs.writeFileSync(forwarderFile, '// forwarder stub', 'utf-8');
    debugLog = jest.fn();
    adapter = createClaudeIntegration({
      homeDir: tempDir,
      forwarderPath: forwarderFile,
      debugLog,
    });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  function settingsPath() {
    return path.join(tempDir, '.claude', 'settings.json');
  }

  describe('interface', () => {
    test('exports required adapter fields', () => {
      expect(adapter).toMatchObject({
        id: 'claude-code',
        label: 'Claude Code',
        setupMode: 'command-hook',
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
    test('returns false when no .claude directory exists', () => {
      expect(adapter.detectInstalled()).toBe(false);
    });

    test('returns true when .claude directory exists', () => {
      fs.mkdirSync(path.join(tempDir, '.claude'), { recursive: true });
      expect(adapter.detectInstalled()).toBe(true);
    });
  });

  describe('detectIntegrated', () => {
    test('returns false before hooks are installed', () => {
      expect(adapter.detectIntegrated()).toBe(false);
    });

    test('returns true after ensureIntegration installs hooks', () => {
      adapter.ensureIntegration();
      expect(adapter.detectIntegrated()).toBe(true);
    });
  });

  describe('ensureIntegration', () => {
    test('installs command hooks and returns installed status', () => {
      const result = adapter.ensureIntegration();

      expect(result).toEqual({ status: 'installed' });
      expect(fs.existsSync(settingsPath())).toBe(true);

      const config = JSON.parse(fs.readFileSync(settingsPath(), 'utf-8'));
      for (const event of HOOK_EVENTS) {
        expect(config.hooks[event]).toEqual([
          {
            matcher: '*',
            hooks: [{
              type: 'command',
              command: expect.stringContaining(forwarderFile),
              timeout: 5,
            }],
          },
        ]);
      }
    });

    test('migrates legacy HTTP hooks to command hooks', () => {
      fs.mkdirSync(path.dirname(settingsPath()), { recursive: true });
      const legacy = { hooks: {} };
      for (const event of HOOK_EVENTS) {
        legacy.hooks[event] = [{
          matcher: '*',
          hooks: [{ type: 'http', url: 'http://localhost:47821/hook' }],
        }];
      }
      fs.writeFileSync(settingsPath(), JSON.stringify(legacy), 'utf-8');

      const result = adapter.ensureIntegration();

      expect(result.status).toBe('installed');
      const config = JSON.parse(fs.readFileSync(settingsPath(), 'utf-8'));
      expect(
        config.hooks.SessionStart.some(
          entry => entry.hooks.some(h => h.type === 'http' && h.url === 'http://localhost:47821/hook')
        )
      ).toBe(false);
      expect(
        config.hooks.SessionStart.some(
          entry => entry.hooks.some(h => h.type === 'command')
        )
      ).toBe(true);
    });

    test('returns installed when already up-to-date', () => {
      adapter.ensureIntegration();
      expect(adapter.ensureIntegration()).toEqual({ status: 'installed' });
    });

    test('preserves user hooks while adding PAD hooks', () => {
      fs.mkdirSync(path.dirname(settingsPath()), { recursive: true });
      fs.writeFileSync(settingsPath(), JSON.stringify({
        hooks: {
          SessionStart: [
            {
              matcher: '*',
              hooks: [{ type: 'http', url: 'http://localhost:9999/custom' }],
            },
          ],
        },
        permissions: { allow: ['Bash(date)'] },
      }), 'utf-8');

      const result = adapter.ensureIntegration();

      expect(result.status).toBe('installed');
      const config = JSON.parse(fs.readFileSync(settingsPath(), 'utf-8'));
      expect(config.permissions).toEqual({ allow: ['Bash(date)'] });
      expect(config.hooks.SessionStart).toHaveLength(2);
      expect(config.hooks.SessionStart).toContainEqual({
        matcher: '*',
        hooks: [{ type: 'http', url: 'http://localhost:9999/custom' }],
      });
    });

    test('returns failed on write error', () => {
      fs.mkdirSync(path.dirname(settingsPath()), { recursive: true });
      fs.mkdirSync(settingsPath(), { recursive: true });

      const result = adapter.ensureIntegration();

      expect(result.status).toBe('failed');
    });
  });

  describe('start / stop', () => {
    test('start returns skipped because hooks are event-driven', () => {
      expect(adapter.start().status).toBe('skipped');
    });

    test('stop returns skipped because hooks are event-driven', () => {
      expect(adapter.stop().status).toBe('skipped');
    });
  });

  describe('getHealth', () => {
    test('returns expected shape', () => {
      expect(adapter.getHealth()).toEqual({
        active: false,
        lastEventAt: null,
        error: null,
      });
    });
  });
});