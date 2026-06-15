const { execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

function createTempRepo() {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pad-watcher-test-'));
  fs.mkdirSync(path.join(rootDir, 'TASKS'));
  fs.mkdirSync(path.join(rootDir, 'REVIEWS'));
  return rootDir;
}

function cleanupTempRepo(rootDir) {
  try {
    fs.rmSync(rootDir, { recursive: true, force: true });
  } catch (error) {
    // Ignore cleanup errors
  }
}

describe('watcher.py --parse-only integration', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = createTempRepo();
  });

  afterEach(() => {
    cleanupTempRepo(tempDir);
  });

  test('parses empty repository states cleanly', () => {
    const stdout = execSync(`python3 watcher.py --parse-only --project-root "${tempDir}"`, {
      encoding: 'utf8',
      cwd: path.resolve(__dirname, '..')
    });
    const result = JSON.parse(stdout);
    expect(result).toEqual({
      tasks: {},
      registry: {},
      decisions: {}
    });
  });

  test('parses tasks, registry and reviews correctly', () => {
    // Write a mock task file
    fs.writeFileSync(
      path.join(tempDir, 'TASKS', 'task_006.md'),
      `# TASK-006: Add watcher\n\n- **Status**: \`IN_PROGRESS\`\n- **Branch**: \`task/task_006_watcher\`\n`,
      'utf8'
    );

    // Write a mock registry file
    fs.writeFileSync(
      path.join(tempDir, 'AGENT_STATE.md'),
      `# Registry\n\n| Task ID | State | Linked PR / Branch | Last Updated |\n| :--- | :--- | :--- | :--- |\n| **TASK-006** | \`IN_PROGRESS\` | [task/task_006_watcher](file://...) | 2026-06-16 |\n`,
      'utf8'
    );

    // Write a mock review file
    fs.writeFileSync(
      path.join(tempDir, 'REVIEWS', 'review_006.md'),
      `# Grok Build Review: TASK-006\n\n- **Reviewer**: Grok Build\n- **Decision**: \`APPROVE\`\n`,
      'utf8'
    );

    const stdout = execSync(`python3 watcher.py --parse-only --project-root "${tempDir}"`, {
      encoding: 'utf8',
      cwd: path.resolve(__dirname, '..')
    });
    const result = JSON.parse(stdout);

    expect(result.tasks['006']).toEqual({
      status: 'IN_PROGRESS',
      branch: 'task/task_006_watcher'
    });
    expect(result.registry['006']).toBe('IN_PROGRESS');
    expect(result.decisions['006']).toBe('APPROVE');
  });

  test('tolerates missing values gracefully', () => {
    // Write an empty/invalid task file
    fs.writeFileSync(
      path.join(tempDir, 'TASKS', 'task_007.md'),
      `# TASK-007: Broken metadata\n\n- **Status**: Unknown\n`,
      'utf8'
    );

    const stdout = execSync(`python3 watcher.py --parse-only --project-root "${tempDir}"`, {
      encoding: 'utf8',
      cwd: path.resolve(__dirname, '..')
    });
    const result = JSON.parse(stdout);

    expect(result.tasks['007']).toEqual({
      status: null,
      branch: null
    });
  });
});
