const fs = require('fs');
const path = require('path');
const { resolveTaskNum } = require('./resolve-task');
const { getRoleConfig } = require('./role-config');

function readIfExists(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
}

function buildReviewerPayload({ rootDir, taskNum, env = process.env }) {
  const taskId = `TASK-${taskNum}`;
  const { roles } = getRoleConfig(env);
  return {
    event: 'review.requested',
    taskId,
    taskNum,
    reviewer: roles.reviewer,
    repository: env.GITHUB_REPOSITORY || null,
    runId: env.GITHUB_RUN_ID || null,
    runUrl: env.GITHUB_SERVER_URL && env.GITHUB_REPOSITORY && env.GITHUB_RUN_ID
      ? `${env.GITHUB_SERVER_URL}/${env.GITHUB_REPOSITORY}/actions/runs/${env.GITHUB_RUN_ID}`
      : null,
    pullRequest: {
      number: env.PR_NUMBER || null,
      title: env.PR_TITLE || null,
      headSha: env.PR_HEAD_SHA || env.GITHUB_SHA || null,
      headRef: env.PR_HEAD_REF || env.GITHUB_HEAD_REF || null,
      baseRef: env.PR_BASE_REF || env.GITHUB_BASE_REF || null
    },
    expectedReviewPath: `REVIEWS/review_${taskNum}.md`,
    decisionContract: {
      approvedLine: '- **Decision**: APPROVE',
      allowedDecisions: ['APPROVE', 'REQUEST_CHANGES', 'REJECT']
    },
    task: readIfExists(path.join(rootDir, 'TASKS', `task_${taskNum}.md`)),
    reviewRequest: readIfExists(path.join(rootDir, 'REVIEWS', `review_request_${taskNum}.md`)),
    diff: readIfExists(path.join(rootDir, 'REVIEWS', `review_diff_${taskNum}.patch`))
  };
}

async function dispatchPayload({ payload, endpoint, token }) {
  if (!endpoint) return { dispatched: false, status: null, responseText: '' };

  const headers = { 'content-type': 'application/json' };
  if (token) headers.authorization = `Bearer ${token}`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload)
  });
  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(`Reviewer endpoint failed with ${response.status}: ${responseText}`);
  }

  return { dispatched: true, status: response.status, responseText };
}

async function main() {
  const rootDir = path.resolve(__dirname, '..');
  const taskNum = resolveTaskNum({ argv: process.argv.slice(2), cwd: rootDir });
  if (!taskNum) {
    console.error('Usage: node dispatch-review.js <NNN>');
    process.exit(1);
  }

  const payload = buildReviewerPayload({ rootDir, taskNum });
  const payloadPath = path.join(rootDir, 'REVIEWS', `reviewer_payload_${taskNum}.json`);
  fs.mkdirSync(path.dirname(payloadPath), { recursive: true });
  fs.writeFileSync(payloadPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  console.log(`Wrote reviewer payload: ${payloadPath}`);

  try {
    const result = await dispatchPayload({
      payload,
      endpoint: process.env.REVIEWER_ENDPOINT || process.env.GROK_REVIEW_ENDPOINT,
      token: process.env.REVIEWER_TOKEN || process.env.GROK_REVIEW_TOKEN
    });

    if (!result.dispatched) {
      console.log('REVIEWER_ENDPOINT is not configured. Payload was generated for artifact upload.');
      return;
    }

    console.log(`Reviewer endpoint accepted payload with ${result.status}.`);
    if (result.responseText.trim()) console.log(result.responseText);
  } catch (error) {
    console.error(`Failed to dispatch reviewer payload: ${error.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  buildGrokPayload: buildReviewerPayload,
  buildReviewerPayload,
  dispatchPayload,
  main
};
