/**
 * Codex Observer Adapter
 *
 * Pure parsing functions for Codex session data sources:
 *   - ~/.codex/sessions/** /*.jsonl       (session event streams)
 *   - ~/.codex/session_index.jsonl        (session registry)
 *   - ~/.codex/process_manager/chat_processes.json  (active process info)
 *
 * No file I/O, no HTTP, no global state.
 */

'use strict';

const KNOWN_EVENT_TYPES = new Set([
  'session_meta',
  'user_turn',
  'turn_context',
  'task_started',
  'task_complete',
  'function_call',
  'function_call_output',
  'tool_use',
  'tool_result',
  'token_count',
  'error',
  'message',
]);

function basename(filePath) {
  if (!filePath) return '';
  const trimmed = filePath.replace(/[/\\]+$/, '');
  const idx = Math.max(trimmed.lastIndexOf('/'), trimmed.lastIndexOf('\\'));
  return idx >= 0 ? trimmed.slice(idx + 1) : trimmed;
}

function safeParse(line) {
  if (!line || typeof line !== 'string') return null;
  const trimmed = line.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch (e) {
    return null;
  }
}

function parseSessionMeta(record) {
  if (!record || record.type !== 'session_meta') return null;

  return {
    session_id: record.session_id || record.sessionId || null,
    cwd: record.cwd || record.working_directory || null,
    thread_name: record.thread_name || record.thread_title || null,
    model: record.model || null,
    created_at: record.created_at || record.timestamp || null,
  };
}

function parseSessionEvent(record) {
  if (!record || !record.type) return null;

  const type = record.type;
  let event = null;

  switch (type) {
    case 'session_meta':
      event = 'session_meta';
      break;
    case 'user_turn':
    case 'turn_context':
    case 'task_started':
      event = 'task_started';
      break;
    case 'function_call':
    case 'tool_use':
      event = 'tool_running';
      break;
    case 'function_call_output':
    case 'tool_result':
      event = 'tool_completed';
      break;
    case 'task_complete':
      event = 'task_complete';
      break;
    case 'token_count':
      event = 'token_count';
      break;
    case 'error':
      event = 'error';
      break;
    default:
      return null;
  }

  return {
    type: event,
    session_id: record.session_id || record.sessionId || null,
    tool_name: record.function_name || record.tool_name || record.command || null,
    cwd: record.cwd || null,
    model: record.model || null,
    timestamp: record.timestamp || record.created_at || null,
    token_usage: (type === 'token_count' && record.token_usage)
      ? {
          input_tokens: record.token_usage.input_tokens || record.token_usage.input || 0,
          cached_input_tokens: record.token_usage.cached_input_tokens || 0,
          output_tokens: record.token_usage.output_tokens || record.token_usage.output || 0,
        }
      : null,
  };
}

function resolveDisplayName(meta, indexEntry) {
  if (meta && meta.thread_name) return meta.thread_name;
  if (indexEntry && indexEntry.thread_name) return indexEntry.thread_name;
  if (indexEntry && indexEntry.title) return indexEntry.title;
  if (meta && meta.cwd) {
    const b = basename(meta.cwd);
    if (b) return b;
  }
  return 'Codex';
}

