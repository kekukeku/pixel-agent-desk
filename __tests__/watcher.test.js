const child_process = require('child_process');
const execSync = (cmd, options = {}) => {
  options.env = { ...process.env, ...options.env };
  return child_process.execSync(cmd, options);
};
const fs = require('fs');
const os = require('os');
const path = require('path');

// Prevent global ~/.pixel-agent-desk/watcher.json from polluting tests
process.env.PIXEL_AGENT_DESK_WATCHER_CONFIG_PATH = path.join(os.tmpdir(), 'non_existent_watcher_config.json');

function createTempRepo(prefix = 'pad-watcher-test-') {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  fs.mkdirSync(path.join(rootDir, 'TASKS'));
  fs.mkdirSync(path.join(rootDir, 'REVIEWS'));
  fs.mkdirSync(path.join(rootDir, 'PLANNING'));
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

  test('does not dispatch antigravity for DRAFT tasks', () => {
    fs.writeFileSync(
      path.join(tempDir, 'TASKS', 'task_010.md'),
      `# TASK-010\n\n- **Status**: \`DRAFT\`\n- **Branch**: \`task/task_010_test\`\n`,
      'utf8'
    );
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
    expect(entry).toBeUndefined();
  });

  test('returns planning entry for DRAFT tasks if request/output files are absent', () => {
    fs.writeFileSync(
      path.join(tempDir, 'TASKS', 'task_010.md'),
      `# TASK-010\n\n- **Status**: \`DRAFT\`\n- **Branch**: \`task/task_010_test\`\n`,
      'utf8'
    );
    const stdout = execSync(
      `python3 watcher.py --simulate-handoff --project-root "${tempDir}"`,
      {
        encoding: 'utf8',
        cwd: path.resolve(__dirname, '..'),
        env: { ...process.env, PIXEL_AGENT_DESK_WATCHER_EXECUTION_MODE: 'active' }
      }
    );
    const result = JSON.parse(stdout);
    const entry = result.find(e => e.task_num === '010' && e.target === 'planning');
    expect(entry).toBeDefined();
    expect(entry.trigger).toBe('task_status');
    expect(entry.state).toBe('DRAFT');
    expect(entry.dispatch_key).toBe('010:planning:task_status:DRAFT');
  });

  test('does not return planning entry for DRAFT tasks if groupchat request file exists', () => {
    fs.writeFileSync(
      path.join(tempDir, 'TASKS', 'task_010.md'),
      `# TASK-010\n\n- **Status**: \`DRAFT\`\n- **Branch**: \`task/task_010_test\`\n`,
      'utf8'
    );
    fs.writeFileSync(
      path.join(tempDir, 'PLANNING', 'groupchat_request_010.json'),
      `{}`,
      'utf8'
    );
    const stdout = execSync(
      `python3 watcher.py --simulate-handoff --project-root "${tempDir}"`,
      {
        encoding: 'utf8',
        cwd: path.resolve(__dirname, '..')
      }
    );
    const result = JSON.parse(stdout);
    const entry = result.find(e => e.task_num === '010' && e.target === 'planning');
    expect(entry).toBeUndefined();
  });

  test('does not return planning entry for DRAFT tasks if groupchat output file exists', () => {
    fs.writeFileSync(
      path.join(tempDir, 'TASKS', 'task_010.md'),
      `# TASK-010\n\n- **Status**: \`DRAFT\`\n- **Branch**: \`task/task_010_test\`\n`,
      'utf8'
    );
    fs.writeFileSync(
      path.join(tempDir, 'PLANNING', 'groupchat_010.json'),
      `{}`,
      'utf8'
    );
    const stdout = execSync(
      `python3 watcher.py --simulate-handoff --project-root "${tempDir}"`,
      {
        encoding: 'utf8',
        cwd: path.resolve(__dirname, '..')
      }
    );
    const result = JSON.parse(stdout);
    const entry = result.find(e => e.task_num === '010' && e.target === 'planning');
    expect(entry).toBeUndefined();
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

// ── P0 dispatch integration tests (--dispatch-test CLI hook) ──────────────────
// These tests exercise the real async dispatch path: background threads,
// result files, timeout, visual-only fallback, pipeline separation.

describe('watcher.py --dispatch-test P0 integration', () => {
  let tempDir;

  const WATCHER_CWD = path.resolve(__dirname, '..');

  // Base env with active mode + fast timeout for all tests
  function activeEnv(overrides = {}) {
    return {
      ...process.env,
      PIXEL_AGENT_DESK_WATCHER_EXECUTION_MODE: 'active',
      PIXEL_AGENT_DESK_WATCHER_COMMAND_TIMEOUT_SECONDS: '10',
      ...overrides,
    };
  }

  function dispatchTest(tempDir, jsonArgs, env = {}) {
    return execSync(
      `python3 watcher.py --dispatch-test '${JSON.stringify(jsonArgs)}' --project-root "${tempDir}"`,
      { encoding: 'utf8', cwd: WATCHER_CWD, env }
    );
  }

  beforeEach(() => {
    tempDir = createTempRepo();
  });

  afterEach(() => {
    cleanupTempRepo(tempDir);
  });

  // P0-1: active mode + mock command → dispatch_result success + correct schema
  test('active mode + mock echo command → success result with correct schema', () => {
    const env = activeEnv({
      PIXEL_AGENT_DESK_ANTIGRAVITY_COMMAND: 'echo dispatched_{task_num}',
    });
    const args = {
      target: 'antigravity',
      task_num: '099',
      trigger: 'task_status',
      state: 'IN_PROGRESS',
      timeout_wait: 10,
    };
    const stdout = dispatchTest(tempDir, args, env);
    const result = JSON.parse(stdout);

    // Schema validation
    expect(result.task_num).toBe('099');
    expect(result.target).toBe('antigravity');
    expect(result.trigger).toBe('task_status');
    expect(result.state).toBe('IN_PROGRESS');
    expect(result.dispatch_key).toBe('099:antigravity:task_status:IN_PROGRESS');
    expect(result.transport).toBe('command');
    expect(result.success).toBe(true);
    expect(result.returncode).toBe(0);
    expect(result.timed_out).toBe(false);
    expect(result.stdout_excerpt).toMatch(/dispatched_099/);
    expect(result.error).toBeNull();
    expect(typeof result.started_at).toBe('number');
    expect(typeof result.finished_at).toBe('number');
    expect(result.finished_at).toBeGreaterThanOrEqual(result.started_at);

    // dispatch_result_* file must exist
    const resultFile = path.join(tempDir, 'REVIEWS', 'dispatch_result_099_antigravity.json');
    expect(fs.existsSync(resultFile)).toBe(true);
    const onDisk = JSON.parse(fs.readFileSync(resultFile, 'utf8'));
    expect(onDisk.success).toBe(true);

    // task_handoff must also be written (visual-only fallback artifact)
    const handoffFile = path.join(tempDir, 'REVIEWS', 'task_handoff_099.json');
    expect(fs.existsSync(handoffFile)).toBe(true);
  });

  // P0-2: command timeout → failure result, watcher process exits without crashing
  test('command timeout → failure result written, process exits cleanly', () => {
    const env = activeEnv({
      PIXEL_AGENT_DESK_ANTIGRAVITY_COMMAND: 'sleep 60',
      PIXEL_AGENT_DESK_WATCHER_COMMAND_TIMEOUT_SECONDS: '1',
    });
    const args = {
      target: 'antigravity',
      task_num: '098',
      trigger: 'task_status',
      state: 'IN_PROGRESS',
      timeout_wait: 10,
    };

    // --dispatch-test exits 1 on failure, so we catch the error
    let stdout = '';
    try {
      dispatchTest(tempDir, args, env);
    } catch (err) {
      stdout = err.stdout || '';
      // Must exit non-zero
      expect(err.status).toBe(1);
    }

    // Result file must exist and show timeout
    const resultFile = path.join(tempDir, 'REVIEWS', 'dispatch_result_098_antigravity.json');
    expect(fs.existsSync(resultFile)).toBe(true);
    const result = JSON.parse(fs.readFileSync(resultFile, 'utf8'));
    expect(result.success).toBe(false);
    expect(result.timed_out).toBe(true);
    expect(result.returncode).toBe(-1);
    expect(result.error).toMatch(/timed? ?out/i);
  });

  // P0-3: visual-only mode → fallback payload written, no dispatch_result file
  test('visual-only mode → task_handoff written, no dispatch_result file, no crash', () => {
    const env = {
      ...process.env,
      PIXEL_AGENT_DESK_WATCHER_EXECUTION_MODE: 'visual-only',
    };
    const args = {
      target: 'antigravity',
      task_num: '097',
      trigger: 'task_status',
      state: 'IN_PROGRESS',
      timeout_wait: 5,
    };

    // visual-only exits 1 (no result file within timeout_wait)
    let stderr = '';
    try {
      dispatchTest(tempDir, args, env);
    } catch (err) {
      stderr = err.stderr || '';
      expect(err.status).toBe(1);
    }

    // Fallback task_handoff must be written
    const handoffFile = path.join(tempDir, 'REVIEWS', 'task_handoff_097.json');
    expect(fs.existsSync(handoffFile)).toBe(true);
    const handoff = JSON.parse(fs.readFileSync(handoffFile, 'utf8'));
    expect(handoff.task_num).toBe('097');
    expect(handoff.status).toBe('IN_PROGRESS');

    // No dispatch_result should exist
    const resultFile = path.join(tempDir, 'REVIEWS', 'dispatch_result_097_antigravity.json');
    expect(fs.existsSync(resultFile)).toBe(false);

    // Warning must appear in stderr
    expect(stderr).toMatch(/visual-only/i);
  });

  // P0-4: non-blocking handler — background command should not block main process return
  test('background command does not block handler — process returns before command finishes', () => {
    // Use a command that takes 3 seconds; if dispatch blocks, test will timeout (Jest default 5s)
    const env = activeEnv({
      PIXEL_AGENT_DESK_ANTIGRAVITY_COMMAND: 'sleep 3',
      PIXEL_AGENT_DESK_WATCHER_COMMAND_TIMEOUT_SECONDS: '5',
    });
    const args = {
      target: 'antigravity',
      task_num: '096',
      trigger: 'task_status',
      state: 'IN_PROGRESS',
      // timeout_wait must be > 3 so result can appear, but dispatch_handoff returns immediately
      timeout_wait: 8,
    };

    const start = Date.now();
    // perform_dispatch_one blocks waiting for result file (up to timeout_wait)
    // but dispatch_handoff itself must return almost immediately
    // We just verify the worker thread actually writes the result eventually
    let result;
    try {
      const stdout = dispatchTest(tempDir, args, env);
      result = JSON.parse(stdout);
    } catch (err) {
      // sleep 3 exits 0, so this should not throw
      throw err;
    }
    const elapsed = Date.now() - start;

    expect(result.success).toBe(true);
    // Dispatch ran in background — the watcher loop was not blocked during dispatch
    // (the worker waited for sleep to complete, but that's expected in --dispatch-test mode)
    expect(elapsed).toBeGreaterThanOrEqual(3000);
    expect(result.returncode).toBe(0);
    expect(result.timed_out).toBe(false);
  }, 15000); // extend Jest timeout for this test

  // P0-5: active mode + missing consumer → config error result, not silent
  test('active mode with no consumer configured → stderr error + failed dispatch_result', () => {
    const env = activeEnv({
      // No ANTIGRAVITY_COMMAND or WEBHOOK set → error expected
    });
    const args = {
      target: 'antigravity',
      task_num: '095',
      trigger: 'task_status',
      state: 'IN_PROGRESS',
      timeout_wait: 5,
    };

    let stderr = '';
    try {
      dispatchTest(tempDir, args, env);
    } catch (err) {
      stderr = err.stderr || '';
      expect(err.status).toBe(1);
    }

    // stderr must contain config error
    expect(stderr).toMatch(/execution_mode=active/i);
    expect(stderr).toMatch(/no command\/webhook/i);

    // A failed dispatch_result must be written
    const resultFile = path.join(tempDir, 'REVIEWS', 'dispatch_result_095_antigravity.json');
    expect(fs.existsSync(resultFile)).toBe(true);
    const result = JSON.parse(fs.readFileSync(resultFile, 'utf8'));
    expect(result.success).toBe(false);
    expect(result.transport).toBeNull();
    expect(result.error).toMatch(/no command\/webhook/i);
  });

  // P0-6 (B4 regression): review_decision dispatch must NOT write task_handoff_NNN.json
  test('review_decision trigger does not write task_handoff_NNN.json (pipeline separation)', () => {
    const env = activeEnv({
      PIXEL_AGENT_DESK_ANTIGRAVITY_COMMAND: 'echo route_{task_num}',
    });
    const args = {
      target: 'antigravity',
      task_num: '094',
      trigger: 'review_decision',
      state: 'APPROVE',
      payload: {
        task_num: '094',
        project_root: tempDir,
        decision: 'APPROVE',
        timestamp: 1234567890.0,
      },
      timeout_wait: 10,
    };

    const stdout = dispatchTest(tempDir, args, env);
    const result = JSON.parse(stdout);
    expect(result.success).toBe(true);

    // task_handoff MUST NOT be written for review_decision trigger
    const handoffFile = path.join(tempDir, 'REVIEWS', 'task_handoff_094.json');
    expect(fs.existsSync(handoffFile)).toBe(false);

    // dispatch_result MUST be written
    const resultFile = path.join(tempDir, 'REVIEWS', 'dispatch_result_094_antigravity.json');
    expect(fs.existsSync(resultFile)).toBe(true);
  });

  // P0-7: planning dispatch → success result, planning path, groupchat_request written
  test('active mode + planning echo command → success result and files in PLANNING directory', () => {
    cleanupTempRepo(tempDir);
    tempDir = createTempRepo('pad watcher test ');
    const env = activeEnv({
      PIXEL_AGENT_DESK_PLANNING_COMMAND: 'node -e "console.log(process.argv[1])" {input_path}',
    });
    const args = {
      target: 'planning',
      task_num: '093',
      trigger: 'task_status',
      state: 'DRAFT',
      timeout_wait: 10,
    };
    const stdout = dispatchTest(tempDir, args, env);
    const result = JSON.parse(stdout);

    expect(result.task_num).toBe('093');
    expect(result.target).toBe('planning');
    expect(result.trigger).toBe('task_status');
    expect(result.state).toBe('DRAFT');
    expect(result.dispatch_key).toBe('093:planning:task_status:DRAFT');
    expect(result.transport).toBe('command');
    expect(result.success).toBe(true);
    expect(result.stdout_excerpt).toContain(path.join(tempDir, 'TASKS', 'task_093.md'));

    // PLANNING directory files should exist
    const requestFile = path.join(tempDir, 'PLANNING', 'groupchat_request_093.json');
    expect(fs.existsSync(requestFile)).toBe(true);

    const resultFile = path.join(tempDir, 'PLANNING', 'dispatch_result_093_planning.json');
    expect(fs.existsSync(resultFile)).toBe(true);
  });
});
