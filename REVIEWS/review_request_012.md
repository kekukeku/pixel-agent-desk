# Review Request: Make subscription and API usage metrics honest in dashboard UI (TASK-012)

- **Request ID**: RR-012
- **Linked Task**: [TASK-012](file:///Users/kevinkuo/My Drive/all/Github projects/pixel-agent-desk/TASKS/task_012.md)
- **Author**: Antigravity (Layer 3)
- **Target Branch**: `task/task_012_subscription_usage_ui`
- **Date**: 2026-06-16

---

## 1. Request Details

Revise the dashboard usage/cost UI so it does not imply that subscription-based or TUI-based agents have precise per-token API metering.

Current UI shows values like:

```text
Token Burn (Session): 0
TX: 0 tok
$0.0000
```

For Codex, Antigravity, and Grok Build in the current local workflow, those zeros usually mean "no metered token usage data was reported", not "the agent used zero tokens" or "the work cost $0.0000". The UI should make this distinction clear.

Target product behavior:

- API-backed agents with real `tokenUsage` continue to show token and estimated cost metrics.
- Subscription/TUI/local agents without `tokenUsage` show an honest unavailable/subscription state instead of fake zero token/cost values.
- Overview KPIs prioritize workflow activity over metered API cost.
- The Token Usage page remains available, but it should be framed as API/metered usage only and should explain that subscription/TUI agents show activity/session duration rather than cost.

This task is UI/product work only. Do not change watcher dispatch, reviewer adapter, Antigravity handoff, pricing registry values, or agent event semantics.

---

## 2. Changes Summary

- **dashboard.html**: Action: MODIFY
- **dashboard.js**: Action: MODIFY
- **dashboard.css**: Action: MODIFY
- **dashboard-server.test.js**: Action: MODIFY
- **README.md**: Action: MODIFY

---

**Please evaluate these changes and record the decision in `REVIEWS/review_012.md`**.
