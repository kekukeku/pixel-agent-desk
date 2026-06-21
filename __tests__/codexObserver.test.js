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

  function writeChatProcesses(content) {
    const codexDir = path.join(tempDir, '.codex');
    const procDir = path.join(codexDir, 'process_manager');
    fs.mkdirSync(procDir, { recursive: true });
    fs.writeFileSync(path.join(procDir, 'chat_processes.json'), JSON.stringify(content), 'utf-8');
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

  describe('incremental poll preserves metadata', () => {
    test('session_meta from first poll is used by function_call in second poll', () => {
      // Round 1: only session_meta
      writeSession('s1', 'events.jsonl', [
        '{"type":"session_meta","session_id":"s1","cwd":"/projects/app","thread_name":"Meta Thread"}',
      ].join('\n'));

      const obs = createObs({ pollIntervalMs: 200 });
      obs.start();

      const started = events.find(function (e) { return e.event === 'agent.started'; });
      expect(started).toBeTruthy();
      expect(started.name).toBe('Meta Thread');
      expect(started.project_path).toBe('/projects/app');

      // Round 2: append function_call (no session_meta this time)
      const filePath = path.join(sessionsDir, 's1', 'events.jsonl');
      const existing = fs.readFileSync(filePath, 'utf-8');
      fs.writeFileSync(filePath, existing + '\n' + JSON.stringify({
        type: 'function_call',
        session_id: 's1',
        function_name: 'Bash',
      }), 'utf-8');

      events.length = 0; // 清空上一輪事件
      jest.advanceTimersByTime(300);

      const working = events.find(function (e) { return e.event === 'agent.working'; });
      expect(working).toBeTruthy();
      expect(working.tool).toBe('Bash');
      expect(working.name).toBe('Meta Thread');   // from persistent sessionMetaMap
      expect(working.project_path).toBe('/projects/app');

      obs.stop();
    });
  });

  describe('idle dedupe', () => {
    test('emits idle only once per quiet period', () => {
      writeSession('s1', 'events.jsonl', [
        '{"type":"session_meta","session_id":"s1","cwd":"/app"}',
        '{"type":"function_call","session_id":"s1","function_name":"Bash"}',
      ].join('\n'));

      const obs = createObs({ pollIntervalMs: 200, quietMs: 500, staleMs: 10000 });
      obs.start();

      // Clear initial events
      events.length = 0;

      // Advance past quietMs → should emit exactly 1 idle
      jest.advanceTimersByTime(800);

      const idleEvents = events.filter(function (e) { return e.event === 'agent.idle'; });
      expect(idleEvents.length).toBe(1);

      // Further advance without new activity → no more idle events
      events.length = 0;
      jest.advanceTimersByTime(2000);

      const moreIdle = events.filter(function (e) { return e.event === 'agent.idle'; });
      expect(moreIdle.length).toBe(0);

      obs.stop();
    });

    test('idle dedupe resets when new working event arrives', () => {
      writeSession('s1', 'events.jsonl', [
        '{"type":"session_meta","session_id":"s1","cwd":"/app"}',
        '{"type":"function_call","session_id":"s1","function_name":"Bash"}',
      ].join('\n'));

      const obs = createObs({ pollIntervalMs: 200, quietMs: 500, staleMs: 10000 });
      obs.start();

      events.length = 0;
      jest.advanceTimersByTime(800);
      expect(events.filter(function (e) { return e.event === 'agent.idle'; }).length).toBe(1);

      // Append new working event
      const filePath = path.join(sessionsDir, 's1', 'events.jsonl');
      fs.appendFileSync(filePath, '\n' + JSON.stringify({
        type: 'function_call',
        session_id: 's1',
        function_name: 'Read',
      }), 'utf-8');

      events.length = 0;
      jest.advanceTimersByTime(300);

      // Should have a new agent.working from the appended line
      expect(events.some(function (e) { return e.event === 'agent.working'; })).toBe(true);

      // Now wait for quiet again → should emit a new idle
      events.length = 0;
      jest.advanceTimersByTime(800);

      expect(events.filter(function (e) { return e.event === 'agent.idle'; }).length).toBe(1);

      obs.stop();
    });
  });

  describe('stale timeout', () => {
    test('emits agent.removed after staleMs and stops idle', () => {
      writeSession('s1', 'events.jsonl', [
        '{"type":"session_meta","session_id":"s1","cwd":"/app"}',
      ].join('\n'));

      const obs = createObs({ pollIntervalMs: 200, quietMs: 500, staleMs: 2000 });
      obs.start();

      events.length = 0;

      // Advance past quiet → idle first
      jest.advanceTimersByTime(800);
      expect(events.some(function (e) { return e.event === 'agent.idle'; })).toBe(true);

      // Advance past stale → removed
      events.length = 0;
      jest.advanceTimersByTime(2000);

      const removed = events.find(function (e) { return e.event === 'agent.removed'; });
      expect(removed).toBeTruthy();
      expect(removed.agent_id).toBe('s1');

      // After removal, no more idle or removed for this session
      events.length = 0;
      jest.advanceTimersByTime(1000);
      expect(events.filter(function (e) { return e.agent_id === 's1'; }).length).toBe(0);

      obs.stop();
    });
  });

  describe('chat_processes integration', () => {
    test('fresh command in chat_processes emits agent.working', () => {
      writeChatProcesses({
        processes: [{
          session_id: 'cp1',
          command: 'npm test',
          pid: 12345,
          updatedAtMs: 1719000000000,
        }],
      });

      const obs = createObs({ pollIntervalMs: 200 });
      obs.start();

      const working = events.find(function (e) { return e.event === 'agent.working' && e.agent_id === 'cp1'; });
      expect(working).toBeTruthy();
      expect(working.tool).toBe('npm test');
      expect(working.source).toBe('codex');

      obs.stop();
    });

    test('repeated poll with same activity does not re-emit', () => {
      writeChatProcesses({
        processes: [{
          session_id: 'cp2',
          command: 'npm run build',
          updatedAtMs: 1719000000000,
        }],
      });

      const obs = createObs({ pollIntervalMs: 200 });
      obs.start();

      const before = events.filter(function (e) { return e.event === 'agent.working' && e.agent_id === 'cp2'; });
      expect(before.length).toBe(1);

      // Next poll with same content
      jest.advanceTimersByTime(300);
      const after = events.filter(function (e) { return e.event === 'agent.working' && e.agent_id === 'cp2'; });
      expect(after.length).toBe(1);

      obs.stop();
    });

    test('same session new updatedAtMs emits again', () => {
      writeChatProcesses({
        processes: [{
          session_id: 'cp3',
          command: 'npm test',
          updatedAtMs: 1719000000000,
        }],
      });

      const obs = createObs({ pollIntervalMs: 200 });
      obs.start();

      expect(events.filter(function (e) { return e.event === 'agent.working' && e.agent_id === 'cp3'; }).length).toBe(1);

      // Update the file with new timestamp
      writeChatProcesses({
        processes: [{
          session_id: 'cp3',
          command: 'npm test',
          updatedAtMs: 1719000005000,
        }],
      });

      events.length = 0;
      jest.advanceTimersByTime(300);

      expect(events.filter(function (e) { return e.event === 'agent.working' && e.agent_id === 'cp3'; }).length).toBe(1);

      obs.stop();
    });

    test('chat_processes working clears idle dedupe, later quiet emits idle', () => {
      writeChatProcesses({
        processes: [{
          session_id: 'cp4',
          command: 'npm test',
          updatedAtMs: 1719000000000,
        }],
      });

      const obs = createObs({ pollIntervalMs: 200, quietMs: 500, staleMs: 10000 });
      obs.start();

      events.length = 0;

      // Advance past quiet → should emit idle
      jest.advanceTimersByTime(800);
      expect(events.some(function (e) { return e.event === 'agent.idle' && e.agent_id === 'cp4'; })).toBe(true);

      // Update chat_processes with new command
      writeChatProcesses({
        processes: [{
          session_id: 'cp4',
          command: 'npm run build',
          updatedAtMs: 1719000005000,
        }],
      });

      events.length = 0;
      jest.advanceTimersByTime(300);

      // New working event should arrive and clear idle
      expect(events.some(function (e) { return e.event === 'agent.working' && e.agent_id === 'cp4'; })).toBe(true);

      // Then quiet again → a new idle
      events.length = 0;
      jest.advanceTimersByTime(800);
      expect(events.some(function (e) { return e.event === 'agent.idle' && e.agent_id === 'cp4'; })).toBe(true);

      obs.stop();
    });

    test('malformed chat_processes does not throw', () => {
      const codexDir = path.join(tempDir, '.codex');
      const procDir = path.join(codexDir, 'process_manager');
      fs.mkdirSync(procDir, { recursive: true });
      fs.writeFileSync(path.join(procDir, 'chat_processes.json'), '{broken', 'utf-8');

      const obs = createObs();
      expect(function () { obs.start(); }).not.toThrow();
      obs.stop();
    });

    test('missing chat_processes file does not throw', () => {
      const obs = createObs();
      expect(function () { obs.start(); }).not.toThrow();
      obs.stop();
    });

    test('chat_processes working includes project_path from session_meta', () => {
      // First establish session_meta via JSONL
      writeSession('cp-meta', 'events.jsonl', [
        '{"type":"session_meta","session_id":"cp-meta","cwd":"/projects/chat-app","thread_name":"Chat Session"}',
      ].join('\n'));

      // Then put command in chat_processes
      writeChatProcesses({
        processes: [{
          session_id: 'cp-meta',
          command: 'echo hello',
          updatedAtMs: 1719000000000,
        }],
      });

      const obs = createObs({ pollIntervalMs: 200 });
      obs.start();

      const working = events.find(function (e) { return e.event === 'agent.working' && e.agent_id === 'cp-meta'; });
      expect(working).toBeTruthy();
      expect(working.name).toBe('Chat Session');
      expect(working.project_path).toBe('/projects/chat-app');

      obs.stop();
    });

    test('chat_processes without timestamps does not re-emit on repeated poll', () => {
      writeChatProcesses({
        processes: [{
          session_id: 'cp-nodate',
          command: 'ls',
        }],
      });

      const obs = createObs({ pollIntervalMs: 200 });
      obs.start();

      const workingEvents = events.filter(function (e) { return e.event === 'agent.working' && e.agent_id === 'cp-nodate'; });
      expect(workingEvents.length).toBe(1);

      // Next poll with same content — should not re-emit
      jest.advanceTimersByTime(300);
      const subsequent = events.filter(function (e) { return e.event === 'agent.working' && e.agent_id === 'cp-nodate'; });
      expect(subsequent.length).toBe(1);

      obs.stop();
    });

    test('chat_processes-only (no JSONL) uses proc.chatTitle and proc.cwd for name/project_path', () => {
      writeChatProcesses({
        processes: [{
          session_id: 'cp-title-only',
          command: 'echo hi',
          chatTitle: 'My Chat Title',
          cwd: '/projects/only-chat',
          updatedAtMs: 1719000000000,
        }],
      });

      const obs = createObs({ pollIntervalMs: 200 });
      obs.start();

      const working = events.find(function (e) { return e.event === 'agent.working' && e.agent_id === 'cp-title-only'; });
      expect(working).toBeTruthy();
      expect(working.name).toBe('My Chat Title');
      expect(working.project_path).toBe('/projects/only-chat');

      obs.stop();
    });
  });
});
