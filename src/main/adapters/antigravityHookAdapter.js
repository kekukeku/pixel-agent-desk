/**
 * Antigravity Hook Adapter
 * Translates Antigravity command-hook payloads to normalized agent events.
 *
 * Pure function — no HTTP, no file I/O, no global state.
 *
 * Antigravity stdin payload fields:
 *   conversationId       → agent_id
 *   workspacePaths[0]    → project_path
 *   basename(workspacePaths[0]) → name
 *   transcriptPath        → metadata.transcript_path
 *   artifactDirectoryPath → metadata.artifact_directory_path
 *   toolCall.name / toolName / tool_name → tool
 */

'use strict';

const path = require('path');

function mapAntigravityHookToAgentEvent(payload) {
  if (!payload || typeof payload !== 'object') return null;

  const eventName = payload.hookEventName || payload.event || payload.hook_event_name;
  if (!eventName) return null;

  const agentId = payload.conversationId || payload.conversation_id;
  if (!agentId) return null;

  const workspacePaths = payload.workspacePaths || [];
  const projectPath = workspacePaths[0] || payload.cwd || '';
  const name = projectPath ? path.basename(projectPath) : 'Antigravity';

  const normalizedEvent = normalizeEventCase(eventName);

  const basePayload = {
    agent_id: agentId,
    source: 'antigravity',
    name,
    project_path: projectPath,
    timestamp: Date.now(),
    metadata: {
      transcript_path: payload.transcriptPath || payload.transcript_path || null,
      artifact_directory_path: payload.artifactDirectoryPath || payload.artifact_directory_path || null,
    },
  };

  if (!normalizedEvent) return null;

  // Resolve tool name from multiple sources
  const tool = (payload.toolCall && payload.toolCall.name) || payload.toolName || payload.tool_name || null;

  let result = null;

  switch (normalizedEvent) {
    case 'PreInvocation':
      result = { ...basePayload, event: 'agent.started' };
      break;

    case 'PreToolUse':
      result = { ...basePayload, event: 'agent.working', tool };
      break;

    case 'PostToolUse':
      result = { ...basePayload, event: 'agent.thinking', tool };
      break;

    case 'Stop':
      result = { ...basePayload, event: 'agent.idle' };
      break;

    case 'SessionEnd':
      result = { ...basePayload, event: 'agent.removed' };
      break;

    default:
      break;
  }

  return result;
}

function normalizeEventCase(name) {
  if (!name) return null;
  const lower = name.toLowerCase();

  if (lower === 'preinvocation' || lower === 'pre_invocation') return 'PreInvocation';
  if (lower === 'pretooluse' || lower === 'pre_tool_use') return 'PreToolUse';
  if (lower === 'posttooluse' || lower === 'post_tool_use') return 'PostToolUse';
  if (lower === 'stop' || lower === 'postinvocation' || lower === 'post_invocation') return 'Stop';
  if (lower === 'sessionend' || lower === 'session_end' || lower === 'end' || lower === 'exit') return 'SessionEnd';

  return null;
}

module.exports = { mapAntigravityHookToAgentEvent };
