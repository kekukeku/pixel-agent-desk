# Review Request: Add Pixel Agent Desk watcher with visual status and execution handoff (TASK-006)

- **Request ID**: RR-006
- **Linked Task**: [TASK-006](file:///Users/kevinkuo/My Drive/all/Github projects/pixel-agent-desk/TASKS/task_006.md)
- **Author**: Antigravity (Layer 3)
- **Target Branch**: `task/task_006_pixel_agent_desk_watcher`
- **Date**: 2026-06-15

---

## 1. Request Details

Create a Pixel Agent Desk-specific `watcher.py` that replaces the old project-specific watcher and watches this repository:

```text
/Users/kevinkuo/My Drive/all/Github projects/pixel-agent-desk
```

The watcher must support two responsibilities:

1. **Visual status updates**: publish normalized agent events to Pixel Agent Desk so Codex, Antigravity, and Grok Build are reflected by the animated office characters.
2. **Execution handoff**: monitor governance files in this repo and hand off work to the configured Antigravity or Grok Build execution environment.

The watcher should be reusable for this repo and should not contain iPLAYinn-specific paths or assumptions.

TASK-005 is intentionally paused while this watcher task is created. TASK-006 should not implement the TASK-005 UI title change.

---

## 2. Changes Summary

- **watcher.py**: Action: NEW
- **watcher.test.js**: Action: NEW
- **README.md**: Action: MODIFY

---

**Please evaluate these changes and record the decision in `REVIEWS/review_006.md`**.
