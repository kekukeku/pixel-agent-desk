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
const { mapGrokHookToAgentEvent } = require('../main/adapters/grokHookAdapter');

let raw = '';
process.stdin.setEncoding('utf-8');
process.stdin.on('data', function (chunk) { raw += chunk; });

process.stdin.on('end', function () {
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch (e) {
    process.exit(0);
  }

  const env = process.env;
  const argv = process.argv;

  const agentEvent = mapGrokHookToAgentEvent(payload, env, argv);
  if (!agentEvent) {
    process.exit(0);
  }

  const body = JSON.stringify(agentEvent);
  const req = http.request(PAD_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
  });

  req.on('error', function () {});
  req.write(body);
  req.end(function () { process.exit(0); });
});
