/**
 * JSON Schema for Normalized Agent Events
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
    session_id: { type: 'string' }, // alias support
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
    metadata: { type: 'object' }
  },
  additionalProperties: true
};

module.exports = { agentEventSchema };
