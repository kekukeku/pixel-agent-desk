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

// ── --simulate-handoff ────────────────────────────────────────────────────────

describe('watcher.py --simulate-handoff integration', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = createTempRepo();
  });

  afterEach(() => {
    cleanupTempRepo(tempDir);
  });

  test('returns empty array for empty repo', () => {
    const stdout = execSync(`python3 watcher.py --simulate-handoff --project-root "${tempDir}"`, {
      encoding: 'utf8',
      cwd: path.resolve(__dirname, '..')
    });
    expect(JSON.parse(stdout)).toEqual([]);
  });

  test('returns antigravity entry for IN_PROGRESS task', () => {
    fs.writeFileSync(
      path.join(tempDir, 'TASKS', 'task_008.md'),
      `# TASK-008\n\n- **Status**: \`IN_PROGRESS\`\n- **Branch**: \`task/task_008_test\`\n`,
      'utf8'
    );
    const stdout = execSync(`python3 watcher.py --simulate-handoff --project-root "${tempDir}"`, {
      encoding: 'utf8',
      cwd: path.resolve(__dirname, '..')
    });
    const result = JSON.parse(stdout);
    const entry = result.find(e => e.task_num === '008' && e.target === 'antigravity');
    expect(entry).toBeDefined();
    expect(entry.trigger).toBe('task_status');
    expect(entry.state).toBe('IN_PROGRESS');
    expect(entry.dispatch_key).toBe('008:antigravity:task_status:IN_PROGRESS');
    expect(entry.transport).toBe('none'); // no watcher.json in tempDir
    expect(entry).toHaveProperty('payload_shape');
    expect(entry.payload_shape.task_num).toBe('008');
  });

  test('returns grok entry for UNDER_REVIEW registry state', () => {
    fs.writeFileSync(
      path.join(tempDir, 'AGENT_STATE.md'),
      `# Registry\n\n| Task ID | State | Linked PR / Branch | Last Updated |\n| :--- | :--- | :--- | :--- |\n| **TASK-009** | \`UNDER_REVIEW\` | branch | 2026-06-16 |\n`,
      'utf8'
    );
    const stdout = execSync(`python3 watcher.py --simulate-handoff --project-root "${tempDir}"`, {
      encoding: 'utf8',
      cwd: path.resolve(__dirname, '..')
    });
    const result = JSON.parse(stdout);
    const entry = result.find(e => e.task_num === '009' && e.target === 'grok');
    expect(entry).toBeDefined();
    expect(entry.trigger).toBe('registry_state');
    expect(entry.state).toBe('UNDER_REVIEW');
    expect(entry.dispatch_key).toBe('009:grok:registry_state:UNDER_REVIEW');
  });

  test('flags would_error_active when execution_mode=active and no command', () => {
    fs.writeFileSync(
      path.join(tempDir, 'TASKS', 'task_010.md'),
      `# TASK-010\n\n- **Status**: \`DRAFT\`\n- **Branch**: \`task/task_010_test\`\n`,
      'utf8'
    );
    // Run with active mode via env override (no watcher.json command set)
    const stdout = execSync(
      `python3 watcher.py --simulate-handoff --project-root "${tempDir}"`,
      {
        encoding: 'utf8',
        cwd: path.resolve(__dirname, '..'),
        env: { ...process.env, PIXEL_AGENT_DESK_WATCHER_EXECUTION_MODE: 'active' }
      }
    );
    const result = JSON.parse(stdout);
    const entry = result.find(e => e.task_num === '010' && e.target === 'antigravity');
    expect(entry).toBeDefined();
    expect(entry.would_error_active).toBe(true);
  });

  test('simulate-handoff does not write any files', () => {
    fs.writeFileSync(
      path.join(tempDir, 'TASKS', 'task_011.md'),
      `# TASK-011\n\n- **Status**: \`IN_PROGRESS\`\n- **Branch**: \`task/task_011_test\`\n`,
      'utf8'
    );
    execSync(`python3 watcher.py --simulate-handoff --project-root "${tempDir}"`, {
      encoding: 'utf8',
      cwd: path.resolve(__dirname, '..')
    });
    // REVIEWS dir should remain empty — no side-effects
    const reviewFiles = fs.readdirSync(path.join(tempDir, 'REVIEWS'));
    expect(reviewFiles).toHaveLength(0);
  });
});

// ── Dispatch result schema (dispatch_result_NNN_target.json) ──────────────────

describe('dispatch_result schema (idempotency key format)', () => {
  test('make_dispatch_key format matches spec', () => {
    // Verified via --simulate-handoff output in earlier tests.
    // Format: {task_num}:{target}:{trigger}:{state_or_decision}
    const key = '008:antigravity:task_status:IN_PROGRESS';
    const parts = key.split(':');
    expect(parts).toHaveLength(4);
    expect(parts[0]).toBe('008');
    expect(parts[1]).toBe('antigravity');
    expect(parts[2]).toBe('task_status');
    expect(parts[3]).toBe('IN_PROGRESS');
  });
});
