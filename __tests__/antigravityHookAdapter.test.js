/**
 * antigravityHookAdapter.test.js
 * Tests for Antigravity hook → normalized agent event mapping
 */

'use strict';

const { mapAntigravityHookToAgentEvent } = require('../src/main/adapters/antigravityHookAdapter');

describe('mapAntigravityHookToAgentEvent', () => {
  describe('payload field mapping', () => {
    test('conversationId → agent_id', () => {
      const result = mapAntigravityHookToAgentEvent({
        hookEventName: 'PreInvocation',
        conversationId: 'conv-001',
      });
      expect(result.agent_id).toBe('conv-001');
    });

    test('workspacePaths[0] → project_path and name', () => {
      const result = mapAntigravityHookToAgentEvent({
        hookEventName: 'PreInvocation',
        conversationId: 'conv-001',
        workspacePaths: ['/projects/my-app'],
      });
      expect(result.project_path).toBe('/projects/my-app');
      expect(result.name).toBe('my-app');
    });

    test('cwd fallback for project_path', () => {
      const result = mapAntigravityHookToAgentEvent({
        hookEventName: 'PreInvocation',
        conversationId: 'conv-001',
        cwd: '/fallback/path',
      });
      expect(result.project_path).toBe('/fallback/path');
      expect(result.name).toBe('path');
    });

    test('transcriptPath → metadata.transcript_path', () => {
      const result = mapAntigravityHookToAgentEvent({
        hookEventName: 'PreInvocation',
        conversationId: 'conv-001',
        transcriptPath: '/tmp/transcript.jsonl',
      });
      expect(result.metadata.transcript_path).toBe('/tmp/transcript.jsonl');
    });

    test('artifactDirectoryPath → metadata.artifact_directory_path', () => {
      const result = mapAntigravityHookToAgentEvent({
        hookEventName: 'PreInvocation',
        conversationId: 'conv-001',
        artifactDirectoryPath: '/tmp/artifacts',
      });
      expect(result.metadata.artifact_directory_path).toBe('/tmp/artifacts');
    });

    test('name fallback to Antigravity when no workspacePaths', () => {
      const result = mapAntigravityHookToAgentEvent({
        hookEventName: 'PreInvocation',
        conversationId: 'conv-001',
      });
      expect(result.name).toBe('Antigravity');
    });
  });

  describe('event mapping', () => {
    test('PreInvocation → agent.started', () => {
      const result = mapAntigravityHookToAgentEvent({
        hookEventName: 'PreInvocation',
        conversationId: 'conv-001',
        workspacePaths: ['/app'],
      });
      expect(result.event).toBe('agent.started');
      expect(result.source).toBe('antigravity');
    });

    test('PreToolUse → agent.working with tool name', () => {
      const result = mapAntigravityHookToAgentEvent({
        hookEventName: 'PreToolUse',
        conversationId: 'conv-001',
        toolCall: { name: 'Bash' },
      });
      expect(result.event).toBe('agent.working');
      expect(result.tool).toBe('Bash');
    });

    test('PostToolUse → agent.thinking with tool name', () => {
      const result = mapAntigravityHookToAgentEvent({
        hookEventName: 'PostToolUse',
        conversationId: 'conv-001',
        toolCall: { name: 'Read' },
      });
      expect(result.event).toBe('agent.thinking');
      expect(result.tool).toBe('Read');
    });

    test('Stop → agent.idle', () => {
      const result = mapAntigravityHookToAgentEvent({
        hookEventName: 'Stop',
        conversationId: 'conv-001',
      });
      expect(result.event).toBe('agent.idle');
    });

    test('PostInvocation → agent.idle (treated as Stop)', () => {
      const result = mapAntigravityHookToAgentEvent({
        hookEventName: 'PostInvocation',
        conversationId: 'conv-001',
      });
      expect(result.event).toBe('agent.idle');
    });

    test('SessionEnd → agent.removed', () => {
      const result = mapAntigravityHookToAgentEvent({
        hookEventName: 'SessionEnd',
        conversationId: 'conv-001',
      });
      expect(result.event).toBe('agent.removed');
    });

    test('Exit → agent.removed', () => {
      const result = mapAntigravityHookToAgentEvent({
        hookEventName: 'Exit',
        conversationId: 'conv-001',
      });
      expect(result.event).toBe('agent.removed');
    });
  });

  describe('snake_case event names', () => {
    test('pre_invocation → agent.started', () => {
      const result = mapAntigravityHookToAgentEvent({
        hookEventName: 'pre_invocation',
        conversationId: 'conv-001',
      });
      expect(result.event).toBe('agent.started');
    });

    test('pre_tool_use → agent.working', () => {
      const result = mapAntigravityHookToAgentEvent({
        hookEventName: 'pre_tool_use',
        conversationId: 'conv-001',
      });
      expect(result.event).toBe('agent.working');
    });

    test('post_tool_use → agent.thinking', () => {
      const result = mapAntigravityHookToAgentEvent({
        hookEventName: 'post_tool_use',
        conversationId: 'conv-001',
      });
      expect(result.event).toBe('agent.thinking');
    });
  });

  describe('edge cases', () => {
    test('returns null for null payload', () => {
      expect(mapAntigravityHookToAgentEvent(null)).toBeNull();
    });

    test('returns null for payload without event name', () => {
      expect(mapAntigravityHookToAgentEvent({ conversationId: 'c1' })).toBeNull();
    });

    test('returns null for payload without conversationId', () => {
      expect(mapAntigravityHookToAgentEvent({ hookEventName: 'PreInvocation' })).toBeNull();
    });

    test('returns null for unknown event name', () => {
      expect(mapAntigravityHookToAgentEvent({
        hookEventName: 'UnknownEvent',
        conversationId: 'conv-001',
      })).toBeNull();
    });

    test('tool_name fallback when toolCall missing', () => {
      const result = mapAntigravityHookToAgentEvent({
        hookEventName: 'PreToolUse',
        conversationId: 'conv-001',
        tool_name: 'FallbackTool',
      });
      expect(result.tool).toBe('FallbackTool');
    });

    test('toolName used when toolCall missing', () => {
      const result = mapAntigravityHookToAgentEvent({
        hookEventName: 'PreToolUse',
        conversationId: 'conv-001',
        toolName: 'ToolFromName',
      });
      expect(result.tool).toBe('ToolFromName');
    });

    test('toolCall.name preferred over toolName', () => {
      const result = mapAntigravityHookToAgentEvent({
        hookEventName: 'PreToolUse',
        conversationId: 'conv-001',
        toolCall: { name: 'PreferredTool' },
        toolName: 'IgnoredTool',
      });
      expect(result.tool).toBe('PreferredTool');
    });
  });
});
