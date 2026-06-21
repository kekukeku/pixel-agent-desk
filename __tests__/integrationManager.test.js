/**
 * integrationManager.test.js
 * Tests for Integration Manager: adapter registration, lifecycle, error isolation, capability report
 */

'use strict';

const manager = require('../src/main/integrations/integrationManager');

function createFakeAdapter(overrides) {
  return {
    id: 'fake-test',
    label: 'Fake Test',
    setupMode: 'command-hook',

    detectInstalled() { return false; },
    detectIntegrated() { return false; },
    ensureIntegration() { return { status: 'planned' }; },
    start() { return { status: 'started' }; },
    stop() { return { status: 'stopped' }; },
    getHealth() { return { active: false, lastEventAt: null, error: null }; },

    ...overrides
  };
}

describe('integrationManager', () => {
  let debugLog;

  beforeEach(() => {
    debugLog = jest.fn();
    manager.init({ debugLog });
  });

  afterEach(() => {
    manager.cleanup();
  });

  describe('registerAdapter', () => {
    test('registers a valid adapter', () => {
      const adapter = createFakeAdapter({ id: 'test-1', label: 'Test One' });
      const result = manager.registerAdapter(adapter);
      expect(result).toBe(true);
      expect(manager.getRegisteredAdapters()).toContain('test-1');
    });

    test('rejects null adapter', () => {
      expect(manager.registerAdapter(null)).toBe(false);
      expect(manager.getRegisteredAdapters()).toHaveLength(0);
    });

    test('rejects adapter without id', () => {
      const adapter = { label: 'No ID', detectInstalled() {}, detectIntegrated() {}, ensureIntegration() {}, start() {}, stop() {}, getHealth() {} };
      expect(manager.registerAdapter(adapter)).toBe(false);
    });

    test('rejects adapter missing required method', () => {
      const adapter = { id: 'incomplete', label: 'Incomplete', detectInstalled() {}, detectIntegrated() {}, ensureIntegration() {} };
      expect(manager.registerAdapter(adapter)).toBe(false);
    });
  });

  describe('detectAll', () => {
    test('calls detectInstalled and detectIntegrated on all adapters', () => {
      const detectInstalled = jest.fn().mockReturnValue(true);
      const detectIntegrated = jest.fn().mockReturnValue(false);

      manager.registerAdapter(createFakeAdapter({ id: 'a', detectInstalled, detectIntegrated }));
      manager.registerAdapter(createFakeAdapter({ id: 'b', detectInstalled, detectIntegrated }));

      const results = manager.detectAll();

      expect(results).toEqual([
        { id: 'a', installed: true, integrated: false },
        { id: 'b', installed: true, integrated: false }
      ]);
      expect(detectInstalled).toHaveBeenCalledTimes(2);
      expect(detectIntegrated).toHaveBeenCalledTimes(2);
    });

    test('adapter that throws does not block others', () => {
      manager.registerAdapter(createFakeAdapter({
        id: 'good',
        detectInstalled: () => true,
        detectIntegrated: () => true
      }));
      manager.registerAdapter(createFakeAdapter({
        id: 'bad',
        detectInstalled: () => { throw new Error('BOOM'); },
        detectIntegrated: () => { throw new Error('BOOM'); }
      }));
      manager.registerAdapter(createFakeAdapter({
        id: 'also-good',
        detectInstalled: () => true,
        detectIntegrated: () => false
      }));

      const results = manager.detectAll();

      expect(results).toEqual([
        { id: 'good', installed: true, integrated: true },
        { id: 'bad', installed: false, integrated: false },
        { id: 'also-good', installed: true, integrated: false }
      ]);
    });
  });

  describe('ensureAll', () => {
    test('calls ensureIntegration on all adapters', () => {
      const ensure = jest.fn().mockReturnValue({ status: 'planned' });
      manager.registerAdapter(createFakeAdapter({ id: 'a', ensureIntegration: ensure }));
      manager.registerAdapter(createFakeAdapter({ id: 'b', ensureIntegration: ensure }));

      const results = manager.ensureAll();

      expect(results).toEqual([
        { id: 'a', result: { status: 'planned' } },
        { id: 'b', result: { status: 'planned' } }
      ]);
      expect(ensure).toHaveBeenCalledTimes(2);
    });

    test('adapter that throws does not block others', () => {
      manager.registerAdapter(createFakeAdapter({
        id: 'good',
        ensureIntegration: () => ({ status: 'installed' })
      }));
      manager.registerAdapter(createFakeAdapter({
        id: 'bad',
        ensureIntegration: () => { throw new Error('ENOENT'); }
      }));

      const results = manager.ensureAll();

      expect(results).toEqual([
        { id: 'good', result: { status: 'installed' } },
        { id: 'bad', result: null }
      ]);
    });
  });

  describe('ensureInstallableAdapters', () => {
    test('only ensures Claude and OpenCode adapters', () => {
      const ensureClaude = jest.fn().mockReturnValue({ status: 'installed' });
      const ensureOpenCode = jest.fn().mockReturnValue({ status: 'installed' });
      const ensureGrok = jest.fn().mockReturnValue({ status: 'installed' });

      manager.registerAdapter(createFakeAdapter({ id: 'claude-code', ensureIntegration: ensureClaude }));
      manager.registerAdapter(createFakeAdapter({ id: 'opencode', ensureIntegration: ensureOpenCode }));
      manager.registerAdapter(createFakeAdapter({ id: 'grok-build', ensureIntegration: ensureGrok }));

      const results = manager.ensureInstallableAdapters();

      expect(results).toEqual([
        { id: 'claude-code', status: 'installed', message: null },
        { id: 'opencode', status: 'installed', message: null }
      ]);
      expect(ensureClaude).toHaveBeenCalledTimes(1);
      expect(ensureOpenCode).toHaveBeenCalledTimes(1);
      expect(ensureGrok).not.toHaveBeenCalled();
    });

    test('returns failed when an installable adapter throws', () => {
      manager.registerAdapter(createFakeAdapter({
        id: 'claude-code',
        ensureIntegration: () => { throw new Error('write denied'); }
      }));

      const results = manager.ensureInstallableAdapters();

      expect(results).toEqual([
        { id: 'claude-code', status: 'failed', message: 'ensureIntegration failed' }
      ]);
    });

    test('respects install-time config gates', () => {
      const ensureClaude = jest.fn().mockReturnValue({ status: 'installed' });
      const ensureOpenCode = jest.fn().mockReturnValue({ status: 'installed' });

      manager.registerAdapter(createFakeAdapter({ id: 'claude-code', ensureIntegration: ensureClaude }));
      manager.registerAdapter(createFakeAdapter({ id: 'opencode', ensureIntegration: ensureOpenCode }));

      const results = manager.ensureInstallableAdapters({
        appConfig: {
          integrations: {
            claude: { enabled: false },
            opencode: { enabled: false }
          }
        }
      });

      expect(results).toEqual([
        { id: 'claude-code', status: 'skipped', reason: 'disabled' },
        { id: 'opencode', status: 'skipped', reason: 'disabled' }
      ]);
      expect(ensureClaude).not.toHaveBeenCalled();
      expect(ensureOpenCode).not.toHaveBeenCalled();
    });
  });

  describe('startAll', () => {
    test('calls start on all adapters', () => {
      const start = jest.fn().mockReturnValue({ status: 'started' });
      manager.registerAdapter(createFakeAdapter({ id: 'a', start }));
      manager.registerAdapter(createFakeAdapter({ id: 'b', start }));

      const results = manager.startAll();

      expect(results).toEqual([
        { id: 'a', result: { status: 'started' } },
        { id: 'b', result: { status: 'started' } }
      ]);
      expect(start).toHaveBeenCalledTimes(2);
    });

    test('adapter that throws does not block others', () => {
      manager.registerAdapter(createFakeAdapter({
        id: 'good',
        start: () => ({ status: 'started' })
      }));
      manager.registerAdapter(createFakeAdapter({
        id: 'bad',
        start: () => { throw new Error('start failed'); }
      }));

      const results = manager.startAll();

      expect(results).toEqual([
        { id: 'good', result: { status: 'started' } },
        { id: 'bad', result: null }
      ]);
    });
  });

  describe('stopAll', () => {
    test('calls stop on all adapters', () => {
      const stop = jest.fn().mockReturnValue({ status: 'stopped' });
      manager.registerAdapter(createFakeAdapter({ id: 'a', stop }));
      manager.registerAdapter(createFakeAdapter({ id: 'b', stop }));

      const results = manager.stopAll();

      expect(results).toEqual([
        { id: 'a', result: { status: 'stopped' } },
        { id: 'b', result: { status: 'stopped' } }
      ]);
      expect(stop).toHaveBeenCalledTimes(2);
    });

    test('adapter that throws does not block others', () => {
      manager.registerAdapter(createFakeAdapter({
        id: 'good',
        stop: () => ({ status: 'stopped' })
      }));
      manager.registerAdapter(createFakeAdapter({
        id: 'bad',
        stop: () => { throw new Error('stop failed'); }
      }));

      const results = manager.stopAll();

      expect(results).toEqual([
        { id: 'good', result: { status: 'stopped' } },
        { id: 'bad', result: null }
      ]);
    });
  });

  describe('getCapabilityReport', () => {
    test('returns report for all registered adapters with correct shape', () => {
      manager.registerAdapter(createFakeAdapter({
        id: 'test-a',
        label: 'Test Alpha',
        setupMode: 'command-hook',
        detectInstalled: () => true,
        detectIntegrated: () => false,
        getHealth: () => ({ active: false, lastEventAt: null, error: null })
      }));

      const report = manager.getCapabilityReport();

      expect(report).toHaveLength(1);
      expect(report[0]).toEqual({
        source: 'test-a',
        label: 'Test Alpha',
        installed: true,
        integrated: false,
        active: false,
        setupMode: 'command-hook',
        lastEventAt: null,
        error: null
      });
    });

    test('falls back to process-fallback when setupMode is missing', () => {
      const adapter = createFakeAdapter({
        id: 'no-mode',
        label: 'No Mode',
        detectInstalled: () => false,
        detectIntegrated: () => false,
        getHealth: () => ({ active: false, lastEventAt: null, error: null })
      });
      delete adapter.setupMode;
      manager.registerAdapter(adapter);

      const report = manager.getCapabilityReport();
      expect(report[0].setupMode).toBe('process-fallback');
    });

    test('reports active from health when available', () => {
      manager.registerAdapter(createFakeAdapter({
        id: 'active-one',
        label: 'Active One',
        detectInstalled: () => true,
        detectIntegrated: () => true,
        getHealth: () => ({ active: true, lastEventAt: 1000000000000, error: null })
      }));

      const report = manager.getCapabilityReport();
      expect(report[0].active).toBe(true);
      expect(report[0].lastEventAt).toBe(1000000000000);
    });

    test('detectInstalled exception is captured as error', () => {
      manager.registerAdapter(createFakeAdapter({
        id: 'broken-install',
        label: 'Broken Install',
        detectInstalled: () => { throw new Error('fs access denied'); },
        detectIntegrated: () => false,
        getHealth: () => ({ active: false, lastEventAt: null, error: null })
      }));

      const report = manager.getCapabilityReport();
      expect(report[0].installed).toBe(false);
      expect(report[0].error).toBe('fs access denied');
    });

    test('detectIntegrated exception is captured as error', () => {
      manager.registerAdapter(createFakeAdapter({
        id: 'broken-check',
        label: 'Broken Check',
        detectInstalled: () => true,
        detectIntegrated: () => { throw new Error('read failed'); },
        getHealth: () => ({ active: false, lastEventAt: null, error: null })
      }));

      const report = manager.getCapabilityReport();
      expect(report[0].integrated).toBe(false);
      expect(report[0].error).toBe('read failed');
    });

    test('getHealth exception is captured as error', () => {
      manager.registerAdapter(createFakeAdapter({
        id: 'broken-health',
        label: 'Broken Health',
        detectInstalled: () => true,
        detectIntegrated: () => true,
        getHealth: () => { throw new Error('health check timeout'); }
      }));

      const report = manager.getCapabilityReport();
      expect(report[0].error).toBe('health check timeout');
    });

    test('getHealth error field is propagated when present', () => {
      manager.registerAdapter(createFakeAdapter({
        id: 'health-err',
        label: 'Health Error',
        detectInstalled: () => true,
        detectIntegrated: () => true,
        getHealth: () => ({ active: false, lastEventAt: null, error: 'connection refused' })
      }));

      const report = manager.getCapabilityReport();
      expect(report[0].error).toBe('connection refused');
    });

    test('multiple adapters, broken ones do not block healthy ones', () => {
      manager.registerAdapter(createFakeAdapter({
        id: 'healthy',
        label: 'Healthy',
        setupMode: 'legacy-http-hook',
        detectInstalled: () => true,
        detectIntegrated: () => true,
        getHealth: () => ({ active: true, lastEventAt: Date.now(), error: null })
      }));
      manager.registerAdapter(createFakeAdapter({
        id: 'broken',
        label: 'Broken',
        setupMode: 'command-hook',
        detectInstalled: () => { throw new Error('crash'); },
        detectIntegrated: () => { throw new Error('crash again'); },
        getHealth: () => { throw new Error('crash health'); }
      }));
      manager.registerAdapter(createFakeAdapter({
        id: 'also-healthy',
        label: 'Also Healthy',
        setupMode: 'read-only-observer',
        detectInstalled: () => false,
        detectIntegrated: () => false,
        getHealth: () => ({ active: false, lastEventAt: null, error: null })
      }));

      const report = manager.getCapabilityReport();

      expect(report).toHaveLength(3);
      expect(report[0]).toMatchObject({ source: 'healthy', installed: true, integrated: true, error: null });
      expect(report[1]).toMatchObject({ source: 'broken', installed: false, integrated: false, error: 'crash' });
      expect(report[2]).toMatchObject({ source: 'also-healthy', installed: false, integrated: false, error: null });
    });

    test('reports empty array when no adapters registered', () => {
      expect(manager.getCapabilityReport()).toEqual([]);
    });
  });

  describe('getRegisteredAdapters', () => {
    test('returns array of registered adapter IDs', () => {
      manager.registerAdapter(createFakeAdapter({ id: 'first' }));
      manager.registerAdapter(createFakeAdapter({ id: 'second' }));
      expect(manager.getRegisteredAdapters()).toEqual(['first', 'second']);
    });
  });

  describe('cleanup', () => {
    test('clears all registered adapters', () => {
      manager.registerAdapter(createFakeAdapter({ id: 'to-clean' }));
      expect(manager.getRegisteredAdapters()).toHaveLength(1);

      manager.cleanup();
      expect(manager.getRegisteredAdapters()).toHaveLength(0);
    });
  });

  describe('registerDefaultAdapters', () => {
    test('registers all five default adapters', () => {
      const count = manager.registerDefaultAdapters();
      expect(count).toBe(5);
      expect(manager.getRegisteredAdapters()).toEqual([
        'claude-code',
        'codex',
        'grok-build',
        'antigravity',
        'opencode'
      ]);
    });

    test('correct setupMode for each default adapter', () => {
      manager.registerDefaultAdapters();
      const report = manager.getCapabilityReport();

      const modes = {};
      for (const entry of report) {
        modes[entry.source] = entry.setupMode;
      }

      expect(modes).toEqual({
        'claude-code': 'legacy-http-hook',
        'codex': 'read-only-observer',
        'grok-build': 'command-hook',
        'antigravity': 'command-hook',
        'opencode': 'opencode-plugin'
      });
    });

    test('correct label for each default adapter', () => {
      manager.registerDefaultAdapters();
      const report = manager.getCapabilityReport();

      const labels = {};
      for (const entry of report) {
        labels[entry.source] = entry.label;
      }

      expect(labels).toEqual({
        'claude-code': 'Claude Code',
        'codex': 'Codex',
        'grok-build': 'Grok Build',
        'antigravity': 'Antigravity',
        'opencode': 'OpenWork / OpenCode'
      });
    });

    test('default adapters report active=false, no errors; installed/integrated are adapter-defined', () => {
      manager.registerDefaultAdapters();
      const report = manager.getCapabilityReport();

      for (const entry of report) {
        expect(entry.active).toBe(false);
        expect(entry.error).toBeNull();
      }
    });

    test('source field matches adapter id', () => {
      manager.registerDefaultAdapters();
      const report = manager.getCapabilityReport();

      const sources = report.map(r => r.source).sort();
      expect(sources).toEqual([
        'antigravity',
        'claude-code',
        'codex',
        'grok-build',
        'opencode'
      ]);
    });
  });

  describe('registerDefaultAdapters with config gate', () => {
    test('no config still registers all five adapters', () => {
      const count = manager.registerDefaultAdapters();
      expect(count).toBe(5);
      expect(manager.getRegisteredAdapters()).toHaveLength(5);
    });

    test('opencode disabled in config skips opencode adapter', () => {
      manager.cleanup();
      const count = manager.registerDefaultAdapters({
        appConfig: { integrations: { opencode: { enabled: false } } }
      });
      expect(count).toBe(4);
      expect(manager.getRegisteredAdapters()).not.toContain('opencode');
      expect(manager.getRegisteredAdapters()).toContain('claude-code');
      expect(manager.getRegisteredAdapters()).toContain('codex');
      expect(manager.getRegisteredAdapters()).toContain('grok-build');
      expect(manager.getRegisteredAdapters()).toContain('antigravity');
    });

    test('opencode enabled in config registers all five', () => {
      manager.cleanup();
      const count = manager.registerDefaultAdapters({
        appConfig: { integrations: { opencode: { enabled: true } } }
      });
      expect(count).toBe(5);
      expect(manager.getRegisteredAdapters()).toContain('opencode');
    });

    test('claude disabled in config skips claude adapter', () => {
      manager.cleanup();
      const count = manager.registerDefaultAdapters({
        appConfig: { integrations: { claude: { enabled: false } } }
      });
      expect(count).toBe(4);
      expect(manager.getRegisteredAdapters()).not.toContain('claude-code');
      expect(manager.getRegisteredAdapters()).toContain('opencode');
      expect(manager.getRegisteredAdapters()).toContain('codex');
      expect(manager.getRegisteredAdapters()).toContain('grok-build');
      expect(manager.getRegisteredAdapters()).toContain('antigravity');
    });

    test('claude and opencode disabled in config skips both adapters', () => {
      manager.cleanup();
      const count = manager.registerDefaultAdapters({
        appConfig: {
          integrations: {
            claude: { enabled: false },
            opencode: { enabled: false },
          },
        },
      });
      expect(count).toBe(3);
      expect(manager.getRegisteredAdapters()).toEqual([
        'codex',
        'grok-build',
        'antigravity',
      ]);
    });

    test('empty appConfig registers all five', () => {
      manager.cleanup();
      const count = manager.registerDefaultAdapters({ appConfig: {} });
      expect(count).toBe(5);
    });

    test('processAgentEvent is accepted and all five adapters registered', () => {
      manager.cleanup();
      const mockProcessEvent = jest.fn();
      const count = manager.registerDefaultAdapters({
        processAgentEvent: mockProcessEvent,
      });
      expect(count).toBe(5);
    });

    test('codex adapter receives processAgentEvent (wiring verification)', () => {
      const mockProcessEvent = jest.fn();
      manager.registerDefaultAdapters({ processAgentEvent: mockProcessEvent });

      // Verify all five are present including codex
      const report = manager.getCapabilityReport();
      const codexEntry = report.find(function (r) { return r.source === 'codex'; });
      expect(codexEntry).toBeTruthy();

      // startAll should not throw — codex with processAgentEvent should start
      expect(function () { manager.startAll(); }).not.toThrow();

      // cleanup
      manager.stopAll();
    });
  });

  describe('formatCapabilityReport', () => {
    function makeEntry(source, label, overrides) {
      return {
        source,
        label,
        installed: false,
        integrated: false,
        active: false,
        setupMode: 'process-fallback',
        lastEventAt: null,
        error: null,
        ...overrides,
      };
    }

    test('empty report shows no adapters message', () => {
      const result = manager.formatCapabilityReport([]);
      expect(result).toContain('(no adapters registered)');
    });

    test('null report shows no adapters message', () => {
      const result = manager.formatCapabilityReport(null);
      expect(result).toContain('(no adapters registered)');
    });

    test('formats a single adapter', () => {
      const report = [makeEntry('claude-code', 'Claude Code', { installed: true, integrated: false, setupMode: 'legacy-http-hook' })];
      const result = manager.formatCapabilityReport(report);
      expect(result).toContain('1 adapters registered');
      expect(result).toContain('Claude Code: installed=true integrated=false active=false setupMode=legacy-http-hook');
    });

    test('includes lastEventAt when present', () => {
      const report = [makeEntry('codex', 'Codex', { lastEventAt: 1710000000000 })];
      const result = manager.formatCapabilityReport(report);
      expect(result).toContain('lastEventAt=1710000000000');
    });

    test('omits lastEventAt when null', () => {
      const report = [makeEntry('codex', 'Codex', { lastEventAt: null })];
      const result = manager.formatCapabilityReport(report);
      expect(result).not.toContain('lastEventAt');
    });

    test('formats error with [ERROR: ...] prefix', () => {
      const report = [makeEntry('grok-build', 'Grok Build', { error: 'connection refused' })];
      const result = manager.formatCapabilityReport(report);
      expect(result).toContain('[ERROR: connection refused]');
    });

    test('omits error when null', () => {
      const report = [makeEntry('grok-build', 'Grok Build', { error: null })];
      const result = manager.formatCapabilityReport(report);
      expect(result).not.toContain('[ERROR');
    });

    test('preserves input order, does not resort', () => {
      const report = [
        makeEntry('grok-build', 'Grok Build'),
        makeEntry('codex', 'Codex'),
        makeEntry('claude-code', 'Claude Code'),
      ];
      const result = manager.formatCapabilityReport(report);
      const idxGrok = result.indexOf('Grok Build');
      const idxCodex = result.indexOf('Codex');
      const idxClaude = result.indexOf('Claude Code');
      expect(idxGrok).toBeLessThan(idxCodex);
      expect(idxCodex).toBeLessThan(idxClaude);
    });

    test('full report format is correct', () => {
      const report = [
        makeEntry('claude-code', 'Claude Code', { installed: true, integrated: true, setupMode: 'legacy-http-hook' }),
        makeEntry('codex', 'Codex', { installed: true, integrated: true, active: true, setupMode: 'read-only-observer', lastEventAt: 1710000000000 }),
        makeEntry('grok-build', 'Grok Build', { setupMode: 'command-hook' }),
        makeEntry('antigravity', 'Antigravity', { error: 'not installed' }),
      ];
      const result = manager.formatCapabilityReport(report);
      expect(result).toContain('4 adapters registered');
      expect(result).toContain('Claude Code: installed=true integrated=true active=false setupMode=legacy-http-hook');
      expect(result).toContain('Codex: installed=true integrated=true active=true setupMode=read-only-observer lastEventAt=1710000000000');
      expect(result).toContain('Grok Build: installed=false integrated=false active=false setupMode=command-hook');
      expect(result).toContain('Antigravity: installed=false integrated=false active=false setupMode=process-fallback [ERROR: not installed]');
    });

    test('getCapabilityReport structure is unchanged', () => {
      manager.registerDefaultAdapters();
      const report = manager.getCapabilityReport();
      expect(report.length).toBeGreaterThan(0);
      for (const entry of report) {
        expect(entry).toHaveProperty('source');
        expect(entry).toHaveProperty('label');
        expect(entry).toHaveProperty('installed');
        expect(entry).toHaveProperty('integrated');
        expect(entry).toHaveProperty('active');
        expect(entry).toHaveProperty('setupMode');
        expect(entry).toHaveProperty('lastEventAt');
        expect(entry).toHaveProperty('error');
      }
    });
  });
});
