/**
 * claudeForwarder.test.js
 * Tests command-hook stdin handling for claude-forwarder
 */

'use strict';

const path = require('path');
const { spawnSync } = require('child_process');

const FORWARDER_PATH = path.join(__dirname, '..', 'src', 'forwarders', 'claude-forwarder.js');

describe('claude-forwarder', () => {
  test('empty stdin with argv event exits 0', () => {
    const result = spawnSync(process.execPath, [FORWARDER_PATH, 'SessionStart'], {
      env: { ...process.env },
      input: '',
      encoding: 'utf-8',
    });

    expect(result.status).toBe(0);
  });

  test('JSON stdin with hook_event_name exits 0', () => {
    const result = spawnSync(process.execPath, [FORWARDER_PATH, 'SessionStart'], {
      env: { ...process.env },
      input: JSON.stringify({
        hook_event_name: 'SessionStart',
        session_id: 'claude-forwarder-test',
      }),
      encoding: 'utf-8',
    });

    expect(result.status).toBe(0);
  });
});