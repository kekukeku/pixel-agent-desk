/**
 * hookRegistration.js Tests
 * HOOK_EVENTS list, isHookRegistered (all-or-nothing), registerClaudeHooks (idempotent)
 */

jest.mock('fs', () => ({
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  readFileSync: jest.fn(),
  writeFileSync: jest.fn(),
}));

const fs = require('fs');
const path = require('path');
const os = require('os');

function loadModule() {
  const modulePath = require.resolve('../src/main/hookRegistration');
  delete require.cache[modulePath];
  return require('../src/main/hookRegistration');
}

const EXPECTED_EVENTS = [
  'SessionStart', 'SessionEnd', 'UserPromptSubmit',
  'PreToolUse', 'PostToolUse', 'PostToolUseFailure',
  'Stop', 'TaskCompleted', 'PermissionRequest', 'Notification',
  'SubagentStart', 'SubagentStop', 'TeammateIdle',
  'ConfigChange', 'WorktreeCreate', 'WorktreeRemove',
  'PreCompact',
];
const HOOK_URL = 'http://localhost:47821/hook';
const CONFIG_PATH = path.join(os.homedir(), '.claude', 'settings.json');
const FORWARDER_PATH = path.join(os.homedir(), '.pixel-agent-desk', 'runtime', 'forwarders', 'claude-forwarder.js');

function buildCommandHookEntry(eventName) {
  return {
    matcher: '*',
    hooks: [{
      type: 'command',
      command: `node "${FORWARDER_PATH}" ${eventName}`,
      timeout: 5,
    }],
  };
}

function buildFullConfig() {
  const hooks = {};
  for (const event of EXPECTED_EVENTS) {
    hooks[event] = [buildCommandHookEntry(event)];
  }
  return { hooks };
}

function buildPartialConfig(events) {
  const hooks = {};
  for (const event of events) {
    hooks[event] = [buildCommandHookEntry(event)];
  }
  return { hooks };
}

function buildLegacyHttpConfig() {
  const hooks = {};
  for (const event of EXPECTED_EVENTS) {
    hooks[event] = [{ matcher: '*', hooks: [{ type: 'http', url: HOOK_URL }] }];
  }
  return { hooks };
}

function mockForwarderExists() {
  fs.existsSync.mockImplementation((p) => p === FORWARDER_PATH);
}

