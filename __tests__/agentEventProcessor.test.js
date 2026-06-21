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
      const existing = agents.get(id);
      const merged = { ...data, id, firstSeen: data.firstSeen || Date.now() };
      if (existing && !('tokenUsage' in data)) {
        merged.tokenUsage = existing.tokenUsage;
      }
      agents.set(id, merged);
      return merged;
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

    test('auto-creates from agent.thinking with source-specific fields', () => {
      processor.processAgentEvent({
        event: 'agent.thinking',
        agent_id: 'agent-codex-1',
        source: 'codex',
        model: 'gpt-4o-mini',
        project_path: '/projects/codex-app'
      });

      const agent = agentManager.getAgent('agent-codex-1');
      expect(agent).toBeTruthy();
      expect(agent.source).toBe('codex');
      expect(agent.model).toBe('gpt-4o-mini');
      expect(agent.displayName).toBe('codex-app');
      expect(agent.state).toBe('Thinking');
    });

    test('auto-creates from agent.idle', () => {
      processor.processAgentEvent({
        event: 'agent.idle',
        agent_id: 'agent-grok-1',
        source: 'grok-build',
        name: 'Grok Session'
      });

      const agent = agentManager.getAgent('agent-grok-1');
      expect(agent).toBeTruthy();
      expect(agent.source).toBe('grok-build');
      expect(agent.state).toBe('Waiting');
    });

    test('auto-creates from agent.error', () => {
      processor.processAgentEvent({
        event: 'agent.error',
        agent_id: 'agent-error-new',
        source: 'antigravity',
        tool: 'Bash'
      });

      const agent = agentManager.getAgent('agent-error-new');
      expect(agent).toBeTruthy();
      expect(agent.state).toBe('Error');
      expect(agent.source).toBe('antigravity');
    });

    test('auto-creates from agent.help', () => {
      processor.processAgentEvent({
        event: 'agent.help',
        agent_id: 'agent-help-new',
        source: 'opencode',
        tool: 'Confirm'
      });

      const agent = agentManager.getAgent('agent-help-new');
      expect(agent).toBeTruthy();
      expect(agent.state).toBe('Help');
      expect(agent.source).toBe('opencode');
    });

    test('does not auto-create on agent.removed for unknown agent', () => {
      processor.processAgentEvent({
        event: 'agent.removed',
        agent_id: 'agent-ghost',
        source: 'claude-code'
      });

      const agent = agentManager.getAgent('agent-ghost');
      expect(agent).toBeNull();
      expect(agentManager.updateAgent).not.toHaveBeenCalledWith(
        expect.objectContaining({ sessionId: 'agent-ghost' }),
        expect.any(String)
      );
    });
  });

  describe('token accumulation', () => {
    beforeEach(() => {
      agentManager.updateAgent({
        sessionId: 'agent-token',
        projectPath: '/path',
        displayName: 'TokenAgent',
        state: 'Waiting',
        model: 'gpt-4o'
      }, 'test');
    });

    test('accumulates tokens across multiple thinking events', () => {
      processor.processAgentEvent({
        event: 'agent.thinking',
        agent_id: 'agent-token',
        token_usage: { input_tokens: 500, output_tokens: 100 }
      });

      let agent = agentManager.getAgent('agent-token');
      expect(agent.tokenUsage.inputTokens).toBe(500);
      expect(agent.tokenUsage.outputTokens).toBe(100);

      processor.processAgentEvent({
        event: 'agent.thinking',
        agent_id: 'agent-token',
        token_usage: { input_tokens: 300, output_tokens: 50 }
      });

      agent = agentManager.getAgent('agent-token');
      expect(agent.tokenUsage.inputTokens).toBe(800);
      expect(agent.tokenUsage.outputTokens).toBe(150);
    });

    test('handles cached_input_tokens across events', () => {
      processor.processAgentEvent({
        event: 'agent.thinking',
        agent_id: 'agent-token',
        token_usage: { input_tokens: 400, cached_input_tokens: 100, output_tokens: 80 }
      });

      let agent = agentManager.getAgent('agent-token');
      expect(agent.tokenUsage.inputTokens).toBe(500);
      expect(agent.tokenUsage.outputTokens).toBe(80);

      processor.processAgentEvent({
        event: 'agent.thinking',
        agent_id: 'agent-token',
        token_usage: { input_tokens: 200, cached_input_tokens: 50, output_tokens: 40 }
      });

      agent = agentManager.getAgent('agent-token');
      expect(agent.tokenUsage.inputTokens).toBe(750);
      expect(agent.tokenUsage.outputTokens).toBe(120);
    });

    test('estimatedCost accumulates correctly across events', () => {
      processor.processAgentEvent({
        event: 'agent.thinking',
        agent_id: 'agent-token',
        token_usage: { input_tokens: 1000, output_tokens: 0 }
      });

      let agent = agentManager.getAgent('agent-token');
      const firstCost = agent.tokenUsage.estimatedCost;

      processor.processAgentEvent({
        event: 'agent.thinking',
        agent_id: 'agent-token',
        token_usage: { input_tokens: 0, output_tokens: 200 }
      });

      agent = agentManager.getAgent('agent-token');
      // 1000 input @ 2.5/M + 200 output @ 10/M = 0.0025 + 0.002 = 0.0045
      expect(agent.tokenUsage.estimatedCost).toBeCloseTo(0.0045, 5);
    });
  });

  describe('token snapshot guard', () => {
    beforeEach(() => {
      agentManager.updateAgent({
        sessionId: 'agent-snap',
        projectPath: '/path',
        displayName: 'SnapshotAgent',
        state: 'Waiting',
        model: 'gpt-4o',
        tokenUsage: { inputTokens: 0, outputTokens: 0, estimatedCost: 0 }
      }, 'test');
    });

    test('first snapshot does not accumulate (no previous baseline)', () => {
      processor.processAgentEvent({
        event: 'agent.thinking',
        agent_id: 'agent-snap',
        source: 'codex',
        metadata: {
          raw_token_usage: { input_tokens: 5000, output_tokens: 2000 }
        }
      });

      const agent = agentManager.getAgent('agent-snap');
      expect(agent.tokenUsage.inputTokens).toBe(0);
      expect(agent.tokenUsage.outputTokens).toBe(0);
      expect(agent.tokenUsage.estimatedCost).toBe(0);
    });

    test('second snapshot computes delta and accumulates', () => {
      processor.processAgentEvent({
        event: 'agent.thinking',
        agent_id: 'agent-snap',
        source: 'codex',
        metadata: {
          raw_token_usage: { input_tokens: 5000, output_tokens: 2000 }
        }
      });

      processor.processAgentEvent({
        event: 'agent.thinking',
        agent_id: 'agent-snap',
        source: 'codex',
        metadata: {
          raw_token_usage: { input_tokens: 5500, output_tokens: 2200 }
        }
      });

      const agent = agentManager.getAgent('agent-snap');
      // Delta: 500 input, 200 output
      expect(agent.tokenUsage.inputTokens).toBe(500);
      expect(agent.tokenUsage.outputTokens).toBe(200);
    });

    test('raw_token_usage takes priority over token_usage (double-count guard)', () => {
      processor.processAgentEvent({
        event: 'agent.thinking',
        agent_id: 'agent-snap',
        source: 'codex',
        metadata: {
          raw_token_usage: { input_tokens: 5000, output_tokens: 2000 }
        }
      });

      // Second event: snapshot delta should be used, NOT the token_usage field directly
      processor.processAgentEvent({
        event: 'agent.thinking',
        agent_id: 'agent-snap',
        source: 'codex',
        token_usage: { input_tokens: 999, output_tokens: 999 },
        metadata: {
          raw_token_usage: { input_tokens: 5500, output_tokens: 2200 }
        }
      });

      const agent = agentManager.getAgent('agent-snap');
      // Delta from snapshot: 500 input, 200 output — NOT 999/999
      expect(agent.tokenUsage.inputTokens).toBe(500);
      expect(agent.tokenUsage.outputTokens).toBe(200);
    });

    test('snapshot delta does not go negative (row reset guard)', () => {
      processor.processAgentEvent({
        event: 'agent.thinking',
        agent_id: 'agent-snap',
        source: 'codex',
        metadata: {
          raw_token_usage: { input_tokens: 5000, output_tokens: 2000 }
        }
      });

      // Simulate a counter reset: raw values go down
      processor.processAgentEvent({
        event: 'agent.thinking',
        agent_id: 'agent-snap',
        source: 'codex',
        metadata: {
          raw_token_usage: { input_tokens: 100, output_tokens: 50 }
        }
      });

      const agent = agentManager.getAgent('agent-snap');
      // Delta = max(0, 100-5000) = 0, so no accumulation
      expect(agent.tokenUsage.inputTokens).toBe(0);
      expect(agent.tokenUsage.outputTokens).toBe(0);
    });

    test('snapshot keys are scoped by source+agent_id', () => {
      agentManager.updateAgent({
        sessionId: 'agent-snap-2',
        projectPath: '/path2',
        displayName: 'SnapshotAgent2',
        state: 'Waiting',
        model: 'gpt-4o',
        tokenUsage: { inputTokens: 0, outputTokens: 0, estimatedCost: 0 }
      }, 'test');

      // Agent 1 first snapshot
      processor.processAgentEvent({
        event: 'agent.thinking',
        agent_id: 'agent-snap',
        source: 'codex',
        metadata: {
          raw_token_usage: { input_tokens: 5000, output_tokens: 2000 }
        }
      });

      // Agent 2 first snapshot (different agent, should NOT compute delta from agent 1)
      processor.processAgentEvent({
        event: 'agent.thinking',
        agent_id: 'agent-snap-2',
        source: 'codex',
        metadata: {
          raw_token_usage: { input_tokens: 3000, output_tokens: 1000 }
        }
      });

      const agent1 = agentManager.getAgent('agent-snap');
      const agent2 = agentManager.getAgent('agent-snap-2');
      expect(agent1.tokenUsage.inputTokens).toBe(0);
      expect(agent2.tokenUsage.inputTokens).toBe(0);
    });

    test('agent.removed clears snapshot baseline, recreated agent starts fresh', () => {
      // Build a snapshot baseline for agent-snap
      processor.processAgentEvent({
        event: 'agent.thinking',
        agent_id: 'agent-snap',
        source: 'codex',
        metadata: {
          raw_token_usage: { input_tokens: 5000, output_tokens: 2000 }
        }
      });

      // Verify baseline was stored
      expect(processor.lastRawTokenUsage.get('codex::agent-snap')).toEqual({
        input_tokens: 5000,
        cached_input_tokens: 0,
        output_tokens: 2000
      });

      // Remove the agent — should clear snapshot baseline
      processor.processAgentEvent({
        event: 'agent.removed',
        agent_id: 'agent-snap',
        source: 'codex'
      });

      expect(processor.lastRawTokenUsage.has('codex::agent-snap')).toBe(false);

      // Recreate the same agent (same source + agent_id)
      agentManager.updateAgent({
        sessionId: 'agent-snap',
        projectPath: '/path',
        displayName: 'SnapshotAgent',
        state: 'Waiting',
        model: 'gpt-4o',
        tokenUsage: { inputTokens: 0, outputTokens: 0, estimatedCost: 0 }
      }, 'test');

      // Send a new first snapshot — should NOT compute delta from the old baseline
      processor.processAgentEvent({
        event: 'agent.thinking',
        agent_id: 'agent-snap',
        source: 'codex',
        metadata: {
          raw_token_usage: { input_tokens: 7000, output_tokens: 3000 }
        }
      });

      const agent = agentManager.getAgent('agent-snap');
      // No accumulation because this is a fresh baseline (old was cleared by removed)
      expect(agent.tokenUsage.inputTokens).toBe(0);
      expect(agent.tokenUsage.outputTokens).toBe(0);

      // New baseline should be stored
      expect(processor.lastRawTokenUsage.get('codex::agent-snap')).toEqual({
        input_tokens: 7000,
        cached_input_tokens: 0,
        output_tokens: 3000
      });
    });
  });

  describe('non-Claude source behavior', () => {
    test('codex source agent is created and transitions correctly', () => {
      processor.processAgentEvent({
        event: 'agent.started',
        agent_id: 'codex-sess-1',
        source: 'codex',
        name: 'Codex Chat',
        project_path: '/projects/codex-work'
      });

      processor.processAgentEvent({
        event: 'agent.working',
        agent_id: 'codex-sess-1',
        source: 'codex',
        tool: 'ExecuteCommand'
      });

      const agent = agentManager.getAgent('codex-sess-1');
      expect(agent.state).toBe('Working');
      expect(agent.currentTool).toBe('ExecuteCommand');
      expect(agent.source).toBe('codex');
    });

    test('grok-build source transitions through working→thinking→done', () => {
      agentManager.updateAgent({
        sessionId: 'grok-sess-1',
        projectPath: '/grok',
        displayName: 'Grok',
        state: 'Waiting',
        source: 'grok-build'
      }, 'test');

      processor.processAgentEvent({
        event: 'agent.working',
        agent_id: 'grok-sess-1',
        source: 'grok-build',
        tool: 'Read'
      });
      let agent = agentManager.getAgent('grok-sess-1');
      expect(agent.state).toBe('Working');

      processor.processAgentEvent({
        event: 'agent.thinking',
        agent_id: 'grok-sess-1',
        source: 'grok-build'
      });
      agent = agentManager.getAgent('grok-sess-1');
      expect(agent.state).toBe('Thinking');

      processor.processAgentEvent({
        event: 'agent.done',
        agent_id: 'grok-sess-1',
        source: 'grok-build',
        metadata: { last_assistant_message: 'Done' }
      });
      agent = agentManager.getAgent('grok-sess-1');
      expect(agent.state).toBe('Done');
    });

    test('antigravity source handles thinking→error transitions', () => {
      agentManager.updateAgent({
        sessionId: 'anti-sess-1',
        projectPath: '/anti',
        displayName: 'Antigravity',
        state: 'Waiting',
        source: 'antigravity'
      }, 'test');

      processor.processAgentEvent({
        event: 'agent.thinking',
        agent_id: 'anti-sess-1',
        source: 'antigravity'
      });
      expect(agentManager.getAgent('anti-sess-1').state).toBe('Thinking');

      processor.processAgentEvent({
        event: 'agent.error',
        agent_id: 'anti-sess-1',
        source: 'antigravity',
        tool: 'RunScript'
      });
      const agent = agentManager.getAgent('anti-sess-1');
      expect(agent.state).toBe('Error');
      expect(agent.currentTool).toBe('RunScript');
    });

    test('opencode source idle event sets Waiting state', () => {
      agentManager.updateAgent({
        sessionId: 'oc-sess-1',
        projectPath: '/oc',
        displayName: 'OpenCode',
        state: 'Thinking',
        source: 'opencode'
      }, 'test');

      processor.processAgentEvent({
        event: 'agent.idle',
        agent_id: 'oc-sess-1',
        source: 'opencode'
      });
      expect(agentManager.getAgent('oc-sess-1').state).toBe('Waiting');
    });
  });

  describe('additional state transitions', () => {
    beforeEach(() => {
      agentManager.updateAgent({
        sessionId: 'agent-extra',
        projectPath: '/path',
        displayName: 'ExtraAgent',
        state: 'Waiting',
        model: 'gpt-4o'
      }, 'test');
    });

    test('agent.idle with teammate metadata', () => {
      processor.processAgentEvent({
        event: 'agent.idle',
        agent_id: 'agent-extra',
        metadata: {
          isTeammate: true,
          teammate_name: 'HelperBot',
          team_name: 'Alpha'
        }
      });

      expect(agentManager.updateAgent).toHaveBeenCalledWith(
        expect.objectContaining({
          state: 'Waiting',
          currentTool: null,
          isTeammate: true,
          teammateName: 'HelperBot',
          teamName: 'Alpha'
        }),
        'processor'
      );
    });

    test('agent.thinking with reset_first_seen', () => {
      processor.processAgentEvent({
        event: 'agent.thinking',
        agent_id: 'agent-extra',
        timestamp: 2000000000000,
        metadata: { reset_first_seen: true }
      });

      const agent = agentManager.getAgent('agent-extra');
      expect(agent.state).toBe('Thinking');
      expect(agent.firstSeen).toBe(2000000000000);
    });

    test('agent.done without last_assistant_message sets null', () => {
      agentManager.updateAgent({
        sessionId: 'agent-extra',
        lastMessage: 'previous',
        state: 'Thinking'
      }, 'test');

      processor.processAgentEvent({
        event: 'agent.done',
        agent_id: 'agent-extra'
      });

      expect(agentManager.updateAgent).toHaveBeenCalledWith(
        expect.objectContaining({
          state: 'Done',
          lastMessage: null
        }),
        'processor'
      );
    });
  });
});
