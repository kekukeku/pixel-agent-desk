/**
 * Grok Hook Adapter
 * Translates Grok Build command-hook payloads to normalized agent events.
 *
 * Pure function — no HTTP, no file I/O, no global state.
 *
 * Event-name resolution priority (first defined wins):
 *   1. payload.hookEventName
 *   2. payload.hook_event_name
 *   3. payload.hookEvent
 *   4. payload.hook_event
 *   5. env.GROK_HOOK_EVENT
 *   6. argv[2]
 */

'use strict';

const KNOWN_EVENTS = new Set([
  'SessionStart', 'session_start',
  'UserPromptSubmit', 'user_prompt_submit',
  'PreToolUse', 'pre_tool_use',
  'PostToolUse', 'post_tool_use',
  'PostToolUseFailure', 'post_tool_use_failure',
  'PermissionDenied', 'permission_denied',
  'Stop', 'stop',
  'SessionEnd', 'session_end',
  'SubagentStart', 'subagent_start',
  'SubagentStop', 'subagent_stop',
  'SubagentEnd', 'subagent_end',
]);

function resolveEventName(payload, env, argv) {
  const name = payload.hookEventName
    || payload.hook_event_name
    || payload.hookEvent
    || payload.hook_event
    || (env && env.GROK_HOOK_EVENT)
    || (Array.isArray(argv) && argv[2]);
  return name || null;
}

function resolveAgentId(payload, env) {
  return payload.sessionId
    || payload.session_id
    || (env && env.GROK_SESSION_ID)
    || null;
}

function resolveParentId(payload) {
  return payload.parentSessionId
    || payload.parent_session_id
    || null;
}

function resolveProjectPath(payload, env) {
  return payload.workspaceRoot
    || payload.workspace_root
    || payload.cwd
    || (env && env.GROK_WORKSPACE_ROOT)
    || null;
}

function resolveTool(payload) {
  return payload.toolName || payload.tool_name || null;
}

function basename(filePath) {
  if (!filePath) return '';
  const trimmed = filePath.replace(/[/\\]+$/, '');
  const idx = Math.max(trimmed.lastIndexOf('/'), trimmed.lastIndexOf('\\'));
  return idx >= 0 ? trimmed.slice(idx + 1) : trimmed;
}

function resolveDisplayName(payload) {
  if (payload.sessionTitle) return payload.sessionTitle;
  if (payload.title) return payload.title;
  const pp = resolveProjectPath(payload, {});
  if (pp) {
    const b = basename(pp);
    if (b) return b;
  }
  return 'Grok Build';
}

function normalizeEventCase(name) {
  if (!name) return null;
  const lower = name.toLowerCase();

  if (lower === 'sessionstart' || lower === 'session_start') return 'SessionStart';
  if (lower === 'sessionend' || lower === 'session_end') return 'SessionEnd';
  if (lower === 'userpromptsubmit' || lower === 'user_prompt_submit') return 'UserPromptSubmit';
  if (lower === 'pretooluse' || lower === 'pre_tool_use') return 'PreToolUse';
  if (lower === 'posttooluse' || lower === 'post_tool_use') return 'PostToolUse';
  if (lower === 'posttoolusefailure' || lower === 'post_tool_use_failure') return 'PostToolUseFailure';
  if (lower === 'permissiondenied' || lower === 'permission_denied') return 'PermissionDenied';
  if (lower === 'stop') return 'Stop';
  if (lower === 'subagentstart' || lower === 'subagent_start') return 'SubagentStart';
  if (lower === 'subagentstop' || lower === 'subagent_stop') return 'SubagentStop';
  if (lower === 'subagentend' || lower === 'subagent_end') return 'SubagentStop';

  return null;
}

function mapGrokHookToAgentEvent(payload, env, argv) {
  const eventName = resolveEventName(payload, env, argv);
  if (!eventName) return null;

  const normalized = normalizeEventCase(eventName);
  if (!normalized) return null;

  const agentId = resolveAgentId(payload, env);
  if (!agentId) return null;

  const parentId = resolveParentId(payload);
  const projectPath = resolveProjectPath(payload, env);
  const tool = resolveTool(payload);
  const displayName = resolveDisplayName(payload);

  const basePayload = {
    agent_id: agentId,
    source: 'grok-build',
    name: displayName,
    project_path: projectPath || '',
    timestamp: payload.timestamp ? Date.parse(payload.timestamp) || Date.now() : Date.now(),
    metadata: {
      tool_input: payload.toolInput || payload.tool_input || null,
    },
  };

  if (parentId) {
    basePayload.parent_id = parentId;
  }

  let normalizedEvent = null;

  switch (normalized) {
    case 'SessionStart':
      normalizedEvent = { ...basePayload, event: 'agent.started' };
      break;

    case 'UserPromptSubmit':
      normalizedEvent = { ...basePayload, event: 'agent.thinking' };
      break;

    case 'PreToolUse':
      normalizedEvent = { ...basePayload, event: 'agent.working', tool };
      break;

    case 'PostToolUse':
      normalizedEvent = { ...basePayload, event: 'agent.thinking', tool };
      break;

    case 'PostToolUseFailure':
      normalizedEvent = { ...basePayload, event: 'agent.error', tool };
      break;

    case 'PermissionDenied':
      normalizedEvent = { ...basePayload, event: 'agent.help', tool };
      break;

    case 'Stop':
      normalizedEvent = { ...basePayload, event: 'agent.done' };
      break;

    case 'SessionEnd':
      normalizedEvent = { ...basePayload, event: 'agent.removed' };
      break;

    case 'SubagentStart':
      normalizedEvent = { ...basePayload, event: 'agent.started' };
      break;

    case 'SubagentStop':
      normalizedEvent = { ...basePayload, event: 'agent.removed' };
      break;

    default:
      break;
  }

  return normalizedEvent;
}

module.exports = { mapGrokHookToAgentEvent };
