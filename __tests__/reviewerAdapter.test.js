const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  createReviewerAdapterServer,
  validatePayload
} = require('../agent-runner/reviewer-adapter-server');
const { executeLocalReview } = require('../agent-runner/review-engine');
const { parseReviewDecision } = require('../agent-runner/route-review-decision');

function createTempRepo() {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pad-reviewer-adapter-'));
  fs.mkdirSync(path.join(rootDir, 'REVIEWS'));
  fs.mkdirSync(path.join(rootDir, 'TASKS'));
  return rootDir;
}

function cleanupTempRepo(rootDir) {
  try {
    fs.rmSync(rootDir, { recursive: true, force: true });
  } catch (error) {
    // ignore
  }
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = http.createServer();
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
    server.on('error', reject);
  });
}

function postReview({ port, token, payload }) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: '/review',
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'content-length': Buffer.byteLength(body),
          ...(token ? { authorization: `Bearer ${token}` } : {})
        }
      },
      (res) => {
        const chunks = [];
        res.on('data', chunk => chunks.push(chunk));
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode,
            body: JSON.parse(Buffer.concat(chunks).toString('utf8'))
          });
        });
      }
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function waitForFile(filePath, timeoutMs = 10000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      if (fs.existsSync(filePath)) {
        resolve(fs.readFileSync(filePath, 'utf8'));
        return;
      }
      if (Date.now() - start > timeoutMs) {
        reject(new Error(`Timed out waiting for ${filePath}`));
        return;
      }
      setTimeout(tick, 100);
    };
    tick();
  });
}

describe('reviewer adapter payload validation', () => {
  test('requires review.requested event and taskNum', () => {
    expect(() => validatePayload({ event: 'other', taskNum: '008' })).toThrow(/review.requested/);
    expect(() => validatePayload({ event: 'review.requested' })).toThrow(/taskNum/);
    expect(() => validatePayload({
      event: 'review.requested',
      taskNum: '008',
      expectedReviewPath: 'REVIEWS/review_008.md'
    })).not.toThrow();
  });
});

describe('local review engine', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = createTempRepo();
  });

  afterEach(() => {
    cleanupTempRepo(tempDir);
  });

  test('deterministic engine writes review file with decision line', async () => {
    const payload = {
      event: 'review.requested',
      taskId: 'TASK-042',
      taskNum: '042',
      reviewer: { name: 'Grok Build' },
      expectedReviewPath: 'REVIEWS/review_042.md',
      task: '# TASK-042\n\n## 1. Objective\n\nTest.',
      reviewRequest: '# Review Request\n\nPlease review.',
      diff: 'diff --git a/foo b/foo\n'
    };

    const result = await executeLocalReview({
      rootDir: tempDir,
      payload,
      env: { ...process.env, REVIEWER_ENGINE: 'deterministic' }
    });

    const reviewText = fs.readFileSync(result.reviewPath, 'utf8');
    expect(parseReviewDecision(reviewText).decision).toBe('APPROVE');
    expect(reviewText).toContain('- **Decision**: APPROVE');
  });
});

describe('reviewer adapter HTTP server', () => {
  let tempDir;
  let adapter;
  let port;

  beforeEach(async () => {
    tempDir = createTempRepo();
    port = await getFreePort();
    adapter = createReviewerAdapterServer({
      rootDir: tempDir,
      host: '127.0.0.1',
      port,
      token: 'test-token',
      env: {
        ...process.env,
        REVIEWER_ENGINE: 'deterministic'
      }
    });
    await adapter.start();
  });

  afterEach(async () => {
    if (adapter) await adapter.close();
    cleanupTempRepo(tempDir);
  });

  test('returns 202 immediately and writes review asynchronously', async () => {
    const payload = {
      event: 'review.requested',
      taskId: 'TASK-043',
      taskNum: '043',
      reviewer: { name: 'Grok Build' },
      expectedReviewPath: 'REVIEWS/review_043.md',
      task: '# TASK-043\n\n## 1. Objective\n\nTest.',
      reviewRequest: '# Review Request\n\nPlease review.',
      diff: 'diff --git a/foo b/foo\n'
    };

    const started = Date.now();
    const response = await postReview({ port, token: 'test-token', payload });
    const elapsed = Date.now() - started;

    expect(response.statusCode).toBe(202);
    expect(response.body.accepted).toBe(true);
    expect(response.body.async).toBe(true);
    expect(elapsed).toBeLessThan(2000);

    const reviewText = await waitForFile(path.join(tempDir, 'REVIEWS', 'review_043.md'));
    expect(parseReviewDecision(reviewText).decision).toBe('APPROVE');
  });

  test('rejects missing bearer token', async () => {
    const response = await postReview({
      port,
      token: '',
      payload: {
        event: 'review.requested',
        taskNum: '044',
        expectedReviewPath: 'REVIEWS/review_044.md'
      }
    });

    expect(response.statusCode).toBe(401);
  });
});