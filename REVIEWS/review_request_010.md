# Review Request: Launch dashboard directly and remove always-floating desktop avatar (TASK-010)

- **Request ID**: RR-010
- **Linked Task**: [TASK-010](file:///Users/kevinkuo/My Drive/all/Github projects/pixel-agent-desk/TASKS/task_010.md)
- **Author**: Antigravity (Layer 3)
- **Target Branch**: `task/task_010_launch_dashboard_directly`
- **Date**: 2026-06-16

---

## 1. Request Details

Change Pixel Agent Desk startup behavior so users see the full dashboard UI immediately when opening the app. The app should no longer launch into the small always-on-top transparent desktop avatar window, because that floating overlay blocks visibility when users work in other applications.

The desired default experience:

- Running `npm start` opens the normal Pixel Agent Desk dashboard window.
- The dashboard shows the office floorplan and animated agents in the room as the primary view.
- No small always-floating desktop avatar/agent grid window is shown on startup.
- No keep-alive loop repeatedly forces a mini window above other applications.

This task is about app window behavior and startup UX. Do not change watcher dispatch, reviewer adapter, task routing, or agent event semantics.

---

## 2. Changes Summary

- **windowManager.js**: Action: MODIFY
- **main.js**: Action: MODIFY
- **ipcHandlers.js**: Action: MODIFY
- **dashboard.html**: Action: MODIFY
- **dashboard.js**: Action: MODIFY
- **dashboard.css**: Action: MODIFY
- **README.md**: Action: MODIFY

---

**Please evaluate these changes and record the decision in `REVIEWS/review_010.md`**.
