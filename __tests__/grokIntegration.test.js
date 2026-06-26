/**
 * grokIntegration.test.js
 * Tests for Grok Build integration adapter: detect, ensure, health, start/stop
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const { createGrokIntegration } = require('../src/main/integrations/grokIntegration');

describe('grokIntegration', () => {
  let tempDir;
  let forwarderFile;
  let adapter;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pad-grok-int-'));
    forwarderFile = path.join(tempDir, 'grok-forwarder.js');
    fs.writeFileSync(forwarderFile, '// forwarder stub', 'utf-8');
    adapter = createGrokIntegration({
      homeDir: tempDir,
      forwarderPath: forwarderFile,
      debugLog: jest.fn(),
    });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  function hookTargetPath() {
    return path.join(tempDir, '.grok', 'hooks', 'pixel-agent-desk.json');
  }

  describe('interface', () => {
    test('exports required adapter fields', () => {
      expect(adapter).toMatchObject({
        id: 'grok-build',
        label: 'Grok Build',
        setupMode: 'command-hook+observer',
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
    test('returns false when no .grok directory', () => {
      expect(adapter.detectInstalled()).toBe(false);
    });

    test('returns true when .grok directory exists', () => {
      fs.mkdirSync(path.join(tempDir, '.grok', 'hooks'), { recursive: true });
      expect(adapter.detectInstalled()).toBe(true);
    });

    test('returns true when .grok/hooks exists', () => {
      fs.mkdirSync(path.join(tempDir, '.grok', 'hooks'), { recursive: true });
      expect(adapter.detectInstalled()).toBe(true);
    });
  });

  describe('detectIntegrated', () => {
    test('returns false when hooks not installed', () => {
      expect(adapter.detectIntegrated()).toBe(false);
    });

    test('returns true after ensureIntegration installs hooks', () => {
      adapter.ensureIntegration();
      expect(adapter.detectIntegrated()).toBe(true);
    });
  });

  describe('ensureIntegration', () => {
    test('installs hooks and returns installed status', () => {
      expect(fs.existsSync(hookTargetPath())).toBe(false);

      const result = adapter.ensureIntegration();

      expect(result).toEqual({ status: 'installed' });
      expect(fs.existsSync(hookTargetPath())).toBe(true);
    });

    test('returns installed when hooks already installed and identical', () => {
      adapter.ensureIntegration();
      const result = adapter.ensureIntegration();
      expect(result).toEqual({ status: 'installed' });
    });

    test('returns failed on write error', () => {
      fs.mkdirSync(path.join(tempDir, '.grok', 'hooks'), { recursive: true });
      fs.mkdirSync(hookTargetPath(), { recursive: true });

      const result = adapter.ensureIntegration();

      expect(result.status).toBe('failed');
    });
  });

  describe('start / stop', () => {
    test('start returns skipped without processAgentEvent', () => {
      const result = adapter.start();
      expect(result.status).toBe('skipped');
    });

    test('start returns skipped when grok home missing', () => {
      const noGrok = createGrokIntegration({
        homeDir: path.join(tempDir, 'empty-home'),
        forwarderPath: forwarderFile,
        processAgentEvent: jest.fn(),
        debugLog: jest.fn(),
      });
      expect(noGrok.start().status).toBe('skipped');
    });

    test('start launches observer when grok home exists', () => {
      fs.mkdirSync(path.join(tempDir, '.grok'), { recursive: true });
      const wired = createGrokIntegration({
        homeDir: tempDir,
        forwarderPath: forwarderFile,
        processAgentEvent: jest.fn(),
        hasAgent: () => false,
        debugLog: jest.fn(),
      });
      const result = wired.start();
      expect(result.status).toBe('started');
      expect(wired.getHealth().active).toBe(true);
      wired.stop();
      expect(wired.getHealth().active).toBe(false);
    });

    test('stop returns stopped', () => {
      const result = adapter.stop();
      expect(result.status).toBe('stopped');
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
    test('full lifecycle: not integrated → ensure → integrated', () => {
      expect(adapter.detectInstalled()).toBe(false);
      expect(adapter.detectIntegrated()).toBe(false);

      const ensured = adapter.ensureIntegration();
      expect(ensured.status).toBe('installed');
      expect(adapter.detectIntegrated()).toBe(true);
      expect(adapter.getHealth().active).toBe(false);
    });
  });
});
