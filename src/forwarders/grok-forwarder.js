/**
 * Grok Forwarder
 *
 * Reads a Grok hook JSON payload from stdin, maps it to a normalized
 * agent event via mapGrokHookToAgentEvent, and POSTs the result to
 * the PAD event server at http://127.0.0.1:47821/events/agent.
 *
 * Invoked as a command hook by Grok Build:
 *   node grok-forwarder.js <eventName>
 *
 * Fail-open: errors are silently dropped. Always exits 0.
 */

'use strict';

const http = require('http');

const PAD_URL = 'http://127.0.0.1:47821/events/agent';
const TIMEOUT_MS = 8000;
const { mapGrokHookToAgentEvent } = require('../main/adapters/grokHookAdapter');

// Suppress process.exit under test runners to prevent test suite termination
const safeProcessExit = (process.env.JEST_WORKER_ID || process.env.NODE_ENV === 'test')
  ? function (code) { /* no-op: prevent exit in test env */ }
  : process.exit.bind(process);

let raw = '';
process.stdin.setEncoding('utf-8');
process.stdin.on('data', function (chunk) { raw += chunk; });

process.stdin.on('end', function () {
  let payload;
  try {
    if (raw.trim()) {
      payload = JSON.parse(raw);
    } else {
      payload = {};
    }
  } catch (e) {
    safeProcessExit(0);
  }

  if (!payload.hookEventName && !payload.event && !payload.hook_event_name) {
    const argvEvent = process.argv[2];
    if (argvEvent) {
      payload.hookEventName = argvEvent;
    }
  }

  const env = process.env;
  const argv = process.argv;

  const agentEvent = mapGrokHookToAgentEvent(payload, env, argv);
  if (!agentEvent) {
    safeProcessExit(0);
  }

  const body = JSON.stringify(agentEvent);
  const req = http.request(PAD_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
  });

  var done = false;
  function safeExit() {
    if (!done) {
      done = true;
      req.destroy();
      safeProcessExit(0);
    }
  }

  req.on('error', function () { safeExit(); });
  req.setTimeout(TIMEOUT_MS, function () { safeExit(); });
  req.write(body);
  req.end(function () { safeExit(); });
});