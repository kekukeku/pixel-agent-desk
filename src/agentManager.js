const EventEmitter = require('events');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { formatSlugToDisplayName } = require('./utils');
const { formatAgentSource, resolveAgentDisplayName } = require('./agentDisplayFormat');

const SINGLETON_SOURCE_LABELS = new Set(['grok-build', 'antigravity']);

function normalizeProjectPath(projectPath) {
  if (!projectPath) return '';
  return String(projectPath).replace(/[/\\]+$/, '');
}

function isLikelyGrokSessionId(agentId) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(agentId || '');
}

// Single source of truth: public/shared/avatars.json
const AVATAR_FILES = require('../public/shared/avatars.json');
const AVATAR_COUNT = AVATAR_FILES.length;

/**
 * Safely read and parse ~/.pixel-agent-desk/name-map.json
 * @returns {Record<string, string>}
 */
function getNameMap() {
  const mapPath = path.join(os.homedir(), '.pixel-agent-desk', 'name-map.json');
  try {
    if (fs.existsSync(mapPath)) {
      return JSON.parse(fs.readFileSync(mapPath, 'utf-8'));
    }
  } catch (e) {
    console.error('[AgentManager] Error reading name-map.json:', e.message);
  }
  return {};
}

/**
 * Merge a field: entry value wins if defined, then existing, then default.
 */
function mergeField(entry, existing, key, defaultVal = null) {
  if (entry[key] !== undefined) return entry[key];
  return existing ? existing[key] : defaultVal;
}

/**
 * Check if a state is considered "resting" (eligible for Playing transition)
 */
function isRestingState(state) {
  return state === 'Waiting' || state === 'Done';
}

class AgentManager extends EventEmitter {
  constructor() {
    super();
    this.agents = new Map();
    this._pendingEmit = new Map(); // agentId → { timer, state } — UI emit debounce
    this._usedAvatarIndices = new Set(); // Currently used avatar indices
    this.config = {
      softLimitWarning: 50,  // Soft warning (does not block, only logs)
      stateDebounceMs: 500,  // Working→Thinking transition debounce (ms)
      playingTransitionMs: 60_000,
      playingCheckIntervalMs: 5_000,
    };
  }

  start() {
    // Agent cleanup is handled exclusively by the main.js liveness checker (PID-based)
    if (typeof setInterval === 'function') {
      this._playingTimer = setInterval(
        () => this._checkPlayingStateTransitions(),
        this.config.playingCheckIntervalMs
      );
    }
    console.log('[AgentManager] Started');
  }

  stop() {
    if (this._playingTimer) {
      if (typeof clearInterval === 'function') {
        clearInterval(this._playingTimer);
      }
      this._playingTimer = null;
    }
    for (const pending of this._pendingEmit.values()) {
      clearTimeout(pending.timer);
    }
    this._pendingEmit.clear();
    this._usedAvatarIndices.clear();
    this.agents.clear();
    console.log('[AgentManager] Stopped');
  }

