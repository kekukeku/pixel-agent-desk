/**
 * grokForwarder.test.js
 * Tests command-hook stdin handling for grok-forwarder
 */

'use strict';

const path = require('path');
const { spawnSync } = require('child_process');

const FORWARDER_PATH = path.join(__dirname, '..', 'src', 'forwarders', 'grok-forwarder.js');

describe('grok-forwarder', () => {
  test('empty stdin with GROK_SESSION_ID exits 0 (no JSON.parse crash)', () => {
    const result = spawnSync(process.execPath, [FORWARDER_PATH, 'SessionStart'], {
      env: {
        ...process.env,
        GROK_SESSION_ID: 'grok-forwarder-empty-stdin-test',
        GROK_WORKSPACE_ROOT: '/tmp/grok-forwarder-test',
      },
      input: '',
      encoding: 'utf-8',
    });

    expect(result.status).toBe(0);
  });

  test('{} stdin with GROK_SESSION_ID exits 0', () => {
    const result = spawnSync(process.execPath, [FORWARDER_PATH, 'SessionStart'], {
      env: {
        ...process.env,
        GROK_SESSION_ID: 'grok-forwarder-json-stdin-test',
        GROK_WORKSPACE_ROOT: '/tmp/grok-forwarder-test',
      },
      input: '{}\n',
      encoding: 'utf-8',
    });

    expect(result.status).toBe(0);
  });
});