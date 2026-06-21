/**
 * Grok Build Integration (stub)
 * Signal source: command-hook forwarder via ~/.grok/hooks/
 * Setup mode: command-hook
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
  return { status: 'planned', message: 'grok integration not yet implemented' };
}

function start() {
  return { status: 'skipped', message: 'grok start not yet implemented' };
}

function stop() {
  started = false;
  return { status: 'skipped', message: 'grok stop not yet implemented' };
}

function getHealth() {
  return { active: started, lastEventAt: null, error: healthError };
}

module.exports = {
  id: 'grok-build',
  label: 'Grok Build',
  setupMode: 'command-hook',
  detectInstalled,
  detectIntegrated,
  ensureIntegration,
  start,
  stop,
  getHealth
};
