const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { resolveTaskNum } = require('./resolve-task');

function git(rootDir, args) {
  return execFileSync('git', args, {
    cwd: rootDir,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024
  }).trim();
}

function gitOk(rootDir, args) {
  try {
    git(rootDir, args);
    return true;
  } catch {
    return false;
  }
}

function parseTaskBranch(taskContent) {
  const match = taskContent.match(/-\s+\*\*Branch\*\*:\s*`([^`]+)`/);
  return match ? match[1].trim() : null;
}

function resolveBaseRef(rootDir) {
  const envBase = process.env.REVIEW_DIFF_BASE;
  if (envBase) return envBase;
  if (gitOk(rootDir, ['rev-parse', '--verify', 'master'])) return 'master';
  if (gitOk(rootDir, ['rev-parse', '--verify', 'main'])) return 'main';
  throw new Error('Could not resolve base ref. Set REVIEW_DIFF_BASE or ensure master/main exists.');
}

function countAhead(rootDir, baseRef, headRef) {
  if (!gitOk(rootDir, ['rev-parse', '--verify', headRef])) return 0;
  try {
    return Number(git(rootDir, ['rev-list', '--count', `${baseRef}..${headRef}`]));
  } catch {
    return 0;
  }
}

function tryDiff(rootDir, spec) {
  try {
    const diff = execFileSync('git', ['diff', '--no-color', ...spec.args], {
      cwd: rootDir,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024
    });
    return diff.trim() ? { diff, label: spec.label } : null;
  } catch {
    return null;
  }
}

function buildStrategies({ rootDir, baseRef, currentBranch, taskBranch }) {
  const strategies = [];

  if (currentBranch && currentBranch !== baseRef && countAhead(rootDir, baseRef, currentBranch) > 0) {
    strategies.push({
      label: `${baseRef}...${currentBranch}`,
      args: [`${baseRef}...${currentBranch}`]
    });
    strategies.push({
      label: `${baseRef}..${currentBranch}`,
      args: [`${baseRef}..${currentBranch}`]
    });
  }

  if (taskBranch && taskBranch !== currentBranch && countAhead(rootDir, baseRef, taskBranch) > 0) {
    strategies.push({
      label: `${baseRef}...${taskBranch}`,
      args: [`${baseRef}...${taskBranch}`]
    });
    strategies.push({
      label: `${baseRef}..${taskBranch}`,
      args: [`${baseRef}..${taskBranch}`]
    });
  }

  // Working tree vs base — required when changes are uncommitted on master (TASK-010 case).
  strategies.push({
    label: `${baseRef} (working tree)`,
    args: [baseRef]
  });

  // Staged-only fallback.
  strategies.push({
    label: `--cached ${baseRef}`,
    args: ['--cached', baseRef]
  });

  return strategies;
}

function generateReviewDiff({ rootDir, taskNum, env = process.env }) {
  const taskPath = path.join(rootDir, 'TASKS', `task_${taskNum}.md`);
  if (!fs.existsSync(taskPath)) {
    throw new Error(`Task file not found: ${taskPath}`);
  }

  const taskContent = fs.readFileSync(taskPath, 'utf8');
  const taskBranch = parseTaskBranch(taskContent);
  const baseRef = resolveBaseRef(rootDir);
  const currentBranch = git(rootDir, ['branch', '--show-current']);
  const outPath = path.join(rootDir, 'REVIEWS', `review_diff_${taskNum}.patch`);

  const strategies = buildStrategies({ rootDir, baseRef, currentBranch, taskBranch });
  const seen = new Set();

  for (const spec of strategies) {
    if (seen.has(spec.label)) continue;
    seen.add(spec.label);

    const result = tryDiff(rootDir, spec);
    if (result) {
      fs.mkdirSync(path.dirname(outPath), { recursive: true });
      fs.writeFileSync(outPath, `${result.diff.trimEnd()}\n`, 'utf8');
      return {
        outPath,
        bytes: Buffer.byteLength(result.diff, 'utf8'),
        strategy: result.label,
        baseRef,
        currentBranch,
        taskBranch
      };
    }
  }

  const hint = [
    `current branch: ${currentBranch}`,
    `task branch: ${taskBranch || '(none parsed)'}`,
    `base ref: ${baseRef}`,
    'Commit task changes on the feature branch before UNDER_REVIEW,',
    'or ensure uncommitted changes exist relative to the base branch.'
  ].join('\n  ');

  throw new Error(`All diff strategies produced empty output for TASK-${taskNum}.\n  ${hint}`);
}

function main() {
  const rootDir = path.resolve(__dirname, '..');
  const taskNum = resolveTaskNum({ argv: process.argv.slice(2), cwd: rootDir });
  if (!taskNum) {
    console.error('Usage: node generate-review-diff.js <NNN>');
    process.exit(1);
  }

  try {
    const result = generateReviewDiff({ rootDir, taskNum });
    console.log(
      `[generate-review-diff] Wrote ${result.outPath} (${result.bytes} bytes) using "${result.strategy}"`
    );
  } catch (error) {
    console.error(`[generate-review-diff] ${error.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  generateReviewDiff,
  parseTaskBranch,
  buildStrategies
};