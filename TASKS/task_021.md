# TASK-021: Package portable agent-cowork workflow kit locally

- **Status**: `MERGED`
- **Created**: 2026-06-17
- **Created By**: Codex (Layer 1)
- **Assigned To**: Antigravity (Layer 3)
- **Reviewer**: Grok Build (Layer 2)
- **Priority**: `HIGH`
- **Branch**: `task/task_021_agent_cowork_local_package`
- **PR URL**: `N/A (local merge @ d7f95c387106f189b621188c4a18dc2152c4d314)`
- **Linked Advice**: [groupchat_021.md](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/PLANNING/groupchat_021.md)
- **Linked Review**: [review_021.md](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/REVIEWS/review_021.md)
- **Dependencies**: [TASK-013](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/TASKS/task_013.md), [TASK-016](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/TASKS/task_016.md), [TASK-019](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/TASKS/task_019.md)

---

## 1. Objective

Create a portable local workflow package named `agent-cowork/` inside this repository.

This package should extract the multi-agent governance workflow so it can later be copied into other existing or new projects. It must not include Pixel Agent Desk's visual app, Electron shell, dashboard, office characters, or UI assets.

This is phase 1 of the extraction. Do not create or push an independent GitHub repository in this task. The follow-up GitHub split/publish task will happen after local packaging is reviewed and approved.

---

## 2. Files Affected

- `[NEW]` [agent-cowork/](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/agent-cowork/)

### Candidate Files

- [watcher.py](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/watcher.py) as the source for a portable watcher copy.
- [agent-runner/](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/agent-runner/) as the source for portable review, GroupChat, and routing scripts.
- [scripts/start_pixel_workflow.sh](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/scripts/start_pixel_workflow.sh) as the source for a renamed portable startup script.
- [scripts/trigger_antigravity.py](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/scripts/trigger_antigravity.py) as the source for Antigravity handoff support.
- [TEAM_RULES.md](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/TEAM_RULES.md), [AGENT_STATE.md](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/AGENT_STATE.md), [PLANNING/README.md](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/PLANNING/README.md), [REVIEWS/README.md](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/REVIEWS/README.md), and [colleagueview/README.md](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/colleagueview/README.md) as template sources.

---

## 3. Acceptance Criteria

- A new `agent-cowork/` directory exists and is usable as a standalone local package skeleton.
- `agent-cowork/` contains a README explaining:
  - what the kit does
  - how to install it into an existing project
  - how to install it into a new project
  - the required startup order:
    1. Grok reviewer adapter on `127.0.0.1:47822`
    2. `watcher.py` monitoring that target project's `TASKS/` and `AGENT_STATE.md`
    3. `REVIEWER_ENGINE=tui` by default for Grok Build TUI
  - how to later split `agent-cowork/` into its own GitHub repo named `agent-cowork`
- `agent-cowork/` includes portable workflow components:
  - watcher entrypoint
  - reviewer adapter
  - review engine
  - review decision router
  - GroupChat planning runner and formatter
  - review request / diff generation scripts
  - Antigravity handoff trigger
  - workflow startup script
  - `install-workflow.js`
  - templates for `TEAM_RULES.md`, `AGENT_STATE.md`, `TASKS/`, `REVIEWS/`, `PLANNING/`, `LOGS/`, and `colleagueview/`
- `install-workflow.js` supports:
  - `--target <path>`
  - `--dry-run`
  - `--force`
  - conservative default behavior that does not overwrite existing target files unless `--force` is supplied
- The package must avoid hard-coded `pixel-agent-desk` project assumptions where practical. Use the target path, current working directory, package-relative paths, or documented environment variables.
- The package must not include Pixel Agent Desk app/UI assets or code:
  - no `src/`
  - no `public/`
  - no `dashboard.html`
  - no `index.html`
  - no Electron/dashboard tests
  - no `public/characters/`
  - no `src/office`
  - no logic that is only meaningful for the graphical office-character UI
- Include a local verification command or script that proves the package does not contain the excluded paths.
- Run and record focused verification:

```bash
find agent-cowork -maxdepth 4 -type f | sort
node agent-cowork/install-workflow.js --target /tmp/agent-cowork-smoke --dry-run
find agent-cowork -path '*/public/*' -o -path '*/src/*' -o -name 'dashboard.html' -o -name 'index.html'
```

The last command should produce no Pixel Agent Desk UI payload files inside `agent-cowork/`.

---

## 4. Implementation Notes

- This is intentionally a local package-first task. Do not run `git init` inside `agent-cowork/` yet.
- Prefer copying and adapting the current working workflow over inventing a new framework.
- Keep changes scoped to `agent-cowork/` plus normal task status updates. Do not modify the existing production workflow scripts unless a blocker is discovered and documented.
- If a script must be adapted for portability, keep the original source script unchanged and adapt the copy inside `agent-cowork/`.
- Provide clear comments where path behavior differs from the current Pixel Agent Desk-specific workflow.

### GroupChat Reconciliation

- The GroupChat session completed and produced [PLANNING/groupchat_021.md](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/PLANNING/groupchat_021.md), [PLANNING/groupchat_021.json](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/PLANNING/groupchat_021.json), and [PLANNING/draft_021.md](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/PLANNING/draft_021.md).
- 小C accepts 小B's advice to make portability, exclusions, startup order, and dry-run verification explicit acceptance criteria.
- 小C accepts 小A's advice to keep this as a local package-only task, support `--target` / `--dry-run` / `--force`, and avoid overwriting existing project files by default.
- 小C modifies the operator's broader GitHub publishing goal into a later task: independent repo creation and push should happen only after this local package is reviewed.

---

小A請建立本地 `agent-cowork/` workflow kit。完成後請把 `TASKS/task_021.md` 與 `AGENT_STATE.md` 移到 `UNDER_REVIEW`，不要標成 `COMPLETED`。