function mapCodexRecordToAgentEvent(record, context) {
  const ctx = context || {};
  const sessionIndex = ctx.sessionIndex || new Map();
  const sessionMetaMap = ctx.sessionMetaMap || new Map();

  if (!record || !record.type) return null;

  const sessionId = record.session_id || record.sessionId;
  if (!sessionId) return null;

  // If session_meta, store it
  if (record.type === 'session_meta') {
    const meta = parseSessionMeta(record);
    if (meta) {
      sessionMetaMap.set(sessionId, meta);
    }
    const stored = sessionMetaMap.get(sessionId);
    const indexEntry = sessionIndex.get(sessionId);
    const name = resolveDisplayName(stored, indexEntry);

    return {
      event: 'agent.started',
      agent_id: sessionId,
      source: 'codex',
      name,
      project_path: stored ? stored.cwd || '' : (record.cwd || ''),
      model: stored ? stored.model : null,
      timestamp: Date.now(),
    };
  }

  const event = parseSessionEvent(record);
  if (!event) return null;

  const stored = sessionMetaMap.get(sessionId);
  const indexEntry = sessionIndex.get(sessionId);
  const name = resolveDisplayName(stored, indexEntry);

  let normalizedEvent = null;

  switch (event.type) {
    case 'task_started':
      normalizedEvent = {
        event: 'agent.thinking',
        agent_id: sessionId,
        source: 'codex',
        name,
        project_path: stored ? stored.cwd || '' : '',
        model: stored ? stored.model : null,
        timestamp: Date.now(),
      };
      break;

    case 'tool_running':
      normalizedEvent = {
        event: 'agent.working',
        agent_id: sessionId,
        source: 'codex',
        name,
        project_path: stored ? stored.cwd || '' : '',
        tool: event.tool_name || null,
        timestamp: Date.now(),
      };
      break;

    case 'tool_completed':
      normalizedEvent = {
        event: 'agent.thinking',
        agent_id: sessionId,
        source: 'codex',
        name,
        project_path: stored ? stored.cwd || '' : '',
        tool: event.tool_name || null,
        timestamp: Date.now(),
      };
      break;

    case 'task_complete':
      normalizedEvent = {
        event: 'agent.idle',
        agent_id: sessionId,
        source: 'codex',
        name,
        project_path: stored ? stored.cwd || '' : '',
        metadata: {
          last_assistant_message: record.message || record.summary || null,
        },
        timestamp: Date.now(),
      };
      break;

    case 'token_count':
      if (event.token_usage) {
        // Put raw values in metadata.raw_token_usage (snapshot mode).
        // The agentEventProcessor's Phase 1 snapshot guard handles deltas.
        normalizedEvent = {
          event: 'agent.thinking',
          agent_id: sessionId,
          source: 'codex',
          name,
          project_path: stored ? stored.cwd || '' : '',
          timestamp: Date.now(),
          metadata: {
            raw_token_usage: event.token_usage,
          },
        };
      }
      break;

    case 'error':
      normalizedEvent = {
        event: 'agent.error',
        agent_id: sessionId,
        source: 'codex',
        name,
        project_path: stored ? stored.cwd || '' : '',
        timestamp: Date.now(),
        metadata: {
          error: record.error || record.message || 'codex_error',
        },
      };
      break;
  }

  return normalizedEvent;
}

function parseSessionIndex(content) {
  const map = new Map();
  if (!content) return map;

  const lines = content.split('\n');
  for (const line of lines) {
    const record = safeParse(line);
    if (!record) continue;
    const id = record.session_id || record.id;
    if (id) {
      map.set(id, {
        session_id: id,
        thread_name: record.thread_name || record.title || null,
        title: record.title || record.thread_name || null,
        cwd: record.cwd || record.working_directory || null,
        last_activity: record.last_activity || record.updated_at || null,
      });
    }
  }
  return map;
}

function parseChatProcesses(content) {
  if (!content) return [];

  const parsed = safeParse(typeof content === 'string' ? content : JSON.stringify(content));
  if (!parsed) return [];

  const processes = parsed.processes || parsed.tasks || [];
  return processes.map(function (p) {
    return {
      session_id: p.session_id || p.sessionId || p.conversationId || p.conversation_id || null,
      command: p.command || p.cmd || null,
      pid: p.pid || null,
      state: p.state || p.status || null,
      updatedAtMs: p.updatedAtMs || p.updated_at_ms || p.updatedAt || null,
      startedAtMs: p.startedAtMs || p.started_at_ms || p.startedAt || null,
      processId: p.processId || p.process_id || p.id || null,
      turnId: p.turnId || p.turn_id || null,
      itemId: p.itemId || p.item_id || null,
      chatTitle: p.chatTitle || p.chat_title || p.title || null,
      cwd: p.cwd || p.working_directory || p.workingDirectory || null,
    };
  }).filter(function (p) { return p.session_id; });
}

module.exports = {
  safeParse,
  parseSessionMeta,
  parseSessionEvent,
  mapCodexRecordToAgentEvent,
  parseSessionIndex,
  parseChatProcesses,
  resolveDisplayName,
};
