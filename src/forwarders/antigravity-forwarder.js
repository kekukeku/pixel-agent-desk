/**
 * Antigravity Forwarder
 *
 * Reads an Antigravity hook JSON payload from stdin, maps it to a normalized
 * agent event via mapAntigravityHookToAgentEvent, and POSTs the result to
 * the PAD event server at http://127.0.0.1:47821/events/agent.
 *
 * Invoked as a command hook by Antigravity:
 *   node "<forwarderPath>" PreInvocation
 *
 * If the stdin payload lacks hookEventName, uses process.argv[2] as fallback.
 *
 * Fail-open: errors are silently dropped. Always exits 0.
 * Never writes to stdout (avoids polluting hook output).
 */

'use strict';

const http = require('http');

const PAD_URL = 'http://127.0.0.1:47821/events/agent';
const TIMEOUT_MS = 8000;
const { mapAntigravityHookToAgentEvent } = require('../main/adapters/antigravityHookAdapter');

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
    process.exit(0);
  }

  // If the payload doesn't have an event name, use the argv event
  if (!payload.hookEventName && !payload.event && !payload.hook_event_name) {
    const argvEvent = process.argv[2];
    if (argvEvent) {
      payload.hookEventName = argvEvent;
    }
  }

  const agentEvent = mapAntigravityHookToAgentEvent(payload);
  if (!agentEvent) {
    process.exit(0);
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
      process.exit(0);
    }
  }

  req.on('error', function () { safeExit(); });
  req.setTimeout(TIMEOUT_MS, function () { safeExit(); });
  req.write(body);
  req.end(function () { safeExit(); });
});
