/**
 * codexObserver.test.js
 * Tests for polling-based Codex session observer
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { createCodexObserver } = require('../src/main/codexObserver');

describe('codexObserver', () => {
  let tempDir;
  let sessionsDir;
  let events;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pad-codex-obs-'));
    // Build a Codex-like directory structure
    const codexDir = path.join(tempDir, '.codex');
    sessionsDir = path.join(codexDir, 'sessions');
    events = [];

    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  function writeSession(sessionId, fileName, content) {
    const dir = path.join(sessionsDir, sessionId);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, fileName), content, 'utf-8');
  }

  function writeSessionIndex(content) {
    const codexDir = path.join(tempDir, '.codex');
    fs.mkdirSync(codexDir, { recursive: true });
    fs.writeFileSync(path.join(codexDir, 'session_index.jsonl'), content, 'utf-8');
  }

  function recordEvent(event) {
    events.push(event);
  }

  function createObs(overrides) {
    return createCodexObserver({
      homeDir: tempDir,
      processAgentEvent: recordEvent,
      debugLog: jest.fn(),
      pollIntervalMs: 500,
      quietMs: 1000,
      staleMs: 5000,
      ...overrides,
    });
  }

  describe('session detection and event emission', () => {
    test('reads new session_meta and emits agent.started', () => {
      writeSession('s1', 'events.jsonl', [
        '{"type":"session_meta","session_id":"s1","cwd":"/projects/app","thread_name":"My App"}',
      ].join('\n'));

      const obs = createObs();
      obs.start();

      expect(events.length).toBeGreaterThanOrEqual(1);
      const started = events.find(function (e) { return e.event === 'agent.started'; });
      expect(started).toBeTruthy();
      expect(started.agent_id).toBe('s1');
      expect(started.name).toBe('My App');
    });

    test('emits agent.working for function_call', () => {
      writeSession('s1', 'events.jsonl', [
        '{"type":"session_meta","session_id":"s1","cwd":"/app"}',
        '{"type":"function_call","session_id":"s1","function_name":"Bash"}',
      ].join('\n'));

      const obs = createObs();
      obs.start();

      const working = events.find(function (e) { return e.event === 'agent.working'; });
      expect(working).toBeTruthy();
      expect(working.tool).toBe('Bash');
    });

    test('emits agent.idle for task_complete', () => {
      writeSession('s1', 'events.jsonl', [
        '{"type":"session_meta","session_id":"s1","cwd":"/app"}',
        '{"type":"task_complete","session_id":"s1"}',
      ].join('\n'));

      const obs = createObs();
      obs.start();

      const idle = events.find(function (e) { return e.event === 'agent.idle'; });
      expect(idle).toBeTruthy();
    });

    test('does not replay same records on next poll', () => {
      writeSession('s1', 'events.jsonl', [
        '{"type":"session_meta","session_id":"s1","cwd":"/app"}',
      ].join('\n'));

      const obs = createObs({ pollIntervalMs: 100 });
      obs.start();

      const before = events.length;

      // Advance time and let poll run again
      jest.advanceTimersByTime(200);

      // Should not have doubled
      expect(events.length).toBe(before);

      obs.stop();
    });

    test('reads session index for display names', () => {
      writeSessionIndex([
        '{"session_id":"s1","thread_name":"Index Thread","cwd":"/idx"}',
      ].join('\n'));

      writeSession('s1', 'events.jsonl', [
        '{"type":"session_meta","session_id":"s1","cwd":"/app"}', // no thread_name here
      ].join('\n'));

      const obs = createObs();
      obs.start();

      const started = events.find(function (e) { return e.event === 'agent.started'; });
      expect(started.name).toBe('Index Thread');
    });

    test('quiet timeout emits agent.idle', () => {
      writeSession('s1', 'events.jsonl', [
        '{"type":"session_meta","session_id":"s1","cwd":"/app"}',
        '{"type":"function_call","session_id":"s1","function_name":"Bash"}',
      ].join('\n'));

      const obs = createObs({ pollIntervalMs: 200, quietMs: 500, staleMs: 5000 });
      obs.start();

      // Events from initial scan
      expect(events.length).toBeGreaterThan(0);

      // Advance past quiet timeout → next poll should emit agent.idle
      jest.advanceTimersByTime(1000);

      const idleEvents = events.filter(function (e) { return e.event === 'agent.idle'; });
      expect(idleEvents.length).toBeGreaterThanOrEqual(1);

      obs.stop();
    });

    test('stop clears interval', () => {
      writeSession('s1', 'events.jsonl', [
        '{"type":"session_meta","session_id":"s1","cwd":"/app"}',
      ].join('\n'));

      const obs = createObs({ pollIntervalMs: 200 });
      obs.start();

      const before = events.length;
      obs.stop();

      jest.advanceTimersByTime(1000);
      expect(events.length).toBe(before);
    });

    test('read errors do not throw', () => {
      // Create unreadable directory situation
      const obs = createObs({ homeDir: '/nonexistent/path' });
      expect(function () { obs.start(); }).not.toThrow();
    });
  });

  describe('getHealth', () => {
    test('active is true after start, false after stop', () => {
      const obs = createObs();
      expect(obs.getHealth().active).toBe(false);

      obs.start();
      expect(obs.getHealth().active).toBe(true);

      obs.stop();
      expect(obs.getHealth().active).toBe(false);
    });

    test('returns null lastEventAt before any events', () => {
      const obs = createObs();
      expect(obs.getHealth().lastEventAt).toBeNull();
    });
  });
});
