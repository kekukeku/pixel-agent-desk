/**
 * hookServer.js Tests
 * HTTP hook server, AJV schema validation, request handling
 */

const EventEmitter = require('events');

jest.mock('http', () => {
  const EventEmitter = require('events');
  const mockServer = new EventEmitter();
  mockServer.listen = jest.fn((port, host, cb) => { if (cb) cb(); });
  mockServer.close = jest.fn((cb) => { if (cb) cb(); });
  return {
    createServer: jest.fn(() => mockServer),
    __mockServer: mockServer,
  };
});

const http = require('http');
const { startHookServer } = require('../src/main/hookServer');

// Helper: simulate HTTP request
function simulateRequest(handler, method, url, body = '') {
  const req = new EventEmitter();
  req.method = method;
  req.url = url;

  const res = {
    writeHead: jest.fn(),
    end: jest.fn(),
  };

  handler(req, res);

  // Simulate body streaming
  if (body) {
    req.emit('data', body);
  }
  req.emit('end');

  return { req, res };
}

describe('hookServer', () => {
  let processHookEvent;
  let processAgentEvent;
  let debugLog;
  let errorHandler;
  let handler;

  beforeEach(() => {
    jest.clearAllMocks();
    processHookEvent = jest.fn();
    processAgentEvent = jest.fn();
    debugLog = jest.fn();
    errorHandler = { capture: jest.fn() };

    startHookServer({
      processHookEvent,
      processAgentEvent,
      debugLog,
      HOOK_SERVER_PORT: 47821,
      errorHandler,
    });

    // Capture the request handler
    handler = http.createServer.mock.calls[0][0];
  });

  test('starts server on correct port and host', () => {
    const mockServer = http.__mockServer;
    expect(mockServer.listen).toHaveBeenCalledWith(47821, '127.0.0.1', expect.any(Function));
  });

  test('returns 404 for non-POST requests', () => {
    const { res } = simulateRequest(handler, 'GET', '/hook');
    expect(res.writeHead).toHaveBeenCalledWith(404);
  });

  test('returns 404 for wrong path', () => {
    const { res } = simulateRequest(handler, 'POST', '/other');
    expect(res.writeHead).toHaveBeenCalledWith(404);
  });

  test('processes valid hook event', () => {
    const hookData = {
      hook_event_name: 'SessionStart',
      session_id: 'sess-12345678',
      cwd: '/projects/app',
    };

    const { res } = simulateRequest(handler, 'POST', '/hook', JSON.stringify(hookData));

    expect(res.writeHead).toHaveBeenCalledWith(200, { 'Content-Type': 'application/json' });
    expect(res.end).toHaveBeenCalledWith(JSON.stringify({ ok: true }));
    expect(processHookEvent).toHaveBeenCalledWith(hookData);
  });

  test('validates all supported hook event types', () => {
    const eventTypes = [
      'SessionStart', 'SessionEnd', 'UserPromptSubmit',
      'PreToolUse', 'PostToolUse', 'PostToolUseFailure',
      'Stop', 'TaskCompleted', 'PermissionRequest', 'Notification',
      'SubagentStart', 'SubagentStop', 'TeammateIdle',
      'ConfigChange', 'WorktreeCreate', 'WorktreeRemove', 'PreCompact',
    ];

    for (const eventType of eventTypes) {
      processHookEvent.mockClear();

      simulateRequest(handler, 'POST', '/hook', JSON.stringify({
        hook_event_name: eventType,
        session_id: 'test-session',
      }));

      expect(processHookEvent).toHaveBeenCalled();
    }
  });

  test('rejects hook with invalid event name', () => {
    simulateRequest(handler, 'POST', '/hook', JSON.stringify({
      hook_event_name: 'InvalidEventName',
      session_id: 'test-session',
    }));

    expect(processHookEvent).not.toHaveBeenCalled();
    expect(debugLog).toHaveBeenCalledWith(expect.stringContaining('Validation FAILED'));
  });

  test('rejects hook without hook_event_name', () => {
    simulateRequest(handler, 'POST', '/hook', JSON.stringify({
      session_id: 'test-session',
    }));

    expect(processHookEvent).not.toHaveBeenCalled();
    expect(debugLog).toHaveBeenCalledWith(expect.stringContaining('Validation FAILED'));
  });

  test('handles malformed JSON body', () => {
    simulateRequest(handler, 'POST', '/hook', 'not-json{{{');

    expect(processHookEvent).not.toHaveBeenCalled();
    expect(errorHandler.capture).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ code: 'E010', category: 'PARSE' })
    );
  });

  test('accepts additional properties (future-proof)', () => {
    const hookData = {
      hook_event_name: 'SessionStart',
      session_id: 'test-session',
      unknown_future_field: 'some value',
      another_field: 42,
    };

    simulateRequest(handler, 'POST', '/hook', JSON.stringify(hookData));

    expect(processHookEvent).toHaveBeenCalledWith(hookData);
  });

  test('accepts hook with all known fields', () => {
    const hookData = {
      hook_event_name: 'PostToolUse',
      session_id: 'sess-full',
      transcript_path: '/tmp/session.jsonl',
      cwd: '/projects/app',
      permission_mode: 'default',
      tool_name: 'Bash',
      tool_input: { command: 'ls' },
      tool_response: { token_usage: { input_tokens: 100 } },
      source: 'startup',
      model: 'claude-sonnet-4-6',
      agent_type: 'general-purpose',
      agent_id: 'sub-1',
      notification_type: 'general',
      last_assistant_message: 'Done.',
      reason: 'completed',
      teammate_name: 'worker',
      team_name: 'alpha',
      task_id: 'task-1',
      task_subject: 'Fix bug',
      trigger: 'auto',
      agent_transcript_path: '/tmp/sub.jsonl',
      _pid: 12345,
      _timestamp: Date.now(),
    };

    simulateRequest(handler, 'POST', '/hook', JSON.stringify(hookData));

    expect(processHookEvent).toHaveBeenCalledWith(hookData);
  });

  test('responds 200 before processing (non-blocking)', () => {
    // processHookEvent throws, but response should already be sent
    processHookEvent.mockImplementation(() => { throw new Error('handler crash'); });

    const { res } = simulateRequest(handler, 'POST', '/hook', JSON.stringify({
      hook_event_name: 'SessionStart',
      session_id: 'test',
    }));

    // Response is sent before processHookEvent is called, so it should still be 200
    // But since we're in the same event loop tick, the error propagates to the catch block
    expect(res.writeHead).toHaveBeenCalledWith(200, { 'Content-Type': 'application/json' });
  });

  describe('new generic /events/agent endpoint', () => {
    test('processes valid agent event', () => {
      const eventData = {
        event: 'agent.working',
        agent_id: 'sess-generic-123',
        source: 'my-custom-watcher',
        timestamp: Date.now()
      };

      const { res } = simulateRequest(handler, 'POST', '/events/agent', JSON.stringify(eventData));

      expect(res.writeHead).toHaveBeenCalledWith(200, { 'Content-Type': 'application/json' });
      expect(res.end).toHaveBeenCalledWith(JSON.stringify({ ok: true }));
      expect(processAgentEvent).toHaveBeenCalledWith(eventData);
    });

    test('rejects event with missing required fields', () => {
      simulateRequest(handler, 'POST', '/events/agent', JSON.stringify({
        agent_id: 'sess-invalid',
        // missing event, source, etc.
      }));

      expect(processAgentEvent).not.toHaveBeenCalled();
      expect(debugLog).toHaveBeenCalledWith(expect.stringContaining('Validation FAILED'));
    });
  });

  test('server error handler logs errors', () => {
    const mockServer = http.__mockServer;
    mockServer.emit('error', new Error('EADDRINUSE'));
    expect(debugLog).toHaveBeenCalledWith(expect.stringContaining('EADDRINUSE'));
  });
});
