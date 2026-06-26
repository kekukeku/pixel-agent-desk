/**
 * JSON Schema for Normalized Agent Events
 *
 * Known source values (not enforced, kept as string for extension):
 *   claude-code   Claude Code CLI via legacy /hook
 *   codex         Codex via session JSONL observer
 *   grok-build    Grok Build via command-hook forwarder
 *   antigravity   Antigravity via command-hook forwarder
 *   opencode      OpenWork / OpenCode via plugin
 */

'use strict';

const agentEventSchema = {
  type: 'object',
  required: ['event', 'agent_id', 'source'],
  properties: {
    event: {
      type: 'string',
      enum: [
        'agent.started',
        'agent.thinking',
        'agent.working',
        'agent.idle',
        'agent.done',
        'agent.error',
        'agent.help',
        'agent.removed'
      ]
    },
    agent_id: { type: 'string' },
    session_id: { type: 'string' }, // alias support: payload may use session_id instead of agent_id
    source: { type: 'string' },
    name: { type: 'string' },
    project_path: { type: 'string' },
    model: { type: 'string' },
    tool: { type: 'string' },
    tool_name: { type: 'string' }, // alias support
    parent_id: { type: ['string', 'null'] },
    agent_type: { type: ['string', 'null'] },
    pid: { type: 'number' },
    timestamp: { type: 'number' },
    token_usage: {
      type: 'object',
      properties: {
        input_tokens: { type: 'number' },
        cached_input_tokens: { type: 'number' },
        output_tokens: { type: 'number' }
      },
      additionalProperties: true
    },
    context_usage: {
      type: 'object',
      properties: {
        kind: { type: 'string', enum: ['snapshot'] },
        tokens_used: { type: 'number' },
        window_tokens: { type: 'number' },
        percent: { type: 'number' },
        total_before_compaction: { type: 'number' }
      },
      additionalProperties: false
    },
    activity_text: { type: 'string' },
    public_activity_text: { type: 'string' },
    metadata: { type: 'object' }
  },
  additionalProperties: true
};

module.exports = { agentEventSchema };
