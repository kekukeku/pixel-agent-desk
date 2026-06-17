/**
 * Dashboard Web Server
 * Enhanced with REST API and WebSocket for real-time updates
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { URL } = require('url');
const { adaptAgentToDashboard } = require('./dashboardAdapter');

const PORT = 3000;
const HTML_FILE = path.join(__dirname, '..', 'dashboard.html');

// MIME type mapping
const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
};

// Global references
let agentManager = null;
let sessionScanner = null;
let heatmapScanner = null;
let missionControlWindow = null;
const wsClients = new Set();
const sseClients = new Set();

/**
 * Set the agent manager reference
 */
function setAgentManager(manager) {
  agentManager = manager;

  if (agentManager) {
    agentManager.on('agent-added', (agent) => {
      const adapted = adaptAgentToDashboard(agent);
      broadcastSSE('agent.created', adapted);
      broadcastUpdate('agent-added', adapted);
    });
    agentManager.on('agent-updated', (agent) => {
      const adapted = adaptAgentToDashboard(agent);
      broadcastSSE('agent.updated', adapted);
      broadcastUpdate('agent-updated', adapted);
    });
    agentManager.on('agent-removed', (data) => {
      broadcastSSE('agent.removed', data);
      broadcastUpdate('agent-removed', data);
    });
  }
}

/**
 * Set the session scanner reference
 */
function setSessionScanner(scanner) {
  sessionScanner = scanner;
}

/**
 * Set the heatmap scanner reference
 */
function setHeatmapScanner(scanner) {
  heatmapScanner = scanner;
}

/**
 * Set the Dashboard window reference
 */
function setDashboardWindow(window) {
  missionControlWindow = window;
}

/**
 * Calculate statistics from agents
 */
function calculateStats() {
  if (!agentManager) {
    return { total: 0, active: 0, completed: 0, byState: {} };
  }

  const agents = agentManager.getAllAgents();
  const stats = {
    total: agents.length,
    active: 0,
    completed: 0,
    working: 0,
    thinking: 0,
    waiting: 0,
    help: 0,
    error: 0,
    done: 0,
    offline: 0,
    byProject: {},
    byType: {
      main: 0,
      subagent: 0,
      teammate: 0
    }
  };

  for (const agent of agents) {
    // State counts
    const state = agent.state.toLowerCase();
    if (stats[state] !== undefined) {
      stats[state]++;
    }

    // Active/Completed counts
    if (agent.state === 'Working' || agent.state === 'Thinking') {
      stats.active++;
    } else if (agent.state === 'Done') {
      stats.completed++;
    } else if (agent.state === 'Help') {
      stats.active++;
    }

    // Project grouping
    const project = agent.projectPath ? path.basename(agent.projectPath) : 'Default';
    if (!stats.byProject[project]) {
      stats.byProject[project] = { total: 0, active: 0, completed: 0 };
    }
    stats.byProject[project].total++;
    if (agent.state === 'Working' || agent.state === 'Thinking' || agent.state === 'Help') {
      stats.byProject[project].active++;
    }
    if (agent.state === 'Done') {
      stats.byProject[project].completed++;
    }

    // Type counts
    if (agent.isSubagent) {
      stats.byType.subagent++;
    } else if (agent.isTeammate) {
      stats.byType.teammate++;
    } else {
      stats.byType.main++;
    }
  }

  // Token/cost aggregation
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalEstimatedCost = 0;
  for (const agent of agents) {
    const usage = agent.tokenUsage;
    if (usage) {
      totalInputTokens += usage.inputTokens || 0;
      totalOutputTokens += usage.outputTokens || 0;
      totalEstimatedCost += usage.estimatedCost || 0;
    }
  }
  stats.tokens = {
    input: totalInputTokens,
    output: totalOutputTokens,
    total: totalInputTokens + totalOutputTokens,
    estimatedCost: Math.round(totalEstimatedCost * 10000) / 10000
  };

  return stats;
}

/**
 * SSE broadcast
 */
function broadcastSSE(type, data) {
  const payload = `event: ${type}\ndata: ${JSON.stringify({ type, data, timestamp: Date.now() })}\n\n`;
  for (const res of sseClients) {
    try { res.write(payload); } catch { sseClients.delete(res); }
  }
}

