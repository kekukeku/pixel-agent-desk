/**
 * Grok Build Integration
 * Signal source: command-hook forwarder via ~/.grok/hooks/ + signals.json observer
 * Setup mode: command-hook+observer
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const {
  registerGrokHooks,
  isGrokHooksRegistered,
} = require('../grokHookRegistration');
const { createGrokObserver, resolveGrokHome } = require('../grokObserver');

function createGrokIntegration(options) {
  const opts = options || {};
  const homeDir = opts.homeDir || os.homedir();
  const grokHome = opts.grokHome || resolveGrokHome(homeDir);
  const forwarderPath = opts.forwarderPath || null;
  const processAgentEvent = opts.processAgentEvent || null;
  const hasAgent = opts.hasAgent || null;
  const debugLog = opts.debugLog || (() => {});

  let observer = null;

  function detectInstalled() {
    try {
      if (fs.existsSync(grokHome)) return true;
      const hooksDir = path.join(grokHome, 'hooks');
      if (fs.existsSync(hooksDir)) return true;
      return false;
    } catch (e) {
      return false;
    }
  }

  function detectIntegrated() {
    try {
      const regOpts = { homeDir };
      if (forwarderPath) regOpts.forwarderPath = forwarderPath;
      return isGrokHooksRegistered(regOpts);
    } catch (e) {
      return false;
    }
  }

  function ensureIntegration() {
    try {
      const regOpts = { homeDir };
      if (forwarderPath) regOpts.forwarderPath = forwarderPath;
      const ok = registerGrokHooks(debugLog, regOpts);
      if (ok) return { status: 'installed' };
      return { status: 'failed', message: 'grok hook registration returned false' };
    } catch (e) {
      return { status: 'failed', message: e.message };
    }
  }

  function start() {
    if (!detectInstalled()) {
      return { status: 'skipped', message: 'grok not installed' };
    }

    if (!processAgentEvent) {
      return { status: 'skipped', message: 'no processAgentEvent callback provided' };
    }

    if (observer) {
      observer.stop();
    }

    observer = createGrokObserver({
      homeDir,
      grokHome,
      processAgentEvent,
      hasAgent: hasAgent || (function () { return false; }),
      debugLog,
    });

    return observer.start();
  }

  function stop() {
    if (observer) {
      const result = observer.stop();
      observer = null;
      return result;
    }
    return { status: 'stopped' };
  }

  function getHealth() {
    if (observer) {
      return observer.getHealth();
    }
    return { active: false, lastEventAt: null, error: null };
  }

  return {
    id: 'grok-build',
    label: 'Grok Build',
    setupMode: 'command-hook+observer',
    detectInstalled,
    detectIntegrated,
    ensureIntegration,
    start,
    stop,
    getHealth,
  };
}

module.exports = createGrokIntegration();

module.exports.createGrokIntegration = createGrokIntegration;