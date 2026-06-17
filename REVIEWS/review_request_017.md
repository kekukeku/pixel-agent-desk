# Review Request: Add GroupChat meeting-room live mode and replay seating (TASK-017)

- **Request ID**: RR-017
- **Linked Task**: [TASK-017](file:///Users/kevinkuo/My Drive/all/Github projects/pixel-agent-desk/TASKS/task_017.md)
- **Author**: Antigravity (Layer 3)
- **Target Branch**: `task/task_017_groupchat_meeting_room_mode`
- **Date**: 2026-06-17

---

## 1. Request Details

Make GroupChat visually behave like a meeting instead of ordinary live agent wandering.

Kevin observed that during GroupChat planning, 小C shows a planning bubble while 小A and 小B remain in unrelated live positions. This does not match the intended meeting-room experience. When a GroupChat planning session is active, 小C, 小A, and 小B should move to the right-middle meeting room, occupy separated fixed seats, stay still, and show the relevant planning/advisory/replay speech bubbles there.

This task should cover both:

- **Live planning mode**: while watcher dispatches a `DRAFT` GroupChat planning session.
- **Replay mode**: when the dashboard replays an existing `PLANNING/groupchat_NNN.json` session.

---

## 2. Changes Summary

- **watcher.py**: Action: MODIFY
- **public/dashboard.js**: Action: MODIFY
- **src/office/office-character.js**: Action: MODIFY
- **src/office/office-config.js**: Action: MODIFY
- **src/office/office-ui.js**: Action: MODIFY
- **__tests__/watcher.test.js**: Action: MODIFY
- **__tests__/groupchatDashboard.test.js**: Action: MODIFY

---

**Please evaluate these changes and record the decision in `REVIEWS/review_017.md`**.
