/**
 * Dashboard Data Adapter
 * Converts Pixel Agent Desk agent format to Dashboard format
 */

const path = require('path');
const { formatAgentSource, formatAgentStatus, formatAgentActivity, resolveAgentDisplayName, resolveAgentName, resolveProjectLabel, resolveBubbleActivity, formatCommandText, safeStr } = require('./agentDisplayFormat');

/**
 * State mapping from Pixel Agent Desk to Dashboard
 */
const STATE_MAP = {
  'Working': 'working',
  'Thinking': 'thinking',
  'Done': 'completed',
  'Waiting': 'waiting',
  'Help': 'help',
  'Error': 'error',
  'Playing': 'playing'
};

/**
 * Default state for unmapped values
 */
const DEFAULT_STATE = 'idle';

/**
 * Map Pixel Agent Desk state to Dashboard state
 * @param {string} pixelState - Pixel Agent Desk state
 * @returns {string} Dashboard state
 */
function mapPixelStateToDashboardState(pixelState) {
  return STATE_MAP[pixelState] || DEFAULT_STATE;
}

/**
 * Extract project name from full path
 * @param {string} projectPath - Full project path
 * @returns {string} Project name or 'Default'
 */
function extractProjectName(projectPath) {
  if (!projectPath) return '';
  const normalized = projectPath.replace(/\\/g, '/');
  const base = path.basename(normalized);
  if (!base || base === 'Default') return '';
  return base;
}

/**
 * Determine agent type based on properties
 * @param {Object} agent - Pixel Agent Desk agent object
 * @returns {string} Agent type: 'main', 'subagent', or 'teammate'
 */
function determineAgentType(agent) {
  if (agent.isSubagent) return 'subagent';
  if (agent.isTeammate) return 'teammate';
  return 'main';
}

/**
 * Calculate elapsed time for an agent
 * @param {Object} agent - Pixel Agent Desk agent object
 * @returns {number} Elapsed time in milliseconds
 */
function calculateElapsedTime(agent) {
  if (!agent.firstSeen) return 0;
  return Date.now() - agent.firstSeen;
}

/**
 * Check if agent is currently active
 * @param {string} state - Agent state
 * @returns {boolean} True if agent is working or thinking
 */
function isAgentActive(state) {
  return state === 'Working' || state === 'Thinking';
}

function hasMeteredUsage(pixelAgent) {
  return !!(
    pixelAgent.tokenUsage && (
      pixelAgent.tokenUsage.usageAvailable ||
      pixelAgent.tokenUsage.inputTokens > 0 ||
      pixelAgent.tokenUsage.outputTokens > 0 ||
      (pixelAgent.model && /^(claude|gpt|gemini)/i.test(pixelAgent.model))
    )
  );
}

function hasContextUsage(pixelAgent) {
  if (!pixelAgent) return false;
  if (pixelAgent.contextUsage?.available) return true;
  if (hasMeteredUsage(pixelAgent)) return false;
  const pct = pixelAgent.tokenUsage?.contextPercent;
  return pct != null && pixelAgent.source === 'grok-build';
}

/**
 * Adapt a single Pixel Agent Desk agent to Dashboard format
 * @param {Object} pixelAgent - Pixel Agent Desk agent object
 * @returns {Object} Dashboard formatted agent
 */
function adaptAgentToDashboard(pixelAgent, nameMap) {
  const hasUsage = hasMeteredUsage(pixelAgent);
  const hasContext = hasContextUsage(pixelAgent);

  return {
    id: pixelAgent.id || pixelAgent.sessionId,
    sessionId: pixelAgent.sessionId,
    name: resolveAgentDisplayName(pixelAgent),
    agentName: resolveAgentName(pixelAgent, nameMap),
    project: extractProjectName(pixelAgent.projectPath),
    projectLabel: resolveProjectLabel(pixelAgent),
    status: mapPixelStateToDashboardState(pixelAgent.state),
    type: determineAgentType(pixelAgent),
    model: pixelAgent.model || null,
    tokenUsage: pixelAgent.tokenUsage || { inputTokens: 0, outputTokens: 0, estimatedCost: 0 },
    contextUsage: pixelAgent.contextUsage || null,
    usageAvailable: hasUsage,
    contextAvailable: hasContext,
    currentTool: pixelAgent.currentTool || null,
    lastMessage: pixelAgent.lastMessage || null,
    avatarIndex: pixelAgent.avatarIndex !== undefined ? pixelAgent.avatarIndex : null,
    source: pixelAgent.source || null,
    sourceLabel: formatAgentSource(pixelAgent.source),
    statusBadge: formatAgentStatus(pixelAgent.state),
    activityText: formatAgentActivity(pixelAgent.state, pixelAgent.currentTool),
    publicActivityText: pixelAgent.publicActivityText || null,
    commandText: formatCommandText(pixelAgent),
    metadata: {
      isSubagent: pixelAgent.isSubagent || false,
      isTeammate: pixelAgent.isTeammate || false,
      projectPath: pixelAgent.projectPath || '',
      parentId: pixelAgent.parentId || null,
      permissionMode: pixelAgent.permissionMode || null,
      teammateName: pixelAgent.teammateName || null,
      teamName: pixelAgent.teamName || null,
      endReason: pixelAgent.endReason || null,
      source: safeStr(pixelAgent.source)
    },
    timing: {
      elapsed: calculateElapsedTime(pixelAgent),
      active: isAgentActive(pixelAgent.state)
    }
  };
}

module.exports = {
  adaptAgentToDashboard,
  mapPixelStateToDashboardState,
  extractProjectName,
  hasMeteredUsage,
  hasContextUsage,
  STATE_MAP,
  DEFAULT_STATE
};
