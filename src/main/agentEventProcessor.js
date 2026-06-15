/**
 * Agent Event Processor
 * Manages generic agent state transitions and event processing
 */

'use strict';

const path = require('path');
const { normalizeAgentEvent } = require('./adapters/normalizedAgentAdapter');
const { resolveModelPricing, calculateTokenCost, getContextWindowSize, roundCost } = require('../pricing');

let agentManager = null;
let sessionPids = null;
let debugLog = console.log;
let detectClaudePidByTranscript = () => {};

const pendingSessionStarts = [];

function init(deps) {
  agentManager = deps.agentManager;
  sessionPids = deps.sessionPids;
  debugLog = deps.debugLog || console.log;
  detectClaudePidByTranscript = deps.detectClaudePidByTranscript || (() => {});
}

function computeTokenUsage(agent, tokenUsage) {
  if (!tokenUsage) return null;
  const cur = agent.tokenUsage || { inputTokens: 0, outputTokens: 0, estimatedCost: 0 };

  const input = tokenUsage.input_tokens || 0;
  const cacheRead = tokenUsage.cached_input_tokens || tokenUsage.cache_read_input_tokens || 0;
  const cacheCreate = tokenUsage.cache_creation_input_tokens || 0;
  const output = tokenUsage.output_tokens || 0;

  const inputTokens = cur.inputTokens + input + cacheRead + cacheCreate;
  const outputTokens = cur.outputTokens + output;

  const entryCost = calculateTokenCost({
    model: agent.model,
    input,
    cacheRead,
    cacheCreate,
    output
  });
  const estimatedCost = roundCost(cur.estimatedCost + entryCost);

  const ctxWindow = getContextWindowSize(agent.model);
  const latestInput = input + cacheRead + cacheCreate;
  const contextPercent = ctxWindow > 0 ? Math.min(100, Math.round((latestInput / ctxWindow) * 100)) : 0;

  return { inputTokens, outputTokens, estimatedCost, contextPercent };
}

function processAgentEvent(rawEvent, updateChannel = 'processor') {
  const data = normalizeAgentEvent(rawEvent);
  const event = data.event;
  const agentId = data.agent_id;
  const source = data.source;
  const timestamp = data.timestamp;

  debugLog(`[Processor] ← ${event} agent=${agentId.slice(0, 8)}`);

  // Ensure agent exists on any event other than started/removed
  if (agentManager && event !== 'agent.started' && event !== 'agent.removed') {
    const existing = agentManager.getAgent(agentId);
    if (!existing) {
      debugLog(`[Processor] Auto-create from ${event}: ${agentId.slice(0, 8)}`);
      handleAgentStarted(normalizeAgentEvent({
        event: 'agent.started',
        agent_id: agentId,
        source: source,
        project_path: data.project_path || null,
        model: data.model || null,
        timestamp: timestamp,
        metadata: data.metadata
      }), 'http');
    }
  }

  switch (event) {
    case 'agent.started':
      handleAgentStarted(data, updateChannel);
      break;
    case 'agent.removed':
      handleAgentRemoved(data);
      break;
    case 'agent.thinking':
      handleAgentThinking(data, updateChannel);
      break;
    case 'agent.working':
      handleAgentWorking(data, updateChannel);
      break;
    case 'agent.idle':
      handleAgentIdle(data, updateChannel);
      break;
    case 'agent.done':
      handleAgentDone(data, updateChannel);
      break;
    case 'agent.error': {
      const agent = agentManager ? agentManager.getAgent(agentId) : null;
      if (agentManager && agent) {
        agentManager.updateAgent({
          ...agent,
          state: 'Error',
          currentTool: data.tool || null,
          lastActivity: timestamp
        }, updateChannel);
      }
      break;
    }
    case 'agent.help': {
      const agent = agentManager ? agentManager.getAgent(agentId) : null;
      if (agentManager && agent) {
        agentManager.updateAgent({
          ...agent,
          state: 'Help',
          currentTool: data.tool || null,
          lastActivity: timestamp
        }, updateChannel);
      }
      break;
    }
  }
}

