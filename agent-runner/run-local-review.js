const fs = require('fs');
const path = require('path');
const { resolveTaskNum } = require('./resolve-task');
const { executeLocalReview } = require('./review-engine');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

async function main() {
  let rootDir = path.resolve(__dirname, '..');
  const argv = process.argv.slice(2);

  let payloadPath = null;
  let taskNum = null;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--project-root' && argv[i + 1]) {
      rootDir = path.resolve(argv[i + 1]);
      i += 1;
    } else if (arg === '--payload-path' && argv[i + 1]) {
      payloadPath = path.resolve(argv[i + 1]);
      i += 1;
    } else if (arg === '--task' && argv[i + 1]) {
      taskNum = resolveTaskNum({ argv: [arg, argv[i + 1]], cwd: rootDir });
      i += 1;
    } else if (/^\d{1,3}$/.test(arg)) {
      taskNum = resolveTaskNum({ argv: [arg], cwd: rootDir });
    }
  }

  if (!argv.includes('--project-root') && payloadPath && payloadPath.includes(`${path.sep}REVIEWS${path.sep}`)) {
    rootDir = path.resolve(payloadPath, '..', '..');
  }

  if (!payloadPath && taskNum) {
    payloadPath = path.join(rootDir, 'REVIEWS', `reviewer_payload_${taskNum}.json`);
  }

  if (!payloadPath || !fs.existsSync(payloadPath)) {
    console.error('Usage: node run-local-review.js --payload-path <path>');
    console.error('   or: node run-local-review.js --task <NNN>');
    console.error('   or: node run-local-review.js <NNN>');
    process.exit(1);
  }

  const payload = readJson(payloadPath);
  const normalizedTaskNum = payload.taskNum || taskNum;
  console.log(`[run-local-review] Starting review for TASK-${normalizedTaskNum} using engine=${process.env.REVIEWER_ENGINE || 'tui'}`);

  const result = await executeLocalReview({ rootDir, payload, env: process.env });
  console.log(`[run-local-review] Wrote ${result.reviewPath} decision=${result.decision}`);
  if (result.error) {
    console.error(`[run-local-review] Engine error recorded in review file: ${result.error}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`[run-local-review] Fatal error: ${error.message}`);
    process.exit(1);
  });
}

module.exports = { main };