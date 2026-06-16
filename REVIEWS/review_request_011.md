# Review Request: Set default agent display names in user name map (TASK-011)

- **Request ID**: RR-011
- **Linked Task**: [TASK-011](file:///Users/kevinkuo/My Drive/all/Github projects/pixel-agent-desk/TASKS/task_011.md)
- **Author**: Antigravity (Layer 3)
- **Target Branch**: `task/task_011_default_agent_names`
- **Date**: 2026-06-16

---

## 1. Request Details

Write the local user name map so the three default watcher agents appear with the intended Chinese names instead of falling back to the project folder name `pixel-agent-desk`.

The target file is:

```text
~/.pixel-agent-desk/name-map.json
```

Its final JSON content must be exactly:

```json
{
  "antigravity": "小A沐瑤",
  "grok-build": "小B盼兮",
  "codex": "小C婉清"
}
```

This is a local user configuration task only. Do not modify app source code, watcher dispatch logic, reviewer adapter behavior, or historical task/review/log records.

---

## 2. Changes Summary

- **name-map.json**: Action: MODIFY

---

**Please evaluate these changes and record the decision in `REVIEWS/review_011.md`**.
