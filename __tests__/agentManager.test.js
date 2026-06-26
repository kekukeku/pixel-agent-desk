const AgentManager = require('../src/agentManager');
const EventEmitter = require('events');
const os = require('os');
const fs = require('fs');
const path = require('path');

describe('AgentManager', () => {
  let manager;
  const originalHomedir = os.homedir;
  const testHomedir = path.join(__dirname, 'temp_home_global');

  beforeAll(() => {
    os.homedir = () => testHomedir;
    if (fs.existsSync(testHomedir)) {
      fs.rmSync(testHomedir, { recursive: true, force: true });
    }
  });

  afterAll(() => {
    os.homedir = originalHomedir;
    if (fs.existsSync(testHomedir)) {
      fs.rmSync(testHomedir, { recursive: true, force: true });
    }
  });

  beforeEach(() => {
    if (fs.existsSync(testHomedir)) {
      fs.rmSync(testHomedir, { recursive: true, force: true });
    }
    manager = new AgentManager();
    manager.start();
  });

  afterEach(() => {
    manager.stop();
  });

  describe('start and stop', () => {
    test('start runs without error', () => {
      // Agent cleanup is handled exclusively by main.js liveness checker (PID-based)
      expect(() => manager.start()).not.toThrow();
    });

    test('stop clears agents', () => {
      manager.updateAgent({ sessionId: 'test-1', state: 'Working' });
      expect(manager.getAgentCount()).toBe(1);

      manager.stop();
      expect(manager.getAgentCount()).toBe(0);
    });
  });

  describe('updateAgent', () => {
    test('adds new agent', () => {
      const entry = {
        sessionId: 'test-1',
        slug: 'test-agent',
        state: 'Working',
        projectPath: '/path/to/project'
      };

      const result = manager.updateAgent(entry);

      expect(result).not.toBeNull();
      expect(result.id).toBe('test-1');
      expect(result.state).toBe('Working');
      expect(result.displayName).toBe('Spirit');
    });

    test('updates existing agent state', () => {
      jest.useFakeTimers();

      const entry1 = {
        sessionId: 'test-2',
        slug: 'agent-two',
        state: 'Working'
      };

      const entry2 = {
        sessionId: 'test-2',
        state: 'Done'
      };

      manager.updateAgent(entry1);

      jest.advanceTimersByTime(5000);

      manager.updateAgent(entry2);

      const agent = manager.getAgent('test-2');
      expect(agent.state).toBe('Done');
      expect(agent.lastDuration).toBe(5000);

      jest.useRealTimers();
    });

    test('emits agent-added event for new agent', (done) => {
      const mockCallback = (agent) => {
        expect(agent.id).toBe('test-3');
        expect(agent.state).toBe('Thinking');
        done();
      };

      manager.on('agent-added', mockCallback);

      const entry = {
        sessionId: 'test-3',
        slug: 'new-agent',
        state: 'Thinking'
      };

      manager.updateAgent(entry);
    });

    test('emits agent-updated event on state change', (done) => {
      const mockCallback = (agent) => {
        if (agent.state === 'Done') {
          expect(agent.id).toBe('test-4');
          expect(agent.state).toBe('Done');
          done();
        }
      };

      manager.on('agent-updated', mockCallback);

      const entry1 = { sessionId: 'test-4', state: 'Working' };
      const entry2 = { sessionId: 'test-4', state: 'Done' };

      manager.updateAgent(entry1);
      manager.updateAgent(entry2);
    });

    test('does not emit agent-updated when state unchanged', () => {
      const mockCallback = jest.fn();
      manager.on('agent-updated', mockCallback);

      const entry1 = { sessionId: 'test-5', state: 'Working' };
      const entry2 = { sessionId: 'test-5', state: 'Working' };

      manager.updateAgent(entry1);
      manager.updateAgent(entry2);

      expect(mockCallback).not.toHaveBeenCalled();
    });

    test('tracks active duration correctly', () => {
      const entry1 = { sessionId: 'test-6', state: 'Working' };
      const entry2 = { sessionId: 'test-6', state: 'Done' };

      jest.useFakeTimers();
      manager.updateAgent(entry1);

      jest.advanceTimersByTime(5000);

      manager.updateAgent(entry2);

      const agent = manager.getAgent('test-6');
      expect(agent.lastDuration).toBe(5000);

      jest.useRealTimers();
    });

    test('soft limit warns but does not block agents', () => {
      manager.config.softLimitWarning = 2;
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      manager.updateAgent({ sessionId: 'agent-1', state: 'Working' });
      manager.updateAgent({ sessionId: 'agent-2', state: 'Working' });
      const result = manager.updateAgent({ sessionId: 'agent-3', state: 'Working' });

      // Soft limit: does not block registration, only logs a warning
      expect(result).not.toBeNull();
      expect(manager.getAgentCount()).toBe(3);
      expect(warnSpy).toHaveBeenCalled();

      warnSpy.mockRestore();
    });
  });

  describe('stale duplicate cleanup', () => {
    test('removes older Antigravity duplicate with same display name and project', () => {
      const projectPath = '/tmp/pixel-agent-desk';
      manager.updateAgent({
        sessionId: 'bb194259-bac6-475e-a1d8-8530dfc66398',
        source: 'antigravity',
        displayName: 'Antigravity',
        projectPath,
        state: 'Waiting',
      });
      manager.updateAgent({
        sessionId: '95796e04-a1ff-4210-8541-cbb4907da8f7',
        source: 'antigravity',
        displayName: 'Antigravity',
        projectPath,
        state: 'Working',
      });

      expect(manager.getAgentCount()).toBe(1);
      expect(manager.getAgent('95796e04-a1ff-4210-8541-cbb4907da8f7')).not.toBeNull();
      expect(manager.getAgent('bb194259-bac6-475e-a1d8-8530dfc66398')).toBeNull();
    });

    test('removes debug Grok sessions when a real Grok UUID session updates', () => {
      manager.updateAgent({
        sessionId: 'direct-post-test',
        source: 'grok-build',
        displayName: 'Grok Test',
        projectPath: '/tmp',
        state: 'Waiting',
      });
      manager.updateAgent({
        sessionId: 'proper-env-1782165387',
        source: 'grok-build',
        displayName: 'Grok Build',
        projectPath: '/tmp/test',
        state: 'Waiting',
      });
      manager.updateAgent({
        sessionId: '019ee691-23a0-7c12-bdae-19616e1a5fc4',
        source: 'grok-build',
        displayName: 'Grok Build',
        projectPath: '/tmp/pixel-agent-desk',
        state: 'Working',
      });

      expect(manager.getAgentCount()).toBe(1);
      expect(manager.getAgent('019ee691-23a0-7c12-bdae-19616e1a5fc4')).not.toBeNull();
      expect(manager.getAgent('direct-post-test')).toBeNull();
      expect(manager.getAgent('proper-env-1782165387')).toBeNull();
    });

    test('keeps Codex agents on different projects with the same display name', () => {
      manager.updateAgent({
        sessionId: 'codex-a',
        source: 'codex',
        displayName: 'Codex',
        projectPath: '/tmp/project-a',
        state: 'Waiting',
      });
      manager.updateAgent({
        sessionId: 'codex-b',
        source: 'codex',
        displayName: 'Codex',
        projectPath: '/tmp/project-b',
        state: 'Working',
      });

      expect(manager.getAgentCount()).toBe(2);
    });
  });

  describe('removeAgent', () => {
    test('removes existing agent', () => {
      manager.updateAgent({ sessionId: 'remove-1', state: 'Working' });
      expect(manager.getAgentCount()).toBe(1);

      const result = manager.removeAgent('remove-1');
      expect(result).toBe(true);
      expect(manager.getAgentCount()).toBe(0);
    });

    test('returns false for non-existent agent', () => {
      const result = manager.removeAgent('non-existent');
      expect(result).toBe(false);
    });

    test('emits agent-removed event', (done) => {
      manager.updateAgent({ sessionId: 'remove-2', state: 'Working' });

      manager.on('agent-removed', (data) => {
        expect(data.id).toBe('remove-2');
        done();
      });

      manager.removeAgent('remove-2');
    });
  });

  describe('getAgent', () => {
    test('returns agent by ID', () => {
      manager.updateAgent({ sessionId: 'get-1', state: 'Working' });
      const agent = manager.getAgent('get-1');
      expect(agent).toBeDefined();
      expect(agent.id).toBe('get-1');
    });

    test('returns null for non-existent agent', () => {
      const agent = manager.getAgent('non-existent');
      expect(agent).toBeNull();
    });
  });

  describe('getAllAgents', () => {
    test('returns all agents', () => {
      manager.updateAgent({ sessionId: 'all-1', state: 'Working' });
      manager.updateAgent({ sessionId: 'all-2', state: 'Done' });

      const agents = manager.getAllAgents();
      expect(agents).toHaveLength(2);
    });

    test('returns empty array when no agents', () => {
      const agents = manager.getAllAgents();
      expect(agents).toEqual([]);
    });
  });

  describe('getAgentWithEffectiveState', () => {
    test('returns agent with effective state for parent with working children', () => {
      const parentEntry = { sessionId: 'parent-1', state: 'Done' };
      const childEntry = {
        sessionId: 'child-1',
        state: 'Working',
        parentId: 'parent-1'
      };

      manager.updateAgent(parentEntry);
      manager.updateAgent(childEntry);

      const parentWithState = manager.getAgentWithEffectiveState('parent-1');
      expect(parentWithState.state).toBe('Working');
      expect(parentWithState.isAggregated).toBe(true);
    });

    test('returns original state when no working children', () => {
      const entry = { sessionId: 'parent-2', state: 'Done' };
      manager.updateAgent(entry);

      const agent = manager.getAgentWithEffectiveState('parent-2');
      expect(agent.state).toBe('Done');
      expect(agent.isAggregated).toBeUndefined();
    });
  });

  describe('formatDisplayName', () => {
    test('uses slug when available', () => {
      const agent = manager.updateAgent({
        sessionId: 'display-1',
        slug: 'test-agent-name',
        state: 'Working'
      });
      expect(agent.displayName).toBe('Spirit');
    });

    test('uses projectPath basename when no slug', () => {
      const agent = manager.updateAgent({
        sessionId: 'display-2',
        projectPath: '/path/to/my-project',
        state: 'Working'
      });
      expect(agent.displayName).toBe('Spirit');
    });

    test('uses Codex source label instead of projectPath basename', () => {
      const agent = manager.updateAgent({
        sessionId: 'display-codex',
        projectPath: '/path/to/MAW',
        state: 'Working',
        source: 'codex'
      });
      expect(agent.displayName).toBe('Codex');
    });

    test('uses Grok Build source label instead of projectPath basename or slug', () => {
      const agent = manager.updateAgent({
        sessionId: 'display-grok',
        projectPath: '/path/to/MAW',
        slug: 'grok-slug',
        state: 'Working',
        source: 'grok-build'
      });
      expect(agent.displayName).toBe('Grok Build');
    });

    test('returns "Spirit" when no source and no manual name', () => {
      const agent = manager.updateAgent({
        sessionId: 'display-3',
        state: 'Working'
      });
      expect(agent.displayName).toBe('Spirit');
    });
  });

  describe('getAgentsByActivity', () => {
    test('sorts agents by last activity', () => {
      jest.useFakeTimers();

      manager.updateAgent({ sessionId: 'activity-1', state: 'Working' });
      jest.advanceTimersByTime(1000);
      manager.updateAgent({ sessionId: 'activity-2', state: 'Working' });
      jest.advanceTimersByTime(1000);
      manager.updateAgent({ sessionId: 'activity-3', state: 'Working' });

      const sorted = manager.getAgentsByActivity();

      expect(sorted[0].id).toBe('activity-3');
      expect(sorted[1].id).toBe('activity-2');
      expect(sorted[2].id).toBe('activity-1');

      jest.useRealTimers();
    });
  });

  describe('getStats', () => {
    test('returns correct state counts', () => {
      manager.updateAgent({ sessionId: 'stat-1', state: 'Working' });
      manager.updateAgent({ sessionId: 'stat-2', state: 'Working' });
      manager.updateAgent({ sessionId: 'stat-3', state: 'Done' });
      manager.updateAgent({ sessionId: 'stat-4', state: 'Thinking' });

      const stats = manager.getStats();

      expect(stats.total).toBe(4);
      expect(stats.byState.Working).toBe(2);
      expect(stats.byState.Done).toBe(1);
      expect(stats.byState.Thinking).toBe(1);
      expect(stats.byState.Playing).toBe(0);
    });

    test('returns zero counts for empty states', () => {
      const stats = manager.getStats();

      expect(stats.total).toBe(0);
      expect(stats.byState.Working).toBe(0);
      expect(stats.byState.Done).toBe(0);
      expect(stats.byState.Thinking).toBe(0);
      expect(stats.byState.Playing).toBe(0);
    });
  });

  describe('Playing state', () => {
    let playingManager;

    beforeEach(() => {
      jest.useFakeTimers();
      playingManager = new AgentManager();
      playingManager.start();
    });

    afterEach(() => {
      playingManager.stop();
      jest.useRealTimers();
    });

    test('Waiting 60s transitions to Playing and emits agent-updated', () => {
      const mockCallback = jest.fn();
      playingManager.on('agent-updated', mockCallback);

      playingManager.updateAgent({ sessionId: 'play-1', state: 'Waiting' });
      expect(playingManager.getAgent('play-1').state).toBe('Waiting');

      mockCallback.mockClear();

      jest.advanceTimersByTime(61000);

      const agent = playingManager.getAgent('play-1');
      expect(agent.state).toBe('Playing');
      expect(mockCallback).toHaveBeenCalled();
    });

    test('Repeated Waiting updates do not reset restingStartTime', () => {
      playingManager.updateAgent({ sessionId: 'play-2', state: 'Waiting' });

      jest.advanceTimersByTime(30000);
      playingManager.updateAgent({ sessionId: 'play-2', state: 'Waiting' });

      jest.advanceTimersByTime(31000);

      expect(playingManager.getAgent('play-2').state).toBe('Playing');
    });

    test('Waiting 30s then Working clears restingStartTime, no Playing transition', () => {
      playingManager.updateAgent({ sessionId: 'play-3', state: 'Waiting' });

      jest.advanceTimersByTime(30000);
      playingManager.updateAgent({ sessionId: 'play-3', state: 'Working' });

      jest.advanceTimersByTime(40000);

      expect(playingManager.getAgent('play-3').state).toBe('Working');
    });

    test('Help / Error do not transition to Playing', () => {
      playingManager.updateAgent({ sessionId: 'play-4', state: 'Help' });
      playingManager.updateAgent({ sessionId: 'play-5', state: 'Error' });

      jest.advanceTimersByTime(61000);

      expect(playingManager.getAgent('play-4').state).toBe('Help');
      expect(playingManager.getAgent('play-5').state).toBe('Error');
    });

    test('Already Playing agent does not re-emit', () => {
      playingManager.updateAgent({ sessionId: 'play-6', state: 'Waiting' });

      jest.advanceTimersByTime(61000);
      expect(playingManager.getAgent('play-6').state).toBe('Playing');

      const spy = jest.fn();
      playingManager.on('agent-updated', spy);

      jest.advanceTimersByTime(6000);

      expect(spy).not.toHaveBeenCalled();
    });

    test('Done 60s transitions to Playing', () => {
      playingManager.updateAgent({ sessionId: 'play-7', state: 'Done' });

      jest.advanceTimersByTime(61000);

      expect(playingManager.getAgent('play-7').state).toBe('Playing');
    });

    test('stop clears playing interval', () => {
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

      playingManager.stop();

      expect(clearIntervalSpy).toHaveBeenCalled();
      clearIntervalSpy.mockRestore();
    });

    test('Playing agent receives Working event and exits Playing', () => {
      playingManager.updateAgent({ sessionId: 'play-8', state: 'Waiting' });

      jest.advanceTimersByTime(61000);
      expect(playingManager.getAgent('play-8').state).toBe('Playing');

      playingManager.updateAgent({ sessionId: 'play-8', state: 'Working' });
      expect(playingManager.getAgent('play-8').state).toBe('Working');
    });

    test('Playing agent receives Waiting heartbeat and stays Playing', () => {
      playingManager.updateAgent({ sessionId: 'play-9', state: 'Waiting' });

      jest.advanceTimersByTime(61000);
      expect(playingManager.getAgent('play-9').state).toBe('Playing');

      playingManager.updateAgent({ sessionId: 'play-9', state: 'Waiting' });
      expect(playingManager.getAgent('play-9').state).toBe('Playing');
    });
  });

  describe('Name map and agent naming', () => {
    const os = require('os');
    const fs = require('fs');
    const path = require('path');

    const originalHomedir = os.homedir;
    const testHomedir = path.join(__dirname, 'temp_home');

    beforeAll(() => {
      os.homedir = () => testHomedir;
    });

    afterAll(() => {
      os.homedir = originalHomedir;
      if (fs.existsSync(testHomedir)) {
        fs.rmSync(testHomedir, { recursive: true, force: true });
      }
    });

    beforeEach(() => {
      if (fs.existsSync(testHomedir)) {
        fs.rmSync(testHomedir, { recursive: true, force: true });
      }
    });

    test('updateAgentName saves name to name-map.json and updates in-memory agent', () => {
      manager.updateAgent({ sessionId: 'agent-x', slug: 'agent-x-slug', state: 'Working' });
      
      const res = manager.updateAgentName('agent-x', 'Custom Name X');
      expect(res.displayName).toBe('Custom Name X');
      expect(res.activeAgentUpdated).toBe(true);

      const agent = manager.getAgent('agent-x');
      expect(agent.displayName).toBe('Custom Name X');

      const mapPath = path.join(testHomedir, '.pixel-agent-desk', 'name-map.json');
      expect(fs.existsSync(mapPath)).toBe(true);
      const content = JSON.parse(fs.readFileSync(mapPath, 'utf-8'));
      expect(content['agent-x']).toBe('Custom Name X');
    });

    test('updateAgentName deletes key from name-map.json when name is empty', () => {
      manager.updateAgent({ sessionId: 'agent-y', slug: 'agent-y-slug', state: 'Working' });
      
      manager.updateAgentName('agent-y', 'Custom Y');
      
      const res = manager.updateAgentName('agent-y', '');
      expect(res.displayName).toBe('Spirit');

      const agent = manager.getAgent('agent-y');
      expect(agent.displayName).toBe('Spirit');

      const mapPath = path.join(testHomedir, '.pixel-agent-desk', 'name-map.json');
      const content = JSON.parse(fs.readFileSync(mapPath, 'utf-8'));
      expect(content['agent-y']).toBeUndefined();
    });

    test('getNameMap returns name mapping', () => {
      manager.updateAgentName('agent-z', 'Custom Z');
      const map = manager.getNameMap();
      expect(map['agent-z']).toBe('Custom Z');
    });
  });
});
