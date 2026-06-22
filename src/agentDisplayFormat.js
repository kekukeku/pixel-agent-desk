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
  'opencode': 'OpenWork / OpenCode',
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

  if (agent.projectPath) {
    const path = require('path');
    const b = path.basename(String(agent.projectPath));
    if (!isFallback(b)) return b;
  }

  if (agent.source) return formatAgentSource(agent.source);

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

module.exports = {
  formatAgentSource,
  formatAgentStatus,
  formatAgentActivity,
  resolveAgentDisplayName,
  sourceCssClass,
  safeStr,
};
