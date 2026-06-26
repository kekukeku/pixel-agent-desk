/**
 * Agent Display Format
 *
 * Shared pure functions for formatting agent source labels, status badges,
 * and activity descriptions.  Used by both the dashboard adapter (server)
 * and the client-side UI to keep views consistent.
 */

'use strict';

const SOURCE_LABEL_MAP = {
  'claude-code': 'Claude Code',
  'codex': 'Codex',
  'grok-build': 'Grok Build',
  'antigravity': 'Antigravity',
  'opencode': 'OpenWork',
};

const STATUS_BADGE_MAP = {
  'working': 'WORKING',
  'Working': 'WORKING',
  'thinking': 'THINKING',
  'Thinking': 'THINKING',
  'waiting': 'RESTING',
  'Waiting': 'RESTING',
  'idle': 'RESTING',
  'Idle': 'RESTING',
  'done': 'DONE',
  'Done': 'DONE',
  'completed': 'DONE',
  'error': 'ERROR',
  'Error': 'ERROR',
  'help': 'HELP',
  'Help': 'HELP',
  'playing': 'PLAYING',
  'Playing': 'PLAYING',
};

/**
 * @param {string} source
 * @returns {string}
 */
function formatAgentSource(source) {
  if (!source) return 'Unknown Agent';
  return SOURCE_LABEL_MAP[source] || 'Unknown Agent';
}

/**
 * @param {string} state
 * @returns {string}
 */
function formatAgentStatus(state) {
  if (!state) return 'IDLE';
  return STATUS_BADGE_MAP[state] || state.toUpperCase();
}

/**
 * @param {string} state
 * @param {string|null} tool
 * @returns {string}
 */
function formatAgentActivity(state, tool) {
  const t = tool || '';

  if (t) {
    return `CMD> ${t}`;
  }

  if (!state) return 'Waiting for activity...';

  const lower = state.toLowerCase();

  if (lower === 'working') return 'CMD> Working...';
  if (lower === 'thinking') return 'CMD> Thinking...';
  if (lower === 'waiting' || lower === 'idle') return 'CMD> Idling...';
  if (lower === 'error') return 'CMD> Error';
  if (lower === 'help') return 'CMD> Help';
  if (lower === 'playing') return 'CMD> Playing...';

  return 'Waiting for activity...';
}

/**
 * Resolve agent display name with proper fallbacks.
 * @param {Object} agent
 * @returns {string}
 */
function resolveAgentDisplayName(agent) {
  if (!agent) return 'Agent';

  const isFallback = function (n) {
    return !n || n === 'Agent' || n === 'pixel-agent-desk';
  };

  if (!isFallback(agent.displayName)) return agent.displayName;
  if (!isFallback(agent.sessionTitle)) return agent.sessionTitle;
  if (!isFallback(agent.name)) return agent.name;

  if (agent.source) {
    const srcLabel = formatAgentSource(agent.source);
    if (srcLabel && srcLabel !== 'Unknown Agent') {
      return srcLabel;
    }
  }

  if (agent.projectPath) {
    const path = require('path');
    const b = path.basename(String(agent.projectPath));
    if (!isFallback(b)) return b;
  }

  return 'Agent';
}

/**
 * Get CSS class for source badge.
 * @param {string} source
 * @returns {string}
 */
function sourceCssClass(source) {
  const map = {
    'claude-code': 'src-claude',
    'codex': 'src-codex',
    'grok-build': 'src-grok',
    'antigravity': 'src-antigravity',
    'opencode': 'src-opencode',
  };
  return map[source] || 'src-unknown';
}

/**
 * Safe string — prevent undefined/null rendering.
 * @param {*} val
 * @returns {string}
 */
function safeStr(val) {
  if (val === undefined || val === null) return '';
  return String(val);
}

const path = require('path');

/**
 * Resolve agent name for office bottom badge and System Roster name.
 * Strict contract: manual name → source label → Spirit.
 * No slug, session title, or project basename fallbacks.
 * @param {Object} agent
 * @returns {string}
 */