describe('hookRegistration', () => {
  let debugLog;

  beforeEach(() => {
    jest.clearAllMocks();
    debugLog = jest.fn();
    mockForwarderExists();
  });

  describe('exports', () => {
    test('HOOK_SERVER_PORT is 47821', () => {
      const { HOOK_SERVER_PORT } = loadModule();
      expect(HOOK_SERVER_PORT).toBe(47821);
    });

    test('registerClaudeHooks is a function', () => {
      const { registerClaudeHooks } = loadModule();
      expect(typeof registerClaudeHooks).toBe('function');
    });
  });

  describe('isHookRegistered — all events must be present', () => {
    test('returns false (triggers registration) when no config file exists', () => {
      const { registerClaudeHooks } = loadModule();
      fs.existsSync.mockImplementation((p) => p === FORWARDER_PATH);
      fs.writeFileSync.mockImplementation(() => {});
      fs.mkdirSync.mockImplementation(() => {});

      registerClaudeHooks(debugLog, { forwarderPath: FORWARDER_PATH });

      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    test('returns false (triggers registration) when config has no hooks key', () => {
      const { registerClaudeHooks } = loadModule();
      fs.existsSync.mockImplementation((p) => p === FORWARDER_PATH || p === CONFIG_PATH);
      fs.readFileSync.mockReturnValue(JSON.stringify({ someOtherKey: true }));
      fs.writeFileSync.mockImplementation(() => {});
      fs.mkdirSync.mockImplementation(() => {});

      registerClaudeHooks(debugLog, { forwarderPath: FORWARDER_PATH });

      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    test('skips registration when all events are already registered', () => {
      const { registerClaudeHooks } = loadModule();
      fs.existsSync.mockImplementation((p) => p === FORWARDER_PATH || p === CONFIG_PATH);
      fs.readFileSync.mockReturnValue(JSON.stringify(buildFullConfig()));

      const result = registerClaudeHooks(debugLog, { forwarderPath: FORWARDER_PATH });

      expect(result).toBe(true);
      expect(fs.writeFileSync).not.toHaveBeenCalled();
      expect(debugLog).toHaveBeenCalledWith(expect.stringContaining('already registered'));
    });

    test('triggers registration when legacy HTTP hooks are still present', () => {
      const { registerClaudeHooks } = loadModule();
      fs.existsSync.mockImplementation((p) => p === FORWARDER_PATH || p === CONFIG_PATH);
      fs.readFileSync.mockReturnValue(JSON.stringify(buildLegacyHttpConfig()));
      fs.writeFileSync.mockImplementation(() => {});
      fs.mkdirSync.mockImplementation(() => {});

      registerClaudeHooks(debugLog, { forwarderPath: FORWARDER_PATH });

      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    test('triggers registration when only old 3-event subset is registered (upgrade scenario)', () => {
      const { registerClaudeHooks } = loadModule();
      fs.existsSync.mockImplementation((p) => p === FORWARDER_PATH || p === CONFIG_PATH);
      fs.readFileSync.mockReturnValue(
        JSON.stringify(buildPartialConfig(['SessionStart', 'PreToolUse', 'PostToolUse']))
      );
      fs.writeFileSync.mockImplementation(() => {});
      fs.mkdirSync.mockImplementation(() => {});

      registerClaudeHooks(debugLog, { forwarderPath: FORWARDER_PATH });

      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    test('triggers registration when any single event is missing', () => {
      const { registerClaudeHooks } = loadModule();
      const missingOne = EXPECTED_EVENTS.filter(e => e !== 'PreCompact');
      fs.existsSync.mockImplementation((p) => p === FORWARDER_PATH || p === CONFIG_PATH);
      fs.readFileSync.mockReturnValue(JSON.stringify(buildPartialConfig(missingOne)));
      fs.writeFileSync.mockImplementation(() => {});
      fs.mkdirSync.mockImplementation(() => {});

      registerClaudeHooks(debugLog, { forwarderPath: FORWARDER_PATH });

      expect(fs.writeFileSync).toHaveBeenCalled();
    });
  });

  describe('registerClaudeHooks — written config', () => {
    function captureWrittenConfig() {
      let written = null;
      fs.writeFileSync.mockImplementation((filePath, content) => {
        if (filePath === CONFIG_PATH) written = JSON.parse(content);
      });
      return () => written;
    }

    test('registers all expected events on fresh install', () => {
      const { registerClaudeHooks } = loadModule();
      fs.existsSync.mockImplementation((p) => p === FORWARDER_PATH);
      fs.mkdirSync.mockImplementation(() => {});
      const getWritten = captureWrittenConfig();

      registerClaudeHooks(debugLog, { forwarderPath: FORWARDER_PATH });

      const config = getWritten();
      expect(config).not.toBeNull();
      for (const event of EXPECTED_EVENTS) {
        expect(config.hooks[event]).toBeDefined();
        expect(
          config.hooks[event].some(
            entry => entry.hooks && entry.hooks.some(h => h.type === 'command' && h.command.includes('claude-forwarder.js'))
          )
        ).toBe(true);
      }
    });

    test('migrates legacy HTTP hooks to command hooks', () => {
      const { registerClaudeHooks } = loadModule();
      fs.existsSync.mockImplementation((p) => p === FORWARDER_PATH || p === CONFIG_PATH);
      fs.readFileSync.mockReturnValue(JSON.stringify(buildLegacyHttpConfig()));
      fs.mkdirSync.mockImplementation(() => {});
      const getWritten = captureWrittenConfig();

      registerClaudeHooks(debugLog, { forwarderPath: FORWARDER_PATH });

      const config = getWritten();
      for (const event of EXPECTED_EVENTS) {
        expect(
          config.hooks[event].some(
            entry => entry.hooks && entry.hooks.some(h => h.type === 'http' && h.url === HOOK_URL)
          )
        ).toBe(false);
        expect(
          config.hooks[event].some(
            entry => entry.hooks && entry.hooks.some(h => h.type === 'command')
          )
        ).toBe(true);
      }
    });

    test('adds missing events without duplicating already-registered ones (idempotent)', () => {
      const { registerClaudeHooks } = loadModule();
      const partial = buildPartialConfig(['SessionStart', 'PreToolUse', 'PostToolUse']);
      fs.existsSync.mockImplementation((p) => p === FORWARDER_PATH || p === CONFIG_PATH);
      fs.readFileSync.mockReturnValue(JSON.stringify(partial));
      fs.mkdirSync.mockImplementation(() => {});
      const getWritten = captureWrittenConfig();

      registerClaudeHooks(debugLog, { forwarderPath: FORWARDER_PATH });

      const config = getWritten();
      expect(config.hooks['SessionStart']).toHaveLength(1);
      expect(
        config.hooks['SubagentStart'].some(
          entry => entry.hooks && entry.hooks.some(h => h.type === 'command')
        )
      ).toBe(true);
    });

    test('preserves existing user hooks alongside ours', () => {
      const { registerClaudeHooks } = loadModule();
      const userHook = { matcher: '*', hooks: [{ type: 'http', url: 'http://localhost:9999/hook' }] };
      fs.existsSync.mockImplementation((p) => p === FORWARDER_PATH || p === CONFIG_PATH);
      fs.readFileSync.mockReturnValue(JSON.stringify({ hooks: { SessionStart: [userHook] } }));
      fs.mkdirSync.mockImplementation(() => {});
      const getWritten = captureWrittenConfig();

      registerClaudeHooks(debugLog, { forwarderPath: FORWARDER_PATH });

      const config = getWritten();
      const sessionStartEntries = config.hooks['SessionStart'];
      expect(sessionStartEntries.some(e => e.hooks.some(h => h.url === 'http://localhost:9999/hook'))).toBe(true);
      expect(sessionStartEntries.some(e => e.hooks.some(h => h.type === 'command'))).toBe(true);
    });

    test('returns false when forwarder is missing', () => {
      const { registerClaudeHooks } = loadModule();
      fs.existsSync.mockReturnValue(false);

      const result = registerClaudeHooks(debugLog, { forwarderPath: FORWARDER_PATH });

      expect(result).toBe(false);
      expect(fs.writeFileSync).not.toHaveBeenCalled();
    });

    test('returns false and logs error when writeFileSync throws', () => {
      const { registerClaudeHooks } = loadModule();
      fs.existsSync.mockImplementation((p) => p === FORWARDER_PATH);
      fs.mkdirSync.mockImplementation(() => {});
      fs.writeFileSync.mockImplementation(() => { throw new Error('Permission denied'); });

      const result = registerClaudeHooks(debugLog, { forwarderPath: FORWARDER_PATH });

      expect(result).toBe(false);
      expect(debugLog).toHaveBeenCalledWith(expect.stringContaining('failed'));
    });
  });
});