  /**
   * Update or add an agent
   */
  updateAgent(entry, source = 'log') {
    const agentId = entry.sessionId || entry.agentId || entry.uuid || 'unknown';
    const now = Date.now();
    const existingAgent = this.agents.get(agentId);

    // Soft warning: only warn if agent count is high (does not block registration)
    if (!existingAgent && this.agents.size >= this.config.softLimitWarning) {
      console.warn(`[AgentManager] ⚠ ${this.agents.size} agents active (soft limit: ${this.config.softLimitWarning}). Consider checking for stale sessions.`);
    }


    const prevState = existingAgent ? existingAgent.state : null;
    let newState = entry.state;
    if (!newState) newState = prevState || 'Done';

    let activeStartTime = existingAgent ? existingAgent.activeStartTime : now;
    let lastDuration = existingAgent ? existingAgent.lastDuration : 0;

    // When entering active state (Done/Error/Help/Waiting/Playing -> Working/Thinking)
    const isPassive = (s) => s === 'Done' || s === 'Help' || s === 'Error' || s === 'Waiting' || s === 'Playing';
    const isActive = (s) => s === 'Working' || s === 'Thinking';

    if (isActive(newState) && (isPassive(prevState) || !existingAgent)) {
      activeStartTime = now;
    }

    // When returning to Done, save the last elapsed duration
    if (newState === 'Done' && existingAgent && isActive(prevState)) {
      lastDuration = now - activeStartTime;
    }

    // Server-side Playing preservation: if agent is Playing and new event is resting, keep Playing
    if (existingAgent && existingAgent.state === 'Playing' && isRestingState(newState)) {
      newState = 'Playing';
    }

    const m = (key, defaultVal = null) => mergeField(entry, existingAgent, key, defaultVal);

    // restingStartTime tracking
    let restingStartTime = existingAgent ? existingAgent.restingStartTime : null;
    if (isRestingState(newState) && !isRestingState(prevState) && prevState !== 'Playing') {
      restingStartTime = now;
    } else if (restingStartTime != null && (isRestingState(newState) || newState === 'Playing')) {
      // preserve existing
    } else {
      restingStartTime = null;
    }

    const agentData = {
      id: agentId,
      sessionId: entry.sessionId,
      agentId: entry.agentId,
      slug: entry.slug,
      displayName: this.formatDisplayName(entry.slug, entry.projectPath, agentId, m('source'), entry.displayName),
      projectPath: entry.projectPath,
      jsonlPath: entry.jsonlPath || (existingAgent ? existingAgent.jsonlPath : null),
      model: m('model'),
      permissionMode: m('permissionMode'),
      source: m('source'),
      agentType: m('agentType'),
      currentTool: m('currentTool'),
      publicActivityText: m('publicActivityText'),
      lastMessage: m('lastMessage'),
      endReason: m('endReason'),
      teammateName: m('teammateName'),
      teamName: m('teamName'),
      tokenUsage: m('tokenUsage', { inputTokens: 0, outputTokens: 0, estimatedCost: 0 }),
      contextUsage: m('contextUsage', null),
      avatarIndex: existingAgent ? existingAgent.avatarIndex : this._assignAvatarIndex(agentId),
      isSubagent: entry.isSubagent || (existingAgent ? existingAgent.isSubagent : false),
      isTeammate: entry.isTeammate || (existingAgent ? existingAgent.isTeammate : false),
      parentId: entry.parentId || (existingAgent ? existingAgent.parentId : null),
      state: newState,
      activeStartTime,
      lastDuration,
      lastActivity: now,
      timestamp: entry.timestamp || now,
      firstSeen: existingAgent ? existingAgent.firstSeen : now,
      updateCount: existingAgent ? existingAgent.updateCount + 1 : 1,
      restingStartTime
    };

    this.agents.set(agentId, agentData);
    this._removeStaleDuplicates(agentData);

    // Refresh parent state when subagent state changes
    if (agentData.parentId) {
      this.reEvaluateParentState(agentData.parentId);
    }

    if (!existingAgent) {
      this._cancelPendingEmit(agentId);
      this.emit('agent-added', this.getAgentWithEffectiveState(agentId));
      console.log(`[AgentManager] Agent added: ${agentData.displayName} (${newState})`);
    } else if (newState !== prevState) {
      this._emitWithDebounce(agentId, prevState, newState, agentData.displayName);
    }

    return agentData;
  }

  /**
   * State transition debounce — delays Working→Thinking transitions by 500ms to prevent flickering
   * Thinking→Working (promotion) is applied immediately, canceling any pending emit
   */
  _emitWithDebounce(agentId, prevState, newState, displayName) {
    const isDowngrade = (prevState === 'Working' && newState === 'Thinking');

    if (isDowngrade) {
      // Working→Thinking: delayed emit (canceled if Working is re-entered within 500ms)
      this._cancelPendingEmit(agentId);
      const timer = setTimeout(() => {
        this._pendingEmit.delete(agentId);
        const current = this.agents.get(agentId);
        if (current && current.state === newState) {
          this.emit('agent-updated', this.getAgentWithEffectiveState(agentId));
        }
      }, this.config.stateDebounceMs);
      this._pendingEmit.set(agentId, { timer, state: newState });
    } else {
      // Immediate emit — cancel any pending emit
      this._cancelPendingEmit(agentId);
      this.emit('agent-updated', this.getAgentWithEffectiveState(agentId));
    }
  }

