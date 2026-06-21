/**
 * opencodePluginMapping.test.js
 * Tests for mapOpenCodeEvent named export — verifies all event mappings.
 *
 * The plugin source is ESM (export default / export function) for OpenCode
 * runtime compatibility.  Jest runs in CommonJS mode, so we load the source
 * as text, strip the export keywords, and eval the resulting function in
 * a sandboxed scope.  This tests the exact same function body without
 * requiring ESM interop.
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Load mapOpenCodeEvent from the ESM plugin source (strip export keywords)
//
// TEMPLATE NOTE: This eval-based loader works because the current plugin has
// zero `import` statements and zero top-level `await`.  If either of those
// is added in the future, this loader will break.  At that point the test
// should switch to a Jest ESM transform or a Node vm.Module-based loader
// (with --experimental-vm-modules).
// ---------------------------------------------------------------------------
const pluginSource = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'adapters', 'opencode-plugin.js'),
  'utf-8'
);

function loadMapOpenCodeEvent(src) {
  const esc = eval('(function(\\u0065xports){' +
    src
      .replace(/export\s+function\s+mapOpenCodeEvent/g, 'function mapOpenCodeEvent')
      .replace(/export\s+default\s+async\s+function/g, 'function _defaultExport')
      .replace(/^export\s*\{[^}]*\}/gm, '// removed named export block')
    + '; return mapOpenCodeEvent; })');
  return esc({});
}

const mapOpenCodeEvent = loadMapOpenCodeEvent(pluginSource);

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------
function makeSessionInfo(id, overrides) {
  return { id, directory: `/projects/${id}`, title: `Session ${id}`, parentID: null, ...overrides };
}

function e(type, props) {
  return { type, properties: props };
}

describe('mapOpenCodeEvent', () => {
  let map;

  beforeEach(() => {
    map = new Map();
  });

  describe('session.created', () => {
    test('emits agent.started with name and project_path', () => {
      const info = makeSessionInfo('s1', { directory: '/projects/my-app', title: 'My App' });
      const payloads = mapOpenCodeEvent(e('session.created', { info }), map);

      expect(payloads).toHaveLength(1);
      expect(payloads[0]).toMatchObject({
        event: 'agent.started',
        source: 'opencode',
        agent_id: 's1',
        name: 'my-app',
        project_path: '/projects/my-app',
        parent_id: null,
        model: null,
      });
      expect(typeof payloads[0].timestamp).toBe('number');
    });

    test('stores session info in the map', () => {
      const info = makeSessionInfo('s1', { directory: '/projects/my-app' });
      mapOpenCodeEvent(e('session.created', { info }), map);

      expect(map.has('s1')).toBe(true);
      expect(map.get('s1')).toMatchObject({ id: 's1', directory: '/projects/my-app', parentID: null });
    });

    test('uses title when directory is empty', () => {
      const info = makeSessionInfo('s1', { directory: '', title: 'pixel-agent-desk' });
      const payloads = mapOpenCodeEvent(e('session.created', { info }), map);

      expect(payloads[0].name).toBe('pixel-agent-desk');
      expect(payloads[0].project_path).toBe('');
    });
  });

  describe('session.updated', () => {
    test('emits agent.started with refreshed name and project_path', () => {
      mapOpenCodeEvent(e('session.created', { info: makeSessionInfo('s1', { directory: '/old' }) }), map);

      const newInfo = makeSessionInfo('s1', { directory: '/new/project', title: 'New Name' });
      const payloads = mapOpenCodeEvent(e('session.updated', { info: newInfo }), map);

      expect(payloads).toHaveLength(1);
      expect(payloads[0]).toMatchObject({
        event: 'agent.started',
        agent_id: 's1',
        name: 'project',
        project_path: '/new/project',
      });
      expect(map.get('s1')).toMatchObject({ directory: '/new/project', title: 'New Name' });
    });
  });

  describe('session.idle', () => {
    test('emits agent.idle (not agent.thinking)', () => {
      mapOpenCodeEvent(e('session.created', { info: makeSessionInfo('s1') }), map);

      const payloads = mapOpenCodeEvent(e('session.idle', { sessionID: 's1' }), map);

      expect(payloads).toHaveLength(1);
      expect(payloads[0].event).toBe('agent.idle');
      expect(payloads[0].agent_id).toBe('s1');
    });
  });

  describe('session.deleted / session.ended', () => {
    test('session.deleted emits agent.removed and clears map', () => {
      mapOpenCodeEvent(e('session.created', { info: makeSessionInfo('s1') }), map);
      expect(map.has('s1')).toBe(true);

      const payloads = mapOpenCodeEvent(e('session.deleted', { info: makeSessionInfo('s1') }), map);

      expect(payloads).toHaveLength(1);
      expect(payloads[0].event).toBe('agent.removed');
      expect(payloads[0].agent_id).toBe('s1');
      expect(map.has('s1')).toBe(false);
    });

    test('session.ended emits agent.removed and clears map', () => {
      mapOpenCodeEvent(e('session.created', { info: makeSessionInfo('s2') }), map);
      expect(map.has('s2')).toBe(true);

      const payloads = mapOpenCodeEvent(e('session.ended', { info: makeSessionInfo('s2') }), map);

      expect(payloads).toHaveLength(1);
      expect(payloads[0].event).toBe('agent.removed');
      expect(payloads[0].agent_id).toBe('s2');
      expect(map.has('s2')).toBe(false);
    });
  });

  describe('session.status', () => {
    test('busy status emits agent.working', () => {
      mapOpenCodeEvent(e('session.created', { info: makeSessionInfo('s1') }), map);

      const payloads = mapOpenCodeEvent(
        e('session.status', { sessionID: 's1', status: { type: 'busy' } }),
        map
      );

      expect(payloads).toHaveLength(1);
      expect(payloads[0].event).toBe('agent.working');
    });

    test('non-busy status emits nothing', () => {
      mapOpenCodeEvent(e('session.created', { info: makeSessionInfo('s1') }), map);

      const payloads = mapOpenCodeEvent(
        e('session.status', { sessionID: 's1', status: { type: 'idle' } }),
        map
      );

      expect(payloads).toHaveLength(0);
    });
  });

  describe('session.error', () => {
    test('emits agent.error with error metadata', () => {
      mapOpenCodeEvent(e('session.created', { info: makeSessionInfo('s1') }), map);

      const payloads = mapOpenCodeEvent(
        e('session.error', { sessionID: 's1', error: 'connection refused' }),
        map
      );

      expect(payloads).toHaveLength(1);
      expect(payloads[0]).toMatchObject({
        event: 'agent.error',
        agent_id: 's1',
        metadata: { error: 'connection refused' },
      });
    });
  });

  describe('message.created', () => {
    test('user message emits agent.thinking', () => {
      mapOpenCodeEvent(e('session.created', { info: makeSessionInfo('s1') }), map);

      const payloads = mapOpenCodeEvent(
        e('message.created', { message: { sessionID: 's1', role: 'user', content: 'hello' } }),
        map
      );

      expect(payloads).toHaveLength(1);
      expect(payloads[0]).toMatchObject({
        event: 'agent.thinking',
        agent_id: 's1',
        source: 'opencode',
      });
    });

    test('assistant message does not emit', () => {
      mapOpenCodeEvent(e('session.created', { info: makeSessionInfo('s1') }), map);

      const payloads = mapOpenCodeEvent(
        e('message.created', { message: { sessionID: 's1', role: 'assistant', content: 'ok' } }),
        map
      );

      expect(payloads).toHaveLength(0);
    });

    test('system message does not emit', () => {
      mapOpenCodeEvent(e('session.created', { info: makeSessionInfo('s1') }), map);

      const payloads = mapOpenCodeEvent(
        e('message.created', { message: { sessionID: 's1', role: 'system', content: 'prompt' } }),
        map
      );

      expect(payloads).toHaveLength(0);
    });

    test('tool message does not emit', () => {
      mapOpenCodeEvent(e('session.created', { info: makeSessionInfo('s1') }), map);

      const payloads = mapOpenCodeEvent(
        e('message.created', { message: { sessionID: 's1', role: 'tool', content: '{}' } }),
        map
      );

      expect(payloads).toHaveLength(0);
    });
  });

  describe('message.part.updated — tool', () => {
    beforeEach(() => {
      mapOpenCodeEvent(e('session.created', { info: makeSessionInfo('s1') }), map);
    });

    test('tool running emits agent.working with tool name', () => {
      const payloads = mapOpenCodeEvent(
        e('message.part.updated', {
          part: { sessionID: 's1', type: 'tool', tool: 'Bash', state: { status: 'running' } },
        }),
        map
      );

      expect(payloads).toHaveLength(1);
      expect(payloads[0]).toMatchObject({ event: 'agent.working', agent_id: 's1', tool: 'Bash' });
    });

    test('tool completed emits agent.thinking', () => {
      const payloads = mapOpenCodeEvent(
        e('message.part.updated', {
          part: { sessionID: 's1', type: 'tool', tool: 'Read', state: { status: 'completed' } },
        }),
        map
      );

      expect(payloads).toHaveLength(1);
      expect(payloads[0]).toMatchObject({ event: 'agent.thinking', agent_id: 's1', tool: 'Read' });
    });

    test('tool error emits agent.error', () => {
      const payloads = mapOpenCodeEvent(
        e('message.part.updated', {
          part: { sessionID: 's1', type: 'tool', tool: 'Bash', state: { status: 'error', error: 'cmd not found' } },
        }),
        map
      );

      expect(payloads).toHaveLength(1);
      expect(payloads[0]).toMatchObject({
        event: 'agent.error',
        agent_id: 's1',
        tool: 'Bash',
        metadata: { error: 'cmd not found' },
      });
    });
  });

  describe('message.part.updated — step-finish', () => {
    test('emits agent.thinking with token_usage', () => {
      mapOpenCodeEvent(e('session.created', { info: makeSessionInfo('s1') }), map);

      const payloads = mapOpenCodeEvent(
        e('message.part.updated', {
          part: {
            sessionID: 's1',
            type: 'step-finish',
            tokens: { input: 500, output: 200, cache: { read: 100, write: 50 } },
          },
        }),
        map
      );

      expect(payloads).toHaveLength(1);
      expect(payloads[0].event).toBe('agent.thinking');
      expect(payloads[0].token_usage).toEqual({
        input_tokens: 500,
        cached_input_tokens: 150,
        output_tokens: 200,
      });
    });

    test('handles missing cache gracefully', () => {
      mapOpenCodeEvent(e('session.created', { info: makeSessionInfo('s1') }), map);

      const payloads = mapOpenCodeEvent(
        e('message.part.updated', {
          part: { sessionID: 's1', type: 'step-finish', tokens: { input: 300, output: 100 } },
        }),
        map
      );

      expect(payloads[0].token_usage).toEqual({
        input_tokens: 300,
        cached_input_tokens: 0,
        output_tokens: 100,
      });
    });
  });

  describe('unknown event', () => {
    test('returns empty array for unmapped event type', () => {
      expect(mapOpenCodeEvent(e('unknown.event', { sessionID: 's1' }), map)).toEqual([]);
    });
  });

  describe('session info map lifecycle', () => {
    test('map accumulates across events within a session', () => {
      mapOpenCodeEvent(e('session.created', { info: makeSessionInfo('s1', { directory: '/projects/app' }) }), map);
      expect(map.get('s1').directory).toBe('/projects/app');

      mapOpenCodeEvent(e('session.idle', { sessionID: 's1' }), map);
      expect(map.get('s1')).toBeTruthy();

      mapOpenCodeEvent(e('session.updated', { info: makeSessionInfo('s1', { directory: '/projects/app-v2' }) }), map);
      expect(map.get('s1').directory).toBe('/projects/app-v2');

      mapOpenCodeEvent(e('session.deleted', { info: makeSessionInfo('s1') }), map);
      expect(map.has('s1')).toBe(false);
    });
  });
});
