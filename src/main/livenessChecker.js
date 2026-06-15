/**
 * Liveness Checker
 * PID detection, transcript-based re-verification, 2-second interval process liveness check
 */

const path = require('path');
const os = require('os');
const fs = require('fs');

const sessionPids = new Map(); // sessionId → actual claude process PID

async function checkLivenessTier1(agentId, pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Function to accurately find the Claude PID for a session using transcript_path
 * (Disabled for custom hook events, always returns null)
 */
function detectClaudePidByTranscript(jsonlPath, callback) {
  callback(null);
}

function detectClaudePidsFallback(callback) {
  callback(null);
}

// Re-detect agents with unregistered PIDs (disabled)
function retryPidDetection(sessionId, agentManager, debugLog) {
  // no-op
}

/**
 * Count running Claude CLI processes (disabled)
 */
function countClaudeProcesses(callback) {
  callback(0);
}

/**
 * Get jsonl file mtime (disabled)
 */
function getJsonlMtime(jsonlPath) {
  return 0;
}

// Zombie sweep: disabled
function zombieSweep(agentManager, debugLog) {
  // no-op
}

const LIVENESS_INTERVAL = 2000;
const ZOMBIE_SWEEP_INTERVAL = 30000;

function startLivenessChecker({ agentManager, debugLog }) {
  const zombieSweepId = setInterval(() => {
    // Disabled process-based zombie sweep
  }, ZOMBIE_SWEEP_INTERVAL);

  const SESSION_TIMEOUT = 10 * 60 * 1000; // 10 minutes inactivity timeout

  const livenessCheckId = setInterval(async () => {
    if (!agentManager) return;
    const now = Date.now();
    for (const agent of agentManager.getAllAgents()) {
      const lastAct = agent.lastActivity || agent.firstSeen || now;
      const inactiveDuration = now - lastAct;
      if (inactiveDuration > SESSION_TIMEOUT) {
        debugLog(`[Live] Agent ${agent.id.slice(0, 8)} inactive for ${Math.round(inactiveDuration / 1000)}s → timeout cleanup`);
        agentManager.removeAgent(agent.id);
      }
    }
  }, LIVENESS_INTERVAL);

  return { zombieSweepId, livenessCheckId };
}

module.exports = { sessionPids, startLivenessChecker, detectClaudePidByTranscript };
