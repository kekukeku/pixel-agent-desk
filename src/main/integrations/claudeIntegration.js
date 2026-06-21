/**
 * Claude Code Integration (stub)
 * Signal source: Claude lifecycle hooks → POST /hook
 * Setup mode: legacy-http-hook
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
  return { status: 'planned', message: 'claude integration not yet implemented' };
}

function start() {
  return { status: 'skipped', message: 'claude start not yet implemented' };
}

function stop() {
  started = false;
  return { status: 'skipped', message: 'claude stop not yet implemented' };
}

function getHealth() {
  return { active: started, lastEventAt: null, error: healthError };
}

module.exports = {
  id: 'claude-code',
  label: 'Claude Code',
  setupMode: 'legacy-http-hook',
  detectInstalled,
  detectIntegrated,
  ensureIntegration,
  start,
  stop,
  getHealth
};
