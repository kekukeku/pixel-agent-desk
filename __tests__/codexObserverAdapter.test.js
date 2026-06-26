/**
 * codexObserverAdapter.test.js
 * Tests for Codex session parsing and event mapping
 */

'use strict';

const {
  safeParse,
  parseSessionMeta,
  parseSessionEvent,
  mapCodexRecordToAgentEvent,
  parseSessionIndex,
  parseChatProcesses,
  resolveDisplayName,
} = require('../src/main/adapters/codexObserverAdapter');

describe('codexObserverAdapter', () => {
  describe('safeParse', () => {
    test('parses valid JSON', () => {
      expect(safeParse('{"type":"session_meta","session_id":"s1"}')).toEqual({
        type: 'session_meta',
        session_id: 's1',
      });
    });

    test('returns null for empty string', () => {
      expect(safeParse('')).toBeNull();
    });

    test('returns null for whitespace-only', () => {
      expect(safeParse('   \n  ')).toBeNull();
    });

    test('returns null for malformed JSON', () => {
      expect(safeParse('{broken')).toBeNull();
    });

    test('returns null for non-string', () => {
      expect(safeParse(null)).toBeNull();
    });
  });

  describe('parseSessionMeta', () => {
    test('extracts session metadata', () => {
      const record = {
        type: 'session_meta',
        session_id: 'sess-abc',
        cwd: '/projects/my-app',
        thread_name: 'My Thread',
        model: 'gpt-4o',
        created_at: '2026-06-21T10:00:00Z',
      };
      const meta = parseSessionMeta(record);
      expect(meta).toEqual({
        session_id: 'sess-abc',
        cwd: '/projects/my-app',
        thread_name: 'My Thread',
        model: 'gpt-4o',
        created_at: '2026-06-21T10:00:00Z',
      });
    });

    test('uses sessionId as fallback', () => {
      const meta = parseSessionMeta({
        type: 'session_meta',
        sessionId: 'alt-id',
      });
      expect(meta.session_id).toBe('alt-id');
    });

    test('extracts Codex Desktop payload metadata', () => {
      const meta = parseSessionMeta({
        timestamp: '2026-06-21T14:00:00Z',
        type: 'session_meta',
        payload: {
          id: 'desktop-s1',
          cwd: '/projects/pixel-agent-desk',
          model: 'gpt-5',
          timestamp: '2026-06-21T13:59:00Z',
        },
      });

      expect(meta).toMatchObject({
        session_id: 'desktop-s1',
        cwd: '/projects/pixel-agent-desk',
        model: 'gpt-5',
        created_at: '2026-06-21T14:00:00Z',
      });
    });

    test('returns null for non-session_meta records', () => {
      expect(parseSessionMeta({ type: 'function_call' })).toBeNull();
      expect(parseSessionMeta(null)).toBeNull();
    });
  });

  describe('parseSessionEvent', () => {
    test('user_turn → task_started', () => {
      const evt = parseSessionEvent({ type: 'user_turn', session_id: 's1' });
      expect(evt.type).toBe('task_started');
    });

    test('function_call → tool_running', () => {
      const evt = parseSessionEvent({
        type: 'function_call',
        session_id: 's1',
        function_name: 'Bash',
      });
      expect(evt.type).toBe('tool_running');
      expect(evt.tool_name).toBe('Bash');
    });

    test('tool_use → tool_running', () => {
      const evt = parseSessionEvent({
        type: 'tool_use',
        session_id: 's1',
        tool_name: 'Read',
      });
      expect(evt.type).toBe('tool_running');
      expect(evt.tool_name).toBe('Read');
    });

    test('function_call_output → tool_completed', () => {
      const evt = parseSessionEvent({
        type: 'function_call_output',
        session_id: 's1',
      });
      expect(evt.type).toBe('tool_completed');
    });

    test('task_complete → task_complete', () => {
      const evt = parseSessionEvent({
        type: 'task_complete',
        session_id: 's1',
        message: 'Done',
      });
      expect(evt.type).toBe('task_complete');
    });

    test('token_count preserves raw token_usage', () => {
      const evt = parseSessionEvent({
        type: 'token_count',
        session_id: 's1',
        token_usage: { input_tokens: 500, output_tokens: 200 },
      });
      expect(evt.type).toBe('token_count');
      expect(evt.token_usage).toEqual({ input_tokens: 500, cached_input_tokens: 0, output_tokens: 200 });
    });

    test('unknown type returns null', () => {
      expect(parseSessionEvent({ type: 'unknown' })).toBeNull();
    });

    test('null record returns null', () => {
      expect(parseSessionEvent(null)).toBeNull();
    });
  });

  describe('mapCodexRecordToAgentEvent', () => {
    test('session_meta emits agent.started', () => {
      const result = mapCodexRecordToAgentEvent({
        type: 'session_meta',
        session_id: 's1',
        cwd: '/projects/app',
        thread_name: 'My Session',
        model: 'gpt-4o-mini',
      });
      expect(result.event).toBe('agent.started');
      expect(result.agent_id).toBe('s1');
      expect(result.source).toBe('codex');
      expect(result.name).toBe('My Session');
      expect(result.project_path).toBe('/projects/app');
      expect(result.model).toBe('gpt-4o-mini');
    });

    test('Codex Desktop session_meta payload emits agent.started', () => {
      const result = mapCodexRecordToAgentEvent({
        type: 'session_meta',
        payload: {
          id: 'desktop-s1',
          cwd: '/projects/desktop-app',
          model: 'gpt-5',
        },
      });

      expect(result.event).toBe('agent.started');
      expect(result.agent_id).toBe('desktop-s1');
      expect(result.name).toBe('Codex');
      expect(result.project_path).toBe('/projects/desktop-app');
    });

    test('Codex Desktop response_item function_call uses fallback session id', () => {
      const result = mapCodexRecordToAgentEvent(
        {
          type: 'response_item',
          payload: {
            type: 'function_call',
            name: 'exec_command',
          },
        },
        {
          fallbackSessionId: 'desktop-s2',
          sessionMetaMap: new Map([['desktop-s2', { cwd: '/app', thread_name: 'Desktop Thread' }]]),
        }
      );

      expect(result.event).toBe('agent.working');
      expect(result.agent_id).toBe('desktop-s2');
      expect(result.tool).toBe('exec_command');
      expect(result.name).toBe('Desktop Thread');
    });

    test('Codex Desktop response_item function_call ignores tool execution id (starts with fc_) and uses fallback session id', () => {
      const result = mapCodexRecordToAgentEvent(
        {
          type: 'response_item',
          payload: {
            type: 'function_call',
            id: 'fc_08b7a89f274c9e37016a369e5a41fc8191b0cb75c5c304129b',
            name: 'exec_command',
          },
        },
        {
          fallbackSessionId: 'desktop-s2',
          sessionMetaMap: new Map([['desktop-s2', { cwd: '/app', thread_name: 'Desktop Thread' }]]),
        }
      );

      expect(result.event).toBe('agent.working');
      expect(result.agent_id).toBe('desktop-s2');
      expect(result.tool).toBe('exec_command');
      expect(result.name).toBe('Desktop Thread');
    });


    test('function_call emits agent.working', () => {
      const result = mapCodexRecordToAgentEvent(
        { type: 'function_call', session_id: 's1', function_name: 'Bash' },
        { sessionMetaMap: new Map([['s1', { cwd: '/app', thread_name: 'Test' }]]) }
      );
      expect(result.event).toBe('agent.working');
      expect(result.tool).toBe('Bash');
    });

    test('function_call_output emits agent.thinking', () => {
      const result = mapCodexRecordToAgentEvent(
        { type: 'function_call_output', session_id: 's1' },
        { sessionMetaMap: new Map([['s1', { cwd: '/app' }]]) }
      );
      expect(result.event).toBe('agent.thinking');
    });

    test('task_complete emits agent.idle', () => {
      const result = mapCodexRecordToAgentEvent(
        { type: 'task_complete', session_id: 's1', message: 'All done' },
        { sessionMetaMap: new Map([['s1', { cwd: '/app' }]]) }
      );
      expect(result.event).toBe('agent.idle');
      expect(result.metadata.last_assistant_message).toBe('All done');
    });

    test('task_started emits agent.thinking', () => {
      const result = mapCodexRecordToAgentEvent(
        { type: 'task_started', session_id: 's1' },
        { sessionMetaMap: new Map([['s1', { cwd: '/app' }]]) }
      );
      expect(result.event).toBe('agent.thinking');
    });

    test('token_count puts raw values in metadata.raw_token_usage (snapshot mode)', () => {
      const result = mapCodexRecordToAgentEvent(
        { type: 'token_count', session_id: 's1', token_usage: { input_tokens: 5000 } },
        { sessionMetaMap: new Map([['s1', { cwd: '/app' }]]) }
      );
      expect(result.event).toBe('agent.thinking');
      expect(result.metadata.raw_token_usage).toEqual({ input_tokens: 5000, cached_input_tokens: 0, output_tokens: 0 });
      expect(result.token_usage).toBeUndefined();
    });

    test('returns null when no session_id', () => {
      const result = mapCodexRecordToAgentEvent({ type: 'function_call' });
      expect(result).toBeNull();
    });
  });

  describe('display name resolution', () => {
    test('prefers thread_name from meta', () => {
      const name = resolveDisplayName(
        { thread_name: 'MetaName', cwd: '/app' },
        { thread_name: 'IndexName' }
      );
      expect(name).toBe('MetaName');
    });

    test('falls back to index thread_name', () => {
      const name = resolveDisplayName(
        { cwd: '/app' },
        { thread_name: 'IndexName' }
      );
      expect(name).toBe('IndexName');
    });

    test('falls back to index title', () => {
      const name = resolveDisplayName(
        { cwd: '/app' },
        { title: 'IndexTitle' }
      );
      expect(name).toBe('IndexTitle');
    });

    test('does not fall back to cwd basename', () => {
      const name = resolveDisplayName(
        { cwd: '/projects/my-app' },
        null
      );
      expect(name).toBe('Codex');
    });

    test('falls back to Codex', () => {
      const name = resolveDisplayName({}, null);
      expect(name).toBe('Codex');
    });
  });

  describe('parseSessionIndex', () => {
    test('parses session_index.jsonl into Map', () => {
      const content = [
        '{"session_id":"s1","thread_name":"Thread A","cwd":"/a"}',
        '{"session_id":"s2","title":"Thread B","cwd":"/b"}',
      ].join('\n');

      const map = parseSessionIndex(content);
      expect(map.size).toBe(2);
      expect(map.get('s1').thread_name).toBe('Thread A');
      expect(map.get('s2').title).toBe('Thread B');
    });

    test('skips malformed lines', () => {
      const content = '{"session_id":"s1"}\n{broken\n{"session_id":"s2"}';
      const map = parseSessionIndex(content);
      expect(map.size).toBe(2);
    });

    test('returns empty Map for empty content', () => {
      expect(parseSessionIndex('').size).toBe(0);
    });
  });

  describe('parseChatProcesses', () => {
    test('parses process array', () => {
      const content = JSON.stringify({
        processes: [
          { session_id: 's1', command: 'python script.py', pid: 12345 },
          { session_id: 's2', command: 'node run.js', pid: 12346 },
        ],
      });
      const result = parseChatProcesses(content);
      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({ session_id: 's1', command: 'python script.py', pid: 12345, state: null });
    });

    test('preserves updatedAtMs, startedAtMs, processId, turnId, itemId', () => {
      const content = JSON.stringify({
        processes: [{
          session_id: 's1',
          command: 'echo hello',
          pid: 99,
          updatedAtMs: 1719000000000,
          startedAtMs: 1718999999000,
          processId: 'proc-abc',
          turnId: 'turn-1',
          itemId: 'item-x',
          state: 'running',
        }],
      });
      const result = parseChatProcesses(content);
      expect(result[0]).toMatchObject({
        session_id: 's1',
        updatedAtMs: 1719000000000,
        startedAtMs: 1718999999000,
        processId: 'proc-abc',
        turnId: 'turn-1',
        itemId: 'item-x',
      });
    });

    test('preserves chatTitle and cwd', () => {
      const content = JSON.stringify({
        processes: [{
          session_id: 's1',
          command: 'ls',
          chatTitle: 'Debug Session',
          cwd: '/projects/my-codex-app',
        }],
      });
      const result = parseChatProcesses(content);
      expect(result[0].chatTitle).toBe('Debug Session');
      expect(result[0].cwd).toBe('/projects/my-codex-app');
    });

    test('conversationId normalizes to session_id', () => {
      const content = JSON.stringify({
        processes: [{
          conversationId: 'conv-001',
          command: 'npm test',
        }],
      });
      const result = parseChatProcesses(content);
      expect(result[0].session_id).toBe('conv-001');
    });

    test('parses Codex Desktop top-level process array', () => {
      const content = JSON.stringify([{
        conversationId: 'desktop-proc',
        command: 'npm test',
        osPid: 1234,
        cwd: '/projects/pad',
      }]);

      const result = parseChatProcesses(content);
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        session_id: 'desktop-proc',
        command: 'npm test',
        pid: 1234,
        cwd: '/projects/pad',
      });
    });

    test('conversation_id normalizes to session_id', () => {
      const content = JSON.stringify({
        processes: [{
          conversation_id: 'conv-002',
          command: 'npm build',
        }],
      });
      const result = parseChatProcesses(content);
      expect(result[0].session_id).toBe('conv-002');
    });

    test('handles tasks field as fallback', () => {
      const content = JSON.stringify({
        tasks: [{ session_id: 's1', command: 'run', pid: 1, status: 'active' }],
      });
      const result = parseChatProcesses(content);
      expect(result[0].state).toBe('active');
    });

    test('filters entries without session_id', () => {
      const content = JSON.stringify({
        processes: [{ command: 'orphan' }],
      });
      expect(parseChatProcesses(content)).toHaveLength(0);
    });

    test('handles invalid JSON', () => {
      expect(parseChatProcesses('{')).toEqual([]);
    });

    test('handles null', () => {
      expect(parseChatProcesses(null)).toEqual([]);
    });
  });
});
