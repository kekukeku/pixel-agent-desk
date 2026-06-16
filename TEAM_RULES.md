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
|    as DRAFT                                                 |
|  - Registers tasks in AGENT_STATE.md Central Registry       |
|  - Write-restricted to TASKS/, AGENT_STATE.md,              |
|    and colleagueview/ only                                  |
+-------------------------------------------------------------+
                                |
                                | Draft Task Specification
                                v
+-------------------------------------------------------------+
|             GROK BUILD (Layer 2: Advisory)                  |
|  - Reviews the draft task before implementation             |
|  - Writes non-binding planning advice to REVIEWS/           |
+-------------------------------------------------------------+
                                |
                                | Planning Advice
                                v
+-------------------------------------------------------------+
|              CODEX (Layer 1: Finalizer)                     |
|  - Accepts, rejects, or adapts Grok advice at own judgment  |
|  - Finalizes task and moves it to IN_PROGRESS               |
+-------------------------------------------------------------+
                                |
                                | Final Task Specification Ready
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
|  - Write-restricted to REVIEWS/ and colleagueview/ only     |
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
| **Codex** | Layer 1: Planner / Finalizer | Gathers context, increments task indices, writes draft specifications to `TASKS/task_NNN.md`, registers `DRAFT` in `AGENT_STATE.md`, considers Grok Build's planning advice, then finalizes and releases the task by moving it to `IN_PROGRESS`. May also write retrospective colleague feedback to `colleagueview/`. **Cannot write to codebase source files or `REVIEWS/` unless explicitly authorized by the human operator**. |
| **Grok Build** | Layer 2: Advisory / Reviewer | First gives non-binding planning advice on draft tasks, then later performs formal implementation review. Formal review produces decision signal (`APPROVE`, `REQUEST_CHANGES`, `REJECT`). May also write retrospective colleague feedback to `colleagueview/`. **Write-restricted to `REVIEWS/` and `colleagueview/` only**. |
| **Antigravity** | Layer 3: Executor | Implements code changes, creates PRs, runs tests, logs merges in `LOGS/change_log.md`, and executes physical merges once unlocked. May also write retrospective colleague feedback to `colleagueview/`. **Cannot write to `REVIEWS/`**. |

---

## 2. Naming & Reference Conventions

To ensure absolute traceability and avoid orphaned files, the following naming conventions are strictly enforced:

| Asset | Format | Description / Example |
| :--- | :--- | :--- |
| **Task ID** | `TASK-NNN` | Standardized ID prefix for tracking, e.g. `TASK-001`. |
| **Task File** | `TASKS/task_NNN.md` | E.g. `TASKS/task_001.md`. |
| **Branch Name** | `task/task_NNN_<description>` | E.g. `task/task_001_initialize_governance`. |
| **Task Advice File** | `REVIEWS/task_advice_NNN.md` | Non-binding Grok Build planning advice for draft tasks, e.g. `REVIEWS/task_advice_001.md`. |
| **Review Request File** | `REVIEWS/review_request_NNN.md` | E.g. `REVIEWS/review_request_001.md`. |
| **Review File** | `REVIEWS/review_NNN.md` | E.g. `REVIEWS/review_001.md`. |
| **Log Entry** | Linked to `TASK-NNN` | Appended directly to `LOGS/change_log.md`. |
| **Colleague View** | `colleagueview/<agent>_view_NNN.md` | E.g. `colleagueview/codex_view_010.md`. |

---

## 3. Pull Request (PR) & Merging Workflow

1. **No Direct Commits**: Commits directly to the `main`/`master` branch are blocked.
2. **Review Signal Required**: No branch can be merged without an explicit `APPROVE` verdict in `REVIEWS/review_NNN.md` authored by Grok Build.
3. **Execution**: Once Grok Build writes the approval and GitHub branch protection status checks pass, Antigravity executes the physical merge.

#### Local Watcher State Contract

