# Agent State and Architecture Definition

This document outlines the system architecture, agent roles, state machine, failure-handling mechanics, and autonomy loop for the three-agent autonomous system in this repository.

---

## 1. System Architecture & Gate Control

The development loop separates the **logical planning**, **code execution**, and **review authority**:
- **Layer 1 (Codex)**: Planner who defines specifications, writes task files, and manages the registry.
- **Layer 2 (Grok Build)**: Logical gatekeeper who reviews code changes and writes reviews.
- **Layer 3 (Antigravity)**: Executor who modifies code, creates PRs, and merges them once approved.
- **Enforcement Layer (GitHub)**: Automatically blocks merging via branch protection settings until status checks (Grok Build's review approval check) pass.

---

## 2. Central State Registry (Single Source of Truth)

To prevent state drift between different folders and GitHub PR statuses, this registry is the **single source of truth** for all tasks.

| Task ID | State | Linked PR / Branch | Last Updated |
| :--- | :--- | :--- | :--- |
| **TASK-001** | `MERGED` | [task/task_001_initialize_governance](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/TASKS/task_001.md) | 2026-06-16 |
| **TASK-002** | `MERGED` | [task/task_002_provider_agnostic_agent_events](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/TASKS/task_002.md) | 2026-06-16 |

---

## 3. Normalized Task Lifecycle States

Each task must progress strictly through the following state machine:

```mermaid
stateDiagram-v2
    [*] --> DRAFT : Create task file
    DRAFT --> IN_PROGRESS : Branch created & execution starts
    IN_PROGRESS --> UNDER_REVIEW : PR opened & review dispatcher triggers
    
    state UNDER_REVIEW {
        [*] --> Evaluating
        Evaluating --> Decision_Gate : Grok Build runs review
    }
    
    UNDER_REVIEW --> CHANGES_REQUESTED : Grok Build signals REQUEST_CHANGES
    CHANGES_REQUESTED --> IN_PROGRESS : Fixes applied
    
    UNDER_REVIEW --> APPROVED : Grok Build signals APPROVE
    UNDER_REVIEW --> REJECTED : Grok Build signals REJECT
    
    APPROVED --> MERGED : Antigravity merges & updates registry
    MERGED --> [*]
    REJECTED --> [*]
```

### State Transitions

| State | Target State | Triggering Event | Description / Action |
| :--- | :--- | :--- | :--- |
| **`DRAFT`** | `IN_PROGRESS` | Developer starts work | Task is added to the registry and a feature branch is created. |
| **`IN_PROGRESS`** | `UNDER_REVIEW` | PR created | A Pull Request is opened on GitHub, firing the Review Dispatcher. |
| **`UNDER_REVIEW`** | `CHANGES_REQUESTED` | Grok Build outputs `REQUEST_CHANGES` | Feedback is written to `REVIEWS/review_NNN.md` and check fails. |
| **`CHANGES_REQUESTED`** | `IN_PROGRESS` | Antigravity resumes editing | Changes are made on the branch. |
| **`UNDER_REVIEW`** | `APPROVED` | Grok Build outputs `APPROVE` | Review check passes, unlocking the physical merge gate on GitHub. |
| **`APPROVED`** | `MERGED` | Antigravity merges branch | PR is merged to `main`/`master`, change is logged, and registry is updated. |
| **`UNDER_REVIEW`** | `REJECTED` | Grok Build outputs `REJECT` | PR is closed without merging; task marked dead. |

---

## 4. Autonomy Loop & Event Dispatching

1. **Tasking**: Codex (Planner) adds a task in state `DRAFT` (or `TODO`) to the registry and writes the task specification.
2. **Coding**: Antigravity (Executor) picks up the draft task, transitions it to `IN_PROGRESS` in the Central State Registry, and edits the code on a feature branch.
3. **Dispatching**: Antigravity opens a PR. A GitHub Actions workflow intercepts the PR hook and dispatches the code diff + task spec to the Grok Build runner.
4. **Signaling**: Grok Build outputs its review report (`REVIEWS/review_NNN.md`) to the branch.
5. **Reconciliation**:
   - If the signal is `APPROVE`, the branch status check turns green, and Antigravity merges the PR.
   - If the signal is `REQUEST_CHANGES`, the status check remains red, and the task transitions to `CHANGES_REQUESTED` (and subsequently back to `IN_PROGRESS` once modification begins).
   - If `REJECT`, the PR is aborted and marked `REJECTED`.

---

## 5. Exception & Failure Handling

- **Review Deadlock**: If a PR is rejected or changes requested three (3) consecutive times, the loop halts, transitions the task to `REJECTED`, and alerts the operator.
- **Stalled Approved State**: If a PR remains `APPROVED` but unmerged for more than 24 hours, the loop halts to investigate git/auth conflicts.
- **Rule Violations**: If a commit bypasses the dispatcher or review gates, the validation Action fails, blocking the merge, and triggering an alert.
