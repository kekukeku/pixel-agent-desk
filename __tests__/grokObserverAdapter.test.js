/**
 * grokObserverAdapter.test.js
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const {
  encodeCwd,
  parseActiveSessions,
  parseSignals,
  resolveSessionDir,
  mapSignalsToContextEvent,
  contextSnapshotChanged,
} = require('../src/main/adapters/grokObserverAdapter');

describe('grokObserverAdapter', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pad-grok-adapter-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test('encodeCwd URL-encodes absolute paths', () => {
    expect(encodeCwd('/tmp/packaged-test')).toBe('%2Ftmp%2Fpackaged-test');
    expect(encodeCwd('/Users/foo/Github projects/bar')).toBe(
      '%2FUsers%2Ffoo%2FGithub%20projects%2Fbar'
    );
  });

  test('parseActiveSessions reads session_id and cwd', () => {
    const sessions = parseActiveSessions(JSON.stringify([
      { session_id: 'sess-1', cwd: '/tmp/packaged-test', pid: 1 },
    ]));
    expect(sessions).toEqual([{
      sessionId: 'sess-1',
      cwd: '/tmp/packaged-test',
      pid: 1,
      openedAt: null,
    }]);
  });

  test('parseSignals maps Grok signals.json fields', () => {
    const fixture = fs.readFileSync(
      path.join(__dirname, 'fixtures', 'grok', 'signals.json'),
      'utf-8'
    );
    const signals = parseSignals(fixture);
    expect(signals).toEqual({
      kind: 'snapshot',
      tokens_used: 84000,
      window_tokens: 200000,
      percent: 42,
      total_before_compaction: 0,
      primaryModelId: 'grok-composer-2.5-fast',
    });
  });

  test('resolveSessionDir finds encoded cwd path', () => {
    const grokHome = path.join(tempDir, '.grok');
    const sessionId = 'packaged-smoke-grok-ctx';
    const cwd = '/tmp/packaged-test';
    const sessionDir = path.join(
      grokHome,
      'sessions',
      encodeCwd(cwd),
      sessionId
    );
    fs.mkdirSync(sessionDir, { recursive: true });
    fs.writeFileSync(path.join(sessionDir, 'signals.json'), '{}', 'utf-8');

    const resolved = resolveSessionDir(grokHome, sessionId, cwd, new Map());
    expect(resolved).toBe(sessionDir);
  });

  test('resolveSessionDir falls back to glob by session id', () => {
    const grokHome = path.join(tempDir, '.grok');
    const sessionId = 'glob-fallback-session';
    const sessionDir = path.join(grokHome, 'sessions', 'some-slug-hash', sessionId);
    fs.mkdirSync(sessionDir, { recursive: true });
    fs.writeFileSync(path.join(sessionDir, 'signals.json'), '{}', 'utf-8');

    const resolved = resolveSessionDir(grokHome, sessionId, '/unexpected/path', new Map());
    expect(resolved).toBe(sessionDir);
  });

  test('resolveSessionDir uses .cwd file for long path groups', () => {
    const grokHome = path.join(tempDir, '.grok');
    const sessionId = 'long-path-session';
    const cwd = '/very/long/path/to/project';
    const groupDir = path.join(grokHome, 'sessions', 'slug-abc123');
    const sessionDir = path.join(groupDir, sessionId);
    fs.mkdirSync(sessionDir, { recursive: true });
    fs.writeFileSync(path.join(groupDir, '.cwd'), cwd + '\n', 'utf-8');
    fs.writeFileSync(path.join(sessionDir, 'signals.json'), '{}', 'utf-8');

    const resolved = resolveSessionDir(grokHome, sessionId, cwd, new Map());
    expect(resolved).toBe(sessionDir);
  });

  test('mapSignalsToContextEvent emits context_only metadata', () => {
    const event = mapSignalsToContextEvent('sess-1', {
      kind: 'snapshot',
      tokens_used: 100,
      window_tokens: 200000,
      percent: 12,
      total_before_compaction: 0,
      primaryModelId: 'grok-composer-2.5-fast',
    }, { projectPath: '/tmp/test' });

    expect(event).toMatchObject({
      event: 'agent.thinking',
      agent_id: 'sess-1',
      source: 'grok-build',
      project_path: '/tmp/test',
      model: 'grok-composer-2.5-fast',
      context_usage: {
        kind: 'snapshot',
        tokens_used: 100,
        window_tokens: 200000,
        percent: 12,
        total_before_compaction: 0,
      },
      metadata: { context_only: true },
    });
  });

  test('contextSnapshotChanged detects percent updates', () => {
    const prev = { percent: 10, tokens_used: 100, window_tokens: 200000, total_before_compaction: 0, primaryModelId: 'm1' };
    const next = { ...prev, percent: 11 };
    expect(contextSnapshotChanged(prev, next)).toBe(true);
    expect(contextSnapshotChanged(next, { ...next })).toBe(false);
  });
});