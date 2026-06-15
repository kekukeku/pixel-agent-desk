/**
 * Normalized Agent Adapter
 * Resolves event field aliases and sets event defaults
 */

'use strict';

function normalizeAgentEvent(payload) {
  const agentId = payload.agent_id || payload.session_id;
  const tool = payload.tool || payload.tool_name || null;
  const timestamp = payload.timestamp || Date.now();

  const normalized = {
    ...payload,
    agent_id: agentId,
    tool: tool,
    timestamp: timestamp
  };

  // Clean up aliases from root object to maintain cleanliness
  delete normalized.session_id;
  delete normalized.tool_name;

  return normalized;
}

module.exports = { normalizeAgentEvent };