function resolveAgentName(agent, nameMap) {
  if (!agent) return 'Spirit';

  const agentId = agent.id || agent.sessionId || agent.agentId;

  // 1. Manual rename from name-map.json (highest priority)
  if (nameMap && agentId && nameMap[agentId]) {
    return nameMap[agentId];
  }

  // 2. Pre-resolved agent name (from AgentManager.formatDisplayName or explicit agentName)
  if (agent.displayName && agent.displayName !== 'Agent' && agent.displayName !== 'Spirit') return agent.displayName;
  if (agent.agentName && agent.agentName !== 'Agent' && agent.agentName !== 'Spirit') return agent.agentName;

  // 3. Known source label
  const src = formatAgentSource(agent.source);
  if (src && src !== 'Unknown Agent') return src;

  // 4. Fallback
  return 'Spirit';
}

/**
 * Resolve project label for office middle badge.
 * project basename → workspace context → empty string.
 * Filters out empty values and 'Default' sentinel.
 * Does NOT filter 'pixel-agent-desk' or any other valid repo name.
 * @param {Object} agent
 * @returns {string}
 */
function resolveProjectLabel(agent) {
  if (!agent) return '';

  let projectPath = agent.projectPath;
  if (!projectPath && agent.metadata) projectPath = agent.metadata.projectPath;

  if (!projectPath) return '';
  const normalized = String(projectPath).replace(/\\/g, '/').replace(/\/+$/, '');
  const base = path.basename(normalized);
  if (!base || base === 'Default') return '';
  return base;
}

/**
 * Resolve bubble activity text for office top bubble.
 * publicActivityText → currentTool/tool → state fallback.
 * No CMD> prefix. Bubble-friendly text only.
 * @param {Object} agent
 * @returns {string|null}
 */
function resolveBubbleActivity(agent) {
  if (!agent) return 'Thinking...';

  const pub = agent.publicActivityText || (agent.metadata && agent.metadata.publicActivityText);
  if (pub && String(pub).trim()) {
    return String(pub).trim();
  }

  const tool = agent.currentTool || agent.tool || (agent.metadata && (agent.metadata.tool || agent.metadata.currentTool));
  if (tool && String(tool).trim()) {
    return String(tool).trim();
  }

  const state = (agent.state || agent.status || (agent.metadata && agent.metadata.status) || '').toLowerCase();

  if (state === 'working') return 'Working...';
  if (state === 'thinking') return 'Thinking...';
  if (state === 'waiting' || state === 'idle') return 'Idling...';
  if (state === 'error') return 'Error!';
  if (state === 'help') return 'Need help!';
  if (state === 'done' || state === 'completed') return 'Done!';
  if (state === 'playing') return 'Playing...';

  return 'Thinking...';
}

/**
 * Format command-line text for System Roster command line.
 * CMD> <tool> or CMD> state fallback.
 * @param {Object} agent
 * @returns {string}
 */
function formatCommandText(agent) {
  if (!agent) return 'Waiting for activity...';

  const tool = agent.currentTool || agent.tool;
  if (tool && String(tool).trim()) {
    return `CMD> ${String(tool).trim()}`;
  }

  const state = (agent.state || agent.status || '').toLowerCase();

  if (state === 'working') return 'CMD> Working...';
  if (state === 'thinking') return 'CMD> Thinking...';
  if (state === 'waiting' || state === 'idle') return 'CMD> Idling...';
  if (state === 'error') return 'CMD> Error';
  if (state === 'help') return 'CMD> Help';
  if (state === 'done' || state === 'completed') return 'CMD> Done';
  if (state === 'playing') return 'CMD> Playing...';

  return 'Waiting for activity...';
}

module.exports = {
  formatAgentSource,
  formatAgentStatus,
  formatAgentActivity,
  resolveAgentDisplayName,
  resolveAgentName,
  resolveProjectLabel,
  resolveBubbleActivity,
  formatCommandText,
  sourceCssClass,
  safeStr,
};
