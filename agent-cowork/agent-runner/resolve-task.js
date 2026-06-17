const fs = require('fs');
const path = require('path');

function normalizeTaskNum(value) {
  if (!value) return null;
  const trimmed = String(value).trim();
  const exactMatch = trimmed.match(/^(?:TASK[-_]?|task[-_/]?)?(\d{1,3})$/i);
  if (exactMatch) return exactMatch[1].padStart(3, '0');

  const branchMatch = trimmed.match(/(?:^|\/)task_(\d{1,3})(?:_|$)/i);
  return branchMatch ? branchMatch[1].padStart(3, '0') : null;
}

function findTaskNumInText(text) {
  if (!text) return null;

  const taskIdMatch = String(text).match(/TASK-(\d{1,3})/i);
  if (taskIdMatch) return taskIdMatch[1].padStart(3, '0');

  const branchMatch = String(text).match(/task\/task_(\d{1,3})/i);
  if (branchMatch) return branchMatch[1].padStart(3, '0');

  return null;
}

function resolveTaskNum({ argv = process.argv.slice(2), env = process.env, cwd = process.cwd() } = {}) {
  const explicitArg = argv.find(arg => !arg.startsWith('--'));
  const explicitFlagIndex = argv.findIndex(arg => arg === '--task' || arg === '--task-num' || arg === '--task-id');
  const explicitFlagValue = explicitFlagIndex >= 0 ? argv[explicitFlagIndex + 1] : null;

  const candidates = [
    explicitFlagValue,
    explicitArg,
    env.TASK_NUM,
    env.TASK_ID,
    env.PR_HEAD_REF,
    env.GITHUB_HEAD_REF,
    env.PR_TITLE,
    env.PR_BODY,
    env.GITHUB_REF_NAME
  ];

  for (const candidate of candidates) {
    const taskNum = findTaskNumInText(candidate) || normalizeTaskNum(candidate);
    if (taskNum) return taskNum;
  }

  const statePath = path.join(cwd, 'AGENT_STATE.md');
  if (fs.existsSync(statePath)) {
    const state = fs.readFileSync(statePath, 'utf8');
    const rowMatch = state.match(/\|\s*\*\*TASK-(\d{3})\*\*\s*\|\s*`?(UNDER_REVIEW|APPROVED|CHANGES_REQUESTED|IN_PROGRESS)`?/i);
    if (rowMatch) return rowMatch[1];
  }

  return null;
}

function writeGithubOutput(values, env = process.env) {
  if (!env.GITHUB_OUTPUT) return;
  const lines = [];
  for (const [key, value] of Object.entries(values)) {
    lines.push(`${key}=${value}`);
  }
  fs.appendFileSync(env.GITHUB_OUTPUT, `${lines.join('\n')}\n`, 'utf8');
}

function main() {
  const argv = process.argv.slice(2);
  const taskNum = resolveTaskNum({ argv });
  const requireTask = argv.includes('--require');
  const githubOutput = argv.includes('--github-output');

  if (!taskNum) {
    if (requireTask) {
      console.error('Unable to resolve task number from args, env, PR metadata, or AGENT_STATE.md.');
      process.exit(1);
    }
    process.exit(0);
  }

  const taskId = `TASK-${taskNum}`;
  if (githubOutput) {
    writeGithubOutput({ task_num: taskNum, task_id: taskId });
  }

  console.log(taskId);
}

if (require.main === module) {
  main();
}

module.exports = {
  findTaskNumInText,
  normalizeTaskNum,
  resolveTaskNum,
  writeGithubOutput
};