- Codex creates new tasks as `DRAFT`. `DRAFT` is planning-only and must not trigger Antigravity.
- When a task enters `DRAFT`, the watcher dispatches the consultative GroupChat planning/advisory runner (Trigger A).
- The GroupChat runner conducts a visible, seven-step planning conversation involving Codex (Planner, `codex`), Grok Build (Reviewer, `grok-build`), and Antigravity (Executor, `antigravity`).
- The planning conversation outputs structured v1 JSON (`PLANNING/groupchat_<sessionId>.json`), a human-readable markdown transcript (`PLANNING/groupchat_<sessionId>.md`), and a final plan proposal (`PLANNING/draft_<sessionId>.md`).
- Codex reads the GroupChat artifacts, judges which suggestions from Grok Build or Antigravity to adopt (or modify/reject), and remains the final authority for the task specification. No approval from other agents is required to proceed.
- Codex releases the finalized task by moving both `TASKS/task_NNN.md` and the `AGENT_STATE.md` row to `IN_PROGRESS` (Trigger B).
- The watcher dispatches Antigravity only for `IN_PROGRESS` task status changes (Trigger C). It must not dispatch executor work for `DRAFT`.
- Antigravity must mark implementation complete by moving the task to `UNDER_REVIEW` in `AGENT_STATE.md` (and keeping task metadata aligned). It must not use `COMPLETED`.
- `UNDER_REVIEW` is the only local state that triggers Grok Build review dispatch (Trigger F).
- Legacy Compatibility: The single-agent advisory file `REVIEWS/task_advice_NNN.md` remains documented and supported only as a compatibility fallback for projects that have not migrated to the consultative GroupChat planning workflow.

---

## 4. Event-Driven Review Trigger Contract

To automate advisory and review work, Grok Build does not continuously poll. It relies on local watcher triggers and GitHub event webhooks:

```
[TASKS/task_NNN.md + AGENT_STATE.md -> DRAFT]
                   ↓
        [Local Watcher Advisory Dispatcher]
                   ↓
      [GroupChat Planning Runner generates]
     [PLANNING/groupchat_NNN.* & draft_NNN.md]
                   ↓
        [Codex finalizes task -> IN_PROGRESS]
                   ↓
           [Antigravity implementation]
                   ↓
  [PR Opened / Synchronized / Local UNDER_REVIEW]
                   ↓
       [Review Dispatcher / Local Watcher]
                   ↓
         [Grok Build writes review_NNN.md]
                   ↓
         [Decision Router applies handoff]
```

- **Trigger A (Draft Advisory / Consultative GroupChat)**: When Codex creates or updates a task in `DRAFT`, the local watcher dispatches the consultative GroupChat planning runner. The runner generates a visible 7-step conversation timeline and final plan under `PLANNING/groupchat_<sessionId>.*` and `PLANNING/draft_<sessionId>.md`. If GroupChat is not enabled/supported in the target repository, it falls back to single-agent advisory where Grok Build writes `REVIEWS/task_advice_NNN.md`.
- **Trigger B (Codex Finalization)**: When the consultative planning output files (`PLANNING/groupchat_request_<sessionId>.json` or `REVIEWS/task_advice_NNN.md`) are resolved, Codex reviews the advice, accepts or rejects suggestions at its own judgment, edits the task if needed, and releases the task by moving it to `IN_PROGRESS`.
- **Trigger C (Execution Dispatch)**: When a task transitions to `IN_PROGRESS`, the watcher dispatches Antigravity for implementation.
- **Trigger D (PR Event-based Review)**: When a PR is `opened` or `synchronized` (new commits pushed), a GitHub Action triggers the Grok Build review runner.
- **Trigger E (Label-based Review)**: Manually adding the `needs-grok-review` label to a PR triggers a re-run of the review runner.
- **Trigger F (Local Review Runner)**: Antigravity completes implementation by moving `AGENT_STATE.md` to `UNDER_REVIEW`; the local watcher then generates `REVIEWS/review_request_NNN.md`, prepares the diff payload, and dispatches Grok Build.
- **Trigger G (Decision Router)**: When `REVIEWS/review_NNN.md` appears or changes on a PR branch, `.github/workflows/review-decision-router.yml` parses the decision and routes the next handoff through labels, PR comments, uploaded payload artifacts, and the optional `HANDOFF_ROUTER_ENDPOINT` webhook.

