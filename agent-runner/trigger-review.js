const fs = require('fs');
const path = require('path');
const { resolveTaskNum } = require('./resolve-task');

function readRequired(filePath, message) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`${message}: ${filePath}`);
  }
  return fs.readFileSync(filePath, 'utf8');
}

function parseTaskMetadata(taskContent, taskId, taskNum) {
  const titleMatch = taskContent.match(/#\s+TASK-\d+:\s*([^\n]+)/);
  const branchMatch = taskContent.match(/-\s+\*\*Branch\*\*:\s*`([^`]+)`/);
  const objectiveMatch = taskContent.match(/## 1\. Objective\s*\n+([\s\S]*?)(?=\n+##|$)/i);
  const filesAffectedMatch = taskContent.match(/## 2\. Files Affected\s*\n+([\s\S]*?)(?=\n+##|$)/i);
  const filesAffected = [];

  if (filesAffectedMatch) {
    for (const line of filesAffectedMatch[1].split('\n')) {
      const fileMatch = line.match(/-\s+`\[([^\]]+)\]`\s*(?:\[([^\]]+)\]\(([^)]+)\)|`?([^`\s\n)]+)`?)/);
      if (fileMatch) {
        filesAffected.push(`- **${fileMatch[2] || fileMatch[4]}**: Action: ${fileMatch[1]}`);
      }
    }
  }

  return {
    taskTitle: titleMatch ? titleMatch[1].trim() : `${taskId} Integration`,
    targetBranch: branchMatch ? branchMatch[1] : `task/task_${taskNum}_branch`,
    objective: objectiveMatch ? objectiveMatch[1].trim() : '',
    filesAffected
  };
}

function assertTaskUnderReview(agentStateContent, taskId) {
  const tableRowRegex = new RegExp(`\\|\\s*\\*\\*${taskId}\\*\\*\\s*\\|\\s*([^|]+)\\s*\\|`);
  const match = agentStateContent.match(tableRowRegex);

  if (!match) {
    throw new Error(`${taskId} is not registered in AGENT_STATE.md central registry table.`);
  }

  const currentState = match[1].trim().replace(/`/g, '');
  if (currentState !== 'UNDER_REVIEW') {
    throw new Error(`${taskId} state in AGENT_STATE.md is "${currentState}", but must be "UNDER_REVIEW" to trigger review.`);
  }
}

function createReviewRequest({ rootDir, taskNum }) {
  const taskId = `TASK-${taskNum}`;
  const taskFilePath = path.join(rootDir, 'TASKS', `task_${taskNum}.md`);
  const agentStatePath = path.join(rootDir, 'AGENT_STATE.md');
  const reviewsDir = path.join(rootDir, 'REVIEWS');

  const taskContent = readRequired(taskFilePath, 'Task file not found');
  const agentStateContent = readRequired(agentStatePath, 'AGENT_STATE.md not found');
  assertTaskUnderReview(agentStateContent, taskId);

  const metadata = parseTaskMetadata(taskContent, taskId, taskNum);
  const reviewRequestContent = `# Review Request: ${metadata.taskTitle} (${taskId})

- **Request ID**: RR-${taskNum}
- **Linked Task**: [${taskId}](file://${path.resolve(taskFilePath)})
- **Author**: Antigravity (Layer 3)
- **Target Branch**: \`${metadata.targetBranch}\`
- **Date**: ${new Date().toISOString().split('T')[0]}

---

## 1. Request Details

${metadata.objective}

## 2. Changes Summary

${metadata.filesAffected.join('\n') || '- No specific files parsed.'}

---

**Please evaluate these changes and record the decision in \`REVIEWS/review_${taskNum}.md\`**.
`;

  fs.mkdirSync(reviewsDir, { recursive: true });
  const reviewRequestPath = path.join(reviewsDir, `review_request_${taskNum}.md`);
  fs.writeFileSync(reviewRequestPath, reviewRequestContent, 'utf8');
  return reviewRequestPath;
}

function main() {
  const taskNum = resolveTaskNum({ argv: process.argv.slice(2), cwd: path.resolve(__dirname, '..') });
  if (!taskNum) {
    console.error('Error: Please specify a task number (e.g., "005" or "5").');
    process.exit(1);
  }

  const taskId = `TASK-${taskNum}`;
  console.log(`Starting trigger-review for ${taskId}...`);

  try {
    const reviewRequestPath = createReviewRequest({ rootDir: path.resolve(__dirname, '..'), taskNum });
    console.log(`Successfully generated Review Request at: ${reviewRequestPath}`);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  assertTaskUnderReview,
  createReviewRequest,
  parseTaskMetadata
};