  _cancelPendingEmit(agentId) {
    const pending = this._pendingEmit.get(agentId);
    if (pending) {
      clearTimeout(pending.timer);
      this._pendingEmit.delete(agentId);
    }
  }

  /**
   * Remove older agents that represent the same logical session.
   * - Same source + display name + project path
   * - Grok Build / Antigravity default labels: one character per source
   * - Prefer real Grok UUID sessions over debug/test hook IDs
   */
  _removeStaleDuplicates(keeper) {
    const { id, source, projectPath } = keeper;
    if (!source) return;

    const resolvedKeeperName = resolveAgentDisplayName(keeper);
    const sourceLabel = formatAgentSource(source);
    const sourceWide = SINGLETON_SOURCE_LABELS.has(source)
      && resolvedKeeperName === sourceLabel;
    const keeperProject = normalizeProjectPath(projectPath);
    const keeperIsRealGrok = source === 'grok-build' && isLikelyGrokSessionId(id);

    for (const [otherId, agent] of Array.from(this.agents.entries())) {
      if (otherId === id) continue;
      if (agent.source !== source) continue;

      if (keeperIsRealGrok && !isLikelyGrokSessionId(otherId)) {
        this.removeAgent(otherId);
        continue;
      }

      if (source === 'grok-build' && isLikelyGrokSessionId(otherId) && !keeperIsRealGrok) {
        continue;
      }

      const resolvedOtherName = resolveAgentDisplayName(agent);
      if (resolvedOtherName !== resolvedKeeperName) continue;

      const sameScope = sourceWide
        || normalizeProjectPath(agent.projectPath) === keeperProject;

      if (!sameScope) continue;

      if (agent.lastActivity <= keeper.lastActivity) {
        this.removeAgent(otherId);
      }
    }
  }

  removeAgent(agentId) {
    const agent = this.agents.get(agentId);
    if (!agent) return false;
    this._cancelPendingEmit(agentId);
    this._releaseAvatarIndex(agent.avatarIndex);
    this.agents.delete(agentId);

    // Refresh parent state when subagent is removed
    if (agent.parentId) {
      this.reEvaluateParentState(agent.parentId);
    }

    this.emit('agent-removed', { id: agentId, displayName: agent.displayName });
    console.log(`[AgentManager] Removed: ${agent.displayName}`);
    return true;
  }

  getAllAgents() {
    return Array.from(this.agents.keys()).map(id => this.getAgentWithEffectiveState(id));
  }

  getAgentWithEffectiveState(agentId) {
    const agent = this.agents.get(agentId);
    if (!agent) return null;

    // Return as-is if already in Help or Error state (highest priority)
    if (agent.state === 'Help' || agent.state === 'Error') return agent;

    // Check children (subagent) states
    const children = Array.from(this.agents.values()).filter(a => a.parentId === agentId);

    // 1. If any child is Help/Error, show parent as Help (notify user intervention needed)
    const someChildNeedsHelp = children.some(c => c.state === 'Help' || c.state === 'Error');
    if (someChildNeedsHelp) {
      return { ...agent, state: 'Help', isAggregated: true };
    }

    // Return as-is if already in Working state
    if (agent.state === 'Working' || agent.state === 'Thinking') return agent;

    // 2. If any child is Working/Thinking, show parent as Working
    const someChildWorking = children.some(c => c.state === 'Working' || c.state === 'Thinking');
    if (someChildWorking) {
      return { ...agent, state: 'Working', isAggregated: true };
    }

    return agent;
  }

  reEvaluateParentState(parentId) {
    const parent = this.agents.get(parentId);
    if (!parent) return;
    // Force emit parent state update event so the renderer recognizes it as Working
    this.emit('agent-updated', this.getAgentWithEffectiveState(parentId));
  }
  getAgent(agentId) { return this.agents.get(agentId) || null; }
  getAgentCount() { return this.agents.size; }
  getAgentsByActivity() {
    return this.getAllAgents().sort((a, b) => b.lastActivity - a.lastActivity);
  }

  /**
   * Get name map mapping
   */
  getNameMap() {
    return getNameMap();
  }

