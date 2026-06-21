/**
 * antigravityIntegration.test.js
 * Tests for Antigravity integration adapter: detect, ensure, health, start/stop
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const { createAntigravityIntegration } = require('../src/main/integrations/antigravityIntegration');

describe('antigravityIntegration', () => {
  let tempDir;
  let forwarderFile;
  let adapter;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pad-anti-int-'));
    forwarderFile = path.join(tempDir, 'antigravity-forwarder.js');
    fs.writeFileSync(forwarderFile, '// forwarder stub', 'utf-8');
    adapter = createAntigravityIntegration({
      homeDir: tempDir,
      forwarderPath: forwarderFile,
      debugLog: jest.fn(),
    });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  function hooksPath() {
    return path.join(tempDir, '.gemini', 'config', 'hooks.json');
  }

  describe('interface', () => {
    test('exports required adapter fields', () => {
      expect(adapter).toMatchObject({
        id: 'antigravity',
        label: 'Antigravity',
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
    test('returns false when no .gemini directory', () => {
      expect(adapter.detectInstalled()).toBe(false);
    });

    test('returns true when .gemini dir exists', () => {
      fs.mkdirSync(path.join(tempDir, '.gemini'), { recursive: true });
      expect(adapter.detectInstalled()).toBe(true);
    });

    test('returns true when hooks.json exists', () => {
      fs.mkdirSync(path.join(tempDir, '.gemini', 'config'), { recursive: true });
      fs.writeFileSync(hooksPath(), '{}', 'utf-8');
      expect(adapter.detectInstalled()).toBe(true);
    });
  });

  describe('detectIntegrated', () => {
    test('returns false when not installed', () => {
      expect(adapter.detectIntegrated()).toBe(false);
    });

    test('returns true after ensureIntegration installs hooks', () => {
      adapter.ensureIntegration();
      expect(adapter.detectIntegrated()).toBe(true);
    });
  });

  describe('ensureIntegration', () => {
    test('installs hooks and returns installed status', () => {
      const result = adapter.ensureIntegration();
      expect(result).toEqual({ status: 'installed' });

      const config = JSON.parse(fs.readFileSync(hooksPath(), 'utf-8'));
      expect(config['pixel-agent-desk']).toBeDefined();
    });

    test('returns installed when already up-to-date', () => {
      adapter.ensureIntegration();
      expect(adapter.ensureIntegration()).toEqual({ status: 'installed' });
    });
  });

  describe('start / stop', () => {
    test('start returns skipped', () => {
      expect(adapter.start().status).toBe('skipped');
    });

    test('stop returns skipped', () => {
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
