/**
 * Grok Observer Adapter
 * Pure helpers for resolving Grok session dirs and mapping signals.json → context events.
 */

'use strict';

const fs = require('fs');
const path = require('path');

function normalizeCwd(cwd) {
  if (!cwd) return '';
  return String(cwd).replace(/\\/g, '/').replace(/\/+$/, '');
}

function encodeCwd(cwd) {
  return encodeURIComponent(normalizeCwd(cwd));
}

function safeParse(jsonString) {
  try {
    return JSON.parse(jsonString);
  } catch (e) {
    return null;
  }
}

function parseActiveSessions(jsonString) {
  const parsed = safeParse(jsonString);
  if (!Array.isArray(parsed)) return [];

  return parsed
    .map(function (entry) {
      const sessionId = entry.session_id || entry.sessionId;
      if (!sessionId) return null;
      return {
        sessionId: String(sessionId),
        cwd: normalizeCwd(entry.cwd || entry.workspace_root || entry.workspaceRoot || ''),
        pid: entry.pid || null,
        openedAt: entry.opened_at || entry.openedAt || null,
      };
    })
    .filter(Boolean);
}

function parseSignals(jsonString) {
  const parsed = safeParse(jsonString);
  if (!parsed || typeof parsed !== 'object') return null;

  const tokensUsed = parsed.contextTokensUsed;
  const windowTokens = parsed.contextWindowTokens;
  const percent = parsed.contextWindowUsage;

  if (tokensUsed == null && windowTokens == null && percent == null) {
    return null;
  }

  return {
    kind: 'snapshot',
    tokens_used: Number(tokensUsed) || 0,
    window_tokens: Number(windowTokens) || 0,
    percent: percent != null ? Number(percent) : 0,
    total_before_compaction: Number(parsed.totalTokensBeforeCompaction) || 0,
    primaryModelId: parsed.primaryModelId || null,
  };
}

function parseSummary(jsonString) {
  const parsed = safeParse(jsonString);
  if (!parsed || typeof parsed !== 'object') return null;
  return parsed.current_model_id || parsed.currentModelId || null;
}

function readCwdFromGroupFile(groupDir) {
  try {
    const cwdFile = path.join(groupDir, '.cwd');
    if (!fs.existsSync(cwdFile)) return null;
    const content = fs.readFileSync(cwdFile, 'utf-8').trim();
    return normalizeCwd(content) || null;
  } catch (e) {
    return null;
  }
}

function findSessionDirById(sessionsRoot, sessionId, maxDepth) {
  const limit = maxDepth == null ? 4 : maxDepth;
  if (!sessionsRoot || !sessionId || !fs.existsSync(sessionsRoot)) return null;

  const stack = [{ dir: sessionsRoot, depth: 0 }];

  while (stack.length > 0) {
    const item = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(item.dir, { withFileTypes: true });
    } catch (e) {
      continue;
    }

    for (const ent of entries) {
      if (!ent.isDirectory()) continue;
      const full = path.join(item.dir, ent.name);
      if (ent.name === sessionId) return full;
      if (item.depth < limit) {
        stack.push({ dir: full, depth: item.depth + 1 });
      }
    }
  }

  return null;
}

function resolveSessionDir(grokHome, sessionId, cwd, cache) {
  if (!grokHome || !sessionId) return null;

  const sessionsRoot = path.join(grokHome, 'sessions');
  const cacheKey = sessionId;

  if (cache && cache.has(cacheKey)) {
    const cached = cache.get(cacheKey);
    if (cached && fs.existsSync(path.join(cached, 'signals.json'))) {
      return cached;
    }
    cache.delete(cacheKey);
  }

  let sessionDir = null;

  const normalizedCwd = normalizeCwd(cwd);
  if (normalizedCwd) {
    const encodedDir = path.join(sessionsRoot, encodeCwd(normalizedCwd), sessionId);
    if (fs.existsSync(path.join(encodedDir, 'signals.json'))) {
      sessionDir = encodedDir;
    }
  }

  if (!sessionDir) {
    sessionDir = findSessionDirById(sessionsRoot, sessionId);
  }

  if (!sessionDir && normalizedCwd && fs.existsSync(sessionsRoot)) {
    let groups;
    try {
      groups = fs.readdirSync(sessionsRoot, { withFileTypes: true });
    } catch (e) {
      groups = [];
    }
    for (const group of groups) {
      if (!group.isDirectory()) continue;
      const groupDir = path.join(sessionsRoot, group.name);
      const groupCwd = readCwdFromGroupFile(groupDir);
      if (groupCwd && groupCwd === normalizedCwd) {
        const candidate = path.join(groupDir, sessionId);
        if (fs.existsSync(path.join(candidate, 'signals.json'))) {
          sessionDir = candidate;
          break;
        }
      }
    }
  }

  if (sessionDir && cache) {
    cache.set(cacheKey, sessionDir);
  }

  return sessionDir;
}

function mapSignalsToContextEvent(sessionId, signals, options) {
  const opts = options || {};
  if (!sessionId || !signals || signals.kind !== 'snapshot') return null;

  const model = signals.primaryModelId || opts.model || null;

  return {
    event: 'agent.thinking',
    agent_id: sessionId,
    source: 'grok-build',
    project_path: opts.projectPath || '',
    model: model,
    timestamp: Date.now(),
    context_usage: {
      kind: 'snapshot',
      tokens_used: signals.tokens_used,
      window_tokens: signals.window_tokens,
      percent: signals.percent,
      total_before_compaction: signals.total_before_compaction,
    },
    metadata: {
      context_only: true,
    },
  };
}

function contextSnapshotChanged(prev, next) {
  if (!prev) return true;
  return prev.percent !== next.percent
    || prev.tokens_used !== next.tokens_used
    || prev.window_tokens !== next.window_tokens
    || prev.total_before_compaction !== next.total_before_compaction
    || prev.primaryModelId !== next.primaryModelId;
}

module.exports = {
  normalizeCwd,
  encodeCwd,
  parseActiveSessions,
  parseSignals,
  parseSummary,
  resolveSessionDir,
  findSessionDirById,
  mapSignalsToContextEvent,
  contextSnapshotChanged,
};