/**
 * Broadcast update to all WebSocket clients
 */
function broadcastUpdate(type, data) {
  const message = JSON.stringify({ type, data, timestamp: Date.now() });

  wsClients.forEach(client => {
    if (client.readyState === 1) { // WebSocket.OPEN
      try {
        client.send(message);
      } catch (error) {
        console.error('[Dashboard] Error sending to client:', error.message);
      }
    }
  });
}

/**
 * Handle HTTP request
 */
function handleRequest(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  // API routes
  if (pathname.startsWith('/api/')) {
    handleAPIRequest(req, res, url);
    return;
  }

  // WebSocket upgrade
  if (pathname === '/ws') {
    // This will be handled by the WebSocket server
    res.writeHead(426); // Upgrade Required
    res.end('WebSocket connection required');
    return;
  }

  // Static files
  if (pathname === '/' || pathname === '/index.html') {
    fs.readFile(HTML_FILE, (err, data) => {
      if (err) {
        console.error('[Dashboard Server] Error reading HTML:', err);
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Internal Server Error');
        return;
      }

      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(data);
    });
    return;
  }

  // PiP page
  if (pathname === '/pip') {
    const pipFile = path.join(__dirname, '..', 'pip.html');
    fs.readFile(pipFile, (err, data) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Internal Server Error');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(data);
    });
    return;
  }

  // Static file serving: /public/* and /src/office/*
  if (pathname.startsWith('/public/') || pathname.startsWith('/src/office/')) {
    const baseDir = path.resolve(__dirname, '..');
    const decoded = decodeURIComponent(pathname);
    const resolved = path.resolve(baseDir, decoded.slice(1)); // Remove leading '/' from pathname

    // Prevent path traversal: block if resolved path is outside baseDir
    const rel = path.relative(baseDir, resolved);
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      res.end('Forbidden');
      return;
    }

    const ext = path.extname(resolved);
    const mime = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(resolved, (err, data) => {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
        return;
      }
      res.writeHead(200, {
        'Content-Type': mime,
        'Cache-Control': 'public, max-age=3600'
      });
      res.end(data);
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
}

// ─── API Route Handlers ───

function handleSSE(req, res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });
  res.write(`event: connected\ndata: ${JSON.stringify({ type: 'connected', timestamp: Date.now() })}\n\n`);
  sseClients.add(res);

  const keepAlive = setInterval(() => res.write(': keepalive\n\n'), 15000);
  req.on('close', () => {
    clearInterval(keepAlive);
    sseClients.delete(res);
  });
}

function handleGetAgents(req, res) {
  if (!agentManager) {
    res.writeHead(503, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Agent manager not available' }));
    return;
  }
  const agents = agentManager.getAllAgents().map(adaptAgentToDashboard);
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(agents));
}

function handleGetAgentById(req, res, url) {
  if (!agentManager) {
    res.writeHead(503, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Agent manager not available' }));
    return;
  }
  const agentId = url.pathname.split('/').pop();
  const agent = agentManager.getAgent(agentId);
  if (!agent) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Agent not found' }));
    return;
  }
  const sessionStats = sessionScanner ? sessionScanner.getSessionStats(agentId) : null;
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ...agent, sessionStats }));
}

function handleGetStats(req, res) {
  const stats = calculateStats();
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(stats));
}

function handleGetSessions(req, res) {
  const allStats = sessionScanner ? sessionScanner.getAllStats() : {};
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(allStats));
}

function handleGetHeatmap(req, res, url) {
  if (!heatmapScanner) {
    res.writeHead(503, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Heatmap scanner not available' }));
    return;
  }
  const days = parseInt(url.searchParams.get('days') || '365', 10);
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - days);
  const startStr = startDate.toISOString().slice(0, 10);
  const endStr = endDate.toISOString().slice(0, 10);
  const range = heatmapScanner.getRange(startStr, endStr);
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ days: range, lastScan: heatmapScanner.lastScan }));
}

function handleGetHealth(req, res) {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    status: 'ok',
    timestamp: Date.now(),
    agents: agentManager ? agentManager.getAgentCount() : 0,
    sseClients: sseClients.size,
    wsClients: wsClients.size
  }));
}

