/**
 * codexIntegration.test.js
 * Tests for Codex integration adapter: detect, ensure, health, start/stop
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const { createCodexIntegration } = require('../src/main/integrations/codexIntegration');

describe('codexIntegration', () => {
  let tempDir;
  let adapter;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pad-codex-int-'));
    adapter = createCodexIntegration({
      homeDir: tempDir,
      processAgentEvent: jest.fn(),
      debugLog: jest.fn(),
    });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  function codexDir() {
    return path.join(tempDir, '.codex');
  }

  describe('interface', () => {
    test('exports required adapter fields', () => {
      expect(adapter).toMatchObject({
        id: 'codex',
        label: 'Codex',
        setupMode: 'read-only-observer',
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
    test('returns false when no .codex directory', () => {
      expect(adapter.detectInstalled()).toBe(false);
    });

    test('returns true when .codex/sessions exists', () => {
      fs.mkdirSync(path.join(codexDir(), 'sessions'), { recursive: true });
      expect(adapter.detectInstalled()).toBe(true);
    });

    test('returns true when session_index.jsonl exists', () => {
      fs.mkdirSync(codexDir(), { recursive: true });
      fs.writeFileSync(path.join(codexDir(), 'session_index.jsonl'), '', 'utf-8');
      expect(adapter.detectInstalled()).toBe(true);
    });

    test('returns true when process_manager exists', () => {
      fs.mkdirSync(path.join(codexDir(), 'process_manager'), { recursive: true });
      expect(adapter.detectInstalled()).toBe(true);
    });
  });

  describe('detectIntegrated', () => {
    test('returns false when not installed', () => {
      expect(adapter.detectIntegrated()).toBe(false);
    });

    test('returns true when installed (read-only)', () => {
      fs.mkdirSync(path.join(codexDir(), 'sessions'), { recursive: true });
      expect(adapter.detectIntegrated()).toBe(true);
    });
  });

  describe('ensureIntegration', () => {
    test('returns ready when installed', () => {
      fs.mkdirSync(path.join(codexDir(), 'sessions'), { recursive: true });
      expect(adapter.ensureIntegration()).toEqual({ status: 'ready' });
    });

    test('returns skipped when not installed', () => {
      expect(adapter.ensureIntegration()).toEqual({
        status: 'skipped',
        message: expect.stringContaining('not installed'),
      });
    });
  });

  describe('start / stop', () => {
    test('start without processAgentEvent returns skipped', () => {
      const ad = createCodexIntegration({ homeDir: tempDir });
      const result = ad.start();
      expect(result.status).toBe('skipped');
      expect(ad.getHealth().active).toBe(false);
    });

    test('start and stop with processAgentEvent and session data', () => {
      fs.mkdirSync(path.join(codexDir(), 'sessions', 's1'), { recursive: true });
      fs.writeFileSync(
        path.join(codexDir(), 'sessions', 's1', 'events.jsonl'),
        '{"type":"session_meta","session_id":"s1","cwd":"/app"}\n',
        'utf-8'
      );

      const result = adapter.start();
      expect(result.status).toBe('started');
      expect(adapter.getHealth().active).toBe(true);

      const stopResult = adapter.stop();
      expect(stopResult.status).toBe('stopped');
      expect(adapter.getHealth().active).toBe(false);
    });
  });

  describe('getHealth', () => {
    test('returns inactive before start', () => {
      expect(adapter.getHealth()).toEqual({
        active: false,
        lastEventAt: null,
        error: null,
      });
    });
  });
});