### Draft Advice File Contract (Legacy Fallback)

`REVIEWS/task_advice_NNN.md` must include:

```markdown
# Grok Build Task Advice: TASK-NNN

- **Advisor**: Grok Build
- **Type**: DRAFT_ADVICE

---

## 1. Summary

[Brief assessment of task clarity, risk, and missing context.]

## 2. Suggested Improvements

- [Suggestion 1]
- [Suggestion 2]

## 3. Risks / Open Questions

- [Risk or question]
```

Draft advice is consultative. Codex may adopt all, some, or none of the suggestions, but should keep the final task coherent and defensible before releasing it to `IN_PROGRESS`.

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
6. **Antigravity Start Prompt**: Always include a one-sentence instruction for Antigravity at the end of the task file (outside the template structure). The instruction must say that completion means moving the task to `UNDER_REVIEW`, not `COMPLETED`.

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

## 11. Cross-Agent Retrospective: `盤點此次任務`

When the human operator tells any agent `盤點此次任務`, that agent must produce a written retrospective for the latest completed task.

### Scope and Inputs

The responding agent must identify the latest completed task from `AGENT_STATE.md` using the most recent task with state `MERGED`, unless the operator explicitly names a task number. It should inspect the relevant task and review artifacts, including but not limited to:

- `TASKS/task_NNN.md`
- `REVIEWS/review_NNN.md`
- `REVIEWS/validation_master_NNN.md`
- `LOGS/change_log.md`
- any task-specific dispatch, handoff, or validation files when relevant

### Required Content

The retrospective must evaluate the other two colleagues, not the responding agent itself. For each colleague, include:

- concrete strengths and what they did well
- constructive suggestions for what to improve next time
- a short overall impression of their performance on that task

The tone must be candid, respectful, and improvement-oriented. Praise should be specific; criticism should be actionable and tied to evidence from the task artifacts.

### Output Location and Naming

The responding agent must write the retrospective as a Markdown file in `colleagueview/`:

```text
colleagueview/<agent>_view_NNN.md
```

Use these lowercase agent identifiers:

- Codex: `codex_view_NNN.md`
- Antigravity: `antigravity_view_NNN.md`
- Grok Build: `grok_view_NNN.md`

Example:

```text
colleagueview/codex_view_010.md
```

### Shared Directory Permission

`colleagueview/` is a shared retrospective workspace. Codex, Antigravity, and Grok Build are all allowed to read and write this directory regardless of their normal task/review/code write restrictions. This exception applies only to retrospective Markdown files and local directory documentation inside `colleagueview/`.

---

## 12. Post-Merge Reconciliation & Metadata Alignment

Upon merging a task branch to the `main` or `master` branch, Antigravity is responsible for performing a reconciliation check to ensure repository metadata remains aligned:
1. **Registry Updates**: Update `AGENT_STATE.md` with the task's final state `MERGED` and log the exact merged date.
2. **Task File Updates**: Update `TASKS/task_NNN.md` to transition its `Status` to `MERGED`.
3. **Metadata Enrichment**:
   - Fill in `PR URL` with the actual PR link (or `N/A (local merge @ <commit-sha>)` if merged locally).
   - Point `Linked Review` to the final review document `REVIEWS/review_NNN.md`.
4. **Log Registry**: Append an entry summarizing the change to `LOGS/change_log.md`.
5. **Validation Artifacts**: Ensure review documents (`REVIEWS/review_NNN.md` and the validation summary `REVIEWS/validation_master_NNN.md`) and the code branch history are properly archived and aligned in the main branch.
