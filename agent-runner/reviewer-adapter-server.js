const http = require('http');
const path = require('path');
const { spawn } = require('child_process');
const { writeReviewJobStatus } = require('./review-engine');

const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_PORT = 47822;

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch (error) {
        reject(new Error(`Invalid JSON body: ${error.message}`));
      }
    });
    req.on('error', reject);
  });
}

function tokenMatches(req, expectedToken) {
  if (!expectedToken) return true;
  const header = req.headers.authorization || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  return Boolean(match && match[1] === expectedToken);
}

function validatePayload(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Payload must be a JSON object');
  }
  if (payload.event !== 'review.requested') {
    throw new Error(`Unsupported event "${payload.event}". Expected "review.requested".`);
  }
  if (!payload.taskNum) {
    throw new Error('Payload missing taskNum');
  }
  if (!payload.expectedReviewPath) {
    throw new Error('Payload missing expectedReviewPath');
  }
}

function spawnBackgroundReview({ rootDir, payload, env }) {
  const taskNum = payload.taskNum;
  const payloadPath = path.join(rootDir, 'REVIEWS', `reviewer_payload_${taskNum}.json`);

  writeReviewJobStatus({
    rootDir,
    taskNum,
    status: 'queued',
    details: {
      expectedReviewPath: payload.expectedReviewPath,
      payloadPath
    }
  });

  const workerPath = path.join(__dirname, 'run-local-review.js');
  const child = spawn(
    process.execPath,
    [workerPath, '--project-root', rootDir, '--payload-path', payloadPath],
    {
      cwd: rootDir,
      detached: true,
      stdio: 'ignore',
      env: { ...process.env, ...env }
    }
  );

  child.unref();
  return child.pid;
}

function sendJson(res, statusCode, body) {
  const text = `${JSON.stringify(body)}\n`;
  res.writeHead(statusCode, {
    'content-type': 'application/json',
    'content-length': Buffer.byteLength(text)
  });
  res.end(text);
}

function createReviewerAdapterServer({
  rootDir = path.resolve(__dirname, '..'),
  host = process.env.REVIEWER_ADAPTER_HOST || DEFAULT_HOST,
  port = Number(process.env.REVIEWER_ADAPTER_PORT || DEFAULT_PORT),
  token = process.env.REVIEWER_ADAPTER_TOKEN || process.env.REVIEWER_TOKEN || '',
  env = process.env
} = {}) {
  const server = http.createServer(async (req, res) => {
    try {
      if (req.method === 'GET' && (req.url === '/health' || req.url === '/')) {
        return sendJson(res, 200, {
          ok: true,
          service: 'pixel-agent-desk-reviewer-adapter',
          endpoint: `http://${host}:${port}/review`
        });
      }

      if (req.method !== 'POST' || (req.url !== '/review' && req.url !== '/')) {
        return sendJson(res, 404, { ok: false, error: 'Not found' });
      }

      if (!tokenMatches(req, token)) {
        return sendJson(res, 401, { ok: false, error: 'Unauthorized' });
      }

      const payload = await readJsonBody(req);
      validatePayload(payload);

      const taskNum = payload.taskNum;
      const payloadPath = path.join(rootDir, 'REVIEWS', `reviewer_payload_${taskNum}.json`);
      require('fs').mkdirSync(path.dirname(payloadPath), { recursive: true });
      require('fs').writeFileSync(payloadPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

      const pid = spawnBackgroundReview({ rootDir, payload, env });

      return sendJson(res, 202, {
        ok: true,
        accepted: true,
        async: true,
        taskId: payload.taskId || `TASK-${taskNum}`,
        taskNum,
        expectedReviewPath: payload.expectedReviewPath,
        workerPid: pid,
        message: 'Review dispatch accepted. Completion is signaled by REVIEWS/review_NNN.md on disk.'
      });
    } catch (error) {
      return sendJson(res, 400, { ok: false, error: error.message });
    }
  });

  return {
    server,
    host,
    port,
    rootDir,
    start() {
      return new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, host, () => {
          console.log(`[reviewer-adapter] Listening on http://${host}:${port}/review`);
          if (token) {
            console.log('[reviewer-adapter] Bearer token authentication enabled.');
          } else {
            console.log('[reviewer-adapter] WARNING: No REVIEWER_ADAPTER_TOKEN configured.');
          }
          resolve({ host, port });
        });
      });
    },
    close() {
      return new Promise(resolve => server.close(resolve));
    }
  };
}

async function main() {
  const adapter = createReviewerAdapterServer();
  await adapter.start();
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`[reviewer-adapter] Failed to start: ${error.message}`);
    process.exit(1);
  });
}

module.exports = {
  DEFAULT_HOST,
  DEFAULT_PORT,
  createReviewerAdapterServer,
  spawnBackgroundReview,
  validatePayload
};