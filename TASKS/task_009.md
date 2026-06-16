# TASK-009: Editable agent display names in dashboard roster

- **Status**: `MERGED`
- **Created**: 2026-06-16
- **Created By**: Codex (Layer 1)
- **Assigned To**: Antigravity (Layer 3)
- **Reviewer**: Grok Build (Layer 2)
- **Priority**: `MEDIUM`
- **Branch**: `task/task_009_editable_agent_names`
- **PR URL**: `N/A (local completion @ 8adfe62; operator authorized status reconciliation)`
- **Linked Review**: `N/A (operator authorized status reconciliation)`
- **Dependencies**: [TASK-008](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/TASKS/task_008.md)

---

## 1. Objective

Add a user-facing name editor to the right-side `System Roster` panel so users can rename visible agent avatars without editing JSON files manually.

When the user edits an agent's display name:

- The roster card updates immediately.
- The animated office character nametag updates immediately.
- The persisted name mapping is updated so the name survives app restart.
- The persistence path remains compatible with the existing `~/.pixel-agent-desk/name-map.json` behavior.

This task is UI/product work only. Do not change watcher dispatch, reviewer adapter, Antigravity handoff, or task routing behavior.

---

## 2. Files Affected

- `[MODIFY]` [dashboard.html](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/dashboard.html)
- `[MODIFY]` [public/dashboard.js](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/public/dashboard.js)
- `[MODIFY]` [public/dashboard.css](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/public/dashboard.css)
- `[MODIFY]` [src/dashboard-server.js](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/src/dashboard-server.js)
- `[MODIFY]` [src/agentManager.js](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/src/agentManager.js)
- `[MODIFY]` [src/office/office-character.js](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/src/office/office-character.js)
- `[MODIFY]` [__tests__/dashboard-server.test.js](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/__tests__/dashboard-server.test.js)
- `[MODIFY]` [__tests__/agentManager.test.js](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/__tests__/agentManager.test.js)

---

## 3. Acceptance Criteria

- Each agent card in the right-side `System Roster` exposes a compact edit affordance for the agent display name.
- Clicking the edit affordance lets the user enter a new name inline or in a small focused editor without navigating away.
- Saving a non-empty name updates the agent card title immediately.
- Saving a non-empty name updates the animated office character nametag immediately.
- The saved name is persisted to `~/.pixel-agent-desk/name-map.json` using the agent/session id as the key.
- If the mapping file does not exist, the app creates it and its parent directory safely.
- If a user clears the custom name, the app removes that agent id from `name-map.json` and falls back to the normal generated/default name.
- The API accepts only local dashboard requests and validates payload shape:
  - `agentId` must be a non-empty string.
  - `name` must be a string; trim whitespace before saving.
  - Reject names longer than 40 visible characters with a 400 response.
- The UI uses `textContent`, form values, or equivalent safe rendering for user-entered names. Do not inject user text through raw HTML.
- Existing live updates from SSE continue to work after a rename; subsequent agent updates must not revert the custom display name.
- Existing `LIVE` badge, PiP button, office canvas interactions, and roster card layout remain usable.
- Add or update Jest coverage for the new name-map read/write server behavior and agent manager name resolution.
- Run:

```bash
npm test -- --runTestsByPath __tests__/dashboard-server.test.js __tests__/agentManager.test.js
```

---

## 4. Implementation Notes

- Reuse the existing `~/.pixel-agent-desk/name-map.json` contract. Do not introduce a second user-name file unless there is a clear compatibility shim.
- A minimal local API is recommended:
  - `GET /api/name-map` returns the current mapping object.
  - `PUT /api/agents/:id/name` saves or clears one mapping and returns the updated display name/mapping entry.
- Keep file writes atomic where practical: write a temp file and rename it to `name-map.json`.
- `src/agentManager.js` already reads `name-map.json` when deriving display names. Prefer extending that path instead of duplicating name logic in the UI only.
- When a name is saved, update the in-memory agent object and publish enough UI update state for both the roster and office canvas to refresh.
- If the backend cannot find the agent id in memory, it may still update the mapping, but the response should make clear whether an active agent was updated.
- Keep the edit control compact. Use an icon button or short action near the agent name, not a large settings panel.
- Do not modify TASK-005, TASK-008, watcher dispatch logic, reviewer adapter, or Antigravity integration as part of this task.

---

## 5. Verification Plan

1. Start the app with `npm start` and the workflow with `npm run workflow` if testing automation.
2. Ensure at least one agent is visible in the dashboard.
3. Edit an agent name from the right-side roster.
4. Confirm the roster card title changes immediately.
5. Confirm the animated office nametag changes immediately.
6. Restart the dashboard/app.
7. Confirm the name persists from `~/.pixel-agent-desk/name-map.json`.
8. Clear the custom name and confirm the app falls back to the default name.
9. Run:

```bash
npm test -- --runTestsByPath __tests__/dashboard-server.test.js __tests__/agentManager.test.js
```

---

## 6. Rollback Notes

If the editor causes dashboard regressions, revert changes to the dashboard UI/server files and remove any new API route. Existing `~/.pixel-agent-desk/name-map.json` content should remain valid because it is already part of the app's supported configuration surface.

---

小A，請依照 `pixel-agent-desk/TASKS/task_009.md` 實作右側 roster 的小人名稱編輯功能；完成後不要標 `COMPLETED`，請將 `TASKS/task_009.md` 與 `AGENT_STATE.md` 推進到 `UNDER_REVIEW`，讓 Grok Build reviewer adapter 自動審查。
