# TASK-004: Implement review decision router MVP

- **Status**: `MERGED`
- **Created**: 2026-06-16
- **Created By**: Codex (Layer 1)
- **Assigned To**: Antigravity (Layer 3)
- **Reviewer**: Grok Build (Layer 2)
- **Priority**: `HIGH`
- **Branch**: `task/task_004_review_decision_router`
- **PR URL**: `N/A (local merge @ 8f75d3a)`
- **Linked Review**: [review_004.md](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/REVIEWS/review_004.md)
- **Dependencies**: [TASK-003](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/TASKS/task_003.md)

---

## 1. Objective

Implement the smallest viable automation layer that prevents the human operator from manually relaying each review outcome between agents.

The solution should stay inside the existing repository-native workflow:

- GitHub Actions remains the primary event source for PR opened, synchronized, labeled, and ready-for-review events.
- `REVIEWS/review_NNN.md` remains the authoritative Grok Build decision signal.
- `AGENT_STATE.md` remains the central task registry.
- The first version should route decisions through labels, PR comments, uploaded payload artifacts, and an optional webhook endpoint rather than directly merging branches.

---

## 2. Files Affected

- `[NEW]` [agent-runner/resolve-task.js](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/agent-runner/resolve-task.js)
- `[NEW]` [agent-runner/trigger-review.js](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/agent-runner/trigger-review.js)
- `[NEW]` [agent-runner/dispatch-grok-review.js](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/agent-runner/dispatch-grok-review.js)
- `[NEW]` [agent-runner/validate-review.js](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/agent-runner/validate-review.js)
- `[NEW]` [agent-runner/route-review-decision.js](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/agent-runner/route-review-decision.js)
- `[NEW]` [agent-runner/package.json](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/agent-runner/package.json)
- `[NEW]` [grok-review-dispatcher.yml](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/.github/workflows/grok-review-dispatcher.yml)
- `[NEW]` [review-validator.yml](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/.github/workflows/review-validator.yml)
- `[NEW]` [review-decision-router.yml](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/.github/workflows/review-decision-router.yml)
- `[NEW]` [agentRunner.test.js](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/__tests__/agentRunner.test.js)
- `[MODIFY]` [TEAM_RULES.md](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/TEAM_RULES.md)
- `[MODIFY]` [REVIEWS/README.md](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/REVIEWS/README.md)
- `[MODIFY]` [AGENT_STATE.md](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/AGENT_STATE.md)

---

## 3. Acceptance Criteria

- Add an `agent-runner` script suite that can:
  - resolve a task number from args, environment variables, PR metadata, branch names, or `AGENT_STATE.md`
  - generate a Grok review request
  - dispatch a review request payload to optional `GROK_REVIEW_ENDPOINT`
  - validate that a Grok review is an explicit `APPROVE`
  - route `APPROVE`, `REQUEST_CHANGES`, and `REJECT` decisions into deterministic labels, target states, handoff targets, PR comments, payload artifacts, and optional `HANDOFF_ROUTER_ENDPOINT` webhooks
- Add GitHub workflows for:
  - Grok review dispatch on PR events and `needs-grok-review` labels
  - review validation as a merge gate
  - review decision routing that labels/comments on PRs and uploads handoff payloads
- The router must not directly merge or close PRs in this MVP.
- Missing `REVIEWS/review_NNN.md` should not fail the decision router; it should route as `NONE` and wait for a future PR update.
- `validate-review.js` must continue to fail unless the decision is exactly `APPROVE`.
- Add Jest coverage for task resolution, review decision parsing, route mapping, missing-review behavior, and approval validation.
- Update `TEAM_RULES.md` and `REVIEWS/README.md` to document the decision router contract and generated payload.
- Run `npm test -- --runInBand __tests__/agentRunner.test.js`.
- Run `npm test`.
- Run `git diff --check`.

---

## 4. Non-Goals

- Do not replace GitHub Actions, branch protection, or the existing review file contract.
- Do not introduce n8n, Zapier, or another workflow platform.
- Do not directly merge PRs from the first router version.
- Do not require a webhook endpoint; the router must still be useful with labels, comments, and artifacts only.

---

## 5. Verification Plan

- Unit-test the agent runner route and validation logic.
- Run the full Jest suite.
- Run `git diff --check`.
- Manually inspect the new workflow YAML for permissions and event scope.

---

## 6. Rollback Notes

Remove `.github/workflows/review-decision-router.yml` to disable routing while preserving the existing review validator. Remove `HANDOFF_ROUTER_ENDPOINT` and `HANDOFF_ROUTER_TOKEN` secrets to disable external handoff dispatch without changing code.

Antigravity: implement TASK-004 by adding the review decision router MVP exactly as specified, keeping the first version label/comment/webhook-based rather than auto-merge-based.
