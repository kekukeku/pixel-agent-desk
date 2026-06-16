# TASK-012: Make subscription and API usage metrics honest in dashboard UI

- **Status**: `MERGED`
- **Created**: 2026-06-16
- **Created By**: Codex (Layer 1)
- **Assigned To**: Antigravity (Layer 3)
- **Reviewer**: Grok Build (Layer 2)
- **Priority**: `MEDIUM`
- **Branch**: `task/task_012_subscription_usage_ui`
- **PR URL**: `N/A (local merge @ 2bbdba8)`
- **Linked Review**: [review_012.md](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/REVIEWS/review_012.md)
- **Dependencies**: [TASK-011](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/TASKS/task_011.md)

---

## 1. Objective

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

## 2. Files Affected

- `[MODIFY]` [dashboard.html](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/dashboard.html)
- `[MODIFY]` [dashboard.js](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/public/dashboard.js)
- `[MODIFY]` [dashboard.css](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/public/dashboard.css)
- `[MODIFY]` [dashboard-server.test.js](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/__tests__/dashboard-server.test.js)
- `[MODIFY]` [README.md](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/README.md)

### Candidate Files

- [dashboard-server.js](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/src/dashboard-server.js) if the UI needs a clearer usage-data flag from the backend.
- [dashboardAdapter.js](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/src/dashboardAdapter.js) if API-backed versus subscription/TUI display state should be normalized server-side.
- Additional focused tests may be added if the existing test layout has a better location than `dashboard-server.test.js`.

---

## 3. Acceptance Criteria

- Overview KPI cards are revised to avoid fake metered-cost semantics for subscription/TUI agents.
- Replace the top-row KPI labels with workflow-first labels:
  - `Active Agents`
  - `Session Activity`
  - `Tasks Today`
  - `Errors (24h)`
- `Session Activity` should use data the app actually has. Acceptable implementations include active/idle event count, currently active sessions, recently updated agents, or a clear `Live`/`Idle` style value.
- `Tasks Today` should use a real source if available, such as `AGENT_STATE.md`/current task events, or show `--` with a clear title if a reliable source is not yet wired. Do not fabricate a number.
- Agent roster cards must not show `TX: 0 tok` and `$0.0000` for agents that do not have real token usage data.
- For agents without token usage, roster cards should show a neutral state such as:

```text
Usage unavailable
Cost: N/A
```

or:

```text
Subscription / No API meter
```

- For agents with real `tokenUsage`, roster cards should continue to show token totals and estimated cost.
- The context gauge should show `--` or be visually disabled when `contextPercent` is unavailable.
- The Token Usage navigation/page remains present.
- Rename or reframe the Token Usage page as API/metered usage. It must include clear copy that:
  - API-backed agents can report token/cost.
  - subscription/TUI agents may not expose token usage.
  - missing usage means unavailable, not zero.
- The usage page should not show `$0.00` as a lifetime spend when no metered data exists. Use `N/A`, `No API meter`, or an explicit empty state.
- Keep the existing pricing registry and cost calculation behavior intact for API-backed agents that do report `token_usage`.
- Update README to document the distinction between metered API usage and subscription/TUI usage.
- Add/update tests for the UI/backend data behavior where practical. At minimum, run:

```bash
npm test -- --runTestsByPath __tests__/dashboard-server.test.js
```

- Manually verify:
  - Subscription/TUI agents without usage no longer show misleading zero token/cost values.
  - A mock/API-backed agent with `tokenUsage` still displays tokens and cost.

---

## 4. Implementation Notes

- Current display logic in `public/dashboard.js` treats missing token usage as zero:

```js
const tokens = formatNum((ag.tokenUsage?.inputTokens || 0) + (ag.tokenUsage?.outputTokens || 0));
const cost = (ag.tokenUsage?.estimatedCost || 0).toFixed(4);
```

This should distinguish "real zero usage" from "no usage data".

- Be careful: `agentManager` currently initializes `tokenUsage` to `{ inputTokens: 0, outputTokens: 0, estimatedCost: 0 }` for many agents. If necessary, infer availability from source/agent type/model/token usage fields, or add a normalized flag such as `usageAvailable` / `meteredUsageAvailable`.
- Prefer a readable helper like `hasMeteredUsage(agent)` to keep the UI logic consistent across KPI cards, roster cards, popovers, and usage charts.
- Avoid turning the UI into a dense settings page. This is a dashboard clarity fix, not a broad redesign.
- Suggested roster display:
  - metered agent: `TX: 1.2K tok` and `$0.0045`
  - unmetered agent: `Usage unavailable` and `Cost: N/A`
- Suggested usage page title: `Metered API Usage`.
- Suggested empty-state copy: `No metered API usage reported. Subscription and TUI agents may not expose token totals.`
- Do not remove API token/cost support; just stop presenting missing data as a precise zero.

---

## 5. Verification Plan

1. Run the focused test suite:

```bash
npm test -- --runTestsByPath __tests__/dashboard-server.test.js
```

2. If UI helper tests are added, run those tests as well.
3. Start the app:

```bash
npm start
```

4. Confirm current watcher agents show subscription/unavailable usage states instead of `TX: 0 tok` and `$0.0000`.
5. Confirm the overview top-row KPIs use the new workflow-first labels.
6. Confirm the Token Usage page is clearly framed as API/metered usage and has a meaningful empty state when no metered data exists.
7. If possible, inject or mock an agent with non-zero `tokenUsage` and confirm the existing token/cost display still works.

---

## 6. Rollback Notes

If the dashboard metrics regress, revert changes to the dashboard UI files and README. Do not revert pricing registry or watcher logic because this task should not modify those systems.

---

小A，請依照 `pixel-agent-desk/TASKS/task_012.md` 改善 dashboard 的 token/cost 顯示，讓訂閱/TUI agent 不再顯示誤導性的 0 token / $0.0000；完成後不要標 `COMPLETED`，請將 `TASKS/task_012.md` 與 `AGENT_STATE.md` 推進到 `UNDER_REVIEW`。
