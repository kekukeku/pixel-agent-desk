/**
 * Claude Hook Adapter
 * Translates legacy Claude hook payloads to normalized agent events
 */

'use strict';

function mapClaudeHookToAgentEvent(claudePayload) {
  const eventName = claudePayload.hook_event_name;
  let normalizedEvent = null;

  // Resolve agent_id
  let agentId = claudePayload.session_id || claudePayload.sessionId;
  if (eventName === 'SubagentStart' || eventName === 'SubagentStop') {
    agentId = claudePayload.agent_id || claudePayload.subagent_session_id || agentId;
  }

  // Resolve source: normalize standard Claude CLI sources to 'claude-code',
  // but preserve custom watcher sources.
  let resolvedSource = 'claude-code';
  if (claudePayload.source && !['startup', 'resume', 'compact'].includes(claudePayload.source)) {
    resolvedSource = claudePayload.source;
  }

  // Base payload
  const basePayload = {
    agent_id: agentId,
    source: resolvedSource,
    project_path: claudePayload.cwd || null,
    model: claudePayload.model || null,
    pid: claudePayload._pid || null,
    timestamp: claudePayload._timestamp || Date.now(),
    metadata: {
      claude_source: claudePayload.source || null, // Preserve Claude's internal source (startup, resume, compact)
      permission_mode: claudePayload.permission_mode || null,
      teammate_name: claudePayload.teammate_name || null,
      team_name: claudePayload.team_name || null,
      last_assistant_message: claudePayload.last_assistant_message || null,
      reason: claudePayload.reason || null,
      notification_type: claudePayload.notification_type || null,
      trigger: claudePayload.trigger || null,
      task_id: claudePayload.task_id || null,
      task_subject: claudePayload.task_subject || null,
      transcript_path: claudePayload.transcript_path || claudePayload.agent_transcript_path || null
    }
  };

  switch (eventName) {
    case 'SessionStart':
      normalizedEvent = {
        ...basePayload,
        event: 'agent.started',
        metadata: { ...basePayload.metadata, session_start_source: claudePayload.source || 'startup' }
      };
      break;

    case 'SessionEnd':
      normalizedEvent = {
        ...basePayload,
        event: 'agent.removed'
      };
      break;

    case 'UserPromptSubmit':
      normalizedEvent = {
        ...basePayload,
        event: 'agent.thinking'
      };
      break;

    case 'PreToolUse':
      normalizedEvent = {
        ...basePayload,
        event: 'agent.working',
        tool: claudePayload.tool_name || null
      };
      break;

    case 'PostToolUse':
      normalizedEvent = {
        ...basePayload,
        event: 'agent.thinking',
        token_usage: claudePayload.tool_response?.token_usage ? {
          input_tokens: claudePayload.tool_response.token_usage.input_tokens || 0,
          cached_input_tokens: (claudePayload.tool_response.token_usage.cache_read_input_tokens || 0) +
                               (claudePayload.tool_response.token_usage.cache_creation_input_tokens || 0),
          output_tokens: claudePayload.tool_response.token_usage.output_tokens || 0
        } : null
      };
      break;

    case 'PostToolUseFailure':
      normalizedEvent = {
        ...basePayload,
        event: 'agent.error',
        tool: claudePayload.tool_name || null
      };
      break;

    case 'PermissionRequest':
      normalizedEvent = {
        ...basePayload,
        event: 'agent.help',
        tool: claudePayload.tool_name || null
      };
      break;

    case 'Notification': {
      const notifType = claudePayload.notification_type;
      const isHelp = notifType === 'permission_prompt' || notifType === 'elicitation_dialog';
      normalizedEvent = {
        ...basePayload,
        event: isHelp ? 'agent.help' : 'agent.idle'
      };
      break;
    }

    case 'Stop':
    case 'TaskCompleted':
      normalizedEvent = {
        ...basePayload,
        event: 'agent.done'
      };
      break;

    case 'SubagentStart':
      normalizedEvent = {
        ...basePayload,
        event: 'agent.started',
        state: 'Working',
        parent_id: claudePayload.session_id || claudePayload.sessionId || null,
        agent_type: claudePayload.agent_type || null,
        metadata: {
          ...basePayload.metadata,
          transcript_path: claudePayload.agent_transcript_path || claudePayload.transcript_path || null
        }
      };
      break;

    case 'SubagentStop':
      normalizedEvent = {
        ...basePayload,
        event: 'agent.removed'
      };
      break;

    case 'TeammateIdle':
      normalizedEvent = {
        ...basePayload,
        event: 'agent.idle',
        metadata: {
          ...basePayload.metadata,
          isTeammate: true
        }
      };
      break;

    case 'PreCompact':
      normalizedEvent = {
        ...basePayload,
        event: 'agent.thinking',
        metadata: {
          ...basePayload.metadata,
          reset_first_seen: true
        }
      };
      break;

    case 'InstructionsLoaded':
      normalizedEvent = {
        ...basePayload,
        event: 'agent.thinking'
      };
      break;

    default:
      break;
  }

  return normalizedEvent;
}

module.exports = { mapClaudeHookToAgentEvent };
