const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { generateReviewDiff } = require('../agent-runner/generate-review-diff');

function runGit(repoDir, args) {
  execFileSync('git', args, { cwd: repoDir, stdio: 'pipe' });
}

function initRepo() {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pad-review-diff-'));
  runGit(rootDir, ['init']);
  runGit(rootDir, ['config', 'user.email', 'test@example.com']);
  runGit(rootDir, ['config', 'user.name', 'Test']);

  fs.mkdirSync(path.join(rootDir, 'TASKS'));
  fs.mkdirSync(path.join(rootDir, 'REVIEWS'));
  fs.writeFileSync(path.join(rootDir, 'README.md'), 'base\n');
  runGit(rootDir, ['add', 'README.md']);
  runGit(rootDir, ['commit', '-m', 'base']);
  runGit(rootDir, ['branch', '-M', 'master']);

  return rootDir;
}

describe('generate-review-diff', () => {
  let rootDir;

  beforeEach(() => {
    rootDir = initRepo();
    fs.writeFileSync(
      path.join(rootDir, 'TASKS', 'task_042.md'),
      [
        '# TASK-042: Demo',
        '',
        '- **Branch**: `task/task_042_demo`',
        ''
      ].join('\n')
    );
  });

  afterEach(() => {
    fs.rmSync(rootDir, { recursive: true, force: true });
  });

  test('captures uncommitted working tree diff on master', () => {
    fs.appendFileSync(path.join(rootDir, 'README.md'), 'changed\n');
    const result = generateReviewDiff({ rootDir, taskNum: '042' });
    expect(result.bytes).toBeGreaterThan(0);
    expect(result.strategy).toContain('working tree');
    expect(fs.existsSync(path.join(rootDir, 'REVIEWS', 'review_diff_042.patch'))).toBe(true);
  });

  test('captures committed feature branch diff', () => {
    runGit(rootDir, ['checkout', '-b', 'task/task_042_demo']);
    fs.writeFileSync(path.join(rootDir, 'feature.txt'), 'branch change\n');
    runGit(rootDir, ['add', 'feature.txt']);
    runGit(rootDir, ['commit', '-m', 'feature']);

    const result = generateReviewDiff({ rootDir, taskNum: '042' });
    expect(result.bytes).toBeGreaterThan(0);
    expect(result.strategy).toMatch(/master\.\.\./);
  });

  test('fails loudly when no diff exists', () => {
    expect(() => generateReviewDiff({ rootDir, taskNum: '042' })).toThrow(/empty output/);
  });
});