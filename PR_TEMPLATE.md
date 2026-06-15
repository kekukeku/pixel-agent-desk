# PR Description

## Task Link
- **Task ID**: TASK-NNN (e.g. [TASK-001](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/TASKS/task_001.md))
- **Branch Name**: `task/task_NNN_<description>`
- **Commit SHA (Base)**: `[base_sha]`
- **Commit SHA (Head)**: `[head_sha]`

## Summary
Provide a brief summary of what this PR does and the problem it solves.

## Changes List
List the modified and new files:
- `[NEW/MODIFY/DELETE]` [filename](file:///absolute/path/to/file)

## Related Review File
- **Review File**: `REVIEWS/review_NNN.md` (To be created/updated by Grok Build)

## System Configuration Details
- **Breaking Change?**: [Yes / No]
- **Database Migrations Required?**: [Yes / No]

## Risk Notes
Describe any potential risks, side effects, or compatibility issues.

## Migration and Rollback Steps
Detail the concrete steps required to deploy this change and rollback if a failure occurs.

## Testing and Verification Notes
Outline how this change was tested or verified (e.g. test commands, test inputs/outputs, staging screenshots).

## Executor Pre-Review Self-Check
- [ ] **Acceptance Criteria**: All acceptance criteria outlined in `TASKS/task_NNN.md` are fully satisfied (or any exceptions are explicitly justified below).
- [ ] **Tests Executed**: All tests requested or relevant to the changes have been run and passed.
- [ ] **Documentation**: Required documentation updates (e.g. `README.md`, config files, rule files) have been made.
- [ ] **Backward Compatibility**: Code changes do not break legacy integrations or functions unless explicitly requested.
- [ ] **Dependency Control**: No unexpected package version upgrades or unnecessary lockfile changes are present in the PR.
- [ ] **Scope Verification**: Changes are strictly limited to the objective of this task; no scope creep has occurred.

*Provide justifications or explanations for any unchecked items or dependency updates below:*
