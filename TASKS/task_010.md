# TASK-010: Launch dashboard directly and remove always-floating desktop avatar

- **Status**: `UNDER_REVIEW`
- **Created**: 2026-06-16
- **Created By**: Codex (Layer 1)
- **Assigned To**: Antigravity (Layer 3)
- **Reviewer**: Grok Build (Layer 2)
- **Priority**: `MEDIUM`
- **Branch**: `task/task_010_launch_dashboard_directly`
- **PR URL**: `TBD`
- **Linked Review**: `TBD`
- **Dependencies**: [TASK-009](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/TASKS/task_009.md)

---

## 1. Objective

Change Pixel Agent Desk startup behavior so users see the full dashboard UI immediately when opening the app. The app should no longer launch into the small always-on-top transparent desktop avatar window, because that floating overlay blocks visibility when users work in other applications.

The desired default experience:

- Running `npm start` opens the normal Pixel Agent Desk dashboard window.
- The dashboard shows the office floorplan and animated agents in the room as the primary view.
- No small always-floating desktop avatar/agent grid window is shown on startup.
- No keep-alive loop repeatedly forces a mini window above other applications.

This task is about app window behavior and startup UX. Do not change watcher dispatch, reviewer adapter, task routing, or agent event semantics.

---

## 2. Files Affected

- `[MODIFY]` [windowManager.js](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/src/main/windowManager.js)
- `[MODIFY]` [main.js](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/src/main.js)
- `[MODIFY]` [ipcHandlers.js](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/src/main/ipcHandlers.js)
- `[MODIFY]` [dashboard.html](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/dashboard.html)
- `[MODIFY]` [dashboard.js](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/public/dashboard.js)
- `[MODIFY]` [dashboard.css](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/public/dashboard.css)
- `[MODIFY]` [README.md](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/README.md)

### Candidate Files

- [index.html](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/index.html) may become unused by the default startup path. Remove it only if the codebase has no supported legacy path that still needs it.
- [pip.html](file:///Users/kevinkuo/My%20Drive/all/Github%20projects/pixel-agent-desk/pip.html) may remain if PiP is still available as an explicit user action.
- Add or update focused tests if the project already has suitable Electron main-process test coverage; otherwise document the manual verification clearly.

---

## 3. Acceptance Criteria

- `npm start` opens the full Pixel Agent Desk dashboard window directly.
- On startup, users can immediately see the office floorplan and animated agents in the room inside the full UI.
- The small transparent avatar/agent-grid window is not created or shown by default.
- No default startup window uses `alwaysOnTop: true`, `skipTaskbar: true`, `focusable: false`, or a recurring keep-alive call to force itself above other apps.
- Closing the dashboard window exits or closes the desktop app cleanly according to normal Electron platform behavior.
- Agent updates still reach the dashboard after startup, including initial recovered agents and live updates from watcher/hook events.
- The existing dashboard server startup remains intact.
- The right-side roster, office floorplan, token/cost KPIs, and existing TASK-009 name-edit behavior continue to work.
- If Picture-in-Picture remains available, it must be an explicit user action from the dashboard, not the default startup surface. If it still floats, the README must clearly describe it as optional and user-triggered.
- Remove or revise UI copy that advertises an always-on-top floating default experience.
- Update README startup documentation so `npm start` describes opening the full dashboard, not a floating desktop avatar.
- Run an appropriate automated test subset. At minimum, run:

```bash
npm test -- --runTestsByPath __tests__/dashboard-server.test.js
```

- Manually verify:
  - Start the app with `npm start`.
  - Confirm no small always-on-top avatar window appears.
  - Confirm the full dashboard appears and shows the office scene.
  - Switch to another application and confirm Pixel Agent Desk does not keep a small overlay above it.

---

## 4. Implementation Notes

- The likely source of the unwanted floating behavior is the legacy `createWindow()` path in `src/main/windowManager.js`, which creates a transparent frameless window with `alwaysOnTop: true`, `skipTaskbar: true`, and `focusable: false`, then keeps it on top via `startKeepAlive()`.
- Prefer making `createDashboardWindow()` the default app startup path.
- Do not merely hide the floating window while leaving keep-alive behavior running in the background.
- Keep app lifecycle logic simple: avoid creating both the legacy mini window and the dashboard window unless a user explicitly requests a secondary view.
- Preserve the local dashboard server because the dashboard and office modules depend on it.
- If removing default mini-window IPC paths would be risky, leave compatibility functions in place but ensure they are not called during default startup.
- Avoid broad visual redesign. This task is only about removing the blocking desktop overlay and making the existing full UI the launch surface.

---

## 5. Verification Plan

1. Ensure TASK-009 changes are merged or the working tree is otherwise stable.
2. Run:

```bash
npm test -- --runTestsByPath __tests__/dashboard-server.test.js
```

3. Start the app:

```bash
npm start
```

4. Confirm the full dashboard opens directly.
5. Confirm no always-floating desktop avatar/mini agent window appears.
6. Confirm watcher-driven agent state updates still appear in the dashboard if `npm run workflow` is running.
7. If PiP is kept, click the PiP button and confirm it remains optional and closeable.

---

## 6. Rollback Notes

If direct-dashboard startup breaks app launch, revert changes to `src/main/windowManager.js`, `src/main.js`, `src/main/ipcHandlers.js`, and any dashboard/README edits. The rollback should restore the prior mini-window startup path without touching watcher or reviewer automation.

---

小A，TASK-010 已釋出為 `IN_PROGRESS`；請讓 `npm start` 直接開完整 dashboard，移除預設 always-on-top 小人浮窗；完成後不要標 `COMPLETED`，請將 `TASKS/task_010.md` 與 `AGENT_STATE.md` 推進到 `UNDER_REVIEW`。
