/**
 * Antigravity Integration (stub)
 * Signal source: command-hook forwarder via ~/.gemini/config/hooks.json
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
  return { status: 'planned', message: 'antigravity integration not yet implemented' };
}

function start() {
  return { status: 'skipped', message: 'antigravity start not yet implemented' };
}

function stop() {
  started = false;
  return { status: 'skipped', message: 'antigravity stop not yet implemented' };
}

function getHealth() {
  return { active: started, lastEventAt: null, error: healthError };
}

module.exports = {
  id: 'antigravity',
  label: 'Antigravity',
  setupMode: 'command-hook',
  detectInstalled,
  detectIntegrated,
  ensureIntegration,
  start,
  stop,
  getHealth
};
