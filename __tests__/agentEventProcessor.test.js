/**
 * agentEventProcessor.test.js
 * Verification of generic agent event processor state transitions and token accumulation
 */

'use strict';

const path = require('path');
const processor = require('../src/main/agentEventProcessor');

// Mock agentManager factory
function createMockAgentManager() {
  const agents = new Map();
  return {
    getAgent: jest.fn((id) => agents.get(id) || null),
    updateAgent: jest.fn((data, source) => {
      const id = data.sessionId || data.id;
      agents.set(id, { ...data, id, firstSeen: data.firstSeen || Date.now() });
      return agents.get(id);
    }),
    removeAgent: jest.fn((id) => { agents.delete(id); }),
    getAllAgents: jest.fn(() => Array.from(agents.values())),
    getAgentCount: jest.fn(() => agents.size),
    _agents: agents,
  };
}

describe('agentEventProcessor', () => {
  let agentManager;
  let sessionPids;
  let debugLog;
  let detectClaudePidByTranscript;

  beforeEach(() => {
    agentManager = createMockAgentManager();
    sessionPids = new Map();
    debugLog = jest.fn();
    detectClaudePidByTranscript = jest.fn((_path, cb) => cb(null));

    processor.init({
      agentManager,
      sessionPids,
      debugLog,
      detectClaudePidByTranscript,
    });
  });

  afterEach(() => {
    processor.cleanup();
  });

  describe('agent.started', () => {
    test('creates new agent with correct attributes', () => {
      processor.processAgentEvent({
        event: 'agent.started',
        agent_id: 'agent-new',
        source: 'watcher',
        name: 'A沐瑤',
        project_path: '/projects/my-app',
        model: 'gpt-4o',
        timestamp: 1000000000000,
        metadata: {
          transcript_path: '/tmp/test.jsonl'
        }
      });

      expect(agentManager.updateAgent).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: 'agent-new',
          projectPath: '/projects/my-app',
          displayName: 'A沐瑤',
          state: 'Waiting',
          model: 'gpt-4o',
          source: 'watcher',
          jsonlPath: '/tmp/test.jsonl'
        }),
        'processor'
      );
      expect(agentManager.getAgent('agent-new')).toBeTruthy();
    });

    test('supports parent_id and teammate/subagent flags', () => {
      processor.processAgentEvent({
        event: 'agent.started',
        agent_id: 'agent-sub',
        parent_id: 'parent-123',
        agent_type: 'planner',
        source: 'claude-code',
        metadata: {
          isTeammate: true,
          teammate_name: 'helper',
          team_name: 'alpha'
        }
      });

      expect(agentManager.updateAgent).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: 'agent-sub',
          parentId: 'parent-123',
          agentType: 'planner',
          isSubagent: true,
          isTeammate: true,
          teammateName: 'helper',
          teamName: 'alpha'
        }),
        'processor'
      );
    });

    test('registers PID directly when provided', () => {
      processor.processAgentEvent({
        event: 'agent.started',
        agent_id: 'agent-pid',
        source: 'generic',
        pid: 12345
      });

      expect(sessionPids.get('agent-pid')).toBe(12345);
    });
  });

  describe('state transitions', () => {
    beforeEach(() => {
      // Pre-populate an agent
      agentManager.updateAgent({
        sessionId: 'agent-active',
        projectPath: '/path',
        displayName: 'ActiveAgent',
        state: 'Waiting',
        model: 'gpt-4o'
      }, 'test');
    });

    test('agent.working sets Working state and current tool', () => {
      processor.processAgentEvent({
        event: 'agent.working',
        agent_id: 'agent-active',
        tool: 'Bash',
        timestamp: 1000000002000
      });

      expect(agentManager.updateAgent).toHaveBeenCalledWith(
        expect.objectContaining({
          state: 'Working',
          currentTool: 'Bash'
        }),
        'processor'
      );
    });

    test('agent.thinking sets Thinking state and resets tool', () => {
      processor.processAgentEvent({
        event: 'agent.thinking',
        agent_id: 'agent-active',
        timestamp: 1000000003000
      });

      expect(agentManager.updateAgent).toHaveBeenCalledWith(
        expect.objectContaining({
          state: 'Thinking',
          currentTool: null
        }),
        'processor'
      );
    });

    test('agent.thinking accumulates tokens and estimated cost', () => {
      processor.processAgentEvent({
        event: 'agent.thinking',
        agent_id: 'agent-active',
        token_usage: {
          input_tokens: 1000,
          output_tokens: 200
        }
      });

      const updated = agentManager.getAgent('agent-active');
      expect(updated.tokenUsage).toEqual(
        expect.objectContaining({
          inputTokens: 1000,
          outputTokens: 200,
          estimatedCost: 0.0045 // 1000 * 2.5/M + 200 * 10/M = 0.0025 + 0.002 = 0.0045
        })
      );
    });

    test('agent.done sets Done state', () => {
      processor.processAgentEvent({
        event: 'agent.done',
        agent_id: 'agent-active',
        metadata: {
          last_assistant_message: 'Task completed successfully'
        }
      });

      expect(agentManager.updateAgent).toHaveBeenCalledWith(
        expect.objectContaining({
          state: 'Done',
          lastMessage: 'Task completed successfully'
        }),
        'processor'
      );
    });

    test('agent.removed removes the agent', () => {
      sessionPids.set('agent-active', 9999);
      processor.processAgentEvent({
        event: 'agent.removed',
        agent_id: 'agent-active'
      });

      expect(agentManager.removeAgent).toHaveBeenCalledWith('agent-active');
      expect(sessionPids.has('agent-active')).toBe(false);
    });

    test('agent.error sets Error state', () => {
      processor.processAgentEvent({
        event: 'agent.error',
        agent_id: 'agent-active',
        tool: 'Bash'
      });

      expect(agentManager.updateAgent).toHaveBeenCalledWith(
        expect.objectContaining({
          state: 'Error',
          currentTool: 'Bash'
        }),
        'processor'
      );
    });

    test('agent.help sets Help state', () => {
      processor.processAgentEvent({
        event: 'agent.help',
        agent_id: 'agent-active',
        tool: 'Confirm'
      });

      expect(agentManager.updateAgent).toHaveBeenCalledWith(
        expect.objectContaining({
          state: 'Help',
          currentTool: 'Confirm'
        }),
        'processor'
      );
    });
  });

  describe('aliases & compatibility', () => {
    test('normalizes session_id and tool_name aliases', () => {
      processor.processAgentEvent({
        event: 'agent.working',
        session_id: 'agent-alias',
        tool_name: 'Python',
        source: 'generic'
      });

      // Should auto-create agent-alias and transition it to working
      const agent = agentManager.getAgent('agent-alias');
      expect(agent).toBeTruthy();
      expect(agent.state).toBe('Working');
      expect(agent.currentTool).toBe('Python');
    });
  });

  describe('auto-create fallback', () => {
    test('non-started event on unknown agent auto-creates before processing', () => {
      processor.processAgentEvent({
        event: 'agent.working',
        agent_id: 'agent-unknown',
        source: 'my-watcher',
        tool: 'FetchUrl',
        project_path: '/projects/watcher-app'
      });

      expect(agentManager.updateAgent).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: 'agent-unknown',
          displayName: 'watcher-app',
          source: 'my-watcher',
          state: 'Waiting'
        }),
        'http'
      );

      const agent = agentManager.getAgent('agent-unknown');
      expect(agent.state).toBe('Working');
      expect(agent.currentTool).toBe('FetchUrl');
    });
  });
});
