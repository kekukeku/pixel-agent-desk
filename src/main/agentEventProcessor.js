/**
 * Agent Event Processor
 * Manages generic agent state transitions and event processing
 */

'use strict';

const path = require('path');
const { normalizeAgentEvent } = require('./adapters/normalizedAgentAdapter');
const { calculateTokenCost, getContextWindowSize, roundCost } = require('../pricing');

let agentManager = null;
let sessionPids = null;
let debugLog = console.log;
let detectClaudePidByTranscript = () => {};
let onContextUsage = null;

const pendingSessionStarts = [];

const lastRawTokenUsage = new Map();

function snapshotKey(source, agentId) {
  return `${source}::${agentId}`;
}

function computeSnapshotDelta(source, agentId, rawTokenUsage) {
  const key = snapshotKey(source, agentId);
  const prev = lastRawTokenUsage.get(key);

  const input = rawTokenUsage.input_tokens || 0;
  const cached = rawTokenUsage.cached_input_tokens || 0;
  const output = rawTokenUsage.output_tokens || 0;

  let delta = { input_tokens: 0, cached_input_tokens: 0, output_tokens: 0 };

  if (prev) {
    delta = {
      input_tokens: Math.max(0, input - (prev.input_tokens || 0)),
      cached_input_tokens: Math.max(0, cached - (prev.cached_input_tokens || 0)),
      output_tokens: Math.max(0, output - (prev.output_tokens || 0))
    };
  }

  lastRawTokenUsage.set(key, { input_tokens: input, cached_input_tokens: cached, output_tokens: output });

  return delta;
}

function init(deps) {
  agentManager = deps.agentManager;
  sessionPids = deps.sessionPids;
  debugLog = deps.debugLog || console.log;
  detectClaudePidByTranscript = deps.detectClaudePidByTranscript || (() => {});
  if (deps.onContextUsage) onContextUsage = deps.onContextUsage;
}

function applyContextUsage(agent, data) {
  const cu = data.context_usage;
  if (!cu || cu.kind !== 'snapshot') return null;

  const contextUsage = {
    kind: 'snapshot',
    tokensUsed: cu.tokens_used || 0,
    windowTokens: cu.window_tokens || 0,
    percent: cu.percent != null ? cu.percent : 0,
    totalBeforeCompaction: cu.total_before_compaction || 0,
    available: true,
  };

  const tokenUsage = {
    inputTokens: agent.tokenUsage?.inputTokens || 0,
    outputTokens: agent.tokenUsage?.outputTokens || 0,
    estimatedCost: agent.tokenUsage?.estimatedCost || 0,
    usageAvailable: false,
    contextPercent: contextUsage.percent,
  };

  return {
    contextUsage,
    tokenUsage,
    model: data.model || agent.model || null,
  };
}

function isContextOnlyEvent(data) {
  return data.context_usage?.kind === 'snapshot' && !!data.metadata?.context_only;
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

  // Context-only Grok updates must not auto-create agents or change lifecycle.
  if (isContextOnlyEvent(data)) {
    const existing = agentManager ? agentManager.getAgent(agentId) : null;
    if (!existing) {
      return;
    }
    const ctx = applyContextUsage(existing, data);
    if (ctx) {
      agentManager.updateAgent({
        ...existing,
        ...ctx,
        lastActivity: timestamp,
      }, updateChannel);

      if (onContextUsage && ctx.contextUsage?.tokensUsed > 0) {
        try {
          onContextUsage({
            agentId,
            source: data.source || existing.source,
            model: ctx.model || existing.model,
            tokensUsed: ctx.contextUsage.tokensUsed,
            projectPath: data.project_path || existing.projectPath,
          });
        } catch (e) {
          debugLog(`[Processor] onContextUsage failed: ${e.message}`);
        }
      }
    }
    return;
  }

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
        const pubText = pickPublicActivityText(data);
        agentManager.updateAgent({
          ...agent,
          state: 'Error',
          currentTool: data.tool || null,
          ...(pubText && { publicActivityText: pubText }),
          lastActivity: timestamp
        }, updateChannel);
      }
      break;
    }
    case 'agent.help': {
      const agent = agentManager ? agentManager.getAgent(agentId) : null;
      if (agentManager && agent) {
        const pubText = pickPublicActivityText(data);
        agentManager.updateAgent({
          ...agent,
          state: 'Help',
          currentTool: data.tool || null,
          ...(pubText && { publicActivityText: pubText }),
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
  const name = data.source === 'codex'
    ? 'Codex'
    : (data.name || (data.project_path ? path.basename(data.project_path) : 'Agent'));

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
  lastRawTokenUsage.delete(snapshotKey(data.source, agentId));
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

    const rawSnapshot = data.metadata?.raw_token_usage;
    if (rawSnapshot) {
      const delta = computeSnapshotDelta(data.source, agentId, rawSnapshot);
      const hasDelta = delta.input_tokens > 0 || delta.cached_input_tokens > 0 || delta.output_tokens > 0;
      if (hasDelta) {
        tokenUsage = computeTokenUsage(agent, delta);
      }
    } else if (data.token_usage) {
      tokenUsage = computeTokenUsage(agent, data.token_usage);
    }

    const pubText = pickPublicActivityText(data);
    const shouldResetFirstSeen = !!data.metadata?.reset_first_seen;
    agentManager.updateAgent({
      ...agent,
      state: 'Thinking',
      currentTool: null,
      ...(pubText && { publicActivityText: pubText }),
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
    const pubText = pickPublicActivityText(data);
    agentManager.updateAgent({
      ...agent,
      state: 'Working',
      currentTool: data.tool || null,
      ...(pubText && { publicActivityText: pubText }),
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
      publicActivityText: null,
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
    const lastMsg = data.metadata?.last_assistant_message || null;
    // Bridge lastMessage as publicActivityText if available (capped at 60 chars)
    const bridgeText = lastMsg
      ? (String(lastMsg).length > 60 ? String(lastMsg).slice(0, 57) + '...' : String(lastMsg))
      : null;

    agentManager.updateAgent({
      ...agent,
      state: 'Done',
      currentTool: null,
      publicActivityText: bridgeText || null,
      lastMessage: lastMsg,
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

function pickPublicActivityText(data) {
  return data.public_activity_text ||
    data.activity_text ||
    (data.metadata && (data.metadata.public_activity_text || data.metadata.activity_text)) ||
    null;
}

function cleanup() {
  pendingSessionStarts.length = 0;
  lastRawTokenUsage.clear();
}

module.exports = {
  init,
  processAgentEvent,
  flushPendingStarts,
  cleanup,
  get lastRawTokenUsage() { return lastRawTokenUsage; }
};
