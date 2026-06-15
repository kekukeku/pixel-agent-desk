# Team Governance Rules

This document defines the development rules, architecture, and workflow for the autonomous development system of this repository.

---

## 1. Three-Agent Architecture & Role Division

The development and merging process is governed by a logical and physical separation of privileges across three specialized agents:

```
+-------------------------------------------------------------+
|                      HUMAN OPERATOR                         |
|  - Sets initial goals and reviews architectural decisions   |
+-------------------------------------------------------------+
                                |
                                v
+-------------------------------------------------------------+
|              CODEX (Layer 1: Planner)                       |
|  - Analyzes requirements & writes TASKS/task_NNN.md         |
|  - Registers tasks in AGENT_STATE.md Central Registry       |
|  - Write-restricted to TASKS/ & AGENT_STATE.md only         |
+-------------------------------------------------------------+
                                |
                                | Task Specification Ready
                                v
+-------------------------------------------------------------+
|          ANTIGRAVITY (Layer 3: Executor)                    |
|  - Implements codebase modifications & creates PR           |
|  - ONLY agent permitted to write or modify codebase files   |
|  - Physical Enforcer: Executes merge after verification     |
+-------------------------------------------------------------+
                                |
                                | Proposed Changes (PR Event)
                                v
+-------------------------------------------------------------+
|             GITHUB ACTIONS / WEBHOOK TRIGGER                |
|  - Dispatches PR diff & task info to Grok Build             |
+-------------------------------------------------------------+
                                |
                                | Event Payload
                                v
+-------------------------------------------------------------+
|             GROK BUILD (Layer 2: Reviewer)                  |
|  - Decision authority (Logical Gate)                        |
|  - Evaluates changes & outputs decision signal               |
|  - Write-restricted to REVIEWS/ folder only                 |
+-------------------------------------------------------------+
                                |
                                | Decision: APPROVE
                                v
+-------------------------------------------------------------+
|             GITHUB BRANCH PROTECTION LAYER                  |
|  - Physical Gate: Enforces block / unlock on main           |
+-------------------------------------------------------------+
```

### Role Matrix

| Component | Layer / Role | Function & Boundaries |
| :--- | :--- | :--- |
| **Codex** | Layer 1: Planner | Gathers context, increments task indices, writes specifications to `TASKS/task_NNN.md`, and updates `AGENT_STATE.md` with `DRAFT` status. **Cannot write to codebase source files or `REVIEWS/`**. |
| **Grok Build** | Layer 2: Reviewer | Evaluates code quality and writes reviews. Produces decision signal (`APPROVE`, `REQUEST_CHANGES`, `REJECT`). **Write-restricted to `REVIEWS/` only**. |
| **Antigravity** | Layer 3: Executor | Implements code changes, creates PRs, runs tests, logs merges in `LOGS/change_log.md`, and executes physical merges once unlocked. **Cannot write to `REVIEWS/`**. |

---

## 2. Naming & Reference Conventions

To ensure absolute traceability and avoid orphaned files, the following naming conventions are strictly enforced:

| Asset | Format | Description / Example |
| :--- | :--- | :--- |
| **Task ID** | `TASK-NNN` | Standardized ID prefix for tracking, e.g. `TASK-001`. |
| **Task File** | `TASKS/task_NNN.md` | E.g. `TASKS/task_001.md`. |
| **Branch Name** | `task/task_NNN_<description>` | E.g. `task/task_001_initialize_governance`. |
| **Review Request File** | `REVIEWS/review_request_NNN.md` | E.g. `REVIEWS/review_request_001.md`. |
| **Review File** | `REVIEWS/review_NNN.md` | E.g. `REVIEWS/review_001.md`. |
| **Log Entry** | Linked to `TASK-NNN` | Appended directly to `LOGS/change_log.md`. |

---

## 3. Pull Request (PR) & Merging Workflow

1. **No Direct Commits**: Commits directly to the `main`/`master` branch are blocked.
2. **Review Signal Required**: No branch can be merged without an explicit `APPROVE` verdict in `REVIEWS/review_NNN.md` authored by Grok Build.
3. **Execution**: Once Grok Build writes the approval and GitHub branch protection status checks pass, Antigravity executes the physical merge.

---

## 4. Event-Driven Review Trigger Contract

To automate reviews, Grok Build does not continuously poll. It relies on GitHub event webhooks:

```
[PR Opened / Synchronized / Labeled "needs-grok-review"]
                   ↓
     [GitHub Actions Review Dispatcher]
                   ↓
 [Run Grok Build Runner with Task Spec + Code Diff]
                   ↓
    [Output REVIEWS/review_NNN.md back to PR]
                   ↓
       [Review Decision Router applies handoff]
```

- **Trigger A (Event-based)**: When a PR is `opened` or `synchronized` (new commits pushed), a GitHub Action triggers the Grok Build review runner.
- **Trigger B (Label-based)**: Manually adding the `needs-grok-review` label to a PR triggers a re-run of the review runner.
- **Trigger C (Local Runner)**: Antigravity can manually trigger the review process locally after opening a PR by executing `cd agent-runner && npm run trigger-review -- NNN` which automatically parses the task markdown and generates the corresponding `REVIEWS/review_request_NNN.md` file.
- **Trigger D (Decision Router)**: When `REVIEWS/review_NNN.md` appears or changes on a PR branch, `.github/workflows/review-decision-router.yml` parses the decision and routes the next handoff through labels, PR comments, uploaded payload artifacts, and the optional `HANDOFF_ROUTER_ENDPOINT` webhook.

