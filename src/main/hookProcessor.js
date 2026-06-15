/**
 * Hook Event Processor (Legacy Glue)
 * Maps legacy Claude hooks to normalized events and handles Claude-specific logic
 */

'use strict';

const { mapClaudeHookToAgentEvent } = require('./adapters/claudeHookAdapter');
const processor = require('./agentEventProcessor');

const firstPreToolUseDone = new Map();

function createHookProcessor({ agentManager, sessionPids, debugLog, detectClaudePidByTranscript }) {
  // Initialize the core event processor with system dependencies
  processor.init({ agentManager, sessionPids, debugLog, detectClaudePidByTranscript });

  function processHookEvent(data) {
    const event = data.hook_event_name;
    const sessionId = data.session_id || data.sessionId;
    if (!sessionId) return;

    // Claude-specific PreToolUse first-event ignore logic
    if (event === 'PreToolUse') {
      if (!firstPreToolUseDone.has(sessionId)) {
        firstPreToolUseDone.set(sessionId, true);
        debugLog(`[Hook] PreToolUse ignored (first = session init)`);
        return;
      }
    }

    // Ignore PostToolUse if first PreToolUse wasn't processed yet
    if (event === 'PostToolUse' && !firstPreToolUseDone.has(sessionId)) {
      debugLog(`[Hook] PostToolUse ignored (PreToolUse not yet seen)`);
      return;
    }

    // Reset firstPreToolUseDone on UserPromptSubmit, Stop, TaskCompleted or SessionEnd
    if (event === 'UserPromptSubmit' || event === 'Stop' || event === 'TaskCompleted' || event === 'SessionEnd') {
      firstPreToolUseDone.delete(sessionId);
    }

    // legacy PID reconnect: echo $$ or echo $PPID triggers transcript-based PID detection
    if (event === 'PostToolUse') {
      if (data.tool_name === 'Bash' && data.tool_input &&
          /echo\s+\$(\$|PPID)/.test((data.tool_input.command || ''))) {
        const agent = agentManager && agentManager.getAgent(sessionId);
        const jsonlPath = (agent && agent.jsonlPath) || data.transcript_path || null;
        debugLog(`[Hook] PID reconnect trigger: ${sessionId.slice(0, 8)} (echo detected)`);
        
        // Reset firstSeen to prevent premature removal while re-detecting
        if (agent && !sessionPids.has(sessionId)) {
          agentManager.updateAgent({ ...agent, firstSeen: Date.now() }, 'hook');
        }
        detectClaudePidByTranscript(jsonlPath, (result) => {
          if (!result) return;
          if (typeof result === 'number') {
            sessionPids.set(sessionId, result);
            debugLog(`[Hook] PID reconnected: ${sessionId.slice(0, 8)} → pid=${result}`);
          } else if (Array.isArray(result)) {
            const registeredPids = new Set(sessionPids.values());
            const newPid = result.find(p => !registeredPids.has(p));
            if (newPid) {
              sessionPids.set(sessionId, newPid);
              debugLog(`[Hook] PID reconnected (fallback): ${sessionId.slice(0, 8)} → pid=${newPid}`);
            }
          }
        });
      }
    }

    // legacy SubagentStop pre-cleanup: update subagent state to Done with lastMessage before removing
    if (event === 'SubagentStop' && data.last_assistant_message) {
      const subId = data.agent_id || data.subagent_session_id;
      if (subId && agentManager) {
        const subAgent = agentManager.getAgent(subId);
        if (subAgent) {
          agentManager.updateAgent({
            ...subAgent,
            lastMessage: data.last_assistant_message,
            state: 'Done'
          }, 'hook');
        }
      }
    }

    // Map legacy payload to normalized event
    const normalized = mapClaudeHookToAgentEvent(data);
    if (normalized) {
      // Session start events use 'http' channel if the agent doesn't exist, others use 'hook'
      const existing = agentManager && agentManager.getAgent(normalized.agent_id);
      const channel = (normalized.event === 'agent.started' && !existing) ? 'http' : 'hook';

      // For legacy SessionEnd, print debug logs matching test expectations
      if (event === 'SessionEnd') {
        const reason = data.reason || 'unknown';
        const agent = agentManager && agentManager.getAgent(sessionId);
        if (agent) {
          debugLog(`[Hook] SessionEnd → removing agent ${sessionId.slice(0, 8)} reason=${reason}`);
        } else {
          debugLog(`[Hook] SessionEnd for unknown agent ${sessionId.slice(0, 8)}`);
        }
      }

      // For legacy TaskCompleted / Stop, print debug logs matching test expectations
      if ((event === 'TaskCompleted' || event === 'Stop') && data.task_id) {
        debugLog(`[Hook] TaskCompleted: ${data.task_id} subject=${data.task_subject || ''}`);
      }

      processor.processAgentEvent(normalized, channel);
    } else {
      if (['ConfigChange', 'WorktreeCreate', 'WorktreeRemove'].includes(event)) {
        debugLog(`[Hook] Meta info: ${event} session=${sessionId}`);
      } else {
        debugLog(`[Hook] Unknown event: ${event} session=${sessionId}`);
      }
    }
  }

  function flushPendingStarts() {
    processor.flushPendingStarts();
  }

  function cleanup() {
    processor.cleanup();
    firstPreToolUseDone.clear();
  }

  return {
    processHookEvent,
    processAgentEvent: processor.processAgentEvent,
    flushPendingStarts,
    cleanup,
    get firstPreToolUseDone() { return firstPreToolUseDone; }
  };
}

module.exports = { createHookProcessor };
