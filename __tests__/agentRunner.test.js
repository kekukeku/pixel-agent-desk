const fs = require('fs');
const os = require('os');
const path = require('path');

const { normalizeTaskNum, resolveTaskNum } = require('../agent-runner/resolve-task');
const {
  buildRoutePayload,
  extractReviewSummary,
  parseReviewDecision
} = require('../agent-runner/route-review-decision');
const { validateReview } = require('../agent-runner/validate-review');

function createTempRepo() {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pad-runner-'));
  fs.mkdirSync(path.join(rootDir, 'TASKS'));
  fs.mkdirSync(path.join(rootDir, 'REVIEWS'));
  return rootDir;
}

function writeTask(rootDir, taskNum = '004') {
  fs.writeFileSync(
    path.join(rootDir, 'TASKS', `task_${taskNum}.md`),
    `# TASK-${taskNum}: Test task\n\n## 1. Objective\n\nTest.\n`,
    'utf8'
  );
}

function writeReview(rootDir, taskNum, decision, extra = '') {
  fs.writeFileSync(
    path.join(rootDir, 'REVIEWS', `review_${taskNum}.md`),
    `# Grok Build Review: TASK-${taskNum}\n\n- **Reviewer**: Grok Build\n- **Decision**: ${decision}\n\n## 1. Review Summary\n\n${extra || 'Summary text.'}\n`,
    'utf8'
  );
}

describe('agent-runner task resolution', () => {
  test('normalizes task ids and branch names', () => {
    expect(normalizeTaskNum('TASK-4')).toBe('004');
    expect(resolveTaskNum({ argv: ['--task', 'TASK-012'], env: {}, cwd: process.cwd() })).toBe('012');
    expect(resolveTaskNum({ argv: [], env: { PR_HEAD_REF: 'task/task_009_router' }, cwd: process.cwd() })).toBe('009');
    expect(resolveTaskNum({ argv: [], env: { PR_TITLE: 'Update router on 2026-06-16' }, cwd: fs.mkdtempSync(path.join(os.tmpdir(), 'pad-empty-')) })).toBeNull();
  });
});

describe('review decision routing', () => {
  test('parses allowed decision lines', () => {
    expect(parseReviewDecision('- **Decision**: APPROVE').decision).toBe('APPROVE');
    expect(parseReviewDecision('Verdict: `REQUEST_CHANGES`').decision).toBe('REQUEST_CHANGES');
    expect(parseReviewDecision('No decision here').decision).toBeNull();
  });

  test('extracts review summary section', () => {
    const review = '# Review\n\n## 1. Review Summary\n\nUseful summary.\n\n## 2. Findings\n\nDetails.';
    expect(extractReviewSummary(review)).toBe('Useful summary.');
  });

  test('returns NONE when review file is absent and not required', () => {
    const rootDir = createTempRepo();
    const payload = buildRoutePayload({ rootDir, taskNum: '004' });

    expect(payload.decision).toBe('NONE');
    expect(payload.labelsToAdd).toEqual([]);
    expect(payload.handoffTarget).toBe('none');
  });

  test('routes APPROVE to merge handoff labels', () => {
    const rootDir = createTempRepo();
    writeReview(rootDir, '004', 'APPROVE', 'Ready to merge.');

    const payload = buildRoutePayload({ rootDir, taskNum: '004' });

    expect(payload.decision).toBe('APPROVE');
    expect(payload.targetState).toBe('APPROVED');
    expect(payload.handoffTarget).toBe('antigravity.merge');
    expect(payload.labelsToAdd).toEqual(['approved-by-grok']);
    expect(payload.labelsToRemove).toContain('needs-antigravity-work');
    expect(payload.comment).toContain('Ready to merge.');
  });

  test('routes REQUEST_CHANGES to executor work labels', () => {
    const rootDir = createTempRepo();
    writeReview(rootDir, '004', 'REQUEST_CHANGES', 'Fix the blocking issue.');

    const payload = buildRoutePayload({ rootDir, taskNum: '004' });

    expect(payload.targetState).toBe('CHANGES_REQUESTED');
    expect(payload.handoffTarget).toBe('antigravity.fix');
    expect(payload.labelsToAdd).toEqual(['changes-requested-by-grok', 'needs-antigravity-work']);
    expect(payload.labelsToRemove).toContain('approved-by-grok');
  });

  test('routes REJECT to operator review labels', () => {
    const rootDir = createTempRepo();
    writeReview(rootDir, '004', 'REJECT', 'Fundamental rules violation.');

    const payload = buildRoutePayload({ rootDir, taskNum: '004' });

    expect(payload.decision).toBe('REJECT');
    expect(payload.targetState).toBe('REJECTED');
    expect(payload.handoffTarget).toBe('operator.review');
    expect(payload.labelsToAdd).toEqual(['rejected-by-grok', 'operator-review-required']);
    expect(payload.labelsToRemove).toContain('approved-by-grok');
    expect(payload.labelsToRemove).toContain('needs-antigravity-work');
  });
});

describe('review validation', () => {
  test('accepts Grok APPROVE reviews', () => {
    const rootDir = createTempRepo();
    writeTask(rootDir, '004');
    writeReview(rootDir, '004', 'APPROVE');

    expect(validateReview({ rootDir, taskNum: '004' })).toContain('TASK-004 approved');
  });

  test('rejects non-approve decisions', () => {
    const rootDir = createTempRepo();
    writeTask(rootDir, '004');
    writeReview(rootDir, '004', 'REQUEST_CHANGES');

    expect(() => validateReview({ rootDir, taskNum: '004' })).toThrow('merge gate requires APPROVE');
  });
});