### GitHub Actions Implementation

- `.github/workflows/grok-review-dispatcher.yml` runs on PR open, synchronize, reopen, ready-for-review, and the `needs-grok-review` label.
- The dispatcher resolves `TASK-NNN` from `TASK_NUM`, `TASK_ID`, PR branch, PR title, or PR body.
- The dispatcher generates:
  - `REVIEWS/review_request_NNN.md`
  - `REVIEWS/review_diff_NNN.patch`
  - `REVIEWS/grok_payload_NNN.json`
- If repository secrets `GROK_REVIEW_ENDPOINT` and optional `GROK_REVIEW_TOKEN` are configured, the dispatcher posts the payload to that endpoint. If the endpoint is not configured, it uploads the payload as a GitHub Actions artifact for manual or external Grok Build pickup.
- `.github/workflows/review-validator.yml` is the required branch-protection check. It fails unless `REVIEWS/review_NNN.md` exists in the PR branch and contains an explicit Grok Build `APPROVE` decision.
- `.github/workflows/review-decision-router.yml` is the non-blocking handoff router. It does not unlock merge gates by itself; it converts the Grok decision into automation signals:
  - `APPROVE` adds `approved-by-grok` and routes to `antigravity.merge`.
  - `REQUEST_CHANGES` adds `changes-requested-by-grok` and `needs-antigravity-work`, then routes to `antigravity.fix`.
  - `REJECT` adds `rejected-by-grok` and `operator-review-required`, then routes to `operator.review`.
  - Missing reviews route as `NONE` and do not fail the workflow.
- `agent-runner/route-review-decision.js` writes `REVIEWS/handoff_payload_NNN.json` and posts the same payload to `HANDOFF_ROUTER_ENDPOINT` when that secret is configured. `HANDOFF_ROUTER_TOKEN` is sent as a bearer token when present.

### Review Decision File Contract

`REVIEWS/review_NNN.md` must include:

```markdown
# Grok Build Review: TASK-NNN

- **Reviewer**: Grok Build
- **Decision**: APPROVE
```

Allowed decisions are `APPROVE`, `REQUEST_CHANGES`, and `REJECT`. Only `APPROVE` unlocks the merge gate.

---

## 5. Bootstrap Exception Clause

> [!NOTE]
> Example files, setup reviews (such as `review_000.md` or `review_001.md`), and files created during the initial system setup phase are exempt from the sole-authorship rules of Grok Build. They may be generated or modified by Antigravity during repository initialization. Once initialization is finalized, all subsequent reviews must be written exclusively by Grok Build.

---

## 6. GitHub Enforcement Settings Checklist

Configure the following settings on GitHub to enforce this pipeline:
- [ ] **Branch Protection Rule on `main` / `master`**:
  - Require a pull request before merging (minimum 1 approval).
  - Require status checks to pass before merging (specifically, the Review Validation Action check).
  - Block force pushes.
  - Require signed commits.
- [ ] **GitHub Action: Review Validator**:
  - Executes on `pull_request` event. Parses the current `REVIEWS/review_NNN.md` file on the branch. If the decision line is not exactly `APPROVE`, the status check fails, blocking the merge physical gate.
- [ ] **GitHub Action: Grok Review Dispatcher**:
  - Configure `GROK_REVIEW_ENDPOINT` and optional `GROK_REVIEW_TOKEN` repository secrets when an external Grok Build service is available.
  - Require the `Review Validator` status check in branch protection.
- [ ] **GitHub Action: Review Decision Router**:
  - Configure optional `HANDOFF_ROUTER_ENDPOINT` and `HANDOFF_ROUTER_TOKEN` repository secrets when an external/local agent router should receive decision payloads.
  - Confirm repository labels may be created by GitHub Actions, or pre-create `approved-by-grok`, `changes-requested-by-grok`, `needs-antigravity-work`, `rejected-by-grok`, `operator-review-required`, and `needs-grok-review`.
  - Keep auto-merge disabled until the label/comment/webhook handoff path is validated.

---

## 7. Codex Task Document Template

To ensure `trigger-review.js` correctly parses task metadata, Codex (Planner) MUST strictly generate `TASKS/task_NNN.md` according to this exact Markdown layout:

