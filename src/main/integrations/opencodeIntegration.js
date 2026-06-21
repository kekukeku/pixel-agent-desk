/**
 * OpenWork / OpenCode Integration (stub)
 * Signal source: OpenCode plugin lifecycle events
 * Setup mode: opencode-plugin
 */

'use strict';

let started = false;
let healthError = null;

function detectInstalled() {
  return false;
}

function detectIntegrated() {
  return false;
}

function ensureIntegration() {
  return { status: 'planned', message: 'opencode integration not yet implemented' };
}

function start() {
  return { status: 'skipped', message: 'opencode start not yet implemented' };
}

function stop() {
  started = false;
  return { status: 'skipped', message: 'opencode stop not yet implemented' };
}

function getHealth() {
  return { active: started, lastEventAt: null, error: healthError };
}

module.exports = {
  id: 'opencode',
  label: 'OpenWork / OpenCode',
  setupMode: 'opencode-plugin',
  detectInstalled,
  detectIntegrated,
  ensureIntegration,
  start,
  stop,
  getHealth
};
