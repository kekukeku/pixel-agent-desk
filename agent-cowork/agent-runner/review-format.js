const { parseReviewDecision } = require('./route-review-decision');

const ALLOWED_DECISIONS = ['APPROVE', 'REQUEST_CHANGES', 'REJECT'];

function normalizeDecision(value) {
  if (!value) return null;
  const upper = String(value).trim().toUpperCase();
  return ALLOWED_DECISIONS.includes(upper) ? upper : null;
}

function extractDecisionFromModelText(text) {
  const parsed = parseReviewDecision(text);
  return normalizeDecision(parsed.decision);
}

function buildReviewDocument({ taskId, taskNum, reviewerName, decision, summary, findings = {}, tradeoffs = '' }) {
  const blocking = findings.blocking || [];
  const nonBlocking = findings.nonBlocking || [];
  const optional = findings.optional || [];

  const blockingSection = blocking.length
    ? blocking.map(item => `- ${item}`).join('\n')
    : '- None.';

  const nonBlockingSection = nonBlocking.length
    ? nonBlocking.map(item => `- ${item}`).join('\n')
    : '- None.';

  const optionalSection = optional.length
    ? optional.map(item => `- ${item}`).join('\n')
    : '- None.';

  const tradeoffsSection = tradeoffs.trim() || 'No additional tradeoffs documented.';

  return `# Reviewer Review: ${taskId}

- **Reviewer**: ${reviewerName}
- **Decision**: ${decision}

---

## 1. Review Summary

${summary.trim()}

---

## 2. Detailed Findings

### Blocking Issues

${blockingSection}

### Non-Blocking Notes

${nonBlockingSection}

### Optional Follow-ups

${optionalSection}

---

## 3. Tradeoffs & Architectural Analysis

${tradeoffsSection}

---

*Review authored by ${reviewerName} via local reviewer adapter.*
`;
}

function buildEngineFailureReview({ taskId, taskNum, reviewerName, errorMessage }) {
  return buildReviewDocument({
    taskId,
    taskNum,
    reviewerName,
    decision: 'REQUEST_CHANGES',
    summary: `Automated review engine failed for ${taskId}. Manual reviewer intervention or engine configuration is required.`,
    findings: {
      blocking: [
        `Review engine error: ${errorMessage}`,
        'Verify `XAI_API_KEY` / `REVIEWER_ENGINE` configuration and inspect `REVIEWS/review_job_' + taskNum + '.json`.'
      ]
    },
    tradeoffs: 'Dispatch was accepted asynchronously; failure was recorded in the review file to avoid a silent stall.'
  });
}

module.exports = {
  ALLOWED_DECISIONS,
  buildEngineFailureReview,
  buildReviewDocument,
  extractDecisionFromModelText,
  normalizeDecision
};