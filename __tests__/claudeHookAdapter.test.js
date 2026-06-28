/**
 * claudeHookAdapter.test.js
 * Tests for Claude hook → normalized event mapping
 */

'use strict';

const { mapClaudeHookToAgentEvent } = require('../src/main/adapters/claudeHookAdapter');

function withDefaults(overrides) {
  return {
    hook_event_name: 'SessionStart',
    session_id: 'sess-test-001',
    cwd: '/projects/test-app',
    model: 'gpt-4o',
    source: 'startup',
    _pid: 12345,
    _timestamp: 1000000000000,
    ...overrides
  };
}

describe('claudeHookAdapter', () => {
  describe('SessionStart', () => {
    test('maps to agent.started', () => {
      const payload = withDefaults({ hook_event_name: 'SessionStart' });
      const result = mapClaudeHookToAgentEvent(payload);

      expect(result.event).toBe('agent.started');
      expect(result.agent_id).toBe('sess-test-001');
      expect(result.source).toBe('claude-code');
      expect(result.project_path).toBe('/projects/test-app');
      expect(result.model).toBe('gpt-4o');
      expect(result.pid).toBe(12345);
      expect(result.metadata.session_start_source).toBe('startup');
    });
  });

  describe('SessionEnd', () => {
    test('maps to agent.removed', () => {
      const payload = withDefaults({ hook_event_name: 'SessionEnd' });
      const result = mapClaudeHookToAgentEvent(payload);

      expect(result.event).toBe('agent.removed');
    });
  });

  describe('UserPromptSubmit', () => {
    test('maps to agent.thinking', () => {
      const payload = withDefaults({ hook_event_name: 'UserPromptSubmit' });
      const result = mapClaudeHookToAgentEvent(payload);

      expect(result.event).toBe('agent.thinking');
    });
  });

  describe('PreToolUse', () => {
    test('maps to agent.working with tool name', () => {
      const payload = withDefaults({
        hook_event_name: 'PreToolUse',
        tool_name: 'Bash'
      });
      const result = mapClaudeHookToAgentEvent(payload);

      expect(result.event).toBe('agent.working');
      expect(result.tool).toBe('Bash');
    });
  });

  describe('PostToolUse', () => {
    test('maps to agent.thinking with token usage', () => {
      const payload = withDefaults({
        hook_event_name: 'PostToolUse',
        tool_name: 'Bash',
        tool_response: {
          token_usage: {
            input_tokens: 500,
            cache_read_input_tokens: 100,
            cache_creation_input_tokens: 50,
            output_tokens: 200
          }
        }
      });
      const result = mapClaudeHookToAgentEvent(payload);

      expect(result.event).toBe('agent.thinking');
      expect(result.token_usage).toEqual({
        input_tokens: 500,
        cached_input_tokens: 150,
        output_tokens: 200
      });
    });

    test('handles missing token_usage gracefully', () => {
      const payload = withDefaults({
        hook_event_name: 'PostToolUse',
        tool_response: {}
      });
      const result = mapClaudeHookToAgentEvent(payload);

      expect(result.event).toBe('agent.thinking');
      expect(result.token_usage).toBeNull();
    });
  });

  describe('PostToolUseFailure', () => {
    test('maps to agent.error', () => {
      const payload = withDefaults({
        hook_event_name: 'PostToolUseFailure',
        tool_name: 'Read'
      });
      const result = mapClaudeHookToAgentEvent(payload);

      expect(result.event).toBe('agent.error');
      expect(result.tool).toBe('Read');
    });
  });

  describe('PermissionRequest', () => {
    test('maps to agent.help', () => {
      const payload = withDefaults({
        hook_event_name: 'PermissionRequest',
        tool_name: 'Bash'
      });
      const result = mapClaudeHookToAgentEvent(payload);

      expect(result.event).toBe('agent.help');
      expect(result.tool).toBe('Bash');
    });
  });

  describe('Notification', () => {
    test('permission_prompt maps to agent.help', () => {
      const payload = withDefaults({
        hook_event_name: 'Notification',
        notification_type: 'permission_prompt'
      });
      const result = mapClaudeHookToAgentEvent(payload);

      expect(result.event).toBe('agent.help');
    });

    test('elicitation_dialog maps to agent.help', () => {
      const payload = withDefaults({
        hook_event_name: 'Notification',
        notification_type: 'elicitation_dialog'
      });
      const result = mapClaudeHookToAgentEvent(payload);

      expect(result.event).toBe('agent.help');
    });

    test('other notification types map to agent.idle', () => {
      const payload = withDefaults({
        hook_event_name: 'Notification',
        notification_type: 'info'
      });
      const result = mapClaudeHookToAgentEvent(payload);

      expect(result.event).toBe('agent.idle');
    });
  });

  describe('Stop / TaskCompleted', () => {
    test('Stop maps to agent.done', () => {
      const payload = withDefaults({ hook_event_name: 'Stop' });
      const result = mapClaudeHookToAgentEvent(payload);

      expect(result.event).toBe('agent.done');
    });

    test('TaskCompleted maps to agent.done', () => {
      const payload = withDefaults({ hook_event_name: 'TaskCompleted' });
      const result = mapClaudeHookToAgentEvent(payload);

      expect(result.event).toBe('agent.done');
    });
  });

  describe('SubagentStart', () => {
    test('maps to agent.started with parent_id and Working state', () => {
      const payload = withDefaults({
        hook_event_name: 'SubagentStart',
        agent_id: 'sub-001',
        agent_type: 'planner',
        agent_transcript_path: '/tmp/sub.jsonl'
      });
      const result = mapClaudeHookToAgentEvent(payload);

      expect(result.event).toBe('agent.started');
      expect(result.agent_id).toBe('sub-001');
      expect(result.state).toBe('Working');
      expect(result.parent_id).toBe('sess-test-001');
      expect(result.agent_type).toBe('planner');
      expect(result.metadata.transcript_path).toBe('/tmp/sub.jsonl');
    });
  });

  describe('SubagentStop', () => {
    test('maps to agent.removed', () => {
      const payload = withDefaults({
        hook_event_name: 'SubagentStop',
        agent_id: 'sub-001'
      });
      const result = mapClaudeHookToAgentEvent(payload);

      expect(result.event).toBe('agent.removed');
    });
  });

  describe('TeammateIdle', () => {
    test('maps to agent.idle with isTeammate flag', () => {
      const payload = withDefaults({ hook_event_name: 'TeammateIdle' });
      const result = mapClaudeHookToAgentEvent(payload);

      expect(result.event).toBe('agent.idle');
      expect(result.metadata.isTeammate).toBe(true);
    });
  });

  describe('PreCompact', () => {
    test('maps to agent.thinking with reset_first_seen', () => {
      const payload = withDefaults({ hook_event_name: 'PreCompact' });
      const result = mapClaudeHookToAgentEvent(payload);

      expect(result.event).toBe('agent.thinking');
      expect(result.metadata.reset_first_seen).toBe(true);
    });
  });

  describe('InstructionsLoaded', () => {
    test('maps to agent.thinking', () => {
      const payload = withDefaults({ hook_event_name: 'InstructionsLoaded' });
      const result = mapClaudeHookToAgentEvent(payload);

      expect(result.event).toBe('agent.thinking');
    });

    test('preserves base metadata', () => {
      const payload = withDefaults({
        hook_event_name: 'InstructionsLoaded',
        permission_mode: 'auto',
        model: 'claude-3-5-sonnet'
      });
      const result = mapClaudeHookToAgentEvent(payload);

      expect(result.event).toBe('agent.thinking');
      expect(result.metadata.permission_mode).toBe('auto');
      expect(result.model).toBe('claude-3-5-sonnet');
    });
  });

  describe('unknown event', () => {
    test('returns null for unmapped events', () => {
      const payload = withDefaults({ hook_event_name: 'UnknownEvent' });
      const result = mapClaudeHookToAgentEvent(payload);

      expect(result).toBeNull();
    });
  });

  describe('source resolution', () => {
    test('startup/resume/compact sources normalize to claude-code', () => {
      for (const source of ['startup', 'resume', 'compact']) {
        const payload = withDefaults({ source });
        const result = mapClaudeHookToAgentEvent(payload);
        expect(result.source).toBe('claude-code');
      }
    });

    test('custom watcher source is preserved', () => {
      const payload = withDefaults({
        source: 'pixel-agent-desk-watcher'
      });
      const result = mapClaudeHookToAgentEvent(payload);

      expect(result.source).toBe('pixel-agent-desk-watcher');
      expect(result.metadata.claude_source).toBe('pixel-agent-desk-watcher');
    });
  });

  describe('codex transcript guard', () => {
    test('rejects Claude hook payloads pointing at Codex session JSONL', () => {
      const payload = withDefaults({
        transcript_path: '/Users/me/.codex/sessions/2026/06/28/rollout-session.jsonl'
      });

      expect(mapClaudeHookToAgentEvent(payload)).toBeNull();
    });
  });

  describe('session_id fallback', () => {
    test('uses sessionId when session_id is missing', () => {
      const payload = withDefaults({
        session_id: undefined,
        sessionId: 'sess-fallback'
      });
      const result = mapClaudeHookToAgentEvent(payload);

      expect(result.agent_id).toBe('sess-fallback');
    });
  });
});
