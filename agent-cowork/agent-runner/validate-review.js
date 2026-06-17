const fs = require('fs');
const path = require('path');
const { parseReviewDecision } = require('./route-review-decision');
const { resolveTaskNum } = require('./resolve-task');

function fail(message) {
  console.error(`[Review Validator] ${message}`);
  process.exit(1);
}

function validateReview({ rootDir, taskNum }) {
  const taskId = `TASK-${taskNum}`;
  const taskPath = path.join(rootDir, 'TASKS', `task_${taskNum}.md`);
  const reviewPath = path.join(rootDir, 'REVIEWS', `review_${taskNum}.md`);

  if (!fs.existsSync(taskPath)) {
    throw new Error(`${taskId} task file is missing: ${taskPath}`);
  }

  if (!fs.existsSync(reviewPath)) {
    throw new Error(`Missing required Grok Build review file: REVIEWS/review_${taskNum}.md`);
  }

  const review = fs.readFileSync(reviewPath, 'utf8');
  const parsed = parseReviewDecision(review);

  if (!parsed.decision) {
    throw new Error('Review file must contain a decision line such as "- **Decision**: APPROVE".');
  }

  if (!review.includes(taskId)) {
    throw new Error(`Review file must reference ${taskId}.`);
  }

  if (!/Grok Build/i.test(review)) {
    throw new Error('Review file must identify Grok Build as the reviewer.');
  }

  if (parsed.decision !== 'APPROVE') {
    throw new Error(`Review decision is ${parsed.decision}; merge gate requires APPROVE.`);
  }

  return `[Review Validator] ${taskId} approved by Grok Build.`;
}

function main() {
  const taskNum = resolveTaskNum({ argv: process.argv.slice(2), cwd: path.resolve(__dirname, '..') });
  if (!taskNum) fail('Usage: node validate-review.js <NNN>');

  try {
    console.log(validateReview({ rootDir: path.resolve(__dirname, '..'), taskNum }));
  } catch (error) {
    fail(error.message);
  }
}

if (require.main === module) {
  main();
}

module.exports = { validateReview };