function handleAgentStarted(data, updateChannel = 'processor') {
  const agentId = data.agent_id;

  if (!agentManager) {
    pendingSessionStarts.push(data);
    debugLog(`[Processor] agent.started queued: ${agentId.slice(0, 8)}`);
    return null;
  }

  const existing = agentManager.getAgent(agentId);
  const isSubagent = !!data.parent_id;
  const isTeammate = !!(data.metadata?.isTeammate || data.metadata?.teammate_name);
  const name = data.name || (data.project_path ? path.basename(data.project_path) : 'Agent');

  const updatePayload = {
    sessionId: agentId,
    projectPath: data.project_path || (existing ? existing.projectPath : null),
    displayName: name,
    state: data.state || 'Waiting',
    model: data.model || (existing ? existing.model : null),
    source: data.source || (existing ? existing.source : null),
    agentType: data.agent_type || (existing ? existing.agentType : null),
    parentId: data.parent_id || (existing ? existing.parentId : null),
    isSubagent,
    isTeammate,
    teammateName: data.metadata?.teammate_name || (existing ? existing.teammateName : null),
    teamName: data.metadata?.team_name || (existing ? existing.teamName : null),
    jsonlPath: data.metadata?.transcript_path || (existing ? existing.jsonlPath : null),
    permissionMode: data.metadata?.permission_mode || (existing ? existing.permissionMode : null),
    lastActivity: data.timestamp
  };

  if (existing) {
    agentManager.updateAgent({
      ...existing,
      ...updatePayload,
      tokenUsage: data.metadata?.session_start_source === 'compact'
        ? { ...(existing.tokenUsage || {}), contextPercent: 0 }
        : (existing.tokenUsage || { inputTokens: 0, outputTokens: 0, estimatedCost: 0 })
    }, updateChannel);
  } else {
    agentManager.updateAgent(updatePayload, updateChannel);
  }

  // PID registration
  if (data.pid && data.pid > 0) {
    if (sessionPids) sessionPids.set(agentId, data.pid);
  } else if (data.source === 'claude-code') {
    detectClaudePidByTranscript(data.metadata?.transcript_path || null, (result) => {
      if (!result) return;
      if (typeof result === 'number' && sessionPids) {
        sessionPids.set(agentId, result);
        debugLog(`[Processor] PID assigned via transcript: ${agentId.slice(0, 8)} → pid=${result}`);
      } else if (Array.isArray(result) && sessionPids) {
        const registeredPids = new Set(sessionPids.values());
        const newPid = result.find(p => !registeredPids.has(p));
        if (newPid) {
          sessionPids.set(agentId, newPid);
          debugLog(`[Processor] PID assigned (fallback array): ${agentId.slice(0, 8)} → pid=${newPid}`);
        }
      }
    });
  }

  return agentManager.getAgent(agentId);
}

function handleAgentRemoved(data) {
  const agentId = data.agent_id;
  if (sessionPids) sessionPids.delete(agentId);
  if (agentManager) {
    const agent = agentManager.getAgent(agentId);
    if (agent) {
      agentManager.removeAgent(agentId);
    }
  }
}

function handleAgentThinking(data, updateChannel = 'processor') {
  const agentId = data.agent_id;
  if (!agentManager) return;
  const agent = agentManager.getAgent(agentId);
  if (agent) {
    let tokenUsage = agent.tokenUsage;
    if (data.token_usage) {
      tokenUsage = computeTokenUsage(agent, data.token_usage);
    }
    const shouldResetFirstSeen = !!data.metadata?.reset_first_seen;
    agentManager.updateAgent({
      ...agent,
      state: 'Thinking',
      currentTool: null,
      lastActivity: data.timestamp,
      ...(shouldResetFirstSeen && { firstSeen: data.timestamp }),
      ...(tokenUsage && { tokenUsage })
    }, updateChannel);
  }
}

function handleAgentWorking(data, updateChannel = 'processor') {
  const agentId = data.agent_id;
  if (!agentManager) return;
  const agent = agentManager.getAgent(agentId);
  if (agent) {
    agentManager.updateAgent({
      ...agent,
      state: 'Working',
      currentTool: data.tool || null,
      lastActivity: data.timestamp
    }, updateChannel);
  }
}

function handleAgentIdle(data, updateChannel = 'processor') {
  const agentId = data.agent_id;
  if (!agentManager) return;
  const agent = agentManager.getAgent(agentId);
  if (agent) {
    const isTeammate = !!(data.metadata?.isTeammate || data.metadata?.teammate_name);
    agentManager.updateAgent({
      ...agent,
      state: 'Waiting',
      currentTool: null,
      lastActivity: data.timestamp,
      ...(isTeammate && {
        isTeammate,
        teammateName: data.metadata?.teammate_name || agent.teammateName || null,
        teamName: data.metadata?.team_name || agent.teamName || null
      })
    }, updateChannel);
  }
}

function handleAgentDone(data, updateChannel = 'processor') {
  const agentId = data.agent_id;
  if (!agentManager) return;
  const agent = agentManager.getAgent(agentId);
  if (agent) {
    agentManager.updateAgent({
      ...agent,
      state: 'Done',
      currentTool: null,
      lastMessage: data.metadata?.last_assistant_message || null,
      lastActivity: data.timestamp
    }, updateChannel);
  }
}

function flushPendingStarts() {
  while (pendingSessionStarts.length > 0) {
    const data = pendingSessionStarts.shift();
    handleAgentStarted(data);
  }
}

function cleanup() {
  pendingSessionStarts.length = 0;
}

module.exports = {
  init,
  processAgentEvent,
  flushPendingStarts,
  cleanup
};