```markdown
# TASK-NNN: [Task Description]

- **Status**: `DRAFT`
- **Created**: YYYY-MM-DD
- **Assigned To**: Antigravity (Layer 3)
- **Reviewer**: Grok Build (Layer 2)
- **Priority**: [HIGH/MEDIUM/LOW]
- **Branch**: `task/task_NNN_description`
- **PR URL**: `https://github.com/example/repo/pull/NNN`
- **Linked Review**: [review_request_NNN.md](file:///absolute/path/to/REVIEWS/review_request_NNN.md)

---

## 1. Objective

[Detailed description of what needs to be solved / objective]

---

## 2. Files Affected

- `[MODIFY]` [file_basename](file:///absolute/path/to/modified_file)
- `[NEW]` [file_basename](file:///absolute/path/to/new_file)
- `[DELETE]` [file_basename](file:///absolute/path/to/deleted_file)

---

## 3. Acceptance Criteria

- [Criterion 1]
- [Criterion 2]
```

### Constraints:
1. **Task ID Selection**: Read `AGENT_STATE.md` registry first and use `max(NNN) + 1` for the next task.
2. **Path Resolution**: Use absolute paths in `file:///` format for links.
3. **Keyword Matches**: Do not alter headings `## 1. Objective` and `## 2. Files Affected` as they are searched literally by regular expressions.
4. **Action Codes**: The file status indicator must be exactly `[MODIFY]`, `[NEW]`, or `[DELETE]` in uppercase inside brackets.

---

## 8. Codex (Layer 1) Task Quality Standards

To ensure task specifications are unambiguous and parseable, Codex must adhere to the following standards when generating a new task file (`TASKS/task_NNN.md`):
1. **Registry Lookup**: Read the central registry in `AGENT_STATE.md` first. Select the next task ID using `max(NNN) + 1`.
2. **Precise Files Affected**:
   - Under `## 2. Files Affected`, list only the files that *must* be created, modified, or deleted using the strict actions `[NEW]`, `[MODIFY]`, or `[DELETE]`.
   - If there are files that are likely to be affected or candidate directories, document them in a separate subsection titled `### Candidate Files` or `### Likely Areas`. Do not use `[NEW]`, `[MODIFY]`, or `[DELETE]` prefixes in the candidate list to prevent parsing errors.
3. **Explicit Testing Requirements**: The `## 3. Acceptance Criteria` must include a specific item stating which test suites to execute or write (e.g. `npm test`, specific test names, or coverage requirements).
4. **Explicit Documentation Requirements**: When a task introduces user-facing features, configuration keys, or workflow changes, the acceptance criteria must specify which documentation files (e.g., `README.md`, `TEAM_RULES.md`) must be updated.
5. **External Reference Validity**: If the task relies on external resources (such as model API pricing), Codex must include verified source URLs and a `updatedAt` timestamp indicating when the reference was last checked.
6. **Antigravity Start Prompt**: Always include a one-sentence instruction for Antigravity at the end of the task file (outside the template structure) to initiate the task cleanly.

---

## 9. Antigravity (Layer 3) Pre-Review Self-Check

Before submitting a Pull Request for review, Antigravity must execute a self-check checklist and document the results. The self-check must verify that:
1. **Acceptance Criteria**: Every acceptance criterion in the task specification has been met, or any deviations are explicitly documented and justified.
2. **Test Execution**: All automated tests required by the task have been executed and passed successfully.
3. **Documentation Updates**: All requested documentation updates (README, configuration guides, etc.) have been implemented.
4. **Backward Compatibility**: Existing functions, API payloads, and interfaces remain compatible unless breaking changes are explicitly authorized in the task.
5. **Dependency & Lockfile Control**: No major dependency version updates or broad lockfile churn are introduced unless requested by the task or justified by critical security/compatibility needs.

---

## 10. Grok Build (Layer 2) Review Guidelines

When reviewing code changes, Grok Build must structure `REVIEWS/review_NNN.md` logically and clearly distinguish feedback urgency:
1. **Urgency Categorization**:
   - **Blocking Issues**: Critical defects, broken tests, failure to satisfy acceptance criteria, security issues, or violations of architecture boundaries. These must be resolved before approval is granted.
   - **Non-Blocking Notes**: Architectural suggestions, alternative design patterns, code style preferences, or performance optimizations that do not block the functional correctness of the task.
   - **Optional Follow-ups**: Non-critical suggestions or refactoring ideas to be deferred to future tasks.
2. **Tradeoffs and Side Effects**: When suggesting architectural changes (e.g., adding asynchronous operations, background processing, caching, or adding external packages), Grok Build must document the associated tradeoffs, side effects, and potential impacts on performance or reliability.

---

## 11. Post-Merge Reconciliation & Metadata Alignment

Upon merging a task branch to the `main` or `master` branch, Antigravity is responsible for performing a reconciliation check to ensure repository metadata remains aligned:
1. **Registry Updates**: Update `AGENT_STATE.md` with the task's final state `MERGED` and log the exact merged date.
2. **Task File Updates**: Update `TASKS/task_NNN.md` to transition its `Status` to `MERGED`.
3. **Metadata Enrichment**:
   - Fill in `PR URL` with the actual PR link (or `N/A (local merge @ <commit-sha>)` if merged locally).
   - Point `Linked Review` to the final review document `REVIEWS/review_NNN.md`.
4. **Log Registry**: Append an entry summarizing the change to `LOGS/change_log.md`.
5. **Validation Artifacts**: Ensure review documents (`REVIEWS/review_NNN.md` and the validation summary `REVIEWS/validation_master_NNN.md`) and the code branch history are properly archived and aligned in the main branch.