/**
 * Resolve the local operating system username.
 */
function resolveUsername() {
  try {
    const userInfo = os.userInfo();
    if (userInfo && userInfo.username) {
      return userInfo.username;
    }
  } catch (err) {
    // Ignore error
  }
  return process.env.USER || process.env.USERNAME || process.env.User || 'User';
}

function handleGetProfile(req, res) {
  const username = resolveUsername();
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ username }));
}

function isLocalRequest(req) {
  const ip = req.socket ? req.socket.remoteAddress : '127.0.0.1';
  return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
}

function parseRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(body || '{}'));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', (err) => {
      reject(err);
    });
  });
}

function handleGetNameMap(req, res) {
  if (!isLocalRequest(req)) {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Forbidden: API only accepts local requests' }));
    return;
  }

  if (!agentManager) {
    res.writeHead(503, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Agent manager not available' }));
    return;
  }

  const nameMap = agentManager.getNameMap();
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(nameMap));
}

function handlePutAgentName(req, res, url) {
  if (!isLocalRequest(req)) {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Forbidden: API only accepts local requests' }));
    return;
  }

  if (!agentManager) {
    res.writeHead(503, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Agent manager not available' }));
    return;
  }

  const parts = url.pathname.split('/');
  const agentId = parts[3]; // /api/agents/:id/name
  if (!agentId || agentId.trim() === '') {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'agentId must be a non-empty string' }));
    return;
  }

  parseRequestBody(req)
    .then((body) => {
      const name = body.name;
      if (typeof name !== 'string') {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'name must be a string' }));
        return;
      }

      const trimmedName = name.trim();
      if (trimmedName.length > 40) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'name must not exceed 40 characters' }));
        return;
      }

      const result = agentManager.updateAgentName(agentId, trimmedName);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        agentId,
        displayName: result.displayName,
        activeAgentUpdated: result.activeAgentUpdated
      }));
    })
    .catch((err) => {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid JSON body' }));
    });
}

const planningDir = path.resolve(__dirname, '..', 'PLANNING');

function isDevMode(url) {
  const fixturesQuery = url ? url.searchParams.get('fixtures') : null;
  return fixturesQuery === 'true' || 
         process.env.NODE_ENV === 'development' || 
         process.env.DEV_MODE === 'true';
}

function getSessions(includeFixtures = false) {
  const sessions = [];
  
  if (fs.existsSync(planningDir)) {
    try {
      const files = fs.readdirSync(planningDir);
      for (const file of files) {
        if (file.startsWith('groupchat_') && file.endsWith('.json')) {
          const match = file.match(/^groupchat_(\d+)\.json$/);
          if (match) {
            const sessionId = match[1];
            try {
              const content = fs.readFileSync(path.join(planningDir, file), 'utf8');
              const data = JSON.parse(content);
              if (data.schemaVersion === 1) {
                sessions.push({
                  sessionId,
                  title: data.title || `Session ${sessionId}`,
                  startedAt: data.startedAt,
                  finishedAt: data.finishedAt,
                  taskNum: data.taskNum || 'N/A',
                  messageCount: data.messages ? data.messages.length : 0
                });
              }
            } catch (e) {
              // ignore malformed
            }
          }
        }
      }
    } catch (e) {
      // ignore read error
    }
  }

  if (includeFixtures) {
    const fixturesDir = path.join(planningDir, 'fixtures');
    if (fs.existsSync(fixturesDir)) {
      try {
        const files = fs.readdirSync(fixturesDir);
        for (const file of files) {
          if (file.startsWith('groupchat_') && file.endsWith('.json')) {
            const match = file.match(/^groupchat_(\d+)\.json$/);
            if (match) {
              const sessionId = match[1];
              try {
                const content = fs.readFileSync(path.join(fixturesDir, file), 'utf8');
                const data = JSON.parse(content);
                if (data.schemaVersion === 1) {
                  sessions.push({
                    sessionId,
                    title: data.title || `Session ${sessionId}`,
                    startedAt: data.startedAt,
                    finishedAt: data.finishedAt,
                    taskNum: data.taskNum || 'N/A',
                    messageCount: data.messages ? data.messages.length : 0
                  });
                }
              } catch (e) {
                // ignore malformed
              }
            }
          }
        }
      } catch (e) {
        // ignore read error
      }
    }
  }

  // Sort: newest first
  sessions.sort((a, b) => {
    const timeA = a.startedAt ? new Date(a.startedAt).getTime() : 0;
    const timeB = b.startedAt ? new Date(b.startedAt).getTime() : 0;
    if (timeB !== timeA) return timeB - timeA;
    return parseInt(b.sessionId, 10) - parseInt(a.sessionId, 10);
  });

  return sessions;
}

