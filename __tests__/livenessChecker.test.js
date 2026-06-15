/**
 * livenessChecker.js Tests
 * Inactivity timeout-based liveness checker tests
 */

const path = require('path');

// Mock child_process before requiring the module
jest.mock('child_process', () => ({
  execFile: jest.fn(),
}));

// Mock fs
jest.mock('fs', () => ({
  statSync: jest.fn(),
}));

let livenessModule;

function loadFreshModule() {
  const modulePath = require.resolve('../src/main/livenessChecker');
  delete require.cache[modulePath];
  livenessModule = require('../src/main/livenessChecker');
  return livenessModule;
}

describe('livenessChecker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    loadFreshModule();
  });

  describe('detectClaudePidByTranscript', () => {
    test('invokes callback with null immediately', () => {
      const callback = jest.fn();
      livenessModule.detectClaudePidByTranscript('/tmp/session.jsonl', callback);
      expect(callback).toHaveBeenCalledWith(null);
    });
  });

  describe('sessionPids', () => {
    test('is an exported Map', () => {
      expect(livenessModule.sessionPids).toBeInstanceOf(Map);
    });

    test('supports get/set/delete/has operations', () => {
      const { sessionPids } = livenessModule;
      sessionPids.set('test-session', 999);
      expect(sessionPids.get('test-session')).toBe(999);
      expect(sessionPids.has('test-session')).toBe(true);
      sessionPids.delete('test-session');
      expect(sessionPids.has('test-session')).toBe(false);
    });
  });

  describe('startLivenessChecker', () => {
    let mockAgentManager;
    let debugLog;

    beforeEach(() => {
      jest.useFakeTimers();
      mockAgentManager = {
        getAllAgents: jest.fn(() => []),
        getAgent: jest.fn(() => null),
        getAgentCount: jest.fn(() => 0),
        updateAgent: jest.fn(),
        removeAgent: jest.fn(),
      };
      debugLog = jest.fn();
    });

    afterEach(() => {
      jest.useRealTimers();
      jest.restoreAllMocks();
    });

    test('sets up two intervals (2s liveness + 30s zombie sweep)', () => {
      const setIntervalSpy = jest.spyOn(global, 'setInterval');

      livenessModule.startLivenessChecker({ agentManager: mockAgentManager, debugLog });

      expect(setIntervalSpy).toHaveBeenCalledTimes(2);
      expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 30000);
      expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 2000);

      setIntervalSpy.mockRestore();
    });

    test('keeps active agents alive', async () => {
      const now = Date.now();
      mockAgentManager.getAllAgents.mockReturnValue([
        { id: 'active-agent', lastActivity: now },
      ]);

      livenessModule.startLivenessChecker({ agentManager: mockAgentManager, debugLog });

      await jest.advanceTimersByTimeAsync(2000);

      expect(mockAgentManager.removeAgent).not.toHaveBeenCalled();
    });

    test('removes inactive agents after 10 minutes timeout', async () => {
      const startTime = Date.now();
      const dateNowSpy = jest.spyOn(Date, 'now').mockReturnValue(startTime);

      const agent = { id: 'inactive-agent', lastActivity: startTime };
      mockAgentManager.getAllAgents.mockReturnValue([agent]);

      livenessModule.startLivenessChecker({ agentManager: mockAgentManager, debugLog });

      // Advance 5 minutes (300,000 ms), should still be alive
      dateNowSpy.mockReturnValue(startTime + 300_000);
      await jest.advanceTimersByTimeAsync(2000);
      expect(mockAgentManager.removeAgent).not.toHaveBeenCalled();

      // Advance 10 minutes + 1 second (601,000 ms), should be removed
      dateNowSpy.mockReturnValue(startTime + 601_000);
      await jest.advanceTimersByTimeAsync(2000);

      expect(mockAgentManager.removeAgent).toHaveBeenCalledWith('inactive-agent');
      expect(debugLog).toHaveBeenCalledWith(expect.stringContaining('inactive for 601s'));
    });
  });
});