  /**
   * Update or clear custom name for an agent
   */
  updateAgentName(agentId, name) {
    const mapPath = path.join(os.homedir(), '.pixel-agent-desk', 'name-map.json');
    const mapDir = path.dirname(mapPath);

    if (!fs.existsSync(mapDir)) {
      fs.mkdirSync(mapDir, { recursive: true });
    }

    let nameMap = {};
    try {
      if (fs.existsSync(mapPath)) {
        nameMap = JSON.parse(fs.readFileSync(mapPath, 'utf-8'));
      }
    } catch (e) {
      console.error('[AgentManager] Error reading name-map.json:', e.message);
    }

    const trimmedName = typeof name === 'string' ? name.trim() : '';
    if (trimmedName) {
      nameMap[agentId] = trimmedName;
    } else {
      delete nameMap[agentId];
    }

    const tempPath = mapPath + '.tmp';
    try {
      fs.writeFileSync(tempPath, JSON.stringify(nameMap, null, 2), 'utf-8');
      fs.renameSync(tempPath, mapPath);
    } catch (e) {
      console.error('[AgentManager] Error writing name-map.json atomically:', e.message);
      fs.writeFileSync(mapPath, JSON.stringify(nameMap, null, 2), 'utf-8');
    }

    const agent = this.agents.get(agentId);
    let activeAgentUpdated = false;
    if (agent) {
      agent.displayName = this.formatDisplayName(agent.slug, agent.projectPath, agentId, agent.source, null);
      this.emit('agent-updated', this.getAgentWithEffectiveState(agentId));
      activeAgentUpdated = true;
    }

    return {
      activeAgentUpdated,
      displayName: this.formatDisplayName(
        agent ? agent.slug : null,
        agent ? agent.projectPath : null,
        agentId,
        agent ? agent.source : null,
        null
      )
    };
  }

  /**
   * Determine display name — unified contract for all consumers.
   * 1. ~/.pixel-agent-desk/name-map.json (session_id -> name mapping)
   * 2. Known source label (via formatAgentSource)
   * 3. Fallback: "Spirit"
   *
   * Explicit exclusions: slug, project basename, session title, event displayName.
   */
  formatDisplayName(slug, projectPath, agentId, source, displayName) {
    if (agentId) {
      const nameMap = getNameMap();
      if (nameMap[agentId]) {
        return nameMap[agentId];
      }
    }
    if (source) {
      const mapped = formatAgentSource(source);
      if (mapped && mapped !== 'Unknown Agent') {
        return mapped;
      }
    }
    return 'Spirit';
  }

  /**
   * Assign avatar index — prioritize unused avatars on hash collision
   */
  _assignAvatarIndex(agentId) {
    let hash = 0;
    const str = agentId || '';
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    const hashIdx = Math.abs(hash) % AVATAR_COUNT;

    if (!this._usedAvatarIndices.has(hashIdx)) {
      this._usedAvatarIndices.add(hashIdx);
      return hashIdx;
    }

    // Hash collision: iterate through unused avatars
    for (let i = 0; i < AVATAR_COUNT; i++) {
      if (!this._usedAvatarIndices.has(i)) {
        this._usedAvatarIndices.add(i);
        return i;
      }
    }

    // All avatars in use, fall back to hash index
    return hashIdx;
  }

  /**
   * Release avatar index
   */
  _releaseAvatarIndex(avatarIndex) {
    if (avatarIndex !== undefined && avatarIndex !== null) {
      this._usedAvatarIndices.delete(avatarIndex);
    }
  }

  _checkPlayingStateTransitions() {
    const now = Date.now();
    for (const [agentId, agent] of this.agents) {
      if (!isRestingState(agent.state)) continue;
      if (!agent.restingStartTime) continue;
      if (now - agent.restingStartTime < this.config.playingTransitionMs) continue;

      agent.state = 'Playing';
      agent.restingStartTime = null;
      agent.lastActivity = now;

      this._cancelPendingEmit(agentId);
      this.emit('agent-updated', this.getAgentWithEffectiveState(agentId));
    }
  }

  getStats() {
    const agents = this.getAllAgents();
    const counts = { Done: 0, Thinking: 0, Working: 0, Waiting: 0, Help: 0, Error: 0, Playing: 0 };
    for (const agent of agents) {
      if (counts.hasOwnProperty(agent.state)) {
        counts[agent.state]++;
      }
    }
    return {
      total: agents.length,
      byState: counts
    };
  }
}

module.exports = AgentManager;
