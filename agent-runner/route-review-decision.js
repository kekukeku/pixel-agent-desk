const fs = require('fs');
const path = require('path');
const { resolveTaskNum, writeGithubOutput } = require('./resolve-task');

const DECISION_ROUTES = {
  APPROVE: {
    targetState: 'APPROVED',
    handoffTarget: 'antigravity.merge',
    labelsToAdd: ['approved-by-grok'],
    labelsToRemove: ['changes-requested-by-grok', 'rejected-by-grok', 'needs-grok-review', 'needs-antigravity-work', 'operator-review-required']
  },
  REQUEST_CHANGES: {
    targetState: 'CHANGES_REQUESTED',
    handoffTarget: 'antigravity.fix',
    labelsToAdd: ['changes-requested-by-grok', 'needs-antigravity-work'],
    labelsToRemove: ['approved-by-grok', 'rejected-by-grok', 'needs-grok-review', 'operator-review-required']
  },
  REJECT: {
    targetState: 'REJECTED',
    handoffTarget: 'operator.review',
    labelsToAdd: ['rejected-by-grok', 'operator-review-required'],
    labelsToRemove: ['approved-by-grok', 'changes-requested-by-grok', 'needs-grok-review', 'needs-antigravity-work']
  }
};

function parseReviewDecision(reviewContent) {
  const decisionMatch = reviewContent.match(/(?:^|\n)\s*(?:-\s*)?(?:\*\*)?(?:Decision|Verdict)(?:\*\*)?\s*:\s*`?(APPROVE|REQUEST_CHANGES|REJECT)`?/i);
  return {
    decision: decisionMatch ? decisionMatch[1].toUpperCase() : null
  };
}

function extractReviewSummary(reviewContent, maxLength = 900) {
  const summaryMatch = reviewContent.match(/##\s+\d*\.?\s*Review Summary\s*\n+([\s\S]*?)(?=\n+##|$)/i);
  const fallback = reviewContent
    .split('\n')
    .filter(line => line.trim() && !line.startsWith('#'))
    .slice(0, 8)
    .join('\n');

  const summary = (summaryMatch ? summaryMatch[1] : fallback).trim();
  if (summary.length <= maxLength) return summary;
  return `${summary.slice(0, maxLength - 3).trim()}...`;
}

function buildRoutePayload({ rootDir, taskNum, env = process.env, requireReview = false }) {
  const taskId = `TASK-${taskNum}`;
  const reviewPath = path.join(rootDir, 'REVIEWS', `review_${taskNum}.md`);

  if (!fs.existsSync(reviewPath)) {
    if (requireReview) {
      throw new Error(`Missing review decision file: REVIEWS/review_${taskNum}.md`);
    }

    return {
      event: 'review.decision_absent',
      taskId,
      taskNum,
      decision: 'NONE',
      targetState: 'UNDER_REVIEW',
      handoffTarget: 'none',
      labelsToAdd: [],
      labelsToRemove: [],
      reviewPath: `REVIEWS/review_${taskNum}.md`,
      summary: '',
      comment: ''
    };
  }

  const reviewContent = fs.readFileSync(reviewPath, 'utf8');
  const parsed = parseReviewDecision(reviewContent);
  if (!parsed.decision) {
    throw new Error(`Review file does not include an allowed decision: REVIEWS/review_${taskNum}.md`);
  }

  const route = DECISION_ROUTES[parsed.decision];
  const summary = extractReviewSummary(reviewContent);
  const comment = [
    `### Grok Build decision for ${taskId}: \`${parsed.decision}\``,
    '',
    summary || '_No review summary was provided._',
    '',
    `Next route: \`${route.handoffTarget}\``
  ].join('\n');

  return {
    event: 'review.decision',
    taskId,
    taskNum,
    decision: parsed.decision,
    targetState: route.targetState,
    handoffTarget: route.handoffTarget,
    labelsToAdd: route.labelsToAdd,
    labelsToRemove: route.labelsToRemove,
    reviewPath: `REVIEWS/review_${taskNum}.md`,
    repository: env.GITHUB_REPOSITORY || null,
    runId: env.GITHUB_RUN_ID || null,
    pullRequest: {
      number: env.PR_NUMBER || null,
      title: env.PR_TITLE || null,
      headSha: env.PR_HEAD_SHA || env.GITHUB_SHA || null,
      headRef: env.PR_HEAD_REF || env.GITHUB_HEAD_REF || null,
      baseRef: env.PR_BASE_REF || env.GITHUB_BASE_REF || null
    },
    summary,
    comment
  };
}

async function dispatchHandoff({ payload, endpoint, token }) {
  if (!endpoint || payload.decision === 'NONE') {
    return { dispatched: false, status: null, responseText: '' };
  }

  const headers = { 'content-type': 'application/json' };
  if (token) headers.authorization = `Bearer ${token}`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload)
  });
  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(`Handoff endpoint failed with ${response.status}: ${responseText}`);
  }

  return { dispatched: true, status: response.status, responseText };
}

function writePayload(rootDir, taskNum, payload) {
  const payloadPath = path.join(rootDir, 'REVIEWS', `handoff_payload_${taskNum}.json`);
  fs.mkdirSync(path.dirname(payloadPath), { recursive: true });
  fs.writeFileSync(payloadPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  return payloadPath;
}

function writeRouteOutputs(payload, env = process.env) {
  writeGithubOutput({
    decision: payload.decision,
    target_state: payload.targetState,
    handoff_target: payload.handoffTarget,
    labels_to_add: payload.labelsToAdd.join(','),
    labels_to_remove: payload.labelsToRemove.join(','),
    review_path: payload.reviewPath
  }, env);

  if (env.GITHUB_OUTPUT) {
    const delimiter = `ROUTE_COMMENT_${Date.now()}`;
    fs.appendFileSync(env.GITHUB_OUTPUT, `comment<<${delimiter}\n${payload.comment || ''}\n${delimiter}\n`, 'utf8');
  }
}

async function main() {
  const rootDir = path.resolve(__dirname, '..');
  const argv = process.argv.slice(2);
  const taskNum = resolveTaskNum({ argv, cwd: rootDir });
  if (!taskNum) {
    console.error('Usage: node route-review-decision.js <NNN>');
    process.exit(1);
  }

  try {
    const payload = buildRoutePayload({
      rootDir,
      taskNum,
      requireReview: argv.includes('--require')
    });
    const payloadPath = writePayload(rootDir, taskNum, payload);
    console.log(`Wrote handoff payload: ${payloadPath}`);
    console.log(`Decision route: ${payload.decision} -> ${payload.handoffTarget}`);

    if (argv.includes('--github-output')) {
      writeRouteOutputs(payload);
    }

    const result = await dispatchHandoff({
      payload,
      endpoint: process.env.HANDOFF_ROUTER_ENDPOINT,
      token: process.env.HANDOFF_ROUTER_TOKEN
    });

    if (result.dispatched) {
      console.log(`Handoff endpoint accepted payload with ${result.status}.`);
      if (result.responseText.trim()) console.log(result.responseText);
    }
  } catch (error) {
    console.error(`Failed to route review decision: ${error.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  DECISION_ROUTES,
  buildRoutePayload,
  dispatchHandoff,
  extractReviewSummary,
  parseReviewDecision,
  writePayload,
  writeRouteOutputs
};
