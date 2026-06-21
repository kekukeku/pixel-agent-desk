/**
 * Codex Integration (stub)
 * Signal source: ~/.codex/sessions/** /*.jsonl observer
 * Setup mode: read-only-observer
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
  return { status: 'planned', message: 'codex integration not yet implemented' };
}

function start() {
  return { status: 'skipped', message: 'codex start not yet implemented' };
}

function stop() {
  started = false;
  return { status: 'skipped', message: 'codex stop not yet implemented' };
}

function getHealth() {
  return { active: started, lastEventAt: null, error: healthError };
}

module.exports = {
  id: 'codex',
  label: 'Codex',
  setupMode: 'read-only-observer',
  detectInstalled,
  detectIntegrated,
  ensureIntegration,
  start,
  stop,
  getHealth
};
