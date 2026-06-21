/**
 * grokHookAdapter.test.js
 * Tests for Grok hook → normalized agent event mapping
 */

'use strict';

const { mapGrokHookToAgentEvent } = require('../src/main/adapters/grokHookAdapter');

function p(overrides) {
  return {
    hookEventName: 'SessionStart',
    sessionId: 'grok-sess-001',
    workspaceRoot: '/projects/grok-app',
    toolName: 'Bash',
    timestamp: '2026-06-21T10:00:00Z',
    ...overrides,
  };
}

describe('mapGrokHookToAgentEvent', () => {
  describe('event name resolution', () => {
    test('uses hookEventName (highest priority)', () => {
      const payload = { hookEventName: 'SessionStart', sessionId: 's1' };
      const result = mapGrokHookToAgentEvent(payload, {}, []);
      expect(result.event).toBe('agent.started');
    });

    test('uses hook_event_name (snake_case)', () => {
      const payload = { hook_event_name: 'session_start', sessionId: 's1' };
      const result = mapGrokHookToAgentEvent(payload, {}, []);
      expect(result.event).toBe('agent.started');
    });

    test('uses hookEvent (third priority)', () => {
      const payload = { hookEvent: 'SessionStart', sessionId: 's1' };
      const result = mapGrokHookToAgentEvent(payload, {}, []);
      expect(result.event).toBe('agent.started');
    });

    test('uses hook_event (fourth priority)', () => {
      const payload = { hook_event: 'session_start', sessionId: 's1' };
      const result = mapGrokHookToAgentEvent(payload, {}, []);
      expect(result.event).toBe('agent.started');
    });

    test('uses env.GROK_HOOK_EVENT (fifth priority)', () => {
      const payload = { sessionId: 's1' };
      const env = { GROK_HOOK_EVENT: 'SessionStart' };
      const result = mapGrokHookToAgentEvent(payload, env, []);
      expect(result.event).toBe('agent.started');
    });

    test('uses argv[2] (sixth priority)', () => {
      const payload = { sessionId: 's1' };
      const result = mapGrokHookToAgentEvent(payload, {}, ['node', 'fwd', 'SessionStart']);
      expect(result.event).toBe('agent.started');
    });

    test('returns null when no event name resolved', () => {
      const payload = { sessionId: 's1' };
      const result = mapGrokHookToAgentEvent(payload, {}, []);
      expect(result).toBeNull();
    });
  });

  describe('session lifecycle events (PascalCase)', () => {
    test('SessionStart → agent.started', () => {
      const result = mapGrokHookToAgentEvent(p({ hookEventName: 'SessionStart' }), {}, []);
      expect(result.event).toBe('agent.started');
      expect(result.agent_id).toBe('grok-sess-001');
      expect(result.source).toBe('grok-build');
    });

    test('UserPromptSubmit → agent.thinking', () => {
      const result = mapGrokHookToAgentEvent(p({ hookEventName: 'UserPromptSubmit' }), {}, []);
      expect(result.event).toBe('agent.thinking');
    });

    test('PreToolUse → agent.working with tool name', () => {
      const result = mapGrokHookToAgentEvent(p({ hookEventName: 'PreToolUse', toolName: 'Read' }), {}, []);
      expect(result.event).toBe('agent.working');
      expect(result.tool).toBe('Read');
    });

    test('PostToolUse → agent.thinking', () => {
      const result = mapGrokHookToAgentEvent(p({ hookEventName: 'PostToolUse' }), {}, []);
      expect(result.event).toBe('agent.thinking');
    });

    test('PostToolUseFailure → agent.error', () => {
      const result = mapGrokHookToAgentEvent(p({ hookEventName: 'PostToolUseFailure', toolName: 'Bash' }), {}, []);
      expect(result.event).toBe('agent.error');
      expect(result.tool).toBe('Bash');
    });

    test('PermissionDenied → agent.help', () => {
      const result = mapGrokHookToAgentEvent(p({ hookEventName: 'PermissionDenied', toolName: 'Bash' }), {}, []);
      expect(result.event).toBe('agent.help');
      expect(result.tool).toBe('Bash');
    });

    test('Stop → agent.done', () => {
      const result = mapGrokHookToAgentEvent(p({ hookEventName: 'Stop' }), {}, []);
      expect(result.event).toBe('agent.done');
    });

    test('SessionEnd → agent.removed', () => {
      const result = mapGrokHookToAgentEvent(p({ hookEventName: 'SessionEnd' }), {}, []);
      expect(result.event).toBe('agent.removed');
    });

    test('SubagentStart → agent.started with parent_id', () => {
      const result = mapGrokHookToAgentEvent(p({
        hookEventName: 'SubagentStart',
        sessionId: 'sub-1',
        parentSessionId: 'grok-sess-001',
      }), {}, []);
      expect(result.event).toBe('agent.started');
      expect(result.agent_id).toBe('sub-1');
      expect(result.parent_id).toBe('grok-sess-001');
    });

    test('SubagentStop → agent.removed', () => {
      const result = mapGrokHookToAgentEvent(p({ hookEventName: 'SubagentStop', sessionId: 'sub-1' }), {}, []);
      expect(result.event).toBe('agent.removed');
    });

    test('SubagentEnd treated as SubagentStop → agent.removed', () => {
      const result = mapGrokHookToAgentEvent(p({ hookEventName: 'SubagentEnd', sessionId: 'sub-1' }), {}, []);
      expect(result.event).toBe('agent.removed');
    });
  });

  describe('session lifecycle events (snake_case)', () => {
    test('session_start → agent.started', () => {
      const result = mapGrokHookToAgentEvent(p({ hookEventName: 'session_start' }), {}, []);
      expect(result.event).toBe('agent.started');
    });

    test('user_prompt_submit → agent.thinking', () => {
      const result = mapGrokHookToAgentEvent(p({ hookEventName: 'user_prompt_submit' }), {}, []);
      expect(result.event).toBe('agent.thinking');
    });

    test('pre_tool_use → agent.working', () => {
      const result = mapGrokHookToAgentEvent(p({ hookEventName: 'pre_tool_use', toolName: 'Read' }), {}, []);
      expect(result.event).toBe('agent.working');
    });

    test('post_tool_use → agent.thinking', () => {
      const result = mapGrokHookToAgentEvent(p({ hookEventName: 'post_tool_use' }), {}, []);
      expect(result.event).toBe('agent.thinking');
    });

    test('post_tool_use_failure → agent.error', () => {
      const result = mapGrokHookToAgentEvent(p({ hookEventName: 'post_tool_use_failure' }), {}, []);
      expect(result.event).toBe('agent.error');
    });

    test('permission_denied → agent.help', () => {
      const result = mapGrokHookToAgentEvent(p({ hookEventName: 'permission_denied' }), {}, []);
      expect(result.event).toBe('agent.help');
    });

    test('stop → agent.done', () => {
      const result = mapGrokHookToAgentEvent(p({ hookEventName: 'stop' }), {}, []);
      expect(result.event).toBe('agent.done');
    });

    test('session_end → agent.removed', () => {
      const result = mapGrokHookToAgentEvent(p({ hookEventName: 'session_end' }), {}, []);
      expect(result.event).toBe('agent.removed');
    });

    test('subagent_start → agent.started', () => {
      const result = mapGrokHookToAgentEvent(p({ hookEventName: 'subagent_start', sessionId: 'sub-1' }), {}, []);
      expect(result.event).toBe('agent.started');
    });

    test('subagent_end → agent.removed', () => {
      const result = mapGrokHookToAgentEvent(p({ hookEventName: 'subagent_end', sessionId: 'sub-1' }), {}, []);
      expect(result.event).toBe('agent.removed');
    });
  });

  describe('agent ID resolution', () => {
    test('uses sessionId over session_id', () => {
      const result = mapGrokHookToAgentEvent(p({ sessionId: 'id-a', session_id: 'id-b' }), {}, []);
      expect(result.agent_id).toBe('id-a');
    });

    test('falls back to session_id', () => {
      const payload = p({ sessionId: undefined, session_id: 'id-b' });
      const result = mapGrokHookToAgentEvent(payload, {}, []);
      expect(result.agent_id).toBe('id-b');
    });

    test('falls back to env.GROK_SESSION_ID', () => {
      const payload = { hookEventName: 'SessionStart' };
      const env = { GROK_SESSION_ID: 'env-id' };
      const result = mapGrokHookToAgentEvent(payload, env, []);
      expect(result.agent_id).toBe('env-id');
    });

    test('returns null when no agent ID found', () => {
      const payload = { hookEventName: 'SessionStart' };
      const result = mapGrokHookToAgentEvent(payload, {}, []);
      expect(result).toBeNull();
    });
  });

  describe('field resolution', () => {
    test('uses workspaceRoot over workspace_root and cwd', () => {
      const result = mapGrokHookToAgentEvent(
        p({ workspaceRoot: '/a', workspace_root: '/b', cwd: '/c' }), {}, []
      );
      expect(result.project_path).toBe('/a');
    });

    test('falls back to workspace_root', () => {
      const payload = p({ workspaceRoot: undefined, workspace_root: '/b', cwd: '/c' });
      const result = mapGrokHookToAgentEvent(payload, {}, []);
      expect(result.project_path).toBe('/b');
    });

    test('falls back to cwd', () => {
      const payload = p({ workspaceRoot: undefined, workspace_root: undefined, cwd: '/c' });
      const result = mapGrokHookToAgentEvent(payload, {}, []);
      expect(result.project_path).toBe('/c');
    });

    test('falls back to env.GROK_WORKSPACE_ROOT', () => {
      const payload = { hookEventName: 'SessionStart', sessionId: 's1' };
      const env = { GROK_WORKSPACE_ROOT: '/env/path' };
      const result = mapGrokHookToAgentEvent(payload, env, []);
      expect(result.project_path).toBe('/env/path');
    });

    test('uses toolName over tool_name', () => {
      const result = mapGrokHookToAgentEvent(
        p({ hookEventName: 'PreToolUse', toolName: 'ToolA', tool_name: 'ToolB' }), {}, []
      );
      expect(result.tool).toBe('ToolA');
    });

    test('uses tool_name when toolName missing', () => {
      const payload = p({ hookEventName: 'PreToolUse', toolName: undefined, tool_name: 'ToolB' });
      const result = mapGrokHookToAgentEvent(payload, {}, []);
      expect(result.tool).toBe('ToolB');
    });
  });

  describe('display name resolution', () => {
    test('uses sessionTitle', () => {
      const result = mapGrokHookToAgentEvent(p({ sessionTitle: 'My Session' }), {}, []);
      expect(result.name).toBe('My Session');
    });

    test('uses title when sessionTitle missing', () => {
      const payload = p({ sessionTitle: undefined, title: 'Alt Title' });
      const result = mapGrokHookToAgentEvent(payload, {}, []);
      expect(result.name).toBe('Alt Title');
    });

    test('falls back to basename of project path', () => {
      const payload = p({ sessionTitle: undefined, title: undefined, workspaceRoot: '/projects/my-app' });
      const result = mapGrokHookToAgentEvent(payload, {}, []);
      expect(result.name).toBe('my-app');
    });

    test('falls back to Grok Build when no name available', () => {
      const payload = {
        hookEventName: 'SessionStart',
        sessionId: 's1',
        workspaceRoot: undefined,
        cwd: undefined,
        sessionTitle: undefined,
        title: undefined,
      };
      const result = mapGrokHookToAgentEvent(payload, {}, []);
      expect(result.name).toBe('Grok Build');
    });
  });

  describe('metadata', () => {
    test('carries toolInput in metadata', () => {
      const result = mapGrokHookToAgentEvent(p({ toolInput: 'echo hello' }), {}, []);
      expect(result.metadata.tool_input).toBe('echo hello');
    });

    test('carries tool_input in metadata', () => {
      const payload = p({ toolInput: undefined, tool_input: 'ls -la' });
      const result = mapGrokHookToAgentEvent(payload, {}, []);
      expect(result.metadata.tool_input).toBe('ls -la');
    });
  });
});
