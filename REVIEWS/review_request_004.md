# Review Request: Implement review decision router MVP (TASK-004)

- **Request ID**: RR-004
- **Linked Task**: [TASK-004](file:///Users/kevinkuo/My Drive/all/Github projects/pixel-agent-desk/TASKS/task_004.md)
- **Author**: Antigravity (Layer 3)
- **Target Branch**: `task/task_004_review_decision_router`
- **Date**: 2026-06-15

---

## 1. Request Details

Implement the smallest viable automation layer that prevents the human operator from manually relaying each review outcome between agents.

The solution should stay inside the existing repository-native workflow:

- GitHub Actions remains the primary event source for PR opened, synchronized, labeled, and ready-for-review events.
- `REVIEWS/review_NNN.md` remains the authoritative Grok Build decision signal.
- `AGENT_STATE.md` remains the central task registry.
- The first version should route decisions through labels, PR comments, uploaded payload artifacts, and an optional webhook endpoint rather than directly merging branches.

---

## 2. Changes Summary

- **agent-runner/resolve-task.js**: Action: NEW
- **agent-runner/trigger-review.js**: Action: NEW
- **agent-runner/dispatch-grok-review.js**: Action: NEW
- **agent-runner/validate-review.js**: Action: NEW
- **agent-runner/route-review-decision.js**: Action: NEW
- **agent-runner/package.json**: Action: NEW
- **grok-review-dispatcher.yml**: Action: NEW
- **review-validator.yml**: Action: NEW
- **review-decision-router.yml**: Action: NEW
- **agentRunner.test.js**: Action: NEW
- **TEAM_RULES.md**: Action: MODIFY
- **REVIEWS/README.md**: Action: MODIFY
- **AGENT_STATE.md**: Action: MODIFY

---

**Please evaluate these changes and record the decision in `REVIEWS/review_004.md`**.
