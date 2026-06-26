/**
 * grokObserver.test.js
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { createGrokObserver } = require('../src/main/grokObserver');
const { encodeCwd } = require('../src/main/adapters/grokObserverAdapter');

describe('grokObserver', () => {
  let tempDir;
  let grokHome;
  const sessionId = 'observer-test-session';
  const cwd = '/tmp/grok-observer-test';

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pad-grok-observer-'));
    grokHome = path.join(tempDir, '.grok');
    const sessionDir = path.join(grokHome, 'sessions', encodeCwd(cwd), sessionId);
    fs.mkdirSync(sessionDir, { recursive: true });
    fs.writeFileSync(
      path.join(sessionDir, 'signals.json'),
      JSON.stringify({
        contextWindowUsage: 25,
        contextTokensUsed: 50000,
        contextWindowTokens: 200000,
        totalTokensBeforeCompaction: 0,
        primaryModelId: 'grok-composer-2.5-fast',
      }),
      'utf-8'
    );
    fs.writeFileSync(
      path.join(grokHome, 'active_sessions.json'),
      JSON.stringify([{ session_id: sessionId, cwd, pid: 12345 }]),
      'utf-8'
    );
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test('emits context event when agent exists', (done) => {
    const events = [];
    const observer = createGrokObserver({
      grokHome,
      pollIntervalMs: 50,
      hasAgent: (id) => id === sessionId,
      processAgentEvent: (event) => events.push(event),
      debugLog: () => {},
    });

    observer.start();

    setTimeout(() => {
      observer.stop();
      expect(events.length).toBeGreaterThanOrEqual(1);
      expect(events[0]).toMatchObject({
        agent_id: sessionId,
        source: 'grok-build',
        context_usage: { percent: 25, tokens_used: 50000 },
        metadata: { context_only: true },
      });
      done();
    }, 120);
  });

  test('skips sessions without a registered PAD agent', (done) => {
    const events = [];
    const observer = createGrokObserver({
      grokHome,
      pollIntervalMs: 50,
      hasAgent: () => false,
      processAgentEvent: (event) => events.push(event),
      debugLog: () => {},
    });

    observer.start();

    setTimeout(() => {
      observer.stop();
      expect(events.length).toBe(0);
      done();
    }, 120);
  });

  test('deduplicates unchanged snapshots', (done) => {
    const events = [];
    const observer = createGrokObserver({
      grokHome,
      pollIntervalMs: 40,
      hasAgent: (id) => id === sessionId,
      processAgentEvent: (event) => events.push(event),
      debugLog: () => {},
    });

    observer.start();

    setTimeout(() => {
      observer.stop();
      expect(events.length).toBe(1);
      done();
    }, 150);
  });
});