function validateSessionIdAndGetPath(id, ext = '.json') {
  if (!/^\d+$/.test(id)) {
    return { error: 'Invalid session ID', code: 400 };
  }

  const filename = `groupchat_${id}${ext}`;
  
  // Try main PLANNING directory
  const resolvedPath = path.resolve(planningDir, filename);
  const rel = path.relative(planningDir, resolvedPath);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    return { error: 'Forbidden', code: 400 };
  }

  if (fs.existsSync(resolvedPath)) {
    return { path: resolvedPath };
  }

  // Try fixtures directory
  const fixturesDir = path.join(planningDir, 'fixtures');
  const resolvedFixturePath = path.resolve(fixturesDir, filename);
  const relFixture = path.relative(fixturesDir, resolvedFixturePath);
  if (relFixture.startsWith('..') || path.isAbsolute(relFixture)) {
    return { error: 'Forbidden', code: 400 };
  }

  if (fs.existsSync(resolvedFixturePath)) {
    return { path: resolvedFixturePath, isFixture: true };
  }

  return { error: 'Session not found', code: 404 };
}

function handleGetPlanningSessions(req, res, url) {
  const includeFixtures = isDevMode(url);
  const sessions = getSessions(includeFixtures);
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(sessions));
}

function handleGetPlanningSessionById(req, res, url) {
  const parts = url.pathname.split('/');
  const id = parts[4];

  if (!id) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Missing session ID' }));
    return;
  }

  if (parts.length > 5 && !(parts.length === 6 && parts[5] === '')) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Invalid session ID' }));
    return;
  }

  const validation = validateSessionIdAndGetPath(id, '.json');
  if (validation.error) {
    res.writeHead(validation.code, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: validation.error }));
    return;
  }

  if (validation.isFixture && !isDevMode(url)) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Session not found' }));
    return;
  }

  try {
    const content = fs.readFileSync(validation.path, 'utf8');
    const data = JSON.parse(content);
    if (data.schemaVersion !== 1) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unsupported schema version' }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Failed to read session file' }));
  }
}

function handleGetPlanningSessionMarkdown(req, res, url) {
  const parts = url.pathname.split('/');
  const id = parts[4];

  if (!id) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Missing session ID' }));
    return;
  }

  if (parts.length > 6 && !(parts.length === 7 && parts[6] === '')) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Invalid session ID' }));
    return;
  }

  const validation = validateSessionIdAndGetPath(id, '.md');
  if (validation.error) {
    res.writeHead(validation.code, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: validation.error }));
    return;
  }

  if (validation.isFixture && !isDevMode(url)) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Session not found' }));
    return;
  }

  try {
    const content = fs.readFileSync(validation.path, 'utf8');
    res.writeHead(200, { 'Content-Type': 'text/markdown; charset=utf-8' });
    res.end(content);
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Failed to read markdown file' }));
  }
}

/** Route table: "METHOD /path" → handler */
const apiRoutes = {
  'GET /api/events': handleSSE,
  'GET /api/agents': handleGetAgents,
  'GET /api/stats': handleGetStats,
  'GET /api/sessions': handleGetSessions,
  'GET /api/heatmap': handleGetHeatmap,
  'GET /api/health': handleGetHealth,
  'GET /api/profile': handleGetProfile,
  'GET /api/name-map': handleGetNameMap,
  'GET /api/planning/sessions': handleGetPlanningSessions,
};

/**
 * Handle API requests
 */
