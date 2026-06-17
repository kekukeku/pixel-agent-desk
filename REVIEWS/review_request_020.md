# Review Request: Show front-facing avatar portraits in System Roster picker (TASK-020)

- **Request ID**: RR-020
- **Linked Task**: [TASK-020](file:///Users/kevinkuo/My Drive/all/Github projects/pixel-agent-desk/TASKS/task_020.md)
- **Author**: Antigravity (Layer 3)
- **Target Branch**: `task/task_020_roster_avatar_portrait_picker`
- **Date**: 2026-06-17

---

## 1. Request Details

Fix the System Roster avatar appearance picker so users select recognizable front-facing character portraits, not compressed full spritesheets.

Current regression: the right-side roster picker renders each `avatar_X.webp` spritesheet as a tiny `<img>`, so the user sees a sheet of dots instead of the character. The roster card preview and picker options must show the agent's front-facing character appearance clearly.

---

## 2. Changes Summary

- **public/dashboard.js**: Action: MODIFY
- **public/dashboard.css**: Action: MODIFY

---

**Please evaluate these changes and record the decision in `REVIEWS/review_020.md`**.
