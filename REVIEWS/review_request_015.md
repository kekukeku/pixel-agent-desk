# Review Request: Add README note for keeping npm run workflow alive (TASK-015)

- **Request ID**: RR-015
- **Linked Task**: [TASK-015](file:///Users/kevinkuo/My Drive/all/Github projects/pixel-agent-desk/TASKS/task_015.md)
- **Author**: Antigravity (Layer 3)
- **Target Branch**: `task/task_015_workflow_alive_note`
- **Date**: 2026-06-17

---

## 1. Request Details

Add a concise README note explaining that `npm run workflow` must remain running in an active terminal for the local automation loop to work.

The note should prevent operator confusion when the command appears to start successfully but later handoffs do not happen because the process was stopped, the terminal returned to the prompt, or the reviewer adapter/watchdog are no longer alive.

This is intentionally a small docs-only task used to verify the end-to-end automation loop:

```text
DRAFT -> GroupChat advisory -> 小C finalization -> IN_PROGRESS -> 小A execution -> UNDER_REVIEW -> 小B review -> 小A fix/merge route
```

---

## 2. Changes Summary

- **README.md**: Action: MODIFY

---

**Please evaluate these changes and record the decision in `REVIEWS/review_015.md`**.
