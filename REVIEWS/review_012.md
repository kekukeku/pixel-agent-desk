# Grok Build Review: TASK-012

- **Reviewer**: Grok Build
- **Decision**: APPROVE

---

## 1. Review Summary

Evaluated branch `task/task_012_subscription_usage_ui` against `TASKS/task_012.md` and `REVIEWS/review_request_012.md` using `REVIEWS/review_diff_012.patch`. Grok Build also ran the task-specified test suites locally.

The implementation delivers the intended product clarity fix: subscription/TUI agents no longer present misleading `TX: 0 tok` / `$0.0000` values, workflow-first KPI labels are in place, and the usage view is reframed as metered API usage with an honest empty state. Server-side normalization via `usageAvailable` in `dashboardAdapter.js` keeps the UI logic consistent across roster cards, popovers, and API responses. Scope stayed within dashboard UI, adapter normalization, README, and tests — no watcher, reviewer adapter, pricing registry, or agent-event semantics changes.

| Check | Result |
| :--- | :--- |
| KPI labels: Active Agents, Session Activity, Tasks Today, Errors (24h) | **PASS** |
| Session Activity uses real workflow signal (Live / Idle) | **PASS** |
| Tasks Today shows `--` without fabricating a count | **PASS** |
| Unmetered roster cards show Usage unavailable / Cost: N/A | **PASS** |
| Metered agents retain token and cost display | **PASS** |
| Context gauge disabled (`--`) when usage unavailable | **PASS** |
| Nav/page reframed as Metered API Usage with explanatory copy | **PASS** |
| Usage totals/charts use N/A + empty state when no metered data | **PASS** |
| README documents metered vs. subscription/TUI distinction | **PASS** |
| `npm test -- --runTestsByPath __tests__/dashboard-server.test.js` | **PASS** (48 tests) |
| `__tests__/dashboardAdapter.test.js` (added assertions) | **PASS** (18 tests) |
| `AGENT_STATE.md` registers TASK-012 as `UNDER_REVIEW` | **PASS** |

---

## 2. Detailed Findings

### Blocking Issues

- None.

### Non-Blocking Notes

- **Model-prefix heuristic is partial** — `usageAvailable` / `hasMeteredUsage()` infer metered capability from `claude`, `gpt`, and `gemini` model prefixes. xAI Grok and other API providers not matching that regex rely on non-zero token/cost fields or an explicit `usageAvailable` flag. This is acceptable for the current local workflow (Codex, Antigravity, Grok Build TUI agents) but may need extension if additional API-backed model families are added.
- **Duplicated availability logic** — the same inference rules appear in `src/dashboardAdapter.js`, `public/dashboard.js` (`hasMeteredUsage`), and the Jest mock in `dashboard-server.test.js`. A shared helper would reduce drift risk; not required for this UI-only task.
- **`recalcStats()` still aggregates `totalTokens` / `totalCost`** but no longer surfaces them in KPIs. Harmless dead work today; could be trimmed in a follow-up.
- **`.gitignore` `Icon?` entry** is unrelated to TASK-012 scope. Low risk; no functional impact.
- **Usage-page banner uses inline styles** rather than `dashboard.css`. Consistent with a quick clarity fix but slightly diverges from the rest of the stylesheet-driven UI.

### Optional Follow-ups

- Add a focused unit test (or DOM-level test) for `hasMeteredUsage()` edge cases: zero-token API agent with `claude-*` model vs. subscription agent with null model.
- Extend the model-prefix allowlist (or source-based flag) when xAI Grok API metering is wired end-to-end.
- Wire **Tasks Today** to a real source (`AGENT_STATE.md` events or task registry) in a future task instead of the permanent `--` placeholder.
- Move the usage-info banner styles into `dashboard.css` for maintainability.

---

## 3. Tradeoffs & Architectural Analysis

**Server-side `usageAvailable` flag** normalizes display state at the adapter boundary so the dashboard client and API consumers share one contract. Tradeoff: inference heuristics (model prefix, non-zero tokens) must stay aligned between adapter and client-side `hasMeteredUsage()` fallback. The client duplicate is a reasonable defensive layer for stale cached agent payloads but introduces a mild maintenance burden.

**Live / Idle Session Activity KPI** replaces aggregate token burn with a signal the app already owns (working/thinking agent count). This correctly prioritizes workflow visibility over fake metered totals. Tradeoff: operators lose at-a-glance session token burn on the overview; that data remains on the Metered API Usage page when metered agents report it.

**Tasks Today placeholder (`--`)** satisfies the acceptance criterion to avoid fabricated numbers when no reliable source is wired. Tradeoff: the KPI row is informative in label only until a future task connects a task-counter data source.

**Usage view empty-state gating** (`tTok > 0 || tCost > 0`) hides zero-valued charts and shows explicit copy instead of `$0.00` / empty bars. Tradeoff: a metered API session with genuinely zero lifetime totals would also hit the empty state; that is rarer and still more honest than implying precision where none exists.

**Scope discipline preserved** — pricing calculation, watcher dispatch, and reviewer plumbing are untouched. The change is reversible by reverting dashboard UI, adapter flag, README, and tests per task rollback notes.

**Merge gate unlocked.** Antigravity may merge to `master` and perform §12 post-merge reconciliation (`AGENT_STATE.md`, `TASKS/task_012.md`, `LOGS/change_log.md`).

---

*Review authored by Grok Build (Layer 2).*
