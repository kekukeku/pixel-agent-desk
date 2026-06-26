/**
 * Claude Forwarder
 *
 * Reads a Claude Code hook JSON payload from stdin and POSTs it to the
 * PAD legacy hook server at http://127.0.0.1:47821/hook.
 *
 * Invoked as a command hook by Claude Code:
 *   node claude-forwarder.js <eventName>
 *
 * If stdin is empty or lacks hook_event_name, uses process.argv[2] as fallback.
 *
 * Fail-open: errors are silently dropped. Always exits 0.
 * Never writes to stdout (avoids polluting hook output).
 */

'use strict';

const http = require('http');

const PAD_URL = 'http://127.0.0.1:47821/hook';
const TIMEOUT_MS = 8000;

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

  if (!payload.hook_event_name && !payload.hookEventName) {
    const argvEvent = process.argv[2];
    if (argvEvent) {
      payload.hook_event_name = argvEvent;
    }
  }

  if (!payload.hook_event_name) {
    process.exit(0);
  }

  const body = JSON.stringify(payload);
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