function handleAPIRequest(req, res, url) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Check for path traversal in planning API requests
  if (req.url.includes('/api/planning/') && (req.url.includes('..') || req.url.includes('%2e') || req.url.includes('%2E'))) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Invalid session ID' }));
    return;
  }

  // Parameterized: GET /api/planning/sessions/:id/md
  if (url.pathname.startsWith('/api/planning/sessions/') && url.pathname.endsWith('/md') && req.method === 'GET') {
    handleGetPlanningSessionMarkdown(req, res, url);
    return;
  }

  // Parameterized: GET /api/planning/sessions/:id
  if (url.pathname.startsWith('/api/planning/sessions/') && req.method === 'GET') {
    handleGetPlanningSessionById(req, res, url);
    return;
  }

  // Exact route match
  const routeKey = `${req.method} ${url.pathname}`;
  const handler = apiRoutes[routeKey];
  if (handler) {
    handler(req, res, url);
    return;
  }

  // Parameterized: GET /api/agents/:id
  if (url.pathname.startsWith('/api/agents/') && req.method === 'GET') {
    handleGetAgentById(req, res, url);
    return;
  }

  // Parameterized: PUT /api/agents/:id/name
  if (url.pathname.startsWith('/api/agents/') && url.pathname.endsWith('/name') && req.method === 'PUT') {
    handlePutAgentName(req, res, url);
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'API endpoint not found' }));
}

// Create HTTP server
const server = http.createServer(handleRequest);

// WebSocket server implementation (simple)
server.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === '/ws') {
    // Simple WebSocket handshake
    const key = req.headers['sec-websocket-key'];
    const acceptKey = require('crypto')
      .createHash('sha1')
      .update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11')
      .digest('base64');

    socket.write(
      'HTTP/1.1 101 Switching Protocols\r\n' +
      'Upgrade: websocket\r\n' +
      'Connection: Upgrade\r\n' +
      `Sec-WebSocket-Accept: ${acceptKey}\r\n` +
      '\r\n'
    );

    // Create simple WebSocket client wrapper
    const client = {
      socket,
      readyState: 1, // OPEN
      send: (data) => {
        // Simple WebSocket frame encoding
        const frame = [];
        frame.push(0x81); // FIN + Text frame

        const dataBytes = Buffer.from(data);
        const len = dataBytes.length;

        if (len < 126) {
          frame.push(len);
        } else if (len < 65536) {
          frame.push(126, (len >> 8) & 0xff, len & 0xff);
        } else {
          frame.push(127,
            0, 0, 0, 0,  // high 32 bits (JS safe integer range)
            (len >> 24) & 0xff, (len >> 16) & 0xff, (len >> 8) & 0xff, len & 0xff);
        }

        // Server-to-client frames MUST NOT be masked (RFC 6455 Section 5.1)
        socket.write(Buffer.concat([Buffer.from(frame), dataBytes]));
      },
      close: () => {
        socket.end();
      }
    };

    wsClients.add(client);

    // Send initial data
    if (agentManager) {
      const agents = agentManager.getAllAgents();
      client.send(JSON.stringify({
        type: 'initial',
        data: agents,
        timestamp: Date.now()
      }));
    }

    socket.on('close', () => {
      wsClients.delete(client);
    });

    socket.on('error', (err) => {
      console.error('[Dashboard] WebSocket error:', err.message);
      wsClients.delete(client);
    });
  } else {
    socket.destroy();
  }
});

/**
 * Start the server
 */
function startServer() {
  server.listen(PORT, () => {
    // Server started silently — debugLog handles startup logging
  });

  // Error handling
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`[Dashboard Server] ❌ Port ${PORT} already in use!`);
      console.error('[Dashboard Server] 💡 Another server is already running on this port.');
    } else {
      console.error('[Dashboard Server] ❌ Server error:', err);
    }
  });

  return server;
}

// Graceful shutdown
process.on('SIGINT', () => {
  wsClients.forEach(client => {
    try {
      client.close();
    } catch (e) {
      // Ignore errors during shutdown
    }
  });
  wsClients.clear();

  server.close(() => {
    process.exit(0);
  });
});

// Export functions for use in main.js
module.exports = {
  setAgentManager,
  setSessionScanner,
  setHeatmapScanner,
  setDashboardWindow,
  broadcastUpdate,
  broadcastSSE,
  calculateStats,
  startServer,
  PORT
};

// If this file is run directly (not required), start the server
if (require.main === module) {
  startServer();
}
