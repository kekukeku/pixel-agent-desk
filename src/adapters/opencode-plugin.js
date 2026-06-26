/**
 * Pixel Agent Desk — OpenWork / OpenCode Plugin
 *
 * Hooks into OpenCode lifecycle events and forwards normalized agent
 * events to the PAD HTTP hook server (http://127.0.0.1:47821/events/agent).
 *
 * This plugin works with both:
 *   - OpenWork desktop app (which runs opencode serve under the hood)
 *   - Standalone OpenCode CLI
 *
 * Zero external dependencies — uses only globals available in the
 * OpenCode embedded JavaScript runtime (Date, Map, JSON, globalThis.fetch).
 *
 * Installation: placed at ~/.config/opencode/plugins/pad-adapter.js
 * by PAD's install script or at app startup.
 */

const PAD_EVENT_URL = 'http://127.0.0.1:47821/events/agent';

const _fetch = globalThis.fetch;

function basename(filePath) {
  const trimmed = filePath.replace(/[/\\]+$/, '');
  const idx = Math.max(trimmed.lastIndexOf('/'), trimmed.lastIndexOf('\\'));
  return idx >= 0 ? trimmed.slice(idx + 1) : trimmed;
}

function postEvent(payload) {
  if (!_fetch) return;
  _fetch(PAD_EVENT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).catch(function () {});
}

function buildBase(sessionInfoMap, sessionID) {
  const info = sessionInfoMap.get(sessionID);
  if (info) {
    const directory = info.directory || '';
    const name = directory ? basename(directory) : info.title || '';
    return {
      source: 'opencode',
      agent_id: info.id || sessionID,
      name: name,
      project_path: directory,
      parent_id: info.parentID || null,
      timestamp: Date.now(),
    };
  }
  return {
    source: 'opencode',
    agent_id: sessionID,
    name: '',
    project_path: '',
    parent_id: null,
    timestamp: Date.now(),
  };
}

/**
 * mapOpenCodeEvent(event, sessionInfoMap) → payload[]
 *
 * Pure mapping function: translates a single OpenCode lifecycle event into
 * zero or more normalized agent event payloads.  May mutate sessionInfoMap
 * (used as the plugin runtime's session cache).
 *
 * No fetch, no file I/O, no global state.
 */
function mapOpenCodeEvent(event, sessionInfoMap) {
  const type = event.type;
  const props = event.properties;
  const payloads = [];

  switch (type) {

    case 'session.created': {
      const { info } = props;
      sessionInfoMap.set(info.id, {
        id: info.id,
        directory: info.directory || '',
        title: info.title || '',
        parentID: info.parentID || null,
      });
      payloads.push({
        ...buildBase(sessionInfoMap, info.id),
        event: 'agent.started',
        model: null,
      });
      break;
    }

    case 'session.updated': {
      const { info } = props;
      sessionInfoMap.set(info.id, {
        id: info.id,
        directory: info.directory || '',
        title: info.title || '',
        parentID: info.parentID || null,
      });
      payloads.push({
        ...buildBase(sessionInfoMap, info.id),
        event: 'agent.started',
        model: null,
      });
      break;
    }

    case 'session.deleted':
    case 'session.ended': {
      const { info } = props;
      if (info && info.id) {
        sessionInfoMap.delete(info.id);
      }
      payloads.push({
        ...buildBase(sessionInfoMap, info ? info.id : ''),
        event: 'agent.removed',
      });
      break;
    }

    case 'session.status': {
      const { sessionID, status } = props;
      if (status && status.type === 'busy') {
        payloads.push({
          ...buildBase(sessionInfoMap, sessionID),
          event: 'agent.working',
        });
      }
      break;
    }

    case 'session.idle': {
      const { sessionID } = props;
      payloads.push({
        ...buildBase(sessionInfoMap, sessionID),
        event: 'agent.idle',
      });
      break;
    }

    case 'session.error': {
      const { sessionID, error } = props;
      payloads.push({
        ...buildBase(sessionInfoMap, sessionID),
        event: 'agent.error',
        metadata: { error: error ? String(error) : null },
      });
      break;
    }

    case 'message.created': {
      const message = props.message;
      if (!message || !message.sessionID) break;
      if (message.role === 'user') {
        payloads.push({
          ...buildBase(sessionInfoMap, message.sessionID),
          event: 'agent.thinking',
        });
      }
      break;
    }

    case 'message.part.updated': {
      const { part } = props;
      if (!part || !part.sessionID) break;

      if (part.type === 'tool') {
        const toolPart = part;
        const toolState = toolPart.state;

        switch (toolState.status) {
          case 'running':
            payloads.push({
              ...buildBase(sessionInfoMap, toolPart.sessionID),
              event: 'agent.working',
              tool: toolPart.tool,
            });
            break;

          case 'completed':
            payloads.push({
              ...buildBase(sessionInfoMap, toolPart.sessionID),
              event: 'agent.thinking',
              tool: toolPart.tool,
            });
            break;

          case 'error':
            payloads.push({
              ...buildBase(sessionInfoMap, toolPart.sessionID),
              event: 'agent.error',
              tool: toolPart.tool,
              metadata: { error: toolPart.state ? String(toolPart.state.error || 'tool_error') : 'tool_error' },
            });
            break;
        }
      } else if (part.type === 'step-finish') {
        const stepPart = part;
        const cache = stepPart.tokens && stepPart.tokens.cache;
        payloads.push({
          ...buildBase(sessionInfoMap, stepPart.sessionID),
          event: 'agent.thinking',
          token_usage: {
            input_tokens: (stepPart.tokens && stepPart.tokens.input) || 0,
            cached_input_tokens: (cache ? (cache.read || 0) + (cache.write || 0) : 0),
            output_tokens: (stepPart.tokens && stepPart.tokens.output) || 0,
          },
        });
      }
      break;
    }
  }

  return payloads;
}

const plugin = async function (input) {
  const _sessionInfoMap = new Map();

  return {
    async event({ event }) {
      const payloads = mapOpenCodeEvent(event, _sessionInfoMap);
      for (let i = 0; i < payloads.length; i++) {
        postEvent(payloads[i]);
      }
    },

    async dispose() {
      _sessionInfoMap.clear();
    },
  };
};

export default plugin;
export { plugin as FolderWorkspacePlugin };
export { plugin as PadAdapterPlugin };
export { plugin as ExamplePlugin };
export { plugin as server };

