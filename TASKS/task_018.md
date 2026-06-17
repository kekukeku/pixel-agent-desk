# TASK-018: Restore System Roster avatar appearance picker

- **Status**: `MERGED`
- **Created**: 2026-06-17
- **Created By**: Codex (Layer 1)
- **Assigned To**: Antigravity (Layer 3)
- **Reviewer**: Grok Build (Layer 2)
- **Priority**: `MEDIUM`
- **Branch**: `task/task_018_roster_avatar_picker`
- **PR URL**: `N/A (local merge @ 010f534)`
- **Linked Advice**: [groupchat_018.md](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/PLANNING/groupchat_018.md)
- **Linked Review**: [review_018.md](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/REVIEWS/review_018.md)
- **Dependencies**: [TASK-009](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/TASKS/task_009.md), [TASK-010](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/TASKS/task_010.md)

---

## 1. Objective

Restore the user-facing ability to choose each roster agent's avatar appearance and persist that choice locally.

Kevin reports that the System Roster previously let users choose alternate character appearances for each role, and those choices were saved locally. The current dashboard roster only supports name editing and metrics; it no longer exposes avatar selection controls.

---

## 2. Investigation Findings

- `dashboard.html` currently renders only `#agentPanel` under System Roster.
- `public/dashboard.js` renders name editing, state, timeline, metrics, and context gauge, but no avatar/appearance picker.
- Legacy renderer code still has avatar loading primitives:
  - `src/preload.js` exposes `getAvatars()`.
  - `src/main/ipcHandlers.js` can return avatar files.
  - `src/renderer/config.js` and `src/renderer/agentCard.js` keep `agentAvatars`.
- The dashboard/office path uses `public/shared/avatars.json` and deterministic `avatarIndexFromId()`, but no local user override.

---

## 3. Files Affected

- `[MODIFY]` [public/dashboard.js](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/public/dashboard.js)
- `[MODIFY]` [public/dashboard.css](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/public/dashboard.css)
- `[MODIFY]` [src/office/office-character.js](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/src/office/office-character.js)
- `[MODIFY]` [src/office/office-config.js](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/src/office/office-config.js)
- `[MODIFY]` [README.md](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/README.md)

### Candidate Files

- [dashboard.html](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/dashboard.html) if static markup is needed for a roster-level picker template.
- [src/dashboard-server.js](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/src/dashboard-server.js) only if local persistence should be server-backed instead of browser `localStorage`.
- Add a focused test file if existing tests can cover the pure local-storage/helper logic.

---

## 4. Acceptance Criteria

- Each System Roster card exposes an appearance picker or avatar selector for that agent.
- The picker shows available avatars from `public/shared/avatars.json` and previews the character appearance clearly.
- Selecting an avatar updates both the roster card and the office canvas character for that agent without requiring app restart.
- Choices persist locally across dashboard reloads.
- Persistence is scoped by stable agent id or role id so 小C, 小A, and 小B can keep distinct appearances.
- A reset/default option restores deterministic avatar assignment from `avatarIndexFromId()`.
- The implementation must not overwrite replay-only avatar state or GroupChat meeting/replay overrides.
- Existing name editing, System Roster metrics, office rendering, and TASK-009 name persistence continue to work.
- If browser `localStorage` is used, document the key shape and keep it namespaced, for example `pixel-agent-desk.avatarOverrides.v1`.
- Run focused verification:

```bash
npm test -- --runTestsByPath __tests__/dashboard-server.test.js
```

If a new pure helper test is added, run that test as well.

---

## 5. Implementation Notes

- Prefer a compact control in each roster card, such as a small avatar preview button that opens a lightweight grid menu.
- Do not add a large settings page for this task.
- Use icons or previews instead of long text labels wherever practical.
- Avoid changing the server-side `AgentManager` allocation unless local browser persistence proves insufficient.
- Keep the avatar source of truth aligned with `public/shared/avatars.json`.

### GroupChat Reconciliation

- The GroupChat session completed and produced [PLANNING/groupchat_018.md](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/PLANNING/groupchat_018.md), [PLANNING/groupchat_018.json](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/PLANNING/groupchat_018.json), and [PLANNING/draft_018.md](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/PLANNING/draft_018.md).
- 小C does not adopt the generic fixture recommendations about implementing the GroupChat runner, schema, or DRAFT watcher hooks; those were already delivered by TASK-013.
- 小C final decision: proceed with the objective and acceptance criteria above, focused on restoring dashboard System Roster avatar appearance selection and local persistence.

---

## 6. Verification Plan

1. Start the dashboard with active agents visible in System Roster.
2. Change 小C's avatar and confirm the roster card and office sprite update immediately.
3. Reload the dashboard and confirm 小C keeps the selected avatar.
4. Change 小A and 小B separately and confirm their choices do not collide.
5. Reset one agent and confirm it returns to deterministic default.
6. Confirm name editing still works.

---

## 7. Rollback Notes

If avatar picker persistence causes incorrect sprites, remove only the local override layer and keep deterministic avatar assignment intact.

---

小C finalized this task after GroupChat advisory. 小A may start implementation.
